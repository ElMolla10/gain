// Config plugin (iOS only): removes the `aps-environment` (Push Notifications) entitlement that expo-notifications adds.
//
// GAIN only schedules LOCAL notifications (training-day reminders, the rest-timer alert). Those need no entitlement, and GAIN never asks for
// a push token. Leaving the entitlement in would make Xcode refuse to sign the app with a free personal Apple ID ("Personal development
// teams do not support the Push Notifications capability"), and would later ask for push capabilities nobody uses.
//
// Mods run in reverse order of registration, so this plugin is listed BEFORE "expo-notifications" in app.json to run AFTER it.
const { withEntitlementsPlist } = require("expo/config-plugins");

/** Pure: the entitlements without the push key (a new object; the input is not changed). */
function stripPushEntitlement(entitlements) {
  const { "aps-environment": _removed, ...rest } = entitlements || {};
  return rest;
}

const withoutPushEntitlement = (config) =>
  withEntitlementsPlist(config, (c) => {
    c.modResults = stripPushEntitlement(c.modResults);
    return c;
  });

module.exports = withoutPushEntitlement;
module.exports.stripPushEntitlement = stripPushEntitlement;
