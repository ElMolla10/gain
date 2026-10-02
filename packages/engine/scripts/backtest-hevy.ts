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

const main = results.find((x) => x.r.min === 6)!.res;
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
