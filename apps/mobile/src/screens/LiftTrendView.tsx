import { targetPhrase } from "../logic/quantity";
import React, { useMemo, useState } from "react";
import { SectionList, View } from "react-native";
import {
  bestEstimated1rm,
  bestSessionVolume,
  bestSetVolume,
  heaviestSet,
  isTimedMeasure,
  prKindsForSet,
  repMaxes,
  sortNewestFirst,
  type EquipmentType,
  type GymLoadSpec,
  type HistorySession,
  type LiftTrend,
  type LoggedSet,
  type PrKind,
} from "@gain/engine";
import type { LiftItem } from "../db/historyRepo";
import { TrendChart } from "../components/TrendChart";
import { useI18n } from "../i18n";
import { exerciseLabels, isolateLtr } from "../i18n/format";
import { directionKey, filterTrendPoints, groupSessionsByDate, localDateText, metricTrendPoints, type ChartMetric, type ChartRange } from "../logic/trendChart";
import { loadsSummaryText, matchingJumpKg, TREND_LOAD_JUMPS_KG } from "../logic/exerciseLoads";
import { exercisePath } from "../logic/exercisePath";
import { kgToUnit, weightText } from "../logic/units";
import { space, type as ty, usePalette } from "../theme";
import { AppText, BigButton, Card, Chip, Screen } from "../ui";

type Tab = "summary" | "history";

export interface LiftLoadsProps {
  equipment: EquipmentType;
  own: GymLoadSpec | null;
  gym: GymLoadSpec | null;
  onPickJump: (kg: number) => void;
}

function sessionAt(h: HistorySession): number {
  return Date.parse(h.performedAt);
}

