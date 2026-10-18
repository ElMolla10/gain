import React from "react";
import { View } from "react-native";
import { useI18n } from "../../i18n";
import { space, type as ty, usePalette } from "../../theme";
import { AppText, QuietAction } from "../../ui";

/**
 * The "written at the door" stub under the hero: a perforated rule with notches at both edges, the provenance line (muted), the last-time
 * line with its reason (text: the reason is the product), and Why as its own 48 dp button. `loading` = a 2-line skeleton.
 */
export function DoorStub({ provenance, lastTime, loading, onWhy, whyLabel }: { provenance: string | null; lastTime: string | null; loading?: boolean; onWhy?: () => void; whyLabel: string }) {
  const { t } = useI18n();
  const p = usePalette();
  return (
    <View style={{ gap: space.xs }}>
      <View style={{ height: 12, justifyContent: "center" }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={{ borderTopWidth: 2, borderStyle: "dotted", borderColor: p.border }} />
        <View style={{ position: "absolute", start: -22, width: 12, height: 12, borderRadius: 6, backgroundColor: p.bg }} />
        <View style={{ position: "absolute", end: -22, width: 12, height: 12, borderRadius: 6, backgroundColor: p.bg }} />
      </View>
      {loading ? (
        <View style={{ gap: space.xs }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={{ height: 12, width: "60%", borderRadius: 4, backgroundColor: p.raised }} />
          <View style={{ height: 12, width: "85%", borderRadius: 4, backgroundColor: p.raised }} />
        </View>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.sm }}>
          <View style={{ flex: 1, gap: 2 }}>
            {provenance ? <AppText style={{ fontSize: ty.label, lineHeight: 20, color: p.muted }}>{`✎ ${provenance}`}</AppText> : null}
            {lastTime ? <AppText style={{ fontSize: ty.label, lineHeight: 20, color: p.text }}>{lastTime}</AppText> : null}
          </View>
          {onWhy ? <QuietAction icon="why" label={t("workout.whyShort")} accessibilityLabel={whyLabel} onPress={onWhy} /> : null}
        </View>
      )}
    </View>
  );
}
