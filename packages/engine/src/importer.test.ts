import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  addSeconds, classifyTitle, detectSource, guessPattern, ImportParseError, lbToKg, matchLibrary, nameKey, parseDurationSeconds, parseImport, parseStrongDate, toKilograms, workoutKey,
  type LibraryEntry,
} from "./importer";

const fx = (n: string) => readFileSync(new URL(`../../../fixtures/${n}`, import.meta.url), "utf8");
const hevyReal = fx("hevy-export.csv");
const strong = fx("strong-synthetic.csv");
const strong6 = fx("strong-synthetic-v6.csv");

describe("source detection", () => {
  it("recognises Hevy, Strong (comma) and Strong (semicolon) by their headers", () => {
    expect(detectSource(hevyReal)).toBe("hevy");
    expect(detectSource(strong)).toBe("strong");
    expect(detectSource(strong6)).toBe("strong");
    expect(detectSource("a,b\n1,2")).toBeNull();
    expect(() => parseImport("a,b\n1,2")).toThrow(ImportParseError);
  });
});

describe("Hevy through the common parser (real export fixture)", () => {
  const r = parseImport(hevyReal);
  it("reads every workout and set; weights are kg as stated by the column", () => {
    expect(r.source).toBe("hevy");
    expect(r.unit).toBe("kg");
    expect(r.workouts).toHaveLength(70);
    expect(r.rowCount).toBe(1049);
    expect(r.warnings).toEqual([]);
  });
  it("keeps the exercise titles exactly as exported and tags drop sets", () => {
    const titles = new Set(r.workouts.flatMap((w) => w.exercises.map((e) => e.title)));
    expect(titles.size).toBe(55);
    expect(titles.has("Bench Press (Barbell)")).toBe(true);
    const drops = r.workouts.flatMap((w) => w.exercises.flatMap((e) => e.sets)).filter((s) => s.tags?.includes("drop"));
    expect(drops).toHaveLength(22);
  });
  it("sets with no reps (timed holds) are counted as skipped rows, not invented as sets", () => {
    const hang = r.workouts.flatMap((w) => w.exercises).filter((e) => e.title === "Dead Hang");
    expect(hang.length).toBeGreaterThan(0);
    expect(hang.every((e) => e.sets.length === 0 && e.skippedRows > 0)).toBe(true);
  });
  it("the timed rows are kept for a timed exercise (seconds), and the weights stay kg", () => {
    const hang = r.workouts.flatMap((w) => w.exercises).filter((e) => e.title === "Dead Hang");
    expect(hang.every((e) => (e.timed?.length ?? 0) === e.skippedRows)).toBe(true);
    const first = r.workouts.find((w) => w.startTime === "2026-05-14T14:43:00")!.exercises.find((e) => e.title === "Dead Hang")!;
    expect(first.timed).toEqual([{ load: 0, durationS: 75, distanceM: null }, { load: 0, durationS: 49, distanceM: null }, { load: 0, durationS: 38, distanceM: null }]);
  });
  it("distance rows become metres (km in kg files, miles in lb files); weights of timed rows convert like the rest", () => {
    const head = "title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe\n";
    const kg = parseImport(`${head}"Carry","Sep 29, 2026, 3:15 PM","Sep 29, 2026, 4:00 PM","","Farmers Walk",,"",0,"normal",32,,0.04,35,\n`);
    expect(kg.workouts[0]!.exercises[0]!.timed).toEqual([{ load: 32, durationS: 35, distanceM: 40 }]);
    const lb = parseImport(`${head.replace("weight_kg", "weight_lbs").replace("distance_km", "distance_miles")}"Carry","Sep 29, 2026, 3:15 PM","Sep 29, 2026, 4:00 PM","","Farmers Walk",,"",0,"normal",70,,0.1,,\n`);
    const conv = toKilograms(lb).workouts[0]!.exercises[0]!.timed!;
    expect(conv).toEqual([{ load: 31.75, durationS: null, distanceM: 160.9 }]);
  });
  it("workout keys are unique, so a re-import can be recognised", () => {
    expect(new Set(r.workouts.map((w) => w.key)).size).toBe(70);
    expect(r.workouts[0]!.key).toBe(workoutKey("hevy", r.workouts[0]!.title, r.workouts[0]!.startTime));
  });
  it("a Hevy file in pounds (weight_lbs) is read as pounds and converts to kg", () => {
    const lbs = 'title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_lbs,reps,distance_miles,duration_seconds,rpe\n"Push","Sep 29, 2026, 3:15 PM","Sep 29, 2026, 4:00 PM","","Bench Press (Barbell)",,"",0,"normal",135,8,,,\n';
    const p = parseImport(lbs);
    expect(p.unit).toBe("lb");
    expect(p.workouts[0]!.exercises[0]!.sets[0]!.load).toBe(135);
    expect(toKilograms(p).workouts[0]!.exercises[0]!.sets[0]!.load).toBe(61.23);
  });
});

