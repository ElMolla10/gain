import type { Db } from "./driver";

/**
 * Self-healing schema helpers. A phone's database can reach this app in a state the numbered migrations did not expect: a build from another
 * branch, a restore, or a migration that half-ran on an older build. These helpers make applying a migration safe to repeat:
 *   - CREATE TABLE / INDEX / TRIGGER / VIEW is skipped when an object with that name already exists;
 *   - ALTER TABLE .. ADD COLUMN is skipped when the column already exists;
 *   - every other statement (the few backfill UPDATEs, all guarded by WHERE .. IS NULL or written to be repeatable) runs as written.
 * They only ever ADD structure. Nothing here drops, renames or rewrites a row the lifter saved.
 */

/** Splits migration SQL into statements. Handles quotes, -- and block comments, and CREATE TRIGGER bodies (BEGIN .. END;). */
export function splitSql(sql: string): string[] {
  const out: string[] = [];
  let cur = "";
  let segment = ""; // text since the last ';' with comments removed, to spot a trigger's closing END
  let clean = ""; // the current statement with comments removed
  let i = 0;
  const flush = () => {
    const s = clean.trim();
    if (s) out.push(s);
    cur = "";
    clean = "";
    segment = "";
  };
  while (i < sql.length) {
    const c = sql[i]!;
    const n = sql[i + 1];
    if (c === "-" && n === "-") {
      const end = sql.indexOf("\n", i);
      const stop = end === -1 ? sql.length : end;
      cur += sql.slice(i, stop);
      i = stop;
      continue;
    }
    if (c === "/" && n === "*") {
      const end = sql.indexOf("*/", i + 2);
      const stop = end === -1 ? sql.length : end + 2;
      cur += sql.slice(i, stop);
      clean += " ";
      segment += " ";
      i = stop;
      continue;
    }
    if (c === "'" || c === '"' || c === "`" || c === "[") {
      const close = c === "[" ? "]" : c;
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === close) {
          if (close !== "]" && sql[j + 1] === close) {
            j += 2;
            continue;
          }
          break;
        }
        j++;
      }
      const lit = sql.slice(i, Math.min(j + 1, sql.length));
      cur += lit;
      clean += lit;
      segment += lit;
      i = j + 1;
      continue;
    }
    if (c === ";") {
      cur += c;
      clean += c;
      const isTrigger = /^\s*CREATE\s+(?:TEMP(?:ORARY)?\s+)?TRIGGER\b/i.test(clean);
      if (!isTrigger || /^\s*END\s*$/i.test(segment)) flush();
      else segment = "";
      i++;
      continue;
    }
    cur += c;
    clean += c;
    segment += c;
    i++;
  }
  flush();
  return out;
}

