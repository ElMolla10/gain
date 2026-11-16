import React, { useMemo, useState } from "react";
import { FlatList, Pressable, TextInput, View } from "react-native";
import {
  bestSessionVolume,
  bestSetVolume,
  goalEta,
  heaviestSet,
  isTimedMeasure,
  prKindsForSet,
  projectE1rm,
  repMaxes,
  sortNewestFirst,
  strengthProjection,
  type GoalEta,
  type HistorySession,
  type LiftTrend,
  type LoggedSet,
} from "@gain/engine";
import type { LiftItem } from "../db/historyRepo";
import { E1rmChart, type ChartPoint } from "../components/trend/E1rmChart";
import { PillTabs } from "../components/trend/PillTabs";
import { RepMaxTable } from "../components/trend/RepMaxTable";
import { useI18n } from "../i18n";
import { numberPadAccessory } from "../numberPad";
import { isolateLtr } from "../i18n/format";
import { loadTargetText } from "../logic/bidiText";
import { formatDay } from "../logic/dateText";
import {
  goalLine,
  isVerifiedPrSet,
  groupedNumber,
  monthPart,
  monthYear,
  parseGoal,
  rangeStart,
  repMaxRows,
  sessionVolumeKg,
  setsLabel,
  signedWhole,
  wholeInUnit,
  workingSets,
  type PrSetRef,
  type SummaryRange,
} from "../logic/progressionSummary";
import { kgToUnit, unitToKg, weightText } from "../logic/units";
import { radius, space, type as ty, usePalette } from "../theme";
import { AppText, Screen, useInputFont } from "../ui";

export type ProgressionTab = "summary" | "repMax" | "history";
const DAY_MS = 86_400_000;
const RECENT = 3;

export type { PrSetRef } from "../logic/progressionSummary";

function sessionAt(h: HistorySession): number {
  return Date.parse(h.performedAt);
}

/**
 * Exercise progression (Summary / Rep Max / History). The title, back and the setup gear live in the native header (the screen sets
 * them); everything here is one tab at a time, with rounded numbers and the lifter's unit.
 */
