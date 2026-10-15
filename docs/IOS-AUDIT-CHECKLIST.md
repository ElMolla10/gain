# iPhone release validation

Status: **NOT RUN on a Mac or iPhone by this workspace.** This is a focused execution sheet, not a passed release gate. Complete it against one source commit after the relevant changes are merged. The broader checklist remains [NATIVE-CHECKLIST.md](NATIVE-CHECKLIST.md).

## Install the local Release build

In the existing Mac checkout, against current main:

```bash
git switch main
git pull --ff-only
scripts/ios-setup.sh --run
```

Connect and unlock the iPhone and use the existing signing team and bundle ID. The helper preserves `.env.ios`, or a single identity in the existing Xcode project; multiple IDs require an explicit `--bundle-id`. A different bundle ID is a separate local app. Export a backup before changing identity or deleting the installed app.

The helper prints the commit/configuration. Release is the default and should run with Metro stopped. `--run --debug` is for development. Signing, installation and native launch have not been performed here. Record the commit because the app version alone may not distinguish these local builds.

## Record the run

- Source commit and app version:
- Mac/macOS, Xcode, Node and CocoaPods versions:
- iPhone model and iOS version:
- Bundle ID and team (no credentials or certificates):
- Previous installed build / fresh install:
- English/Arabic, weight unit and system text size:
- Date, tester and results/screenshots:

## Focused checks

| Check | Expected result | Result |
| --- | --- | --- |
| Upgrade existing install | Existing history remains with the same identity | NOT RUN |
| Launch with Metro stopped | Release opens independently | NOT RUN |
| Quick logging and import-first | Setup writes once; success opens the intended destination | NOT RUN |
| Setup failure and retry | Choices remain; retry succeeds without an unhandled error | NOT RUN; controlled fault injection only |
| Offline log, force-close, resume | Ticked set persists; session resumes; unsaved text is distinguished | NOT RUN |
| Invalid input/saved edit | Invalid text cannot save a ghost number; correction restores logging; finishing warns about abandoned edits | NOT RUN |
| Supersets and reordering | Existing groups/order and set identities stay correct | NOT RUN |
| VoiceOver deletion | Hidden swipe button absent; named Delete invokes confirmation; Cancel preserves set | NOT RUN |
| Inputs and larger text | Context/hints/errors are spoken; rows remain usable with keyboard and large text | NOT RUN |
| Arabic loop | Names/numbers/actions readable in Today, logger, finish, history and errors | NOT RUN; independent wording review needed |
| Background rest alert | Alert works after lock/backgrounding | NOT RUN |
| Hevy/Strong import | Valid dates preserved; impossible rows warn; use a real Strong export | NOT RUN |
| JSON backup/restore | Native save/reopen works; safety copy exists; history/targets recover; shared file has no sync credentials | NOT RUN |
| Rejected backup | Missing core tables or sync bookkeeping refused before replacement | NOT RUN; test copies only |
| Developer Mode | Off by default; version unlock works; mode survives restart and can be disabled; technical routes disappear | NOT RUN on updated build |
| Focus and AI Details | Focus follows edits/completion; no keyboard loss; stop warnings remain visible; Details and manual Apply work in both languages | NOT RUN on updated build |
| Replacement suggestions | Similar choices respect measurement/setup and recorded equipment category; full library remains searchable | NOT RUN on updated build |
| Replacement settings | Today-only/permanent swaps use their own grid/history; reps-to-time/distance gets a sensible range and keeps set count | NOT RUN on updated build |
| Observed fatigue | Same/lighter-load collapse warns without a forecast; deliberately heavier sets and low-rep targets do not get that warning | NOT RUN on updated build |
| Evaluation export | Enable Developer Mode; iOS shares JSON; file replays; edits/skips excluded | NOT RUN |
| History read/page retry | Failure is not empty history; failed page preserves last good page | NOT RUN; controlled read failure needed |

## Delivery still open

The six audit batches and phases 1–4 are merged. The auth fix still needs a verified Worker deployment and smoke check using the existing [script](../apps/server/scripts/deploy.sh). It has not been deployed here.

Phase-5 release preparation is in [IOS-RELEASE.md](IOS-RELEASE.md), with draft metadata and privacy answers. TestFlight/App Store delivery is separate from local installation. Apple account/team setup, signing, a native archive, submission metadata, privacy information and real iPhone screenshots have not been completed here. A JS export or Linux tests do not establish store readiness.

## Phase 4 — real-workout evaluation (NOT RUN for this build)

- [ ] Developer Mode accuracy card counts represented workouts rather than suggesting each set is an independent session; English/Arabic and large text remain readable.
- [ ] Capture a forecast before saving an eligible set; export after confirming it. Recompute the JSON with the offline CLI and verify model/baseline counts match the card.
- [ ] Confirm edits/skips/outlier confirmation and offline force-close/resume retain correct frozen forecasts and current-state exclusions in the export.
- [ ] Share the JSON locally and inspect the exercise/input fields. No upload occurs without the user's chosen share action.
- [ ] With fewer than five grouped paired sessions, offline uncertainty bounds are null. Record real device, OS, build and collection period; synthetic tests do not satisfy this check.
