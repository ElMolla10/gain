/** Recompute a manually exported local evaluation. No inference, training or network access. */
import { readFileSync } from "node:fs";
import { buildEvaluationReport, type EvaluationReport } from "../src/logic/mlEvaluationReport";
const path = process.argv[2];
if (!path) throw new Error("Usage: node --import tsx apps/mobile/scripts/ml-evaluation-report.ts <gain-ml-evaluation.json>");
const input = JSON.parse(readFileSync(path, "utf8")) as EvaluationReport;
if (input.format !== "gain-ml-evaluation-v1" || typeof input.modelVersion !== "string" || !Array.isArray(input.samples) || !input.coverage) throw new Error("Not a GAIN evaluation export");
const { samples: _samples, ...summary } = buildEvaluationReport(input.modelVersion, input.samples, input.coverage);
process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
