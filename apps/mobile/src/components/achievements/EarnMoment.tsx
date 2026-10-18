import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, View } from "react-native";
import { haptics } from "../../haptics";
import { useI18n } from "../../i18n";
import { formatSetEvidence } from "../../logic/achievementEvidence";
import { prDelta } from "../../logic/achievementShowcase";
import type { SurfaceBadge } from "../../logic/achievementSurface";
import { EARN, earnSchedule, earnVariant, odometer, plateTierUp, runSchedule, settleAt, type EarnHaptic } from "../../logic/earnMoment";
import { radius, space, type as ty, useAchievementArt, usePalette } from "../../theme";
import { AppText, useReducedMotion } from "../../ui";
import { LifetimePlate } from "./LifetimePlate";
import { Medal } from "./Medal";

/** Medal size in the earn moment (dp). */
export const EARN_MEDAL = 120;
const RING_GROW = 140;

function fireHaptic(h: EarnHaptic): void {
  if (h === "land") haptics.land();
  else if (h === "legacy") haptics.legacy();
  else haptics.celebrate();
}

/**
 * The earn moment on Finish (spec §6.1), inside HeroAchievement. The medal drops in with one full turn and lands (Medium, iOS) at
 * 380 ms, a specular band sweeps, the name and evidence fade up, Legacy medals send a ring pulse (Heavy, iOS), and one Success fires at
 * settle. A Strength PR rolls its load odometer and pops the delta chip; a hundred_club hero is the plate, which completes and recolours.
 * Reduce Motion: a 200 ms crossfade, a static medal and text, one Success. Tapping the stage skips to the end. Announced once.
 */
