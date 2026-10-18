import { Platform, Vibration } from "react-native";
import * as Haptics from "expo-haptics";

/**
 * Light, native haptics on iPhone; Android keeps exactly its old feel (no tick haptics, the same Vibration calls).
 * Fire-and-forget: never awaited before logging, and a failure is ignored (iOS also mutes them when system haptics are off).
 */
const ios = () => Platform.OS === "ios";
const run = (p: () => Promise<void>) => { try { void p().catch(() => undefined); } catch { /* unavailable */ } };

export const haptics = {
  tick() { if (ios()) run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)); },
  untick() { if (ios()) run(() => Haptics.selectionAsync()); },
  restOver() { if (ios()) run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)); else Vibration.vibrate(400); },
  /** Earn moment: the medal lands (iOS Medium). Android stays silent. */
  land() { if (ios()) run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)); },
  /** Earn moment, Legacy medals only: the ring pulse (iOS Heavy). Android stays silent. */
  legacy() { if (ios()) run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)); },
  celebrate() { if (ios()) run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)); else Vibration.vibrate(40); },
};
