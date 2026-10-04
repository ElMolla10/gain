/**
 * Loading, empty and error are three different things. A screen that treats a failed read as "nothing here" tells a lifter with a
 * program that they have none. `runLoad` keeps them apart: null means empty, a throw means error (retry), a value means ready.
 */
export type Load<T> = { kind: "loading" } | { kind: "empty" } | { kind: "error" } | { kind: "ready"; data: T };

export const LOADING: Load<never> = { kind: "loading" };

export async function runLoad<T>(fn: () => Promise<T | null>, onError?: (e: unknown) => void): Promise<Load<T>> {
  try {
    const v = await fn();
    return v === null ? { kind: "empty" } : { kind: "ready", data: v };
  } catch (e) {
    onError?.(e);
    return { kind: "error" };
  }
}

/**
 * Finishing a workout: never throws (an async rethrow in an event handler crashes the app). On failure the workout stays active and
 * the lifter gets a retry. Returns "done" after `then` ran, "failed" when finishing itself failed.
 */
export async function attemptFinish(finishFn: () => Promise<void>, then: () => void, onError?: (e: unknown) => void): Promise<"done" | "failed"> {
  try {
    await finishFn();
    then();
    return "done";
  } catch (e) {
    onError?.(e);
    return "failed";
  }
}
