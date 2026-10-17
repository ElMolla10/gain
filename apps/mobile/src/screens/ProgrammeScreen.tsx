import { useFocusEffect, useNavigation } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { Icon } from "../components/Icon";
import { useServices } from "../AppContext";
import type { LibraryExercise } from "../db/programmeRepo";
import { useI18n } from "../i18n";
import { exerciseLabels, isolateLtr, NBSP } from "../i18n/format";
import type { ProgrammeDraft } from "../logic/programmeDraft";
import { MIN_TOUCH, space, type as ty, usePalette } from "../theme";
import { AppText, ArDraftNote, BigButton, Card, EmptyState, ListRow, LoadingState, QuietAction, Screen, SectionTitle, Sheet } from "../ui";
import { SchemePips } from "../components/SchemePips";
import { EN_DASH } from "../logic/bidiText";
import { ceilingForName } from "../logic/ceilings";
import { effectiveRange, rangeText, sourceOfBasis } from "../logic/repRange";
import { resolveRepTop } from "@gain/engine";
import type { RepCeilings } from "@gain/engine";

type Nav = { navigate: (name: "ProgrammeEdit" | "ProgrammeSwitch" | "ProgrammeExposure" | "ProgrammeVersions" | "ProgrammeShare" | "ProgramGenerate" | "MusclePriority", params?: { versionId?: string; programmeId?: string; settingsDay?: number; reorderWorkouts?: boolean }) => void };

interface Data {
  programmeId: string;
  name: string;
  version: number;
  isSample: boolean;
  draft: ProgrammeDraft;
  library: Map<string, LibraryExercise>;
  ceilings: RepCeilings;
  useGain: boolean;
}

