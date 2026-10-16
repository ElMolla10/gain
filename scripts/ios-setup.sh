#!/usr/bin/env bash
# GAIN iOS setup helper. macOS only. Safe to run again (every 7 days on the free route, or after pulling new code).
#
#   scripts/ios-setup.sh                 check the Mac, install packages, generate the iOS project, print what to do next
#   scripts/ios-setup.sh --check         only check the Mac (changes nothing)
#   scripts/ios-setup.sh --run           ... and then build and install on the iPhone (standalone Release build)
#   scripts/ios-setup.sh --archive ~/GAIN-2.xcarchive --build-number 2   local Release archive; never uploads
#   scripts/ios-setup.sh --run --debug   explicit debug build (requires Metro)
#   scripts/ios-setup.sh --bundle-id com.yourname.gain --team-id ABCDE12345
#
# What it does: checks Xcode, Node, CocoaPods; npm ci (only when needed); npx expo prebuild --platform ios (makes apps/mobile/ios,
# which git ignores; the folder is rebuilt from scratch every time, so it is always in step with the code).
# --run invokes Expo/Xcode to build, sign and install locally. It never uploads to TestFlight/App Store. Full guide: docs/IOS.md.
# NOT tested on a Mac: this was written and syntax-checked on Linux (bash -n, shellcheck, and a run with stand-in tools).
set -euo pipefail

CHECK_ONLY=0
RUN_AFTER=0
CONFIGURATION=Release
ARCHIVE_PATH=""
BUILD_NUMBER="${GAIN_IOS_BUILD_NUMBER:-}"
BUNDLE_ID="${GAIN_IOS_BUNDLE_ID:-}"
TEAM_ID="${GAIN_IOS_TEAM_ID:-}"
MIN_XCODE="26.4" # Expo SDK 57 needs Xcode 26.4 or newer (docs.expo.dev/versions/v57.0.0)
MIN_NODE_MAJOR=22

usage() { sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'; }
say() { printf '%s\n' "$*"; }
ok() { printf '  OK    %s\n' "$*"; }
warn() { printf '  WARN  %s\n' "$*"; }
bad() { printf '  FIX   %s\n' "$*"; PROBLEMS=$((PROBLEMS + 1)); }
PROBLEMS=0

while [ $# -gt 0 ]; do
  case "$1" in
    --check) CHECK_ONLY=1 ;;
    --run) RUN_AFTER=1 ;;
    --debug) CONFIGURATION=Debug ;;
    --archive|--build-number|--bundle-id|--team-id)
      if [ $# -lt 2 ] || [ -z "${2:-}" ] || [[ "${2:-}" = --* ]]; then
        say "Missing value for $1"; exit 2
      fi
      case "$1" in
        --archive) ARCHIVE_PATH="$2" ;;
        --build-number) BUILD_NUMBER="$2" ;;
        --bundle-id) BUNDLE_ID="$2" ;;
        --team-id) TEAM_ID="$2" ;;
      esac
      shift ;;

    -h | --help) usage; exit 0 ;;
    *) say "Unknown option: $1"; usage; exit 2 ;;
  esac
  shift
done

if [ -n "$BUILD_NUMBER" ] && ! printf '%s' "$BUILD_NUMBER" | grep -Eq '^[1-9][0-9]{0,3}$'; then
  say "Build number must be an integer from 1 through 9999."; exit 2