describe("Strong parser (synthetic fixtures built from the documented format)", () => {
  const r = parseImport(strong);
  it("groups rows into workouts; set order W / D / F / numbers; rest timers and no-rep rows are not sets", () => {
    expect(r.source).toBe("strong");
    expect(r.workouts.map((w) => [w.title, w.startTime])).toEqual([["Upper A", "2026-09-01T18:00:00"], ["Lower A", "2026-09-03T09:30:00"]]);
    const bench = r.workouts[0]!.exercises[0]!;
    expect(bench.sets).toEqual([
      { load: 40, reps: 8, warmup: true },
      { load: 100, reps: 5, rir: 2 },
      { load: 100, reps: 4, rir: 1 },
      { load: 80, reps: 10, tags: ["drop"] },
    ]);
    const plank = r.workouts[0]!.exercises.find((e) => e.title === "Plank")!;
    expect(plank.sets).toEqual([]);
    expect(plank.skippedRows).toBe(1);
    expect(plank.timed).toEqual([{ load: 0, durationS: 60, distanceM: null }]);
    expect(r.workouts[1]!.exercises[0]!.sets[1]).toEqual({ load: 225, reps: 3, tags: ["failure"] });
    expect(r.workouts[0]!.exercises.find((e) => e.title === "Pull Up")!.sets).toEqual([{ load: 0, reps: 8 }]);
  });
  it("duration becomes the end time", () => {
    expect(r.workouts[0]!.endTime).toBe("2026-09-01T19:05:00");
    expect(r.workouts[1]!.endTime).toBe("2026-09-03T10:15:00");
  });
  it("the plain Weight column does not state its unit: unknown until the lifter says; no silent kg", () => {
    expect(r.unit).toBe("unknown");
    expect(() => toKilograms(r)).toThrow(/not stated/);
    const kg = toKilograms(r, "kg");
    expect(kg.workouts[1]!.exercises[0]!.sets[0]!.load).toBe(225);
    const lb = toKilograms(r, "lb");
    expect(lb.workouts[1]!.exercises[0]!.sets[0]!.load).toBe(102.06);
    expect(lb.workouts[0]!.exercises[0]!.sets[1]!.load).toBe(45.36);
  });
  it("semicolon files with a 'Weight (kg)' column state kg; Rest Timer rows are skipped", () => {
    const p = parseImport(strong6);
    expect(p.unit).toBe("kg");
    expect(p.workouts).toHaveLength(1);
    const bench = p.workouts[0]!.exercises[0]!;
    expect(bench.sets.map((s) => [s.load, s.reps])).toEqual([[61.23, 5], [61.23, 4]]);
    expect(bench.skippedRows).toBe(1);
    expect(p.workouts[0]!.endTime).toBe("2026-09-01T19:05:00");
    expect(toKilograms(p).workouts[0]!.exercises[0]!.sets[0]!.load).toBe(61.23);
  });
  it("reports bad dates and unknown set orders instead of dropping them silently", () => {
    const header = strong.split("\n")[0]!;
    const bad = parseImport(`${header}\nnot a date,"X",1h,"Squat (Barbell)",1,100,5,0,0,"","",\n2026-09-01 18:00:00,"X",1h,"Squat (Barbell)",Z,100,5,0,0,"","",\n`);
    expect(bad.warnings.some((w) => /Unrecognised date/.test(w))).toBe(true);
    expect(bad.warnings.some((w) => /unknown set order "Z"/.test(w))).toBe(true);
    expect(bad.workouts[0]!.exercises[0]!.sets).toEqual([]);
  });
  it("missing columns are an error", () => {
    expect(() => parseImport("Workout Name,Exercise Name,Set Order\nA,B,1")).toThrow(/Missing columns/);
  });
  it("helpers: dates, durations, seconds arithmetic, pounds", () => {
    expect(parseStrongDate("2026-09-01 8:05")).toBe("2026-09-01T08:05:00");
    expect(() => parseStrongDate("Sep 1")).toThrow();
    expect(parseDurationSeconds("2h 38m")).toBe(9480);
    expect(parseDurationSeconds("45m")).toBe(2700);
    expect(parseDurationSeconds("01:02:00")).toBe(3720);
    expect(parseDurationSeconds("3720")).toBe(3720);
    expect(parseDurationSeconds("soon")).toBeNull();
    expect(addSeconds("2026-12-31T23:30:00", 3600)).toBe("2027-01-01T00:30:00");
    expect(lbToKg(135)).toBe(61.23);
  });
});

