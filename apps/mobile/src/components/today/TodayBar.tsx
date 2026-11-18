import React, { useState } from "react";
import { useWindowDimensions, View } from "react-native";
import { useI18n } from "../../i18n";
import { formatLoad } from "../../i18n/format";
import { HERO_H, HERO_H_LARGE } from "../../logic/barArt";
import { heroA11yLabel, heroLoad, heroNumberParts } from "../../logic/todayHeroText";
import type { TodayHero } from "../../logic/todayHero";
import { space, type as ty, usePalette } from "../../theme";
import { AppText, QuietAction } from "../../ui";
import { BarArt } from "./BarArt";
import { BarbellRunway } from "./BarbellRunway";
import { BeltArt, DumbbellPairArt, HoldArt, HornArt, StackArt } from "./ObjectArt";
import { PlateEngraving } from "./PlateEngraving";

export const LARGE_TEXT = 1.3;

/** The art slot: 132 dp, or 96 dp above fontScale 1.3 so the art shrinks before any text does (spec §8). */
export function heroArtHeight(fontScale: number): number {
  return fontScale > LARGE_TEXT ? HERO_H_LARGE : HERO_H;
}

export interface TodayBarProps {
  hero: TodayHero;
  /** The lead lift's display name in the app language (exerciseLabels). */
  name: string;
  /** A simple target on Today, retaining the load art without warm-up controls or plate captions. */
  compact?: boolean;
  /** Opens the load path (warm-ups). Barbell only; never on assisted. */
  onOpenPath?: () => void;
  /** In progress: the bar lifted (dp). */
  lifted?: number;
  /** Another day is open: this day's bar at 50%. */
  dim?: boolean;
  /** Replaces the eyebrow (in progress: "Set 3 of 3 · Bench Press"). */
  eyebrow?: string;
}

/** First run: an empty bar with dashed ghost plates (the state copy lives with the screen states). */
const FIRST_RUN_GHOST = [20];

/**
 * "Today's Bar": eyebrow, the target as the biggest number (48 load, 20 muted unit, 36 "× reps"), the art for the lift's equipment and the
 * plate line. Everything above Warm-ups is ONE accessibility element; the art is hidden from screen readers and never mirrors.
 */
