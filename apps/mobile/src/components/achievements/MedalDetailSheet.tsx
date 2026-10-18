import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, PanResponder, View } from "react-native";
import { telemetry } from "../../achievementTelemetry";
import { diagnostics } from "../../diagnostics";
import { useI18n } from "../../i18n";
import type { StringKey } from "../../i18n/strings";
import { medalBack, medalStateLine, trackTitle } from "../../logic/achievementCopy";
import { evidenceLine } from "../../logic/achievementEvidence";
import { familyTrack } from "../../logic/achievementShowcase";
import { DEFAULT_SHARE_PRIVACY, evidenceSheetContent, formatShareCard, prestigeForBadge, shareCardCopy, type SurfaceBadge } from "../../logic/achievementSurface";
import { formatDay } from "../../logic/dateText";
import { posterCopy } from "../../logic/sharePoster";
import { radius, space, type as ty, usePalette } from "../../theme";
import { AppText, BigButton, Sheet, useReducedMotion } from "../../ui";
import { Medal } from "./Medal";
import { MedalBackFace } from "./MedalBack";
import { useSharePoster } from "./SharePoster";

/** Medal size on the sheet's stage (dp). */
export const DETAIL_MEDAL = 200;
/** Drag-tilt clamp (degrees) and the drag distance (dp) that reaches it. */
export const TILT_MAX = 18;
const TILT_REACH = 90;
export const FLIP_MS = 300;
export const FADE_MS = 200;

const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));
/** Drag (dx, dy) → rotateY / rotateX degrees, clamped to ±18°. */
export const tiltFor = (dx: number, dy: number): { ry: number; rx: number } => ({ ry: clamp((dx / TILT_REACH) * TILT_MAX, TILT_MAX), rx: clamp((-dy / TILT_REACH) * TILT_MAX, TILT_MAX) });

/**
 * One medal up close (spec §6.3). Earned: the medal at 200 dp with drag-tilt (rotateY/rotateX ±18°, specular and a 2–3 dp motif
 * parallax follow, spring back on release), a real "Turn over" button that flips to the engraved back (300 ms rotateY, or a 200 ms
 * crossfade under Reduce Motion, which also turns tilt off), Share, and View supporting workout. In progress / locked: the medal, how
 * to earn it and any progress; no tilt, no flip, no share.
 */