export function LiftTrendView({
  lift,
  trend,
  sessions,
  nextTarget,
  nextParts,
  whySentence,
  goalKg,
  onGoalChange,
  prSets,
  now = Date.now(),
}: {
  lift: LiftItem;
  trend: LiftTrend;
  sessions: HistorySession[];
  /** The deterministic next-workout suggestion as text ("80 kg × 8"), when there is one. */
  nextTarget?: string | null;
  /** The same suggestion as numbers, for the large hero (reps lines only). */
  nextParts?: { load: number; reps: number } | null;
  /** Its one-line reason. */
  whySentence?: string | null;
  /** Saved Summary goal (kg), per exercise and setup. */
  goalKg?: number | null;
  onGoalChange?: (kg: number | null) => void;
  /** Verified PRs on this lift and setup; drives the PRs tile and the History chips. */
  prSets?: PrSetRef[];
  now?: number;
}) {
  const { t, lang, unit, unitText } = useI18n();
  const p = usePalette();
  const inputFont = useInputFont("600");
  const [tab, setTab] = useState<ProgressionTab>("summary");
  const [range, setRange] = useState<SummaryRange>("all");
  const [goalText, setGoalText] = useState<string>(goalKg ? String(Math.round(kgToUnit(goalKg, unit))) : "");
  const assisted = lift.setup === "assisted";
  const timed = trend.timed ?? (isTimedMeasure(lift.measure) ? lift.measure : null);
  const e1rmMode = !timed && !assisted;
  const letters = { s: t("qty.s"), m: t("qty.m") };
  const setText = (pt: { load: number; reps: number; quantity?: number }) =>
    timed && pt.quantity !== undefined
      ? loadTargetText(pt.load, pt.quantity, timed, lang, unit, letters)
      : loadTargetText(pt.load, pt.reps, "reps", lang, unit, letters);
  const loggedText = (s: LoggedSet) =>
    timed
      ? loadTargetText(s.load, timed === "time" ? (s.durationS ?? 0) : (s.distanceM ?? 0), timed, lang, unit, letters)
      : loadTargetText(s.load, s.reps, "reps", lang, unit, letters);
  const withUnit = (n: string) => `${isolateLtr(n)}\u00A0${unitText}`;

  const records = useMemo(() => {
    const heaviest = heaviestSet(sessions, lift.setup);
    const setVol = bestSetVolume(sessions);
    const sessionVol = bestSessionVolume(sessions);
    const reps = timed ? [] : repMaxes(sessions, lift.setup);
    return { heaviest, setVol, sessionVol, reps };
  }, [sessions, lift.setup, timed]);
  const proj = useMemo(() => strengthProjection(trend.points, now), [trend.points, now]);
  const newestFirst = useMemo(() => sortNewestFirst(sessions), [sessions]);
  const importedAt = useMemo(() => new Set(trend.points.filter((x) => x.imported).map((x) => x.at)), [trend.points]);

  const isPrSet = (h: HistorySession, s: LoggedSet, index: number): boolean => {
    const at = sessionAt(h);
    if (prSets) return isVerifiedPrSet(prSets, at, s);
    return prKindsForSet({ heaviest: records.heaviest, bestSetVolume: records.setVol, repMaxes: [] }, at, index).length > 0;
  };
  const prCount = prSets ? prSets.length : newestFirst.reduce((n, h) => n + workingSets(h).filter(({ set, index }) => isPrSet(h, set, index)).length, 0);

  // ---- Summary -------------------------------------------------------------------------------------------------------------
  const goalUnit = parseGoal(goalText);
  const goalKgTyped = goalUnit === null ? null : unitToKg(goalUnit, unit);
  const eta: GoalEta | null = e1rmMode && proj.canProject && goalKgTyped !== null ? goalEta(proj, goalKgTyped, now) : null;
  const horizonAt = proj.currentAt !== null ? Math.max(now, proj.currentAt) + 90 * DAY_MS : now;
  const projEndAt = eta?.kind === "eta" ? eta.at : horizonAt;
  const projValue = e1rmMode ? projectE1rm(proj, projEndAt) : null;
  const shownFrom = rangeStart(range, now);
  const chartPoints: ChartPoint[] = e1rmMode
    ? proj.points.filter((x) => x.at >= shownFrom).map((x) => ({ at: x.at, value: kgToUnit(x.e1rm, unit), imported: x.imported }))
    : trend.points.filter((x) => x.at >= shownFrom).map((x) => ({ at: x.at, value: timed && x.quantity !== undefined ? x.quantity : kgToUnit(x.load, unit), imported: x.imported }));
  const projection = projValue !== null && chartPoints.length > 0 ? { at: projEndAt, value: kgToUnit(projValue, unit) } : null;
  const goalMark = eta?.kind === "eta" && goalKgTyped !== null && projection ? { value: kgToUnit(goalKgTyped, unit), at: eta.at } : null;
  const chartEnd = projection ? projection.at : chartPoints[chartPoints.length - 1]?.at ?? now;
  const goalInfo = eta ? goalLine(eta, lang, t) : null;
  const onPaceText =
    e1rmMode && proj.canProject && !proj.notOnPace && goalKgTyped === null
      ? t("trend.goal.onPace", { load: withUnit(String(wholeInUnit(projectE1rm(proj, horizonAt) ?? 0, unit))), when: monthPart(horizonAt, lang, t) })
      : null;
  const headlineNumber = e1rmMode && proj.current !== null ? String(wholeInUnit(proj.current, unit)) : null;
  const headlineValue = headlineNumber !== null ? withUnit(headlineNumber) : !e1rmMode && trend.latest ? setText(trend.latest) : null;
  const perMonth = e1rmMode ? proj.perMonth : timed ? null : trend.loadChangePer30d;
  const perMonthText = perMonth !== null && perMonth !== undefined ? t("trend.perMonth", { delta: signedWhole(perMonth, unit), unit: unitText }) : null;
  const perMonthGood = perMonth !== null && perMonth !== undefined && wholeInUnit(perMonth, unit) !== 0 && (assisted ? perMonth < 0 : perMonth > 0);

  const eyebrow = (text: string) => (
    <AppText style={{ fontSize: ty.caption, fontWeight: "600", color: p.muted, letterSpacing: lang === "ar" ? 0 : 1.2, textTransform: "uppercase" }}>{text}</AppText>
  );

  const hero = (
    <View style={{ gap: space.xs }}>
      {eyebrow(t("trend.nextWorkout"))}
      {nextParts && !timed ? (
        <View accessible accessibilityLabel={nextTarget ?? undefined} style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", columnGap: space.sm }}>
          <AppText style={{ fontSize: ty.display, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{isolateLtr(weightText(nextParts.load, unit))}</AppText>
          <AppText style={{ fontSize: ty.section, color: p.muted }}>{unitText}</AppText>
          <AppText style={{ fontSize: ty.title, color: p.muted }}>×</AppText>
          <AppText style={{ fontSize: ty.display, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{isolateLtr(String(nextParts.reps))}</AppText>
        </View>
      ) : nextTarget ? (
        <AppText style={{ fontSize: ty.load, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{nextTarget}</AppText>
      ) : (
        <AppText style={{ color: p.muted }}>{t("trend.nextNone")}</AppText>
      )}
      {whySentence ? <AppText style={{ color: p.muted }}>{whySentence}</AppText> : null}
    </View>
  );

  const goalRow = e1rmMode && proj.canProject ? (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.md, borderTopWidth: 1, borderColor: p.border, paddingTop: space.md }}>
      <AppText style={{ color: p.muted }}>{t("trend.goal.label")}</AppText>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs, borderWidth: 1.5, borderColor: goalText ? p.accent : p.edge, borderRadius: radius.pill, paddingHorizontal: space.md, minHeight: 40 }}>
        <TextInput
          accessibilityLabel={t("trend.goal.a11y", { unit: unitText })}
          value={goalText}
          onChangeText={setGoalText}
          onEndEditing={() => onGoalChange?.(goalKgTyped)}
          keyboardType="decimal-pad"
          returnKeyType="done"
          maxLength={6}
          {...numberPadAccessory(t)}
          style={{ ...inputFont, width: 48, color: p.text, fontSize: ty.body, paddingVertical: space.xs, textAlign: "center" }}
        />
        <AppText style={{ fontSize: ty.label, color: p.muted }}>{unitText}</AppText>
      </View>
      <View style={{ flex: 1, alignItems: "flex-end" }}>
        <AppText style={{ fontSize: ty.label, fontWeight: goalInfo?.tone === "accent" || (!goalInfo && onPaceText) ? "600" : "400", color: goalInfo ? (goalInfo.tone === "accent" ? p.accent : p.muted) : p.accent }}>
          {goalInfo?.text ?? onPaceText ?? ""}
        </AppText>
      </View>
    </View>
  ) : null;

  const chartCard = (
    <View style={{ borderRadius: radius.card, borderWidth: 1, borderColor: p.border, backgroundColor: p.card, padding: space.lg, gap: space.md }}>
      <View style={{ gap: space.xs }}>
        {eyebrow(e1rmMode ? t("trend.e1rm") : t("trend.topSet"))}
        <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", columnGap: space.sm }}>
          {headlineNumber !== null ? (
            <View accessible accessibilityLabel={headlineValue ?? undefined} style={{ flexDirection: "row", alignItems: "baseline", gap: space.xs }}>
              <AppText style={{ fontSize: ty.title, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{isolateLtr(headlineNumber)}</AppText>
              <AppText style={{ fontSize: ty.body, color: p.muted }}>{unitText}</AppText>
            </View>
          ) : headlineValue ? (
            <AppText style={{ fontSize: ty.title, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{headlineValue}</AppText>
          ) : null}
          {perMonthText ? <AppText style={{ fontSize: ty.label, fontWeight: "600", color: perMonthGood ? p.accent : p.muted }}>{perMonthText}</AppText> : null}
        </View>
      </View>
      {chartPoints.length === 0 ? (
        <AppText style={{ color: p.muted }}>{t("trend.noPoints")}</AppText>
      ) : (
        <E1rmChart
          points={chartPoints}
          projection={projection}
          goal={goalMark}
          fromLabel={monthYear(chartPoints[0]!.at, lang)}
          toLabel={monthYear(chartEnd, lang)}
          summary={t(e1rmMode ? "trend.chart.a11y" : "trend.chart.a11yTopSet", { from: monthYear(chartPoints[0]!.at, lang), to: monthYear(chartPoints[chartPoints.length - 1]!.at, lang), load: headlineValue ?? "" })}
        />
      )}
      <PillTabs
        compact
        value={range}
        onChange={setRange}
        options={[
          { value: "3m", label: t("trend.range.3mShort") },
          { value: "1y", label: t("trend.range.1yShort") },
          { value: "all", label: t("trend.range.allShort") },
        ]}
      />
      {goalRow}
    </View>
  );

  const bestSetText = records.heaviest
    ? timed
      ? setText(records.heaviest)
      : `${isolateLtr(weightText(records.heaviest.load, unit))} × ${isolateLtr(String(records.heaviest.reps))}`
    : "—";
  const bestVolumeText = records.sessionVol ? withUnit(groupedNumber(kgToUnit(records.sessionVol.volume, unit), lang)) : "—";
  const tile = (label: string, value: string) => (
    <View key={label} style={{ flex: 1, borderRadius: radius.button, borderWidth: 1, borderColor: p.border, backgroundColor: p.card, padding: space.md, gap: 2 }}>
      <AppText numberOfLines={1} style={{ fontSize: ty.caption, color: p.muted }}>{label}</AppText>
      <AppText numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: ty.body, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{value}</AppText>
    </View>
  );

  const recentSessions = newestFirst.slice(0, RECENT);
  const topOf = (h: HistorySession) => trend.points.find((x) => x.at === sessionAt(h)) ?? null;
  const recent = recentSessions.length > 0 ? (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <AppText style={{ fontSize: ty.sectionSmall, fontWeight: "700" }}>{t("trend.recentTitle")}</AppText>
        <Pressable accessibilityRole="button" onPress={() => setTab("history")} style={{ minHeight: 48, justifyContent: "center", paddingHorizontal: space.xs }}>
          <AppText style={{ color: p.accent, fontWeight: "600" }}>{t("trend.seeAll")}</AppText>
        </Pressable>
      </View>
      <View style={{ borderRadius: radius.card, borderWidth: 1, borderColor: p.border, backgroundColor: p.card, overflow: "hidden" }}>
        {recentSessions.map((h, i) => {
          const top = topOf(h);
          return (
            <View key={`${h.performedAt}-${i}`} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.lg, minHeight: 52, borderTopWidth: i === 0 ? 0 : 1, borderColor: p.border }}>
              <AppText style={{ color: p.muted }}>{formatDay(sessionAt(h), lang, now)}</AppText>
              <AppText style={{ fontWeight: "700", fontVariant: ["tabular-nums"] }}>{top ? setText(top) : "—"}</AppText>
            </View>
          );
        })}
      </View>
    </View>
  ) : null;

  const summary = (
    <>
      {hero}
      {chartCard}
      <View style={{ flexDirection: "row", gap: space.sm }}>
        {tile(t("trend.stat.bestSet"), bestSetText)}
        {tile(t("trend.stat.bestVolume"), bestVolumeText)}
        {tile(t("trend.stat.prs"), String(prCount))}
      </View>
      {recent}
    </>
  );

  // ---- History -------------------------------------------------------------------------------------------------------------
  const historyCard = (h: HistorySession) => {
    const at = sessionAt(h);
    const sets = workingSets(h);
    const volume = sessionVolumeKg(h);
    return (
      <View style={{ borderRadius: radius.card, borderWidth: 1, borderColor: p.border, backgroundColor: p.card, paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.sm, marginBottom: space.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <AppText style={{ fontWeight: "700" }}>{formatDay(at, lang, now)}</AppText>
          {importedAt.has(at) ? (
            <View style={{ borderWidth: 1, borderColor: p.edge, borderRadius: radius.pill, paddingHorizontal: space.sm }}>
              <AppText style={{ fontSize: ty.caption, color: p.muted }}>{t("trend.imported")}</AppText>
            </View>
          ) : null}
          <View style={{ flex: 1 }} />
          <AppText style={{ fontSize: ty.label, color: p.muted }}>
            {timed ? setsLabel(sets.length, lang, t) : `${setsLabel(sets.length, lang, t)} · ${withUnit(groupedNumber(kgToUnit(volume, unit), lang))}`}
          </AppText>
        </View>
        {sets.map(({ set, index }) => (
          <View key={index} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 28 }}>
            <AppText style={{ fontWeight: "600", fontVariant: ["tabular-nums"] }}>{loggedText(set)}</AppText>
            {isPrSet(h, set, index) ? (
              <View style={{ paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: p.fill }}>
                <AppText style={{ fontSize: ty.caption, fontWeight: "700", color: p.onFill }}>{t("trend.prChip")}</AppText>
              </View>
            ) : null}
          </View>
        ))}
      </View>
    );
  };
  const historyList = (
    <FlatList
      style={{ flex: 1 }}
      data={newestFirst.filter((h) => workingSets(h).length > 0)}
      keyExtractor={(item, index) => `${item.performedAt}-${index}`}
      ListEmptyComponent={<AppText style={{ color: p.muted }}>{t("trend.history.empty")}</AppText>}
      renderItem={({ item }) => historyCard(item)}
    />
  );

  const rows = useMemo(() => repMaxRows(records.reps, lift.setup), [records.reps, lift.setup]);

  return (
    <Screen scroll={tab !== "history"} contentStyle={tab === "history" ? { flex: 1, paddingBottom: 0 } : undefined}>
      <PillTabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "summary", label: t("trend.tab.summary") },
          ...(timed ? [] : [{ value: "repMax" as const, label: t("trend.tab.repMax") }]),
          { value: "history", label: t("trend.tab.history") },
        ]}
      />
      {tab === "summary" ? summary : tab === "repMax" ? <RepMaxTable rows={rows} /> : historyList}
    </Screen>
  );
}
