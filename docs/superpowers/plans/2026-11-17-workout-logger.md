# Focused Workout Logger Implementation Plan

**Goal:** See the next set, edit it, and log exactly the displayed values.

**Architecture:** Change presentation in the existing logger. Reuse its draft patches, effective row values, persistence, progression and timers. Keep secondary information in existing menus and sheets.

**Tech stack:** React Native, TypeScript, existing i18n/theme components, Vitest and iOS Simulator/Maestro.

**Spec:** User's six-part active workout redesign request, 2026-11-17.

## Constraints and review focus
- Preserve drafts, history, progression, logging, timers, Today Ease In toggle and preview.
- No release build or upload. Preserve unrelated local files; isolated worktree.
- Effective 67.5 kg × 8 must agree between draft row, dock and saved set; invalid input cannot log.
- English/Arabic RTL, both themes, long names, large text and 375 × 667 screen.
- Keyboard must leave the focused input visible; first editable row visible on initial open.

## Tasks
- [ ] Pin draft/dock agreement, removed logger chrome, menu availability and save behavior in focused tests; run red.
- [ ] Compact WorkoutScreen header and move workout details to its menu/sheet. Keep running rest clock visible.
- [ ] Put exercise name/Demo/menu above table; relocate units, Why, next-set details, monthly goal and loads into details sheets. Keep actionable warnings visible; remove warm-up prompt.
- [ ] Slim RackDock to set number, effective values and primary Log set; plate breakdown remains in details. Use live drafts while editing and keyboard-safe layout.
- [ ] Run focused tests, root tests/typecheck and native export. Inspect simulator closed/open keyboard, direct entry and logging, RTL, themes and large text.
- [ ] Read-only review, update PR, wait for CI, merge, update local main without touching unrelated files.
