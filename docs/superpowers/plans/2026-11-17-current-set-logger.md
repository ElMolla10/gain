# Current-set workout logger

Goal: log one set with the complete active session one tap away. User's written specification is authoritative.

Architecture: retain repository recommendation/logging and session_exercise mutations. Add a current-set editor inside the existing exercise presentation (Demo, options, warnings and explanations). Replace the dock with one full-width action. Full-screen Workout details uses existing picker and drag reorderer and shows every session exercise/order/progress.

- Add regression tests for durable draft structure/cursor, completed-row selection, manual precedence, duplicate taps and session-only exercise mutations.
- Persist complete draft snapshots and cursor atomically in one setting; restore legacy snapshots. Preserve stable pending IDs and skip already committed sets after recovery.
- Implement focused editor, bodyweight/assisted/time/distance inputs, real comparable Previous including matched imports, compact set navigation and session overview.
- Verify logging/updates, list actions, removal confirmations, restart, imported/missing history, Ease In and exercise types with repository-backed tests.
- Run typecheck/full tests/platform CI; capture native small-phone logger and Workout details in EN/AR, both themes, keyboard. Review, PR, merge on green CI, update local main preserving unrelated files. No release workflow.
