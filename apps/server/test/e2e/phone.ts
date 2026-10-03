import { canonicalRow, SYNC_TABLES, SYNCED_SETTING_KEYS } from "@gain/sync";
import { randomUUID } from "node:crypto";
import { migrate } from "../../../mobile/src/db/migrations";
import type { Db, Deps } from "../../../mobile/src/db/driver";
import { createRepos } from "../../../mobile/src/db/repos";
import { createWorkoutRepo } from "../../../mobile/src/db/workoutRepo";
import { createFinishRepo } from "../../../mobile/src/db/finishRepo";
import { createGoalRepo } from "../../../mobile/src/db/goalRepo";
import { createDataRepo } from "../../../mobile/src/db/dataRepo";
import { createSyncEngine } from "../../../mobile/src/sync/engine";
import { TransportError, type Transport } from "../../../mobile/src/sync/transport";
import { openNodeDb } from "../../../mobile/test/nodeDriver";
import { handle } from "../../src/index";
import { makeWorld } from "../harness";

export type World = ReturnType<typeof makeWorld>;

/** A simulated phone: a real GAIN database + the real sync engine, talking to the real Worker code through a transport that can fail. */
export async function makePhone(w: World, opts: { skewMs?: number; ip?: string; wrapDb?: (db: Db) => Db } = {}) {
  const raw = openNodeDb();
  await migrate(raw);
  const db = opts.wrapDb ? opts.wrapDb(raw) : raw;
  const phone = { skewMs: opts.skewMs ?? 0 };
  const deps: Deps = { newId: () => randomUUID(), now: () => w.now + phone.skewMs };
  const repos = createRepos(db, deps);
  const workout = createWorkoutRepo(db, deps);
  const finish = createFinishRepo(db, deps, repos, workout);
  const goals = createGoalRepo(db, deps, repos);
  const data = createDataRepo(db, deps);

  const faults = { count: 0, failBefore: new Set<number>(), loseResponse: new Set<number>(), log: [] as string[], offline: false };
  const transport: Transport = {
    async request(method, path, o = {}) {
      const n = ++faults.count;
      faults.log.push(`${method} ${path.split("?")[0]}`);
      if (faults.offline || faults.failBefore.has(n)) throw new TransportError("injected: network down");
      const headers: Record<string, string> = { "cf-connecting-ip": opts.ip ?? "10.0.0.1" };
      if (o.token) headers.authorization = `Bearer ${o.token}`;
      if (o.body !== undefined) headers["content-type"] = "application/json";
      const res = await handle(new Request(`https://gain.test${path}`, { method, headers, body: o.body === undefined ? undefined : JSON.stringify(o.body) }), w.env, { now: () => w.now, fetch });
      if (faults.loseResponse.has(n)) throw new TransportError("injected: response lost");
      const text = await res.text();
      let json: unknown = null;
      try {
        json = JSON.parse(text);
      } catch {
        /* none */
      }
      return { status: res.status, json };
    },
  };
  const engine = createSyncEngine(db, deps, transport);

  /** Seed the sample data and mark onboarding done, like a phone that has been used. */
  const setUp = async () => {
    await repos.seedIfNeeded();
    await repos.topUpLibrary();
    await repos.setSetting("onboarding_state", "done");
  };
  /** Log and finish one workout on the next day of the programme. */
  const trainOnce = async (load = 50, reps = 10) => {
    const gymId = (await repos.getActiveGymId())!;
    const gym = await repos.loadGymFingerprint(gymId);
    const next = (await repos.getNextDay())!;
    const exs = await repos.listDayExercises(next.day.id);
    const { id } = await workout.startOrResumeSession(next.day.id, gymId);
    const ex = exs[0]!;
    await workout.logSet({ sessionId: id, exerciseId: ex.exerciseId, load, reps }, { gym, equipment: ex.equipment, setup: ex.setup });
    w.tick(1000);
    await workout.finishSession(id);
    await finish.writeNextSessionTargets(id);
    w.tick(1000);
    return id;
  };
  const startOnly = async () => {
    const gymId = (await repos.getActiveGymId())!;
    const next = (await repos.getNextDay())!;
    return { dayId: next.day.id, ...(await workout.startOrResumeSession(next.day.id, gymId)) };
  };
  return { db, raw, deps, repos, workout, finish, goals, data, engine, faults, phone, setUp, trainOnce, startOnly };
}
export type Phone = Awaited<ReturnType<typeof makePhone>>;

/** Every synced row of a phone as canonical strings, sorted: two phones that converged have equal dumps. */
export async function dump(db: Db): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {};
  for (const t of SYNC_TABLES) {
    const rows = await db.all<Record<string, string | number | null>>(`SELECT * FROM ${t}`);
    out[t] = rows
      .filter((r) => t !== "setting" || (SYNCED_SETTING_KEYS as readonly string[]).includes(String(r.id)))
      .map((r) => canonicalRow(r))
      .sort();
  }
  return out;
}
export async function count(db: Db, sql: string): Promise<number> {
  return Number((await db.get<{ n: number }>(sql))!.n);
}
