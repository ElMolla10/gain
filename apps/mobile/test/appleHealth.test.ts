import { readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { exportFinishedSession, healthWindow, shouldWriteToHealth, type HealthExportSession } from "../src/logic/appleHealth";
import { freshDb } from "./helpers";

const require = createRequire(import.meta.url);
const { applyAppleHealthConfig, HEALTH_TEXT } = require("../plugins/apple-health-config");
const config = { ios: { bundleIdentifier: "com.example.gain" }, android: { permissions: [] }, plugins: ["./plugins/without-push-entitlement"] };
const MIN = 60_000;

describe("Apple Health export: build flag (batch item 29)", () => {
  it("flag off (unset or '0'): config unchanged, no plugin, no extra", () => {
    expect(applyAppleHealthConfig(config, {})).toBe(config);
    expect(applyAppleHealthConfig(config, { GAIN_IOS_HEALTHKIT: "0" })).toBe(config);
  });
  it("'1' adds the plugin with background: false and the usage text; Android untouched", () => {
    const r = applyAppleHealthConfig(config, { GAIN_IOS_HEALTHKIT: "1" });
    expect(r.plugins).toContainEqual(["@kingstinct/react-native-healthkit", { NSHealthUpdateUsageDescription: HEALTH_TEXT, NSHealthShareUsageDescription: HEALTH_TEXT, background: false }]);
    expect(HEALTH_TEXT).toBe("GAIN saves your finished workouts to Apple Health.");
    expect(r.extra.appleHealthEnabled).toBe(true);
    expect(r.android).toEqual(config.android);
    expect(r.ios).toEqual(config.ios);
  });
  it("rejects a misspelled flag", () => {
    expect(() => applyAppleHealthConfig(config, { GAIN_IOS_HEALTHKIT: "true" })).toThrow("GAIN_IOS_HEALTHKIT");
  });
  it("autolinking keeps the native modules out unless the flag is on", () => {
    const load = (env: string | undefined) => {
      const prev = process.env.GAIN_IOS_HEALTHKIT;
      if (env === undefined) delete process.env.GAIN_IOS_HEALTHKIT; else process.env.GAIN_IOS_HEALTHKIT = env;
      delete require.cache[require.resolve("../react-native.config.js")];
      try { return require("../react-native.config.js"); } finally { if (prev === undefined) delete process.env.GAIN_IOS_HEALTHKIT; else process.env.GAIN_IOS_HEALTHKIT = prev; }
    };
    const off = load(undefined).dependencies;
    expect(off["@kingstinct/react-native-healthkit"].platforms).toEqual({ ios: null, android: null });
    expect(off["react-native-nitro-modules"].platforms).toEqual({ ios: null, android: null });
    const on = load("1").dependencies;
    expect(on["@kingstinct/react-native-healthkit"].platforms).toEqual({ android: null });
  });
});

describe("Apple Health export: time window and write rules", () => {
  it("uses the real start and end; active time drops pauses", () => {
    expect(healthWindow({ startedAt: 1_000_000, finishedAt: 1_000_000 + 60 * MIN, pausedMs: 10 * MIN, sets: 12 })).toEqual({ start: 1_000_000, end: 1_000_000 + 60 * MIN, activeMs: 50 * MIN, estimated: false });
  });
  it("null start: finished - max(60 s, sets × 3 min), marked estimated", () => {
    expect(healthWindow({ startedAt: null, finishedAt: 100 * MIN, pausedMs: 0, sets: 10 })).toEqual({ start: 70 * MIN, end: 100 * MIN, activeMs: 30 * MIN, estimated: true });
    expect(healthWindow({ startedAt: null, finishedAt: 100 * MIN, pausedMs: 0, sets: 0 })).toMatchObject({ start: 99 * MIN, estimated: true });
  });
  it("only on, not imported, not written yet", () => {
    const s: HealthExportSession = { id: "s", startedAt: 0, finishedAt: MIN, pausedMs: 0, imported: false, healthUuid: null, dayName: "Upper A", sets: 3 };
    expect(shouldWriteToHealth(true, s)).toBe(true);
    expect(shouldWriteToHealth(false, s)).toBe(false);
    expect(shouldWriteToHealth(true, { ...s, imported: true })).toBe(false);
    expect(shouldWriteToHealth(true, { ...s, healthUuid: "u" })).toBe(false);
    expect(shouldWriteToHealth(true, null)).toBe(false);
  });
  it("exports once with metadata and no calories; failures only reach onError", async () => {
    const s: HealthExportSession = { id: "s1", startedAt: 0, finishedAt: 40 * MIN, pausedMs: 0, imported: false, healthUuid: null, dayName: "Upper A", sets: 9 };
    const saveWorkout = vi.fn(async () => "HK-1");
    const store = vi.fn(async () => true);
    const onError = vi.fn();
    const deps = { setting: async () => "1", load: async () => s, store, health: { isAvailable: () => true, saveWorkout }, onError };
    await expect(exportFinishedSession("s1", deps)).resolves.toBe("HK-1");
    expect(saveWorkout).toHaveBeenCalledWith({ start: 0, end: 40 * MIN, metadata: { HKMetadataKeyExternalUUID: "s1", GAINDayName: "Upper A", GAINWorkingSets: 9, GAINActiveSeconds: 2400 } });
    expect(store).toHaveBeenCalledWith("s1", "HK-1");
    await expect(exportFinishedSession("s1", { ...deps, setting: async () => null })).resolves.toBeNull();
    await expect(exportFinishedSession("s1", { ...deps, health: { isAvailable: () => false, saveWorkout } })).resolves.toBeNull();
    await expect(exportFinishedSession("s1", { ...deps, health: { isAvailable: () => true, saveWorkout: () => Promise.reject(new Error("denied")) } })).resolves.toBeNull();
    expect(onError).toHaveBeenCalledOnce();
    expect(saveWorkout).toHaveBeenCalledTimes(1);
  });
});

describe("Apple Health export: repo and isolation", () => {
  it("health_uuid is set once and never overwritten; imports are flagged", async () => {
    const c = await freshDb();
    await c.repos.seedIfNeeded();
    const gymId = (await c.repos.getActiveGymId())!;
    const gym = await c.repos.loadGymFingerprint(gymId);
    const next = (await c.repos.getNextDay())!;
    const ex = (await c.repos.listDayExercises(next.day.id))[0]!;
    const { id } = await c.workout.startOrResumeSession(next.day.id, gymId);
    await c.workout.logSet({ sessionId: id, exerciseId: ex.exerciseId, load: 60, reps: 8 }, { gym, equipment: ex.equipment, setup: ex.setup });
    expect(await c.workout.getHealthExport(id)).toBeNull(); // not finished yet
    c.deps.tick(1000);
    await c.workout.finishSession(id);
    const h = (await c.workout.getHealthExport(id))!;
    expect(h).toMatchObject({ id, imported: false, healthUuid: null, sets: 1, dayName: next.day.name });
    expect(await c.workout.setHealthUuid(id, "HK-A")).toBe(true);
    expect(await c.workout.setHealthUuid(id, "HK-B")).toBe(false);
    expect((await c.workout.getHealthExport(id))!.healthUuid).toBe("HK-A");
  });

  it("nothing imports @kingstinct/react-native-healthkit outside native/appleHealth.ts", () => {
    const root = join(__dirname, "../src");
    const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : []; });
    const users = walk(root).filter((f) => readFileSync(f, "utf8").includes("@kingstinct/react-native-healthkit")).map((f) => relative(root, f).split("\\").join("/"));
    expect(users).toEqual(["native/appleHealth.ts"]);
    const native = readFileSync(join(root, "native/appleHealth.ts"), "utf8");
    expect(native).not.toMatch(/^import .*@kingstinct/m); // lazy require only
    expect(native).toContain("appleHealthEnabled !== true");
  });
});

describe("Apple Health export: wiring and strings", () => {
  const src = (f: string) => readFileSync(join(__dirname, "../src", f), "utf8");
  it("Finish fires the export without awaiting it; Settings shows the switch only when available; delete removes the Health entry", () => {
    expect(src("hooks/useWorkoutSession.ts")).toContain(".then(() => { saveToAppleHealth(lo.sessionId); })");
    const settings = src("screens/SettingsScreen.tsx");
    expect(settings).toContain('Platform.OS === "ios" && appleHealth.isAvailable()');
    expect(settings).toContain("if (!available) return null;");
    expect(src("screens/SessionDetailScreen.tsx")).toContain("appleHealth.deleteWorkout(health.healthUuid)");
  });
  it("EN and AR strings; brand names isolated in Arabic", async () => {
    const { en, ar } = await import("../src/i18n/strings");
    expect(en["health.apple.save"]).toBe("Save workouts to Apple Health");
    expect(ar["health.apple.save"]).toBe("احفظ التمارين في \u2066Apple Health\u2069");
    expect(en["health.apple.denied"]).toContain("Settings → Health → Data Access");
    expect(ar["health.apple.note"]).toContain("\u2066GAIN\u2069 مش بيقرا");
  });
});
