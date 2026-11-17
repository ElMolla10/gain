# GAIN permanent collection v2

This implements the 21-item collection in the existing compact Cabinet: 15 medal milestones and six lifetime plates. The engine, selectors, localized requirements, and artwork share `collectionCatalog.ts`. Existing awards retain their IDs, anchors, dates, payloads, and original artwork in Legacy awards and the Ledger. No legacy rule is treated as an equivalent new unlock.

## Evidence and migration

- Schema 21 adds a persisted identity-reliability flag and explicit target-version flag through the existing transactional migration/backup path. Native finishes and source-local imported dates are used; missing dates are left missing, with the workout retained.
- A valid one-set workout counts. Dates and weeks accumulate distinctly, including imports. Dedicated uses exact exercise/equipment/setup and distinct dates, with one award per tier.
- PRs use all earlier comparable qualifying workouts, normalized persisted kg loads with 0.01kg tolerance, and Pareto improvement in load and reps/time/distance. Assisted loads reverse direction. A first workout only establishes baselines. Equal repeated candidate sets in one workout yield one event. Valid subsequent PRs remain separate from the First PR medal.
- PR history matches persisted set IDs, including timed sets and timezone changes. V1 PR awards remain legacy; only replay-verified V2 events drive the current verified PR history, preventing duplicate migration entries and weaker V1 tradeoffs appearing as new PRs.
- Explicit target saves retain immutable versions (the existing lift_pin row history), creation/end times, identity, load and reps. The active version at workout start is evaluated against a best established before target creation. Old targets remain ineligible because timestamps alone do not prove intent. Pin writes are atomic.
- Back at It requires 14 completely clear local dates, then two training dates in the inclusive return-date through return-date + 13 window. Evidence identifies the preceding workout, return workout and second workout.
- New award/progress IDs are deterministic, and reconciliation is transactional and repeatable. Launch migration and import refreshes are silent, including progress-to-earned updates. V1 awards cannot trigger new finish celebrations. The first PR does not produce a second notification for its underlying history event.

## Limits

Unstamped local dates cannot be reconstructed reliably; those workouts are retained but cannot earn date-based awards. Generic unresolved custom imports (for example Press) contribute training dates but not exact-variation or PR evidence. Explicit mappings to known variations receive normal credit. V1 target records cannot earn Called It. Target versions continue to use the existing device-local pin storage; backups preserve them, but they are not transferred by the current sync protocol. Synced awards retain their target proof in evidence.

## Artwork

The offline vector renderer preserves the approved family silhouettes, raised metal motifs, restrained lime accents, rim/rank marks, engraved tier numbers, and open plate hubs. Legacy artwork is unchanged. Unknown IDs render no substitute award.

The four PNGs and SVGs here are generated from the same `collectionSvg` source passed to native SvgXml. They are **artwork exports, not simulator screenshots**. The 32px sheet matches the expanded compact Cabinet icon size; 200px provides a larger comparison. Both themes are represented.

Regenerate SVGs: `npm exec -w @gain/mobile -- vite-node scripts/render-collection.ts`. PNGs were rasterized with Sharp outside the app dependency tree.

## Verification

- New engine collection tests cover all plate and medal tiers, short sessions, same-date sessions, week/year boundaries, exact identities, PR comparisons and units, explicit goal timing/versions, comeback endpoints, ambiguous/duplicate imports, and deterministic incremental reconciliation versus replay.
- SQLite tests cover v20 migration retries, legacy retention, silent migration/imports, immutable goal versions, missing-date retention, restart/retry idempotency and incremental/replay evidence equality.
- Cabinet tests exercise every canonical ID at 32px and detail size, both language labels, empty/current plate states, 15/6/21 denominators, legacy artwork and unknown-ID behavior.
- Local typecheck and Android/iOS production JavaScript exports passed. The full local Windows run also exercised all workspaces; platform-specific shell/path tests fail on Windows. Required GitHub Linux CI is the merge gate.
- **Native simulator screenshots and on-device EN/Arabic RTL/theme QA could not be performed on this Windows host: there is no configured Android emulator or iOS Simulator.** No browser preview or artwork export is presented as native evidence. Native typography, SVG behavior, accessibility and RTL therefore remain unverified.

No TestFlight, App Store, EAS, or distribution build is triggered by this work.
