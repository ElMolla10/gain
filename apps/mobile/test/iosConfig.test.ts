import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * iOS build settings (docs/IOS.md). Only the app config is checked here: this repo is built on Linux, so nothing runs on an iPhone in these tests.
 * What they pin: the free-Apple-ID route must be able to sign the app (no Push Notifications entitlement; GAIN only schedules local
 * notifications), the app is iPhone only, and the Android section of the config is untouched.
 */
const require = createRequire(import.meta.url);
const root = join(__dirname, "..");
const { stripPushEntitlement } = require("../plugins/without-push-entitlement.js") as { stripPushEntitlement: (e: Record<string, unknown>) => Record<string, unknown> };
const cfg = (JSON.parse(readFileSync(join(root, "app.json"), "utf8")) as { expo: Record<string, any> }).expo;
const pluginName = (p: unknown): string => (Array.isArray(p) ? String(p[0]) : String(p));

describe("without-push-entitlement plugin", () => {
  it("drops aps-environment and keeps everything else", () => {
    const input = { "aps-environment": "development", "com.apple.developer.associated-domains": ["applinks:x"] };
    expect(stripPushEntitlement(input)).toEqual({ "com.apple.developer.associated-domains": ["applinks:x"] });
    expect(input["aps-environment"]).toBe("development"); // input not mutated
  });
  it("is fine with nothing to strip", () => {
    expect(stripPushEntitlement({})).toEqual({});
    expect(stripPushEntitlement(undefined as unknown as Record<string, unknown>)).toEqual({});
  });
  it("is listed before expo-notifications, so it runs after it (mods run in reverse order)", () => {
    const names = cfg.plugins.map(pluginName);
    expect(names.indexOf("./plugins/without-push-entitlement")).toBeGreaterThanOrEqual(0);
    expect(names.indexOf("./plugins/without-push-entitlement")).toBeLessThan(names.indexOf("expo-notifications"));
  });
  it("the app never asks for a push token", () => {
    const src = readFileSync(join(root, "src/notifications/reminders.ts"), "utf8") + readFileSync(join(root, "src/notifications/restAlerts.ts"), "utf8");
    expect(src).not.toMatch(/getExpoPushTokenAsync|getDevicePushTokenAsync/);
  });
});

describe("app.json iOS section", () => {
  it("has a bundle id, a build number, an icon and is iPhone only", () => {
    expect(cfg.ios.bundleIdentifier).toBe("app.gain.mobile");
    expect(cfg.ios.buildNumber).toMatch(/^\d+$/);
    expect(cfg.ios.supportsTablet).toBe(false);
    expect(cfg.ios.icon).toBe("./assets/icon.png");
  });
  it("declares no non-exempt encryption (HTTPS and SHA-256 only), so TestFlight does not ask about export compliance every build", () => {
    expect(cfg.ios.config.usesNonExemptEncryption).toBe(false);
  });
  it("declares the required-reason API categories with a reason each", () => {
    const types = cfg.ios.privacyManifests.NSPrivacyAccessedAPITypes as { NSPrivacyAccessedAPIType: string; NSPrivacyAccessedAPITypeReasons: string[] }[];
    expect(types.map((t) => t.NSPrivacyAccessedAPIType).sort()).toEqual(
      ["NSPrivacyAccessedAPICategoryDiskSpace", "NSPrivacyAccessedAPICategoryFileTimestamp", "NSPrivacyAccessedAPICategorySystemBootTime", "NSPrivacyAccessedAPICategoryUserDefaults"],
    );
    for (const t of types) expect(t.NSPrivacyAccessedAPITypeReasons.length).toBeGreaterThan(0);
  });
  it("does not add a Face ID usage string (secure storage is used without biometrics)", () => {
    const entry = cfg.plugins.find((p: unknown) => pluginName(p) === "expo-secure-store");
    expect(entry).toEqual(["expo-secure-store", { faceIDPermission: false }]);
  });
  it("keeps the Android section as it was", () => {
    expect(cfg.android.package).toBe("app.gain.mobile");
    expect(cfg.android.permissions).toEqual(["REQUEST_INSTALL_PACKAGES"]);
    expect(cfg.android.softwareKeyboardLayoutMode).toBe("resize");
  });
});
