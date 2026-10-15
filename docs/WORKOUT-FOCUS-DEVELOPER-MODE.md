# Phase 2: workout focus and Developer Mode

## Workout experience

- One exercise's current set is emphasized at a time. Focus starts at the first unfinished exercise and follows a tapped exercise header, typed edit or logged set. It advances when that exercise has no unfinished rows. Edited saved sets remain work to finish.
- All exercise rows remain mounted and editable. Focus changes neither reorder nor remove exercises, and do not discard drafts or alter supersets, saves or targets.
- Only the focused exercise shows its normal live AI prompt. The prompt sits immediately before its target row. Stop warnings are exempt from the focus filter and remain visible with their reason, an assertive announcement and no Apply action.
- Live prompts retain the Experimental AI label, suggested load and explicit Apply/Keep actions. Details reveals the estimate, target range, observed basis, reason and missing-feature explanation. Pain/dizziness reporting remains available through the alert button.
- The target line no longer repeats a suggestion already shown in the live prompt, and no longer renders an empty suggestion label.
- Duration and saved-set count remain visible. Volume is under Workout summary; reordering is a quiet action rather than another large button ahead of the logger.

## Developer Mode

Ordinary Settings shows backup, sync and import without an evaluation dashboard or internal log links. Today already places Start/Resume and targets ahead of weekly review and has no evaluation dashboard; that arrangement is retained.

To enable technical tools, open Settings > About and tap the version seven times within five seconds, or touch and hold it. The version also exposes an Enable Developer Mode screen-reader action. A Developer Mode group then contains:

- The switch to turn the mode off.
- ML accuracy, paired baseline reports and manual evaluation export.
- Internal decision history.
- Diagnostics.

The preference defaults off and persists locally in settings. It is excluded from cloud sync. It is a UI preference, not a security/authorization boundary. A failed initial read keeps tools hidden; a failed write preserves the previous mode. Diagnostic and decision-history routes are only registered while enabled. ML tools are not mounted while hidden.

Toggling this mode does not enable/disable AI, change progression, stop local evaluation capture, upload data or delete records. Privacy, cloud-account deletion, normal backup/import and user-facing weight explanations remain available without it. Privacy retains ordinary crash-log enable/disable and clear controls; viewing/exporting technical reports requires Developer Mode. History and Privacy links to technical routes follow the same mode gate.

## Verification

Automated checks cover preference persistence, read/write failures, stale loads, concurrent toggles, subscriptions, unlock timing, hidden tools, retained tool actions, focus advancement, saved-row edits, stop visibility, compact/expanded prompts and input guards.

Native checks remain necessary on the updated iPhone build: keyboard editing without focus loss; logging and correcting a saved set; jumping between exercises and superset members; warning/report delivery; Details and manual Apply; large text and Arabic wrapping; Developer Mode unlock, restart persistence and disable; evaluation export through the iOS share sheet. No native performance or usability measurement is claimed by these code tests.
