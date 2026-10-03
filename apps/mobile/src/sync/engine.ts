import {
  canonicalRow, compareVersions, isSyncedSetting, MAX_EVENTS_PER_PUSH, SYNC_TABLES, SYNCED_SETTING_KEYS, sortByDependency,
  type PullResponse, type PushResponse, type RowData, type SyncEvent, type SyncTable,
} from "@gain/sync";
import type { Db, Deps } from "../db/driver";
import { loadTableInfo, type TableInfo } from "./schema";
import { TransportError, type Transport } from "./transport";
import type { SecretStore } from "./secretStore";

/**
 * Opt-in backup and sync (Step 21, phone side). Nothing here runs unless the lifter turned it on; with it off no row is read and no request is made.
 *
 * Flow of one sync: (1) find rows whose version (updated_at:deleted_at) differs from what the server is known to have ("dirty") and queue
 * them as events with stable UUIDs; (2) push the queue in batches, removing an event only after the server acknowledged it; (3) pull
 * everything after the stored cursor and apply each page together with the new cursor in ONE transaction. A kill at any point leaves
 * either the old state or the new one, and re-sending is always safe because the server treats a repeated event as a duplicate.
 * Conflicts: last write wins per row (compareVersions in @gain/sync). Rows that cannot be applied are parked, never dropped or half-applied.
 */

export type SyncStatus = "off" | "pending" | "on";
export type SyncError = "not_enabled" | "offline" | "auth" | "rate_limited" | "server" | "clock" | "busy" | "bad_response";

export type SyncOutcome =
  | { ok: true; pushed: number; stale: number; rejected: number; pulled: number; parked: number }
  | { ok: false; error: SyncError; detail?: string };

export interface SyncInfo {
  status: SyncStatus;
  accountId: string | null;
  lastSyncAt: number | null;
  lastError: string | null;
  /** Rows changed on this phone and not yet acknowledged by the server. */
  pendingOut: number;
  parked: { waiting_parent: number; conflict: number; newer_app: number };
  rejectedTotal: number;
}

export type ConnectResult =
  | { ok: true; recoveryCode: string; needsChoice: false }
  | { ok: true; recoveryCode: string; needsChoice: true }
  | { ok: false; error: SyncError | "bad_recovery_code"; detail?: string };

const PAGE = 200;
// A fixed constant from @gain/sync, never user input.
const SETTING_KEYS_SQL = SYNCED_SETTING_KEYS.map((k) => `'${k}'`).join(",");
const S = { status: "status", account: "account_id", token: "device_token", recovery: "recovery_code", cursor: "cursor", last: "last_sync_at", err: "last_error", rejected: "rejected_total" } as const;

type Row = Record<string, string | number | null>;
const versionOf = (updatedAt: number, deletedAt: number | null) => `${updatedAt}:${deletedAt ?? ""}`;

/** The two values that must never sit in the database (it can be backed up, copied and read by anything with file access). */
const SECRET_KEYS: ReadonlySet<string> = new Set([S.token, S.recovery]);

