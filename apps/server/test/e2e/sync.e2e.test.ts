import { describe, expect, it } from "vitest";
import { makeWorld } from "../harness";
import { count, dump, makePhone, type Phone } from "./phone";

const scount = async (w: ReturnType<typeof makeWorld>, sql: string) => Number((w.db.raw.prepare(sql).get() as { n: number }).n);

/**
 * The phone's real sync engine + real GAIN database talking to the real Worker code (D1 stood in by SQLite).
 * These are the "two devices converge", "replay creates no duplicates" and "offline-safe" tests of plan Step 21.
 */
async function pair() {
  const w = makeWorld();
  const a = await makePhone(w, { ip: "10.0.0.1" });
  await a.setUp();
  const c = await a.engine.connect();
  if (!c.ok) throw new Error("connect failed: " + c.error);
  const b = await makePhone(w, { ip: "10.0.0.2" });
  return { w, a, b, recovery: c.recoveryCode };
}
const sync = async (p: Phone) => {
  const r = await p.engine.syncNow();
  if (!r.ok) throw new Error(`sync failed: ${r.error} ${r.detail ?? ""}`);
  return r;
};
async function bothSync(w: ReturnType<typeof makeWorld>, a: Phone, b: Phone) {
  for (let i = 0; i < 2; i++) {
    w.tick(61_000); // stay under the per-minute rate limits
    await sync(a);
    await sync(b);
  }
}

describe("turning it on", () => {
  it("is OFF by default: no request is ever made and nothing is read until the lifter connects", async () => {
    const w = makeWorld();
    const p = await makePhone(w);
    await p.setUp();
    await p.trainOnce();
    expect(await p.engine.status()).toBe("off");
    expect(await p.engine.syncNow()).toEqual({ ok: false, error: "not_enabled" });
    expect(p.faults.count).toBe(0);
    expect((await p.engine.getInfo()).status).toBe("off");
    expect(p.faults.count).toBe(0);
    expect(await count(p.raw, "SELECT COUNT(*) AS n FROM sync_outbox")).toBe(0);
  });

  it("an empty server takes this phone's data: every synced row arrives, device-only settings do not", async () => {
    const { w, a } = await pair();
    await a.trainOnce();
    await sync(a);
    const rows = (await w.call("GET", "/v1/me", { token: (await a.engine.token())! })).body.rows as number;
    const local = await dump(a.raw);
    const expected = Object.values(local).reduce((n, l) => n + l.length, 0);
    expect(rows).toBe(expected);
    expect(await a.repos.getSetting("language")).toBeNull(); // sanity: nothing device-only was required
    await a.repos.setSetting("language", "ar");
    await a.repos.setSetting("rest_seconds", "120");
    await sync(a);
    expect((await w.call("GET", "/v1/me", { token: (await a.engine.token())! })).body.rows).toBe(expected);
  });

  it("a new phone with the recovery code gets exactly the same data (no duplicate seed rows)", async () => {
    const { w, a, b, recovery } = await pair();
    await a.trainOnce();
    await a.trainOnce();
    await sync(a);
    const c = await b.engine.connect({ recoveryCode: recovery });
    expect(c).toMatchObject({ ok: true, needsChoice: false });
    expect(await b.engine.status()).toBe("on");
    expect(await dump(b.raw)).toEqual(await dump(a.raw));
    expect(await count(b.raw, "SELECT COUNT(*) AS n FROM exercise WHERE seed_key = 'bench_press_barbell'")).toBeLessThanOrEqual(1);
    expect(await count(b.raw, "SELECT COUNT(*) AS n FROM session WHERE status = 'finished'")).toBe(2);
    void w;
  });

  it("both phones have data: nothing merges silently, the lifter chooses (use the backup)", async () => {
    const { a, b, recovery } = await pair();
    await a.trainOnce();
    await sync(a);
    await b.setUp();
    await b.trainOnce();
    const mine = await dump(b.raw);
    const c = await b.engine.connect({ recoveryCode: recovery });
    expect(c).toMatchObject({ ok: true, needsChoice: true });
    expect(await b.engine.status()).toBe("pending");
    expect(await dump(b.raw)).toEqual(mine); // untouched until the choice
    expect(await b.engine.useBackup()).toEqual({ ok: true });
    expect(await dump(b.raw)).toEqual(await dump(a.raw));
  });

  it("both phones have data: cancelling keeps this phone as it is and leaves the backup alone", async () => {
    const { w, a, b, recovery } = await pair();
    await a.trainOnce();
    await sync(a);
    await b.setUp();
    await b.trainOnce();
    const mine = await dump(b.raw);
    const serverRows = await scount(w, "SELECT COUNT(*) AS n FROM sync_row");
    await b.engine.connect({ recoveryCode: recovery });
    expect(await b.engine.disconnect({ deleteServerData: false })).toEqual({ ok: true });
    expect(await b.engine.status()).toBe("off");
    expect(await dump(b.raw)).toEqual(mine);
    expect(await scount(w, "SELECT COUNT(*) AS n FROM sync_row")).toBe(serverRows);
    expect(await scount(w, "SELECT COUNT(*) AS n FROM account")).toBe(1);
  });

  it("a wrong recovery code is refused and changes nothing", async () => {
    const { b } = await pair();
    const r = await b.engine.connect({ recoveryCode: "AAAA-BBBB-CCCC-DDDD-EEEE" });
    expect(r).toMatchObject({ ok: false, error: "bad_recovery_code" });
    expect(await b.engine.status()).toBe("off");
  });

  it("a connection cut half way resumes without making a second account", async () => {
    const w = makeWorld();
    const a = await makePhone(w);
    await a.setUp();
    a.faults.failBefore.add(2); // account is created (request 1), then /v1/me fails
    expect(await a.engine.connect()).toMatchObject({ ok: false, error: "offline" });
    expect(await a.engine.status()).toBe("pending");
    expect(await scount(w, "SELECT COUNT(*) AS n FROM account")).toBe(1);
    expect(await a.engine.connect()).toMatchObject({ ok: true });
    expect(await scount(w, "SELECT COUNT(*) AS n FROM account")).toBe(1);
    expect(await a.engine.status()).toBe("on");
  });
});

