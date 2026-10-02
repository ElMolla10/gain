import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { PermissionResult, RestAlerts } from "../logic/restAlert";

const ID = "rest-timer";
const CHANNEL = "rest-timer";

let configured = false;
async function configure(): Promise<void> {
  if (configured) return;
  configured = true;
  // While GAIN is open the in-app timer already buzzes; do not also show a banner.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false }),
  });
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: "Rest timer",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 400, 200, 400],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }
}

/** Expo implementation of RestAlerts: one local notification at the end of the rest. NOT exercised by the Linux unit tests. */
export function createRestAlerts(): RestAlerts {
  return {
    async ensurePermission(): Promise<PermissionResult> {
      try {
        await configure();
        const cur = await Notifications.getPermissionsAsync();
        if (cur.granted) return "granted";
        const asked = await Notifications.requestPermissionsAsync();
        return asked.granted ? "granted" : "denied";
      } catch {
        return "unavailable";
      }
    },
    async schedule(endsAtMs, text) {
      await configure();
      await Notifications.scheduleNotificationAsync({
        identifier: ID,
        content: { title: text.title, body: text.body, sound: true },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: endsAtMs, channelId: CHANNEL },
      });
    },
    async cancel() {
      await Notifications.cancelScheduledNotificationAsync(ID).catch(() => undefined);
    },
  };
}
