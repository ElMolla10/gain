import { describe, expect, it } from "vitest";
import { draftFromShare, exportProgrammeShare, parseProgrammeShare, programmeShareSummary, ProgrammeShareError } from "../src/logic/programmeShare";
import { newExercise, type ProgrammeDraft } from "../src/logic/programmeDraft";

const draft: ProgrammeDraft = {
  name: "Push",
  days: [{ name: "A", exercises: [newExercise("ex1", { sets: 3, repMin: 6, repMax: 10 })] }],
};
const library = new Map([["ex1", { nameEn: "Bench Press", equipment: "barbell" as const, setup: "free" as const, pattern: "horizontal_push" }]]);

describe("programme share JSON", () => {
  it("round-trips as a new draft and never uses the original exercise id as the name", () => {
    const json = JSON.stringify(exportProgrammeShare(draft, library));
    const parsed = parseProgrammeShare(json);
    expect(parsed.name).toBe("Push");
    expect(parsed.days[0]!.exercises[0]!.name).toBe("Bench Press");
    expect(parsed.days[0]!.exercises[0]!.sets).toBe(3);
    const next = draftFromShare(parsed);
    expect(next.name).toBe("Push");
    expect(next.days[0]!.exercises[0]!.exerciseId).toBe("Bench Press");
    expect(programmeShareSummary(parsed).lines.join("\n")).toContain("3 × 6–10");
  });
  it("refuses junk and a different kind of file", () => {
    expect(() => parseProgrammeShare("not json")).toThrow(ProgrammeShareError);
    expect(() => parseProgrammeShare(JSON.stringify({ v: 1, kind: "nope", name: "x", days: [] }))).toThrow(ProgrammeShareError);
  });
});
