import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Share, View } from "react-native";
import { haptics } from "../haptics";
import { SwitchRow } from "./SettingsRows";
import { telemetry } from "../achievementTelemetry";
import { diagnostics } from "../diagnostics";
import { useI18n } from "../i18n";
import type { StringKey } from "../i18n/strings";
import { evidenceLine } from "../logic/achievementEvidence";
import {
  DEFAULT_SHARE_PRIVACY,
  formatShareCard,
  shareCardCopy,
  type SharePrivacy,
  type SurfaceBadge,
} from "../logic/achievementSurface";
import { motion, space, type as ty, usePalette } from "../theme";
import { AppText, BigButton, Card, QuietAction } from "../ui";

export function HeroAchievement(props: { hero: SurfaceBadge; rest: SurfaceBadge[] }) {
  const { t, lang, unit } = useI18n();
  const p = usePalette();
  const opacity = useRef(new Animated.Value(1)).current;
  const [open, setOpen] = useState(false);
  const [privacy, setPrivacy] = useState<SharePrivacy>(DEFAULT_SHARE_PRIVACY);
  const [sharing, setSharing] = useState(false);
  const copy = shareCardCopy(props.hero, { privacy, lang, unit, t });

  useEffect(() => {
    let alive = true;
    telemetry.record("hero_shown");
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((prefersReduced) => {
        if (!alive) return;
        if (prefersReduced) {
          opacity.setValue(1);
          return;
        }
        opacity.setValue(0);
        Animated.timing(opacity, { toValue: 1, duration: motion.transition, useNativeDriver: true }).start();
        haptics.celebrate();
      })
      .catch(() => {
        if (alive) opacity.setValue(1);
      });
    return () => {
      alive = false;
    };
  }, [opacity, props.hero.id]);

  const share = async () => {
    setSharing(true);
    try {
      telemetry.record("share_card");
      await Share.share({ message: formatShareCard(copy) });
    } catch (e) {
      diagnostics.record("warn", "share badge", e);
    } finally {
      setSharing(false);
    }
  };

  const line = (row: SurfaceBadge) =>
    evidenceLine(row.evidence, t, lang, unit, { nameEn: row.exerciseNameEn, nameAr: row.exerciseNameAr });

  return (
    <Animated.View style={{ opacity }}>
      <Card>
        <AppText accessibilityRole="header" style={{ fontSize: ty.section, fontWeight: "600", color: p.accent }}>
          {t("achv.hero.title")}
        </AppText>
        <AppText style={{ fontSize: ty.title, fontWeight: "600" }}>{t(props.hero.i18nKey as StringKey)}</AppText>
        <AppText>{line(props.hero)}</AppText>
        <AppText accessibilityRole="header" style={{ fontWeight: "600" }}>{t("achv.share.title")}</AppText>
        {copy.exercise ? <AppText>{copy.exercise}</AppText> : null}
        <AppText>{copy.delta}</AppText>
        <SwitchRow label={t("achv.share.absolute")} value={privacy.absoluteWeight} onChange={(on) => setPrivacy({ ...privacy, absoluteWeight: on })} />
        <SwitchRow label={t("achv.share.bodyweight")} value={privacy.bodyweight} onChange={(on) => setPrivacy({ ...privacy, bodyweight: on })} />
        <SwitchRow label={t("achv.share.gym")} value={privacy.gymLocation} onChange={(on) => setPrivacy({ ...privacy, gymLocation: on })} />
        <SwitchRow label={t("achv.share.log")} value={privacy.fullLog} onChange={(on) => setPrivacy({ ...privacy, fullLog: on })} />
        <AppText style={{ color: p.muted }}>{t("achv.share.note")}</AppText>
        <BigButton variant="secondary" icon="export" label={t("achv.share.action")} loading={sharing} disabled={sharing} onPress={() => void share()} />
        {props.rest.length > 0 ? (
          <View>
            <QuietAction
              label={open ? t("achv.hero.hide") : t("achv.hero.show", { n: props.rest.length })}
              expanded={open}
              onPress={() => setOpen((v) => !v)}
            />
            {open
              ? props.rest.map((row) => (
                  <View key={row.id} style={{ gap: space.xs, paddingVertical: space.sm }}>
                    <AppText style={{ fontWeight: "600" }}>{t(row.i18nKey as StringKey)}</AppText>
                    <AppText style={{ color: p.muted }}>{line(row)}</AppText>
                  </View>
                ))
              : null}
          </View>
        ) : null}
      </Card>
    </Animated.View>
  );
}
