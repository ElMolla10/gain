import { describe, expect, it } from "vitest";
import { translate } from "../src/i18n/format";
import type { StringKey } from "../src/i18n/strings";
import { workoutActivityProps, type ActivityExercise, type WorkoutActivityInput } from "../src/logic/workoutActivityModel";
import { focusedExercise } from "../src/logic/workoutFocus";
import { elapsedMs } from "../src/logic/workoutClock";
import type { SetRowDraft } from "../src/logic/workoutRows";

let n = 0;
/** translate() LTR-isolates numbers (U+2066/U+2069); invisible on the card. */
const plain = (s: string | null) => (s ?? "").replace(/[\u2066-\u2069]/g, "");
const row = (o: Partial<SetRowDraft> = {}): SetRowDraft => ({ key: `k${n++}`, load: null, reps: null, rir: null, warmup: false, tags: [], saved: false, dirty: false, ghostLoad: 80, ghostReps: 8, ...o });
const bench: ActivityExercise = { exerciseId: "bench", nameEn: "Bench press", nameAr: "بنش برس" };
const row2: ActivityExercise = { exerciseId: "row", nameEn: "Seated row", nameAr: "سحب أرضي" };
function input(o: Partial<WorkoutActivityInput> & { lang?: "en" | "ar" } = {}): WorkoutActivityInput {
  const lang = o.lang ?? "en";
  const shown = o.shown ?? [bench, row2];
  const rows = o.rows ?? { bench: [row()], row: [row()] };
  return { startedAt: 1_000, pausedMs: 0, pausedAt: null, shown, rows, focus: focusedExercise(shown.map((e) => e.exerciseId), rows, null), timer: { endsAt: null, durationMs: 90_000 }, now: 10_000, lang, unit: "kg",
    t: (k: StringKey, p?: Record<string, string | number>) => translate(lang, k, p), ...o };
}

describe("workout Live Activity props", () => {
  it("numbers working sets past warm-ups and drops (W/1/2/F/D)", () => {
    const list = [row({ warmup: true, saved: true }), row({ saved: true }), row(), row({ tags: ["failure"] }), row({ tags: ["drop"] })];
    expect(plain(workoutActivityProps(input({ rows: { bench: list, row: [row()] } })).setLine)).toBe("Set 2 of 3");
    expect(plain(workoutActivityProps(input({ rows: { bench: [row({ warmup: true }), row()], row: [row()] } })).setLine)).toBe("Warm-up");
    const drop = [row({ saved: true }), row({ tags: ["drop"] })];
    expect(plain(workoutActivityProps(input({ rows: { bench: drop, row: [row()] } })).setLine)).toBe("Drop set");
  });
  it("focus moves to the next exercise once every row is ticked; all done shows no exercise", () => {
    const p = workoutActivityProps(input({ rows: { bench: [row({ saved: true })], row: [row()] } }));
    expect(p.exercise).toBe("Seated row");
    const done = workoutActivityProps(input({ rows: { bench: [row({ saved: true })], row: [row({ saved: true })] } }));
    expect(done.exercise).toBeNull();
    expect(done.setLine).toBe("All sets done");
    expect(done.detail).toBeNull();
  });
  it("detail: typed over ghost, kg and lb, bodyweight, timed seconds and metres, null when incomplete", () => {
    expect(workoutActivityProps(input()).detail?.replace(/\u00a0/g, " ")).toBe("80 kg × 8");
    expect(workoutActivityProps(input({ rows: { bench: [row({ load: 82.5 })], row: [] } })).detail?.replace(/\u00a0/g, " ")).toBe("82.5 kg × 8");
    expect(workoutActivityProps(input({ unit: "lb", rows: { bench: [row({ ghostLoad: 45.359237 })], row: [] } })).detail?.replace(/\u00a0/g, " ")).toBe("100 lb × 8");
    const bw = { ...bench, setup: "bodyweight_plus_added" };
    expect(workoutActivityProps(input({ shown: [bw], rows: { bench: [row({ ghostLoad: 0, ghostReps: 12 })] } })).detail?.replace(/\u00a0/g, " ")).toBe("× 12");
    expect(workoutActivityProps(input({ shown: [{ ...bench, measure: "time" }], rows: { bench: [row({ ghostReps: 45 })] } })).detail?.replace(/\u00a0/g, " ")).toBe("45 s");
    expect(workoutActivityProps(input({ shown: [{ ...bench, measure: "distance" }], rows: { bench: [row({ ghostReps: 400 })] } })).detail?.replace(/\u00a0/g, " ")).toBe("400 m");
    expect(workoutActivityProps(input({ rows: { bench: [row({ ghostReps: null })], row: [] } })).detail).toBeNull();
  });
  it("includes the rest block only while it is running", () => {
    expect(workoutActivityProps(input({ timer: { endsAt: 70_000, durationMs: 90_000 } })).rest).toEqual({ startedAt: -20_000, endsAt: 70_000, label: "Rest timer" });
    expect(workoutActivityProps(input({ timer: { endsAt: 10_000, durationMs: 90_000 } })).rest).toBeNull();
  });
  it("the native count-up equals the in-app elapsed time, paused and running", () => {
    const paused = workoutActivityProps(input({ startedAt: 1_000, pausedMs: 5_000, pausedAt: 50_000 }));
    expect(paused.pausedAt! - paused.timerStart).toBe(elapsedMs(1_000, 5_000, 50_000, 50_000));
    expect(paused.pausedLabel).toBe("Paused");
    const running = workoutActivityProps(input({ startedAt: 1_000, pausedMs: 5_000 }));
    expect(80_000 - running.timerStart).toBe(elapsedMs(1_000, 5_000, null, 80_000));
    expect(running.pausedLabel).toBeNull();
  });
  it("Arabic gives Arabic labels with Western digits", () => {
    const p = workoutActivityProps(input({ lang: "ar", rows: { bench: [row({ saved: true }), row()], row: [] } }));
    expect(p.title).toBe("التمرين");
    expect(p.exercise).toBe("بنش برس");
    expect(plain(p.setLine)).toBe("المجموعة 2 من 2");
    expect(p.detail?.replace(/\u00a0/g, " ")).toBe("80 كجم × 8");
    expect(p.rtl).toBe(true);
  });
  it("stays under 1 KB with long names", () => {
    const long = { ...bench, nameEn: "A".repeat(300), nameAr: "ب".repeat(300) };
    for (const lang of ["en", "ar"] as const) {
      const p = workoutActivityProps(input({ lang, shown: [long], rows: { bench: [row()] }, timer: { endsAt: 70_000, durationMs: 90_000 }, pausedAt: 5_000 }));
      expect(new TextEncoder().encode(JSON.stringify(p)).length).toBeLessThan(1024);
      expect(p.exercise!.length).toBeLessThanOrEqual(32);
    }
  });
});

