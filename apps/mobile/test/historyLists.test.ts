import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { freshDb } from "./helpers";

const DAY = 86_400_000;

async function setup() {
  const ctx = await freshDb();
  await ctx.repos.seedIfNeeded();
  const gymId = (await ctx.repos.getActiveGymId())!;
  const gym = await ctx.repos.loadGymFingerprint(gymId);
  /** Train the next program day; `plan` maps exercise name to [load, reps, warmup?] sets. */
  const train = async (plan: Record<string, [number, number, boolean?][]>) => {
    // The day that holds the first exercise of the plan (bench is on Upper A only).
    const wanted = Object.keys(plan)[0]!;
    const days = await ctx.db.all<{ id: string; name: string }>("SELECT d.id, d.name FROM programme_day d JOIN programme_version v ON v.id = d.programme_version_id ORDER BY v.version DESC, d.position");
    let next: { day: { id: string; name: string } } | null = null;
    let exs: Awaited<ReturnType<typeof ctx.repos.listDayExercises>> = [];
    for (const d of days) {
      const list = await ctx.repos.listDayExercises(d.id);
      if (list.some((e) => e.nameEn === wanted)) {
        next = { day: d };
        exs = list;
        break;
      }
    }
    const { id } = await ctx.workout.startOrResumeSession(next!.day.id, gymId);
    const ids: string[] = [];
    for (const [name, list] of Object.entries(plan)) {
      const ex = exs.find((e) => e.nameEn === name)!;
      for (const [load, reps, warmup] of list) {
        const r = await ctx.workout.logSet({ sessionId: id, exerciseId: ex.exerciseId, load, reps, warmup }, { gym, equipment: ex.equipment, setup: ex.setup });
        ids.push(r.id);
      }
    }
    ctx.deps.tick(1000);
    await ctx.workout.finishSession(id);
    await ctx.finish.writeNextSessionTargets(id);
    ctx.deps.tick(DAY);
    return { sessionId: id, setIds: ids, dayName: next!.day.name };
  };
  return { ...ctx, gymId, gym, train };
}
const BENCH = "Barbell Bench Press";

// Plan 2.5 (H-2, H-3, H-7, H-8): lists that show progress.
describe("history lists: PR flag, latest top set and trend", () => {
  it("marks sessions that set a weight record and gives each lift its latest top set and direction", async () => {
    const { history, train, deps } = await setup();
    const first = await train({ [BENCH]: [[60, 8], [60, 8]] });
    deps.tick(6 * DAY);
    const second = await train({ [BENCH]: [[62.5, 8], [60, 8]] });
    deps.tick(6 * DAY);
    const third = await train({ [BENCH]: [[62.5, 6]] });
    deps.tick(6 * DAY);
    const fourth = await train({ [BENCH]: [[65, 7], [62.5, 8]] });
    const sessions = await history.listSessions();
    const pr = new Map(sessions.map((s) => [s.id, s.pr]));
    expect(pr.get(first.sessionId)).toBe(false); // the baseline is not a record
    expect(pr.get(second.sessionId)).toBe(true);
    expect(pr.get(third.sessionId)).toBe(false);
    expect(pr.get(fourth.sessionId)).toBe(true);
    const bench = (await history.listLifts()).find((l) => l.nameEn === BENCH)!;
    expect(bench.latest).toEqual({ load: 65, reps: 7 });
    expect(bench.direction).toBe("better");
    expect(bench.setups).toBe(1);
  });
  it("a new lift with one session has a number but no direction yet", async () => {
    const { history, train } = await setup();
    await train({ [BENCH]: [[60, 8]] });
    const bench = (await history.listLifts())[0]!;
    expect(bench.latest).toEqual({ load: 60, reps: 8 });
    expect(bench.direction).toBe("thin");
  });
});

describe("history screen layout", () => {
  const f = readFileSync(join(__dirname, "..", "src", "screens", "HistoryScreen.tsx"), "utf8");
  const ui = readFileSync(join(__dirname, "..", "src", "ui.tsx"), "utf8");
  it("Sessions / Exercises are a tablist of tabs, not chips", () => {
    expect(f).toContain("<SegmentedTabs");
    expect(f).not.toContain("<Chip");
    const seg = ui.slice(ui.indexOf("export function SegmentedTabs"), ui.indexOf("export function ListRow"));
    expect(seg).toContain('accessibilityRole="tablist"');
    expect(seg).toContain('accessibilityRole="tab"');
    expect(seg).toContain("accessibilityState={{ selected: on }}");
  });
  it("the achievements card is no longer between the tabs and the list", () => {
    expect(f.indexOf("<EvidenceAchievementsCard />")).toBeGreaterThan(f.indexOf('mode === "sessions" ?'));
    expect(f.indexOf("<EvidenceAchievementsCard />")).toBeGreaterThan(f.indexOf("lifts.map("));
  });
  it("lift rows show formatLoad × isolated reps and a trend glyph with its meaning spoken", () => {
    expect(f).toContain("${formatLoad(l.latest.load, lang, unit)}${NBSP}×${NBSP}${isolateLtr(String(l.latest.reps))}");
    expect(f).toMatch(/history\.trend\./);
    expect(f).toContain('t("history.prLabel")');
  });
});
