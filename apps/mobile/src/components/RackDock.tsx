import React, { memo, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Animated, Easing, Pressable, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { useI18n } from "../i18n";
import { isolateLtr } from "../i18n/format";
import { dockKey, type DockModel } from "../logic/dockModel";
import { dockA11y, dockButtonText, dockLineText, dockLoggedText, dockNumberText, dockSetText } from "../logic/dockText";
import type { RestTimer } from "../logic/restTimer";
import type { Unit } from "../logic/units";
import { BAR_STEEL, TODAY_PLATES } from "../palettes";
import { radius, space, type as ty, useIsDark, useLogPalette, usePalette } from "../theme";
import { AppText, useReducedMotion } from "../ui";
import { haptics } from "../haptics";
import { dockStep, drainFraction, RACK_MOTION, stepHaptics } from "../logic/rackMotion";
import { Icon } from "./Icon";
import { RackDockExpanded, type ExpandInfo } from "./RackDockExpanded";
import { ART_HIDDEN, BarArt } from "./today/BarArt";
import { RestClock } from "./WorkoutStats";

/** Spinner on Log set only when a save takes longer than this (spec §2.3). */
export const DOCK_SPINNER_MS = 300;
/** At or below this window height the dock is one line (~84 dp) (Mohamed, 2026-10-18). */
export const DOCK_SHORT_SCREEN = 667;
/** Above this font scale: no mini, full-width Log set (k15). */
export const DOCK_LARGE_TEXT = 1.3;
export const LOG_MIN_W = 152;
export const LOG_H = 60;
export const MINI_W = 96;
export const MINI_H = 32;

export interface DockActions {
  log: () => void;
  finish: () => void;
  adjustRest: (seconds: number) => void;
  toggleRest: () => void;
  expandInfo: () => ExpandInfo | null;
}

export interface RackDockProps {
  model: DockModel;
  name: string;
  logged: number;
  timer: RestTimer;
  restFor: string | null;
  saving: boolean;
  unit: Unit;
  actions: React.MutableRefObject<DockActions>;
}

/** The equipment mini (spec §2.2): ≤12 shapes, never mirrored, hidden from the screen reader. The stack never carries a pin number. */
export function DockMini({ model, unit }: { model: DockModel; unit: Unit }) {
  const dark = useIsDark();
  const steel = dark ? BAR_STEEL.dark : BAR_STEEL.light;
  const pin = TODAY_PLATES.red.face;
  const kind = model.objKind;
  if (kind === "barbell") return <BarArt lod="grid" perSide={model.perSide} unit={unit} width={MINI_W} height={MINI_H} />;
  const frame = (children: React.ReactNode) => (
    <Svg width={MINI_W} height={MINI_H} viewBox={`0 0 ${MINI_W} ${MINI_H}`} {...ART_HIDDEN}>
      {children}
    </Svg>
  );
  if (kind === "dumbbell")
    return frame(
      <>
        <Rect x={30} y={14} width={36} height={4} fill={steel.base} />
        <Rect x={16} y={6} width={14} height={20} rx={2} fill={steel.lo} />
        <Rect x={66} y={6} width={14} height={20} rx={2} fill={steel.lo} />
      </>,
    );
  if (kind === "stack" || kind === "assist") {
    const known = model.change?.kind === "pin" ? !!model.change.known : false;
    return frame(
      <>
        {[0, 1, 2, 3, 4].map((i) => (
          <Rect key={i} x={30} y={3 + i * 5.6} width={36} height={4.2} fill={steel.base} />
        ))}
        {kind === "stack" && known ? <Circle cx={72} cy={3 + 2 * 5.6 + 2.1} r={3} fill={pin} /> : null}
        {kind === "assist" ? <Path d="M78 22 L84 14 L90 22" stroke={steel.hi} strokeWidth={2.5} fill="none" /> : null}
      </>,
    );
  }
  if (kind === "horn")
    return frame(
      <>
        <Rect x={8} y={14} width={80} height={4} fill={steel.base} />
        {model.perSide.slice(0, 4).map((_, i) => (
          <Rect key={i} x={54 + i * 7} y={4} width={5} height={24} fill={steel.lo} />
        ))}
      </>,
    );
  if (kind === "belt")
    return frame(
      <>
        <Path d="M20 6 Q48 30 76 6" stroke={steel.base} strokeWidth={2} fill="none" />
        <Rect x={42} y={16} width={12} height={14} rx={2} fill={steel.lo} />
      </>,
    );
  if (kind === "timed")
    return frame(
      <>
        <Circle cx={48} cy={16} r={12} stroke={steel.base} strokeWidth={2.5} fill="none" />
        <Path d="M48 16 L48 8 M48 16 L54 19" stroke={steel.hi} strokeWidth={2} />
      </>,
    );
  return null;
}

/**
 * The rest drain (spec §7): one Animated.timing(scaleX) for the whole rest, anchored at the start edge (mirrors in Arabic). Reduce
 * Motion: a static hairline whose fill updates once a second.
 */
export function RestDrain({ endsAt, durationMs, reduced, rtl, color }: { endsAt: number; durationMs: number; reduced: boolean; rtl: boolean; color: string }) {
  const scale = useRef(new Animated.Value(drainFraction(endsAt, durationMs, Date.now()))).current;
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (reduced) {
      const id = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(id);
    }
    const start = Date.now();
    scale.setValue(drainFraction(endsAt, durationMs, start));
    const anim = Animated.timing(scale, { toValue: 0, duration: Math.max(0, endsAt - start), easing: Easing.linear, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [endsAt, durationMs, reduced, scale]);
  const origin = rtl ? "right" : "left";
  if (reduced) return <View style={{ height: 2, borderRadius: 1, backgroundColor: color, width: `${Math.round(drainFraction(endsAt, durationMs, now) * 100)}%`, alignSelf: "flex-start" }} />;
  return <Animated.View style={{ height: 2, borderRadius: 1, backgroundColor: color, transformOrigin: origin, transform: [{ scaleX: scale }] }} />;
}

function LogButton({ label, a11y, disabled, saving, onPress, full }: { label: string; a11y: string; disabled: boolean; saving: boolean; onPress: () => void; full: boolean }) {
  const lp = useLogPalette();
  const p = usePalette();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!saving) return setSlow(false);
    const id = setTimeout(() => setSlow(true), DOCK_SPINNER_MS);
    return () => clearTimeout(id);
  }, [saving]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled, busy: saving }}
      disabled={disabled || saving}
      onPress={onPress}
      nativeID="rack-dock-log"
      style={({ pressed }) => ({
        minWidth: full ? undefined : LOG_MIN_W,
        alignSelf: full ? "stretch" : "auto",
        minHeight: LOG_H,
        paddingHorizontal: space.lg,
        borderRadius: radius.button,
        borderWidth: 1,
        borderColor: disabled ? lp.line : p.fillEdge,
        backgroundColor: disabled ? lp.line : pressed ? lp.fillPressed : lp.fill,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: space.sm,
      })}
    >
      {slow ? <ActivityIndicator color={lp.onFill} /> : <Icon name="check" color={disabled ? lp.muted : lp.onFill} size={20} />}
      <AppText style={{ color: disabled ? lp.muted : lp.onFill, fontSize: 16, fontWeight: "600" }}>{label}</AppText>
    </Pressable>
  );
}