export function LiftTrendView({
  lift,
  trend,
  sessions,
  onOpenLoads,
  loads,
  paceHeadline,
  paceDetails,
  nextTarget,
  setups,
  onPickSetup,
}: {
  lift: LiftItem;
  trend: LiftTrend;
  sessions: HistorySession[];
  onOpenLoads: () => void;
  loads?: LiftLoadsProps | null;
  paceHeadline?: string | null;
  paceDetails?: string[];
  nextTarget?: string | null;
  setups?: { lineId: string; label: string; selected: boolean }[];
  onPickSetup?: (lineId: string) => void;
}) {
  const { t, lang, unit, unitText, fmt } = useI18n();
  const p = usePalette();
  const [tab, setTab] = useState<Tab>("summary");
  const [metric, setMetric] = useState<ChartMetric>("weight");
  const [range, setRange] = useState<ChartRange>("all");
  const assisted = lift.setup === "assisted";
  const timed = trend.timed ?? (isTimedMeasure(lift.measure) ? lift.measure : null);
  const letters = { s: t("qty.s"), m: t("qty.m") };
  const setText = (pt: { load: number; reps: number; quantity?: number }) =>
    timed && pt.quantity !== undefined
      ? isolateLtr(targetPhrase(pt.load, pt.quantity, timed, fmt, letters))
      : `${fmt(pt.load)} ${isolateLtr(`× ${pt.reps}`)}`;
  const loggedText = (s: LoggedSet) =>
    timed
      ? isolateLtr(targetPhrase(s.load, timed === "time" ? (s.durationS ?? 0) : (s.distanceM ?? 0), timed, fmt, letters))
      : `${fmt(s.load)} ${isolateLtr(`× ${s.reps}`)}`;

  const records = useMemo(() => {
    const heaviest = heaviestSet(sessions, lift.setup);
    const setVol = bestSetVolume(sessions);
    const sessionVol = bestSessionVolume(sessions);
    const e1rm = timed ? null : bestEstimated1rm(sessions);
    const reps = timed ? [] : repMaxes(sessions, lift.setup);
    return { heaviest, setVol, sessionVol, e1rm, reps };
  }, [sessions, lift.setup, timed]);
  const path = useMemo(() => timed ? null : exercisePath(sessions, lift.setup), [sessions, lift.setup, timed]);

  const sections = useMemo(() => groupSessionsByDate(sortNewestFirst(sessions)), [sessions]);
  const recent = [...trend.points].reverse().slice(0, 10);
  const chartSource = filterTrendPoints(trend.points, range, Date.now());
  const chartPoints = metricTrendPoints(chartSource, timed && metric !== "weight" ? "volume" : metric);

  const badgeLabel = (kind: PrKind) =>
    kind === "heaviest" ? t("trend.badge.heaviest") : kind === "volume" ? t("trend.badge.volume") : t("trend.badge.rep");

  const loadsButton = <BigButton variant="secondary" label={t("loads.open")} onPress={onOpenLoads} />;

  const summary = (
    <>
      {path ? <Card>
        <AppText style={{ fontWeight: "600", fontSize: ty.section }}>{t("path.title")}</AppText>
        <AppText style={{ fontSize: ty.load, fontWeight: "600", color: p.accent }}>
          {t(`path.tier.${path.tier}`)} · {path.score}
        </AppText>
        <AppText>{t("path.from", { start: fmt(path.baseline), best: fmt(path.best) })}</AppText>
        <AppText style={{ color: p.muted }}>{path.next && path.nextScore !== null ? t("path.next", { tier: t(`path.tier.${path.next}`), score: path.nextScore }) : t("path.top")}</AppText>
        <View accessible accessibilityRole="progressbar" accessibilityLabel={t("path.progress", { score: path.score })}
          accessibilityValue={{ min: 0, max: 100, now: Math.round(path.progress * 100) }}
          style={{ height: 8, borderRadius: 4, backgroundColor: p.border, overflow: "hidden" }}>
          <View style={{ height: 8, width: `${Math.round(path.progress * 100)}%`, backgroundColor: p.accent }} />
        </View>
        <AppText style={{ color: p.muted, fontSize: ty.caption }}>{t("path.rule")}</AppText>
      </Card> : null}
      {paceHeadline ? (
        <Card>
          <AppText style={{ fontWeight: "600" }}>{t("trend.pace")}</AppText>
          <AppText>{paceHeadline}</AppText>
          {(paceDetails ?? []).map((line) => (
            <AppText key={line} style={{ color: p.muted }}>{line}</AppText>
          ))}
        </Card>
      ) : null}
      {setups && setups.length > 1 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          {setups.map((s) => (
            <Chip key={s.lineId} label={s.label} selected={s.selected} onPress={() => onPickSetup?.(s.lineId)} />
          ))}
        </View>
      ) : null}
      <Card>
        <AppText style={{ color: p.muted }}>{timed ? t("trend.timedMeasure") : assisted ? t("trend.measureAssisted") : t("trend.measure")}</AppText>
        {trend.points.length === 0 ? <AppText>{t("trend.noPoints")}</AppText> : null}
        <AppText style={{ fontWeight: "600", fontSize: ty.section }}>{t(directionKey(trend.direction, assisted))}</AppText>
        {trend.latest ? <AppText ltr style={{ fontSize: ty.load, fontWeight: "600" }}>{setText(trend.latest)}</AppText> : null}
        {timed && trend.quantityChangePer30d != null ? (
          <AppText style={{ color: p.muted }}>
            {t("trend.changeQuantity", { delta: String(Math.round(Math.abs(trend.quantityChangePer30d) * 10) / 10), unit: timed === "time" ? letters.s : letters.m, n: Math.min(trend.points.length, 10) })}
          </AppText>
        ) : null}
        {(!timed || trend.quantityChangePer30d == null) && trend.loadChangePer30d !== null ? (
          <AppText style={{ color: p.muted }}>
            {t("trend.change", {
              delta: String(Math.round(kgToUnit(Math.abs(trend.loadChangePer30d), unit) * 10) / 10),
              unit: unitText,
              n: Math.min(trend.points.length, 10),
            })}
          </AppText>
        ) : null}
        {trend.latest ? <AppText>{t("trend.latest", { set: setText(trend.latest), date: localDateText(trend.latest.at) })}</AppText> : null}
        {trend.best ? <AppText>{t("trend.best", { set: setText(trend.best), date: localDateText(trend.best.at) })}</AppText> : null}
      </Card>
      {loads ? (
        <Card>
          <AppText style={{ fontWeight: "600" }}>{t("loads.title")}</AppText>
          <AppText>
            {loads.own
              ? t("loads.state.own", { what: loadsSummaryText(loads.own, unit, unitText, t as never) })
              : t("loads.state.default", { equipment: t(`equipment.${loads.equipment}` as never) })}
          </AppText>
          {!loads.own && loads.gym ? (
            <AppText style={{ color: p.muted }}>{loadsSummaryText(loads.gym, unit, unitText, t as never)}</AppText>
          ) : null}
          <AppText style={{ color: p.muted, fontSize: ty.caption }}>{t("loads.pickHint")}</AppText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            {TREND_LOAD_JUMPS_KG.map((kg) => (
              <Chip
                key={kg}
                label={t("loads.jump", { step: weightText(kg, unit), unit: unitText })}
                selected={matchingJumpKg(loads.own ?? loads.gym) === kg}
                onPress={() => loads.onPickJump(kg)}
              />
            ))}
          </View>
        </Card>
      ) : null}
      <Card>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          <Chip label={t("trend.metric.weight")} selected={metric === "weight"} onPress={() => setMetric("weight")} />
          {timed ? null : <Chip label={t("trend.metric.e1rm")} selected={metric === "e1rm"} onPress={() => setMetric("e1rm")} />}
          <Chip label={t("trend.metric.volume")} selected={metric === "volume"} onPress={() => setMetric("volume")} />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          <Chip label={t("trend.range.3m")} selected={range === "3m"} onPress={() => setRange("3m")} />
          <Chip label={t("trend.range.1y")} selected={range === "1y"} onPress={() => setRange("1y")} />
          <Chip label={t("trend.range.all")} selected={range === "all"} onPress={() => setRange("all")} />
        </View>
        {chartPoints.length === 0 ? <AppText>{t("trend.noPoints")}</AppText> : (
          <TrendChart
            points={chartPoints}
            assisted={metric === "weight" && assisted}
            summary={t("trend.chartLabel", { dir: t(directionKey(trend.direction, assisted)), n: chartPoints.length })}
            axisText={(from, to) => t("trend.axis", { from, to })}
          />
        )}
        {chartPoints.length > 0 ? <AppText style={{ color: p.muted, fontSize: ty.caption }}>{t("trend.chartHint")}</AppText> : null}
      </Card>
      {records.heaviest ? (
        <Card>
          <AppText style={{ fontWeight: "600" }}>{t("trend.pr.title")}</AppText>
          <AppText>{t("trend.pr.heaviest", { set: setText(records.heaviest), date: localDateText(records.heaviest.at) })}</AppText>
          {records.e1rm ? <AppText>{t("trend.pr.e1rm", { load: fmt(records.e1rm.e1rm), set: setText(records.e1rm.set) })}</AppText> : null}
          {records.setVol ? <AppText>{t("trend.pr.setVolume", { volume: String(Math.round(records.setVol.volume)), set: setText(records.setVol.set) })}</AppText> : null}
          {records.sessionVol ? <AppText>{t("trend.pr.sessionVolume", { volume: String(Math.round(records.sessionVol.volume)), date: localDateText(records.sessionVol.at) })}</AppText> : null}
        </Card>
      ) : null}
      {records.reps.length > 0 ? (
        <Card>
          <AppText style={{ fontWeight: "600" }}>{t("trend.repMaxes")}</AppText>
          {records.reps.map((row) => (
            <AppText key={row.reps}>
              {t("trend.repMax", { reps: row.reps, load: fmt(row.set.load) })}
            </AppText>
          ))}
        </Card>
      ) : null}
      <Card>
        <AppText style={{ fontWeight: "600" }}>{nextTarget ? t("trend.next", { target: nextTarget }) : t("trend.nextNone")}</AppText>
      </Card>
      {recent.length > 0 ? (
        <Card>
          <AppText style={{ fontWeight: "600" }}>{t("trend.recent")}</AppText>
          {recent.map((pt) => (
            <AppText key={pt.at} ltr style={{ textAlign: "left" /* a11y-ok: LTR figures stay left-aligned */ }}>
              {localDateText(pt.at)}  {setText(pt)}
              {pt.imported ? `  (${t("trend.imported")})` : ""}
            </AppText>
          ))}
        </Card>
      ) : null}
    </>
  );

  const historyList = (
    <SectionList
      style={{ flex: 1 }}
      sections={sections}
      keyExtractor={(item, index) => `${item.performedAt}-${index}`}
      ListEmptyComponent={<AppText>{t("trend.history.empty")}</AppText>}
      renderSectionHeader={({ section }) => (
        <AppText ltr style={{ fontWeight: "600", paddingTop: space.md }}>{section.date}</AppText>
      )}
      renderItem={({ item }) => {
        const at = sessionAt(item);
        return (
          <Card>
            {item.sets.map((s, i) => {
              const kinds = prKindsForSet({ heaviest: records.heaviest, bestSetVolume: records.setVol, repMaxes: records.reps }, at, i);
              return (
                <View key={`${at}-${i}`} style={{ gap: space.xs, paddingVertical: space.sm, borderTopWidth: i === 0 ? 0 : 1, borderColor: p.border }}>
                  <AppText ltr style={{ fontWeight: "600" }}>
                    {loggedText(s)}
                    {s.rir != null && !s.warmup ? `  ·  ${t("history.rir", { n: s.rir })}` : ""}
                  </AppText>
                  {s.warmup ? <AppText style={{ color: p.muted }}>{t("history.warmup")}</AppText> : null}
                  {!s.warmup && s.tags?.includes("drop") ? <AppText style={{ color: p.muted }}>{t("history.drop")}</AppText> : null}
                  {kinds.length > 0 ? (
                    <AppText style={{ color: p.muted, fontSize: ty.caption }}>{kinds.map(badgeLabel).join(" · ")}</AppText>
                  ) : null}
                </View>
              );
            })}
          </Card>
        );
      }}
    />
  );

  return (
    <Screen title={exerciseLabels(lift, lang).primary} scroll={tab === "summary"} footer={loadsButton} contentStyle={tab === "history" ? { flex: 1, paddingBottom: 0 } : undefined}>
      <AppText style={{ color: p.muted }}>{t("trend.setupLine", { setup: t(`setup.${lift.setup}` as never) })}</AppText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        <Chip label={t("trend.tab.summary")} selected={tab === "summary"} onPress={() => setTab("summary")} />
        <Chip label={t("trend.tab.history")} selected={tab === "history"} onPress={() => setTab("history")} />
      </View>
      {tab === "summary" ? summary : historyList}
    </Screen>
  );
}
