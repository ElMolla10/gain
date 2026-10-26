import Constants from "expo-constants";
import { Platform } from "react-native";
import type { AppleHealthWriter } from "../logic/appleHealth";

/**
 * Apple Health (HealthKit), write-only: finished workouts. The ONLY file that touches @kingstinct/react-native-healthkit.
 * Lazy-required, so Android, Expo Go and builds without GAIN_IOS_HEALTHKIT=1 (module not linked) never load it.
 */
type HK = typeof import("@kingstinct/react-native-healthkit");

const WORKOUT_TYPE = "HKWorkoutTypeIdentifier";
const TRADITIONAL_STRENGTH_TRAINING = 50; // HKWorkoutActivityType.traditionalStrengthTraining
const SHARING_AUTHORIZED = 2; // HKAuthorizationStatus.sharingAuthorized

let hk: HK | null | undefined;
function load(): HK | null {
  if (hk !== undefined) return hk;
  hk = null;
  if (Platform.OS !== "ios" || Constants.expoConfig?.extra?.appleHealthEnabled !== true) return hk;
  // Without the linked native side (flag-off builds), the require throws: treat as unavailable.
  try {
    hk = require("@kingstinct/react-native-healthkit") as HK;
  } catch {
    hk = null;
  }
  return hk;
}

export function isAvailable(): boolean {
  try {
    const m = load();
    return !!m && m.isHealthDataAvailable();
  } catch {
    return false;
  }
}

/** Ask to write workouts (no reads). True when GAIN may write them. */
export async function requestWrite(): Promise<boolean> {
  const m = load();
  if (!m) return false;
  await m.requestAuthorization({ toShare: [WORKOUT_TYPE] as never, toRead: [] });
  return (m.authorizationStatusFor(WORKOUT_TYPE as never) as unknown as number) === SHARING_AUTHORIZED;
}

export async function saveWorkout(w: { start: number; end: number; metadata: Record<string, string | number | boolean> }): Promise<string> {
  const m = load();
  if (!m) throw new Error("Apple Health unavailable");
  const saved = await m.saveWorkoutSample(TRADITIONAL_STRENGTH_TRAINING as never, [], new Date(w.start), new Date(w.end), undefined, w.metadata as never);
  return saved.uuid;
}

/** Best effort: remove a workout GAIN wrote. */
export async function deleteWorkout(uuid: string): Promise<void> {
  const m = load();
  if (!m) return;
  await m.deleteObjects(WORKOUT_TYPE as never, { uuid } as never);
}

export const appleHealth: AppleHealthWriter & { requestWrite: typeof requestWrite; deleteWorkout: typeof deleteWorkout } = {
  isAvailable, saveWorkout, requestWrite, deleteWorkout,
};
