/** Reproducible MODEL, not observed population data. Run with vite-node --script. */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CATALOG } from "../apps/mobile/src/db/libraryDraft";
import { measureOfKey } from "../apps/mobile/src/db/library/measures";
import source from "../apps/mobile/src/data/fitnessvolt-standards.json";

const output = join(process.cwd(), "apps/mobile/src/data/synthetic-standards");
mkdirSync(output, { recursive: true });
const exact: Record<string, string> = {
  back_squat: "squat", bench_press: "bench-press", deadlift: "deadlift", front_squat: "front-squat",
  sumo_deadlift_barbell: "sumo-deadlift", power_clean_barbell: "power-clean",
  incline_bench_barbell: "incline-bench-press", overhead_press_barbell: "overhead-press",
  push_press_barbell: "push-press", pendlay_row_barbell: "pendlay-row",
};
type Standard = { classes: { kg: number; p50: number }[] };
const tables = source as Record<string, Standard>;
function published(slug: string, sex: "male" | "female") {
  const kg = sex === "male" ? 74 : 63;
  const rows = tables[`${slug}:${sex}`]?.classes ?? [];
  return rows.reduce((best, row) => Math.abs(row.kg - kg) < Math.abs(best.kg - kg) ? row : best, rows[0]!).p50;
}
const bench = { male: published("bench-press", "male"), female: published("bench-press", "female") };
const squat = { male: published("squat", "male"), female: published("squat", "female") };
const deadlift = { male: published("deadlift", "male"), female: published("deadlift", "female") };
const overhead = { male: published("overhead-press", "male"), female: published("overhead-press", "female") };

// Explicit, deliberately broad movement assumptions for lifts without published standards.
// A ratio is a hypothesis, never represented as an observed percentile.
const pattern: Record<string, [typeof bench, number]> = {
  horizontal_push: [bench, 1], incline_push: [bench, .82], vertical_push: [overhead, 1],
  squat: [squat, 1], hinge: [deadlift, 1], horizontal_pull: [bench, .95], vertical_pull: [bench, .9],
  elbow_flexion: [bench, .43], elbow_extension: [bench, .45], shoulder_isolation: [overhead, .38],
  rear_delt: [overhead, .43], knee_extension: [squat, .55], knee_flexion: [squat, .38],
  calf: [squat, .65], other: [bench, .65],
};
const gear: Record<string, number> = {
  barbell: 1, ez_bar: .82, trap_bar: 1.15, dumbbell: .46, kettlebell: .43,
  cable: .7, machine: .9, plate_loaded: 1.05, smith: 1, band: .65,
};
function adultAgeFactor(age: number) {
  if (age < 25) return .9 + (age - 18) * .1 / 7;
  if (age <= 40) return 1;
  return Math.max(.48, 1 - (age - 40) * .008);
}
function youthAgeFactor(age: number) {
  // Separate youth class; no adult standards or observed youth percentiles are implied.
  return .5 + (age - 12) * .075;
}
const manifest = { version: 1, type: "synthetic_model", ages: [12, 100],
  ageClasses: { youth: [12, 17], adult: [18, 100] }, reference: { male: { bodyweightKg: 74, heightCm: 175 }, female: { bodyweightKg: 63, heightCm: 162 } },
  bodyweightExponent: .2, heightExponent: .08, source: "FitnessVolt gym p50 for ten exact barbell lifts; other lifts use GAIN movement and equipment hypotheses.",
  sourceUrl: "https://fitnessvolt.com/strength-standards/strength-data/", sourceSnapshot: "2026-10-15",
  model: "baseline = age-file-sex-median * (bodyweight/reference-bodyweight)^0.2 * (height/reference-height)^0.08; index = clamp(round(500 + 250*log2(best-estimated-1RM/baseline)),0,1000)",
  ageAssumptions: "Youth ages 12–17: factors 0.50 to 0.875 of adult reference; adult ages 18–24: 0.90 to 0.986; 25–40: 1.0; 41–100: declines 0.008 per year to 0.52. These are product hypotheses, not measured age effects.",
  bodyweightModel: "Unweighted reps and holds use independent synthetic reps/seconds baselines scaled by sqrt(age-factor), inverse bodyweight^0.2 and inverse height^0.08. Weighted vertical pulls and dips use (bodyweight+added-load) estimated 1RM for 1–10 reps; other loaded bodyweight variations are withheld. Metrics remain separate.",
  limitation: "Synthetic estimates are not measured population percentiles. Bodyweight and height are evaluated continuously, not stored as bins. Bands lack a calibrated resistance measurement and are withheld." };
