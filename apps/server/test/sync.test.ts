import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { ev, makeWorld } from "./harness";

const T0 = 1_800_000_000_000;

async function setup() {
  const w = makeWorld();
  const a = await w.newAccount();
  return { w, token: a.deviceToken, a };
}

describe("push / pull basics", () => {
  it("rejects calls without a token", async () => {
    const w = makeWorld();
    expect((await w.call("POST", "/v1/sync/push", { body: { events: [] } })).status).toBe(401);
    expect((await w.call("GET", "/v1/sync/pull")).status).toBe(401);
    expect((await w.call("GET", "/v1/sync/pull", { token: "x".repeat(43) })).status).toBe(401);
  });

  it("stores events and returns them in change order", async () => {
    const { w, token } = await setup();
    const r = await w.push(token, [ev("gym", "g1", { name: "A" }, T0), ev("exercise", "e1", { name_en: "Squat" }, T0 + 1)]);
    expect(r.results.map((x) => x.status)).toEqual(["applied", "applied"]);
    const p = await w.pull(token);
    expect(p.rows.map((x) => x.rowId)).toEqual(["g1", "e1"]);
    expect(p.rows.map((x) => x.seq)).toEqual([1, 2]);
    expect(p.hasMore).toBe(false);
    expect(p.next).toBe(2);
  });

  it("pages with a cursor and loses nothing", async () => {
    const { w, token } = await setup();
    const events = Array.from({ length: 25 }, (_, i) => ev("bodyweight_entry", `b${i}`, { weight_kg: 80 + i }, T0 + i));
    await w.push(token, events);
    const seen: string[] = [];
    let since = 0;
    for (let guard = 0; guard < 10; guard++) {
      const p = await w.pull(token, since, 10);
      seen.push(...p.rows.map((x) => x.rowId));
      since = p.next;
      if (!p.hasMore) break;
    }
    expect(seen).toHaveLength(25);
    expect(new Set(seen).size).toBe(25);
  });

  it("accounts are isolated", async () => {
    const w = makeWorld();
    const a = await w.newAccount("1.1.1.1");
    const b = await w.newAccount("2.2.2.2");
    await w.push(a.deviceToken, [ev("gym", "g1", { name: "mine" }, T0)]);
    expect((await w.pull(b.deviceToken)).rows).toHaveLength(0);
    await w.push(b.deviceToken, [ev("gym", "g1", { name: "theirs" }, T0 + 5)]); // same row id, other account
    expect(JSON.parse((await w.pull(a.deviceToken)).rows[0]!.data).name).toBe("mine");
  });
});

describe("idempotency", () => {
  it("replaying a batch twice changes nothing and reports duplicate", async () => {
    const { w, token } = await setup();
    const batch = [ev("session", "s1", { status: "finished" }, T0), ev("workout_set", "w1", { load: 100, reps: 5 }, T0 + 1)];
    const first = await w.push(token, batch);
    const head1 = first.head;
    const second = await w.push(token, batch);
    expect(second.results.map((x) => x.status)).toEqual(["duplicate", "duplicate"]);
    expect(second.head).toBe(head1);
    const p = await w.pull(token);
    expect(p.rows).toHaveLength(2);
  });

  it("the same event twice inside one request is applied once", async () => {
    const { w, token } = await setup();
    const e = ev("goal", "go1", { kind: "lift" }, T0);
    const r = await w.push(token, [e, e]);
    expect(r.results.map((x) => x.status)).toEqual(["applied", "duplicate"]);
    expect((await w.pull(token)).rows).toHaveLength(1);
  });

  it("a new event id carrying the very same version is a no-op (no ping-pong between phones)", async () => {
    const { w, token } = await setup();
    await w.push(token, [ev("gym", "g1", { name: "A" }, T0, null, randomUUID())]);
    const head = (await w.pull(token)).head;
    const r = await w.push(token, [ev("gym", "g1", { name: "A" }, T0, null, randomUUID())]);
    expect(r.results[0]!.status).toBe("stale");
    expect(r.head).toBe(head);
  });

  it("a failed batch changes nothing, and retrying it works", async () => {
    const { w, token } = await setup();
    const batch = [ev("gym", "g1", { name: "A" }, T0), ev("gym", "g2", { name: "B" }, T0)];
    w.db.failNext(); // the pre-read throws
    const bad = await w.call("POST", "/v1/sync/push", { token, body: { events: batch } });
    expect(bad.status).toBe(500);
    expect((await w.pull(token)).rows).toHaveLength(0);
    const ok = await w.push(token, batch);
    expect(ok.results.map((x) => x.status)).toEqual(["applied", "applied"]);
  });

  it("the whole batch is atomic: a database error mid-batch rolls every statement back", async () => {
    const { w, token } = await setup();
    // Make the 2nd upsert blow up by dropping a column it needs after the first would have succeeded.
    w.db.raw.exec("CREATE TRIGGER boom BEFORE INSERT ON sync_row WHEN NEW.row_id = 'bad' BEGIN SELECT RAISE(ABORT, 'boom'); END;");
    const r = await w.call("POST", "/v1/sync/push", { token, body: { events: [ev("gym", "ok", { name: "A" }, T0), ev("gym", "bad", { name: "B" }, T0)] } });
    expect(r.status).toBe(500);
    expect((await w.pull(token)).rows).toHaveLength(0);
  });
});

