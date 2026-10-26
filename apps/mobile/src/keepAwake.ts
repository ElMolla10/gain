import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { diagnostics } from "./diagnostics";
import { KEEP_AWAKE_TAG } from "./logic/keepAwake";

/** Keep the screen on (or let it lock again). Never throws: failing to keep awake must never affect logging. */
export function setKeepAwake(on: boolean): void {
  try {
    if (on) void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch((e: unknown) => diagnostics.record("warn", "keep awake", e));
    else void Promise.resolve(deactivateKeepAwake(KEEP_AWAKE_TAG)).catch((e: unknown) => diagnostics.record("warn", "keep awake", e));
  } catch (e) {
    diagnostics.record("warn", "keep awake", e);
  }
}
