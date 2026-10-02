/* Usage: npx tsx scripts/backtest-hevy.ts [path-to-hevy.csv] [--write docs/BACKTEST-HEVY.md]
 * Runs the rule walk-forward over a Hevy export and prints a markdown report. Local, offline, no network. */
import { readFileSync, writeFileSync } from "node:fs";
import { backtest, summarize, type Outcome } from "../src/backtest";
import { parseHevyCsv } from "../src/hevy";
import { RULE_VERSION } from "../src/version";

const args = process.argv.slice(2);
const wi = args.indexOf("--write");
const outPath = wi >= 0 ? args[wi + 1] : null;
const file = args.find((a, i) => !a.startsWith("--") && i !== wi + 1) ?? new URL("../../../fixtures/hevy-export.csv", import.meta.url).pathname;
const { workouts, warnings, rowCount } = parseHevyCsv(readFileSync(file, "utf8"));

const pct = (a: number, b: number) => (b === 0 ? "n/a" : `${Math.round((a / b) * 100)}%`);
const lines: string[] = [];
const out = (s = "") => lines.push(s);

const dates = workouts.map((w) => w.startTime).sort();
out(`# Backtest of ${RULE_VERSION} on a Hevy export`);
out();
out(`Rows: ${rowCount}, workouts: ${workouts.length}, ${dates[0]?.slice(0, 10)} to ${dates[dates.length - 1]?.slice(0, 10)}. Parser warnings: ${warnings.length}.`);
out();
out("**What this measures:** for each session of a lift, the rule proposes from everything *before* that session; we compare with what the lifter actually did. This is agreement with the lifter, not proof that the rule is right.");
out();
out("**Assumptions (a Hevy export has neither):** the load grid per equipment class is inferred as the greatest common divisor of every logged load in that class; the rep range is a single default per run (sensitivity below); no effort data (RPE is empty), so the effort currency never fires; no rejection history. Compared on the hardest working load of the session and the minimum reps at it; warm-ups are not in the export, drop sets are excluded.");
out();

const ranges = [
  { min: 4, max: 8 },
  { min: 6, max: 10 },
  { min: 8, max: 12 },
  { min: 10, max: 15 },
];
out("## Sensitivity to the assumed rep range");
out();
out("| Range | Proposals | Same load as lifter | Same load and reps | Lifter met or beat it | Proposed heavier than lifter did | Proposed lighter | Baseline: repeat last load |");
out("|---|---|---|---|---|---|---|---|");
const results = ranges.map((r) => ({ r, res: backtest(workouts, { repRange: r, minSessions: 4 }) }));
for (const { r, res } of results) {
  const s = summarize(res.outcomes);
  out(`| ${r.min}-${r.max} | ${s.n} | ${pct(s.loadMatch, s.n)} | ${pct(s.exact, s.n)} | ${pct(s.metOrBeat, s.n)} | ${pct(s.proposedAbove, s.n)} | ${pct(s.proposedBelow, s.n)} | ${pct(s.repeatLoadBaseline, s.n)} |`);
}
out();

out("## Does the load advance as often as the lifter's? (sanity check, not a tuning target)");
out();
out("His history is one lifter's behaviour, not a standard; he may under- or over-progress. This only shows where the evidence-based rule is more conservative or more aggressive than he was.");
out();
out("| Range | Rule proposed a heavier load | Lifter actually went heavier | Rule held/lowered while he went up (rule more conservative) | Rule went up while he held/lowered (rule more aggressive) | Rule proposed lighter | Lifter went lighter |");
out("|---|---|---|---|---|---|---|");
for (const { r, res } of results) {
  const s = summarize(res.outcomes);
  out(`| ${r.min}-${r.max} | ${pct(s.proposedUp, s.n)} | ${pct(s.actualUp, s.n)} | ${pct(s.ruleConservative, s.n)} | ${pct(s.ruleAggressive, s.n)} | ${pct(s.proposedDown, s.n)} | ${pct(s.actualDown, s.n)} |`);
}
out();
out("Reference, rule-v0.1 on the same data (recomputed on main before this change). Same load as lifter: 54% (4-8), 54% (6-10), 42% (8-12), 32% (10-15). Rule proposed a heavier load: 6%, 1%, 0%, 0%. Rule proposed lighter: 3%, 8%, 29%, 48%. Repeat-last-load baseline: 60%.");
out();
out("### Which published trigger? (all use the same policy code; only the trigger differs)");
out();
out("| Preset | Range | Same load as lifter | Rule proposed heavier | Lifter went heavier | Baseline: repeat last load |");
out("|---|---|---|---|---|---|");
for (const preset of [undefined, "double_progression", "acsm_2009", "two_for_two"] as const) {
  for (const r of [ranges[0]!, ranges[1]!, ranges[2]!]) {
    const res = backtest(workouts, { repRange: r, minSessions: 4, progression: preset ? { preset } : undefined });
    const s = summarize(res.outcomes);
    out(`| ${preset ?? "default (2 sessions at top)"} | ${r.min}-${r.max} | ${pct(s.loadMatch, s.n)} | ${pct(s.proposedUp, s.n)} | ${pct(s.actualUp, s.n)} | ${pct(s.repeatLoadBaseline, s.n)} |`);
  }
}
out();

