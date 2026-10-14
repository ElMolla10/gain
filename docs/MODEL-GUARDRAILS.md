# Model-layer guardrails (Step 23 seam, code only)

Status: **the legacy next-session advisor seam below remains pure functions plus tests and is not connected to the app.** Separately, the workout logger now runs an experimental offline XGBoost next-set model (`liveAdaptation*.ts`). Its actual safeguards and evaluation are documented in [ML-EVALUATION.md](ML-EVALUATION.md). The table below describes the legacy seam, not the live adapter.

Code: `packages/engine/src/modelGuard.ts` (+ `modelGuard.test.ts`, 17 tests), seam types in `model.ts`.

## Rules, as enforced
| Rule | Where | Test |
| --- | --- | --- |
| Only asked when the rule flagged `needsModel.needed` | `vetModelAdvice`, `adviseWithGuardrails` (advisor is not even called otherwise) | yes |
| Cannot invent history: no comparable history = no advice | `vetModelAdvice` | yes |
| Output is data: fixed rationale keys (`MODEL_RATIONALE_KEYS`), no free text, so no pain/medical advice can be shown | `vetModelAdvice` | yes (prose answer rejected) |
| Load must be a standard step (`isGymLoad`, the default ladder, not a claim about a real gym) and sit within one gym step of the rule's anchor | `vetModelAdvice` | impossible, fractional, negative, NaN, infinite, too far |
| Reps are a whole number inside the lift's rep range | `vetModelAdvice` | yes |
| Rule proposal is never changed; the advisor receives a copy | `adviseWithGuardrails` | tamper test |
| Offline, slow (timeout), throwing or empty model = rule only, silent | `adviseWithGuardrails` | yes |
| Every call produces a log entry `path: "model"` with the verdict; `appliedWithoutTap` is always `false` | `ModelLogEntry` | yes |
| Nothing applies without the lifter's tap | UI rule for whoever connects this; the guard only returns a *second option* | by construction |

## Still open (not in this PR)
Proxy on Workers, key custody, cost cap and kill switch, writing the decision-log row, the UI showing both options, replaying pilot cases, provider and budget. All need Mohamed's decisions or accounts.