export function TodayBar({ hero, name, compact = false, onOpenPath, lifted, dim, eyebrow: eyebrowOverride }: TodayBarProps) {
  const { t, lang, unit } = useI18n();
  const p = usePalette();
  const { fontScale } = useWindowDimensions();
  const [runwayStep, setRunwayStep] = useState<number>(-1);
  const h = heroArtHeight(fontScale);
  const letters = { s: t("qty.s"), m: t("qty.m") };
  const label = heroA11yLabel(hero, t, lang, unit, letters, name);
  if (hero.kind === "firstRun") {
    return (
      <View accessible accessibilityLabel={label} style={{ gap: space.sm }}>
        <AppText style={{ fontSize: ty.section, fontWeight: "600", color: p.text }}>{t("today.first.number")}</AppText>
        {compact ? null : <BarArt perSide={[]} ghost={FIRST_RUN_GHOST} unit={unit} height={h} />}
      </View>
    );
  }
  if (hero.kind === "unloaded") return <View accessible accessibilityLabel={label} style={{ gap: space.sm }}>
    <AppText style={{ fontSize: ty.caption, fontWeight: "600", color: p.muted }}>{name}</AppText>
    <AppText style={{ fontSize: ty.display, fontWeight: "700", color: p.text }}>{"\u2014"}</AppText>
    {hero.object === "dumbbell" ? <DumbbellPairArt load={null} count={hero.count} unit={unit} height={h}/> : <StackArt load={null} pinIndex={null} unit={unit} height={h}/>}
    {compact ? <View style={{ minHeight: ty.label * 1.5 }} /> : null}
  </View>;
  const parts = heroNumberParts(hero, lang, unit, letters);
  const eyebrow = eyebrowOverride ?? (hero.isGoal ? `${name} · ${t("today.goalTag")}` : name);
  const fmt = (kg: number) => formatLoad(kg, lang, unit);
  const captions: React.ReactNode[] = [];
  let art: React.ReactNode = null;
  switch (hero.kind) {
    case "barbell": {
      const activePerSide = runwayStep >= 0 && runwayStep < hero.warmups.length ? hero.warmups[runwayStep]!.perSide : hero.calc.perSide;
      art = <BarArt perSide={activePerSide} ghost={runwayStep >= 0 ? null : hero.ghost} unit={unit} height={h} lifted={lifted} />;
      if (hero.calc.perSide.length === 0) captions.push(t("today.emptyBar"));
      else captions.push(<PlateEngraving key="eng" perSide={hero.calc.perSide} normalLoad={hero.normalLoad} />);
      if (!hero.calc.exact) captions.push(t("today.nearest", { load: fmt(hero.calc.load), target: fmt(hero.load) }));
      break;
    }
    case "dumbbell":
      art = <DumbbellPairArt load={hero.load} count={hero.count} unit={unit} height={h} />;
      captions.push(t(hero.count === 1 ? "today.equipment.single" : "today.equipment.each", { load: fmt(hero.load) }));
      break;
    case "stack":
      art = <StackArt pinIndex={hero.pinIndex} rowCount={hero.rowCount} load={hero.load} unit={unit} height={h} />;
      captions.push(t("today.stack"));
      break;
    case "assisted":
      art = <StackArt pinIndex={hero.pinIndex} rowCount={hero.rowCount} load={hero.load} unit={unit} height={h} />;
      captions.push(t("today.assist", { load: fmt(hero.load) }));
      break;
    case "horn":
      art = <HornArt perSide={hero.perSide} unit={unit} height={h} />;
      captions.push(t("today.horn", { load: fmt(hero.load) }));
      captions.push(<PlateEngraving key="eng" perSide={hero.perSide} />);
      break;
    case "belt":
      art = <BeltArt plates={hero.plates} unit={unit} height={h} />;
      captions.push(t("today.belt", { load: fmt(hero.added) }));
      break;
    case "hold":
      art = <HoldArt object={hero.object} load={heroLoad(hero)} unit={unit} height={h} />;
      break;
    case "noGym":
      break;
  }
  const warmups = hero.kind === "barbell" && hero.warmups.length > 0 && onOpenPath && !dim ? onOpenPath : null;
  const captionText = captions.map((c, i) => typeof c === "string" ? <AppText key={i} style={{ fontSize: ty.label, color: p.muted }}>{c}</AppText> : c);
  const objectCaption = compact && (hero.kind === "dumbbell" || hero.kind === "stack" || hero.kind === "assisted");
  return (
    <View style={{ gap: space.sm, opacity: dim ? 0.5 : 1 }}>
      <View accessible accessibilityLabel={label} style={{ gap: space.sm }}>
        <AppText
          numberOfLines={2}
          style={lang === "ar" ? { fontSize: ty.body, fontWeight: "600", color: p.text } : { fontSize: ty.caption, fontWeight: "600", color: p.muted, textTransform: "uppercase", letterSpacing: 1 }}
        >
          {eyebrow}
        </AppText>
        {parts.timed !== null ? (
          <AppText style={{ fontSize: ty.load, fontWeight: "700", color: p.text, fontVariant: ["tabular-nums"] }}>{parts.timed}</AppText>
        ) : (
          <AppText style={{ fontSize: ty.display, fontWeight: "700", color: p.text, fontVariant: ["tabular-nums"] }}>
            {parts.num}
            <AppText style={{ fontSize: ty.section, fontWeight: "600", color: p.muted }}>{parts.unit}</AppText>
            {parts.times ? <AppText style={{ fontSize: ty.load, fontWeight: "700", color: p.text, fontVariant: ["tabular-nums"] }}>{parts.times}</AppText> : null}
          </AppText>
        )}
        {art}
        {objectCaption ? <View style={{ minHeight: ty.label * 1.5 }}>{hero.kind === "stack" ? null : captionText}</View> : compact ? null : captionText}
      </View>
      {!compact && warmups ? (
        <View style={{ alignItems: "flex-start" }}>
          <QuietAction label={t("today.warmups")} onPress={warmups} />
        </View>
      ) : null}
      {!compact && hero.kind === "barbell" && hero.warmups.length > 0 && !dim ? (
        <BarbellRunway
          warmups={hero.warmups}
          topLoad={hero.load}
          topReps={hero.reps ?? 8}
          unit={unit}
          selectedStepIndex={runwayStep}
          onSelectStep={setRunwayStep}
        />
      ) : null}
    </View>
  );
}
