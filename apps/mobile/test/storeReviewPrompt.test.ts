import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  STORE_REVIEW_ATTEMPTS_KEY,
  STORE_REVIEW_COOLDOWN_MS,
  STORE_REVIEW_MAX_ATTEMPTS,
  STORE_REVIEW_MIN_SESSIONS,
  finishYieldsLoadIncrease,
  maybeRequestStoreReview,
  parseReviewAttempts,
  serializeReviewAttempts,
  shouldRequestReview,
} from "../src/logic/storeReviewPrompt";

const day = 24 * 60 * 60 * 1000;
const now = 1_700_000_000_000;
const read = (f: string) => readFileSync(join(__dirname, "..", f), "utf8");

describe("finishYieldsLoadIncrease", () => {
  it("is true only for a heavier next-session load", () => {
    expect(finishYieldsLoadIncrease([])).toBe(false);
    expect(finishYieldsLoadIncrease(["hold", "reps_in_range"])).toBe(false);
    expect(finishYieldsLoadIncrease(["load_up"])).toBe(true);
    expect(finishYieldsLoadIncrease(["hold", "timed_load_up"])).toBe(true);
    expect(finishYieldsLoadIncrease([null, undefined])).toBe(false);
  });
});

describe("review attempt storage", () => {
  it("round-trips timestamps and ignores junk", () => {
    expect(parseReviewAttempts(null)).toEqual([]);
    expect(parseReviewAttempts("")).toEqual([]);
    expect(parseReviewAttempts("not-json")).toEqual([]);
    expect(parseReviewAttempts("{}")).toEqual([]);
    expect(parseReviewAttempts(serializeReviewAttempts([now + 5, now]))).toEqual([now, now + 5]);
    expect(STORE_REVIEW_ATTEMPTS_KEY).toBe("store_review_attempts");
    expect(STORE_REVIEW_MIN_SESSIONS).toBe(3);
    expect(STORE_REVIEW_MAX_ATTEMPTS).toBe(3);
    expect(STORE_REVIEW_COOLDOWN_MS).toBe(120 * day);
  });
});

describe("shouldRequestReview", () => {
  const base = { completedSessionCount: 3, loadIncreased: false, attemptTimestamps: [] as number[], now, isAvailable: true };

  it("does not ask when the store API is unavailable, on first launch, or before the 3rd session with no load increase", () => {
    expect(shouldRequestReview({ ...base, isAvailable: false })).toBe(false);
    expect(shouldRequestReview({ ...base, completedSessionCount: 0, loadIncreased: true })).toBe(false);
    expect(shouldRequestReview({ ...base, completedSessionCount: 1 })).toBe(false);
    expect(shouldRequestReview({ ...base, completedSessionCount: 2 })).toBe(false);
  });

  it("asks after the 3rd completed session, or earlier when the finish yields a load increase", () => {
    expect(shouldRequestReview(base)).toBe(true);
    expect(shouldRequestReview({ ...base, completedSessionCount: 1, loadIncreased: true })).toBe(true);
    expect(shouldRequestReview({ ...base, completedSessionCount: 2, loadIncreased: true })).toBe(true);
  });

  it("asks at most once per 120 days and at most 3 times in total", () => {
    expect(shouldRequestReview({ ...base, attemptTimestamps: [now - 119 * day] })).toBe(false);
    expect(shouldRequestReview({ ...base, attemptTimestamps: [now - 120 * day] })).toBe(true);
    expect(shouldRequestReview({ ...base, loadIncreased: true, attemptTimestamps: [now - 10 * day] })).toBe(false);
    expect(shouldRequestReview({ ...base, attemptTimestamps: [now - 400 * day, now - 250 * day, now - 130 * day] })).toBe(false);
  });
});

describe("maybeRequestStoreReview", () => {
  it("records the attempt then shows Apple's dialog", async () => {
    const setSetting = vi.fn().mockResolvedValue(undefined);
    const requestReview = vi.fn().mockResolvedValue(undefined);
    const asked = await maybeRequestStoreReview({
      getSetting: async () => serializeReviewAttempts([now - 200 * day]),
      setSetting,
      completedSessionCount: 3,
      loadIncreased: false,
      isAvailable: async () => true,
      requestReview,
      now,
    });
    expect(asked).toBe(true);
    expect(setSetting).toHaveBeenCalledWith(STORE_REVIEW_ATTEMPTS_KEY, serializeReviewAttempts([now - 200 * day, now]));
    expect(requestReview).toHaveBeenCalledTimes(1);
    expect(setSetting.mock.invocationCallOrder[0]!).toBeLessThan(requestReview.mock.invocationCallOrder[0]!);
  });

  it("does not write or prompt when the rules say no", async () => {
    const setSetting = vi.fn();
    const requestReview = vi.fn();
    const asked = await maybeRequestStoreReview({
      getSetting: async () => "[]",
      setSetting,
      completedSessionCount: 2,
      loadIncreased: false,
      isAvailable: async () => true,
      requestReview,
      now,
    });
    expect(asked).toBe(false);
    expect(setSetting).not.toHaveBeenCalled();
    expect(requestReview).not.toHaveBeenCalled();
  });
});

describe("Finish asks after a successful finish, never mid-workout, and never with a custom pre-prompt", () => {
  it("wires the native store dialog into Finish and leaves the logger alone", () => {
    const finish = read("src/screens/FinishScreen.tsx");
    const workout = read("src/hooks/useWorkoutSession.ts") + read("src/screens/WorkoutScreen.tsx");
    expect(finish).toMatch(/maybeRequestStoreReview/);
    expect(finish).toMatch(/StoreReview\.isAvailableAsync/);
    expect(finish).toMatch(/StoreReview\.hasAction/);
    expect(finish).toMatch(/StoreReview\.requestReview/);
    expect(finish).not.toMatch(/Alert\.alert\([^)]*review/i);
    expect(workout).not.toMatch(/maybeRequestStoreReview|StoreReview/);
  });
});
