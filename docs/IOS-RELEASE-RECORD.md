# iOS release evidence record

Template — no native result is pre-filled. Complete for one candidate; keep evidence private when it contains fitness data. Source preparation and green CI are not a TestFlight or App Store release.

| Identity | Value |
| --- | --- |
| Source commit / clean or locally changed | TO RECORD |
| Marketing version / upload build number | TO RECORD |
| Bundle ID / team (no credentials) | TO RECORD |
| macOS / Xcode / Node / CocoaPods | TO RECORD |
| iPhone / iOS / previous installed build | TO RECORD |
| Date / tester / language / units / text size | TO RECORD |

| Gate | Result | Evidence / issue |
| --- | --- | --- |
| Local Release archive and archive report | NOT RUN HERE | |
| Xcode signing/provisioning and Validate App | NOT RUN HERE | |
| Archived SDK privacy report | NOT REVIEWED | |
| Upgrade retains existing data | NOT RECORDED | |
| Full focused iPhone checklist | NOT RECORDED | |
| English / Arabic / VoiceOver / large text | NOT RECORDED | |
| Offline interruption / backup / restore / long history | NOT RECORDED | |
| Phase-4 real-workout evaluation | PENDING REAL EXPORTS | |
| Production Worker auth deployment and smoke | NOT VERIFIED | |
| Account deletion incl. coach-link-only account | NOT VERIFIED ON PRODUCTION | |
| Operator / contact / final policy and support URLs | OPEN | |
| Store privacy / age rating / export compliance answers | NOT ENTERED | |
| Real screenshots and localized metadata review | PENDING | |
| App Store Connect processed build identity | NOT UPLOADED HERE | |
| TestFlight install/upgrade and beta feedback | NOT RUN HERE | |
| Apple review and public availability | NOT SUBMITTED HERE | |

Record each blocking failure and its fix/build. Do not replace an unrun result with PASS because a related unit test passed. Do not mark an old native run as evidence for a newly changed build without rerunning affected checks.
