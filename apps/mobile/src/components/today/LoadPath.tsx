import React, { useEffect, useRef } from "react";
import { Animated, View } from "react-native";
import { useI18n } from "../../i18n";
import { formatLoad, isolateLtr, NBSP } from "../../i18n/format";
import type { HeroWarmupStep } from "../../logic/todayHero";
import { pathPlan } from "../../logic/todayMotion";
import { radius, space, type as ty, usePalette } from "../../theme";
import { AppText, QuietAction, useReducedMotion } from "../../ui";
import { MiniBar } from "./RackRow";

/**
 * The load path under the hero (not a modal): the warm-up ramp as mini bars, then the work set. Opens with a fade + 12 dp rise and the
 * steps revealed from the start edge 48 ms apart (native driver); with Reduce Motion it is a 200 ms crossfade. "Usually skipped here"
 * when warm-ups are usually skipped at this point of the day. Hidden for assisted lifts (the hero never offers it there).
 */
export function LoadPath({ steps, work, skippedHint, onClose }: { steps: HeroWarmupStep[]; work: HeroWarmupStep; skippedHint: boolean; onClose: () => void }) {
  const { t, lang, unit } = useI18n();
  const p = usePalette();
  const reduced = useReducedMotion();
  const all = [...steps, work];
  const plan = pathPlan(reduced, all.length);
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(reduced ? 0 : -12)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: plan.kind === "crossfade" ? plan.duration : 120, useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: plan.kind === "crossfade" ? 0 : plan.duration, useNativeDriver: true }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const line = (s: HeroWarmupStep) => `${formatLoad(s.load, lang, unit)}${NBSP}×${NBSP}${isolateLtr(String(s.reps))}`;
  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY: rise }], gap: space.sm, padding: space.md, borderRadius: radius.card, backgroundColor: p.card, borderWidth: 1, borderColor: p.border }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <AppText style={{ fontSize: ty.body, fontWeight: "600", flexShrink: 1 }}>{t("today.path.title", { load: formatLoad(work.load, lang, unit) })}</AppText>
        <QuietAction icon="close" label={t("today.path.close")} onPress={onClose} />
      </View>
      {skippedHint ? <AppText style={{ fontSize: ty.label, color: p.muted }}>{t("today.path.skipped")}</AppText> : null}
      {all.map((s, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
          <MiniBar perSide={s.perSide} unit={unit} />
          <View style={{ flex: 1 }}>
            <AppText style={{ fontSize: ty.label, fontWeight: i === all.length - 1 ? "600" : "400", fontVariant: ["tabular-nums"] }}>{line(s)}</AppText>
            {i === all.length - 1 ? <AppText style={{ fontSize: ty.caption, color: p.muted }}>{t("today.path.work")}</AppText> : null}
          </View>
        </View>
      ))}
    </Animated.View>
  );
}
