import React, { useMemo } from "react";
import { View } from "react-native";
import { barbellPlates } from "@gain/engine";
import { useI18n } from "../../i18n";
import { formatDay } from "../../logic/dateText";
import { isolateLtr } from "../../i18n/format";
import { isTimed } from "../../logic/quantity";
import type { Unit } from "../../logic/units";
import { radius, space, type as ty, usePalette } from "../../theme";
import { AppText } from "../../ui";
import { BarArt } from "../today/BarArt";
import type { SessionDetail } from "../../db/historyRepo";
import type { SessionSummary } from "../../db/finishRepo";

export interface SessionPostMortemHeroProps {
  detail: SessionDetail;
  summary: SessionSummary | null;
  unit: Unit;
}

/**
 * 10x Session Post-Mortem Hero:
 * Visualizes the total real tonnage moved, honesty of work sets vs warmups,
 * personal records achieved, the session's apex lift loaded on an Olympic barbell,
 * and a volume distribution rail across exercises.
 */
interface SessionPostMortemMetrics {
  totalTonnage: number;
  workSets: number;
  warmups: number;
  apexSet: { load: number; reps: number; exerciseName: string } | null;
  durationMin: number | null;
  prsCount: number;
  distribution: { name: string; kg: number; percent: number }[];
}