describe("two phones converge", () => {
  it("offline edits on both phones end identical after both sync (finished workouts, goals, settings)", async () => {
    const { w, a, b, recovery } = await pair();
    await sync(a);
    await b.engine.connect({ recoveryCode: recovery });
    // Both work offline.
    a.faults.offline = true;
    b.faults.offline = true;
    await a.trainOnce(60, 8);
    w.tick(5000);
    await b.raw.run("INSERT INTO bodyweight_entry (id, weight_kg, measured_at, created_at, updated_at) VALUES ('bw-b', 82.5, 1, ?, ?)", [b.deps.now(), b.deps.now()]);
    w.tick(5000);
    await a.repos.setSetting("units", "lb");
    w.tick(5000);
    await b.repos.setSetting("units", "kg"); // later: wins
    expect(await a.engine.syncNow()).toMatchObject({ ok: false, error: "offline" });
    a.faults.offline = false;
    b.faults.offline = false;
    await bothSync(w, a, b);
    expect(await dump(a.raw)).toEqual(await dump(b.raw));
    expect(await a.repos.getSetting("units")).toBe("kg");
    expect(await count(a.raw, "SELECT COUNT(*) AS n FROM bodyweight_entry")).toBe(1);
    expect(await count(b.raw, "SELECT COUNT(*) AS n FROM session WHERE status = 'finished'")).toBe(1);
  });

  it("two phones both start today's workout: one session survives locally, the other is parked, never two open sessions", async () => {
    const { w, a, b, recovery } = await pair();
    await sync(a);
    await b.engine.connect({ recoveryCode: recovery });
    const sa = await a.startOnly();
    w.tick(2000);
    const sb = await b.startOnly();
    expect(sa.id).not.toBe(sb.id);
    await bothSync(w, a, b);
    for (const p of [a, b]) {
      const open = await count(p.raw, "SELECT COUNT(*) AS n FROM session WHERE status IN ('planned','in_progress') AND deleted_at IS NULL AND programme_day_id = '" + sa.dayId + "'");
      expect(open).toBe(1);
    }
    const infos = [await a.engine.getInfo(), await b.engine.getInfo()];
    expect(infos.reduce((n, i) => n + i.parked.conflict, 0)).toBeGreaterThanOrEqual(1); // honest: reported, not hidden
    // and still no crash, no error
    expect((await a.engine.syncNow()).ok).toBe(true);
  });

  it("a delete on one phone reaches the other and a late older edit does not bring the row back", async () => {
    const { w, a, b, recovery } = await pair();
    await a.raw.run("INSERT INTO bodyweight_entry (id, weight_kg, measured_at, created_at, updated_at) VALUES ('bw1', 80, 1, ?, ?)", [a.deps.now(), a.deps.now()]);
    await sync(a);
    await b.engine.connect({ recoveryCode: recovery });
    expect(await count(b.raw, "SELECT COUNT(*) AS n FROM bodyweight_entry WHERE id = 'bw1'")).toBe(1);
    // B edits (older), A deletes (newer); B syncs last.
    b.faults.offline = true;
    await b.raw.run("UPDATE bodyweight_entry SET weight_kg = 81, updated_at = ? WHERE id = 'bw1'", [b.deps.now()]);
    w.tick(5000);
    await a.raw.run("UPDATE bodyweight_entry SET deleted_at = ?, updated_at = ? WHERE id = 'bw1'", [a.deps.now(), a.deps.now()]);
    await sync(a);
    b.faults.offline = false;
    w.tick(61_000);
    await sync(b);
    w.tick(61_000);
    await sync(a);
    for (const p of [a, b]) expect(await count(p.raw, "SELECT COUNT(*) AS n FROM bodyweight_entry WHERE id = 'bw1' AND deleted_at IS NOT NULL")).toBe(1);
  });

  it("replaying a sync any number of times creates no duplicate sessions or sets", async () => {
    const { w, a, b, recovery } = await pair();
    await a.trainOnce();
    await a.trainOnce();
    for (let i = 0; i < 4; i++) {
      w.tick(61_000);
      await sync(a);
    }
    await b.engine.connect({ recoveryCode: recovery });
    for (let i = 0; i < 3; i++) {
      w.tick(61_000);
      await sync(b);
      await sync(a);
    }
    for (const p of [a, b]) {
      expect(await count(p.raw, "SELECT COUNT(*) AS n FROM session WHERE status = 'finished'")).toBe(2);
      expect(await count(p.raw, "SELECT COUNT(*) AS n FROM workout_set")).toBe(2);
    }
    expect(await dump(a.raw)).toEqual(await dump(b.raw));
    // The server holds each row once.
    const n = await scount(w, "SELECT COUNT(*) AS n FROM sync_row");
    const distinct = await scount(w, "SELECT COUNT(*) AS n FROM (SELECT DISTINCT tbl, row_id FROM sync_row)");
    expect(n).toBe(distinct);
  });

  it("the sync itself does not ping-pong: a second sync with nothing changed sends nothing and pulls nothing new", async () => {
    const { w, a, b, recovery } = await pair();
    await a.trainOnce();
    await sync(a);
    await b.engine.connect({ recoveryCode: recovery });
    await bothSync(w, a, b);
    w.tick(61_000);
    const r1 = await sync(a);
    const r2 = await sync(b);
    expect(r1.pushed + r2.pushed + r1.stale + r2.stale).toBe(0);
    expect(r1.pulled + r2.pulled).toBe(0);
    expect((await a.engine.getInfo()).pendingOut).toBe(0);
  });
});

