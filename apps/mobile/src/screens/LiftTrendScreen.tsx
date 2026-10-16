import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { Alert, View } from "react-native";
import { findSpec, renderReason, weekStartOf, type EquipmentType, type GymLoadSpec, type HistorySession, type LiftPin, type LiftTrend } from "@gain/engine";
import { useServices } from "../AppContext";
import type { LiftItem } from "../db/historyRepo";
import { specWithJump } from "../logic/exerciseLoads";
import { GYM_EQUIPMENT, parseNumber } from "../logic/gymInput";
import { PATTERNS } from "../logic/exposure";
import { hasConcreteTarget, shortReason, targetText } from "../logic/nextTarget";
import { describeDecision } from "../logic/why";
import { describePace } from "../logic/paceText";
import { kgToUnit, localizeReason, unitToKg } from "../logic/units";
import { exerciseLabels, isolateLtr } from "../i18n/format";
import type { StringKey } from "../i18n/strings";
import { useI18n } from "../i18n";
import { space, usePalette } from "../theme";
import { AppText, BigButton, Card, Chip, EmptyState, Field, InlineStatus, LoadingState } from "../ui";
import { LiftTrendView } from "./LiftTrendView";

/** One trend per lift: the top set of each workout, drawn as bars, with plain words for the direction. */
function towardPin(pin: LiftPin, latest: { load: number; reps: number } | undefined, assisted: boolean): number {
  if (!latest) return 0;
  const loadOk = assisted ? latest.load <= pin.load : latest.load >= pin.load;
  if (loadOk && latest.reps >= pin.reps) return 100;
  const loadRatio = pin.load <= 0 ? 1 : assisted ? Math.min(1, pin.load / Math.max(latest.load, 1e-6)) : Math.min(1, latest.load / pin.load);
  const repsRatio = pin.reps <= 0 ? 1 : Math.min(1, latest.reps / pin.reps);
  return Math.round(Math.min(loadRatio, repsRatio) * 100);
}

