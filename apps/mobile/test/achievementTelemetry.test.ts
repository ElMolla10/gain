import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  TELEMETRY_EVENTS,
  TELEMETRY_WINDOW_MS,
  buildChecklistExport,
  createTelemetry,
  emptyTelemetry,
  formatChecklistExport,
  gateCounters,
  memoryStore,
  parseTelemetry,
  recordEvent,
  setConsent,
} from "../src/logic/achievementTelemetry";

let clock = Date.UTC(2026, 9, 16, 12, 0, 0);
const now = () => (clock += 1000);

describe("opt-in default", () => {
  it("starts off, records nothing until the lifter opts in, and keeps the choice", () => {
    const t = createTelemetry(memoryStore(), now);
    expect(t.isOptedIn()).toBe(false);
    expect(t.hasAsked()).toBe(false);
    t.record("progress_opened");
    expect(t.snapshot().events.progress_opened.count).toBe(0);
    t.setOptedIn(true);
    expect(t.isOptedIn()).toBe(true);
    expect(t.hasAsked()).toBe(true);
    t.record("progress_opened");
    expect(t.snapshot().events.progress_opened.count).toBe(1);
    t.setOptedIn(false);
    t.record("progress_opened");
    expect(t.snapshot().events.progress_opened.count).toBe(1);
    expect(createTelemetry(memoryStore(JSON.stringify(t.snapshot())), now).isOptedIn()).toBe(false);
  });
  it("a damaged file is empty and still opted out", () => {
    expect(parseTelemetry("{ not json").optedIn).toBe(false);
    expect(parseTelemetry(JSON.stringify({ v: 99, optedIn: true })).optedIn).toBe(false);
    expect(emptyTelemetry().optedIn).toBe(false);
  });
});

describe("event counting", () => {
  it("increments count and last-occurred, and clear zeros counts while keeping opt-in", () => {
    const store = memoryStore();
    const t = createTelemetry(store, now);
    t.setOptedIn(true);
    t.record("badge_detail");
    t.record("view_workout");
    t.record("share_card");
    t.record("quest_picked");
    t.record("quest_swapped");
    t.record("hero_shown");
    const snap = t.snapshot();
    expect(TELEMETRY_EVENTS.every((e) => typeof snap.events[e].count === "number")).toBe(true);
    expect(snap.events.badge_detail.count).toBe(1);
    expect(snap.events.view_workout.count).toBe(1);
    expect(snap.events.view_workout.lastAt).toBeGreaterThan(0);
    expect(snap.comprehension).toBe(1);
    t.clear();
    expect(t.isOptedIn()).toBe(true);
    expect(t.snapshot().events.badge_detail.count).toBe(0);
    expect(t.snapshot().comprehension).toBe(0);
    expect(t.gates().comprehension).toBe(0);
  });
  it("wipe restores the default-off empty state", () => {
    const t = createTelemetry(memoryStore(), now);
    t.setOptedIn(true);
    t.record("progress_opened");
    t.wipe();
    expect(t.isOptedIn()).toBe(false);
    expect(t.hasAsked()).toBe(false);
    expect(t.snapshot().events.progress_opened.count).toBe(0);
  });
  it("never throws when the disk fails", () => {
    const broken = {
      read: () => {
        throw new Error("io");
      },
      write: () => {
        throw new Error("full");
      },
      remove: () => {
        throw new Error("io");
      },
    };
    const t = createTelemetry(broken, now);
    expect(() => t.record("progress_opened")).not.toThrow();
    expect(() => t.setOptedIn(true)).not.toThrow();
    expect(() => t.clear()).not.toThrow();
    expect(() => t.wipe()).not.toThrow();
    expect(t.snapshot().optedIn).toBe(false);
  });
});