/**
 * The Rack Dock (logger spec §2): the focused set as an object, its number, "Load the change", and Log set. It replaces the rest bar
 * and absorbs it (rest mode). Memoised on the model's primitives (`dockKey`), so a keystroke in a row never re-renders it; handlers come
 * through a ref. Log set stays on the PHYSICAL right in both languages (Mohamed, 2026-10-18): the action row is laid out LTR, the text
 * inside it keeps the language's direction.
 */
function RackDockImpl({ model, name, logged, timer, restFor, saving, unit, actions }: RackDockProps) {
  const { t, lang } = useI18n();
  const lp = useLogPalette();
  const { fontScale, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const k15 = fontScale > DOCK_LARGE_TEXT;
  const short = !k15 && height <= DOCK_SHORT_SCREEN;
  const [open, setOpen] = useState<ExpandInfo | null>(null);
  const pending = useRef<DockModel | null>(null);
  const ctx = { lang, unit, t };
  const reduced = useReducedMotion();
  // Motion (spec §7): the rack dip + counter crossfade when a set is logged, the unrack landing on first mount (Today's bar arrives in
  // the mini slot, its number in "rack-dock-number"), haptics only where the table says. Reduce Motion: crossfades only, haptics kept.
  const dip = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const land = useRef(new Animated.Value(0)).current;
  const prevModel = useRef<DockModel | null>(null);
  useEffect(() => {
    Animated.timing(land, { toValue: 1, duration: reduced ? RACK_MOTION.crossfade : RACK_MOTION.unrack, easing: Easing.inOut(Easing.ease), useNativeDriver: true }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const step = dockStep(prevModel.current, model);
    prevModel.current = model;
    for (const h of stepHaptics(step)) (h === "light" ? haptics.tick : haptics.selection)();
    if (!step.rack && !step.nextObject) return;
    fade.setValue(0.2);
    Animated.timing(fade, { toValue: 1, duration: reduced ? RACK_MOTION.crossfade : RACK_MOTION.counter, useNativeDriver: true }).start();
    if (reduced || !step.rack) return;
    Animated.sequence([
      Animated.timing(dip, { toValue: RACK_MOTION.dipDp, duration: RACK_MOTION.dip / 2, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(dip, { toValue: 0, duration: RACK_MOTION.dip / 2, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.rowKey, model.exId, model.mode]);
  const miniLand = reduced ? { opacity: land } : { opacity: land, transform: [{ scale: land.interpolate({ inputRange: [0, 1], outputRange: [RACK_MOTION.unrackMiniFrom, 1] }) }] };
  const numberLand = reduced ? { opacity: land } : { transform: [{ scale: land.interpolate({ inputRange: [0, 1], outputRange: [RACK_MOTION.unrackNumberFrom, 1] }) }] };
  useEffect(() => {
    const prev = pending.current;
    if (prev && (prev.rowKey !== model.rowKey || prev.exId !== model.exId)) {
      pending.current = null;
      AccessibilityInfo.announceForAccessibility(dockLoggedText(prev, model, ctx));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model.rowKey, model.exId]);
  if (model.mode === "hidden") return null;

  const over = model.mode === "over";
  const resting = model.mode === "rest";
  const textDir = { direction: lang === "ar" ? ("rtl" as const) : ("ltr" as const) };
  const shell = (children: React.ReactNode) => (
    <View
      style={{ backgroundColor: over ? lp.activeBg : lp.card, borderTopWidth: over ? 4 : 1, borderColor: over ? lp.accent : lp.line, paddingHorizontal: space.lg, paddingTop: short ? space.md : space.sm, paddingBottom: insets.bottom + space.md, gap: space.sm }}
    >
      <Animated.View style={{ gap: space.sm, transform: [{ translateY: dip }] }}>{children}</Animated.View>
    </View>
  );

  if (model.mode === "done") {
    return shell(
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md, direction: "ltr" }}>
        <View style={[{ flex: 1 }, textDir]}>
          <AppText accessibilityLiveRegion="polite" style={{ fontSize: 20, fontWeight: "600" }}>{t("rack.done", { n: logged })}</AppText>
        </View>
        <LogButton label={t("workout.finishBtn")} a11y={t("workout.finishBtn")} disabled={false} saving={false} onPress={() => actions.current.finish()} full={false} />
      </View>,
    );
  }

  const line = dockLineText(model, ctx);
  const set = dockSetText(model, t);
  const canExpand = (model.objKind === "barbell" || model.objKind === "horn") && model.perSide.length > 0;
  const expand = () => {
    const info = actions.current.expandInfo();
    if (!info) return;
    haptics.pickup();
    setOpen(info);
  };
  const caption = `${name} · ${set}`;
  const number = (
    <Animated.View nativeID="rack-dock-number" style={[{ opacity: fade, alignSelf: "flex-start", maxWidth: "100%" }, numberLand]}>
      <AppText numberOfLines={k15 ? 2 : 1} style={{ fontSize: short ? 20 : 28, fontWeight: "600", fontVariant: ["tabular-nums"] }}>
        {dockNumberText(model, ctx)}
      </AppText>
    </Animated.View>
  );
  const lineText = line ? (
    <AppText numberOfLines={short ? 1 : 2} style={{ fontSize: short ? 13 : 14, color: line.warn ? lp.warn : lp.muted }}>
      {line.text}
    </AppText>
  ) : null;
  const info = (
    <Pressable
      accessible
      accessibilityRole={canExpand ? "button" : "summary"}
      accessibilityLabel={dockA11y(model, name, ctx)}
      accessibilityHint={canExpand ? t("rack.expand") : undefined}
      accessibilityActions={canExpand ? [{ name: "activate", label: t("rack.expand") }] : undefined}
      onAccessibilityAction={canExpand ? expand : undefined}
      onPress={canExpand ? expand : undefined}
      hitSlop={{ top: 8, bottom: 8 }}
      style={[{ flex: 1, minWidth: 0, minHeight: 48, justifyContent: "center", gap: 2 }, textDir]}
    >
      {!short && !k15 ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: MINI_H }}>
          <Animated.View style={[{ opacity: resting ? 0.6 : 1, direction: "ltr" }, miniLand]}>
            <DockMini model={model} unit={unit} />
          </Animated.View>
          <AppText numberOfLines={1} style={{ flex: 1, fontSize: 13, color: lp.muted, textTransform: lang === "ar" ? "none" : "uppercase" }}>{caption}</AppText>
        </View>
      ) : k15 ? (
        <AppText numberOfLines={2} style={{ fontSize: 13, color: lp.muted }}>{caption}</AppText>
      ) : null}
      {short ? (
        // A 375 pt phone has ~180 pt beside Log set: the number and its change line take all of it, so the mini is left out here
        // (the expanded sheet still draws the bar). A mini beside them clipped "120 kg × 8".
        <View style={{ minWidth: 0 }}>
          {number}
          {lineText}
        </View>
      ) : (
        <>
          {number}
          {lineText}
        </>
      )}
    </Pressable>
  );
  const button = (
    <LogButton
      label={dockButtonText(model, t)}
      a11y={t("rack.a11y.log", { set, exercise: name })}
      disabled={!model.canLog}
      saving={saving}
      full={k15}
      onPress={() => {
        pending.current = model;
        haptics.tick();
        actions.current.log();
      }}
    />
  );
  return (
    <>
      {shell(
        <>
          {resting || over ? (
            <View style={{ gap: space.xs }}>
              {resting && timer.endsAt !== null ? <RestDrain endsAt={timer.endsAt} durationMs={timer.durationMs} reduced={reduced} rtl={lang === "ar"} color={lp.accent} /> : null}
              {restFor && !over ? <AppText numberOfLines={1} style={{ color: lp.muted, fontSize: 13 }}>{restFor}</AppText> : null}
              <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", columnGap: space.sm, rowGap: space.sm }}>
                {over ? (
                  <View accessibilityLiveRegion="polite" accessible accessibilityLabel={t("workout.rest.done")} style={{ flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 48 }}>
                    <Icon name="check" color={lp.accent} size={28} />
                    <AppText style={{ fontSize: ty.title, fontWeight: "600" }}>{t("workout.rest.done")}</AppText>
                  </View>
                ) : (
                  <>
                    <RestClock timer={timer} style={{ fontSize: 36, fontWeight: "600", minWidth: 110, color: lp.text }} />
                    <View style={{ flexDirection: "row", gap: space.sm, flexGrow: 1, flexBasis: 200 }}>
                      {[-15, 15].map((d) => (
                        <Pressable key={d} accessibilityRole="button" accessibilityLabel={`${d > 0 ? "+" : "−"}${Math.abs(d)} ${t("qty.s")}`} onPress={() => actions.current.adjustRest(d)} style={({ pressed }) => ({ flex: 1, minHeight: 48, borderRadius: radius.button, borderWidth: 1.5, borderColor: lp.edge, backgroundColor: pressed ? lp.line : lp.field, alignItems: "center", justifyContent: "center" })}>
                          <AppText ltr style={{ fontWeight: "600", fontSize: 16 }}>{isolateLtr(d > 0 ? `+${d}` : `−${-d}`)}</AppText>
                        </Pressable>
                      ))}
                      <Pressable accessibilityRole="button" accessibilityState={{ busy: timer.endsAt !== null }} onPress={() => actions.current.toggleRest()} style={({ pressed }) => ({ flex: 1.4, minHeight: 48, borderRadius: radius.button, borderWidth: 1.5, borderColor: lp.edge, backgroundColor: pressed ? lp.line : lp.field, alignItems: "center", justifyContent: "center", paddingHorizontal: space.sm })}>
                        <AppText style={{ fontWeight: "600", fontSize: 16, textAlign: "center" }}>{timer.endsAt !== null ? t("workout.rest.stop") : t("workout.rest.start")}</AppText>
                      </Pressable>
                    </View>
                  </>
                )}
              </View>
            </View>
          ) : null}
          {k15 ? (
            <>
              {info}
              {button}
            </>
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.md, direction: "ltr" }}>
              {info}
              {button}
            </View>
          )}
        </>,
      )}
      {open ? <RackDockExpanded info={open} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

/** Same dock when every drawn primitive is the same (handlers are read through the ref). */
export function sameDockProps(a: RackDockProps, b: RackDockProps): boolean {
  return (
    dockKey(a.model) === dockKey(b.model) &&
    a.name === b.name &&
    a.logged === b.logged &&
    a.timer.endsAt === b.timer.endsAt &&
    a.timer.durationMs === b.timer.durationMs &&
    a.restFor === b.restFor &&
    a.saving === b.saving &&
    a.unit === b.unit &&
    a.actions === b.actions
  );
}

export const RackDock = memo(RackDockImpl, sameDockProps);
/** The unmemoised dock, for tests. */
export const RackDockView = RackDockImpl;
