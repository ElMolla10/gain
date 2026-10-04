// Build-time switches (v0.20.0). Pure and dependency-free so app.config.js and the tests share it. Nothing here runs on the phone: the values
// are written into the app's config (`expo.extra`) when the APK/AAB is built, and src/buildConfig.ts reads them back.
//
//   GAIN_DISTRIBUTION=sideload (default)  the GitHub APK: the "Check for updates" card and REQUEST_INSTALL_PACKAGES are present.
//   GAIN_DISTRIBUTION=play                a Google Play build: no updater card, no REQUEST_INSTALL_PACKAGES in the manifest, no in-app self-install.
//   GAIN_PILOT_TEMPLATES=1                a pilot build: the template pickers offer only the six pilot programs (PILOT_TEMPLATE_IDS).
//   GAIN_IOS_BUNDLE_ID=<id>              iOS only (docs/IOS.md): the bundle id for a personal free-Apple-ID build. Apple refuses an id that another team already holds, so pick your own, e.g. com.yourname.gain.
//   GAIN_IOS_TEAM_ID=<10 characters>     iOS only: your Apple Team ID, so Xcode signs without you picking the team by hand.
//   GAIN_IOS_SCENES=1                    iOS only: adopt the UIKit scene lifecycle that Xcode 27 / the iOS 27 SDK requires (Expo SDK 57 opt-in, expo-build-properties).
// None of the three touches the Android section. Anything else in the distribution / pilot variables is an error, so a typo cannot silently produce the wrong build.
const PILOT_TEMPLATE_IDS = ["full_body_2", "full_body_3", "ppl_3", "upper_lower_4", "mix_4", "ppl_6"];
const INSTALL_PERMISSION = "REQUEST_INSTALL_PACKAGES";

function applyBuildFlags(config, env) {
  const dist = env.GAIN_DISTRIBUTION === undefined || env.GAIN_DISTRIBUTION === "" ? "sideload" : env.GAIN_DISTRIBUTION;
  if (dist !== "sideload" && dist !== "play") throw new Error(`GAIN_DISTRIBUTION must be "sideload" or "play", got "${dist}"`);
  const pilotRaw = env.GAIN_PILOT_TEMPLATES === undefined || env.GAIN_PILOT_TEMPLATES === "" ? "0" : env.GAIN_PILOT_TEMPLATES;
  if (pilotRaw !== "0" && pilotRaw !== "1") throw new Error(`GAIN_PILOT_TEMPLATES must be "1" or "0", got "${pilotRaw}"`);
  const android = { ...(config.android || {}) };
  if (dist === "play") {
    android.permissions = (android.permissions || []).filter((p) => p !== INSTALL_PERMISSION && p !== `android.permission.${INSTALL_PERMISSION}`);
    const blocked = new Set(android.blockedPermissions || []);
    blocked.add(`android.permission.${INSTALL_PERMISSION}`);
    android.blockedPermissions = [...blocked];
  }
  const ios = { ...(config.ios || {}) };
  const bundleId = env.GAIN_IOS_BUNDLE_ID;
  if (bundleId !== undefined && bundleId !== "") {
    if (!/^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(bundleId)) throw new Error(`GAIN_IOS_BUNDLE_ID must look like com.yourname.gain (letters, digits, hyphens, dots), got "${bundleId}"`);
    ios.bundleIdentifier = bundleId;
  }
  const teamId = env.GAIN_IOS_TEAM_ID;
  if (teamId !== undefined && teamId !== "") {
    if (!/^[A-Z0-9]{10}$/.test(teamId)) throw new Error(`GAIN_IOS_TEAM_ID must be the 10-character Team ID (capital letters and digits), got "${teamId}"`);
    ios.appleTeamId = teamId;
  }
  const scenesRaw = env.GAIN_IOS_SCENES === undefined || env.GAIN_IOS_SCENES === "" ? "0" : env.GAIN_IOS_SCENES;
  if (scenesRaw !== "0" && scenesRaw !== "1") throw new Error(`GAIN_IOS_SCENES must be "1" or "0", got "${scenesRaw}"`);
  const plugins = scenesRaw === "1" ? [...(config.plugins || []), ["expo-build-properties", { ios: { enableSceneSupport: true } }]] : config.plugins;
  const out = {
    ...config,
    android,
    extra: { ...(config.extra || {}), distribution: dist, pilotTemplateIds: pilotRaw === "1" ? [...PILOT_TEMPLATE_IDS] : null },
  };
  // Only touch `ios` / `plugins` when a switch asked for it, so the default result is app.json plus `extra`, exactly as before.
  if (config.ios !== undefined || Object.keys(ios).length > 0) out.ios = ios;
  if (plugins !== undefined) out.plugins = plugins;
  return out;
}

module.exports = { applyBuildFlags, PILOT_TEMPLATE_IDS, INSTALL_PERMISSION };
