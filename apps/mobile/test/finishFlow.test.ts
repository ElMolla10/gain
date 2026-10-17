import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { runFinishFlow } from "../src/logic/finishFlow";
import { ar, en } from "../src/i18n/strings";

function services(over: Partial<Record<"summarize" | "plan" | "preview", () => Promise<unknown>>> = {}) {
  const calls: string[] = [];
  const s = {
    summarize: vi.fn(over.summarize ?? (async () => { calls.push("summarize"); return { id: "s1" }; })),
    onSummary: vi.fn(() => { calls.push("onSummary"); }),
    extras: vi.fn(async () => { calls.push("extras"); }),
    plan: vi.fn(over.plan ?? (async () => { calls.push("plan"); })),
    sync: vi.fn(() => { calls.push("sync"); }),
    preview: vi.fn(over.preview ?? (async () => { calls.push("preview"); return { dayName: "Push" }; })),
    achievements: vi.fn(async () => { calls.push("achievements"); }),
    onForecast: vi.fn((_f: unknown) => { calls.push("onForecast"); }),
    record: vi.fn(),
  };
  return { s: s as unknown as Parameters<typeof runFinishFlow<{ id: string }, { dayName: string }>>[0] & typeof s, calls };
}

describe("13 Finish screen: summary first, planning/forecast failures are not fatal", () => {
  it("happy path keeps the side-effect order and shows the forecast", async () => {
    const { s, calls } = services();
    expect(await runFinishFlow(s)).toBe("ok");
    expect(calls).toEqual(["summarize", "onSummary", "extras", "plan", "sync", "preview", "achievements", "onForecast"]);
    expect(s.onForecast).toHaveBeenCalledWith({ dayName: "Push" });
    expect(s.record).not.toHaveBeenCalled();
  });
  it("summary ok + plan throws: warn, the forecast still shows, no error state", async () => {
    const { s } = services({ plan: async () => { throw new Error("db"); } });
    expect(await runFinishFlow(s)).toBe("ok");
    expect(s.onSummary).toHaveBeenCalledOnce();
    expect(s.record).toHaveBeenCalledWith("warn", "finish plan next", expect.any(Error));
    expect(s.sync).toHaveBeenCalledOnce();
    expect(s.onForecast).toHaveBeenCalledWith({ dayName: "Push" });
  });
  it("summary ok + preview throws: warn, forecast is 'none', achievements still run", async () => {
    const { s } = services({ preview: async () => { throw new Error("engine"); } });
    expect(await runFinishFlow(s)).toBe("ok");
    expect(s.record).toHaveBeenCalledWith("warn", "finish forecast", expect.any(Error));
    expect(s.achievements).toHaveBeenCalledOnce();
    expect(s.onForecast).toHaveBeenCalledWith("none");
  });
  it("both plan and preview throw: summary shows, forecast 'none', no error state", async () => {
    const { s } = services({ plan: async () => { throw new Error("a"); }, preview: async () => { throw new Error("b"); } });
    expect(await runFinishFlow(s)).toBe("ok");
    expect(s.onSummary).toHaveBeenCalledOnce();
    expect(s.onForecast).toHaveBeenCalledWith("none");
  });
  it("summary throws: error state only, nothing else runs", async () => {
    const { s } = services({ summarize: async () => { throw new Error("db"); } });
    expect(await runFinishFlow(s)).toBe("failed");
    expect(s.record).toHaveBeenCalledWith("error", "finish summary", expect.any(Error));
    for (const f of [s.onSummary, s.extras, s.plan, s.sync, s.preview, s.achievements, s.onForecast]) expect(f).not.toHaveBeenCalled();
  });
  it("the Finish screen uses its own error copy, never the Workout screen's 'still open' body", () => {
    const f = readFileSync(join(__dirname, "..", "src", "screens", "FinishScreen.tsx"), "utf8");
    expect(f).toContain('t("finish.error.body")');
    expect(f).not.toContain("workout.finishFailed.body");
    expect(f).toContain("runFinishFlow(");
    expect(en["finish.error.body"].length).toBeGreaterThan(5);
    expect(ar["finish.error.body"]).toMatch(/[\u0600-\u06FF]/);
  });
});
