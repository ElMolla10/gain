# The six pilot programs and how to show only them

Status: **the six are Mohamed's pick (MASTER-PLAN "Now 4": he reported approving them on 2026-10-04; not independently verified).** They are six of the original 7 templates (the ones a trainer was reported to have liked, on Mohamed's word); none of the 48 templates is formally trainer-reviewed in the repo ([TEMPLATES.md](../TEMPLATES.md)). Arabic names are drafts.

| Template id | Name in the app (English / Arabic draft) | Days/week | Why it is in |
| --- | --- | --- | --- |
| `full_body_2` | Full body, 2 days / جسم كامل، يومين | 2 | Fewest-days case; the pilot requires 2+ days |
| `full_body_3` | Full body, 3 days / جسم كامل، 3 أيام | 3 | The common beginner/returning case |
| `ppl_3` | Push / pull / legs, 3 days / دفع / سحب / أرجل، 3 أيام | 3 | Intermediate lifters who want a 3-day split |
| `upper_lower_4` | Upper / lower, 4 days / علوي / سفلي، 4 أيام | 4 | The most common intermediate split |
| `mix_4` | Four-day mix (body-part split) / مزيج 4 أيام (تقسيم عضلات) | 4 | A body-part split (a different exposure pattern) |
| `ppl_6` | Push / pull / legs, 6 days / دفع / سحب / أرجل، 6 أيام | 6 | Highest frequency; stress-tests short weeks and logging volume |

Left out on purpose: the other 42 (40 unreviewed from v0.14.0, `ppl_upper_4` from v0.19.0 which Mohamed asked for, the home and bulking shapes, the 5x5/3x5 strength shapes). Lifters who already run a program **import** it (Hevy/Strong) instead; that is the main path.

## What a lifter sees, by days per week (first-run setup offers programs for the days they train, never more)
| Days the lifter trains | Offered in the pilot subset |
| --- | --- |
| 1 | none: "build my own" (the pilot asks for 2+ days) |
| 2 | Full body, 2 days |
| 3 | Full body, 3 days; Push / pull / legs, 3 days |
| 4 | Upper / lower, 4 days; Four-day mix |
| 5 | "fewer days" fallback: the 4-day programs above (there is no 5-day pilot program) |
| 6 | Push / pull / legs, 6 days |

## Two ways to keep lifters to the six
1. **Tell them (always works, needs no build).** At setup, the runner says which six to pick from and writes the pick in the pilot sheet. The in-app picker still shows all 48 (the lifter could tap a different one; note it, it is information).
2. **Pilot build (a different APK; added with the v0.20.0 work).** The same app built with the environment variable `GAIN_PILOT_TEMPLATES=1` offers only these six in both first-run setup and Plan > Program details > start a template. Nothing else changes: same package, same signing key, same database, same rules; all 48 templates stay in the code and tests. It is a build-time switch, not a setting: a lifter cannot turn it on or off, and the normal APK is unchanged. Settings shows "Pilot build: 6 programs offered." under the version so the runner can tell the builds apart at a glance. Build and publishing details are in [../PLAY-BUILD.md](../PLAY-BUILD.md) section 3 and [../RELEASE-PROCESS.md](../RELEASE-PROCESS.md).
   - The pilot APK's file name is `gain-pilot-vX.Y.Z-arm64.apk` on purpose: it does **not** match the in-app updater's pattern (`gain-vX.Y.Z...-arm64.apk`), so "Check for updates" never picks it up by accident. Pilot lifters on the pilot build who tap Check for updates are told they are up to date at the same version; when a newer version is released, they get the normal APK, which shows all 48 programs (their existing program is unaffected). If that matters, the runner installs the new pilot APK by hand.
   - A lifter's existing program, history and data are never touched by the filter: it only changes which templates are listed.
   - Not device-verified. Mohamed's G1 run was on v0.18.0; the pilot build has not been installed on any phone.

## Decision for Mohamed
Use way 1 only (no extra file to manage) or way 2 as well (a lifter cannot wander into 42 unreviewed templates). Either is fine for G2; the sheet should say which was used.