describe("fault injection: the network or the phone dies at any point", () => {
  const edit = async (a: Phone) => {
    await a.trainOnce();
    await a.repos.setSetting("units", "lb");
  };
  const baseline = async () => {
    const { w, a, b, recovery } = await pair();
    await edit(a);
    await sync(a);
    await b.engine.connect({ recoveryCode: recovery });
    return { w, a, b, recovery, state: await dump(a.raw) };
  };

  it("request k never reaches the server: sync fails cleanly, the next sync completes, final state equals the fault-free run", async () => {
    const clean = await baseline();
    for (let k = 1; k <= 6; k++) {
      const { w, a, b } = await pair();
      await edit(a);
      a.faults.count = 0;
      a.faults.failBefore.add(a.faults.count + k + 1); // +1 skips the connect-time request
      const first = await a.engine.syncNow();
      if (!first.ok) expect(first.error).toBe("offline");
      a.faults.failBefore.clear();
      w.tick(61_000);
      await sync(a);
      await b.engine.connect({ recoveryCode: (await a.engine.getRecoveryCode())! });
      expect(await dump(b.raw)).toEqual(await dump(a.raw));
      expect(Object.values(await dump(b.raw)).flat().length).toBe(Object.values(clean.state).flat().length);
    }
  });

  it("the server applies request k but the answer is lost: the retry is recognised, nothing is duplicated", async () => {
    for (let k = 1; k <= 4; k++) {
      const { w, a, b } = await pair();
      await edit(a);
      const before = a.faults.count;
      a.faults.loseResponse.add(before + k);
      const first = await a.engine.syncNow();
      expect(first.ok === false || k > 3).toBe(true);
      a.faults.loseResponse.clear();
      w.tick(61_000);
      const second = await sync(a);
      expect(second.rejected).toBe(0);
      await b.engine.connect({ recoveryCode: (await a.engine.getRecoveryCode())! });
      expect(await dump(b.raw)).toEqual(await dump(a.raw));
      const total = await scount(w, "SELECT COUNT(*) AS n FROM sync_row");
      expect(total).toBe(Object.values(await dump(a.raw)).flat().length);
    }
  });

  it("a push batch whose answer is lost is re-sent with the SAME event ids and reported as duplicate by the server", async () => {
    const { w, a } = await pair();
    await edit(a);
    const ids = async () => (await a.raw.all<{ event_id: string }>("SELECT event_id FROM sync_outbox ORDER BY event_id")).map((r) => r.event_id);
    a.faults.loseResponse.add(a.faults.count + 1);
    await a.engine.syncNow();
    const queued = await ids();
    expect(queued.length).toBeGreaterThan(0);
    a.faults.loseResponse.clear();
    w.tick(61_000);
    await a.engine.syncNow();
    expect(await ids()).toEqual([]);
    // the server saw the first attempt apply; the second attempt added no new sequence numbers
    expect(await scount(w, "SELECT COUNT(*) AS n FROM sync_row")).toBe(Object.values(await dump(a.raw)).flat().length);
  });

  it("the phone dies while applying a pulled page: the page and its cursor roll back together, the next sync redoes it", async () => {
    const w = makeWorld();
    const a = await makePhone(w, { ip: "10.0.0.1" });
    await a.setUp();
    await a.trainOnce();
    const c = await a.engine.connect();
    if (!c.ok) throw new Error("connect");
    await sync(a);
    let armed = false;
    let writes = 0;
    const b = await makePhone(w, {
      ip: "10.0.0.2",
      wrapDb: (db) => ({
        ...db,
        run: async (sql, params) => {
          if (armed && /^\s*INSERT INTO (gym|exercise|session|workout_set)\b/.test(sql) && ++writes === 7) throw new Error("injected: phone killed");
          return db.run(sql, params);
        },
        transaction: (fn) => db.transaction(fn),
      }),
    });
    await b.setUp();
    await b.engine.connect({ recoveryCode: c.recoveryCode }).catch(() => undefined); // b has data -> needs a choice
    armed = true;
    await b.engine.useBackup().then(
      () => expect.unreachable("should have been killed"),
      (e: Error) => expect(e.message).toContain("injected"),
    );
    armed = false;
    // Phone is exactly as before the attempt (still pending, its own data intact), then the retry works.
    expect(await b.engine.status()).toBe("pending");
    expect(await b.engine.useBackup()).toEqual({ ok: true });
    expect(await dump(b.raw)).toEqual(await dump(a.raw));
  });

  it("going offline while DOWNLOADING the backup leaves the phone exactly as it was", async () => {
    const { a, b, recovery } = await pair();
    await a.trainOnce();
    await sync(a);
    await b.setUp();
    await b.trainOnce();
    const mine = await dump(b.raw);
    await b.engine.connect({ recoveryCode: recovery });
    b.faults.offline = true;
    expect(await b.engine.useBackup()).toMatchObject({ ok: false, error: "offline" });
    expect(await dump(b.raw)).toEqual(mine);
    expect(await b.engine.status()).toBe("pending");
  });

  it("a wrong phone clock (an hour ahead) is reported and nothing is lost; fixing the clock lets it through", async () => {
    const w = makeWorld();
    const a = await makePhone(w, { skewMs: 3600_000 });
    await a.setUp();
    const c = await a.engine.connect();
    expect(c.ok).toBe(true);
    const r = await a.engine.syncNow();
    expect(r).toMatchObject({ ok: false, error: "clock" });
    expect((await a.engine.getInfo()).lastError).toContain("clock");
    expect(await count(a.raw, "SELECT COUNT(*) AS n FROM sync_outbox")).toBeGreaterThan(0);
    a.phone.skewMs = 0;
    // The queued events carry the old (future) stamps and stay refused until real time catches up with them; the data stays on the phone.
    expect(await a.repos.getSetting("onboarding_state")).toBe("done");
    expect(await a.engine.syncNow()).toMatchObject({ ok: false, error: "clock" });
    w.tick(3_700_000);
    expect((await a.engine.syncNow()).ok).toBe(true);
    expect(await count(a.raw, "SELECT COUNT(*) AS n FROM sync_outbox")).toBe(0);
  });
});

