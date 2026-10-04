# Roadmap

The full plan (the "Now" list, the freeze list, the status by screen, numbered steps, gates, decisions, risks) lives in **[MASTER-PLAN.md](MASTER-PLAN.md)**. Start with its "Now" section. What already shipped, release by release (v0.1.0 to v0.20.0), the old milestone map and older test runs are in **[RELEASE-HISTORY.md](RELEASE-HISTORY.md)**.

**Where things stand (2026-10-04, v0.20.0):** GAIN is completely free (see "Free for everyone" in [PRODUCT.md](PRODUCT.md)), Android first, Arabic and English. 20 pre-release APKs exist. Mohamed reports (2026-10-04, **not independently verified**; no results are committed to the repo) that he installed v0.18.0 on his phone, ran the device checks, stored the signing key, approved the pilot templates and thresholds and arranged reviewers and pilot people, and that the Device verified gate passed. v0.19.0 itself has not been reported as run on a device. No new feature work happens until the pilot is validated, except the one template (`ppl_upper_4`) Mohamed explicitly asked for in v0.19.0.

## Now (in this order; all five reported done by Mohamed on 2026-10-04, not independently verified)

1. Install the current signed APK on a real Android phone and complete onboarding, import, log, finish, next target.
2. Verify keyboard, screen lock, rest alerts, force-stop recovery and update-over-install without data loss.
3. Back up the signing key and prove it can be recovered.
4. Review Arabic, TalkBack, large text and the small set of programs offered to pilot users (six proposed from the 47 templates).
5. Run a local-only pilot with retention and usability criteria written first, recording why users override targets.

## Gates

*2026-10-04: G2 and G4 are NOT passed. Pilot materials, a hosted DRAFT privacy/terms/deletion site, a Play build switch and listing-asset drafts now exist; what blocks the gates is people, accounts and a phone. Itemised in MASTER-PLAN section 3 "Gate status".*

| Gate | Means |
| --- | --- |
| **G1. Device verified** | *Reported passed by Mohamed 2026-10-04, not independently verified; no evidence committed.* The core loop and the failure cases work on real Android phones; updates keep all data; the signing key is recoverable. |
| **G2. Pilot ready** | Arabic, TalkBack and large text reviewed; pilot programs chosen; criteria and consent written down; a non-technical person can install from the guide. |
| **G3. Pilot validated** | A six-week, local-only pilot of about 10 lifters at one gym produced a written report that meets (or honestly misses) the criteria set beforehand. |
| **G4. Store ready** | Play account, signed AAB, closed testing, accurate listing and data-safety form, privacy policy at a public URL with legal review. |

Exit criteria and the steps behind each gate: MASTER-PLAN.md section 3. After G4: launch to people Mohamed can reach, then iOS, then post-launch metrics.

## Frozen until the pilot has been validated

New templates, the AI / model layer, billing of any kind (there is none and none is planned), further cosmetic redesigns, library growth beyond 607 exercises, iOS, shared gyms (dropped), email sign-in work (blocked on a provider). Bug fixes found by a device or the pilot, data-safety fixes, accessibility and Arabic corrections, docs and tooling are always allowed.

## Decisions that shape this

- **Sync and sign-in:** optional, off by default, anonymous account + recovery code. Email sign-in is a separate deferred option blocked on an email provider. The pilot does not use sync.
- **Coach links** are built and deployed; shared gyms were dropped.
- **Not planned for the first releases:** chatbot, social feed, wearables, nutrition, video scoring, trainer dashboard, photo progress.