describe("last write wins", () => {
  it("a later updated_at replaces an earlier one", async () => {
    const { w, token } = await setup();
    await w.push(token, [ev("gym", "g1", { name: "old" }, T0)]);
    const r = await w.push(token, [ev("gym", "g1", { name: "new" }, T0 + 10)]);
    expect(r.results[0]!.status).toBe("applied");
    const rows = (await w.pull(token)).rows;
    expect(rows).toHaveLength(1);
    expect(JSON.parse(rows[0]!.data).name).toBe("new");
  });

  it("an earlier updated_at arriving late is stale and changes nothing", async () => {
    const { w, token } = await setup();
    await w.push(token, [ev("gym", "g1", { name: "new" }, T0 + 10)]);
    const r = await w.push(token, [ev("gym", "g1", { name: "old" }, T0)]);
    expect(r.results[0]!.status).toBe("stale");
    expect(JSON.parse((await w.pull(token)).rows[0]!.data).name).toBe("new");
  });

  it("order of arrival does not matter: both orders converge on the same row", async () => {
    const versions = [ev("gym", "g1", { name: "one" }, T0), ev("gym", "g1", { name: "two" }, T0 + 5), ev("gym", "g1", { name: "three" }, T0 + 9)];
    const finals = new Set<string>();
    for (const order of [[0, 1, 2], [2, 1, 0], [1, 2, 0], [2, 0, 1], [0, 2, 1], [1, 0, 2]]) {
      const { w, token } = await setup();
      for (const i of order) await w.push(token, [versions[i]!]);
      finals.add((await w.pull(token)).rows[0]!.data);
    }
    expect(finals.size).toBe(1);
    expect(JSON.parse([...finals][0]!).name).toBe("three");
  });

  it("equal timestamps resolve the same way whichever phone pushes first", async () => {
    const a = ev("gym", "g1", { name: "from phone A" }, T0);
    const b = ev("gym", "g1", { name: "from phone B" }, T0);
    const out: string[] = [];
    for (const order of [[a, b], [b, a]]) {
      const { w, token } = await setup();
      for (const e of order) await w.push(token, [e]);
      out.push((await w.pull(token)).rows[0]!.data);
    }
    expect(out[0]).toBe(out[1]);
  });

  it("tie on time: the delete wins over the edit, in both orders", async () => {
    const live = ev("gym", "g1", { name: "x" }, T0, null);
    const dead = ev("gym", "g1", { name: "x" }, T0, T0);
    for (const order of [[live, dead], [dead, live]]) {
      const { w, token } = await setup();
      for (const e of order) await w.push(token, [e]);
      expect((await w.pull(token)).rows[0]!.deletedAt).toBe(T0);
    }
  });

  it("different rows never interfere", async () => {
    const { w, token } = await setup();
    await w.push(token, [ev("gym", "g1", { name: "a" }, T0 + 100), ev("gym", "g2", { name: "b" }, T0)]);
    await w.push(token, [ev("gym", "g2", { name: "b2" }, T0 + 1)]);
    const names = Object.fromEntries((await w.pull(token)).rows.map((r) => [r.rowId, JSON.parse(r.data).name]));
    expect(names).toEqual({ g1: "a", g2: "b2" });
  });
});