describe("failure modes that are not the network", () => {
  it("the server forgot this phone (token revoked): error 'auth', local data untouched", async () => {
    const { w, a } = await pair();
    await a.trainOnce();
    const before = await dump(a.raw);
    await w.call("POST", "/v1/auth/logout", { token: (await a.engine.token())! });
    expect(await a.engine.syncNow()).toMatchObject({ ok: false, error: "auth" });
    expect(await dump(a.raw)).toEqual(before);
  });

  it("rate limited: error 'rate_limited', retry later works", async () => {
    const { w, a } = await pair();
    await sync(a);
    for (let i = 0; i < 245; i++) await w.call("GET", "/v1/sync/pull?since=0&limit=1", { token: (await a.engine.token())! });
    expect(await a.engine.syncNow()).toMatchObject({ ok: false, error: "rate_limited" });
    w.tick(61_000);
    expect((await a.engine.syncNow()).ok).toBe(true);
  });

  it("two syncs at once: the second says 'busy' instead of running in parallel", async () => {
    const { a } = await pair();
    const [x, y] = await Promise.all([a.engine.syncNow(), a.engine.syncNow()]);
    expect([x, y].filter((r) => r.ok).length).toBe(1);
    expect([x, y].some((r) => !r.ok && r.error === "busy")).toBe(true);
  });

  it("a row whose parent has not arrived yet is parked and applied when the parent comes (any order)", async () => {
    const { w, a, b, recovery } = await pair();
    await sync(a);
    await b.engine.connect({ recoveryCode: recovery });
    // Phone A creates a gym + a gym_load; the CHILD is pushed first by hand, the parent later.
    const t = a.deps.now();
    await a.raw.run("INSERT INTO gym (id, name, created_at, updated_at) VALUES ('gx', 'Gym X', ?, ?)", [t, t]);
    await a.raw.run("INSERT INTO gym_load (id, gym_id, equipment, increment, created_at, updated_at) VALUES ('glx', 'gx', 'barbell', 2.5, ?, ?)", [t, t]);
    const token = (await a.engine.token())!;
    const rows = await a.raw.all<Record<string, string | number | null>>("SELECT * FROM gym_load WHERE id = 'glx'");
    const { canonicalRow } = await import("@gain/sync");
    const child = { eventId: crypto.randomUUID(), table: "gym_load", rowId: "glx", updatedAt: t, deletedAt: null, data: canonicalRow(rows[0]!) };
    await w.call("POST", "/v1/sync/push", { token, body: { events: [child] } });
    await sync(b);
    expect((await b.engine.getInfo()).parked.waiting_parent).toBe(1);
    expect(await count(b.raw, "SELECT COUNT(*) AS n FROM gym_load WHERE id = 'glx'")).toBe(0);
    w.tick(61_000);
    await sync(a); // the parent goes up
    w.tick(61_000);
    await sync(b);
    expect((await b.engine.getInfo()).parked.waiting_parent).toBe(0);
    expect(await count(b.raw, "SELECT COUNT(*) AS n FROM gym_load WHERE id = 'glx'")).toBe(1);
    expect((await b.raw.all("PRAGMA foreign_key_check")).length).toBe(0);
  });

  it("a row from a NEWER app version (unknown column) is parked, not half-applied", async () => {
    const { w, a, b, recovery } = await pair();
    await sync(a);
    await b.engine.connect({ recoveryCode: recovery });
    const { canonicalRow } = await import("@gain/sync");
    const t = a.deps.now() + 10;
    const row = { id: "g-new", name: "future", created_at: t, updated_at: t, deleted_at: null, shiny_new_column: "x" };
    await w.call("POST", "/v1/sync/push", { token: (await a.engine.token())!, body: { events: [{ eventId: crypto.randomUUID(), table: "gym", rowId: "g-new", updatedAt: t, deletedAt: null, data: canonicalRow(row) }] } });
    w.tick(61_000);
    await sync(b);
    expect((await b.engine.getInfo()).parked.newer_app).toBe(1);
    expect(await count(b.raw, "SELECT COUNT(*) AS n FROM gym WHERE id = 'g-new'")).toBe(0);
  });
});

