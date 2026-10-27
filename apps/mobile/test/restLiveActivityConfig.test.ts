import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
const require = createRequire(import.meta.url);
const { applyRestLiveActivityConfig } = require("../plugins/rest-live-activity-config");
const config = { ios: { bundleIdentifier: "com.example.gain" }, android: { permissions: [] }, plugins: ["./plugins/without-push-entitlement"] };
describe("Live Activity build opt-in", () => {
  it("preserves free Apple ID builds without app group entitlements or widget plugin", () => {
    const result = applyRestLiveActivityConfig(config, {});
    expect(result.plugins).toEqual(config.plugins);
    expect(result.ios).toEqual(config.ios);
    expect(result.extra?.restLiveActivityEnabled).toBeUndefined();
  });
  it("adds official widget extension only on explicit opt-in and keeps push disabled", () => {
    const result = applyRestLiveActivityConfig(config, { GAIN_IOS_LIVE_ACTIVITY: "1" });
    expect(result.plugins).toContainEqual(["expo-widgets", {
      bundleIdentifier: "com.example.gain.ExpoWidgetsTarget", groupIdentifier: "group.com.example.gain", enablePushNotifications: false, frequentUpdates: false,
    }]);
    expect(result.extra.restLiveActivityEnabled).toBe(true);
    expect(result.android).toEqual(config.android);
  });
  it("uses GAIN_IOS_APP_GROUP for the App Group when set, and rejects a malformed one", () => {
    const result = applyRestLiveActivityConfig(config, { GAIN_IOS_LIVE_ACTIVITY: "1", GAIN_IOS_APP_GROUP: "group.com.mohamedelmolla.gain" });
    expect(result.plugins).toContainEqual(["expo-widgets", expect.objectContaining({ bundleIdentifier: "com.example.gain.ExpoWidgetsTarget", groupIdentifier: "group.com.mohamedelmolla.gain" })]);
    expect(() => applyRestLiveActivityConfig(config, { GAIN_IOS_LIVE_ACTIVITY: "1", GAIN_IOS_APP_GROUP: "com.bad" })).toThrow("GAIN_IOS_APP_GROUP");
  });
  it("rejects a misspelled opt-in", () => {
    expect(() => applyRestLiveActivityConfig(config, { GAIN_IOS_LIVE_ACTIVITY: "true" })).toThrow("GAIN_IOS_LIVE_ACTIVITY");
  });
});
