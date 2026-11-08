# Unconfirmed set with no historical baseline

Native iPhone 17 simulator, iOS 26.3.1, dedicated UUID 211D7C57-B389-48BD-8350-5A2A8B73C892. First-ever squat → save 0 kg × 9. The engine correctly marks this entry unconfirmed, but the UI claimed a recent line of “? for ?” and compared against “usual lifts”. There was no baseline. An unconfirmed row restored without its transient comparison could show the same misleading placeholders.

Use a neutral “Check this set” heading and ask the lifter to check the entered numbers whenever the comparison is unavailable. Keep real baseline comparisons, confirmation/removal controls, and the rule excluding unconfirmed rows from suggestions unchanged. This is empty-state copy only; no engine, validation or persistence changes.

[Before](evidence/ios-2026-11-08/outlier-no-baseline-before.png), [after](evidence/ios-2026-11-08/outlier-no-baseline-after.png): native simulator captures. The original automated input intended 40 but landed as 0; that input anomaly is not diagnosed as an app bug. Native case 91 deliberately enters and verifies 0 to reproduce the warning, verifies the new text/no invented baseline, then corrects to 40 and preserves the manual second-set override.

- Two EN/AR component regressions fail before the fix; after: 53 focused tests pass and workspace typecheck passes. Tests cover absent comparison, absent transient result, and retaining real comparison plus existing actions.
- Native Maestro case 91 passes (29s): warning, correction, immediate hint, manual 42.5 × 10 preserved, explicit Log 1 and Finish → Saved on this phone. SQLite confirms one finished session, exactly 40 × 9 and 42.5 × 10, no ghost third row, schema 20, no FK errors. The separate populated SE data is untouched.
- Native executable remains 5558430; updated JS is embedded with Expo bytecode. No physical-device or distribution verification.
