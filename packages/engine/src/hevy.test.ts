import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { equipmentFromTitle, HEVY_COLUMNS, HevyParseError, parseCsv, parseHevyCsv, parseHevyDate, toLoggedSets } from "./hevy";

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
  it("parses unambiguous day-first and local ISO exports", () => {
    expect(parseHevyDate("29 Sep 2026, 15:15")).toBe("2026-09-29T15:15:00");
    expect(parseHevyDate("29 Sep 2026, 3:15 PM")).toBe("2026-09-29T15:15:00");
    expect(parseHevyDate("29 Sep 2026, 15:15:42")).toBe("2026-09-29T15:15:42");
    expect(parseHevyDate("2026-09-29 15:15:42")).toBe("2026-09-29T15:15:42");
    expect(parseHevyDate("2026-09-29T15:15")).toBe("2026-09-29T15:15:00");
  });
  it("rejects ambiguous dates and time zones instead of guessing", () => {
    for (const date of ["09/29/2026 15:15", "29/09/2026 15:15", "2026-09-29T15:15:00Z", "2026-09-29T15:15:00+02:00"]) {
      expect(() => parseHevyDate(date)).toThrow(HevyParseError);
    }
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

describe("import calendar boundaries", () => {
  it.each(["Feb 29, 2025, 3:15 PM", "Feb 29, 1900, 3:15 PM", "Apr 31, 2026, 3:15 PM", "Jan 0, 2026, 3:15 PM", "Jan 1, 2026, 24:00", "Jan 1, 2026, 3:60 PM", "29 Feb 2025, 15:15", "2026-02-30 15:15:00", "2026-09-29 15:15:60"])("rejects impossible Hevy date %s", date => {
    expect(() => parseHevyDate(date)).toThrow(HevyParseError);
  });
  it("accepts leap years and midnight without changing local wall clock", () => {
    expect(parseHevyDate("Feb 29, 2000, 12:00 AM")).toBe("2000-02-29T00:00:00");
    expect(parseHevyDate("Feb 29, 2024, 11:59 PM")).toBe("2024-02-29T23:59:00");
  });
  it("keeps valid rows and warns instead of silently moving an impossible date", () => {
    const row = (date: string) => ["Workout", date, date, "", "Bench Press (Barbell)", "", "", "0", "normal", "60", "8", "", "", ""].map(value => `"${value}"`).join(",");
    const parsed = parseHevyCsv([HEVY_COLUMNS.join(","), row("Sep 29, 2026, 3:15 PM"), row("Feb 30, 2026, 3:15 PM")].join("\n"));
    expect(parsed.workouts).toHaveLength(1);
    expect(parsed.rowCount).toBe(1);
    expect(parsed.warnings).toHaveLength(1);
    expect(parsed.workouts[0]!.startTime).toBe("2026-09-29T15:15:00");
  });
});
