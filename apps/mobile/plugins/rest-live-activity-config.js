// Expo Widgets requires an App Group, which Apple Personal Teams cannot provision.
// Keep the free-ID build unchanged; paid-team builds explicitly enable the extension.
function applyRestLiveActivityConfig(config, env) {
  const value = env.GAIN_IOS_LIVE_ACTIVITY || "0";
  if (value !== "0" && value !== "1") throw new Error('GAIN_IOS_LIVE_ACTIVITY must be "1" or "0"');
  const enabled = value === "1";
  if (!enabled) return config;
  const plugins = [...(config.plugins || [])];
  if (enabled) {
    const bundleId = config.ios?.bundleIdentifier;
    if (!bundleId) throw new Error("Live Activities require ios.bundleIdentifier");
    const appGroup = env.GAIN_IOS_APP_GROUP || `group.${bundleId}`;
    if (!/^group\.[A-Za-z0-9.-]+$/.test(appGroup)) throw new Error("GAIN_IOS_APP_GROUP must look like group.com.example.app");
    plugins.push(["expo-widgets", {
      bundleIdentifier: `${bundleId}.ExpoWidgetsTarget`, groupIdentifier: appGroup,
      enablePushNotifications: false, frequentUpdates: false,
    }]);
  }
  return { ...config, plugins, extra: { ...(config.extra || {}), restLiveActivityEnabled: enabled } };
}
module.exports = { applyRestLiveActivityConfig };
