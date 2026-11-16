#!/usr/bin/env bash
# Build a Google Play AAB on Ubuntu (docs/PLAY-STORE-LISTING.md, docs/PLAY-BUILD.md).
#
#   scripts/android-play-aab.sh --prebuild-only   generate the Android project and check the Play manifest
#   scripts/android-play-aab.sh                   prebuild, bundleRelease, and sign with the upload/app-signing key
#
# The signed path reads the keystore only from environment variables. It never prompts.
# Do not print, commit, or pass the keystore or passwords on the command line.
#
#   GAIN_PLAY_KEYSTORE          path to the Java keystore (.jks / .keystore)
#   GAIN_PLAY_STORE_PASSWORD    keystore password
#   GAIN_PLAY_KEY_ALIAS         key alias
#   GAIN_PLAY_KEY_PASSWORD      key password (defaults to GAIN_PLAY_STORE_PASSWORD if unset)
#   GAIN_PLAY_CERT_SHA256       expected signer SHA-256 (default: the v1.0.2 Windows key)
#   GAIN_PLAY_OUT               output path (default: gain-play-1.0.3.aab in the repo root)
#
# Does not upload to Play, spend Expo cloud credits, or use EAS credentials.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MOBILE="$ROOT/apps/mobile"
PREBUILD_ONLY=0
[ "${1:-}" = "--prebuild-only" ] && PREBUILD_ONLY=1

EXPECTED_CERT_SHA256="${GAIN_PLAY_CERT_SHA256:-9bb983dd9766e52b8f2f363da38a07057da1fc5309a0f1719ad2a7c96eea2a4b}"

say() { printf '%s\n' "$*"; }
die() { say "error: $*" >&2; exit 1; }

need_cmd() { command -v "$1" >/dev/null || die "$1 not found"; }

normalize_sha256() {
  printf '%s' "$1" | tr 'A-F' 'a-f' | tr -d '[:space:]:'
}

keystore_sha256() {
  # Prints only the SHA-256 fingerprint. Never prints passwords.
  # keytool -storepass:env reads the named environment variable (Java 9+).
  local storepass_var=$1
  local out
  out="$("$KEYTOOL" -list -v -keystore "$GAIN_PLAY_KEYSTORE" -storepass:env "$storepass_var" 2>/dev/null)" || die "keytool could not open the keystore (check GAIN_PLAY_KEYSTORE and GAIN_PLAY_STORE_PASSWORD)"
  local line sha
  line="$(printf '%s\n' "$out" | grep -E 'SHA-?256:' | head -n 1 || true)"
  [ -n "$line" ] || die "keytool output had no SHA-256 fingerprint"
  sha="$(normalize_sha256 "${line#*:}")"
  printf '%s' "$sha"
}

assert_env_present() {
  local missing=0
  for name in GAIN_PLAY_KEYSTORE GAIN_PLAY_STORE_PASSWORD GAIN_PLAY_KEY_ALIAS; do
    if [ -z "${!name:-}" ]; then
      say "error: $name is not set" >&2
      missing=1
    fi
  done
  [ "$missing" -eq 0 ] || die "set the missing keystore environment variables and rerun (values are never read from flags or files in git)"
  [ -f "$GAIN_PLAY_KEYSTORE" ] || die "GAIN_PLAY_KEYSTORE is not a file"
}

require_signing_tools() {
  if [ -n "${JAVA_HOME:-}" ] && [ -x "$JAVA_HOME/bin/keytool" ]; then
    KEYTOOL="$JAVA_HOME/bin/keytool"
    JARSIGNER="$JAVA_HOME/bin/jarsigner"
  else
    need_cmd keytool
    need_cmd jarsigner
    KEYTOOL="$(command -v keytool)"
    JARSIGNER="$(command -v jarsigner)"
  fi
}

check_play_manifest() {
  local manifest="$MOBILE/android/app/src/main/AndroidManifest.xml"
  [ -f "$manifest" ] || die "AndroidManifest.xml was not generated"
  # blockedPermissions is written as uses-permission tools:node="remove". That entry must stay;
  # it is what stops a library from merging the permission back in. A grant (a uses-permission
  # without tools:node="remove") is the failure.
  if grep -E 'android.permission.REQUEST_INSTALL_PACKAGES' "$manifest" | grep -v 'tools:node="remove"' >/dev/null; then
    die "Play manifest still grants REQUEST_INSTALL_PACKAGES; GAIN_DISTRIBUTION=play did not apply"
  fi
  if ! grep -q 'android.permission.REQUEST_INSTALL_PACKAGES" tools:node="remove"' "$manifest"; then
    say "warn: REQUEST_INSTALL_PACKAGES is not listed as tools:node=remove; libraries could merge it back in"
  fi
  say "Play manifest OK: REQUEST_INSTALL_PACKAGES is blocked (tools:node=remove), not granted ($manifest)"
}

need_cmd npx
need_cmd git
[ "$PREBUILD_ONLY" -eq 1 ] || require_signing_tools

if [ "$PREBUILD_ONLY" -eq 0 ]; then
  assert_env_present
  if [ -z "${GAIN_PLAY_KEY_PASSWORD:-}" ]; then
    GAIN_PLAY_KEY_PASSWORD="$GAIN_PLAY_STORE_PASSWORD"
    export GAIN_PLAY_KEY_PASSWORD
  fi
  actual="$(keystore_sha256 GAIN_PLAY_STORE_PASSWORD)"
  expected="$(normalize_sha256 "$EXPECTED_CERT_SHA256")"
  if [ "$actual" != "$expected" ]; then
    die "keystore SHA-256 is $actual, expected $expected (the v1.0.2 Windows key). Stopping so the old sideload key cannot be used by mistake."
  fi
  say "keystore certificate SHA-256 matches the v1.0.2 key"
fi

cd "$MOBILE"
say "prebuilding the Android project with GAIN_DISTRIBUTION=play"
GAIN_DISTRIBUTION=play CI=1 npx expo prebuild --platform android --clean --no-install
# prebuild rewrites the "android" script in package.json; restore the committed file.
git checkout -- package.json
check_play_manifest

if [ "$PREBUILD_ONLY" -eq 1 ]; then
  say "prebuild-only done; no AAB was built or signed"
  exit 0
fi

cd "$MOBILE/android"
say "running Gradle bundleRelease"
./gradlew bundleRelease -PreactNativeArchitectures=arm64-v8a --no-daemon -Dorg.gradle.jvmargs=-Xmx2g

AAB="$(find "$MOBILE/android/app/build/outputs/bundle" -name '*.aab' -print | head -n 1)"
[ -n "$AAB" ] && [ -f "$AAB" ] || die "Gradle did not produce an AAB under app/build/outputs/bundle"

# Gradle may have debug-signed the bundle; resign with the Play upload/app-signing key.
say "signing the AAB"
"$JARSIGNER" -sigalg SHA256withRSA -digestalg SHA-256 \
  -keystore "$GAIN_PLAY_KEYSTORE" \
  -storepass:env GAIN_PLAY_STORE_PASSWORD \
  -keypass:env GAIN_PLAY_KEY_PASSWORD \
  "$AAB" "$GAIN_PLAY_KEY_ALIAS" >/dev/null

"$JARSIGNER" -verify -verbose -certs "$AAB" >/dev/null || die "jarsigner could not verify the AAB"

OUT="${GAIN_PLAY_OUT:-$ROOT/gain-play-1.0.3.aab}"
mkdir -p "$(dirname "$OUT")"
cp "$AAB" "$OUT"
say "signed AAB written to $OUT"
say "upload this file to the Play closed-testing track; this script does not submit it"
