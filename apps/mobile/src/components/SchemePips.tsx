import React from "react";
import { View } from "react-native";
import { useI18n } from "../i18n";
import { schemeCounts, schemePips } from "../logic/setScheme";
import { space, type as ty, usePalette } from "../theme";
import { AppText } from "../ui";

/**
 * Pips for a set scheme (design audit P-3): filled accent = top set, edge outline = back-off, filled muted = straight set. They fill
 * from the start edge (a row mirrors in RTL). The caption says the same in words, so colour is never the only cue.
 */
export function SchemePips({ sets, topSets, size = 24, caption = true }: { sets: number; topSets: number | null | undefined; size?: 12 | 24; caption?: boolean }) {
  const { t } = useI18n();
  const p = usePalette();
  const pips = schemePips(sets, topSets);
  const c = schemeCounts(pips);
  const label = c.top ? t("prog.ex.schemeCaption", { top: c.top, back: c.backoff }) : t("prog.ex.schemeStraight", { n: pips.length });
  return (
    <View accessible accessibilityLabel={label} style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: size === 24 ? space.sm : space.xs }}>
      <View style={{ flexDirection: "row", gap: size === 24 ? 6 : 3 }}>
        {pips.map((k, i) => (
          <View
            key={i}
            style={{
              width: size, height: size, borderRadius: size / 2,
              backgroundColor: k === "top" ? p.accent : k === "work" ? p.muted : "transparent",
              borderWidth: k === "backoff" ? 1.5 : 0, borderColor: p.edge,
            }}
          />
        ))}
      </View>
      {caption ? <AppText style={{ color: p.muted, fontSize: ty.label }}>{label}</AppText> : null}
    </View>
  );
}