describe("turning it off", () => {
  it("disconnect + delete: the server forgets everything, the phone keeps its data and stops syncing", async () => {
    const { w, a } = await pair();
    await a.trainOnce();
    await sync(a);
    const before = await dump(a.raw);
    expect(await a.engine.disconnect({ deleteServerData: true })).toEqual({ ok: true });
    expect(await scount(w, "SELECT COUNT(*) AS n FROM sync_row")).toBe(0);
    expect(await scount(w, "SELECT COUNT(*) AS n FROM account")).toBe(0);
    expect(await dump(a.raw)).toEqual(before);
    expect(await a.engine.status()).toBe("off");
    const calls = a.faults.count;
    expect(await a.engine.syncNow()).toEqual({ ok: false, error: "not_enabled" });
    expect(a.faults.count).toBe(calls);
  });

  it("disconnect + delete while offline: reported as failed, still connected, nothing pretended", async () => {
    const { w, a } = await pair();
    await sync(a);
    a.faults.offline = true;
    expect(await a.engine.disconnect({ deleteServerData: true })).toMatchObject({ ok: false, error: "offline" });
    expect(await a.engine.status()).toBe("on");
    expect(await scount(w, "SELECT COUNT(*) AS n FROM account")).toBe(1);
  });

  it("backup export never contains the account token or recovery code; restore disconnects sync", async () => {
    const { a } = await pair();
    await a.trainOnce();
    await sync(a);
    const token = (await a.engine.token())!;
    const recovery = (await a.engine.getRecoveryCode())!;
    const file = await a.data.exportJson();
    expect(file).not.toContain(token);
    expect(file).not.toContain(recovery);
    expect(Object.keys(JSON.parse(file).tables).some((t) => t.startsWith("sync_"))).toBe(false);
    await a.data.restoreJson(file);
    expect(await a.engine.status()).toBe("off");
    expect(await count(a.raw, "SELECT COUNT(*) AS n FROM sync_state")).toBe(0);
  });

  it("'delete everything' on the phone also forgets the connection", async () => {
    const { a } = await pair();
    await sync(a);
    await a.data.deleteAll();
    expect(await a.engine.status()).toBe("off");
    expect(await a.engine.getRecoveryCode()).toBeNull();
  });
});