describe("checklist export shape", () => {
  it("carries app version, rule version, session count and answers, and no identity fields", () => {
    const t = createTelemetry(memoryStore(), () => Date.UTC(2026, 9, 16, 15, 0, 0));
    t.saveChecklist({
      explainBadge: "Four qualified weeks",
      nextUp: "12 qualified weeks",
      feltPenalized: false,
      unexpectedRevoke: true,
      unexpectedNote: "Edited a warmup",
    });
    const exp = t.exportChecklist({ appVersion: "0.22.0", achievementRuleVersion: 1, sessionCount: 17 });
    expect(exp).toEqual({
      kind: "gain.pilot-checklist",
      appVersion: "0.22.0",
      achievementRuleVersion: 1,
      sessionCount: 17,
      exportedAt: "2026-10-16T15:00:00.000Z",
      answers: {
        explainBadge: "Four qualified weeks",
        nextUp: "12 qualified weeks",
        feltPenalized: false,
        unexpectedRevoke: true,
        unexpectedNote: "Edited a warmup",
      },
    });
    expect(JSON.parse(formatChecklistExport(exp))).toEqual(exp);
    const keys = Object.keys(exp).sort();
    expect(keys).toEqual(["achievementRuleVersion", "answers", "appVersion", "exportedAt", "kind", "sessionCount"]);
    expect(JSON.stringify(exp)).not.toMatch(/email|gym|bodyweight|nameEn|phone/i);
    t.saveChecklist({
      explainBadge: "Four qualified weeks",
      nextUp: "12 qualified weeks",
      feltPenalized: false,
      unexpectedRevoke: true,
      unexpectedNote: "Edited a warmup",
    });
    expect(t.gates().engineIntegrity).toBe(1);
  });
});

describe("release-gate counters", () => {
  it("maps view-workout to comprehension, yes-answers to rest/integrity, and 28-day opens/shares to engagement", () => {
    const start = Date.UTC(2026, 8, 1, 12, 0, 0);
    let on = setConsent(emptyTelemetry(), true);
    on = recordEvent(on, "progress_opened", start);
    on = recordEvent(on, "share_card", start);
    on = recordEvent(on, "badge_detail", start);
    on = recordEvent(on, "view_workout", start);
    on = {
      ...on,
      penalizedYes: 2,
      revokeYes: 1,
    };
    const later = start + TELEMETRY_WINDOW_MS + 1;
    on = recordEvent(on, "progress_opened", later);
    const g = gateCounters(on, later);
    expect(g.comprehension).toBe(1);
    expect(g.restDaySafety).toBe(2);
    expect(g.engineIntegrity).toBe(1);
    expect(g.engagement.progressOpened28d).toBe(1);
    expect(g.engagement.shareCards28d).toBe(0);
    expect(buildChecklistExport(on, { appVersion: "x", achievementRuleVersion: 1, sessionCount: 0, now: later }).kind).toBe("gain.pilot-checklist");
  });
});

describe("telemetry never touches the next-set path", () => {
  it("next-set, live-adaptation and progression modules do not import achievement telemetry", () => {
    const files = [
      join(__dirname, "../src/db/workoutRepo.ts"),
      join(__dirname, "../src/db/finishRepo.ts"),
      join(__dirname, "../src/logic/liveAdaptation.ts"),
      join(__dirname, "../src/logic/why.ts"),
      join(__dirname, "../../../packages/engine/src/progression.ts"),
      join(__dirname, "../../../packages/engine/src/timed.ts"),
      join(__dirname, "../../../packages/engine/src/liveAdaptationDecision.ts"),
    ];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/achievementTelemetry|gain-achievement-telemetry/);
    }
  });
  it("the telemetry module and its screens never open a network", () => {
    const root = join(__dirname, "..");
    const files = [
      "src/logic/achievementTelemetry.ts",
      "src/achievementTelemetry.ts",
      "src/screens/PilotChecklistScreen.tsx",
      "src/screens/DiagnosticsScreen.tsx",
    ];
    for (const f of files) {
      const src = readFileSync(join(root, f), "utf8");
      expect(src, f).not.toMatch(/fetch\s*\(|XMLHttpRequest|WebSocket|https?:\/\/|expo-network|@?\bsentry\b|firebase|crashlytics|analytics/i);
    }
  });
  it("no source file under db/ or engine progression records telemetry", () => {
    const dbDir = join(__dirname, "../src/db");
    for (const n of readdirSync(dbDir).filter((f) => f.endsWith(".ts"))) {
      const src = readFileSync(join(dbDir, n), "utf8");
      expect(src, n).not.toMatch(/from ["'].*achievementTelemetry/);
    }
  });
});
