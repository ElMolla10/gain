import { Platform } from "react-native";

/**
 * iPhone number pads have no Return key. The "Done" bar (components/NumberPadDone.tsx) is attached to a numeric TextInput by this id.
 * Kept free of UI imports so ui.tsx and the input components can use it without an import cycle.
 */
export const NUMBER_PAD_ACCESSORY_ID = "gain-number-pad-done";

/** Props to spread on a numeric TextInput: the accessory id on iOS, nothing on Android (its keyboard has its own check mark). */
export const numberPadAccessory: { inputAccessoryViewID?: string } = Platform.OS === "ios" ? { inputAccessoryViewID: NUMBER_PAD_ACCESSORY_ID } : {};

/** For `automaticallyAdjustKeyboardInsets` on scroll views inside sheets, the exercise picker and the logger: iOS draws the keyboard over the screen, so the scroll view must make room. Android resizes the window instead (app.json softwareKeyboardLayoutMode), so this stays false there. */
export const adjustKeyboardInsets = Platform.OS === "ios";
