import { useFocusEffect, useNavigation } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { Icon } from "../components/Icon";
import { useServices } from "../AppContext";
import type { LibraryExercise } from "../db/programmeRepo";
import { useI18n } from "../i18n";
import { exerciseLabels } from "../i18n/format";
import type { ProgrammeDraft } from "../logic/programmeDraft";
import { MIN_TOUCH, space, type as ty, usePalette } from "../theme";
import { AppText, ArDraftNote, BigButton, Card, EmptyState, ListRow, LoadingState, Screen, SectionTitle } from "../ui";
import { ceilingForName } from "../logic/ceilings";
import { effectiveRange, rangeText } from "../logic/repRange";
import type { RepCeilings } from "@gain/engine";

type Nav = { navigate: (name: "ProgrammeEdit" | "ProgrammeSwitch" | "ProgrammeExposure" | "ProgrammeVersions", params?: { versionId?: string; programmeId?: string }) => void };

interface Data {
  programmeId: string;
  name: string;
  version: number;
  isSample: boolean;
  draft: ProgrammeDraft;
  library: Map<string, LibraryExercise>;
  ceilings: RepCeilings;
}

export function ProgrammeScreen() {
  const { programmes, repos } = useServices();
  const { t, lang } = useI18n();
  const p = usePalette();
  const nav = useNavigation<Nav>();
  const [data, setData] = useState<Data | null | undefined>(undefined);
  const [open, setOpen] = useState<number | null>(0);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const a = await programmes.getActive();
        if (!a) return alive && setData(null);
        const [draft, lib] = await Promise.all([programmes.loadDraft(a.versionId), programmes.listExercises()]);
        const ceilings = await repos.getRepCeilingDefaults();
        if (alive) setData({ ceilings, programmeId: a.programmeId, name: a.programmeName, version: a.version, isSample: a.isSample, draft, library: new Map(lib.map((e) => [e.id, e])) });
      })().catch(() => alive && setData(null));
      return () => {
        alive = false;
      };
    }, [programmes, repos]),
  );

  if (data === undefined) return <LoadingState />;
  if (data === null)
    return (
      <Screen tab title={t("prog.title")}>
        <EmptyState icon="plan" title={t("prog.none")} actionLabel={t("prog.switch.entry")} onAction={() => nav.navigate("ProgrammeSwitch")} />
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
      </View>
      <BigButton icon="edit" label={t("prog.edit")} onPress={() => nav.navigate("ProgrammeEdit", { programmeId: data.programmeId })} />

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
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                onPress={() => setOpen(expanded ? null : i)}
                style={{ minHeight: MIN_TOUCH, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm }}
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
              {expanded
                ? day.exercises.map((e, k) => {
                    const ex = data.library.get(e.exerciseId);
                    // Counted in reps: show the range that is really used, and say so when the rep ceiling replaces the top of the programme's range.
                    const range = ex && ex.measure === "reps" ? effectiveRange({ programmeMin: e.repMin, programmeMax: e.repMax, ceiling: e.repCeiling ?? ceilingForName(ex.nameEn, data.ceilings), source: e.repCeiling !== null ? "lift" : "default" }) : null;
                    const l = ex ? exerciseLabels(ex, lang) : null;
                    return (
                      <View key={e.exerciseId} style={{ minHeight: MIN_TOUCH, justifyContent: "center", borderTopWidth: k === 0 ? 1 : 0, borderColor: p.border, paddingTop: k === 0 ? space.sm : 0 }}>
                        <AppText style={{ fontWeight: "600" }}>
                          {l ? l.primary : e.exerciseId}
                          {e.isGoalLift ? ` · ${t("today.goalTag")}` : ""}
                        </AppText>
                        <AppText ltr style={{ color: p.muted, fontSize: ty.label }}>
                          {range ? `${e.sets} × ${rangeText(range, (key, params) => t(key, params))}` : `${e.sets} ×`}
                          {l && l.secondary ? ` · ${l.secondary}` : ""}
                        </AppText>
                      </View>
                    );
                  })
                : null}
            </Card>
          );
        })}
      </View>

      {/* Secondary: exposure, version history and programme management sit below the days. */}
      <View style={{ gap: space.sm }}>
        <SectionTitle>{t("prog.more")}</SectionTitle>
        <Card style={{ paddingVertical: space.xs }}>
          <ListRow title={t("prog.exposure.title")} onPress={() => nav.navigate("ProgrammeExposure")} />
          <ListRow title={t("prog.versions")} onPress={() => nav.navigate("ProgrammeVersions")} />
          <ListRow title={t("prog.switch.entry")} onPress={() => nav.navigate("ProgrammeSwitch")} />
          <ListRow title={t("prog.new")} last onPress={() => nav.navigate("ProgrammeEdit")} />
        </Card>
      </View>
      <ArDraftNote />
    </Screen>
  );
}