describe("tombstones", () => {
  it("a delete is a row with deleted_at and is delivered to other phones", async () => {
    const { w, token } = await setup();
    await w.push(token, [ev("goal", "go1", { kind: "lift" }, T0)]);
    const since = (await w.pull(token)).next;
    await w.push(token, [ev("goal", "go1", { kind: "lift" }, T0 + 50, T0 + 50)]);
    const p = await w.pull(token, since);
    expect(p.rows).toHaveLength(1);
    expect(p.rows[0]!.deletedAt).toBe(T0 + 50);
  });

  it("an edit made BEFORE the delete never brings the row back, even when it arrives later", async () => {
    const { w, token } = await setup();
    await w.push(token, [ev("goal", "go1", { kind: "lift", note: "a" }, T0 + 10, T0 + 10)]);
    const late = await w.push(token, [ev("goal", "go1", { kind: "lift", note: "edited offline" }, T0 + 5)]);
    expect(late.results[0]!.status).toBe("stale");
    expect((await w.pull(token)).rows[0]!.deletedAt).toBe(T0 + 10);
  });

  it("an edit made AFTER the delete does bring the row back (last write wins)", async () => {
    const { w, token } = await setup();
    await w.push(token, [ev("goal", "go1", { kind: "lift" }, T0, T0)]);
    await w.push(token, [ev("goal", "go1", { kind: "lift", note: "back" }, T0 + 10, null)]);
    expect((await w.pull(token)).rows[0]!.deletedAt).toBeNull();
  });
});

describe("validation", () => {
  it("rejects bad events one by one and applies the good ones", async () => {
    const { w, token } = await setup();
    const good = ev("gym", "g1", { name: "ok" }, T0);
    const badTable = { ...ev("gym", "g2", {}, T0), table: "account" } as never;
    const badId = ev("gym", "g3", {}, T0);
    badId.rowId = "../x";
    const future = ev("gym", "g4", {}, w.now + 3 * 3600 * 1000);
    const mismatch = ev("gym", "g5", {}, T0);
    mismatch.updatedAt = T0 + 1;
    const notCanonical = ev("gym", "g6", { name: "a" }, T0);
    notCanonical.data = JSON.stringify({ updated_at: T0, name: "a", id: "g6", deleted_at: null, created_at: 1 });
    const secretSetting = ev("setting", "sync_token", { value: "x" }, T0);
    const r = await w.push(token, [good, badTable, badId, future, mismatch, notCanonical, secretSetting]);
    expect(r.results.map((x) => x.status)).toEqual(["applied", "rejected", "rejected", "rejected", "rejected", "rejected", "rejected"]);
    expect(r.results.map((x) => x.reason)).toEqual([undefined, "unknown_table", "bad_row_id", "clock_ahead", "updated_at_mismatch", "not_canonical", "setting_not_synced"]);
    expect((await w.pull(token)).rows).toHaveLength(1);
  });

  it("refuses an oversize batch and oversize rows", async () => {
    const { w, token } = await setup();
    const many = Array.from({ length: 101 }, (_, i) => ev("gym", `g${i}`, {}, T0));
    expect((await w.call("POST", "/v1/sync/push", { token, body: { events: many } })).status).toBe(400);
    const big = ev("gym", "big", { name: "x".repeat(70_000) }, T0);
    expect((await w.push(token, [big])).results[0]!.reason).toBe("bad_data");
  });

  it("garbage bodies are 400, not 500", async () => {
    const { w, token } = await setup();
    const res = await w.call("POST", "/v1/sync/push", { token, body: { events: "nope" } });
    expect(res.status).toBe(400);
    expect((await w.call("GET", "/v1/sync/pull?since=-1", { token })).status).toBe(400);
    expect((await w.call("GET", "/v1/sync/pull?since=abc", { token })).status).toBe(400);
  });
});