export function LiftTrendScreen() {
  const { history, repos, programmes, goals, finish, achievements, weekly } = useServices();
  const nav = useNavigation<{ navigate: (name: string, params?: object) => void }>();
  const lineId = (useRoute().params as { lineId: string }).lineId;
  const { t, lang, unit, unitText, fmt } = useI18n();
  const p = usePalette();
  const [data, setData] = useState<{ lift: LiftItem; trend: LiftTrend; sessions: HistorySession[] } | null | "none">(null);
  const [loads, setLoads] = useState<{ equipment: EquipmentType; own: GymLoadSpec | null; gym: GymLoadSpec | null } | null>(null);
  const [picking, setPicking] = useState(false);
  const [pace, setPace] = useState<{ headline: string; details: string[] } | null>(null);
  const [nextTarget, setNextTarget] = useState<string | null>(null);
  const [whySentence, setWhySentence] = useState<string | null>(null);
  const [setups, setSetups] = useState<{ lineId: string; label: string; selected: boolean }[]>([]);
  const [pin, setPinState] = useState<LiftPin | null>(null);
  const [pinLoad, setPinLoad] = useState("");
  const [pinReps, setPinReps] = useState("");
  const [pinWeeks, setPinWeeks] = useState<4 | 5 | 6>(4);
  const [custom, setCustom] = useState<{ id: string; nameEn: string; nameAr: string; pattern: string; equipment: EquipmentType } | null>(null);
  const [customSaved, setCustomSaved] = useState(false);
  const [rx, setRx] = useState<{ sets: number; repMin: number; repMax: number } | null>(null);
  const [rxSets, setRxSets] = useState("");
  const [rxMin, setRxMin] = useState("");
  const [rxMax, setRxMax] = useState("");
  const [rxSaved, setRxSaved] = useState(false);

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
          const [curPin, curRx, lib] = await Promise.all([achievements.getPin(r.lift.exerciseId), programmes.getExercisePrescription(r.lift.exerciseId), programmes.listExercises()]);
          setPinState(curPin);
          setPinLoad(curPin ? String(kgToUnit(curPin.load, unit)) : "");
          setPinReps(curPin ? String(curPin.reps) : "");
          setPinWeeks(curPin?.weeks === 5 || curPin?.weeks === 6 ? curPin.weeks : 4);
          const own = lib.find((e) => e.id === r.lift.exerciseId);
          setCustom(own?.isCustom ? { id: own.id, nameEn: own.nameEn, nameAr: own.nameAr, pattern: own.pattern, equipment: own.equipment } : null);
          setCustomSaved(false);
          setRx(curRx);
          setRxSets(curRx ? String(curRx.sets) : "");
          setRxMin(curRx ? String(curRx.repMin) : "");
          setRxMax(curRx ? String(curRx.repMax) : "");
          setRxSaved(false);
        })();
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
          let why: string | null = null;
          if (gymId && next) {
            const days = await repos.listDays(next.versionId);
            for (const d of days) {
              const planned = await finish.getPlannedSession(d.id);
              const tg = planned ? await finish.getTargetForExercise(planned.id, r.lift.exerciseId) : null;
              if (tg && hasConcreteTarget(tg)) {
                rec = targetText(tg, fmt, letters);
                const stored = await finish.getDecision(tg.id);
                if (stored) {
                  const sections = describeDecision(stored.payload, { ruleVersion: stored.ruleVersion, path: stored.path }, (k, params) => t(k as never, params), lang, unit);
                  why = sections[0]?.lines[0] ?? null;
                } else {
                  why = shortReason(renderReason(localizeReason(tg.reason, unit, lang), lang));
                }
                break;
              }
              const preview = (await finish.previewDayLoads(d.id, gymId)).find((p) => p.exerciseId === r.lift.exerciseId);
              if (preview && preview.proposal.currency !== "none" && preview.proposal.load != null) {
                rec = targetText({ exerciseId: r.lift.exerciseId, status: "proposed", currency: preview.proposal.currency, measure: r.lift.measure, reps: preview.proposal.reps, durationS: preview.proposal.durationS, distanceM: preview.proposal.distanceM, effectiveLoad: preview.proposal.load }, fmt, letters);
                why = shortReason(renderReason(localizeReason(preview.proposal.reason, unit, lang), lang));
                break;
              }
            }
          }
          setNextTarget(rec);
          setWhySentence(why);
        })();
      });
    }, [history, lineId, refreshLoads, goals, programmes, finish, repos, achievements, t, fmt, lang, unit]),
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

  const savePin = async () => {
    const load = parseNumber(pinLoad);
    const reps = parseNumber(pinReps);
    if (load === null || load <= 0 || reps === null || reps < 1) return;
    const tz = -new Date().getTimezoneOffset() * 60_000;
    const startsOn = await weekly.weekStartsOn();
    try {
      await achievements.setPin({
        exerciseId: data.lift.exerciseId,
        equipment: loads?.equipment,
        setup: data.lift.setup,
        load: unitToKg(load, unit),
        reps: Math.round(reps),
        weeks: pinWeeks,
        startedWeek: pin?.startedWeek ?? weekStartOf(Date.now() + tz, startsOn),
      });
      setPinState(await achievements.getPin(data.lift.exerciseId));
    } catch {
      Alert.alert(t("achv.pin.tooMany"));
    }
  };
  const clearPin = async () => {
    await achievements.clearPin(data.lift.exerciseId);
    setPinState(null);
    setPinLoad("");
    setPinReps("");
    setPinWeeks(4);
  };
  const saveCustom = async () => {
    if (!custom) return;
    if (custom.nameEn.trim() === "") return;
    await programmes.updateExercise(custom.id, { nameEn: custom.nameEn, nameAr: custom.nameAr, pattern: custom.pattern, equipment: custom.equipment });
    setCustomSaved(true);
    const r = await history.getLiftTrend(lineId);
    if (r) setData(r);
  };
  const saveRx = async () => {
    const sets = parseNumber(rxSets);
    const min = parseNumber(rxMin);
    const max = parseNumber(rxMax);
    if (sets === null || sets < 1 || min === null || min < 1 || max === null || max < min) return;
    await programmes.setExercisePrescription(data.lift.exerciseId, { sets: Math.round(sets), repMin: Math.round(min), repMax: Math.round(max) });
    setRx({ sets: Math.round(sets), repMin: Math.round(min), repMax: Math.round(max) });
    setRxSaved(true);
  };
  const pinPct = towardPin(pin ?? { exerciseId: data.lift.exerciseId, load: 0, reps: 0 }, data.trend.latest ?? undefined, data.lift.setup === "assisted");
  const pinTarget = pin ? `${fmt(pin.load)} ${isolateLtr(`× ${pin.reps}`)}` : "";

  return (
    <LiftTrendView
      lift={data.lift}
      trend={data.trend}
      sessions={data.sessions}
      onOpenLoads={() => nav.navigate("ExerciseLoads", { exerciseId: data.lift.exerciseId, gymId: data.lift.gymId, setup: data.lift.setup })}
      loads={loads ? { ...loads, onPickJump: (kg) => void onPickJump(kg) } : null}
      paceHeadline={pace?.headline}
      paceDetails={pace?.details}
      nextTarget={nextTarget}
      whySentence={whySentence}
      setups={setups}
      onPickSetup={(id) => nav.navigate("LiftTrend", { lineId: id })}
      extras={
        <>
          <Card>
            <AppText style={{ fontWeight: "600" }}>{t("achv.pin.title")}</AppText>
            {pin ? (
              <View
                accessible
                accessibilityRole="progressbar"
                accessibilityLabel={t("achv.pin.a11y", { pct: pinPct })}
                accessibilityValue={{ min: 0, max: 100, now: pinPct }}
              >
                <AppText>{t("achv.pin.progress", { done: pinPct, goal: 100, target: pinTarget })}</AppText>
                <View style={{ height: 8, borderRadius: 4, backgroundColor: p.border, overflow: "hidden" }}>
                  <View style={{ height: 8, width: `${pinPct}%`, backgroundColor: p.accent }} />
                </View>
              </View>
            ) : null}
            <Field label={`${t("achv.pin.load")} (${unitText})`} value={pinLoad} onChangeText={setPinLoad} numeric />
            <Field label={t("achv.pin.reps")} value={pinReps} onChangeText={setPinReps} numeric />
            <AppText style={{ fontWeight: "600" }}>{t("achv.pin.weeks")}</AppText>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
              {([4, 5, 6] as const).map((n) => (
                <Chip key={n} label={isolateLtr(String(n))} selected={pinWeeks === n} onPress={() => setPinWeeks(n)} />
              ))}
            </View>
            <BigButton variant="secondary" label={t("achv.pin.save")} onPress={() => void savePin()} />
            {pin ? <BigButton variant="quiet" label={t("achv.pin.clear")} onPress={() => void clearPin()} /> : null}
          </Card>
          {custom ? (
            <Card>
              <AppText style={{ fontWeight: "600" }}>{t("pick.edit")}</AppText>
              <Field label={t("pick.name")} value={custom.nameEn} onChangeText={(nameEn) => { setCustom({ ...custom, nameEn }); setCustomSaved(false); }} />
              <Field label={t("pick.nameAr")} value={custom.nameAr} onChangeText={(nameAr) => { setCustom({ ...custom, nameAr }); setCustomSaved(false); }} />
              <AppText style={{ fontWeight: "600" }}>{t("pick.pattern")}</AppText>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                {PATTERNS.map((x) => (
                  <Chip key={x} label={t(`pattern.${x}` as StringKey)} selected={custom.pattern === x} onPress={() => { setCustom({ ...custom, pattern: x }); setCustomSaved(false); }} />
                ))}
              </View>
              <AppText style={{ fontWeight: "600" }}>{t("pick.equipment")}</AppText>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                {GYM_EQUIPMENT.map((x) => (
                  <Chip key={x} label={t(`equipment.${x}` as StringKey)} selected={custom.equipment === x} onPress={() => { setCustom({ ...custom, equipment: x }); setCustomSaved(false); }} />
                ))}
              </View>
              {customSaved ? <InlineStatus kind="success" text={t("pick.editSaved")} /> : null}
              <BigButton variant="secondary" label={t("pick.saveEdit")} onPress={() => void saveCustom()} />
            </Card>
          ) : null}
          {rx ? (
            <Card>
              <AppText style={{ fontWeight: "600" }}>{t("ex.savePrescription")}</AppText>
              <Field label={t("ex.sets")} value={rxSets} onChangeText={(s) => { setRxSets(s); setRxSaved(false); }} numeric />
              <Field label={t("ex.repMin")} value={rxMin} onChangeText={(s) => { setRxMin(s); setRxSaved(false); }} numeric />
              <Field label={t("ex.repMax")} value={rxMax} onChangeText={(s) => { setRxMax(s); setRxSaved(false); }} numeric />
              {rxSaved ? <InlineStatus kind="success" text={t("ex.prescriptionSaved")} /> : null}
              <BigButton variant="secondary" label={t("ex.savePrescription")} onPress={() => void saveRx()} />
            </Card>
          ) : null}
        </>
      }
    />
  );
}
