// Apple Health (HealthKit) write-only export. Off by default: without GAIN_IOS_HEALTHKIT=1 the config is returned unchanged,
// and react-native.config.js keeps the native module out of autolinking, so free-ID iOS and Android builds stay as they were.
const HEALTH_TEXT = "GAIN saves your finished workouts to Apple Health.";

function appleHealthEnabled(env) {
  const value = env.GAIN_IOS_HEALTHKIT || "0";
  if (value !== "0" && value !== "1") throw new Error('GAIN_IOS_HEALTHKIT must be "1" or "0"');
  return value === "1";
}

function applyAppleHealthConfig(config, env) {
  if (!appleHealthEnabled(env)) return config;
  const plugins = [...(config.plugins || []), ["@kingstinct/react-native-healthkit", {
    NSHealthUpdateUsageDescription: HEALTH_TEXT,
    NSHealthShareUsageDescription: HEALTH_TEXT,
    background: false,
  }]];
  return { ...config, plugins, extra: { ...(config.extra || {}), appleHealthEnabled: true } };
}
module.exports = { applyAppleHealthConfig, appleHealthEnabled, HEALTH_TEXT };