export function createSyncEngine(db: Db, deps: Deps, transport: Transport, secrets: SecretStore | null = null) {
  let running = false;
  let secretsMoved = false;
  let infoCache: Map<SyncTable, TableInfo> | null = null;
  const info = async () => (infoCache ??= await loadTableInfo(db));

  // ---- state ----------------------------------------------------------------------------------------------------
  /**
   * With a secret store (the phone's secure storage) the device token and recovery code live there, not in SQLite. Values an older version
   * left in sync_state are moved on first use: written to the store, read back, and only then deleted from the database. If the store is
   * unavailable the value stays where it was (sync still works) rather than being lost.
   */
  async function moveSecrets(): Promise<void> {
    if (!secrets || secretsMoved) return;
    secretsMoved = true;
    for (const key of SECRET_KEYS) {
      const row = await db.get<{ value: string }>("SELECT value FROM sync_state WHERE id = ?", [key]);
      if (!row) continue;
      try {
        await secrets.set(key, row.value);
        if ((await secrets.get(key)) === row.value) await db.run("DELETE FROM sync_state WHERE id = ?", [key]);
      } catch {
        /* keep the database copy; try again next launch */
      }
    }
  }
  async function getState(key: string): Promise<string | null> {
    if (secrets && SECRET_KEYS.has(key)) {
      await moveSecrets();
      try {
        const v = await secrets.get(key);
        if (v !== null) return v;
      } catch {
        /* fall through to the database copy */
      }
    }
    return (await db.get<{ value: string }>("SELECT value FROM sync_state WHERE id = ?", [key]))?.value ?? null;
  }
  async function setState(key: string, value: string): Promise<void> {
    if (secrets && SECRET_KEYS.has(key)) {
      try {
        await secrets.set(key, value);
        await db.run("DELETE FROM sync_state WHERE id = ?", [key]);
        return;
      } catch {
        /* the secure store failed: keep the value in the database so sync still works, and move it later */
      }
    }
    await db.run("INSERT INTO sync_state (id, value) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET value = excluded.value", [key, value]);
  }
  async function status(): Promise<SyncStatus> {
    const v = await getState(S.status);
    return v === "on" || v === "pending" ? v : "off";
  }

  // ---- which rows are dirty -------------------------------------------------------------------------------------
  const dirtyWhere = (t: SyncTable) =>
    `FROM ${t} x LEFT JOIN sync_row_state s ON s.tbl = '${t}' AND s.row_id = x.id
     WHERE (s.row_id IS NULL OR s.version != (x.updated_at || ':' || COALESCE(x.deleted_at, '')))${t === "setting" ? ` AND x.id IN (${SETTING_KEYS_SQL})` : ""}`;

  async function scanDirty(): Promise<number> {
    const tables = await info();
    let queued = 0;
    for (const t of SYNC_TABLES) {
      const cols = tables.get(t)!.cols;
      const rows = await db.all<Row>(`SELECT x.* ${dirtyWhere(t)}`);
      if (rows.length === 0) continue;
      await db.transaction(async () => {
        for (const r of rows) {
          const id = String(r.id);
          const data = canonicalRow(pick(r, cols));
          const updatedAt = Number(r.updated_at);
          const deletedAt = r.deleted_at === null ? null : Number(r.deleted_at);
          const have = await db.get<{ event_id: string; updated_at: number; deleted_at: number | null; data: string }>("SELECT event_id, updated_at, deleted_at, data FROM sync_outbox WHERE tbl = ? AND row_id = ?", [t, id]);
          if (have && have.updated_at === updatedAt && have.deleted_at === deletedAt && have.data === data) continue; // same event keeps its id
          await db.run("DELETE FROM sync_outbox WHERE tbl = ? AND row_id = ?", [t, id]);
          await db.run("INSERT INTO sync_outbox (event_id, tbl, row_id, updated_at, deleted_at, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [deps.newId(), t, id, updatedAt, deletedAt, data, deps.now()]);
          queued++;
        }
      });
    }
    return queued;
  }

  async function pendingOut(): Promise<number> {
    let n = 0;
    for (const t of SYNC_TABLES) n += (await db.get<{ n: number }>(`SELECT COUNT(*) AS n ${dirtyWhere(t)}`))!.n;
    // Events queued for rows that are no longer dirty are acknowledged-but-not-yet-removed leftovers; count only real work.
    return n;
  }

  // ---- push -----------------------------------------------------------------------------------------------------
  async function pushAll(): Promise<{ pushed: number; stale: number; rejected: number } | { error: SyncError; detail?: string }> {
    const token = await getState(S.token);
    await scanDirty();
    const queued = await db.all<{ event_id: string; tbl: SyncTable; row_id: string; updated_at: number; deleted_at: number | null; data: string }>("SELECT * FROM sync_outbox");
    const ordered = sortByDependency(queued.map((q) => ({ ...q, table: q.tbl })));
    let pushed = 0, stale = 0, rejected = 0;
    for (let i = 0; i < ordered.length; i += MAX_EVENTS_PER_PUSH) {
      const chunk = ordered.slice(i, i + MAX_EVENTS_PER_PUSH);
      const events: SyncEvent[] = chunk.map((q) => ({ eventId: q.event_id, table: q.tbl, rowId: q.row_id, updatedAt: q.updated_at, deletedAt: q.deleted_at, data: q.data }));
      const res = await call("POST", "/v1/sync/push", token, { events });
      if ("error" in res) return res;
      const body = res.json as PushResponse;
      if (!body || !Array.isArray(body.results) || body.results.length !== events.length || body.results.some((r, k) => r?.eventId !== events[k]!.eventId)) return { error: "bad_response", detail: "push result mismatch" };
      let clock = false;
      await db.transaction(async () => {
        for (const [k, r] of body.results.entries()) {
          const q = chunk[k]!;
          if (r.status === "rejected" && r.reason === "clock_ahead") {
            clock = true;
            continue; // keep it queued: it will go through once the phone's clock is right
          }
          await db.run("INSERT INTO sync_row_state (tbl, row_id, version) VALUES (?, ?, ?) ON CONFLICT(tbl, row_id) DO UPDATE SET version = excluded.version", [q.tbl, q.row_id, versionOf(q.updated_at, q.deleted_at)]);
          await db.run("DELETE FROM sync_outbox WHERE event_id = ?", [q.event_id]);
          if (r.status === "applied") pushed++;
          else if (r.status === "stale" || r.status === "duplicate") stale++;
          else {
            rejected++;
            await setState(S.rejected, String(Number((await getState(S.rejected)) ?? "0") + 1));
          }
        }
      });
      if (clock) return { error: "clock", detail: "the phone's clock is ahead of the server's" };
    }
    return { pushed, stale, rejected };
  }

  // ---- pull / apply ---------------------------------------------------------------------------------------------
  type Remote = { table: SyncTable; rowId: string; updatedAt: number; deletedAt: number | null; data: string; seq: number };

  async function park(r: Remote, reason: "waiting_parent" | "conflict" | "newer_app", detail: string | null): Promise<"parked"> {
    await db.run(
      `INSERT INTO sync_parked (tbl, row_id, seq, updated_at, deleted_at, data, reason, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tbl, row_id) DO UPDATE SET seq = excluded.seq, updated_at = excluded.updated_at, deleted_at = excluded.deleted_at, data = excluded.data, reason = excluded.reason, detail = excluded.detail
       WHERE excluded.seq >= sync_parked.seq`,
      [r.table, r.rowId, r.seq, r.updatedAt, r.deletedAt, r.data, reason, detail],
    );
    return "parked";
  }

  /** Applies one remote row if it wins. Never throws for a row-level problem: it parks the row instead. */
  async function applyOne(r: Remote): Promise<"applied" | "kept_local" | "parked" | "skipped"> {
    const tables = await info();
    const ti = tables.get(r.table);
    if (!ti) return "skipped";
    if (r.table === "setting" && !isSyncedSetting(r.rowId)) return "skipped";
    let row: Row;
    try {
      row = JSON.parse(r.data) as Row;
    } catch {
      return "skipped";
    }
    const unknown = Object.keys(row).filter((k) => !ti.cols.includes(k));
    if (unknown.length > 0) return park(r, "newer_app", unknown.join(","));
    for (const fk of ti.fks) {
      const v = row[fk.col];
      if (v === null || v === undefined) continue;
      const parent = await db.get(`SELECT 1 AS x FROM ${fk.parent} WHERE id = ?`, [v]);
      if (!parent) return park(r, "waiting_parent", `${fk.parent}:${String(v)}`);
    }
    const local = await db.get<Row>(`SELECT * FROM ${r.table} WHERE id = ?`, [r.rowId]);
    if (local) {
      const cmp = compareVersions(
        { updatedAt: r.updatedAt, deletedAt: r.deletedAt, data: r.data },
        { updatedAt: Number(local.updated_at), deletedAt: local.deleted_at === null ? null : Number(local.deleted_at), data: canonicalRow(pick(local, ti.cols)) },
      );
      if (cmp <= 0) {
        // Same version: nothing to write, just remember the server has it. Local is newer: leave it, it goes out on the next push.
        if (cmp === 0) await markSynced(r);
        await db.run("DELETE FROM sync_parked WHERE tbl = ? AND row_id = ?", [r.table, r.rowId]);
        return "kept_local";
      }
    }
    const cols = Object.keys(row);
    try {
      await db.run(
        `INSERT INTO ${r.table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})
         ON CONFLICT(id) DO UPDATE SET ${cols.filter((c) => c !== "id").map((c) => `${c} = excluded.${c}`).join(", ")}`,
        cols.map((c) => row[c]!),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/constraint/i.test(msg)) return park(r, "conflict", msg.slice(0, 200));
      throw e;
    }
    await markSynced(r);
    await db.run("DELETE FROM sync_parked WHERE tbl = ? AND row_id = ?", [r.table, r.rowId]);
    return "applied";
  }

  async function markSynced(r: Remote): Promise<void> {
    await db.run("INSERT INTO sync_row_state (tbl, row_id, version) VALUES (?, ?, ?) ON CONFLICT(tbl, row_id) DO UPDATE SET version = excluded.version", [r.table, r.rowId, versionOf(r.updatedAt, r.deletedAt)]);
  }

  /** Must run inside a transaction. Applies the rows parents-first, then gives parked rows another chance until nothing moves. */
  async function applyRows(rows: Remote[]): Promise<number> {
    let applied = 0;
    for (const r of sortByDependency(rows)) if ((await applyOne(r)) === "applied") applied++;
    for (let guard = 0; guard < 50; guard++) {
      const waiting = await db.all<{ tbl: SyncTable; row_id: string; seq: number; updated_at: number; deleted_at: number | null; data: string }>("SELECT * FROM sync_parked ORDER BY seq");
      let moved = 0;
      for (const w of sortByDependency(waiting.map((x) => ({ ...x, table: x.tbl })))) {
        const res = await applyOne({ table: w.tbl, rowId: w.row_id, updatedAt: w.updated_at, deletedAt: w.deleted_at, data: w.data, seq: w.seq });
        if (res === "applied") {
          moved++;
          applied++;
        }
      }
      if (moved === 0) break;
    }
    return applied;
  }

  async function pullAll(): Promise<{ pulled: number } | { error: SyncError; detail?: string }> {
    const token = await getState(S.token);
    let cursor = Number((await getState(S.cursor)) ?? "0");
    let pulled = 0;
    for (let page = 0; page < 10_000; page++) {
      const res = await call("GET", `/v1/sync/pull?since=${cursor}&limit=${PAGE}`, token);
      if ("error" in res) return res;
      const body = res.json as PullResponse;
      if (!body || !Array.isArray(body.rows) || typeof body.next !== "number" || typeof body.hasMore !== "boolean") return { error: "bad_response", detail: "pull shape" };
      await db.transaction(async () => {
        pulled += await applyRows(body.rows);
        await setState(S.cursor, String(body.next)); // cursor and rows move together
      });
      if (!body.hasMore) return { pulled };
      if (body.next <= cursor) return { error: "bad_response", detail: "cursor did not advance" };
      cursor = body.next;
    }
    return { error: "bad_response", detail: "too many pages" };
  }

  // ---- http helper ----------------------------------------------------------------------------------------------
  async function call(method: "GET" | "POST" | "DELETE", path: string, token: string | null, body?: unknown): Promise<{ status: number; json: unknown } | { error: SyncError; detail?: string }> {
    try {
      const res = await transport.request(method, path, { token, body });
      if (res.status === 401) return { error: "auth" };
      if (res.status === 429) return { error: "rate_limited" };
      if (res.status >= 500) return { error: "server", detail: `HTTP ${res.status}` };
      if (res.status >= 400) return { error: "bad_response", detail: `HTTP ${res.status} ${(res.json as { error?: string } | null)?.error ?? ""}`.trim() };
      return res;
    } catch (e) {
      if (e instanceof TransportError) return { error: "offline", detail: e.message };
      throw e;
    }
  }

  // ---- public: one sync -----------------------------------------------------------------------------------------
  async function syncNow(): Promise<SyncOutcome> {
    if ((await status()) !== "on") return { ok: false, error: "not_enabled" };
    if (running) return { ok: false, error: "busy" };
    running = true;
    try {
      const pushed = await pushAll();
      if ("error" in pushed) return fail(pushed.error, pushed.detail);
      const pulled = await pullAll();
      if ("error" in pulled) return fail(pulled.error, pulled.detail);
      await setState(S.last, String(deps.now()));
      await db.run("DELETE FROM sync_state WHERE id = ?", [S.err]);
      const parked = (await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM sync_parked"))!.n;
      return { ok: true, ...pushed, pulled: pulled.pulled, parked };
    } finally {
      running = false;
    }
  }
  async function fail(error: SyncError, detail?: string): Promise<SyncOutcome> {
    await setState(S.err, detail ? `${error}: ${detail}` : error);
    return { ok: false, error, detail };
  }

  // ---- public: turning it on ------------------------------------------------------------------------------------
  /** Real lifter data on this phone (not just the sample programme the app seeds on first run). */
  async function hasUserData(): Promise<boolean> {
    if (await db.get("SELECT 1 AS x FROM setting WHERE id = 'onboarding_state' AND deleted_at IS NULL")) return true;
    for (const sql of [
      "SELECT 1 AS x FROM session WHERE status = 'finished' AND deleted_at IS NULL LIMIT 1",
      "SELECT 1 AS x FROM bodyweight_entry WHERE deleted_at IS NULL LIMIT 1",
      "SELECT 1 AS x FROM goal WHERE deleted_at IS NULL LIMIT 1",
    ]) if (await db.get(sql)) return true;
    return false;
  }

  /**
   * Step 1 of turning sync on. Creates an anonymous account (or signs in with a recovery code), then decides what the first sync does:
   * server empty -> upload this phone; phone has no data of its own -> take the backup; both have data -> `needsChoice` (take the backup, or cancel).
   * Safe to call again after a failure: a half-made connection resumes instead of creating a second account.
   */
  async function connect(opts: { recoveryCode?: string; label?: string } = {}): Promise<ConnectResult> {
    if ((await status()) === "on") return { ok: false, error: "busy", detail: "already on" };
    let token = await getState(S.token);
    let recovery = await getState(S.recovery);
    if (!token || opts.recoveryCode) {
      const res = opts.recoveryCode
        ? await call("POST", "/v1/auth/recover", null, { recoveryCode: opts.recoveryCode, label: opts.label })
        : await call("POST", "/v1/account", null, { label: opts.label });
      if ("error" in res) {
        if (opts.recoveryCode && res.error === "auth") return { ok: false, error: "bad_recovery_code" };
        return { ok: false, error: res.error, detail: res.detail };
      }
      const j = res.json as { accountId?: string; deviceToken?: string; recoveryCode?: string };
      if (!j?.deviceToken || !j.accountId) return { ok: false, error: "bad_response" };
      token = j.deviceToken;
      recovery = j.recoveryCode ?? opts.recoveryCode ?? null;
      await db.transaction(async () => {
        await setState(S.token, token!);
        await setState(S.account, j.accountId!);
        if (recovery) await setState(S.recovery, recovery);
        await setState(S.status, "pending");
      });
    }
    const me = await call("GET", "/v1/me", token);
    if ("error" in me) return { ok: false, error: me.error, detail: me.detail };
    const serverRows = Number((me.json as { rows?: number })?.rows ?? 0);
    const local = await hasUserData();
    if (serverRows > 0 && local) return { ok: true, recoveryCode: recovery ?? "", needsChoice: true };
    if (serverRows > 0) {
      const r = await takeBackup();
      if (!r.ok) return { ok: false, error: r.error, detail: r.detail };
    } else {
      await setState(S.status, "on");
    }
    return { ok: true, recoveryCode: recovery ?? "", needsChoice: false };
  }

  /**
   * Step 2 when both sides have data. The only way forward is to take the backup (replacing this phone's synced data); nothing merges.
   * The other answer is `disconnect({ deleteServerData: false })`, which keeps this phone as it is. To replace the backup with this
   * phone's data instead, delete the backup first and connect again.
   */
  async function useBackup(): Promise<{ ok: true } | { ok: false; error: SyncError; detail?: string }> {
    if ((await status()) !== "pending") return { ok: false, error: "not_enabled" };
    return takeBackup();
  }

  /**
   * Replace this phone's synced data with the backup. The whole backup is downloaded FIRST; only then is the phone changed, in one
   * transaction, so going offline half way leaves the phone exactly as it was.
   */
  async function takeBackup(): Promise<{ ok: true } | { ok: false; error: SyncError; detail?: string }> {
    const token = await getState(S.token);
    const all: Remote[] = [];
    let cursor = 0;
    for (let page = 0; page < 10_000; page++) {
      const res = await call("GET", `/v1/sync/pull?since=${cursor}&limit=${PAGE}`, token);
      if ("error" in res) return { ok: false, error: res.error, detail: res.detail };
      const body = res.json as PullResponse;
      if (!body || !Array.isArray(body.rows) || typeof body.next !== "number" || typeof body.hasMore !== "boolean") return { ok: false, error: "bad_response" };
      all.push(...body.rows);
      if (!body.hasMore) {
        cursor = body.next;
        break;
      }
      if (body.next <= cursor) return { ok: false, error: "bad_response", detail: "cursor did not advance" };
      cursor = body.next;
    }
    // Never wipe a phone for an empty backup (e.g. a half-finished setup): that would destroy data to replace it with nothing.
    if (all.length === 0) return { ok: false, error: "bad_response", detail: "the backup is empty" };
    await db.exec("PRAGMA foreign_keys = OFF");
    try {
      await db.transaction(async () => {
        for (const t of [...SYNC_TABLES].reverse()) await db.run(`DELETE FROM ${t}`);
        await db.run("DELETE FROM sync_row_state");
        await db.run("DELETE FROM sync_outbox");
        await db.run("DELETE FROM sync_parked");
        await applyRows(all);
        await setState(S.cursor, String(cursor));
        await setState(S.status, "on");
      });
    } finally {
      await db.exec("PRAGMA foreign_keys = ON");
    }
    return { ok: true };
  }

  /** A signed request to the server with the stored token. Used by coach links; never called while the lifter has not used a server feature. */
  async function api(method: "GET" | "POST" | "DELETE", path: string, body?: unknown): Promise<{ status: number; json: unknown } | { error: SyncError; detail?: string }> {
    return call(method, path, await getState(S.token), body);
  }

  /**
   * Makes sure this phone has an anonymous server account WITHOUT turning sync on (coach links need an owner who can revoke them).
   * If sync is turned on later, this same account is reused.
   */
  async function ensureAccount(label?: string): Promise<{ ok: true } | { ok: false; error: SyncError; detail?: string }> {
    if (await getState(S.token)) return { ok: true };
    const res = await call("POST", "/v1/account", null, { label });
    if ("error" in res) return { ok: false, error: res.error, detail: res.detail };
    const j = res.json as { accountId?: string; deviceToken?: string; recoveryCode?: string };
    if (!j?.deviceToken || !j.accountId) return { ok: false, error: "bad_response" };
    await db.transaction(async () => {
      await setState(S.token, j.deviceToken!);
      await setState(S.account, j.accountId!);
      if (j.recoveryCode) await setState(S.recovery, j.recoveryCode);
    });
    return { ok: true };
  }

  // ---- public: turning it off / reading state ------------------------------------------------------------------
  /**
   * Turns sync off on this phone. With `deleteServerData` the account and every uploaded row are deleted FIRST; if that cannot be done
   * (offline) nothing changes and the caller says so, so nobody believes their backup is gone when it is not.
   */
  async function disconnect(opts: { deleteServerData: boolean }): Promise<{ ok: true } | { ok: false; error: SyncError; detail?: string }> {
    const token = await getState(S.token);
    if (token) {
      if (opts.deleteServerData) {
        const r = await call("DELETE", "/v1/account", token);
        if ("error" in r && r.error !== "auth") return { ok: false, error: r.error, detail: r.detail }; // auth = already gone
      } else {
        await call("POST", "/v1/auth/logout", token).catch(() => undefined); // best effort
      }
    }
    await clearLocal();
    return { ok: true };
  }

  /** Forget everything about sync on this phone (also used when a restore or "delete everything" runs). Lifter data is untouched. */
  async function clearLocal(): Promise<void> {
    await db.transaction(async () => {
      for (const t of ["sync_state", "sync_row_state", "sync_outbox", "sync_parked"]) await db.run(`DELETE FROM ${t}`);
    });
    if (secrets) for (const key of SECRET_KEYS) await secrets.delete(key).catch(() => undefined);
  }

  async function getInfo(): Promise<SyncInfo> {
    const st = await status();
    const parkedRows = await db.all<{ reason: keyof SyncInfo["parked"]; n: number }>("SELECT reason, COUNT(*) AS n FROM sync_parked GROUP BY reason");
    const parked = { waiting_parent: 0, conflict: 0, newer_app: 0 };
    for (const p of parkedRows) parked[p.reason] = p.n;
    return {
      status: st,
      accountId: await getState(S.account),
      lastSyncAt: Number((await getState(S.last)) ?? "") || null,
      lastError: await getState(S.err),
      pendingOut: st === "on" ? await pendingOut() : 0,
      parked,
      rejectedTotal: Number((await getState(S.rejected)) ?? "0"),
    };
  }
  async function getRecoveryCode(): Promise<string | null> {
    return getState(S.recovery);
  }

  return { syncNow, connect, useBackup, disconnect, ensureAccount, api, clearLocal, getInfo, getRecoveryCode, hasUserData, status, token: () => getState(S.token) };
}
export type SyncEngine = ReturnType<typeof createSyncEngine>;

function pick(row: Row, cols: string[]): RowData {
  const out: RowData = {};
  for (const c of cols) out[c] = (row[c] ?? null) as RowData[string];
  return out;
}
