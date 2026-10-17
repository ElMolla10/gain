import { Platform } from "react-native";

/**
 * iPhone number pads have no Return key. Each numeric TextInput gets its own native "Done" toolbar through the iOS-only
 * `inputAccessoryViewButtonLabel` prop (a shared root InputAccessoryView binds to only one input on Fabric).
 * Takes `t` so this file stays free of UI imports (ui.tsx and the input components use it without an import cycle).
 */
export function numberPadAccessory(t: (key: "common.done") => string): { inputAccessoryViewButtonLabel?: string } {
  return Platform.OS === "ios" ? { inputAccessoryViewButtonLabel: t("common.done") } : {};
}

/** For `automaticallyAdjustKeyboardInsets` on scroll views inside sheets, the exercise picker and the logger: iOS draws the keyboard over the screen, so the scroll view must make room. Android resizes the window instead (app.json softwareKeyboardLayoutMode), so this stays false there. */
export const adjustKeyboardInsets = Platform.OS === "ios";
