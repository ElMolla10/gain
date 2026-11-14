/**
 * When to ask for an App Store rating (pure, so it is tested without a phone).
 *
 * Ask only after a finished workout: on the 3rd completed session, or when that
 * finish yields a load increase (whichever comes first). At most once per 120 days
 * and at most 3 times in total. Never on first launch (there is no finished session
 * yet) and never during a workout — the caller only runs this from Finish. There is
 * no custom pre-prompt; Apple's own dialog is used when the store API is available.
 */
export const STORE_REVIEW_ATTEMPTS_KEY = "store_review_attempts";
export const STORE_REVIEW_MIN_SESSIONS = 3;
export const STORE_REVIEW_MAX_ATTEMPTS = 3;
export const STORE_REVIEW_COOLDOWN_MS = 120 * 24 * 60 * 60 * 1000;

const LOAD_UP_REASONS = new Set(["load_up", "timed_load_up"]);

/** True when the finish forecast proposes a heavier next-session load for at least one exercise. */
export function finishYieldsLoadIncrease(reasonKeys: readonly (string | null | undefined)[]): boolean {
  return reasonKeys.some((key) => key != null && LOAD_UP_REASONS.has(key));
}

export function parseReviewAttempts(raw: string | null | undefined): number[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter((n): n is number => typeof n === "number" && Number.isFinite(n)).sort((a, b) => a - b);
  } catch {
    return [];
  }
}

export function serializeReviewAttempts(timestamps: readonly number[]): string {
  return JSON.stringify([...timestamps].sort((a, b) => a - b));
}

export function shouldRequestReview(input: {
  completedSessionCount: number;
  loadIncreased: boolean;
  attemptTimestamps: readonly number[];
  now: number;
  isAvailable: boolean;
}): boolean {
  if (!input.isAvailable) return false;
  // A finished workout is required, so this never fires on first launch.
  if (input.completedSessionCount < 1) return false;
  if (input.attemptTimestamps.length >= STORE_REVIEW_MAX_ATTEMPTS) return false;
  const last = input.attemptTimestamps[input.attemptTimestamps.length - 1];
  if (last != null && input.now - last < STORE_REVIEW_COOLDOWN_MS) return false;
  if (input.loadIncreased) return true;
  return input.completedSessionCount >= STORE_REVIEW_MIN_SESSIONS;
}

/** Persist the attempt first so a remount cannot double-prompt, then show Apple's dialog. */
export async function maybeRequestStoreReview(deps: {
  getSetting: (key: string) => Promise<string | null>;
  setSetting: (key: string, value: string) => Promise<void>;
  completedSessionCount: number;
  loadIncreased: boolean;
  isAvailable: () => Promise<boolean>;
  requestReview: () => Promise<void>;
  now?: number;
  onError?: (error: unknown) => void;
}): Promise<boolean> {
  try {
    const now = deps.now ?? Date.now();
    const attempts = parseReviewAttempts(await deps.getSetting(STORE_REVIEW_ATTEMPTS_KEY));
    const isAvailable = await deps.isAvailable();
    if (!shouldRequestReview({
      completedSessionCount: deps.completedSessionCount,
      loadIncreased: deps.loadIncreased,
      attemptTimestamps: attempts,
      now,
      isAvailable,
    })) return false;
    await deps.setSetting(STORE_REVIEW_ATTEMPTS_KEY, serializeReviewAttempts([...attempts, now]));
    await deps.requestReview();
    return true;
  } catch (error) {
    deps.onError?.(error);
    return false;
  }
}
