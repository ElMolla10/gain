/** Settings key for "Keep screen on during workouts": "1" / "0"; unset = on (the default). */
export const KEEP_AWAKE_KEY = "workout_keep_awake";
/** The keep-awake tag the logger owns, so it never releases another feature's lock. */
export const KEEP_AWAKE_TAG = "gain-workout";

export const keepAwakeSetting = (raw: string | null | undefined): boolean => raw !== "0";

/** Keep the screen on only while the setting is on, the Workout screen is focused and a session is open (not finished, not discarded). */
export function shouldKeepAwake(p: { setting: boolean | string | null | undefined; focused: boolean; sessionOpen: boolean }): boolean {
  const on = typeof p.setting === "boolean" ? p.setting : keepAwakeSetting(p.setting);
  return on && p.focused && p.sessionOpen;
}
