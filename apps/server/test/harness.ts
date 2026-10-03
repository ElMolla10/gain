import { canonicalRow, type PullResponse, type PushResponse, type RowData, type SyncEvent, type SyncTable } from "@gain/sync";
import { randomUUID } from "node:crypto";
import { handle } from "../src/index";
import type { Env } from "../src/types";
import { openTestD1 } from "./d1";

export function makeWorld(extraEnv: Partial<Env> = {}) {
  const db = openTestD1();
  let now = 1_800_000_000_000;
  const mail: { to: string; body: string }[] = [];
  const fetchFn = (async (_url: string, init: { body: string }) => {
    const b = JSON.parse(init.body) as { to: string[]; text: string };
    mail.push({ to: b.to[0]!, body: b.text });
    return new Response("{}", { status: 200 });
  }) as unknown as typeof fetch;
  const env: Env = { DB: db, DEV_EMAIL_CODES: "0", ...extraEnv };
  const world = {
    db,
    env,
    mail,
    tick: (ms = 1000) => void (now += ms),
    set: (t: number) => void (now = t),
    get now() {
      return now;
    },
    async call(method: string, path: string, opts: { token?: string; body?: unknown; ip?: string; headers?: Record<string, string> } = {}) {
      const headers: Record<string, string> = { "cf-connecting-ip": opts.ip ?? "1.1.1.1", ...(opts.headers ?? {}) };
      if (opts.token) headers.authorization = `Bearer ${opts.token}`;
      if (opts.body !== undefined) headers["content-type"] = "application/json";
      const res = await handle(new Request(`https://gain.test${path}`, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) }), env, { now: () => now, fetch: fetchFn });
      const text = await res.text();
      let body: unknown = text;
      try {
        body = JSON.parse(text);
      } catch {
        /* html */
      }
      return { status: res.status, body: body as any, headers: res.headers, text };
    },
    async newAccount(ip = "1.1.1.1") {
      const r = await world.call("POST", "/v1/account", { body: { label: "test" }, ip });
      return r.body as { accountId: string; deviceToken: string; recoveryCode: string };
    },
    async push(token: string, events: SyncEvent[]) {
      const r = await world.call("POST", "/v1/sync/push", { token, body: { events } });
      return { status: r.status, ...(r.body as PushResponse) };
    },
    async pull(token: string, since = 0, limit = 200) {
      const r = await world.call("GET", `/v1/sync/pull?since=${since}&limit=${limit}`, { token });
      return { status: r.status, ...(r.body as PullResponse) };
    },
  };
  return world;
}

export function ev(table: SyncTable, id: string, fields: Record<string, string | number | null>, updatedAt: number, deletedAt: number | null = null, eventId = randomUUID()): SyncEvent {
  const row: RowData = { id, created_at: 1, ...fields, updated_at: updatedAt, deleted_at: deletedAt };
  return { eventId, table, rowId: id, updatedAt, deletedAt, data: canonicalRow(row) };
}
