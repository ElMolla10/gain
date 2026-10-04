import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseImport } from "@gain/engine";
import { MIGRATIONS, migrate } from "../src/db/migrations";
import type { Db } from "../src/db/driver";
import type { MappingChoice, TitlePreview } from "../src/db/importRepo";
import { freshDb } from "./helpers";
import { openNodeDb } from "./nodeDriver";

const DAY = 86_400_000;
export const fx = (n: string) => readFileSync(join(__dirname, "../../../fixtures", n), "utf8");

export function acceptAll(titles: TitlePreview[]): Record<string, MappingChoice> {
  const out: Record<string, MappingChoice> = {};
  for (const t of titles) {
    const s = t.suggestion;
    out[t.title] = s.kind === "new" ? { kind: "new", nameEn: s.nameEn, pattern: s.pattern, equipment: s.equipment ?? "cable", setup: s.setup ?? "free" } : { kind: "existing", exerciseId: s.exerciseId };
  }
  return out;
}

/** A phone with real history: Mohamed's own Hevy export (70 workouts) imported, then own sessions, an accepted target and a declined one. */
export async function populatedWithRealHistory() {
  const c = await freshDb();
  await c.repos.seedIfNeeded();
  const gymId = (await c.repos.getActiveGymId())!;
  const gym = await c.repos.loadGymFingerprint(gymId);
  const parse = parseImport(fx("hevy-export.csv"));
  const prev = await c.imports.preview(parse);
  await c.imports.importHistory({ parse, gymId, mappings: acceptAll(prev.titles) });
  c.deps.tick(400 * DAY);
  let last = "";
  for (let r = 0; r < 2; r++) {
    for (let d = 0; d < 4; d++) {
      const next = (await c.repos.getNextDay())!;
      const exs = await c.repos.listDayExercises(next.day.id);
      const { id } = await c.workout.startOrResumeSession(next.day.id, gymId);
      const ex = exs[0]!;
      const ctx = { gym, equipment: ex.equipment, setup: ex.setup };
      await c.workout.logSet({ sessionId: id, exerciseId: ex.exerciseId, load: 30, reps: 10, warmup: true }, ctx);
      for (const reps of [10, 10, 9]) await c.workout.logSet({ sessionId: id, exerciseId: ex.exerciseId, load: 60, reps, rir: 2 }, ctx);
      c.deps.tick(1000);
      await c.workout.finishSession(id);
      last = (await c.finish.writeNextSessionTargets(id))!.sessionId;
      c.deps.tick(DAY);
    }
  }
  const targets = (await c.finish.getTargets(last)).filter((t) => t.currency !== "none" && t.load !== null);
  if (targets[0]) await c.finish.acceptTarget(targets[0].id);
  if (targets[1]) await c.finish.rejectTarget(targets[1].id);
  return { ...c, gymId, last };
}

export async function dumpAll(db: Db) {
  const names = (await db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")).map((r) => r.name);
  const out: Record<string, unknown[]> = {};
  for (const n of names) out[n] = await db.all(`SELECT * FROM ${n} ORDER BY id`).catch(() => db.all(`SELECT * FROM ${n}`));
  return out;
}

/**
 * The same data as it was stored by the app at schema `version`: a database built from the migrations up to `version`, filled with every row of
 * `src` (only the columns that schema has). Used to prove an upgrade keeps every row and gives the new columns their safe defaults.
 */
export async function copyAtVersion(src: Db, version: number): Promise<Db> {
  const old = openNodeDb();
  await migrate(old, MIGRATIONS.filter((m) => m.version <= version));
  await old.exec("PRAGMA foreign_keys = OFF");
  const tables = (await old.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")).map((r) => r.name);
  for (const t of tables) {
    const cols = (await old.all<{ name: string }>(`PRAGMA table_info(${t})`)).map((c) => c.name);
    const rows = await src.all<Record<string, string | number | null>>(`SELECT ${cols.join(", ")} FROM ${t}`);
    for (const r of rows) await old.run(`INSERT INTO ${t} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`, cols.map((c) => r[c]!));
  }
  await old.exec("PRAGMA foreign_keys = ON");
  return old;
}
