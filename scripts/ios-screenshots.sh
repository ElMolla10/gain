#!/usr/bin/env bash
# App Store screenshots on a Mac via the iOS Simulator (docs/IOS-STORE-METADATA.md, "Screenshot plan").
# Builds a Release simulator app once, then for each device size (6.9" 1320x2868, 6.5" 1284x2778) and language (en, ar)
# boots the simulator, forces a clean status bar, launches GAIN and waits for you to navigate to each scene; press Enter to capture.
# Nothing is uploaded. Use synthetic demo data only.
#
#   scripts/ios-screenshots.sh                 # all sizes, both languages
#   scripts/ios-screenshots.sh --skip-build    # reuse the last simulator build
#   GAIN_SHOT_DEVICE_69="iPhone 16 Pro Max" GAIN_SHOT_DEVICE_65="iPhone 14 Plus" scripts/ios-screenshots.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MOBILE="$ROOT/apps/mobile"
OUT="${GAIN_SHOT_OUT:-$ROOT/screenshots}"
DERIVED="$MOBILE/ios/build-screenshots"
DEVICE_69="${GAIN_SHOT_DEVICE_69:-iPhone 17 Pro Max}"
DEVICE_65="${GAIN_SHOT_DEVICE_65:-iPhone 14 Plus}"
SCENES=("01-today" "02-rack" "03-finish" "04-progress" "05-plan")
SKIP_BUILD=0
[ "${1:-}" = "--skip-build" ] && SKIP_BUILD=1

say() { printf '%s\n' "$*"; }
die() { say "error: $*" >&2; exit 1; }

[ "$(uname -s)" = "Darwin" ] || die "run this on a Mac with Xcode"
command -v xcrun >/dev/null || die "xcrun not found; install Xcode"

if [ "$SKIP_BUILD" -eq 0 ]; then
  say "Generating the iOS project and building a Release simulator app..."
  (cd "$MOBILE" && CI=1 npx expo prebuild --platform ios)
  xcodebuild -workspace "$MOBILE/ios/GAIN.xcworkspace" -scheme GAIN -configuration Release \
    -sdk iphonesimulator -destination "generic/platform=iOS Simulator" -derivedDataPath "$DERIVED" build | tail -n 5
fi
APP="$(find "$DERIVED/Build/Products/Release-iphonesimulator" -maxdepth 1 -name '*.app' | head -n 1)"
[ -n "$APP" ] || die "no simulator .app found; run without --skip-build"
BUNDLE_ID="$(/usr/libexec/PlistBuddy -c 'Print CFBundleIdentifier' "$APP/Info.plist")"

shoot() { # $1 device name, $2 size label, $3 expected WxH
  local device="$1" size="$2" expect="$3" udid lang
  udid="$(xcrun simctl list devices available | grep -F "    $device (" | head -n 1 | sed -E 's/.*\(([0-9A-F-]{36})\).*/\1/')"
  if [ -z "$udid" ]; then say "skip $size: simulator '$device' not installed (set GAIN_SHOT_DEVICE_${size%\"})"; return 0; fi
  xcrun simctl boot "$udid" 2>/dev/null || true
  xcrun simctl bootstatus "$udid" -b >/dev/null
  open -a Simulator --args -CurrentDeviceUDID "$udid"
  xcrun simctl status_bar "$udid" override --time "9:41" --dataNetwork wifi --wifiBars 3 --cellularBars 4 --batteryState charged --batteryLevel 100
  xcrun simctl install "$udid" "$APP"
  for lang in en ar; do
    local locale="en_US"; [ "$lang" = "ar" ] && locale="ar_EG"
    xcrun simctl terminate "$udid" "$BUNDLE_ID" 2>/dev/null || true
    xcrun simctl launch "$udid" "$BUNDLE_ID" -AppleLanguages "($lang)" -AppleLocale "$locale" >/dev/null
    mkdir -p "$OUT/$lang/$size"
    for scene in "${SCENES[@]}"; do
      read -r -p "[$size $lang] open '$scene' in the simulator, then press Enter " _
      local file="$OUT/$lang/$size/$scene.png"
      xcrun simctl io "$udid" screenshot --type=png "$file" >/dev/null
      local got
      got="$(sips -g pixelWidth -g pixelHeight "$file" | awk '/pixelWidth/{w=$2}/pixelHeight/{h=$2}END{print w"x"h}')"
      if [ "$got" = "$expect" ]; then say "  saved $file ($got)"; else say "  WARNING $file is $got, App Store slot expects $expect"; fi
    done
  done
  xcrun simctl status_bar "$udid" clear
}

shoot "$DEVICE_69" "6.9" "1320x2868"
shoot "$DEVICE_65" "6.5" "1284x2778"
say "Done. Screenshots are in $OUT (git-ignored). Nothing was uploaded."
