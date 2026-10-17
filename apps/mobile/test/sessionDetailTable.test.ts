import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { rowLabels } from "../src/logic/workoutRows";
import { ar } from "../src/i18n/strings";

// Plan 2.7 (H-6): a read-only table by default, one "Edit workout" toggle, per-set actions only while editing.
const f = readFileSync(join(__dirname, "..", "src", "screens", "SessionDetailScreen.tsx"), "utf8");

describe("session detail table", () => {
  it("defaults to read mode with one Edit workout / Done toggle", () => {
    expect(f).toContain("const [editing, setEditing] = useState(false);");
    expect(f).toContain('label={editing ? t("common.done") : t("history.editWorkout")}');
    expect(ar["history.editWorkout"]).toMatch(/[\u0600-\u06FF]/);
  });
  it("uses the logger's column heads and 48 dp rows with isolated tabular values", () => {
    for (const k of ["workout.col.set", "workout.col.reps", "workout.col.rir", "workout.col.sec", "workout.col.metres"]) expect(f).toContain(`t("${k}")`);
    expect(f).toContain("minHeight: MIN_TOUCH, flexDirection: \"row\"");
    expect(f).toContain("isolateLtr(weightText(s.load, unit))");
    expect(f).toMatch(/fontVariant: \["tabular-nums"\]/);
  });
  it("per-set edit and delete render only when editing; the confirm and Delete workout are unchanged", () => {
    const perSet = f.indexOf('<BigButton variant="danger" icon="trash" label={t("history.delete")}');
    const guard = f.lastIndexOf(") : editing ? (", perSet);
    expect(guard).toBeGreaterThan(-1);
    expect(f.slice(guard, perSet)).not.toContain(") : null}");
    expect(f).toContain("editing && edit?.setId === s.id ?");
    expect(f).toContain("editing && asking === s.id ?");
    expect(f).toMatch(/variant="dangerSolid"\s+label=\{t\("history\.deleteYes"\)\}/);
    expect(f).toContain('<BigButton variant="danger" label={t("history.deleteWorkout")}');
  });
  it("warm-up / drop / failure markers match the logger (W, D, F; working sets numbered)", () => {
    expect(rowLabels([{ warmup: true }, { warmup: false }, { warmup: false, tags: ["failure"] }, { warmup: false, tags: ["drop"] }, { warmup: false }])).toEqual(["W", "1", "F", "D", "3"]);
  });
});
