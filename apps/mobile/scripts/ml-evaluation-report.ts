/** Recompute one manually exported local evaluation. No inference, training or network access. */
import { readFileSync } from "node:fs";
import { analyzeEvaluation, parseEvaluationExport } from "../src/logic/mlEvaluationAnalysis";
const path = process.argv[2];
if (!path || process.argv.length !== 3) throw new Error("Usage: node --import tsx apps/mobile/scripts/ml-evaluation-report.ts <one-latest-gain-ml-evaluation.json>");
const report = parseEvaluationExport(JSON.parse(readFileSync(path, "utf8")));
const { samples: _samples, ...summary } = report;
process.stdout.write(JSON.stringify({ ...summary, analysis: analyzeEvaluation(report) }, null, 2) + "\n");