export function ProgrammeScreen() {
  const { programmes, repos } = useServices();
  const { t, lang } = useI18n();
  const p = usePalette();
  const nav = useNavigation<Nav>();
  const [data, setData] = useState<Data | null | undefined>(undefined);
  const [open, setOpen] = useState<number | null>(0);
  const [ruleOpen, setRuleOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const a = await programmes.getActive();
        if (!a) return alive && setData(null);
        const [draft, lib] = await Promise.all([programmes.loadDraft(a.versionId), programmes.listExercises()]);
        const ceilings = await repos.getRepCeilingDefaults();
        const useGain = await repos.getUseGainCeilings();
        if (alive) setData({ ceilings, useGain, programmeId: a.programmeId, name: a.programmeName, version: a.version, isSample: a.isSample, draft, library: new Map(lib.map((e) => [e.id, e])) });
      })().catch(() => alive && setData(null));
      return () => {
        alive = false;
      };
    }, [programmes, repos]),
  );

  if (data === undefined) return <LoadingState />;
  const rangeOf = (e: ProgrammeDraft["days"][number]["exercises"][number]) => {
    const ex = data?.library.get(e.exerciseId);
    if (!data || !ex || ex.measure !== "reps") return null;
    const top = resolveRepTop({ programMax: e.repMax, liftCeiling: e.repCeiling, gainCeiling: ceilingForName(ex.nameEn, data.ceilings), useGainCeilings: data.useGain });
    return effectiveRange({ programmeMin: e.repMin, programmeMax: e.repMax, ceiling: top.top, source: sourceOfBasis(top.basis) });
  };
  // Exercises whose rep ceiling replaces the program's top: their full sentence lives in the "?" sheet, once each.
  const overrides = (data?.draft.days ?? []).flatMap((day, di) => day.exercises.map((e) => ({ e, di }))).flatMap(({ e, di }) => {
    const r = rangeOf(e);
    const ex = data?.library.get(e.exerciseId);
    return r && r.overridesProgramme && ex ? [{ key: `${di}-${e.exerciseId}`, name: exerciseLabels(ex, lang).primary, text: rangeText(r, (key, params) => t(key, params)) }] : [];
  });
  if (data === null)
    return (
      <Screen tab title={t("prog.title")}>
        <EmptyState icon="plan" title={t("prog.none")} actionLabel={t("prog.switch.entry")} onAction={() => nav.navigate("ProgrammeSwitch")} />
        <BigButton label={t("coach.build")} onPress={() => nav.navigate("ProgramGenerate")} />
        <BigButton variant="secondary" label={t("prog.new")} onPress={() => nav.navigate("ProgrammeEdit")} />
      </Screen>
    );

  return (
    <Screen tab>
      <View style={{ gap: space.xs }}>
        <AppText accessibilityRole="header" style={{ fontSize: ty.title, fontWeight: "600" }}>{data.name}</AppText>
        <AppText style={{ color: p.muted, fontSize: ty.label }}>
          {t("prog.version", { v: data.version })}
          {data.isSample ? ` · ${t("prog.sampleTag")}` : ""}
        </AppText>
        {/* The progression rule, once per screen (P-2); per-exercise overrides behind "?". */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <AppText style={{ color: p.muted, fontSize: ty.label, flex: 1 }}>{t("prog.ruleNote")}</AppText>
          {overrides.length > 0 ? <QuietAction label="?" accessibilityLabel={t("prog.ruleMore")} expanded={ruleOpen} onPress={() => setRuleOpen(true)} /> : null}
        </View>
      </View>
      {/* Secondary, not lime: Start on Today is the only primary action (P-6). Reorder lives in the editor. */}
      <BigButton variant="secondary" icon="edit" label={t("prog.edit")} onPress={() => nav.navigate("ProgrammeEdit", { programmeId: data.programmeId })} />
      <View style={{ gap: space.md }}>
        {data.draft.days.map((day, i) => {
          const expanded = open === i;
          const sets = day.exercises.reduce((n, e) => n + e.sets, 0);
          const names = day.exercises.map((e) => {
            const ex = data.library.get(e.exerciseId);
            return ex ? exerciseLabels(ex, lang).primary : e.exerciseId;
          });
          const preview = names.length > 3 ? `${names.slice(0, 3).join(" · ")} · +${names.length - 3}` : names.join(" · ");
          return (
            <Card key={i} style={{ gap: space.sm, paddingVertical: space.md }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  onPress={() => setOpen(expanded ? null : i)}
                  style={{ flex: 1, minHeight: MIN_TOUCH, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm }}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText style={{ fontSize: ty.section, fontWeight: "600" }}>{day.name}</AppText>
                    <AppText style={{ color: p.muted, fontSize: ty.label }}>{t("prog.dayMeta", { n: day.exercises.length, sets })}</AppText>
                    {expanded ? null : <AppText style={{ color: p.muted, fontSize: ty.label }}>{preview}</AppText>}
                  </View>
                  <View style={{ transform: [{ rotate: expanded ? "-90deg" : "90deg" }] }}>
                    <Icon name="chevron" color={p.muted} size={22} />
                  </View>
                </Pressable>
              </View>
              {expanded
                ? day.exercises.map((e, k) => {
                    const ex = data.library.get(e.exerciseId);
                    // Counted in reps: show the range that is really used, and say so when the rep ceiling replaces the top of the program's range.
                    const range = rangeOf(e);
                    const l = ex ? exerciseLabels(ex, lang) : null;
                    return (
                      // Two lines (P-2): the name, then the scheme as one isolated run "3 × 6–10" with the pips and badges.
                      <View key={e.exerciseId} style={{ minHeight: MIN_TOUCH, justifyContent: "center", gap: 2, borderTopWidth: k === 0 ? 1 : 0, borderColor: p.border, paddingTop: k === 0 ? space.sm : 0 }}>
                        <AppText style={{ fontWeight: "600" }}>
                          {l ? l.primary : e.exerciseId}
                          {e.isGoalLift ? ` · ${t("today.goalTag")}` : ""}
                        </AppText>
                        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", columnGap: space.sm, rowGap: space.xs }}>
                          <AppText style={{ color: p.muted, fontSize: ty.label, fontVariant: ["tabular-nums"] }}>
                            {range ? isolateLtr(`${e.sets}${NBSP}×${NBSP}${range.min}${EN_DASH}${range.max}`) : isolateLtr(`${e.sets}${NBSP}×`)}
                            {l && l.secondary ? ` · ${l.secondary}` : ""}
                          </AppText>
                          {range && e.topSets ? <SchemePips sets={e.sets} topSets={e.topSets} size={12} caption={false} /> : null}
                          {range?.overridesProgramme ? (
                            <View accessible accessibilityLabel={t("prog.ceilingUp", { n: range.max })} style={{ minHeight: 24, paddingHorizontal: space.sm, borderRadius: 12, backgroundColor: p.tint, justifyContent: "center" }}>
                              <AppText style={{ color: p.accent, fontSize: ty.label, fontWeight: "600" }}>{isolateLtr(`↑ ${range.max}`)}</AppText>
                            </View>
                          ) : null}
                        </View>
                      </View>
                    );
                  })
                : null}
              {/* Day settings inside the open card, as a row with a label (P-7); no gear beside the chevron. */}
              {expanded ? <ListRow title={t("prog.workoutSettings")} accessibilityLabel={t("prog.workout.settings", { workout: day.name })} accessibilityHint={t("prog.workoutSettingsHint")} last onPress={() => nav.navigate("ProgrammeEdit", { programmeId: data.programmeId, settingsDay: i })} /> : null}
            </Card>
          );
        })}
      </View>

      {/* Secondary: exposure, version history and program management sit below the days. */}
      <View style={{ gap: space.sm }}>
        <SectionTitle>{t("prog.more")}</SectionTitle>
        <Card style={{ paddingVertical: space.xs }}>
          <ListRow title={t("prog.exposure.title")} onPress={() => nav.navigate("ProgrammeExposure")} />
          <ListRow title={t("prog.versions")} onPress={() => nav.navigate("ProgrammeVersions")} />
          <ListRow title={t("prog.switch.entry")} onPress={() => nav.navigate("ProgrammeSwitch")} />
          <ListRow title={t("prog.share.entry")} onPress={() => nav.navigate("ProgrammeShare")} />
          <ListRow title={t("coach.build")} onPress={() => nav.navigate("ProgramGenerate")} />
          <ListRow title={t("coach.priority.entry")} onPress={() => nav.navigate("MusclePriority")} />
          <ListRow title={t("prog.new")} last onPress={() => nav.navigate("ProgrammeEdit")} />
        </Card>
      </View>
      <ArDraftNote />
      <Sheet visible={ruleOpen} title={t("prog.ruleSheetTitle")} onClose={() => setRuleOpen(false)}>
        <View style={{ gap: space.md }}>
          {overrides.map((o) => (
            <View key={o.key} style={{ gap: 2 }}>
              <AppText style={{ fontWeight: "600" }}>{o.name}</AppText>
              <AppText>{o.text}</AppText>
            </View>
          ))}
        </View>
      </Sheet>
    </Screen>
  );
}
