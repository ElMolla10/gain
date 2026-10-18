import React from "react";
import { View } from "react-native";
import { useI18n } from "../../i18n";
import { formatLoad } from "../../i18n/format";
import { plateLook } from "../../logic/barArt";
import { engravingPlates } from "../../logic/todayHeroText";
import { TODAY_PLATES } from "../../palettes";
import { space, type as ty, usePalette } from "../../theme";
import { AppText } from "../../ui";

/**
 * The plate line under the bar: decorative 9 dp dots in each plate's colour, then "Each side: 25 · 15 · 1.25" (the existing `plates.each`
 * wording) with every number isolated, heaviest first in logical order, and the lighter week's "· normally 102.5 kg".
 */
export function PlateEngraving({ perSide, normalLoad }: { perSide: readonly number[]; normalLoad?: number | null }) {
  const { t, lang, unit } = useI18n();
  const p = usePalette();
  const text = t("plates.each", { plates: engravingPlates(perSide, unit) }) + (normalLoad != null ? ` · ${t("today.normally", { load: formatLoad(normalLoad, lang, unit) })}` : "");
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, flexWrap: "wrap" }}>
      <View style={{ flexDirection: "row", gap: 3 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {perSide.map((kg, i) => {
          const c = TODAY_PLATES[plateLook(kg, unit).token];
          return <View key={i} style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: c.face, borderWidth: 1, borderColor: c.lip }} />;
        })}
      </View>
      <AppText style={{ fontSize: ty.label, color: p.muted, flexShrink: 1 }}>{text}</AppText>
    </View>
  );
}
