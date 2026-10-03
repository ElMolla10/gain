import { describe, expect, it } from "vitest";
import { runMaintenance } from "../src/index";
import { ev, makeWorld } from "./harness";

const T0 = 1_800_000_000_000;

describe("generation (server data replaced or rewound)", () => {
  it("is reported by me, push and pull, and bumps when the synced data is wiped", async () => {
    const w = makeWorld();
    const a = await w.newAccount();
    const t = a.deviceToken;
    expect((await w.call("GET", "/v1/me", { token: t })).body.generation).toBe(1);
    const pushed = await w.push(t, [ev("gym", "g1", { name: "A" }, T0)]);
    expect(pushed.generation).toBe(1);
    expect((await w.pull(t)).generation).toBe(1);
    const wipe = await w.call("DELETE", "/v1/sync/data", { token: t });
    expect(wipe.body.generation).toBe(2);
    expect((await w.pull(t)).generation).toBe(2);
    // sequence numbers start again after a wipe: this is exactly why other phones must not trust an old cursor
    await w.push(t, [ev("gym", "g2", { name: "B" }, T0 + 5)]);
    expect((await w.pull(t)).rows[0]!.seq).toBe(1);
  });
});

describe("limits", () => {
  it("refuses a push that would take the account past its storage quota, and counts what was stored", async () => {
    const w = makeWorld({ ACCOUNT_QUOTA_BYTES: "1500" });
    const t = (await w.newAccount()).deviceToken;
    const ok = await w.push(t, [ev("gym", "g1", { name: "x".repeat(200) }, T0)]);
    expect(ok.results[0]!.status).toBe("applied");
    const used = (await w.db.prepare("SELECT bytes_used FROM account").first<{ bytes_used: number }>())!.bytes_used;
    expect(used).toBeGreaterThan(200);
    const big = await w.call("POST", "/v1/sync/push", { token: t, body: { events: [ev("gym", "g2", { name: "y".repeat(1600) }, T0 + 1)] } });
    expect(big.status).toBe(413);
    expect(big.body.error).toBe("quota_exceeded");
    // a small update of the same row still fits
    const small = await w.push(t, [ev("gym", "g1", { name: "z".repeat(150) }, T0 + 2)]);
    expect(small.results[0]!.status).toBe("applied");
  });

  it("refuses a request body declared larger than the cap before reading it", async () => {
    const w = makeWorld();
    const t = (await w.newAccount()).deviceToken;
    const r = await w.call("POST", "/v1/sync/push", { token: t, body: { events: [] }, headers: { "content-length": String(10 * 1024 * 1024) } });
    expect(r.status).toBe(413);
  });

  it("kill switch: '1' pauses everything but /health; 'writes' keeps reads working", async () => {
    const w = makeWorld({ KILL_SWITCH: "1" });
    expect((await w.call("GET", "/health")).status).toBe(200);
    expect((await w.call("POST", "/v1/account", { body: {} })).status).toBe(503);
    const live = makeWorld();
    const t = (await live.newAccount()).deviceToken;
    live.env.KILL_SWITCH = "writes";
    expect((await live.call("POST", "/v1/account", { body: {} })).status).toBe(503);
    expect((await live.call("POST", "/v1/sync/push", { token: t, body: { events: [] } })).status).toBe(503);
    expect((await live.call("GET", "/v1/sync/pull", { token: t })).status).toBe(200);
    expect((await live.call("GET", "/v1/me", { token: t })).status).toBe(200);
    expect((await live.call("POST", "/v1/auth/logout", { token: t })).status).toBe(200);
    live.env.KILL_SWITCH = "0";
    expect((await live.call("POST", "/v1/account", { body: {} })).status).toBe(201);
  });
});

describe("daily housekeeping", () => {
  it("removes expired coach links, stale sign-in codes and long-unused devices, and keeps the rest", async () => {
    const w = makeWorld();
    const a = await w.newAccount();
    const day = 86_400_000;
    await w.db.prepare("INSERT INTO coach_link (id, account_id, token_hash, payload, created_at, expires_at) VALUES ('old', ?, 'h1', '{}', 1, ?)").bind(a.accountId, w.now - 3 * day).run();
    await w.db.prepare("INSERT INTO coach_link (id, account_id, token_hash, payload, created_at, expires_at) VALUES ('live', ?, 'h2', '{}', 1, ?)").bind(a.accountId, w.now + 3 * day).run();
    await w.db.prepare("INSERT INTO email_code (email, code_hash, expires_at, created_at) VALUES ('a@b.co', 'x', ?, 1)").bind(w.now - 2 * day).run();
    await w.db.prepare("INSERT INTO device (id, account_id, token_hash, created_at, last_seen_at) VALUES ('stale', ?, 'th', 1, ?)").bind(a.accountId, w.now - 500 * day).run();
    const r = await runMaintenance(w.env, w.now);
    expect(r).toEqual({ links: 1, codes: 1, devices: 1 });
    expect((await w.db.prepare("SELECT id FROM coach_link").all<{ id: string }>()).results.map((x) => x.id)).toEqual(["live"]);
    expect((await w.db.prepare("SELECT COUNT(*) AS n FROM device").first<{ n: number }>())!.n).toBe(1); // the active phone stays
  });
});