export function EarnMoment({ hero, title, line }: { hero: SurfaceBadge; title: string; line: string }) {
  const { t, lang, unit } = useI18n();
  const p = usePalette();
  const art = useAchievementArt();
  const reduced = useReducedMotion();
  const variant = earnVariant(hero);
  const v = useRef({
    dim: new Animated.Value(0),
    drop: new Animated.Value(0),
    scale: new Animated.Value(0.6),
    turn: new Animated.Value(0),
    show: new Animated.Value(0),
    text: new Animated.Value(0),
    ring: new Animated.Value(0),
    chip: new Animated.Value(0),
    odo: new Animated.Value(0),
    swap: new Animated.Value(0),
    pulse: new Animated.Value(1),
    spec: new Animated.Value(0),
  }).current;
  const [spec, setSpec] = useState(0.35);
  const [odo, setOdo] = useState(0);
  const player = useRef<{ skip: () => void; cancel: () => void } | null>(null);
  const announced = useRef(false);

  const announce = () => {
    if (announced.current) return;
    announced.current = true;
    AccessibilityInfo.announceForAccessibility(t("achv.r2.earn.announce", { name: title }));
  };
  const endState = () => {
    Object.values(v).forEach((x) => x.stopAnimation());
    v.dim.setValue(0);
    v.drop.setValue(1);
    v.scale.setValue(1);
    v.turn.setValue(1);
    v.show.setValue(1);
    v.text.setValue(1);
    v.ring.setValue(0);
    v.chip.setValue(1);
    v.swap.setValue(1);
    v.pulse.setValue(1);
    setOdo(1);
    setSpec(0.35);
  };

  useEffect(() => {
    let alive = true;
    const settleTimer = setTimeout(() => alive && announce(), settleAt(reduced));
    player.current = runSchedule(earnSchedule(variant, reduced), fireHaptic);
    if (reduced) {
      v.drop.setValue(1);
      v.scale.setValue(1);
      v.turn.setValue(1);
      v.text.setValue(1);
      v.chip.setValue(1);
      v.swap.setValue(1);
      setOdo(1);
      Animated.timing(v.show, { toValue: 1, duration: EARN.fade, useNativeDriver: true }).start();
    } else {
      const out = Easing.out(Easing.cubic);
      const at = (ms: number, a: Animated.CompositeAnimation) => Animated.sequence([Animated.delay(ms), a]);
      const specId = v.spec.addListener(({ value }) => setSpec(value));
      const odoId = v.odo.addListener(({ value }) => setOdo(value));
      Animated.parallel([
        Animated.sequence([
          Animated.timing(v.dim, { toValue: 1, duration: EARN.dim, useNativeDriver: true }),
          Animated.delay(EARN.liftFrom - EARN.dim),
          Animated.timing(v.dim, { toValue: 0, duration: EARN.liftTo - EARN.liftFrom, useNativeDriver: true }),
        ]),
        Animated.timing(v.show, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.timing(v.drop, { toValue: 1, duration: EARN.land, easing: out, useNativeDriver: true }),
        Animated.timing(v.turn, { toValue: 1, duration: EARN.land, easing: out, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(v.scale, { toValue: 1.08, duration: 266, easing: out, useNativeDriver: true }),
          Animated.timing(v.scale, { toValue: 1, duration: 114, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        ]),
        at(EARN.specFrom, Animated.timing(v.spec, { toValue: 1, duration: EARN.specTo - EARN.specFrom, easing: Easing.inOut(Easing.cubic), useNativeDriver: false })),
        at(EARN.textAt, Animated.timing(v.text, { toValue: 1, duration: EARN.textFor, easing: out, useNativeDriver: true })),
        variant === "legacy" ? at(EARN.ringAt, Animated.timing(v.ring, { toValue: 1, duration: EARN.ringFor, easing: out, useNativeDriver: true })) : Animated.delay(0),
        variant === "pr" ? at(EARN.odoFrom, Animated.timing(v.odo, { toValue: 1, duration: EARN.odoTo - EARN.odoFrom, useNativeDriver: false })) : Animated.delay(0),
        variant === "pr" ? at(EARN.settle, Animated.timing(v.chip, { toValue: 1, duration: EARN.chipFor, easing: out, useNativeDriver: true })) : Animated.delay(0),
        variant === "plate"
          ? Animated.sequence([
              Animated.delay(EARN.plateSwapFrom),
              Animated.parallel([
                Animated.timing(v.swap, { toValue: 1, duration: EARN.plateSwapTo - EARN.plateSwapFrom, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
                Animated.sequence([
                  Animated.timing(v.pulse, { toValue: 1.06, duration: 175, useNativeDriver: true }),
                  Animated.timing(v.pulse, { toValue: 1, duration: 175, useNativeDriver: true }),
                ]),
              ]),
            ])
          : Animated.delay(0),
      ]).start(() => {
        v.spec.removeListener(specId);
        v.odo.removeListener(odoId);
        if (alive) setSpec(0.35);
      });
    }
    return () => {
      alive = false;
      clearTimeout(settleTimer);
      player.current?.cancel();
    };
  }, [hero.id]);

  const skip = () => {
    player.current?.skip();
    endState();
    announce();
  };

  const fadeUp = { opacity: v.text, transform: [{ translateY: v.text.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] };
  let figure: React.ReactNode;
  if (variant === "plate") {
    const up = plateTierUp(hero);
    figure = (
      <Animated.View style={{ opacity: v.show, transform: [{ scale: v.pulse }] }}>
        <LifetimePlate days={up.days} bare />
        <Animated.View pointerEvents="none" style={{ position: "absolute", opacity: v.swap.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }}>
          <LifetimePlate days={up.days} bare tierOverride={up.from} progressOverride={1} />
        </Animated.View>
      </Animated.View>
    );
  } else {
    figure = (
      <View style={{ width: EARN_MEDAL, height: EARN_MEDAL, alignItems: "center", justifyContent: "center" }}>
        {variant === "legacy" ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              width: EARN_MEDAL,
              height: EARN_MEDAL,
              borderRadius: EARN_MEDAL / 2,
              borderWidth: 3,
              borderColor: art.arcDone,
              opacity: v.ring.interpolate({ inputRange: [0, 0.001, 1], outputRange: [0, 0.9, 0] }),
              transform: [{ scale: v.ring.interpolate({ inputRange: [0, 1], outputRange: [1, (EARN_MEDAL + RING_GROW) / EARN_MEDAL] }) }],
            }}
          />
        ) : null}
        <Animated.View
          style={{
            opacity: v.show,
            transform: [
              { perspective: 600 },
              { translateY: v.drop.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] }) },
              { scale: v.scale },
              { rotateY: v.turn.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) },
            ],
          }}
        >
          <Medal badgeId={hero.badgeId} state="earned" size={EARN_MEDAL} spec={spec} />
        </Animated.View>
      </View>
    );
  }

  const e = hero.evidence?.kind === "strength_pr" ? hero.evidence : null;
  const load = e ? odometer(e.previousBest.load, e.newBest.load, odo) : 0;

  return (
    <Pressable accessibilityRole="none" onPress={skip} style={{ alignItems: "center", gap: space.md, paddingVertical: space.md }}>
      <Animated.View
        pointerEvents="none"
        style={{ position: "absolute", top: -space.lg, bottom: -space.lg, start: -space.lg, end: -space.lg, borderRadius: radius.card, backgroundColor: art.shadow, opacity: v.dim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] }) }}
      />
      {figure}
      <Animated.View style={[{ alignItems: "center", gap: space.xs }, fadeUp]}>
        <AppText style={{ fontSize: ty.title, fontWeight: "600", textAlign: "center" }}>{title}</AppText>
        {e ? (
          <AppText style={{ fontSize: ty.load, fontWeight: "600", textAlign: "center" }}>{formatSetEvidence(load, e.newBest.reps, lang, unit)}</AppText>
        ) : null}
        {line ? <AppText style={{ color: p.muted, textAlign: "center" }}>{line}</AppText> : null}
      </Animated.View>
      {e ? (
        <Animated.View style={{ opacity: v.chip, transform: [{ scale: v.chip.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }], backgroundColor: p.tint, borderRadius: radius.button, paddingHorizontal: space.md, paddingVertical: space.xs }}>
          <AppText style={{ fontWeight: "600", color: p.accent }}>{prDelta(e, lang, unit, t)}</AppText>
        </Animated.View>
      ) : null}
    </Pressable>
  );
}