describe("two phones converge", () => {
  it("offline edits on both phones end in the same state after both sync", async () => {
    const { w, token: tokA, a } = await setup();
    const { deviceToken: tokB } = (await w.call("POST", "/v1/auth/recover", { body: { recoveryCode: a.recoveryCode } })).body as { deviceToken: string };
    // Shared starting state.
    await w.push(tokA, [ev("gym", "g1", { name: "start" }, T0), ev("gym", "g2", { name: "start2" }, T0)]);
    // Phone A edits g1 (older) and adds s1; phone B edits g1 (newer), deletes g2 and adds s2.
    await w.push(tokA, [ev("gym", "g1", { name: "A edit" }, T0 + 10), ev("session", "sA", { status: "finished" }, T0 + 11)]);
    await w.push(tokB, [ev("gym", "g1", { name: "B edit" }, T0 + 20), ev("gym", "g2", { name: "start2" }, T0 + 21, T0 + 21), ev("session", "sB", { status: "finished" }, T0 + 22)]);
    const viewA = (await w.pull(tokA)).rows.map((r) => [r.rowId, r.data]).sort();
    const viewB = (await w.pull(tokB)).rows.map((r) => [r.rowId, r.data]).sort();
    expect(viewA).toEqual(viewB);
    const byId = Object.fromEntries((await w.pull(tokA)).rows.map((r) => [r.rowId, r]));
    expect(JSON.parse(byId.g1!.data).name).toBe("B edit");
    expect(byId.g2!.deletedAt).toBe(T0 + 21);
    expect(byId.sA).toBeDefined();
    expect(byId.sB).toBeDefined();
  });

  it("property: any shuffle and any duplication of the same events converges on one state", async () => {
    // Deterministic pseudo-random so a failure reproduces.
    let seed = 42;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const events = Array.from({ length: 40 }, (_, i) => {
      const row = `r${Math.floor(rnd() * 8)}`;
      const t = T0 + Math.floor(rnd() * 15); // many collisions on purpose
      const del = rnd() < 0.2 ? t : null;
      return ev("goal", row, { kind: "lift", note: `v${i}` }, t, del);
    });
    const states = new Set<string>();
    for (let trial = 0; trial < 8; trial++) {
      const { w, token } = await setup();
      const order = [...events, ...events.filter(() => rnd() < 0.5)].sort(() => rnd() - 0.5);
      for (let k = 0; k < order.length; k += 7) await w.push(token, order.slice(k, k + 7));
      states.add(JSON.stringify((await w.pull(token, 0, 500)).rows.map((r) => [r.rowId, r.data]).sort()));
    }
    expect(states.size).toBe(1);
  });
});

describe("delete data", () => {
  it("DELETE /v1/sync/data empties the account's rows only", async () => {
    const { w, token } = await setup();
    await w.push(token, [ev("gym", "g1", {}, T0)]);
    expect((await w.call("DELETE", "/v1/sync/data", { token })).status).toBe(200);
    expect((await w.pull(token)).rows).toHaveLength(0);
    expect((await w.call("GET", "/v1/me", { token })).status).toBe(200);
  });

  it("DELETE /v1/account removes rows, devices and the account", async () => {
    const { w, token, a } = await setup();
    await w.push(token, [ev("gym", "g1", {}, T0)]);
    expect((await w.call("DELETE", "/v1/account", { token })).status).toBe(200);
    expect((await w.call("GET", "/v1/me", { token })).status).toBe(401);
    for (const t of ["account", "device", "sync_row"]) {
      expect((w.db.raw.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n).toBe(0);
    }
    expect((await w.call("POST", "/v1/auth/recover", { body: { recoveryCode: a.recoveryCode } })).status).toBe(401);
  });
});

describe("rate limits", () => {
  it("push is limited per account per minute, then recovers next window", async () => {
    const { w, token } = await setup();
    let limited = 0;
    for (let i = 0; i < 125; i++) if ((await w.call("POST", "/v1/sync/push", { token, body: { events: [] } })).status === 429) limited++;
    expect(limited).toBe(5);
    w.tick(61_000);
    expect((await w.call("POST", "/v1/sync/push", { token, body: { events: [] } })).status).toBe(200);
  });
});