fi
if [ -n "$ARCHIVE_PATH" ]; then
  if [ "$RUN_AFTER" -eq 1 ] || [ "$CHECK_ONLY" -eq 1 ] || [ "$CONFIGURATION" != Release ]; then
    say "--archive requires Release and cannot combine with --run, --debug or --check."; exit 2
  fi
  [ -n "$BUILD_NUMBER" ] || { say "--archive requires an explicit --build-number (or GAIN_IOS_BUILD_NUMBER)."; exit 2; }
  [[ "$ARCHIVE_PATH" = /* ]] || ARCHIVE_PATH="$PWD/$ARCHIVE_PATH"
  [[ "$ARCHIVE_PATH" = *.xcarchive ]] || { say "Archive path must end in .xcarchive."; exit 2; }
  [ ! -e "$ARCHIVE_PATH" ] || { say "Archive already exists; choose a new path to preserve it."; exit 2; }
fi

if [ "$(uname -s)" != "Darwin" ]; then
  say "This script is for a Mac. iOS apps can only be built with Xcode on macOS."
  say "On Linux you can still check the config: cd apps/mobile && npx expo prebuild --platform ios --no-install"
  exit 1
fi

# version_ge A B: true when version A >= version B (dotted numbers)
version_ge() {
  local IFS=.
  # shellcheck disable=SC2206
  local a=($1) b=($2) i x y
  for i in 0 1 2; do
    x="${a[$i]:-0}"
    y="${b[$i]:-0}"
    if [ "$x" -gt "$y" ]; then return 0; fi
    if [ "$x" -lt "$y" ]; then return 1; fi
  done
  return 0
}

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOBILE="$REPO/apps/mobile"
SAVED="$MOBILE/.env.ios" # git ignores .env.*; remembers your choices so the next run needs no typing
[ -f "$MOBILE/app.json" ] || { say "Cannot find apps/mobile/app.json. Run this from inside the gain folder."; exit 1; }

say "GAIN iOS setup ($REPO)"
say "Source commit: $(git -C "$REPO" rev-parse --short HEAD 2>/dev/null || echo unknown); build configuration: $CONFIGURATION"
say ""
say "1. Checking this Mac"

macos="$(sw_vers -productVersion 2>/dev/null || echo unknown)"
ok "macOS $macos"

XCODE_MAJOR=0
if command -v xcodebuild >/dev/null 2>&1 && xcodebuild -version >/dev/null 2>&1; then
  xv="$(xcodebuild -version 2>/dev/null | awk '/^Xcode/ {print $2; exit}')"
  XCODE_MAJOR="${xv%%.*}"
  if [ -n "$xv" ] && version_ge "$xv" "$MIN_XCODE"; then
    ok "Xcode $xv"
  else
    bad "Xcode ${xv:-unknown} is older than $MIN_XCODE. Update Xcode in the App Store (this may need a newer macOS first)."
  fi
  if ! xcodebuild -license check >/dev/null 2>&1; then
    bad "Xcode's license is not accepted yet. Run: sudo xcodebuild -license accept   (or open Xcode once and click Agree)"
  fi
  sel="$(xcode-select -p 2>/dev/null || true)"
  case "$sel" in
    *Xcode*.app*) ok "Command line tools point at $sel" ;;
    *) bad "xcode-select points at '$sel'. Run: sudo xcode-select -s /Applications/Xcode.app/Contents/Developer" ;;
  esac
else
  bad "Xcode is not installed (or only the small Command Line Tools are). Install Xcode from the Mac App Store, open it once, let it finish 'Installing components', then run this again."
fi

if command -v node >/dev/null 2>&1; then
  nv="$(node -p 'process.versions.node')"
  if [ "${nv%%.*}" -ge "$MIN_NODE_MAJOR" ]; then ok "Node $nv"; else bad "Node $nv is too old (need $MIN_NODE_MAJOR or newer). Install Node from nodejs.org, or: brew install node"; fi
else
  bad "Node is not installed. Install it from nodejs.org (LTS), or: brew install node"
fi
if command -v git >/dev/null 2>&1; then ok "git"; else bad "git is missing. Run: xcode-select --install"; fi
if command -v pod >/dev/null 2>&1; then
  ok "CocoaPods $(pod --version 2>/dev/null || echo '?')"
else
  bad "CocoaPods is missing. Run: brew install cocoapods   (no Homebrew? see docs/IOS.md, 'CocoaPods and Ruby')"
fi
command -v watchman >/dev/null 2>&1 || warn "watchman not found. Optional, only speeds up the dev server: brew install watchman"

if [ "$XCODE_MAJOR" -ge 27 ] && [ "${GAIN_IOS_SCENES:-}" != "1" ]; then
  warn "Xcode $XCODE_MAJOR uses the iOS 27 SDK, which needs the scene lifecycle. Turning on GAIN_IOS_SCENES=1 for this run (see docs/IOS.md)."
  export GAIN_IOS_SCENES=1
fi

if [ "$PROBLEMS" -gt 0 ]; then
  say ""
  say "$PROBLEMS thing(s) to fix above (lines marked FIX). Fix them and run this script again."
  exit 1
fi
if [ "$CHECK_ONLY" -eq 1 ]; then
  say ""
  say "Everything needed is installed. Run this script without --check to continue."
  exit 0
fi

say ""
say "2. Your bundle id and team"
# shellcheck disable=SC1090
if [ -f "$SAVED" ]; then . "$SAVED"; [ -n "$BUNDLE_ID" ] || BUNDLE_ID="${GAIN_IOS_BUNDLE_ID:-}"; [ -n "$TEAM_ID" ] || TEAM_ID="${GAIN_IOS_TEAM_ID:-}"; fi
# A manually installed app may have an identity in Xcode but no .env.ios yet.
# Preserve it rather than choosing a second app with an empty local database.
PROJECT="$MOBILE/ios/GAIN.xcodeproj/project.pbxproj"
if [ -f "$PROJECT" ]; then
  if [ -z "$BUNDLE_ID" ]; then
    existing=$(sed -nE 's/^[[:space:]]*PRODUCT_BUNDLE_IDENTIFIER = "?([A-Za-z0-9.-]+)"?;.*/\1/p' "$PROJECT" | sort -u)
    if [ "$(printf '%s\n' "$existing" | sed '/^$/d' | wc -l | tr -d ' ')" -gt 1 ]; then
      say "The Xcode project has multiple bundle ids. Pass --bundle-id with the id of your installed GAIN app."
      exit 1
    fi
    BUNDLE_ID="$existing"
  fi
  if [ -z "$TEAM_ID" ]; then
    existing_team=$(sed -nE 's/^[[:space:]]*DEVELOPMENT_TEAM = "?([A-Z0-9]{10})"?;.*/\1/p' "$PROJECT" | sort -u)
    if [ "$(printf '%s\n' "$existing_team" | sed '/^$/d' | wc -l | tr -d ' ')" -eq 1 ]; then TEAM_ID="$existing_team"; fi
  fi
fi
if [ -z "$BUNDLE_ID" ]; then
  who="$(id -un | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9')"
  suggestion="com.${who:-me}.gain"
  if [ -t 0 ]; then
    printf '  Apple only lets one team own a bundle id, and app.gain.mobile may not be yours. Pick your own.\n  Bundle id [%s]: ' "$suggestion"
    read -r BUNDLE_ID || BUNDLE_ID=""
  fi
  BUNDLE_ID="${BUNDLE_ID:-$suggestion}"
fi
if ! printf '%s' "$BUNDLE_ID" | grep -Eq '^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$'; then
  say "  '$BUNDLE_ID' is not a valid bundle id (letters, digits, hyphens and dots, like com.yourname.gain)."
  exit 1
fi
if [ -n "$TEAM_ID" ] && ! printf '%s' "$TEAM_ID" | grep -Eq '^[A-Z0-9]{10}$'; then
  say "  '$TEAM_ID' is not a Team ID (10 capital letters and digits). Leave it out and choose the team in Xcode instead."
  exit 1
fi
if [ -n "$ARCHIVE_PATH" ] && [ -z "$TEAM_ID" ]; then
  say "An archive requires a signing team. Pass --team-id or select/save your team first."; exit 2
fi
{
  echo "GAIN_IOS_BUNDLE_ID=$BUNDLE_ID"
  [ -z "$TEAM_ID" ] || echo "GAIN_IOS_TEAM_ID=$TEAM_ID"
} >"$SAVED"
ok "bundle id $BUNDLE_ID${TEAM_ID:+, team $TEAM_ID} (saved in apps/mobile/.env.ios, which git ignores)"
export GAIN_IOS_BUNDLE_ID="$BUNDLE_ID"
[ -z "$TEAM_ID" ] || export GAIN_IOS_TEAM_ID="$TEAM_ID"
# Do not save the build number: each upload needs a consciously chosen new value.
[ -z "$BUILD_NUMBER" ] || export GAIN_IOS_BUILD_NUMBER="$BUILD_NUMBER"

say ""
say "3. Installing packages"
cd "$REPO"
if [ -d node_modules ] && [ -f node_modules/.package-lock.json ] && [ ! package-lock.json -nt node_modules/.package-lock.json ]; then
  ok "node_modules is up to date, skipping npm ci"
else
  npm ci
fi

say ""
say "4. Generating the iOS project (apps/mobile/ios) and installing pods"
cd "$MOBILE"
CI=1 npx expo prebuild --platform ios
ok "apps/mobile/ios is ready"

say ""
if [ -n "$ARCHIVE_PATH" ]; then
  say "5. Archiving Release build $BUILD_NUMBER locally"
  xcodebuild -workspace "$MOBILE/ios/GAIN.xcworkspace" -scheme GAIN -configuration Release \
    -destination 'generic/platform=iOS' -archivePath "$ARCHIVE_PATH" archive
  say "Archive created: $ARCHIVE_PATH"
  say "Inspect it: node scripts/ios-archive-report.cjs '$ARCHIVE_PATH' '$BUNDLE_ID' '$BUILD_NUMBER'"
  say "Open Xcode Organizer to validate signing/distribution. Nothing was uploaded."
  exit 0
fi

say "5. Next steps"
cat <<EOF
  a) Plug your iPhone into the Mac with a cable, unlock it, tap Trust on the phone.
  b) iPhone: Settings > Privacy & Security > Developer Mode > On (the phone restarts). Needed once.
  c) Build and install:   cd apps/mobile && npx expo run:ios --device --configuration $CONFIGURATION
     Or open apps/mobile/ios/GAIN.xcworkspace in Xcode, pick Signing & Capabilities > Team = your Apple ID (Personal Team), press Run.
  d) First launch says "Untrusted Developer": iPhone Settings > General > VPN & Device Management > your Apple ID > Trust.
  e) The free-account build stops opening after 7 days. Plug in and run this script again, then step c.
  Problems? docs/IOS.md has a 'When something goes wrong' section.
EOF

if [ "$RUN_AFTER" -eq 1 ]; then
  say ""
  say "Building and installing on your iPhone (--run)"
  exec npx expo run:ios --device --configuration "$CONFIGURATION"
fi
