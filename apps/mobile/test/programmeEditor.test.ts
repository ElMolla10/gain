import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ar, en } from "../src/i18n/strings";

const editor = readFileSync(join(__dirname, "../src/components/ProgrammeEditorView.tsx"), "utf8");

describe("compact Edit Program exercise rows", () => {
  it("starts with every exercise collapsed and exposes only its name and chevron", () => {
    expect(editor).toContain("const [expandedExercise, setExpandedExercise] = useState<string | null>(null)");
    expect(editor).toContain('accessibilityLabel={nameOf(e.exerciseId)}');
    expect(editor).toContain('accessibilityState={{ expanded: expandedExercise === `${di}:${e.exerciseId}` }}');
    expect(editor).toContain('<Icon name="chevron"');
    expect(editor).toContain("minHeight: 60");
    const rowStart = editor.indexOf("{day.exercises.map((e, ei) => (");
    const disclosure = editor.indexOf("{expandedExercise === `${di}:${e.exerciseId}` ? (", rowStart);
    const sets = editor.indexOf('<Stepper label={t("prog.ex.sets")}', rowStart);
    expect(rowStart).toBeGreaterThan(-1);
    expect(disclosure).toBeGreaterThan(rowStart);
    expect(sets).toBeGreaterThan(disclosure);
    expect(editor.slice(rowStart, disclosure)).not.toContain("<Stepper");
  });

  it("offers a separate 48dp accessible trash button on EVERY collapsed exercise row", () => {
    const rowStart = editor.indexOf("{day.exercises.map((e, ei) => (");
    const disclosure = editor.indexOf("{expandedExercise === `${di}:${e.exerciseId}` ? (", rowStart);
    const collapsedRow = editor.slice(rowStart, disclosure);
    expect(collapsedRow).toContain('<IconButton');
    expect(collapsedRow).toContain('icon="trash"');
    expect(collapsedRow).toContain("color={p.danger}");
    expect(collapsedRow).toContain('label={t("prog.ex.removeButton", { exercise: nameOf(e.exerciseId) })}');
    expect(collapsedRow).toContain('onPress={() => confirmRemoveExercise(di, ei)}');
    // Remove and disclosure are siblings; tapping trash must not open the details.
    expect(collapsedRow.indexOf("</Pressable>")).toBeLessThan(collapsedRow.indexOf("<IconButton"));
    expect(collapsedRow).not.toContain('<Chip label={t("prog.ex.remove")}');
  });

  it("confirms exercise removal, cancel leaves the draft untouched, and Save remains the persistence boundary", () => {
    expect(editor).toContain('Alert.alert(');
    expect(editor).toContain('t("prog.ex.removeTitle", { exercise: nameOf(exercise.exerciseId) })');
    expect(editor).toContain('t("prog.ex.removeBody", { day: day.name })');
    expect(editor).toContain('style: "cancel"');
    expect(editor).toContain('style: "destructive"');
    expect(editor).toContain('props.onChange(removeExercise(d, dayIndex, exerciseIndex))');
    expect(editor).not.toContain('programmes.saveNewVersion(');
  });

  it("still exposes all advanced exercise controls when expanded", () => {
    for (const key of ["prog.ex.sets", "prog.ex.repsFrom", "prog.ex.repsTo", "prog.ex.countIn",
      "prog.ex.ceiling", "prog.ex.scheme", "prog.ex.goal", "prog.ex.effort",
      "loads.open"]) {
      expect(editor, key).toContain(`t("${key}")`);
    }
    expect(editor).toContain("updateExercise(d, di, ei");
    expect(editor).toContain("<ExerciseReorderModal");
    expect(editor).toContain("<ExercisePicker");
  });

  it("has English and Arabic disclosure instructions", () => {
    for (const key of ["prog.ex.removeButton", "prog.ex.removeTitle", "prog.ex.removeBody"] as const) {
      expect(en[key]).toContain("{");
      expect(ar[key]).toMatch(/[\u0600-\u06ff]/);
      expect((en[key].match(/\{\w+\}/g) ?? []).sort()).toEqual((ar[key].match(/\{\w+\}/g) ?? []).sort());
    }
    for (const key of ["prog.ex.expandHint", "prog.ex.collapseHint"] as const) {
      expect(en[key].length).toBeGreaterThan(10);
      expect(ar[key]).toMatch(/[\u0600-\u06ff]/);
      expect(editor).toContain(`t("${key}")`);
    }
  });
});