const main = results.find((x) => x.r.min === 6)!.res;
{
  const up = main.outcomes.filter((o) => o.actualDirection === "up" && o.lastReps !== null).map((o) => o.lastReps as number).sort((a, b) => a - b);
  const qq = (f: number) => up[Math.floor((up.length - 1) * f)];
  out("### Reps he had just done before each time he raised the load");
  out();
  out(`${up.length} load increases. Reps (weakest set at his top load, previous session): 10th percentile ${qq(0.1)}, median ${qq(0.5)}, 90th percentile ${qq(0.9)}. If these sit below the top of the assumed range, he progresses load before filling the range, which usually means his real per-lift ranges are lower than the default; the per-lift rep range setting exists for that reason.`);
  out();
}
const allReps = workouts.flatMap((w) => w.exercises.flatMap((e) => e.sets.filter((x) => x.type === "normal" && x.reps !== null).map((x) => x.reps as number))).sort((a, b) => a - b);
const q = (p: number) => allReps[Math.floor((allReps.length - 1) * p)];
out(`## Rep distribution of the logged working sets`);
out();
out(`${allReps.length} sets: 10th percentile ${q(0.1)}, 25th ${q(0.25)}, median ${q(0.5)}, 75th ${q(0.75)}, 90th ${q(0.9)} reps.`);
out();
out("## Inferred load grids (assumption, per equipment class)");
out();
for (const g of main.grids) out(`- ${g.key}: step ${g.increment} kg (from ${g.basedOnLoads} distinct logged loads${g.basedOnLoads < 3 ? "; too few, default 2.5 kg used" : ""})`);
out();
if (main.skipped.length) out(`Skipped (no reps logged): ${main.skipped.map((s) => s.title).join(", ")}.\n`);

out("## By currency spent (range 6-10)");
out();
out("| Currency | Proposals | Same load as lifter | Lifter met or beat it |");
out("|---|---|---|---|");
for (const c of ["reps", "quality", "load", "effort"] as const) {
  const os = main.outcomes.filter((o) => o.currency === c);
  const s = summarize(os);
  out(`| ${c} | ${s.n} | ${pct(s.loadMatch, s.n)} | ${pct(s.metOrBeat, s.n)} |`);
}
out();
out("## By confidence (range 6-10)");
out();
out("| Confidence | Proposals | Same load | Met or beat |");
out("|---|---|---|---|");
for (const c of ["low", "medium", "high"]) {
  const s = summarize(main.outcomes.filter((o) => o.confidence === c));
  out(`| ${c} | ${s.n} | ${pct(s.loadMatch, s.n)} | ${pct(s.metOrBeat, s.n)} |`);
}
out();

out("## Per exercise (range 6-10, lifts with 4+ sessions)");
out();
out("| Exercise | Next sessions checked | Same load | Same load and reps | Met or beat | Proposed heavier | Repeat-last baseline | Last proposal vs what was done |");
out("|---|---|---|---|---|---|---|---|");
const titles = [...new Set(main.outcomes.map((o) => o.title))];
const rows = titles.map((t) => ({ t, os: main.outcomes.filter((o) => o.title === t) })).sort((a, b) => b.os.length - a.os.length);
const fmt = (o: Outcome) => `${o.proposedLoad}x${o.proposedReps} vs ${o.actualLoad}x${o.actualReps}`;
for (const { t, os } of rows) {
  const s = summarize(os);
  const last = os[os.length - 1]!;
  out(`| ${t} | ${s.n} | ${pct(s.loadMatch, s.n)} | ${pct(s.exact, s.n)} | ${pct(s.metOrBeat, s.n)} | ${pct(s.proposedAbove, s.n)} | ${pct(s.repeatLoadBaseline, s.n)} | ${fmt(last)} |`);
}
out();
const text = lines.join("\n") + "\n";
if (outPath) writeFileSync(outPath, text);
else process.stdout.write(text);
