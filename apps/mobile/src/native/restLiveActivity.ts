import Constants from "expo-constants";
import { Platform } from "react-native";
import { createRestLiveActivityController, type RestActivityFactory } from "../logic/restLiveActivityController";

let factory: RestActivityFactory | undefined;
export const restLiveActivity = createRestLiveActivityController(() => {
  if (Platform.OS !== "ios" || Number.parseFloat(String(Platform.Version)) < 16.4 || Constants.expoConfig?.extra?.restLiveActivityEnabled !== true) return null;
  // Defer native initialization. Old binaries, Expo Go, Android, and free-ID builds
  // must keep working even though their native widget module/extension is absent.
  const { requireOptionalNativeModule } = require("expo") as typeof import("expo");
  if (!requireOptionalNativeModule("ExpoWidgets")) return null;
  if (!factory) factory = require("./restLiveActivityLayout").default as RestActivityFactory;
  return factory;
});
