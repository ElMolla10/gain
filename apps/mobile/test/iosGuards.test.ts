import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { hasSelfUpdater, readBuildFlags } from "../src/logic/buildFlags";
import { OS_TEXT_KEYS, osTextKey } from "../src/logic/platform";
import { ar, en } from "../src/i18n/strings";

/**
 * iOS guards (docs/IOS.md). Nothing here runs on an iPhone: the logic is tested directly and the screens are checked as source text,
 * because react-native cannot be loaded on this Linux box. Android must behave exactly as before.
 */
const root = join(__dirname, "..");
const read = (f: string) => readFileSync(join(root, f), "utf8");
const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
const srcFiles = walk(join(root, "src")).filter((f) => /\.tsx?$/.test(f));

describe("self-updater is Android only", () => {
  const sideload = readBuildFlags({ distribution: "sideload" });
  it("Android sideload keeps it; left-out os means Android, as before", () => {
    expect(hasSelfUpdater(sideload, "android")).toBe(true);
    expect(hasSelfUpdater(sideload)).toBe(true);
  });
  it("iOS never shows it, whatever the build flags", () => {
    expect(hasSelfUpdater(sideload, "ios")).toBe(false);
    expect(hasSelfUpdater(readBuildFlags({ distribution: "play" }), "ios")).toBe(false);
  });
  it("Play builds still hide it on Android", () => expect(hasSelfUpdater(readBuildFlags({ distribution: "play" }), "android")).toBe(false));
  it("only UpdateCard touches the Android intent launcher, and only Settings renders UpdateCard", () => {
    const launcher = srcFiles.filter((f) => /expo-intent-launcher/.test(readFileSync(f, "utf8"))).map((f) => f.slice(root.length + 1));
    expect(launcher).toEqual(["src/components/UpdateCard.tsx"]);
    const users = srcFiles.filter((f) => /<UpdateCard\b/.test(readFileSync(f, "utf8"))).map((f) => f.slice(root.length + 1));
    expect(users).toEqual(["src/screens/SettingsScreen.tsx"]);
  });
});

describe("notification channels are Android only", () => {
  it("setNotificationChannelAsync is only called inside a Platform.OS === 'android' check", () => {
    for (const f of ["src/notifications/reminders.ts", "src/notifications/restAlerts.ts"]) {
      const s = read(f);
      const at = s.indexOf("setNotificationChannelAsync");
      expect(at, f).toBeGreaterThan(0);
      expect(s.slice(Math.max(0, at - 120), at), f).toMatch(/Platform\.OS === "android"/);
    }
  });
  it("the app never asks for a push token (local notifications only; no Push Notifications entitlement is needed)", () => {
    expect(srcFiles.map((f) => readFileSync(f, "utf8")).join("\n")).not.toMatch(/getExpoPushTokenAsync|getDevicePushTokenAsync/);
  });
});

describe("text that names the phone's own system", () => {
  it("Android keeps the original keys", () => {
    for (const k of OS_TEXT_KEYS) expect(osTextKey(k, "android")).toBe(k);
  });
  it("iOS gets a '.ios' twin in both languages that does not mention Android", () => {
    for (const k of OS_TEXT_KEYS) {
      const twin = osTextKey(k, "ios");
      expect(twin).toBe(`${k}.ios`);
      expect(en[twin].length, twin).toBeGreaterThan(20);
      expect(ar[twin].length, twin).toBeGreaterThan(20);
      expect(en[twin], twin).not.toMatch(/android|google/i);
      expect(ar[twin], twin).not.toMatch(/أندرويد|اندرويد|جوجل/);
    }
  });
  it("the originals still say Android (so the Android text did not change)", () => {
    expect(en["privacy.leaves.share"]).toMatch(/Android's share sheet/);
    expect(en["privacy.leaves.backup"]).toMatch(/Android may back up/);
    expect(en["privacy.control.body"]).toMatch(/Android backups/);
    expect(en["data.delete.warn"]).toMatch(/Android may also keep/);
  });
  it("the screens pick the text through osTextKey(Platform.OS)", () => {
    expect(read("src/screens/PrivacyScreen.tsx")).toMatch(/osTextKey\("privacy\.leaves\.share", Platform\.OS\)/);
    expect(read("src/screens/PrivacyScreen.tsx")).toMatch(/osTextKey\("privacy\.leaves\.backup", Platform\.OS\)/);
    expect(read("src/screens/PrivacyScreen.tsx")).toMatch(/osTextKey\("privacy\.control\.body", Platform\.OS\)/);
    expect(read("src/screens/DataScreen.tsx")).toMatch(/osTextKey\("data\.delete\.warn", Platform\.OS\)/);
  });
});

describe("iPhone keyboard", () => {
  it("every number-pad / decimal-pad TextInput carries the Done accessory", () => {
    for (const f of ["src/components/NumField.tsx", "src/components/LogParts.tsx"]) expect(read(f), f).toMatch(/\{\.\.\.numberPadAccessory\}/);
    expect(read("src/ui.tsx")).toMatch(/numberPadAccessory/);
    // any other file that puts a numeric keyboard on a raw TextInput must do the same (the shared Field in ui.tsx covers the screens that use it)
    const raw = srcFiles.filter((f) => {
      const t = readFileSync(f, "utf8");
      return /<TextInput\b/.test(t) && /"(number-pad|decimal-pad|numeric)"/.test(t);
    });
    for (const f of raw) expect(readFileSync(f, "utf8"), f).toMatch(/numberPadAccessory/);
    expect(raw.length).toBeGreaterThanOrEqual(3);
  });
  it("the Done bar renders only on iOS and is mounted once at the app root", () => {
    expect(read("src/components/NumberPadDone.tsx")).toMatch(/if \(Platform\.OS !== "ios"\) return null/);
    expect(read("src/numberPad.ts")).toMatch(/Platform\.OS === "ios" \? \{ inputAccessoryViewID/);
    expect(read("App.tsx")).toMatch(/<NumberPadDone \/>/);
    expect(en["common.done"]).toBe("Done");
    expect(ar["common.done"]).toBeTruthy();
  });
  it("sheets, the exercise picker and the logger make room for the keyboard on iOS only", () => {
    expect(read("src/numberPad.ts")).toMatch(/adjustKeyboardInsets = Platform\.OS === "ios"/);
    for (const f of ["src/ui.tsx", "src/components/ExercisePicker.tsx", "src/screens/WorkoutScreen.tsx"]) expect(read(f), f).toMatch(/automaticallyAdjustKeyboardInsets=\{adjustKeyboardInsets\}/);
  });
});
