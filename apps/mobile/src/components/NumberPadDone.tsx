import React from "react";
import { InputAccessoryView, Keyboard, Platform, Pressable, View } from "react-native";
import { useI18n } from "../i18n";
import { NUMBER_PAD_ACCESSORY_ID } from "../numberPad";
import { space, usePalette } from "../theme";
import { AppText } from "../ui";

/**
 * iPhone number pads have no Return key, so a lifter who typed a weight could not close the keyboard except by tapping elsewhere. This bar
 * sits on top of the pad with one "Done" button. Android's keyboard has its own check mark, so there it renders nothing.
 * Numeric TextInputs spread `numberPadAccessory` (src/numberPad.ts); render <NumberPadDone /> once near the app root.
 */
export function NumberPadDone() {
  const { t } = useI18n();
  const p = usePalette();
  if (Platform.OS !== "ios") return null;
  return (
    <InputAccessoryView nativeID={NUMBER_PAD_ACCESSORY_ID}>
      <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: space.md, paddingVertical: space.xs, backgroundColor: p.card, borderTopWidth: 1, borderColor: p.border }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("common.done")} onPress={() => Keyboard.dismiss()} hitSlop={8} style={{ paddingHorizontal: space.md, paddingVertical: space.sm }}>
          <AppText style={{ color: p.accent, fontWeight: "600" }}>{t("common.done")}</AppText>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}
