/* Usage: npx tsx scripts/backtest-hevy.ts [path-to-hevy.csv] [--write docs/BACKTEST-HEVY.md]
 * Runs the rule walk-forward over a Hevy export and prints a markdown report. Local, offline, no network. */
import { readFileSync, writeFileSync } from "node:fs";
import { backtest, summarize, type Outcome } from "../src/backtest";
import { classifyLift } from "../src/policy";
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
out("**Assumptions (a Hevy export has neither):** the load grid per equipment class is inferred as the greatest common divisor of every logged load in that class; the top of the rep range is each lift's rep ceiling (10 / 12 / 15, sensitivity below) and the bottom is assumed 6; no effort data (RPE is empty), so the effort currency never fires; no rejection history. Compared on the hardest working load of the session and the minimum reps at it; warm-ups are not in the export, drop sets are excluded.");
out();

const BOTTOM = { min: 6, max: 10 }; // bottom of the range is assumed; the top is replaced by each lift's rep ceiling
const base = backtest(workouts, { repRange: BOTTOM, minSessions: 4 });
const sb = summarize(base.outcomes);
const conv = summarize(backtest(workouts, { repRange: BOTTOM, minSessions: 4, progression: { preset: "coaching_conventions" } }).outcomes);

out(`## Headline: default rule (${RULE_VERSION}) vs "repeat the last load"`);
out();
out("Default = ACSM 2009 (2-10% load step, snapped to real loads) with the lifter's rep ceilings: **10 reps upper body, 12 reps legs, 15 reps lateral raises** (classified from the exercise name). Load goes up only when the weakest working set at the current load reaches the ceiling, once. Until then: one more rep.");
out();
out("| | Same load as lifter | Same load and reps | Lifter met or beat it | Rule proposed heavier | Lifter went heavier | Rule held/lowered while he went up | Rule went up while he held/lowered |");
out("|---|---|---|---|---|---|---|---|");
const row = (label: string, s: ReturnType<typeof summarize>) =>
  `| ${label} | ${pct(s.loadMatch, s.n)} (${s.loadMatch}/${s.n}) | ${pct(s.exact, s.n)} | ${pct(s.metOrBeat, s.n)} | ${pct(s.proposedUp, s.n)} (${s.proposedUp}) | ${pct(s.actualUp, s.n)} (${s.actualUp}) | ${pct(s.ruleConservative, s.n)} | ${pct(s.ruleAggressive, s.n)} |`;
out(row("**Default: ACSM 2009 + ceilings 10 / 12 / 15**", sb));
out(`| **Baseline: repeat last load** | ${pct(sb.repeatLoadBaseline, sb.n)} (${sb.repeatLoadBaseline}/${sb.n}) | n/a | n/a | 0% | ${pct(sb.actualUp, sb.n)} (${sb.actualUp}) | ${pct(sb.actualUp, sb.n)} | 0% |`);
out(row("Reference: opt-in `coaching_conventions` (the earlier rule-v0.2 draft), range 6-10", conv));
out();
out(`Verdict on the one number that matters most: same load as the lifter ${pct(sb.loadMatch, sb.n)} vs ${pct(sb.repeatLoadBaseline, sb.n)} for repeating the last load. ${sb.loadMatch > sb.repeatLoadBaseline ? "The rule beats the baseline." : sb.loadMatch === sb.repeatLoadBaseline ? "A tie." : "The rule does NOT beat the baseline."}`);
out();

const ceilingOf = (title: string) => {
  const c = classifyLift(title);
  return c.lateralRaise ? 15 : c.bodyRegion === "lower" ? 12 : 10;
};
const kindOf = (title: string) => (classifyLift(title).lateralRaise ? "lateral raise (15)" : classifyLift(title).bodyRegion === "lower" ? "legs (12)" : "upper body (10)");
out("## By kind of lift");
out();
out("| Kind (ceiling) | Lifts | Next sessions | Same load as lifter | Baseline: repeat last load | Rule proposed heavier | Lifter went heavier |");
out("|---|---|---|---|---|---|---|");
for (const k of ["upper body (10)", "legs (12)", "lateral raise (15)"]) {
  const os = base.outcomes.filter((o) => kindOf(o.title) === k);
  const t = summarize(os);
  out(`| ${k} | ${new Set(os.map((o) => o.title)).size} | ${t.n} | ${pct(t.loadMatch, t.n)} | ${pct(t.repeatLoadBaseline, t.n)} | ${pct(t.proposedUp, t.n)} (${t.proposedUp}) | ${pct(t.actualUp, t.n)} (${t.actualUp}) |`);
}
out();
out("Classification used (by name): " + [...new Set(base.outcomes.map((o) => o.title))].sort().map((t) => `${t} -> ${ceilingOf(t)}`).join("; ") + ".");
out();

