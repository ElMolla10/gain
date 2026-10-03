import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { REMINDER_ID_PREFIX, type ReminderPermission, type Reminders } from "../logic/reminders";

const CHANNEL = "training-reminders";

let configured = false;
async function configure(): Promise<void> {
  if (configured) return;
  configured = true;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL, { name: "Training-day reminders", importance: Notifications.AndroidImportance.DEFAULT });
  }
}

async function cancelOurs(): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of all) if (n.identifier.startsWith(REMINDER_ID_PREFIX)) await Notifications.cancelScheduledNotificationAsync(n.identifier);
}

/** Expo implementation of Reminders: one repeating weekly local notification per chosen weekday. NOT exercised by the Linux unit tests; NOT verified on a phone. */
export function createReminders(): Reminders {
  return {
    async ensurePermission(): Promise<ReminderPermission> {
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
    async replaceAll(slots, text) {
      await configure();
      await cancelOurs();
      for (const s of slots) {
        await Notifications.scheduleNotificationAsync({
          identifier: s.id,
          content: { title: text.title, body: text.body },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: s.weekday, hour: s.hour, minute: s.minute, channelId: CHANNEL },
        });
      }
    },
    async cancelAll() {
      await cancelOurs().catch(() => undefined);
    },
  };
}