const CREATE_RE = /^CREATE\s+(?:UNIQUE\s+|TEMP(?:ORARY)?\s+)?(TABLE|INDEX|TRIGGER|VIEW)\s+(?:IF\s+NOT\s+EXISTS\s+)?["`[]?(\w+)/i;
const ADD_COLUMN_RE = /^ALTER\s+TABLE\s+["`[]?(\w+)["`\]]?\s+ADD\s+(?:COLUMN\s+)?["`[]?(\w+)/i;

export type Stmt = { kind: "create"; name: string; sql: string } | { kind: "add_column"; table: string; column: string; sql: string } | { kind: "other"; sql: string };

export function classify(sql: string): Stmt {
  const c = CREATE_RE.exec(sql);
  if (c) return { kind: "create", name: c[2]!, sql };
  const a = ADD_COLUMN_RE.exec(sql);
  if (a) return { kind: "add_column", table: a[1]!, column: a[2]!, sql };
  return { kind: "other", sql };
}

/** What exists now: object names (tables, indexes, triggers, views) and table -> columns. Two queries however big the schema is. */
export async function readSchema(db: Db): Promise<{ objects: Set<string>; columns: Map<string, Set<string>> }> {
  const objs = await db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'");
  const cols = await db.all<{ t: string; c: string }>("SELECT m.name AS t, p.name AS c FROM sqlite_master m, pragma_table_info(m.name) p WHERE m.type = 'table' AND m.name NOT LIKE 'sqlite_%'");
  const columns = new Map<string, Set<string>>();
  for (const r of cols) {
    const k = r.t.toLowerCase();
    if (!columns.has(k)) columns.set(k, new Set());
    columns.get(k)!.add(r.c.toLowerCase());
  }
  return { objects: new Set(objs.map((o) => o.name.toLowerCase())), columns };
}

function missing(s: Stmt, schema: { objects: Set<string>; columns: Map<string, Set<string>> }): boolean {
  if (s.kind === "create") return !schema.objects.has(s.name.toLowerCase());
  if (s.kind === "add_column") return !(schema.columns.get(s.table.toLowerCase())?.has(s.column.toLowerCase()) ?? false);
  return true;
}

function note(s: Stmt, schema: { objects: Set<string>; columns: Map<string, Set<string>> }, db: Db): Promise<void> | void {
  if (s.kind === "create") {
    schema.objects.add(s.name.toLowerCase());
    // A new table's columns come from its definition; read them so a later ADD COLUMN on it is judged correctly.
    if (/^CREATE\s+(?:TEMP(?:ORARY)?\s+)?TABLE/i.test(s.sql)) {
      return db.all<{ name: string }>(`PRAGMA table_info(${s.name})`).then((rows) => void schema.columns.set(s.name.toLowerCase(), new Set(rows.map((r) => r.name.toLowerCase()))));
    }
  } else if (s.kind === "add_column") {
    const k = s.table.toLowerCase();
    if (!schema.columns.has(k)) schema.columns.set(k, new Set());
    schema.columns.get(k)!.add(s.column.toLowerCase());
  }
}

/** Applies one migration's SQL, skipping structure that already exists. Run it inside the migration's transaction. */
export async function applyTolerant(db: Db, sql: string): Promise<{ applied: number; skipped: number }> {
  const schema = await readSchema(db);
  let applied = 0;
  let skipped = 0;
  for (const raw of splitSql(sql)) {
    const s = classify(raw);
    if (s.kind !== "other" && !missing(s, schema)) {
      skipped++;
      continue;
    }
    await db.exec(s.sql);
    await note(s, schema, db);
    applied++;
  }
  return { applied, skipped };
}

/**
 * Repair for a database whose user_version claims a schema it does not have (tables or columns missing). Re-adds ONLY the missing structure,
 * in migration order; a migration's backfill statements run again only when that migration's structure had to be re-added. Returns what it
 * added (empty = the database was already complete; that costs two read queries and no writes).
 */
export async function repairSchema(db: Db, migrations: readonly { version: number; sql: string }[]): Promise<string[]> {
  const schema = await readSchema(db);
  const plan: { version: number; stmts: Stmt[] }[] = migrations.map((m) => ({ version: m.version, stmts: splitSql(m.sql).map(classify) }));
  // Read-only check first: the usual answer is "nothing missing", and then nothing is written.
  if (!plan.some((m) => m.stmts.some((s) => s.kind !== "other" && missing(s, schema)))) return [];
  const added: string[] = [];
  await db.transaction(async () => {
    const live = await readSchema(db);
    for (const m of plan) {
      let touched = false;
      for (const s of m.stmts) {
        if (s.kind === "other" || !missing(s, live)) continue;
        await db.exec(s.sql);
        await note(s, live, db);
        added.push(s.kind === "create" ? `v${m.version} ${s.name}` : `v${m.version} ${s.table}.${s.column}`);
        touched = true;
      }
      if (touched) for (const s of m.stmts) if (s.kind === "other") await db.exec(s.sql);
    }
  });
  return added;
}