export function MedalDetailSheet(props: {
  row: SurfaceBadge | null;
  cabinet: readonly SurfaceBadge[];
  qualifiedWeeksLifetime: number;
  weeks12Earned: boolean;
  /** Training days for the plate poster (the Lifetime Plate's count). */
  trainingDays?: { days: number | null; floor: boolean } | null;
  onClose: () => void;
  onViewWorkout: (sessionId: string) => void;
}) {
  const { t, lang, unit } = useI18n();
  const p = usePalette();
  const reduced = useReducedMotion();
  const row = props.row;
  const earned = row?.status === "earned";
  const [back, setBack] = useState(false);
  const [spec, setSpec] = useState(0.35);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const tilt = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const flip = useRef(new Animated.Value(0)).current;
  const [sharing, setSharing] = useState(false);
  const poster = useSharePoster();

  useEffect(() => {
    if (row) telemetry.record("badge_detail");
    setBack(false);
    flip.setValue(0);
    tilt.setValue({ x: 0, y: 0 });
  }, [row?.id, flip, tilt]);

  const canTilt = earned && !reduced && !back;
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_e, g) => {
          const { ry, rx } = tiltFor(g.dx, g.dy);
          tilt.setValue({ x: ry, y: rx });
          // The specular band follows rotateY; the motif slides 2–3 dp against the tilt (view-box units ≈ 0.54 per dp at 200 dp).
          setSpec(0.35 + (ry / TILT_MAX) * 0.3);
          setParallax({ x: -(ry / TILT_MAX) * 1.5, y: (rx / TILT_MAX) * 1.5 });
        },
        onPanResponderRelease: () => {
          Animated.spring(tilt, { toValue: { x: 0, y: 0 }, friction: 7, tension: 60, useNativeDriver: true }).start();
          setSpec(0.35);
          setParallax({ x: 0, y: 0 });
        },
      }),
    [tilt],
  );

  const turnOver = () => {
    const to = back ? 0 : 1;
    setBack(!back);
    Animated.timing(flip, { toValue: to, duration: reduced ? FADE_MS : FLIP_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start();
  };

  const share = async () => {
    if (!row) return;
    setSharing(true);
    try {
      telemetry.record("share_card");
      const text = formatShareCard(shareCardCopy(row, { privacy: DEFAULT_SHARE_PRIVACY, lang, unit, t }));
      await poster.share(
        posterCopy(row, { privacy: DEFAULT_SHARE_PRIVACY, lang, unit, t, cabinet: props.cabinet, days: props.trainingDays, qualifiedWeeks: props.qualifiedWeeksLifetime }),
        text,
      );
    } catch (e) {
      diagnostics.record("warn", "share badge", e);
    } finally {
      setSharing(false);
    }
  };

  const sheet = row
    ? evidenceSheetContent({ badgeId: row.badgeId, primarySessionId: row.primarySessionId, qualifiedWeeksLifetime: props.qualifiedWeeksLifetime, weeks12Earned: props.weeks12Earned })
    : null;
  const name = row ? t(row.i18nKey as StringKey) : t("achv.detail.title");
  const state = row?.status === "earned" ? "earned" : row?.status === "in_progress" ? "in_progress" : "locked";
  const progress = row && state === "in_progress" && (row.progressTarget ?? 0) > 0 ? (row.progressCurrent ?? 0) / (row.progressTarget ?? 1) : 0;
  const track = row ? familyTrack(props.cabinet, row.badgeId) : [];
  const evidence = row?.evidence ? evidenceLine(row.evidence, t, lang, unit, { nameEn: row.exerciseNameEn, nameAr: row.exerciseNameAr }) : "";
  const backCopy = row && earned ? medalBack(row, props.cabinet, lang, unit, t) : null;
  const backText = backCopy ? [backCopy.title, backCopy.value && backCopy.unit ? `${backCopy.value} ${backCopy.unit}` : null, backCopy.date, backCopy.ordinal].filter(Boolean).join(", ") : "";

  // Faces: rotateY 0 → 180 with a perspective of 700, swapping at 90° (opacity steps at the midpoint); a crossfade under Reduce Motion.
  const frontStyle = reduced
    ? { opacity: flip.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }
    : {
        opacity: flip.interpolate({ inputRange: [0, 0.5, 0.501, 1], outputRange: [1, 1, 0, 0] }),
        transform: [
          { perspective: 700 },
          { rotateY: flip.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] }) },
          { rotateY: tilt.x.interpolate({ inputRange: [-TILT_MAX, TILT_MAX], outputRange: [`-${TILT_MAX}deg`, `${TILT_MAX}deg`], extrapolate: "clamp" }) },
          { rotateX: tilt.y.interpolate({ inputRange: [-TILT_MAX, TILT_MAX], outputRange: [`-${TILT_MAX}deg`, `${TILT_MAX}deg`], extrapolate: "clamp" }) },
        ],
      };
  const backStyle = reduced
    ? { opacity: flip }
    : {
        opacity: flip.interpolate({ inputRange: [0, 0.5, 0.501, 1], outputRange: [0, 0, 1, 1] }),
        transform: [{ perspective: 700 }, { rotateY: flip.interpolate({ inputRange: [0, 1], outputRange: ["180deg", "360deg"] }) }],
      };

  const footer = row ? (
    <>
      {earned ? (
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <BigButton variant="secondary" label={t("achv.r2.detail.turnOver")} onPress={turnOver} />
          </View>
          <View style={{ flex: 1 }}>
            <BigButton variant="secondary" icon="export" label={t("achv.r2.detail.share")} loading={sharing} disabled={sharing} onPress={() => void share()} />
          </View>
        </View>
      ) : null}
      {sheet?.supportingSessionId && earned ? (
        <BigButton
          variant="secondary"
          label={t("achv.viewWorkout")}
          onPress={() => {
            const sessionId = sheet.supportingSessionId!;
            telemetry.record("view_workout");
            props.onClose();
            props.onViewWorkout(sessionId);
          }}
        />
      ) : null}
    </>
  ) : undefined;

  return (
    <Sheet visible={row !== null} title={name} onClose={props.onClose} footer={footer}>
      {row && sheet ? (
        <>
          <View style={{ alignItems: "center", gap: space.sm }}>
            <View
              accessible
              accessibilityRole="image"
              accessibilityLabel={back ? t("achv.r2.detail.back", { text: backText }) : name}
              accessibilityActions={earned ? [{ name: "turnOver", label: t("achv.r2.detail.turnOver") }] : undefined}
              onAccessibilityAction={(e) => {
                if (e.nativeEvent.actionName === "turnOver") turnOver();
              }}
              style={{ width: DETAIL_MEDAL, height: DETAIL_MEDAL }}
              {...(canTilt ? pan.panHandlers : {})}
            >
              <Animated.View style={[{ position: "absolute" }, earned ? frontStyle : null]}>
                <Medal badgeId={row.badgeId} state={state} size={DETAIL_MEDAL} progress={progress} spec={spec} tilt={parallax} />
              </Animated.View>
              {backCopy ? (
                <Animated.View pointerEvents="none" style={[{ position: "absolute" }, backStyle]}>
                  <MedalBackFace badgeId={row.badgeId} size={DETAIL_MEDAL} copy={backCopy} />
                </Animated.View>
              ) : null}
            </View>
            {earned ? (
              <AppText style={{ fontSize: ty.label, color: p.muted, textAlign: "center" }}>
                {back ? t("achv.r2.detail.backHint") : reduced ? t("achv.r2.detail.flipHint") : t("achv.r2.detail.dragHint")}
              </AppText>
            ) : null}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: space.sm }}>
            <View style={{ borderWidth: 1, borderColor: p.edge, borderRadius: radius.button, paddingHorizontal: space.sm, paddingVertical: 2 }}>
              <AppText style={{ fontSize: ty.label, fontWeight: "600" }}>
                {state === "locked" ? t("achv.r2.medal.locked") : t(`achv.prestige.${prestigeForBadge(row.badgeId)}` as StringKey)}
              </AppText>
            </View>
            {state === "locked" ? null : (
              <AppText style={{ fontSize: ty.label, color: p.muted }}>
                {earned ? t("achv.r2.detail.earnedOn", { date: row.earnedLocalDate ? formatDay(row.earnedLocalDate, lang) : "" }) : t("achv.badge.inProgress")}
              </AppText>
            )}
          </View>
          {state === "in_progress" ? (
            <AppText style={{ fontWeight: "600" }}>{medalStateLine({ badgeId: row.badgeId, state, row, count: 0, repeatable: false }, lang, t)}</AppText>
          ) : null}
          {evidence ? <AppText style={{ fontWeight: "600" }}>{evidence}</AppText> : null}
          {row.status === "revoked_by_edit" ? <AppText style={{ color: p.muted }}>{t("achv.revoked")}</AppText> : null}
          {track.length > 0 ? (
            <View style={{ borderWidth: 1, borderColor: p.border, borderRadius: radius.card, padding: space.md, gap: space.sm }}>
              <AppText style={{ fontSize: ty.label, color: p.muted }}>{trackTitle(row.badgeId, t)}</AppText>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                {track.map((step) => {
                  const current = step.badgeId === row.badgeId;
                  const caption = step.state === "in_progress" ? t("achv.r2.medal.of", { x: step.current ?? 0, y: step.target ?? 0 }) : String(step.tier);
                  return (
                    <View
                      key={step.badgeId}
                      accessible
                      accessibilityLabel={`${t(step.i18nKey as StringKey)}, ${step.state === "earned" ? t("achv.badge.earned") : step.state === "in_progress" ? caption : t("achv.r2.medal.locked")}`}
                      accessibilityState={{ selected: current }}
                      style={{ minWidth: 64, alignItems: "center", gap: 2, padding: space.xs, borderRadius: radius.button, borderWidth: 2, borderColor: current ? p.accent : "transparent" }}
                    >
                      <Medal badgeId={step.badgeId} state={step.state} size={40} progress={step.target ? (step.current ?? 0) / step.target : 0} />
                      <AppText style={{ fontSize: ty.caption, color: p.muted }}>{caption}</AppText>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}
          {state === "earned" ? null : <AppText accessibilityRole="header" style={{ fontWeight: "600" }}>{t("achv.r2.detail.howTo")}</AppText>}
          <AppText style={{ color: p.muted }}>{t(sheet.ruleKey, sheet.ruleParams)}</AppText>
        </>
      ) : null}
      {poster.host}
    </Sheet>
  );
}
