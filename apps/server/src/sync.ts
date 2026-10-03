import { MAX_EVENTS_PER_PUSH, MAX_PULL_LIMIT, validateEvent, type PullResponse, type PushResponse, type PushResult, type SyncEvent, type SyncTable } from "@gain/sync";
import type { Auth } from "./auth";
import { rateLimit } from "./ratelimit";
import { HttpError, type Env } from "./types";
import { json, readJson } from "./util";

const MINUTE = 60 * 1000;

/**
 * The last-write-wins guard, in SQL so two concurrent pushes cannot both win. Same order as compareVersions() in @gain/sync:
 * later updated_at wins; at the same instant a tombstone beats a live row; then the larger canonical JSON string.
 */
const UPSERT = `
INSERT INTO sync_row (account_id, tbl, row_id, updated_at, deleted_at, data, seq, event_id, device_id, received_at)
VALUES (?1, ?2, ?3, ?4, ?5, ?6, (SELECT COALESCE(MAX(seq), 0) + 1 FROM sync_row WHERE account_id = ?1), ?7, ?8, ?9)
ON CONFLICT(account_id, tbl, row_id) DO UPDATE SET
  updated_at = excluded.updated_at, deleted_at = excluded.deleted_at, data = excluded.data,
  seq = excluded.seq, event_id = excluded.event_id, device_id = excluded.device_id, received_at = excluded.received_at
WHERE excluded.updated_at > sync_row.updated_at
   OR (excluded.updated_at = sync_row.updated_at AND (
        (excluded.deleted_at IS NOT NULL AND sync_row.deleted_at IS NULL)
        OR ((excluded.deleted_at IS NOT NULL) = (sync_row.deleted_at IS NOT NULL) AND excluded.data > sync_row.data)))`;

/** POST /v1/sync/push {events}: idempotent. Every event gets a result; one bad event never blocks the others. */
export async function push(req: Request, env: Env, auth: Auth, now: number): Promise<Response> {
  await rateLimit(env.DB, `push:${auth.accountId}`, 120, MINUTE, now);
  const body = (await readJson(req, 8 * 1024 * 1024)) as { events?: unknown };
  if (!Array.isArray(body.events) || body.events.length > MAX_EVENTS_PER_PUSH) throw new HttpError(400, "bad_events");

  const results: PushResult[] = new Array(body.events.length);
  const good: { i: number; ev: SyncEvent }[] = [];
  const seen = new Set<string>();
  body.events.forEach((raw, i) => {
    const why = validateEvent(raw, now);
    const ev = raw as SyncEvent;
    if (why) results[i] = { eventId: typeof (raw as { eventId?: unknown })?.eventId === "string" ? (raw as { eventId: string }).eventId : "", status: "rejected", reason: why };
    else if (seen.has(ev.eventId)) results[i] = { eventId: ev.eventId, status: "duplicate" };
    else {
      seen.add(ev.eventId);
      good.push({ i, ev });
    }
  });

  if (good.length > 0) {
    // What the server holds now, only to tell "duplicate" (same event seen before) from "stale" (a newer version won).
    const existing = new Map<string, string>();
    for (let k = 0; k < good.length; k += 30) {
      const chunk = good.slice(k, k + 30);
      const q = chunk.map(() => "(tbl = ? AND row_id = ?)").join(" OR ");
      const rows = await env.DB.prepare(`SELECT tbl, row_id, event_id FROM sync_row WHERE account_id = ? AND (${q})`)
        .bind(auth.accountId, ...chunk.flatMap((g) => [g.ev.table, g.ev.rowId]))
        .all<{ tbl: string; row_id: string; event_id: string }>();
      for (const r of rows.results) existing.set(`${r.tbl}|${r.row_id}`, r.event_id);
    }
    const batch = await env.DB.batch(
      good.map((g) => env.DB.prepare(UPSERT).bind(auth.accountId, g.ev.table, g.ev.rowId, g.ev.updatedAt, g.ev.deletedAt, g.ev.data, g.ev.eventId, auth.deviceId, now)),
    );
    good.forEach((g, k) => {
      const changed = (batch[k]?.meta?.changes ?? 0) > 0;
      if (changed) results[g.i] = { eventId: g.ev.eventId, status: "applied" };
      else results[g.i] = { eventId: g.ev.eventId, status: existing.get(`${g.ev.table}|${g.ev.rowId}`) === g.ev.eventId ? "duplicate" : "stale" };
    });
  }
  const head = await env.DB.prepare("SELECT COALESCE(MAX(seq), 0) AS head FROM sync_row WHERE account_id = ?").bind(auth.accountId).first<{ head: number }>();
  const out: PushResponse = { results, head: head?.head ?? 0 };
  return json(out);
}

/** GET /v1/sync/pull?since=N&limit=M: rows changed after N, oldest change first. Includes tombstones. */
export async function pull(req: Request, env: Env, auth: Auth, now: number): Promise<Response> {
  await rateLimit(env.DB, `pull:${auth.accountId}`, 240, MINUTE, now);
  const url = new URL(req.url);
  const since = Number(url.searchParams.get("since") ?? "0");
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "200"), 1), MAX_PULL_LIMIT);
  if (!Number.isInteger(since) || since < 0 || !Number.isInteger(limit)) throw new HttpError(400, "bad_cursor");
  const rows = await env.DB.prepare(
    "SELECT tbl, row_id, updated_at, deleted_at, data, seq FROM sync_row WHERE account_id = ? AND seq > ? ORDER BY seq LIMIT ?",
  )
    .bind(auth.accountId, since, limit + 1)
    .all<{ tbl: SyncTable; row_id: string; updated_at: number; deleted_at: number | null; data: string; seq: number }>();
  const page = rows.results.slice(0, limit);
  const head = await env.DB.prepare("SELECT COALESCE(MAX(seq), 0) AS head FROM sync_row WHERE account_id = ?").bind(auth.accountId).first<{ head: number }>();
  const out: PullResponse = {
    rows: page.map((r) => ({ table: r.tbl, rowId: r.row_id, updatedAt: r.updated_at, deletedAt: r.deleted_at, data: r.data, seq: r.seq })),
    head: head?.head ?? 0,
    next: page.length > 0 ? page[page.length - 1]!.seq : since,
    hasMore: rows.results.length > limit,
  };
  return json(out);
}

/** DELETE /v1/sync/data: removes the synced rows but keeps the account (used by "keep this phone's data, replace the backup"). */
export async function wipeData(env: Env, auth: Auth): Promise<Response> {
  await env.DB.prepare("DELETE FROM sync_row WHERE account_id = ?").bind(auth.accountId).run();
  return json({ wiped: true });
}
