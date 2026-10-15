# Security and AI safety follow-up

Scope: phase 1 of the follow-up plan, 15 October 2026. Baseline: `d17ecb6`.

## Fixed in source

- Removed OTP codes from email-start HTTP responses. There is no development response-code branch, even on localhost. The retired `DEV_EMAIL_CODES="1"` flag fails closed with 503 before sending/storing a code. Normal email requires a configured provider; recovery-code authentication is unchanged. Tests obtain codes from the injected mock mail transport.
- Both live decision entry points now require observed reps to support an increase. With missing RPE, the previous set must reach at least target maximum + 2 reps. With reported RPE, it must be finite, at least 1 and below 9, and previous reps must reach the target maximum. A decline from the first working set vetoes an increase. Existing symptom stops, available-load checks, 5% ceiling and heavier-candidate inference remain.
- This intentionally tightens the earlier preserved increase policy under the new request for conservative safeguards. It does not remove AI adaptation or change the model or deterministic next-session progression.

## Claims checked against existing code

- Sync already chunks row lookups into 30 pairs and caps pushes at 100 events. Event validation rejects timestamps more than ten minutes ahead of server time; this prevents the audit's year-ahead overwrite scenario. Ordinary clock-based LWW limitations remain. A regression check verifies rejection does not replace an existing row or prevent a later honest write.
- Native SQLite connections already enable foreign keys and WAL.
- Historical set edits/deletes already call planned-target refresh; ML triggers invalidate changed targets and source histories. Existing History and ML evaluation integration tests cover corrections/deletions. This is not proof against every interruption between a history mutation and refresh.
- Backup/restore already uses maintenance transactions and a verified pre-restore safety copy.
- Cloud-account deletion, Strong import, one-tap ghost-set logging and float32 inference handling already exist.

## Validation and limits

Workspace typechecks and the full automated suite pass. iOS JS export passes. No real email, deployed Worker, Xcode build or iPhone interaction is exercised by these checks. The observed-performance thresholds are conservative product rules, not clinical safety guarantees or a calibrated estimate of effort. Missing RPE cannot establish whether a set reached failure.

The Worker must be redeployed and smoke-tested before the OTP fix protects its deployed endpoints. A new iPhone build is needed for the live-increase changes. No database migration is introduced.

## Remaining phases

1. Continue checking reproducible security/data-integrity risks; keep deployment status distinct from merged source.
2. Simplify the active workout hierarchy and move diagnostics, evaluation tools and internal logs into Developer Mode.
3. Improve substitutions, fatigue handling and progression edge cases using concrete examples.
4. Collect voluntary real-session exports, compare on paired sets with repeat/Epley baselines, then decide whether and how to retrain. Keep the model experimental.
5. Record the user's ongoing iPhone testing against the native checklist, then prepare TestFlight/App Store materials and a signed archive. Device tests are not marked passed without results.
