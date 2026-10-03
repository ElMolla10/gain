import { describe, expect, it } from "vitest";
import { appendEntry, buildReport, createDiagnostics, installCrashHandler, makeEntry, memoryStore, MAX_ENTRIES, MAX_MESSAGE, parseDiagFile, redact, type DiagStore } from "../src/logic/diagnostics";

const ctx = { appVersion: "0.10.0", platform: "android", osVersion: 34, language: "en", schemaVersion: 7 };
let clock = Date.UTC(2026, 9, 3, 9, 0, 0);
const now = () => (clock += 1000);

describe("crash log entries", () => {
  it("keeps the kind of error, a short message and a trimmed stack, never more", () => {
    const e = new Error("x".repeat(2000));
    const en = makeEntry("error", "somewhere", e, 5);
    expect(en.message.length).toBeLessThanOrEqual(MAX_MESSAGE);
    expect(en.message.startsWith("Error: xxx")).toBe(true);
    expect(en.stack!.split("\n").length).toBeLessThanOrEqual(12);
  });
  it("redacts e-mail addresses, file paths and URIs", () => {
    expect(redact("mail me@example.com now")).toBe("mail [email] now");
    expect(redact("failed at /data/user/0/app.gain.mobile/files/backup-Mohamed.json ok")).toBe("failed at …/backup-Mohamed.json ok");
    expect(redact("open file:///storage/emulated/0/Download/x.csv")).toBe("open …/x.csv");
    expect(redact("content://app.gain.mobile.provider/cache/a.apk")).toBe("…/a.apk");
    expect(redact("a/b is a ratio and 3/4 stays")).toContain("3/4");
  });
  it("handles non-Error throws (strings, objects, circular)", () => {
    expect(makeEntry("error", "w", "boom", 1).message).toBe("boom");
    expect(makeEntry("error", "w", { code: 7 }, 1).message).toBe('{"code":7}');
    const c: Record<string, unknown> = {};
    c.self = c;
    expect(typeof makeEntry("error", "w", c, 1).message).toBe("string");
    expect(makeEntry("error", "w", undefined, 1).message).toBeTruthy();
  });
  it("the same error again in a row only counts up; the log keeps the newest 50", () => {
    let list = appendEntry([], makeEntry("error", "w", "a", 1));
    list = appendEntry(list, makeEntry("error", "w", "a", 9));
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ count: 2, at: 1, last: 9 });
    for (let i = 0; i < 80; i++) list = appendEntry(list, makeEntry("error", "w", `e${i}`, i));
    expect(list).toHaveLength(MAX_ENTRIES);
    expect(list[list.length - 1]!.message).toBe("e79");
  });
});

describe("diagnostics log on a store", () => {
  it("records, lists, clears, and survives a damaged file", () => {
    const store = memoryStore();
    const d = createDiagnostics(store, now);
    d.record("crash", "render", new Error("bad"));
    d.record("warn", "x", "w");
    expect(d.entries().map((e) => e.kind)).toEqual(["crash", "warn"]);
    d.clear();
    expect(d.entries()).toEqual([]);
    store.write("{ not json");
    expect(d.entries()).toEqual([]);
    d.record("error", "y", "after damage");
    expect(d.entries()).toHaveLength(1);
    expect(parseDiagFile(JSON.stringify({ v: 1, entries: [{ nope: 1 }, makeEntry("error", "w", "ok", 1)] })).entries).toHaveLength(1);
  });
  it("when switched off nothing is recorded (and the choice is kept in the file)", () => {
    const store = memoryStore();
    const d = createDiagnostics(store, now);
    d.setEnabled(false);
    d.record("crash", "render", "x");
    expect(d.entries()).toEqual([]);
    expect(createDiagnostics(store, now).isEnabled()).toBe(false);
    d.setEnabled(true);
    d.record("crash", "render", "x");
    expect(d.entries()).toHaveLength(1);
  });
  it("never throws, even when the disk fails", () => {
    const broken: DiagStore = { read: () => { throw new Error("io"); }, write: () => { throw new Error("full"); }, remove: () => { throw new Error("io"); } };
    const d = createDiagnostics(broken, now);
    expect(() => d.record("crash", "w", "x")).not.toThrow();
    expect(() => d.setEnabled(false)).not.toThrow();
    expect(() => d.clear()).not.toThrow();
    expect(d.entries()).toEqual([]);
  });
});

describe("the report", () => {
  it("says what it is, lists entries, and contains no workout data", () => {
    const store = memoryStore();
    const d = createDiagnostics(store, now);
    d.record("crash", "uncaught", new TypeError("undefined is not a function"));
    const text = d.report(ctx);
    expect(text).toContain("no sets, weights, names, notes or goals");
    expect(text).toContain("App version: 0.10.0");
    expect(text).toContain("Database schema: 7");
    expect(text).toContain("CRASH at uncaught");
    expect(text).toContain("TypeError: undefined is not a function");
    expect(buildReport([], { ...ctx, generatedAt: 0 })).toContain("No problems recorded.");
  });
});

describe("global error hook", () => {
  function fakeHook() {
    let handler = (_e: unknown, _f?: boolean) => void 0;
    const calls: unknown[] = [];
    handler = (e) => void calls.push(e);
    return { calls, get: () => handler, hook: { getGlobalHandler: () => handler, setGlobalHandler: (h: typeof handler) => void (handler = h) } };
  }
  it("fatal errors are logged as crash, non-fatal as error, and the previous handler still runs", () => {
    const f = fakeHook();
    const d = createDiagnostics(memoryStore(), now);
    expect(installCrashHandler(d, f.hook)).toBe(true);
    f.get()(new Error("one"), true);
    f.get()(new Error("two"), false);
    expect(d.entries().map((e) => e.kind)).toEqual(["crash", "error"]);
    expect(f.calls).toHaveLength(2);
  });
  it("installing twice does not stack handlers; no hook is fine", () => {
    const f = fakeHook();
    const d = createDiagnostics(memoryStore(), now);
    installCrashHandler(d, f.hook);
    expect(installCrashHandler(d, f.hook)).toBe(false);
    f.get()(new Error("once"), false);
    expect(d.entries()[0]!.count).toBe(1);
    expect(installCrashHandler(d, undefined)).toBe(false);
  });
});

describe("no network in the diagnostics code (the privacy text depends on this)", () => {
  it("the logger, its file store and its screen never touch the network", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    for (const f of ["src/logic/diagnostics.ts", "src/diagnostics/index.ts", "src/screens/DiagnosticsScreen.tsx", "src/components/ErrorBoundary.tsx"]) {
      const src = readFileSync(join(__dirname, "..", f), "utf8");
      expect(src, f).not.toMatch(/fetch\s*\(|XMLHttpRequest|WebSocket|https?:\/\/|expo-network|@?\bsentry\b|firebase|crashlytics|analytics/i);
    }
  });
});
