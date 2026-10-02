import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { equipmentFromTitle, HevyParseError, parseCsv, parseHevyCsv, parseHevyDate, toLoggedSets } from "./hevy";

const synthetic = readFileSync(new URL("../../../fixtures/hevy-synthetic.csv", import.meta.url), "utf8");

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, commas, CRLF and newlines inside quotes", () => {
    expect(parseCsv('a,"b,c","d ""e"""\r\n"x\ny",,z\n')).toEqual([
      ["a", "b,c", 'd "e"'],
      ["x\ny", "", "z"],
    ]);
  });
  it("strips a BOM and ignores blank lines", () => {
    expect(parseCsv("\uFEFFa,b\n\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
  });
  it("rejects an unterminated quote", () => {
    expect(() => parseCsv('a,"b')).toThrow(HevyParseError);
  });
});

describe("parseHevyDate", () => {
  it("parses 12-hour times", () => {
    expect(parseHevyDate("Sep 29, 2026, 3:15 PM")).toBe("2026-09-29T15:15:00");
    expect(parseHevyDate("Jan 13, 2026, 1:21 AM")).toBe("2026-01-13T01:21:00");
  });
  it("handles midnight and noon", () => {
    expect(parseHevyDate("Sep 6, 2026, 12:05 AM")).toBe("2026-09-06T00:05:00");
    expect(parseHevyDate("Sep 6, 2026, 12:05 PM")).toBe("2026-09-06T12:05:00");
  });
  it("rejects garbage", () => {
    expect(() => parseHevyDate("yesterday")).toThrow(HevyParseError);
    expect(() => parseHevyDate("Foo 1, 2026, 3:00 PM")).toThrow(HevyParseError);
  });
});

describe("parseHevyCsv (synthetic fixture)", () => {
  const r = parseHevyCsv(synthetic);
  it("groups rows into workouts sorted by time", () => {
    expect(r.workouts.map((w) => w.startTime)).toEqual(["2026-09-01T18:00:00", "2026-09-04T18:00:00", "2026-09-06T00:05:00"]);
    expect(r.rowCount).toBe(8);
    expect(r.warnings).toEqual([]);
  });
  it("groups sets under exercises in order", () => {
    const bench = r.workouts[0]!.exercises[0]!;
    expect(bench.title).toBe("Bench Press (Barbell)");
    expect(bench.sets.map((s) => [s.weightKg, s.reps, s.type])).toEqual([
      [60, 10, "normal"],
      [60, 9, "normal"],
      [40, 12, "dropset"],
    ]);
    expect(bench.notes).toBe("");
  });
  it("keeps empty numeric cells as null", () => {
    const hang = r.workouts[1]!.exercises.find((e) => e.title === "Dead Hang")!;
    expect(hang.sets[0]).toMatchObject({ weightKg: null, reps: null, durationSeconds: 45 });
  });
  it("converts to engine sets: drop tagged, rpe -> rir, no-rep sets skipped", () => {
    const bench = r.workouts[0]!.exercises[0]!;
    const sets = toLoggedSets(bench.sets);
    expect(sets).toHaveLength(3);
    expect(sets[1]!.rir).toBe(2);
    expect(sets[2]!.tags).toEqual(["drop"]);
    expect(toLoggedSets(r.workouts[1]!.exercises.find((e) => e.title === "Dead Hang")!.sets)).toEqual([]);
  });
  it("bodyweight sets with no weight become load 0", () => {
    expect(toLoggedSets(r.workouts[2]!.exercises[0]!.sets)).toEqual([{ load: 0, reps: 8 }]);
  });
});

describe("parseHevyCsv errors and warnings", () => {
  it("throws on a missing column", () => {
    expect(() => parseHevyCsv("title,start_time\nx,y")).toThrow(/Missing columns/);
  });
  it("throws on an empty file", () => {
    expect(() => parseHevyCsv("")).toThrow(HevyParseError);
  });
  it("skips rows with an unreadable date and says so", () => {
    const header = synthetic.split("\n")[0]!;
    const r = parseHevyCsv(`${header}\n"Push","nonsense","","","Bench Press (Barbell)",,"",0,"normal",60,10,,,`);
    expect(r.workouts).toEqual([]);
    expect(r.warnings[0]).toMatch(/Unrecognised date/);
  });
});

describe("equipmentFromTitle", () => {
  it.each([
    ["Bench Press (Barbell)", "barbell"],
    ["Hammer Curl (Dumbbell)", "dumbbell"],
    ["Lat Pulldown (Cable)", "cable"],
    ["Chest Press (Machine)", "machine"],
    ["Butterfly (Pec Deck)", "machine"],
    ["Shoulder Press (Machine Plates)", "machine"],
    ["T Bar Row", null],
    ["Pull Up", null],
  ])("%s -> %s", (title, eq) => {
    expect(equipmentFromTitle(title)).toBe(eq);
  });
});
