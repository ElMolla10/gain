import { readFileSync } from "node:fs";
import { COACH_LIMITS, validateCoachCard } from "@gain/sync";
import { describe, expect, it } from "vitest";
import { ar, en } from "../src/i18n/strings";
import { toCoachPayload } from "../src/logic/coachCard";
import { createAutoSync } from "../src/sync/auto";

const src = (f: string) => readFileSync(f, "utf8");

describe("Back up and sync is opt-in and wired (v0.11)", () => {
  it("auto-sync does nothing (no sync call) while sync is not on, and never throws", async () => {
    let calls = 0;
    for (const status of ["off", "pending"] as const) {
      const a = createAutoSync({ status: async () => status, syncNow: async () => (calls++, { ok: true } as never) });
      expect(await a.run(true)).toBeNull();
    }
    expect(calls).toBe(0);
    const bad = createAutoSync({ status: async () => { throw new Error("db"); }, syncNow: async () => ({ ok: true }) as never });
    expect(await bad.run()).toBeNull();
    const boom = createAutoSync({ status: async () => "on", syncNow: async () => { throw new Error("net"); } });
    expect(await boom.run()).toBeNull();
  });

  it("auto-sync is throttled to once per gap unless forced", async () => {
    let t = 1_000_000;
    let calls = 0;
    const a = createAutoSync({ status: async () => "on", syncNow: async () => (calls++, { ok: true } as never) }, () => t, 300_000);
    await a.run();
    await a.run();
    expect(calls).toBe(1);
    t += 299_000;
    await a.run();
    expect(calls).toBe(1);
    await a.run(true);
    expect(calls).toBe(2);
    t += 300_001;
    await a.run();
    expect(calls).toBe(3);
  });

  it("the coach payload is always accepted by the server's validator, even for huge cards", () => {
    const long = "x".repeat(COACH_LIMITS.maxText * 3);
    const m = { lang: "en" as const, dir: "ltr" as const, title: long, date: "2026-10-03", footer: long, blocks: Array.from({ length: 50 }, () => ({ heading: long, lines: Array.from({ length: 80 }, () => long) })) };
    const p = toCoachPayload(m as never);
    expect(validateCoachCard(p)).toBeNull();
  });

  it("Settings opens the Sync screen, which is registered; wipe deletes online data first; privacy text mentions it", () => {
    expect(src("src/screens/SettingsScreen.tsx")).toMatch(/navigate\("Sync"\)/);
    expect(src("App.tsx")).toMatch(/name="Sync"/);
    const data = src("src/screens/DataScreen.tsx");
    expect(data.indexOf("sync.disconnect")).toBeGreaterThan(-1);
    expect(data.indexOf("sync.disconnect")).toBeLessThan(data.indexOf("data.deleteAll()"));
    expect(en["privacy.leaves.sync"]).toBeTruthy();
    expect(ar["privacy.leaves.link"]).toBeTruthy();
  });

  it("the link needs an explicit consent step before anything is uploaded", () => {
    const f = src("src/screens/FinishScreen.tsx");
    expect(f).toMatch(/setAskLink\(true\)/);
    expect(f.indexOf("link.consent.body")).toBeLessThan(f.indexOf("onPress={shareLink}"));
    expect(f.match(/coachLinks\.create/g)?.length).toBe(1);
  });

  it("sync is off by default: nothing in App.tsx enables it, and it is not in the default settings", () => {
    expect(src("App.tsx")).not.toMatch(/connect\(|useBackup\(/);
  });
});
