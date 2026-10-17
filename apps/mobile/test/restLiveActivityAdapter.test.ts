import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ os: "android", version: 36 as number | string, enabled: true }));
vi.mock("react-native", () => ({ Platform: { get OS() { return state.os; }, get Version() { return state.version; } } }));
vi.mock("expo-constants", () => ({ default: { expoConfig: { extra: { get restLiveActivityEnabled() { return state.enabled; } } } } }));
// These unsupported cases must return before touching any native package.
describe("rest Live Activity platform boundary", () => {
  beforeEach(() => { vi.resetModules(); state.os = "android"; state.version = 36; state.enabled = true; });
  for (const [name, os, version, enabled] of [
    ["Android", "android", 36, true], ["older iOS", "ios", "15.8", true], ["free Apple ID binary", "ios", "18.0", false],
  ] as const) {
    it(`does not load widgets for ${name}`, async () => {
      state.os = os; state.version = version; state.enabled = enabled;
      const { restLiveActivity } = await import("../src/native/restLiveActivity");
      await expect(restLiveActivity.sync({ endsAt: Date.now() + 60000, durationMs: 60000, label: "Squat" })).resolves.toBeUndefined();
      await expect(restLiveActivity.stop()).resolves.toBeUndefined();
    });
  }
});
