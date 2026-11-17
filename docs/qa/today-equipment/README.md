# Today equipment visual verification

Captured from the running full GAIN app in local Chrome at **393 x 852 CSS pixels, 2x scale** on 2026-11-17. These are phone-size **web app** captures, not native simulator captures. Real app SQLite data and the normal Today screen were used, with isolated synthetic programme/target fixtures. A temporary development-only service handle and temporary Metro web configuration were removed after capture. Neither is included in the change. Dependencies were restored with `npm ci`.

| Check | Evidence |
| --- | --- |
| Lateral Raise 10 kg x 11, per-dumbbell value | [English dark](dumbbells-en-dark.png) |
| Fractional 12.5 kg, stamp and per-dumbbell caption | [English light](dumbbells-fraction-light.png) |
| Machine Chest Press 70 kg x 10, unknown stack | [English dark](machine-en-dark.png) |
| Seated Leg Curl 47.5 kg x 10, unknown stack | [English light](leg-curl-en-light.png) |
| Dumbbell stamp remains readable and unmirrored | [Arabic RTL light](dumbbells-ar-light.png) |
| Stack numeral remains readable and unmirrored | [Arabic RTL dark](machine-ar-dark.png) |
| Units agree: 12.5 kg displays as 27.6 lb | [English dark pounds](dumbbells-lb.png) |
| Missing load produces unnumbered art | [Missing machine target](machine-missing.png) |
| Explicit rungs [10, 20, 30, 47.5, 60], fourth hole | [Configured machine](machine-configured.png) |

Compared at phone size with the two supplied equipment mockups: both dumbbells remain recognizable, with separate knurled handles and a readable front stamp. The machine retains dark beveled plates, two reflective rods, a lime selector and short coiled tether. In an unknown configuration the selector/target sit beside the stack rather than pretending to select a hole. The existing Today composition and barbell renderer remain in place.

A live Ease In checkbox toggle retained the same resolved 12.5 target/stamp and 132 dp art height. Today currently changes the planned set count for Ease In; it does not independently reduce the displayed target load. The illustration consumes that existing resolved target and does not introduce another recommendation. The test also passes a reduced resolved target and confirms the stamp follows it.

The automated equipment tests cover fractional loads, kg/lb consistency, missing targets before gym metadata arrives, configured/off-grid/over-maximum holes, explicit machine kind, assistance, single-object holds, fixed art frames, and unmirrored Arabic numerals. Existing Today and accessibility tests are included in verification.

Native rendering, real-device image decoding/cache behaviour, and native animation frame continuity could not be verified. Automatic approval review rejected isolated emulator startup with a policy rejection. The connected Browser tool required reauthentication; local Chrome automation was used for the web captures instead. No native QA result is claimed.

Test results and CI links are recorded in the pull request. No release was triggered.

Local checks:

- `npm ci`: passed; temporary web-only dependencies are absent from the lockfile and delivered dependency list.
- `npm run typecheck`: all workspaces passed.
- Focused mobile suite (`todayEquipment`, `todayBar`, `todayHero`, `todayLayout`, `gymStepPreset`, `a11yQa`): 71 tests passed.
- `npm run export:android -w @gain/mobile` and `npm run export:ios -w @gain/mobile`: passed; both cutouts appear in each exported asset list.
- Full `npm test` on Windows: engine 695, sync 20 and server 98 tests passed; mobile 2,157 passed and 17 failed. Failures concern Unix shell helpers, slash-sensitive source checks, Windows SQLite cleanup locks, and CRLF review-sheet comparison. None is bypassed. Linux CI must pass before merging. The additional timed-stack regression is included in the focused run and CI.
