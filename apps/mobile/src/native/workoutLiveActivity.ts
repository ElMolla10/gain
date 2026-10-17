import Constants from "expo-constants";
import { Platform } from "react-native";
import { createWorkoutLiveActivityController, type WorkoutActivityFactory } from "../logic/workoutLiveActivityController";

let factory: WorkoutActivityFactory | undefined;
export const workoutLiveActivity = createWorkoutLiveActivityController(() => {
  const extra = Constants.expoConfig?.extra;
  if (Platform.OS !== "ios" || Number.parseFloat(String(Platform.Version)) < 16.4 || extra?.restLiveActivityEnabled !== true) return null;
  // Defer native initialization. Old binaries, Expo Go, Android, and free-ID builds
  // must keep working even though their native widget module/extension is absent.
  const { requireOptionalNativeModule } = require("expo") as typeof import("expo");
  if (!requireOptionalNativeModule("ExpoWidgets")) return null;
  if (!factory) {
    const layout = require("./workoutLiveActivityLayout") as typeof import("./workoutLiveActivityLayout");
    const main = layout.default;
    factory = {
      getInstances: () => main.getInstances(),
      start: (props, url, staleDate) => main.start(props, url, staleDate),
      legacy: { getInstances: () => layout.legacyRestActivity.getInstances() },
    };
  }
  return factory;
});