writeFileSync(join(output, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
const exercises = [...new Map(CATALOG.map(x => [x.key, x])).values()].sort((a, b) => a.key.localeCompare(b.key));
const coverage: Record<string, string> = {};
function bodyweightBaseline(item: typeof exercises[number]) {
  const seconds = measureOfKey(item.key) === "time";
  let male = seconds ? 45 : item.pattern === "vertical_pull" ? 8 : /dip/i.test(item.en) ? 10 : /push.up/i.test(item.en) ? 20 : item.pattern === "squat" ? 35 : 25;
  let female = seconds ? 35 : item.pattern === "vertical_pull" ? 3 : /dip/i.test(item.en) ? 4 : /push.up/i.test(item.en) ? 10 : item.pattern === "squat" ? 30 : 20;
  if (/dead hang/i.test(item.en)) { male = 35; female = 25; }
  if (/l.sit/i.test(item.en)) { male = 15; female = 10; }
  let multiplier = 1;
  if (/knee push|incline push/i.test(item.en)) multiplier = 1.5;
  if (/archer|pistol|one.arm|single.arm|handstand push/i.test(item.en)) multiplier = .35;
  else if (/pike|clap|towel|ring|decline push|copenhagen/i.test(item.en)) multiplier = .7;
  return { male: male * multiplier, female: female * multiplier, metric: seconds ? "seconds" : "reps",
    weightedEligible: !seconds && (item.pattern === "vertical_pull" || /dip/i.test(item.en)) && !/bench dip/i.test(item.en) };
}
for (let age = 12; age <= 100; age++) {
  const factor = age <= 17 ? youthAgeFactor(age) : adultAgeFactor(age);
  const values: Record<string, { male: number; female: number; basis: "published_anchor" | "synthetic_estimate"; metric: string; weightedEligible?: boolean } | null> = {};
  for (const item of exercises) {
    const measure = measureOfKey(item.key);
    if (item.gear === "assisted" && measure === "reps") {
      const bw = bodyweightBaseline(item);
      values[item.key] = { male: Math.round(bw.male * Math.sqrt(factor) * 10) / 10,
        female: Math.round(bw.female * Math.sqrt(factor) * 10) / 10,
        basis: "synthetic_estimate", metric: "assisted" };
      coverage[item.key] = "assisted";
      continue;
    }
    if (measure === "distance" && item.gear !== "band") {
      values[item.key] = { male: Math.round(30 * Math.sqrt(factor) * 10) / 10,
        female: Math.round(25 * Math.sqrt(factor) * 10) / 10,
        basis: "synthetic_estimate", metric: "carry" };
      coverage[item.key] = "carry";
      continue;
    }
    if (item.key === "weighted_plank") {
      values[item.key] = { male: Math.round(45 * Math.sqrt(factor) * 10) / 10,
        female: Math.round(35 * Math.sqrt(factor) * 10) / 10,
        basis: "synthetic_estimate", metric: "weighted_hold" };
      coverage[item.key] = "weighted_hold";
      continue;
    }
    if (["bodyweight", "suspension"].includes(item.gear) && measureOfKey(item.key) !== "distance") {
      const bw = bodyweightBaseline(item);
      values[item.key] = { male: Math.round(bw.male * Math.sqrt(factor) * 10) / 10,
        female: Math.round(bw.female * Math.sqrt(factor) * 10) / 10,
        basis: "synthetic_estimate", metric: bw.metric, weightedEligible: bw.weightedEligible };
      coverage[item.key] = bw.metric === "seconds" ? "bodyweight_seconds" : "bodyweight_reps";
      continue;
    }
    const eligible = measureOfKey(item.key) === "reps" && !["bodyweight", "suspension", "assisted", "band"].includes(item.gear)
      && item.setup === "free" && (item.key === "crunch_machine" || !/^(plank|crunch|sit.up|push.up|pull.up|chin.up|burpee|air.squat)/i.test(item.en));
    const anchor = exact[item.key];
    const base = pattern[item.pattern] ?? [bench, .65];
    const equipmentFactor = gear[item.gear];
    if (!eligible || !equipmentFactor) { values[item.key] = null; coverage[item.key] = "no_loaded_1rm"; continue; }
    const basis = anchor && age >= 18 ? "published_anchor" : "synthetic_estimate";
    coverage[item.key] = basis;
    values[item.key] = {
      male: Math.round((anchor ? published(anchor, "male") : base[0].male * base[1] * equipmentFactor) * factor * 10) / 10,
      female: Math.round((anchor ? published(anchor, "female") : base[0].female * base[1] * equipmentFactor) * factor * 10) / 10,
      basis, metric: "load",
    };
  }
  // Shared metadata plus aligned arrays avoid repeating 607 names/units/provenance fields in all 89 files.
  if (age === 30) writeFileSync(join(output, "exercises.json"), JSON.stringify(Object.entries(values).map(([key, row]) => ({ key, metric: row?.metric ?? null, basis: row?.basis ?? null, weightedEligible: row?.weightedEligible ?? false }))) + "\n");
  writeFileSync(join(output, `age-${age}.json`), JSON.stringify({ age, ageClass: age <= 17 ? "youth" : "adult",
    male: Object.values(values).map(row => row?.male ?? null), female: Object.values(values).map(row => row?.female ?? null) }) + "\n");
}
writeFileSync(join(output, "coverage.json"), JSON.stringify(coverage, null, 2) + "\n");
writeFileSync(join(output, "index.ts"),
  `// Generated by scripts/generate-synthetic-standards.ts. Do not edit.\n` +
  `// Static requires let Metro package every age while only evaluating the selected age's data.\n` +
  `export const AGE_STANDARD_LOADERS = [\n${Array.from({ length: 89 }, (_, i) => `  () => require("./age-${i + 12}.json"),`).join("\n")}\n] as const;\n`,
);
console.log(`Generated 89 age files for ${exercises.length} exercises. Coverage: ${JSON.stringify(Object.values(coverage).reduce((counts, value) => ({ ...counts, [value]: (counts[value] ?? 0) + 1 }), {} as Record<string, number>))}`);
