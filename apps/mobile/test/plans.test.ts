import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FREE_FEATURES, PAID_FEATURES, PLAN_FLAGS, RECORDS_STAY_AFTER_CANCEL, isUnlocked, type Feature } from "../src/logic/plans";
import { translate } from "../src/i18n/format";

const SRC = join(__dirname, "../src");
const files = (dir: string): string[] => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? files(join(dir, n)) : [join(dir, n)]));
const all = files(SRC).filter((f) => /\.(ts|tsx)$/.test(f));

describe("paywall scaffold: off by default, no billing", () => {
  it("both flags are off", () => {
    expect(PLAN_FLAGS.paywallEnabled).toBe(false);
    expect(PLAN_FLAGS.planPreviewVisible).toBe(false);
  });
  it("with the paywall off every feature is unlocked, entitled or not", () => {
    for (const f of [...FREE_FEATURES, ...PAID_FEATURES] as Feature[]) {
      expect(isUnlocked(f)).toBe(true);
      expect(isUnlocked(f, false)).toBe(true);
    }
  });
  it("with the paywall switched on (tested only) the five paid features lock and the free ones never do; an entitlement unlocks", () => {
    const on = { paywallEnabled: true, planPreviewVisible: false };
    for (const f of FREE_FEATURES) expect(isUnlocked(f, false, on)).toBe(true);
    for (const f of PAID_FEATURES) {
      expect(isUnlocked(f, false, on)).toBe(false);
      expect(isUnlocked(f, true, on)).toBe(true);
    }
    expect(RECORDS_STAY_AFTER_CANCEL).toBe(true);
  });
  it("the split is the one in PRODUCT.md", () => {
    const product = readFileSync(join(__dirname, "../../../docs/PRODUCT.md"), "utf8");
    expect(product).toContain("Free: logging, history, one template, basic charts, own-data export. Records stay available after cancel.");
    expect(product).toContain("Paid: next-session targets, gym-aware increments, goal pace, short-week rebuild, weekly decision.");
    expect(FREE_FEATURES).toHaveLength(5);
    expect(PAID_FEATURES).toHaveLength(5);
  });
  it("nothing in the app asks whether a feature is unlocked: no feature is gated", () => {
    const users = all.filter((f) => /\bisUnlocked\b/.test(readFileSync(f, "utf8")) && !f.endsWith("logic/plans.ts"));
    expect(users).toEqual([]);
  });
  it("no purchase library, store billing call or payment code exists", () => {
    const pkg = readFileSync(join(__dirname, "../package.json"), "utf8").toLowerCase();
    for (const bad of ["billing", "iap", "revenuecat", "purchases", "stripe", "paymob", "fawry"]) expect(pkg, bad).not.toContain(bad);
    const code = all.filter((f) => !f.includes("/i18n/")).map((f) => readFileSync(f, "utf8").toLowerCase()).join("\n");
    for (const bad of ["react-native-iap", "expo-iap", "react-native-purchases", "billingclient", "launchbillingflow"]) expect(code, bad).not.toContain(bad);
  });
  it("the preview row in Settings is only built when its flag is on, and the plans page has no buy button or price", () => {
    const settings = readFileSync(join(SRC, "screens/SettingsScreen.tsx"), "utf8");
    expect(settings).toMatch(/PLAN_FLAGS\.planPreviewVisible \? <BigButton/);
    const page = readFileSync(join(SRC, "screens/PlansScreen.tsx"), "utf8");
    expect(page).not.toMatch(/BigButton|Pressable|fetch\(|EGP|USD/);
  });
  it("every feature has a label in both languages, and the page says nothing is for sale", () => {
    for (const lang of ["en", "ar"] as const) {
      for (const f of [...FREE_FEATURES, ...PAID_FEATURES]) expect(translate(lang, `plans.f.${f}` as never)).not.toBe(`plans.f.${f}`);
      expect(translate(lang, "plans.nothing")).not.toBe("plans.nothing");
    }
    expect(translate("en", "plans.nothing")).toMatch(/Nothing is for sale/);
  });
});
