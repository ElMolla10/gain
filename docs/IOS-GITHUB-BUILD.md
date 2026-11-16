# Build GAIN for TestFlight on GitHub Actions

The Expo Free plan's iOS cloud builds are used up until 1 December. [`.github/workflows/ios-testflight.yml`](../.github/workflows/ios-testflight.yml) builds the app on a GitHub-hosted `macos-26` runner and uploads the `.ipa` to App Store Connect / TestFlight. This public repo's GitHub-hosted macOS minutes are free, and the build does not use Expo build credits.

Signing still uses the EAS-managed distribution certificate and provisioning profile. `eas build --local` downloads them with `EXPO_TOKEN` ([local builds](https://docs.expo.dev/build-reference/local-builds/)). The App Store Connect API key is passed with the `EXPO_ASC_*` variables EAS reads ([CI builds](https://docs.expo.dev/build/building-on-ci/), [iOS submit](https://docs.expo.dev/submit/ios/)).

The workflow runs only from the Actions tab (`workflow_dispatch`). It does not run on push or pull_request, so a fork cannot start an upload. The job uses the GitHub environment `app-store`. Only secrets on that environment are visible. Repository secrets are not.

## Secrets

In the repo: Settings → Environments → New environment → name it `app-store` → Environment secrets.

| Name | Required | Where to get it |
| --- | --- | --- |
| `EXPO_TOKEN` | yes | An Expo access token for the `mo_ehab10` account. [expo.dev access tokens](https://expo.dev/accounts/mo_ehab10/settings/access-tokens) ([programmatic access](https://docs.expo.dev/accounts/programmatic-access/)). |
| `EXPO_ASC_API_KEY_P8` | yes | The App Store Connect API key `.p8`. App Store Connect → Users and Access → Integrations → App Store Connect API → Team Keys → Generate. Role: App Manager (or Admin). Apple lets you download the `.p8` once. Paste the file, including the `BEGIN PRIVATE KEY` / `END PRIVATE KEY` lines, or paste base64 of the file (`base64 -i AuthKey_XXXXXXXXXX.p8` on a Mac, `base64 -w0 AuthKey_XXXXXXXXXX.p8` on Linux). The workflow writes this to a temp file and sets `EXPO_ASC_API_KEY_PATH`, which is the variable EAS reads. |
| `EXPO_ASC_KEY_ID` | yes | The Key ID in that keys table (10 characters, also the middle of `AuthKey_<KeyID>.p8`). |
| `EXPO_ASC_ISSUER_ID` | yes | The Issuer ID at the top of the App Store Connect API page. |
| `EXPO_APPLE_TEAM_ID` | yes | [developer.apple.com/account](https://developer.apple.com/account) → Membership details → Team ID. Current EAS CLI prompts for the team when `EXPO_ASC_API_KEY_PATH`, `EXPO_ASC_KEY_ID`, and `EXPO_ASC_ISSUER_ID` are set. The workflow passes it so credential validation can run non-interactively ([CI docs](https://docs.expo.dev/build/building-on-ci/#optional-provide-an-asc-api-token-for-your-apple-team)). |
| `EXPO_APPLE_TEAM_TYPE` | no | Leave unset for a normal App Store team. Set `IN_HOUSE` only for an Enterprise Program team. The other accepted values are `INDIVIDUAL` and `COMPANY_OR_ORGANIZATION`. |

Do not commit the `.p8`. `*.p8` is already gitignored. `eas.json` keeps only the public `ascAppId` (`6827498090`).

## Run it

1. Open the Actions tab → **iOS TestFlight** → **Run workflow**.
2. Choose the branch to build (usually `main`).
3. Leave **Build the IPA and skip the App Store Connect / TestFlight upload** unchecked to upload. Check it to stop after the `.ipa`.
4. The `.ipa` is the `gain-ios` artifact, kept for 14 days, including when the upload runs.

A second run waits until the first finishes, so two builds cannot increment the remote build number together. The job stops after 180 minutes.

From `apps/mobile` the workflow runs:

```bash
eas build -p ios --profile testflight-live --local --non-interactive --output build/gain.ipa
eas submit -p ios --profile testflight-live --path build/gain.ipa --non-interactive
```

`testflight-live` extends `production` and sets `GAIN_IOS_LIVE_ACTIVITY=1` and `GAIN_IOS_APP_GROUP=group.com.mohamedelmolla.gain`. Do not switch this workflow to the plain `production` profile.

`eas submit` uploads to TestFlight. It does not submit the app for App Review. Apple still has to process the build (usually 10–15 minutes) before it appears in TestFlight.

## Build number

Do not change `ios.buildNumber` in `apps/mobile/app.json`. `eas.json` sets `cli.appVersionSource` to `remote`, and `production` (which `testflight-live` extends) sets `autoIncrement` to `true`. EAS stores the iOS build number and increments it on this build. The next number should be 42. The workflow does not set `GAIN_IOS_BUILD_NUMBER`.

## Runner

Checked against the [macos-26 image readme](https://github.com/actions/runner-images/blob/main/images/macos/macos-26-Readme.md) on 2026-11-16 (image `20260824.0517.1`):

| | |
| --- | --- |
| Xcode on the image | 26.0.1, 26.1.1, 26.2, 26.3, 26.4.1, 26.5, 26.6 (default) |
| Selected | 26.4.1 at `/Applications/Xcode_26.4.1.app`, via `xcode-select` |
| Why 26.4.1 | Expo SDK 57 needs [Xcode 26.4+](https://docs.expo.dev/versions/v57.0.0/). App Store Connect currently accepts Xcode 26 or later. Xcode 27 is not selected: the iOS 27 SDK needs the scene lifecycle, which this profile does not enable. Xcode 27 becomes an upload requirement in April 2027. |
| Fastlane / CocoaPods | 2.238.0 and 1.17.0 are preinstalled. The workflow installs with Homebrew only if one is missing (`brew install cocoapods`, as in `scripts/ios-setup.sh`). |
| Node and packages | Node 22 (`actions/setup-node`), then `npm ci` at the repo root (`package-lock.json`, npm workspaces). |

This workflow cannot be dry-run from a machine that does not have the `app-store` secrets.
