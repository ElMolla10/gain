import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ar, en } from "../src/i18n/strings";

/**
 * GAIN is completely free: no subscriptions, in-app purchases or paid feature tiers (decision 2026-10-03). These checks fail if a billing
 * library, a gate, a Plans page or pricing copy comes back, or if the "completely free" statement leaves the docs that must carry it.
 */
const root = join(__dirname, "..");
const repo = join(root, "..", "..");
const files = (dir: string): string[] => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? files(join(dir, n)) : [join(dir, n)]));
const text = (f: string) => readFileSync(f, "utf8");

const STATEMENT = "GAIN is completely free. No subscriptions, in-app purchases, or paid feature tiers.";
const STATEMENT_AR = "GAIN مجاني بالكامل. مفيش اشتراكات ولا مشتريات جوه التطبيق ولا مستويات مدفوعة للمميزات.";

describe("GAIN is completely free", () => {
  it("README, PRODUCT.md and the store-listing draft say so (the listing in English and Arabic)", () => {
    expect(text(join(repo, "README.md"))).toContain(STATEMENT);
    expect(text(join(repo, "docs/PRODUCT.md"))).toContain(STATEMENT);
    const listing = text(join(repo, "docs/PLAY-LISTING-DRAFT.md"));
    expect(listing).toContain(STATEMENT);
    expect(listing).toContain(STATEMENT_AR);
  });
  it("no billing, purchase or payment library is a dependency, and no billing permission is declared", () => {
    const pkg = JSON.parse(text(join(root, "package.json"))) as { dependencies: Record<string, string> };
    const bad = Object.keys(pkg.dependencies).filter((d) => /billing|iap|purchases|revenuecat|stripe|paymob|fawry|paypal/i.test(d));
    expect(bad).toEqual([]);
    const cfg = text(join(root, "app.json"));
    expect(cfg).not.toMatch(/BILLING|vending/i);
  });
  it("there is no plans / paywall module, screen or string, and no entitlement check in the app code", () => {
    const src = files(join(root, "src")).concat(join(root, "App.tsx"));
    expect(src.filter((f) => /plans|paywall|entitlement|billing/i.test(f.slice(root.length)))).toEqual([]);
    expect(existsSync(join(repo, "docs/PAYWALL-SCAFFOLD.md"))).toBe(false);
    const code = src.filter((f) => /\.(ts|tsx)$/.test(f)).map(text).join("\n");
    expect(code).not.toMatch(/paywall|entitle|isUnlocked|isPaid|premium|subscription|restore purchase|in-app purchase/i);
    for (const dict of [en, ar]) expect(Object.keys(dict).filter((k) => /^plans\./.test(k))).toEqual([]);
  });
  it("no string the lifter can read talks about prices, subscriptions or upgrades (English and Arabic)", () => {
    const joined = [...Object.values(en), ...Object.values(ar)].join("\n");
    expect(joined).not.toMatch(/subscri|premium|paywall|upgrade to|free trial|\bpricing\b|اشتراك(?!ات)|بريميوم/i);
  });
});
