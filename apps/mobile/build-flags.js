// Build-time switches (v0.20.0). Pure and dependency-free so app.config.js and the tests share it. Nothing here runs on the phone: the values
// are written into the app's config (`expo.extra`) when the APK/AAB is built, and src/buildConfig.ts reads them back.
//
//   GAIN_DISTRIBUTION=sideload (default)  the GitHub APK: the "Check for updates" card and REQUEST_INSTALL_PACKAGES are present.
//   GAIN_DISTRIBUTION=play                a Google Play build: no updater card, no REQUEST_INSTALL_PACKAGES in the manifest, no in-app self-install.
//   GAIN_PILOT_TEMPLATES=1                a pilot build: the template pickers offer only the six pilot programs (PILOT_TEMPLATE_IDS).
// Anything else in those variables is an error, so a typo cannot silently produce the wrong build.
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
  return {
    ...config,
    android,
    extra: { ...(config.extra || {}), distribution: dist, pilotTemplateIds: pilotRaw === "1" ? [...PILOT_TEMPLATE_IDS] : null },
  };
}

module.exports = { applyBuildFlags, PILOT_TEMPLATE_IDS, INSTALL_PERMISSION };
