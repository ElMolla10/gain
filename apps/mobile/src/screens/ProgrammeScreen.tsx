import { useFocusEffect, useNavigation } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useServices } from "../AppContext";
import type { LibraryExercise } from "../db/programmeRepo";
import { useI18n } from "../i18n";
import { exerciseLabels } from "../i18n/format";
import type { ProgrammeDraft } from "../logic/programmeDraft";
import { MIN_TOUCH, space, type as ty, usePalette } from "../theme";
import { AppText, ArDraftNote, BigButton, Card } from "../ui";
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

  if (data === undefined) return <AppText style={{ padding: space.lg }}>{t("common.loading")}</AppText>;
  if (data === null)
    return (
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md }}>
        <AppText>{t("prog.none")}</AppText>
        <BigButton label={t("prog.switch.entry")} onPress={() => nav.navigate("ProgrammeSwitch")} />
        <BigButton label={t("prog.new")} selected={false} onPress={() => nav.navigate("ProgrammeEdit")} />
      </ScrollView>
    );

  const linkRow = (label: string, onPress: () => void) => (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ minHeight: MIN_TOUCH, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: p.edge }}>
      <AppText style={{ fontSize: ty.body }}>{label}</AppText>
      <AppText style={{ color: p.muted, fontSize: ty.body }}>›</AppText>
    </Pressable>
  );

  return (
    <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space.xl * 2 }}>
      <View style={{ gap: space.xs }}>
        <AppText accessibilityRole="header" style={{ fontSize: ty.title, fontWeight: "800" }}>{data.name}</AppText>
        <AppText style={{ color: p.muted, fontSize: ty.secondary }}>
          {t("prog.version", { v: data.version })}
          {data.isSample ? ` · ${t("prog.sampleTag")}` : ""}
        </AppText>
      </View>
      {data.draft.days.map((day, i) => {
        const expanded = open === i;
        const sets = day.exercises.reduce((n, e) => n + e.sets, 0);
        return (
          <Card key={i} style={{ gap: space.sm }}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              onPress={() => setOpen(expanded ? null : i)}
              style={{ minHeight: MIN_TOUCH, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm }}
            >
              <AppText style={{ fontSize: ty.section, fontWeight: "700", flex: 1 }}>{t("prog.dayCard", { day: day.name, n: day.exercises.length, sets })}</AppText>
              <AppText style={{ color: p.muted, fontSize: ty.section }}>{expanded ? "▾" : "▸"}</AppText>
            </Pressable>
            {expanded
              ? day.exercises.map((e) => {
                  const ex = data.library.get(e.exerciseId);
                  // Counted in reps: show the range that is really used, and say so when the rep ceiling replaces the top of the programme's range.
                  const range = ex && ex.measure === "reps" ? effectiveRange({ programmeMin: e.repMin, programmeMax: e.repMax, ceiling: e.repCeiling ?? ceilingForName(ex.nameEn, data.ceilings), source: e.repCeiling !== null ? "lift" : "default" }) : null;
                  const l = ex ? exerciseLabels(ex, lang) : null;
                  return (
                    <View key={e.exerciseId} style={{ minHeight: MIN_TOUCH, justifyContent: "center" }}>
                      <AppText style={{ fontSize: ty.body }}>
                        {l ? l.primary : e.exerciseId}
                        {e.isGoalLift ? ` · ${t("today.goalTag")}` : ""}
                      </AppText>
                      <AppText style={{ color: p.muted, fontSize: ty.secondary }}>
                        {range ? `${e.sets} × ${rangeText(range, (k, params) => t(k, params))}` : `${e.sets} ×`}
                        {l && l.secondary ? ` · ${l.secondary}` : ""}
                      </AppText>
                    </View>
                  );
                })
              : null}
          </Card>
        );
      })}
      <BigButton label={t("prog.edit")} onPress={() => nav.navigate("ProgrammeEdit", { programmeId: data.programmeId })} />
      <View>
        {linkRow(t("prog.exposure.title"), () => nav.navigate("ProgrammeExposure"))}
        {linkRow(t("prog.versions"), () => nav.navigate("ProgrammeVersions"))}
        {linkRow(t("prog.switch.entry"), () => nav.navigate("ProgrammeSwitch"))}
        {linkRow(t("prog.new"), () => nav.navigate("ProgrammeEdit"))}
      </View>
      <ArDraftNote />
    </ScrollView>
  );
}
