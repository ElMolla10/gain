import { describe, expect, it } from "vitest";
import { freshDb } from "./helpers";

const DAY = 86_400_000;

async function setup() {
  const ctx = await freshDb();
  await ctx.repos.seedIfNeeded();
  const gymId = (await ctx.repos.getActiveGymId())!;
  const gym = await ctx.repos.loadGymFingerprint(gymId);
  const day = (await ctx.repos.getNextDay())!.day;
  const ex = (await ctx.repos.listDayExercises(day.id))[0]!;
  const train = async (sets = 3) => {
    const { id } = await ctx.workout.startOrResumeSession(day.id, gymId);
    for (let i = 0; i < sets; i++) {
      await ctx.workout.logSet({ sessionId: id, exerciseId: ex.exerciseId, load: 60, reps: 8 }, { gym, equipment: ex.equipment, setup: ex.setup });
    }
    ctx.deps.tick();
    await ctx.workout.finishSession(id);
    ctx.deps.tick();
    return id;
  };
  return { ...ctx, gymId, gym, day, ex, train };
}

/** Copies one finished session (and its sets) `n` times, spread back in time: a long history without 500 logging round trips. */
async function cloneHistory(c: Awaited<ReturnType<typeof setup>>, sessionId: string, n: number) {
  const session = await c.db.get<Record<string, unknown>>("SELECT * FROM session WHERE id = ?", [sessionId]);
  const sets = await c.db.all<Record<string, unknown>>("SELECT * FROM workout_set WHERE session_id = ?", [sessionId]);
  const insert = async (table: string, row: Record<string, unknown>) => {
    const keys = Object.keys(row);
    await c.db.run(`INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`, keys.map((k) => row[k] as never));
  };
  const base = Number(session!.finished_at);
  for (let i = 1; i <= n; i++) {
    const id = `${sessionId}-h${i}`;
    const at = base - (i + 10) * 2 * DAY;
    const d = new Date(at);
    const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    await insert("session", { ...session!, id, started_at: at - 3_600_000, finished_at: at, local_calendar_date: local });
    for (const s of sets) await insert("workout_set", { ...s, id: `${s.id}-h${i}`, session_id: id });
  }
}

describe("achievements.getPulse (Today's cheap week read)", () => {
  it("equals getHome().pulse: empty, one day, two days in the week, a non-qualifying session", async () => {
    const c = await setup();
    expect(await c.achievements.getPulse()).toEqual((await c.achievements.getHome()).pulse);
    await c.train();
    expect(await c.achievements.getPulse()).toEqual((await c.achievements.getHome()).pulse);
    expect((await c.achievements.getPulse()).qualifiedDays).toBe(1);
    await c.train(2); // under 3 working sets: not a qualifying day
    c.deps.tick(DAY);
    await c.train();
    const pulse = await c.achievements.getPulse();
    expect(pulse).toEqual((await c.achievements.getHome()).pulse);
    c.deps.tick(8 * DAY);
    expect(await c.achievements.getPulse()).toEqual((await c.achievements.getHome()).pulse);
  });
  it("reads only the last 9 days: under 20 ms with 500 finished sessions behind it", async () => {
    const c = await setup();
    const id = await c.train();
    await cloneHistory(c, id, 500);
    c.deps.tick(DAY);
    await c.train();
    expect(await c.achievements.getPulse()).toEqual((await c.achievements.getHome()).pulse);
    const times: number[] = [];
    for (let i = 0; i < 7; i++) {
      const t0 = performance.now();
      await c.achievements.getPulse();
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    expect(times[3]!).toBeLessThan(20);
    // The session read is bounded by time, and the set read by those sessions only.
    const calls: string[] = [];
    const all = c.db.all.bind(c.db);
    (c.db as { all: typeof c.db.all }).all = (async (sql: string, params?: unknown[]) => {
      calls.push(sql);
      return all(sql, params as never);
    }) as typeof c.db.all;
    await c.achievements.getPulse();
    expect(calls.some((s) => /finished_at >= \?/.test(s))).toBe(true);
    expect(calls.filter((s) => /FROM workout_set/.test(s)).every((s) => /session_id IN \(/.test(s))).toBe(true);
  });
});

describe("applyLoadDeload normalLoad", () => {
  it("a lighter week preview carries the normal load; without one there is none", async () => {
    const c = await setup();
    await c.train();
    const before = await c.finish.previewDayLoads(c.day.id, c.gymId);
    expect(before.every((p) => p.proposal.normalLoad === undefined)).toBe(true);
    await c.repos.setSetting("deload", JSON.stringify({ status: "load", endsAt: c.deps.now() + 7 * DAY }));
    const during = await c.finish.previewDayLoads(c.day.id, c.gymId);
    const scaled = during.find((p) => p.proposal.normalLoad !== undefined);
    expect(scaled).toBeDefined();
    expect(scaled!.proposal.load!).toBeLessThan(scaled!.proposal.normalLoad!);
  });
});
