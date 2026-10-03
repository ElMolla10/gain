import React from "react";
import { ScrollView } from "react-native";
import { useI18n } from "../i18n";
import { FREE_FEATURES, PAID_FEATURES } from "../logic/plans";
import { space } from "../theme";
import { AppText, ArDraftNote, Card } from "../ui";

/**
 * What would be free and what would be paid, with the limit stated up front. A preview page: no price, no button that buys anything, no
 * network. Not reachable unless PLAN_FLAGS.planPreviewVisible is on (it is off). See logic/plans.ts.
 */
export function PlansScreen() {
  const { t, lang } = useI18n();
  return (
    <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space.xl * 2 }}>
      {lang === "ar" ? <ArDraftNote /> : null}
      <Card>
        <AppText style={{ fontWeight: "700" }}>{t("plans.nothing")}</AppText>
      </Card>
      <Card>
        <AppText accessibilityRole="header" style={{ fontWeight: "800", fontSize: 18 }}>{t("plans.free.title")}</AppText>
        {FREE_FEATURES.map((f) => (
          <AppText key={f}>• {t(`plans.f.${f}` as never)}</AppText>
        ))}
      </Card>
      <Card>
        <AppText accessibilityRole="header" style={{ fontWeight: "800", fontSize: 18 }}>{t("plans.paid.title")}</AppText>
        {PAID_FEATURES.map((f) => (
          <AppText key={f}>• {t(`plans.f.${f}` as never)}</AppText>
        ))}
        <AppText>{t("plans.limit")}</AppText>
      </Card>
      <AppText>{t("plans.records")}</AppText>
    </ScrollView>
  );
}