describe("the server's copy was replaced or rewound (P07)", () => {
  it("after a server-side wipe the phone notices the new generation, re-sends everything and loses nothing", async () => {
    const { w, a } = await pair();
    await a.trainOnce();
    await sync(a);
    const token = (await a.engine.token())!;
    const before = Number((await w.call("GET", "/v1/me", { token })).body.rows);
    expect(before).toBeGreaterThan(0);
    // the operator (or a "replace the backup" on another phone) wipes the account's rows
    await w.call("DELETE", "/v1/sync/data", { token });
    expect(Number((await w.call("GET", "/v1/me", { token })).body.rows)).toBe(0);
    w.tick(61_000);
    const r = await sync(a);
    expect(r.reconciled).toBe(true);
    expect(Number((await w.call("GET", "/v1/me", { token })).body.rows)).toBe(before);
    // and it settles: the next sync has nothing to do
    w.tick(61_000);
    const again = await sync(a);
    expect(again.reconciled).toBe(false);
    expect(again.pushed).toBe(0);
  });

  it("a server restored to an older state (its newest change is behind the phone's cursor) is detected and repaired", async () => {
    const { w, a } = await pair();
    await a.trainOnce();
    await sync(a);
    const token = (await a.engine.token())!;
    const before = Number((await w.call("GET", "/v1/me", { token })).body.rows);
    // simulate a restore to an earlier backup: the newest half of the rows are gone, the generation is unchanged
    w.db.raw.exec("DELETE FROM sync_row WHERE seq > (SELECT MAX(seq) / 2 FROM sync_row)");
    w.tick(61_000);
    const r = await sync(a);
    expect(r.reconciled).toBe(true);
    expect(Number((await w.call("GET", "/v1/me", { token })).body.rows)).toBe(before);
  });
});
