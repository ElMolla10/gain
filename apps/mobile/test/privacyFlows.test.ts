import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { en } from "../src/i18n/strings";

/**
 * Step 17 "compare actual data flows (code) against the text": the draft privacy page says the app has no account, server, analytics or ad
 * service and contacts only GitHub when the lifter checks for updates. These tests fail if the code stops matching that text, so the text
 * (and the legal review) has to be updated first.
 */
const root = join(__dirname, "..");
const files = (dir: string): string[] => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? files(join(dir, n)) : [join(dir, n)]));
const src = files(join(root, "src")).filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes("/i18n/"));
const text = (f: string) => readFileSync(f, "utf8");

describe("privacy page matches the code (DRAFT, not legally reviewed)", () => {
  it("the only network calls are the update check (GitHub API) and the APK download", () => {
    const users = src.filter((f) => /\bfetch\s*(\(|as\b)|XMLHttpRequest|WebSocket|downloadFileAsync|expo-network|axios/.test(text(f))).map((f) => f.slice(root.length + 1)).sort();
    // UpdateCard hands the platform fetch to updateCheck.ts (which only builds the GitHub URL and is otherwise pure) and downloads the APK.
    expect(users).toEqual(["src/components/UpdateCard.tsx"]);
  });
  it("the only hosts in the source are github.com / api.github.com", () => {
    const hosts = new Set<string>();
    for (const f of src) for (const m of text(f).matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) hosts.add(m[1]!.toLowerCase());
    expect(hosts.has("api.github.com")).toBe(true);
    expect([...hosts].every((h) => h === "github.com" || h.endsWith(".github.com") || h === "www.w3.org")).toBe(true);
  });
  it("the update check runs only when the lifter taps (no automatic call on open)", () => {
    const card = text(join(root, "src/components/UpdateCard.tsx"));
    expect(card).not.toMatch(/useEffect|useFocusEffect/);
    const app = text(join(root, "App.tsx"));
    expect(app).not.toMatch(/checkForUpdate|updateCheck/);
  });
  it("no analytics, advertising, attribution or crash-reporting SDK is a dependency", () => {
    const pkg = JSON.parse(text(join(root, "package.json"))) as { dependencies: Record<string, string> };
    const bad = Object.keys(pkg.dependencies).filter((d) => /sentry|firebase|analytics|amplitude|mixpanel|segment|facebook|admob|ads|bugsnag|datadog|posthog|appsflyer|adjust|crashlytics|rudder/i.test(d));
    expect(bad).toEqual([]);
  });
  it("the app declares no extra Android permission beyond installing the updates it downloads", () => {
    const cfg = JSON.parse(text(join(root, "app.json"))) as { expo: { android: { permissions: string[] } } };
    expect(cfg.expo.android.permissions).toEqual(["REQUEST_INSTALL_PACKAGES"]);
  });
  it("the page says the things the code makes true, and is marked DRAFT", () => {
    expect(en["privacy.draft"]).toMatch(/DRAFT/);
    expect(en["privacy.local.body"]).toMatch(/no account, no server and no analytics/);
    expect(en["privacy.leaves.update"]).toMatch(/api\.github\.com/);
    expect(en["privacy.leaves.backup"]).toMatch(/Android/);
    expect(en["privacy.health.body"]).toMatch(/not a doctor/);
    expect(en["health.note"]).toMatch(/not medical advice/);
  });
  it("'Delete everything' also removes the pre-update safety copy and the crash log", () => {
    const d = text(join(root, "src/screens/DataScreen.tsx"));
    const wipe = d.slice(d.indexOf("async function wipe"));
    expect(wipe).toMatch(/PRE_MIGRATION_FILE/);
    expect(wipe).toMatch(/\.delete\(\)/);
    expect(wipe).toMatch(/diagnostics\.clear\(\)/);
  });
  it("a failed set save is shown to the lifter, not swallowed", () => {
    const w = text(join(root, "src/screens/WorkoutScreen.tsx"));
    expect(w).toMatch(/workout\.saveFailed\.title/);
  });
});
