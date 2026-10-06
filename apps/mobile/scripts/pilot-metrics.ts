import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { parseBackup } from "../src/logic/backup";
import { agreementTotals, computeLifterMetrics, retention, sheetCsv } from "../src/logic/pilotMetrics";

// npm run pilot-metrics -w @gain/mobile -- [--tz-minutes 180] P01.json P02.json ...   (file name without .json = pilot code)
const args = process.argv.slice(2);
let tz = 0;
const files: string[] = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--tz-minutes") tz = Number(args[++i]);
  else files.push(args[i]!);
}
if (files.length === 0 || !Number.isFinite(tz)) {
  console.error("usage: pilot-metrics [--tz-minutes N] <gain-backup.json>...   (Cairo is 180 in summer time, 120 in winter)");
  process.exit(2);
}
const lifters = files.map((f) => ({ code: basename(f).replace(/\.json$/i, ""), metrics: computeLifterMetrics(parseBackup(readFileSync(f, "utf8"), 1000), { tzMinutes: tz }) }));
process.stdout.write(sheetCsv(lifters));
for (const r of retention(lifters.map((l) => l.metrics))) console.error(`week ${r.week}: retained ${r.retained} of ${r.reached} who reached it`);
const a = agreementTotals(lifters.map((l) => l.metrics));
console.error(`comparable: ${a.comparable} (loaded_same ${a.same}, loaded_more ${a.more}, loaded_less ${a.less})`);
console.error(`both_comparable: ${a.both} (both_app_same ${a.bothAppSame}, both_repeat_same ${a.bothRepeatSame}; newest earlier like-for-like session, same stored load)`);
