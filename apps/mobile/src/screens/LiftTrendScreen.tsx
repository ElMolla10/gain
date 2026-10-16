import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { findSpec, type EquipmentType, type GymLoadSpec, type HistorySession, type LiftTrend } from "@gain/engine";
import { useServices } from "../AppContext";
import type { LiftItem } from "../db/historyRepo";
import { specWithJump } from "../logic/exerciseLoads";
import { hasConcreteTarget, targetText } from "../logic/nextTarget";
import { describePace } from "../logic/paceText";
import { exerciseLabels } from "../i18n/format";
import type { StringKey } from "../i18n/strings";
import { useI18n } from "../i18n";
import { EmptyState, LoadingState } from "../ui";
import { LiftTrendView } from "./LiftTrendView";

/** One trend per lift: the top set of each workout, drawn as bars, with plain words for the direction. */
export function LiftTrendScreen() {
  const { history, repos, programmes, goals, finish } = useServices();
  const nav = useNavigation<{ navigate: (name: string, params?: object) => void }>();
  const lineId = (useRoute().params as { lineId: string }).lineId;
  const { t, lang, fmt } = useI18n();
  const [data, setData] = useState<{ lift: LiftItem; trend: LiftTrend; sessions: HistorySession[] } | null | "none">(null);
  const [loads, setLoads] = useState<{ equipment: EquipmentType; own: GymLoadSpec | null; gym: GymLoadSpec | null } | null>(null);
  const [picking, setPicking] = useState(false);
  const [pace, setPace] = useState<{ headline: string; details: string[] } | null>(null);
  const [nextTarget, setNextTarget] = useState<string | null>(null);
  const [setups, setSetups] = useState<{ lineId: string; label: string; selected: boolean }[]>([]);

  const refreshLoads = useCallback(async (exerciseId: string) => {
    const cur = await repos.getExerciseLoads(exerciseId);
    if (!cur) return setLoads(null);
    const gymId = await repos.getActiveGymId();
    const gym = gymId ? findSpec(await repos.loadGymFingerprint(gymId), cur.equipment) : null;
    setLoads({ equipment: cur.equipment, own: cur.spec, gym });
  }, [repos]);

  useFocusEffect(
    useCallback(() => {
      history.getLiftTrend(lineId).then((r) => {
        if (!r) {
          setData("none");
          setLoads(null);
          return;
        }
        setData(r);
        void refreshLoads(r.lift.exerciseId);
        void (async () => {
          const letters = { s: t("qty.s"), m: t("qty.m") };
          const [paceResult, lifts, gymId, next] = await Promise.all([goals.getPace(Date.now()), history.listLifts(), repos.getActiveGymId(), repos.getNextDay()]);
          if (paceResult.kind === "lift" && paceResult.goal.exerciseId === r.lift.exerciseId) {
            const lib = await programmes.listExercises();
            const ex = lib.find((e) => e.id === r.lift.exerciseId);
            const text = describePace(paceResult, { t, fmt, exerciseName: ex ? exerciseLabels(ex, lang).primary : exerciseLabels(r.lift, lang).primary, muscleName: (m) => t(`muscle.${m}` as StringKey) });
            setPace({ headline: text.headline, details: text.details });
          } else setPace(null);
          setSetups(lifts.filter((l) => l.exerciseId === r.lift.exerciseId).map((l) => ({
            lineId: l.lineId,
            label: `${l.gymName} · ${t(`setup.${l.setup}` as never)}`,
            selected: l.lineId === lineId,
          })));
          let rec: string | null = null;
          if (gymId && next) {
            const days = await repos.listDays(next.versionId);
            for (const d of days) {
              const planned = await finish.getPlannedSession(d.id);
              const tg = planned ? await finish.getTargetForExercise(planned.id, r.lift.exerciseId) : null;
              if (tg && hasConcreteTarget(tg)) {
                rec = targetText(tg, fmt, letters);
                break;
              }
              const preview = (await finish.previewDayLoads(d.id, gymId)).find((p) => p.exerciseId === r.lift.exerciseId);
              if (preview && preview.proposal.currency !== "none" && preview.proposal.load != null) {
                rec = targetText({ exerciseId: r.lift.exerciseId, status: "proposed", currency: preview.proposal.currency, measure: r.lift.measure, reps: preview.proposal.reps, durationS: preview.proposal.durationS, distanceM: preview.proposal.distanceM, effectiveLoad: preview.proposal.load }, fmt, letters);
                break;
              }
            }
          }
          setNextTarget(rec);
        })();
      });
    }, [history, lineId, refreshLoads, goals, programmes, finish, repos, t, fmt, lang]),
  );

  if (data === null) return <LoadingState />;
  if (data === "none") return <EmptyState icon="progress" title={t("trend.noPoints")} />;

  const onPickJump = async (kg: number) => {
    if (!loads || picking) return;
    setPicking(true);
    try {
      await programmes.setExerciseLoads(data.lift.exerciseId, specWithJump(loads.equipment, kg, loads.own, loads.gym));
      await refreshLoads(data.lift.exerciseId);
    } finally {
      setPicking(false);
    }
  };

  return (
    <LiftTrendView
      lift={data.lift}
      trend={data.trend}
      sessions={data.sessions}
      onOpenLoads={() => nav.navigate("ExerciseLoads", { exerciseId: data.lift.exerciseId })}
      loads={loads ? { ...loads, onPickJump: (kg) => void onPickJump(kg) } : null}
      paceHeadline={pace?.headline}
      paceDetails={pace?.details}
      nextTarget={nextTarget}
      setups={setups}
      onPickSetup={(id) => nav.navigate("LiftTrend", { lineId: id })}
    />
  );
}