export function SessionPostMortemHero({ detail, summary, unit }: SessionPostMortemHeroProps) {
  const { t, lang, unitText } = useI18n();
  const p = usePalette();

  const metrics = useMemo<SessionPostMortemMetrics>(() => {
    let totalKg = 0;
    let workSets = 0;
    let warmups = 0;
    let apexSet: { load: number; reps: number; exerciseName: string } | null = null;
    const distribution: { name: string; kg: number; percent: number }[] = [];

    for (const ex of detail.exercises) {
      let exKg = 0;
      for (const s of ex.sets) {
        if (s.warmup) {
          warmups++;
        } else {
          workSets++;
          const reps = isTimed(ex.measure) ? 1 : s.reps;
          const setTonnage = s.load * reps;
          exKg += setTonnage;
          totalKg += setTonnage;

          if (!apexSet || s.load > apexSet.load) {
            apexSet = {
              load: s.load,
              reps: s.reps,
              exerciseName: lang === "ar" ? ex.nameAr || ex.nameEn : ex.nameEn,
            };
          }
        }
      }
      distribution.push({
        name: lang === "ar" ? ex.nameAr || ex.nameEn : ex.nameEn,
        kg: exKg,
        percent: 0,
      });
    }

    if (totalKg > 0) {
      for (const d of distribution) {
        d.percent = Math.round((d.kg / totalKg) * 100);
      }
    }

    distribution.sort((a, b) => b.kg - a.kg);

    const totalTonnage = Math.round(unit === "lb" ? totalKg * 2.20462 : totalKg);
    const durationMin =
      detail.startedAt && detail.finishedAt > detail.startedAt
        ? Math.max(1, Math.round((detail.finishedAt - detail.startedAt - detail.pausedMs) / 60000))
        : null;

    const prsCount = summary?.totals.records ?? 0;

    return {
      totalTonnage,
      workSets,
      warmups,
      apexSet,
      durationMin,
      prsCount,
      distribution: distribution.filter((d) => d.percent > 0),
    };
  }, [detail, summary, unit, lang]);

  const standardSpec = {
    equipment: "barbell" as const,
    increment: unit === "lb" ? 5 : 2.5,
    min: unit === "lb" ? 45 : 20,
    max: unit === "lb" ? 600 : 300,
    plates: unit === "lb" ? [45, 35, 25, 10, 5, 2.5] : [25, 20, 15, 10, 5, 2.5, 1.25],
  };

  const apexPlates =
    metrics.apexSet && metrics.apexSet.load >= (standardSpec.min ?? 20)
      ? barbellPlates(standardSpec, metrics.apexSet.load)?.perSide ?? []
      : [];

  return (
    <View
      style={{
        backgroundColor: p.card,
        borderRadius: radius.card,
        borderWidth: 1,
        borderColor: p.border,
        padding: space.md,
        gap: space.md,
      }}
    >
      {/* Session Title Header */}
      <View style={{ gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
            <AppText style={{ fontSize: 16 }}>🏛️</AppText>
            <AppText
              style={{
                fontSize: ty.caption,
                fontWeight: "600",
                color: p.muted,
                letterSpacing: 0.5,
                textTransform: "uppercase",
              }}
            >
              {t("history.postmortem.title")}
            </AppText>
          </View>
          {metrics.durationMin ? (
            <View
              style={{
                paddingHorizontal: space.sm,
                paddingVertical: 2,
                borderRadius: radius.pill,
                backgroundColor: p.raised,
              }}
            >
              <AppText style={{ fontSize: ty.caption, color: p.muted }}>
                ⏱️ {t("history.postmortem.duration", { min: isolateLtr(String(metrics.durationMin)) })}
              </AppText>
            </View>
          ) : null}
        </View>

        <AppText style={{ fontSize: ty.title, fontWeight: "700", color: p.text }}>
          {detail.dayName}
        </AppText>
        <AppText style={{ fontSize: ty.caption, color: p.muted }}>
          {detail.gymName} · {formatDay(detail.finishedAt, lang)}
        </AppText>
      </View>

      {/* Primary Tonnage & Output Grid */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "stretch",
          backgroundColor: p.raised,
          borderRadius: radius.button,
          padding: space.sm,
          gap: space.sm,
        }}
      >
        {/* Tonnage moved */}
        <View style={{ flex: 1.2, gap: 2 }}>
          <AppText style={{ fontSize: 13, fontWeight: "600", color: p.muted, textTransform: "uppercase" }}>
            {t("history.postmortem.tonnage")}
          </AppText>
          <AppText style={{ fontSize: ty.section, fontWeight: "800", color: p.text }}>
            {isolateLtr(`${metrics.totalTonnage.toLocaleString()}`)}
          </AppText>
          <AppText style={{ fontSize: 13, color: p.muted }}>{unitText.toUpperCase()}</AppText>
        </View>

        {/* Work Sets */}
        <View style={{ flex: 1, gap: 2, borderStartWidth: 1, borderColor: p.border, paddingStart: space.sm }}>
          <AppText style={{ fontSize: 13, fontWeight: "600", color: p.muted, textTransform: "uppercase" }}>
            {t("history.postmortem.workSets")}
          </AppText>
          <AppText style={{ fontSize: ty.section, fontWeight: "800", color: p.accent }}>
            {isolateLtr(String(metrics.workSets))}
          </AppText>
          <AppText style={{ fontSize: 13, color: p.muted }}>
            {t("history.postmortem.warmups", { n: isolateLtr(String(metrics.warmups)) })}
          </AppText>
        </View>

        {/* PRs */}
        <View style={{ flex: 1, gap: 2, borderStartWidth: 1, borderColor: p.border, paddingStart: space.sm }}>
          <AppText style={{ fontSize: 13, fontWeight: "600", color: p.muted, textTransform: "uppercase" }}>
            {t("history.postmortem.prs")}
          </AppText>
          <AppText style={{ fontSize: ty.section, fontWeight: "800", color: metrics.prsCount > 0 ? p.accent : p.text }}>
            ⭐ {isolateLtr(String(metrics.prsCount))}
          </AppText>
          <AppText style={{ fontSize: 13, color: p.muted }}>
            {metrics.prsCount > 0 ? t("tab.history") : "—"}
          </AppText>
        </View>
      </View>

      {/* Apex Lift of the Session */}
      {metrics.apexSet ? (
        <View
          style={{
            backgroundColor: p.raised,
            borderRadius: radius.button,
            padding: space.sm,
            gap: space.xs,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <AppText style={{ fontSize: 13, fontWeight: "700", color: p.accent, letterSpacing: 0.5, textTransform: "uppercase" }}>
              {t("history.postmortem.apexLift")}
            </AppText>
            <AppText style={{ fontSize: ty.caption, fontWeight: "600", color: p.text }}>
              {metrics.apexSet.exerciseName}
            </AppText>
          </View>

          <AppText style={{ fontSize: ty.body, fontWeight: "700", color: p.text }}>
            {isolateLtr(`${metrics.apexSet.load} ${unitText} × ${metrics.apexSet.reps}`)}
          </AppText>

          {apexPlates.length > 0 ? (
            <View style={{ marginTop: 2 }}>
              <BarArt perSide={apexPlates} unit={unit} height={52} />
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Tonnage Distribution Rail */}
      {metrics.distribution.length > 1 ? (
        <View style={{ gap: space.xs }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <AppText style={{ fontSize: 13, fontWeight: "600", color: p.muted, letterSpacing: 0.4, textTransform: "uppercase" }}>
              {t("history.postmortem.tonnageDist")}
            </AppText>
          </View>

          {/* Segmented Track */}
          <View style={{ flexDirection: "row", height: 8, borderRadius: 4, overflow: "hidden", gap: 2 }}>
            {metrics.distribution.slice(0, 4).map((d, idx) => {
              const bg = idx === 0 ? p.accent : idx === 1 ? p.tint : idx === 2 ? p.border : p.raised;
              return (
                <View
                  key={d.name}
                  style={{
                    flex: Math.max(1, d.percent),
                    backgroundColor: bg,
                    borderRadius: 2,
                  }}
                />
              );
            })}
          </View>

          {/* Distribution Legend */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            {metrics.distribution.slice(0, 3).map((d, idx) => (
              <AppText key={d.name} style={{ fontSize: 13, color: p.muted }}>
                {idx === 0 ? "■" : idx === 1 ? "▨" : "▢"} {d.name} ({isolateLtr(`${d.percent}%`)})
              </AppText>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