{
  const reached = base.outcomes.filter((o) => o.lastReps !== null && o.lastReps >= ceilingOf(o.title));
  const rUp = reached.filter((o) => o.direction === "up").length;
  const aUp = reached.filter((o) => o.actualDirection === "up").length;
  const notReachedUp = base.outcomes.filter((o) => o.lastReps !== null && o.lastReps < ceilingOf(o.title) && o.actualDirection === "up");
  out("## Did he raise the load when he reached the ceiling?");
  out();
  out(`In ${reached.length} of ${base.outcomes.length} next-sessions his previous session's weakest set had already reached the ceiling. In ${aUp} of those he went heavier next time (${pct(aUp, reached.length)}); the rule proposed heavier in ${rUp} (${pct(rUp, reached.length)}). Where the ceiling had NOT been reached he still went heavier ${notReachedUp.length} times, which is where the rule (correctly, by this instruction) says "one more rep" instead.`);
  {
    const by = (f: (o: Outcome) => boolean) => reached.filter(f).length;
    const heavier = by((o) => o.direction === "up");
    const lowConf = by((o) => o.direction !== "up" && o.confidence === "low");
    const tooBig = by((o) => o.direction !== "up" && o.confidence !== "low" && o.currency === "quality");
    out();
    out(`Why the rule did not propose heavier in the other ${reached.length - heavier}: ${lowConf} had too little history (low confidence repeats, never jumps), ${tooBig} spent a quality change instead (a declined jump or a bodyweight line with no bodyweight; a smallest real step above 10% no longer blocks the load). ${reached.length - heavier - lowConf - tooBig} other.`);
  }
  const up = base.outcomes.filter((o) => o.actualDirection === "up" && o.lastReps !== null);
  const meets = up.filter((o) => o.lastReps! >= ceilingOf(o.title)).length;
  out();
  out(`Of his ${up.length} load increases, ${meets} (${pct(meets, up.length)}) came right after a session at or above the ceiling for that lift; ${up.length - meets} came earlier. Median reps before an increase: ${up.map((o) => o.lastReps as number).sort((x, y) => x - y)[Math.floor((up.length - 1) / 2)]}.`);
  out();
}

out("## Sensitivity: what if the ceilings were different? (app-wide defaults edited)");
out();
out("| Ceilings upper / legs / lateral | Same load as lifter | Rule proposed heavier | Lifter went heavier | Baseline: repeat last load |");
out("|---|---|---|---|---|");
for (const c of [
  { upper: 6, lower: 8, lateral_raise: 10 },
  { upper: 8, lower: 10, lateral_raise: 12 },
  { upper: 10, lower: 12, lateral_raise: 15 },
  { upper: 12, lower: 15, lateral_raise: 20 },
]) {
  const t = summarize(backtest(workouts, { repRange: BOTTOM, minSessions: 4, repCeilings: c }).outcomes);
  out(`| ${c.upper} / ${c.lower} / ${c.lateral_raise}${c.upper === 10 ? " (default)" : ""} | ${pct(t.loadMatch, t.n)} | ${pct(t.proposedUp, t.n)} | ${pct(t.actualUp, t.n)} | ${pct(t.repeatLoadBaseline, t.n)} |`);
}
out();
out("This table is a sanity check on how much the ceilings matter, not a search for better numbers: the ceilings are Mohamed's instruction, not tuned.");
out();
out("### Other triggers on the same ceilings (all use the same policy code; only the trigger differs)");
out();
out("| Preset | Same load as lifter | Rule proposed heavier | Lifter went heavier | Baseline: repeat last load |");
out("|---|---|---|---|---|");
for (const preset of [undefined, "acsm_2009_strict", "two_for_two", "coaching_conventions"] as const) {
  const t = summarize(backtest(workouts, { repRange: BOTTOM, minSessions: 4, progression: preset ? { preset } : undefined }).outcomes);
  out(`| ${preset ?? "acsm_2009 (default)"} | ${pct(t.loadMatch, t.n)} | ${pct(t.proposedUp, t.n)} | ${pct(t.actualUp, t.n)} | ${pct(t.repeatLoadBaseline, t.n)} |`);
}
out();

const results = [{ r: BOTTOM, res: base }];
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

out("## By currency spent (default rule)");
out();
out("| Currency | Proposals | Same load as lifter | Lifter met or beat it |");
out("|---|---|---|---|");
for (const c of ["reps", "quality", "load", "effort"] as const) {
  const os = main.outcomes.filter((o) => o.currency === c);
  const s = summarize(os);
  out(`| ${c} | ${s.n} | ${pct(s.loadMatch, s.n)} | ${pct(s.metOrBeat, s.n)} |`);
}
out();
out("## By confidence (default rule)");
out();
out("| Confidence | Proposals | Same load | Met or beat |");
out("|---|---|---|---|");
for (const c of ["low", "medium", "high"]) {
  const s = summarize(main.outcomes.filter((o) => o.confidence === c));
  out(`| ${c} | ${s.n} | ${pct(s.loadMatch, s.n)} | ${pct(s.metOrBeat, s.n)} |`);
}
out();

out("## Per exercise (default rule, lifts with 4+ sessions)");
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
