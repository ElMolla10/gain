import React from "react";
import { ScrollView } from "react-native";
import { useI18n } from "../i18n";
import { space, usePalette } from "../theme";
import { AppText, BigButton, Card } from "../ui";
import Constants from "expo-constants";

export function SettingsScreen() {
  const { t, lang, setLang, rtlOverride, setRtlOverride, needsRestart } = useI18n();
  const p = usePalette();
  const version = Constants.expoConfig?.version ?? "0";
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
      <Card>
        <AppText style={{ fontWeight: "700" }}>{t("settings.units")}</AppText>
        <AppText>{t("settings.units.kg")}</AppText>
      </Card>
      <AppText style={{ color: p.muted }}>{t("settings.privacy")}</AppText>
      <AppText style={{ color: p.muted }}>{t("settings.version", { v: version })}</AppText>
    </ScrollView>
  );
}
