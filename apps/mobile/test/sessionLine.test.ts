import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { translate } from "../src/i18n/format";
import { saveStatusKind } from "../src/logic/saveStatus";
import { plannedWorkRows, sessionLineWarns } from "../src/logic/sessionLine";
import type { SetRowDraft } from "../src/logic/workoutRows";

let n = 0;
const row = (o: Partial<SetRowDraft> = {}): SetRowDraft => ({ key: `s${n++}`, load: null, reps: null, rir: null, warmup: false, tags: [], saved: false, dirty: false, ghostLoad: 80, ghostReps: 8, ...o });
const screen = readFileSync(join(__dirname, "..", "src", "screens", "WorkoutScreen.tsx"), "utf8");
const plain = (s: string) => s.replace(/[\u2066-\u2069]/g, "");

describe("session line (logger 10x §5)", () => {
  it("y counts planned work rows: no warm-ups, no drops; failure sets count", () => {
    const rows = { a: [row({ warmup: true }), row(), row({ tags: ["failure"] }), row({ tags: ["drop"] })], b: [row(), row()] };
    expect(plannedWorkRows(rows, ["a", "b"])).toBe(4);
    expect(plannedWorkRows(rows, ["b"])).toBe(2);
  });
  it("a failure or unsaved work takes over the middle; the save priority is unchanged", () => {
    expect(sessionLineWarns(saveStatusKind({ failed: true, saving: true, pending: 2, resumedNote: true, savedSets: 3 }))).toBe(true);
    expect(sessionLineWarns(saveStatusKind({ failed: false, saving: false, pending: 1, resumedNote: true, savedSets: 3 }))).toBe(true);
    expect(saveStatusKind({ failed: false, saving: true, pending: 1, resumedNote: false, savedSets: 3 })).toBe("saving");
    expect(sessionLineWarns("saved")).toBe(false);
    expect(sessionLineWarns("resumed")).toBe(false);
  });
  it("EN and AR copy, numbers isolated, Arabic reads x before y", () => {
    expect(plain(translate("en", "rack.setsOf", { x: 4, y: 18 }))).toBe("4 of 18 sets");
    expect(plain(translate("ar", "rack.setsOf", { x: 4, y: 18 }))).toBe("4 من 18 مجموعة");
    expect(plain(translate("en", "rack.savedShort", { time: "06:31" }))).toBe("Saved 06:31");
    expect(plain(translate("ar", "rack.savedShort", { time: "06:31" }))).toBe("اتحفظ 06:31");
  });
  it("Pause never hides, the details panel stays reachable, large text wraps to two rows, one live region", () => {
    expect(screen).toMatch(/\{warns \? null : \(/);
    expect(screen).not.toMatch(/warns \? null : <IconButton/);
    expect(screen).toContain("accessibilityState={{ expanded: detailsOpen }}");
    expect(screen).toContain("<WorkoutDetailsPanel\n          open={detailsOpen}");
    expect(screen).toContain('flexWrap: largeText ? "wrap" : "nowrap"');
    expect(screen.match(/accessibilityLiveRegion="polite"/g)?.length).toBe(1);
    expect(screen).not.toContain("<InlineStatus kind={status.kind}");
  });
});
