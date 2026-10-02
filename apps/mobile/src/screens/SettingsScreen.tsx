import { useNavigation } from "@react-navigation/native";
import React, { useCallback, useEffect, useState } from "react";
import type { CeilingClass, RepCeilings } from "@gain/engine";
import { ScrollView, View } from "react-native";
import { useServices } from "../AppContext";
import { useI18n } from "../i18n";
import { space, usePalette } from "../theme";
import { AppText, BigButton, Card } from "../ui";
import Constants from "expo-constants";

const KINDS: CeilingClass[] = ["upper", "lower", "lateral_raise"];

/** The default rep ceilings (reps at which load goes up) per kind of lift. Per-lift overrides live on the programme row. */
function CeilingsCard() {
  const { t } = useI18n();
  const { repos } = useServices();
  const [c, setC] = useState<RepCeilings | null>(null);
  useEffect(() => {
    void repos.getRepCeilingDefaults().then(setC);
  }, [repos]);
  const bump = useCallback(
    async (kind: CeilingClass, d: number) => {
      if (!c) return;
      setC(await repos.setRepCeilingDefaults({ [kind]: Math.min(100, Math.max(1, c[kind] + d)) }));
    },
    [repos, c],
  );
  if (!c) return null;
  return (
    <Card>
      <AppText style={{ fontWeight: "700" }}>{t("settings.ceilings")}</AppText>
      <AppText>{t("settings.ceilings.note")}</AppText>
      {KINDS.map((k) => (
        <View key={k} style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <AppText style={{ flex: 1 }}>{t(`settings.ceilings.${k}` as const)}</AppText>
          <BigButton label="-" selected={false} accessibilityHint={t("settings.ceilings.less")} onPress={() => void bump(k, -1)} />
          <AppText ltr style={{ minWidth: 32, textAlign: "center", fontWeight: "700" }}>{String(c[k])}</AppText>
          <BigButton label="+" selected={false} accessibilityHint={t("settings.ceilings.more")} onPress={() => void bump(k, 1)} />
        </View>
      ))}
    </Card>
  );
}

export function SettingsScreen() {
  const { t, lang, setLang, rtlOverride, setRtlOverride, needsRestart } = useI18n();
  const p = usePalette();
  const version = Constants.expoConfig?.version ?? "0";
  const nav = useNavigation<{ navigate: (n: "Setup") => void }>();
  return (
    <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md }}>
      <Card>
        <AppText style={{ fontWeight: "700" }}>{t("settings.language")}</AppText>
        <BigButton label={t("settings.language.en")} selected={lang === "en"} onPress={() => setLang("en")} />
        <BigButton label={t("settings.language.ar")} selected={lang === "ar"} onPress={() => setLang("ar")} />
      </Card>
      <Card>
        <AppText style={{ fontWeight: "700" }}>{t("settings.direction")}</AppText>
        <BigButton label={t("settings.direction.auto")} selected={rtlOverride === "auto"} onPress={() => setRtlOverride("auto")} />
        <BigButton label={t("settings.direction.rtl")} selected={rtlOverride === "on"} onPress={() => setRtlOverride("on")} />
        <BigButton label={t("settings.direction.ltr")} selected={rtlOverride === "off"} onPress={() => setRtlOverride("off")} />
        {needsRestart ? <AppText style={{ color: p.muted }}>{t("settings.restartNote")}</AppText> : null}
      </Card>
      <CeilingsCard />
      <Card>
        <AppText style={{ fontWeight: "700" }}>{t("settings.units")}</AppText>
        <AppText>{t("settings.units.kg")}</AppText>
      </Card>
      <Card>
        <BigButton label={t("settings.setupAgain")} selected={false} onPress={() => nav.navigate("Setup")} />
        <AppText style={{ color: p.muted, fontSize: 13 }}>{t("settings.setupAgainNote")}</AppText>
      </Card>
      <AppText style={{ color: p.muted }}>{t("settings.privacy")}</AppText>
      <AppText style={{ color: p.muted }}>{t("settings.version", { v: version })}</AppText>
    </ScrollView>
  );
}
