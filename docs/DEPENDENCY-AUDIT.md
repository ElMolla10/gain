# Dependency audit (2026-10-03, v0.13.0)

`npm audit` on a clean `npm ci` of `main`: **30 findings (1 critical, 17 high, 12 moderate)**; with `--omit=dev` 25 (0 critical, 16 high, 9 moderate). This is a report. **No dependency was changed**: no finding has a safe patch/minor fix (`npm audit fix` only offers to add optional platform binaries to the lockfile, and `--force` proposes a major downgrade of `expo` to 44 and `react-native` to 0.72, which would break the app).

What the findings are (advisory, package, installed, where it runs):
| Advisory | Package (installed) | Runs where | Fix |
| --- | --- | --- | --- |
| Vitest UI server arbitrary file read/exec (critical, GHSA-5xrq-8626-4rwp); @vitest/mocker path traversal (GHSA-82fw-gwwq-j7x9) | vitest 2.1.9 (direct) | Tests on a dev machine and CI only. Needs the Vitest UI/API server listening; we never start it. | Major bump to vitest 3.2.6+ / 4.1.11+ (latest is 5.0.3). Own PR with a full test run. |
| vite path traversal / `server.fs.deny` bypass (GHSA-4w7w-66w2-5vf9, GHSA-fx2h-pf6j-xcff), launch-editor NTLM hash on Windows (GHSA-v6wh-96g9-6wx3); esbuild dev-server request leak (GHSA-67mh-4wv8-2f99) | vite 5.4.21, esbuild 0.21.5 (via vitest) | Dev server only; not used by our tests beyond transform. | Comes with the vitest bump. |
| braces ReDoS-style stack exhaustion (GHSA-vfj7-8cjw-p6xm) | braces 3.0.3 via micromatch, metro | Metro bundler / Expo CLI on the build box, on our own file patterns. | No fixed release exists yet (3.0.3 is the latest). |
| node-forge RSA PKCS#1 v1.5 signature check (GHSA-86w9-cpqp-85rv) | node-forge 1.4.0 via `@expo/code-signing-certificates` | Expo CLI code signing for EAS Updates, which we do not use. | No fixed release exists yet. |
| uuid missing bounds check when a buffer is passed (GHSA-w5hq-g745-h8pq) | uuid 7.0.3 via `xcode` via Expo config plugins | `expo prebuild` only (iOS project editing). | Needs a newer Expo config-plugins chain. |
| The rest (`@expo/*`, `react-native`, `expo-sharing`, `expo-splash-screen`, `metro*`) | Flagged only because they depend on the packages above | Build/dev tooling | Clears when the above clear. |

Reading: every finding is in build-time or test-time tooling. None of the flagged packages is shipped as app code in the APK (the Hermes bundle is our code plus the React Native/Expo runtime), and the Worker (`apps/server`) has no runtime dependencies beyond `@gain/sync`. That is an assessment from the dependency paths, **not** a proof; the advisories on `react-native` and the `expo` family are inherited from the tooling packages listed.

Update (v0.15 fixes): vitest bumped 2.1.x -> 3.2.7 (past the fixed 3.2.6), all four test suites pass unchanged; vitest 4/5 was not attempted. Next steps (nothing urgent): (1) optionally vitest 3 -> current major in its own PR; (2) re-run `npm audit` after each Expo SDK upgrade; (3) do not run `npm audit fix --force`.