describe("workout Live Activity v2", () => {
  const spec = { equipment: "barbell" as const, min: 20, plates: [25, 20, 15, 10, 5, 2.5, 1.25] };
  const benchBar: ActivityExercise = { ...bench, equipment: "barbell", loadSpec: spec };
  it("carries plates per side and the change", () => {
    const rows = { bench: [row({ saved: true, load: 100, reps: 8 }), row({ ghostLoad: 120 })], row: [row()] };
    const p = workoutActivityProps(input({ shown: [benchBar, row2], rows }));
    expect(p.v).toBe(2);
    expect(p.plates).toEqual([25, 25]);
    expect(plain(p.change).replace(/\u00a0/g, " ")).toBe("+10 each side");
    expect(p.detail).toContain("\u00a0kg\u00a0×\u00a0");
  });
  it("worst case stays under ActivityKit's 4 KB", () => {
    const long: ActivityExercise = { ...benchBar, nameAr: "ضغط صدر بالبار على بنش مائل بزاوية عالية جداً".repeat(3), nameEn: "x".repeat(200), loadSpec: { equipment: "barbell", min: 20, plates: [1.25] } };
    const rows = { bench: [row({ saved: true, load: 20, reps: 8 }), row({ ghostLoad: 40 })], row: [row()] };
    const p = workoutActivityProps(input({ lang: "ar", shown: [long, row2], rows, timer: { endsAt: 99_000, durationMs: 90_000 } }));
    expect(p.plates.length).toBeLessThanOrEqual(8);
    expect(new TextEncoder().encode(JSON.stringify(p)).length).toBeLessThanOrEqual(4096);
  });
});

describe("workout Live Activity v2 layout (PR F)", () => {
  const spec = { equipment: "barbell" as const, min: 20, plates: [25, 20, 15, 10, 5, 2.5, 1.25] };
  it("plate capsules carry the printed number and the competition colours (lb is iron)", async () => {
    const { PLATE_NUMERAL_INK, TODAY_PLATES } = await import("../src/palettes");
    const rows = { bench: [row({ saved: true, load: 100, reps: 8 }), row({ ghostLoad: 120 })], row: [row()] };
    const p = workoutActivityProps(input({ shown: [{ ...bench, equipment: "barbell", loadSpec: spec }, row2], rows }));
    expect(p.plateCaps).toEqual([{ t: "25", bg: TODAY_PLATES.red.face, fg: PLATE_NUMERAL_INK.red }, { t: "25", bg: TODAY_PLATES.red.face, fg: PLATE_NUMERAL_INK.red }]);
    // A pound gym (45 lb bar, 45 / 25 / 10 lb plates), 135 lb on the bar: one 45 each side, printed "45", iron without colours.
    const LB = 0.45359237;
    const lbSpec = { equipment: "barbell" as const, min: 45 * LB, plates: [45 * LB, 25 * LB, 10 * LB] };
    const lbRows = { bench: [row({ saved: true, load: 95 * LB, reps: 8 }), row({ ghostLoad: 135 * LB })], row: [row()] };
    const lb = workoutActivityProps(input({ unit: "lb", shown: [{ ...bench, equipment: "barbell", loadSpec: lbSpec }, row2], rows: lbRows }));
    expect(lb.plateCaps.map((c) => c.t)).toEqual(["45"]);
    expect(lb.plateCaps.every((c) => c.bg === TODAY_PLATES.iron.face)).toBe(true);
  });
  it("Arabic change line says كجم, never kg", () => {
    const rows = { bench: [row({ saved: true, load: 45, reps: 8 }), row({ ghostLoad: 40 })], row: [row()] };
    const cable = { ...bench, equipment: "cable" as const, loadSpec: { equipment: "cable" as const, min: 5, increment: 5, max: 100 } };
    const p = workoutActivityProps(input({ lang: "ar", shown: [cable, row2], rows }));
    expect(p.change).toContain("كجم");
    expect(p.change).not.toContain("kg");
  });
  it("the layout draws capsules and the change on the Lock Screen and the expanded island; the compact island shows the number", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(__dirname, "..", "src", "native", "workoutLiveActivityLayout.tsx"), "utf8");
    expect(src.match(/\{caps\}\s*\{changeLine\}/g)?.length).toBe(2);
    expect(src).toMatch(/p\.detail\s*\? <Text modifiers=\{\[monospacedDigit\(\), lineLimit\(1\)\]\}>\{p\.detail\}<\/Text>/);
    expect(src).not.toMatch(/#[0-9A-Fa-f]{6}.*plate/i);
  });
});