describe("classification from the title only", () => {
  it("reads equipment and setup from the suffix, never guesses without one", () => {
    expect(classifyTitle("Bench Press (Barbell)")).toMatchObject({ base: "Bench Press", equipment: "barbell", setup: "free" });
    expect(classifyTitle("Lat Pulldown (Cable)")).toMatchObject({ equipment: "cable" });
    expect(classifyTitle("Incline Chest Press (Machine)")).toMatchObject({ equipment: "machine" });
    expect(classifyTitle("Bench Press (Smith Machine)")).toMatchObject({ equipment: "machine" }); // never barbell
    expect(classifyTitle("Butterfly (Pec Deck)")).toMatchObject({ equipment: "machine" });
    expect(classifyTitle("Pull Up (Assisted)")).toMatchObject({ equipment: "assisted", setup: "assisted" });
    expect(classifyTitle("Pull Up (Weighted)")).toMatchObject({ equipment: "plate", setup: "bodyweight_plus_added" });
    expect(classifyTitle("Pull Up")).toMatchObject({ equipment: null, setup: null });
    expect(classifyTitle("Triceps Pushdown")).toMatchObject({ equipment: null });
    expect(classifyTitle("Cable Forearm (palms up)")).toMatchObject({ equipment: null });
  });
  it("name keys ignore order, case, punctuation, equipment words and plurals", () => {
    expect(nameKey("Barbell Bench Press")).toBe(nameKey("Bench Press"));
    expect(nameKey("Lateral Raises")).toBe(nameKey("lateral raise"));
    expect(nameKey("Seated Cable Row - V Grip")).toBe(nameKey("V Grip Seated Row"));
  });
  const lib: LibraryEntry[] = [
    { id: "bp", nameEn: "Barbell Bench Press", equipment: "barbell", setup: "free" },
    { id: "cpm", nameEn: "Machine Chest Press", equipment: "machine", setup: "free" },
    { id: "ldb", nameEn: "Dumbbell Lateral Raise", equipment: "dumbbell", setup: "free" },
    { id: "lcab", nameEn: "Cable Lateral Raise", equipment: "cable", setup: "free" },
    { id: "ap", nameEn: "Assisted Pull-Up (machine)", equipment: "assisted", setup: "assisted" },
  ];
  it("matches the library only on an exact name + equipment", () => {
    expect(matchLibrary("Bench Press (Barbell)", lib)?.id).toBe("bp");
    expect(matchLibrary("Bench Press (Smith Machine)", lib)).toBeNull(); // Smith bench is not the barbell line
    expect(matchLibrary("Chest Press (Machine)", lib)?.id).toBe("cpm");
    expect(matchLibrary("Lateral Raise (Dumbbell)", lib)?.id).toBe("ldb");
    expect(matchLibrary("Lateral Raise (Cable)", lib)?.id).toBe("lcab");
    expect(matchLibrary("Incline Bench Press (Dumbbell)", lib)).toBeNull();
    expect(matchLibrary("Hack Squat", lib)).toBeNull();
  });
  it("with no equipment in the title, a name that two library lifts share is not matched", () => {
    expect(matchLibrary("Lateral Raise", lib)).toBeNull(); // dumbbell or cable: ambiguous
    expect(matchLibrary("Bench Press", lib)?.id).toBe("bp");
  });
  it("v0.12.0 library rules: exact name, Smith line, equipment words, variants and plain titles", () => {
    const L: LibraryEntry[] = [
      { id: "sq-b", nameEn: "Squat (Barbell)", equipment: "barbell", setup: "free" },
      { id: "sq-m", nameEn: "Squat (Machine)", equipment: "machine", setup: "free" },
      { id: "sq-s", nameEn: "Squat (Smith Machine)", equipment: "machine", setup: "free" },
      { id: "dl-b", nameEn: "Deadlift (Barbell)", equipment: "barbell", setup: "free" },
      { id: "dl-t", nameEn: "Deadlift (Trap Bar)", equipment: "barbell", setup: "free" },
      { id: "pu", nameEn: "Pull-Up (bodyweight + added)", equipment: "plate", setup: "bodyweight_plus_added" },
      { id: "pu-a", nameEn: "Pull Up (Assisted)", equipment: "assisted", setup: "assisted" },
      { id: "tp", nameEn: "Cable Triceps Pushdown", equipment: "cable", setup: "free" },
      { id: "tp-v", nameEn: "Triceps Pushdown (V Bar)", equipment: "cable", setup: "free" },
      { id: "gs-d", nameEn: "Goblet Squat", equipment: "dumbbell", setup: "free" },
      { id: "gs-k", nameEn: "Goblet Squat (Kettlebell)", equipment: "dumbbell", setup: "free" },
      { id: "lr-m", nameEn: "Lateral Raise (Machine)", equipment: "machine", setup: "free" },
      { id: "lr-s", nameEn: "Lateral Raise (Smith Machine)", equipment: "machine", setup: "free" },
      { id: "dr", nameEn: "Dumbbell Row", equipment: "dumbbell", setup: "free" },
    ];
    expect(matchLibrary("Squat (Smith Machine)", L)?.id).toBe("sq-s"); // never the plain machine line
    expect(matchLibrary("squat (machine)", L)?.id).toBe("sq-m"); // case does not matter
    expect(matchLibrary("Deadlift (Trap Bar)", L)?.id).toBe("dl-t");
    expect(matchLibrary("Deadlift (Barbell)", L)?.id).toBe("dl-b");
    expect(matchLibrary("Pull Up", L)?.id).toBe("pu"); // plain title is the plain lift, not the assisted sibling
    expect(matchLibrary("Pull Up (Assisted)", L)?.id).toBe("pu-a");
    expect(matchLibrary("Pull Up (Weighted)", L)?.id).toBe("pu");
    expect(matchLibrary("Triceps Pushdown", L)?.id).toBe("tp"); // the standard row, not the "(V Bar)" variant
    expect(matchLibrary("Triceps Pushdown (Cable)", L)?.id).toBe("tp");
    expect(matchLibrary("Goblet Squat (Dumbbell)", L)?.id).toBe("gs-d");
    expect(matchLibrary("Goblet Squat (Kettlebell)", L)?.id).toBe("gs-k");
    expect(matchLibrary("lateral raises machine", L)?.id).toBe("lr-m"); // equipment as a word
    expect(matchLibrary("Dumbbell Row", L)?.id).toBe("dr");
    expect(matchLibrary("Dumbbell Hack Squat", L)).toBeNull();
  });
  it("kettlebell and band brackets name their equipment", () => {
    expect(classifyTitle("Swing (Kettlebell)").equipment).toBe("dumbbell");
    expect(classifyTitle("Curl (Band)").equipment).toBe("cable");
  });
  it("suggests a movement pattern from the name; unknown stays 'other'", () => {
    expect(guessPattern("Bench Press (Barbell)")).toBe("horizontal_push");
    expect(guessPattern("Incline Bench Press (Dumbbell)")).toBe("incline_push");
    expect(guessPattern("Lat Pulldown (Cable)")).toBe("vertical_pull");
    expect(guessPattern("Seated Leg Curl (Machine)")).toBe("knee_flexion");
    expect(guessPattern("Bicep Curl (Cable)")).toBe("elbow_flexion");
    expect(guessPattern("Triceps Pushdown")).toBe("elbow_extension");
    expect(guessPattern("Romanian Deadlift (Dumbbell)")).toBe("hinge");
    expect(guessPattern("Seated Palms Up Wrist Curl")).toBe("other");
    expect(guessPattern("Zercher Thing")).toBe("other");
  });
  it("every title in the real export gets a classification result without throwing", () => {
    const titles = new Set(parseImport(hevyReal).workouts.flatMap((w) => w.exercises.map((e) => e.title)));
    for (const t of titles) {
      expect(typeof guessPattern(t)).toBe("string");
      classifyTitle(t);
    }
  });
});
