import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import React, { useCallback, useLayoutEffect, useState } from "react";
import { Alert, View } from "react-native";
import { findSpec, renderReason, weekStartOf, type EquipmentType, type GymLoadSpec, type HistorySession, type LiftPin, type LiftTrend } from "@gain/engine";
import { useServices } from "../AppContext";
import { diagnostics } from "../diagnostics";
import type { LiftItem } from "../db/historyRepo";
import { loadsSummaryText, matchingJumpKg, specWithJump, TREND_LOAD_JUMPS_KG } from "../logic/exerciseLoads";
import { GYM_EQUIPMENT, parseNumber } from "../logic/gymInput";
import { PATTERNS } from "../logic/exposure";
import { hasConcreteTarget, shortReason, targetText } from "../logic/nextTarget";
import { describeDecision } from "../logic/why";
import { kgToUnit, localizeReason, unitToKg, weightText } from "../logic/units";
import { goalSettingKey } from "../logic/progressionSummary";
import { exerciseLabels, isolateLtr } from "../i18n/format";
import type { StringKey } from "../i18n/strings";
import { useI18n } from "../i18n";
import { space, type as ty, usePalette } from "../theme";
import { AppText, BigButton, Chip, EmptyState, Field, IconButton, InlineStatus, ListRow, LoadingState, Sheet } from "../ui";
import { LiftTrendView, type PrSetRef } from "./LiftTrendView";
import { verifiedPrs } from "../logic/achievementShowcase";

/** Share of a pinned target reached by the latest top set (0–100). */
function towardPin(pin: LiftPin, latest: { load: number; reps: number } | undefined, assisted: boolean): number {
  if (!latest) return 0;
  const loadOk = assisted ? latest.load <= pin.load : latest.load >= pin.load;
  if (loadOk && latest.reps >= pin.reps) return 100;
  const loadRatio = pin.load <= 0 ? 1 : assisted ? Math.min(1, pin.load / Math.max(latest.load, 1e-6)) : Math.min(1, latest.load / pin.load);
  const repsRatio = pin.reps <= 0 ? 1 : Math.min(1, latest.reps / pin.reps);
  return Math.round(Math.min(loadRatio, repsRatio) * 100);
}

type SheetKind = "menu" | "pin" | "rx" | "jumps" | "custom" | "setups";

export function LiftTrendScreen() {
  const { history, repos, programmes, finish, achievements, weekly } = useServices();
  const nav = useNavigation<{ navigate: (name: string, params?: object) => void; setOptions: (o: object) => void }>();
  const lineId = (useRoute().params as { lineId: string }).lineId;
  const { t, lang, unit, unitText, fmt } = useI18n();
  const p = usePalette();
  const [data, setData] = useState<{ lift: LiftItem; trend: LiftTrend; sessions: HistorySession[]; goalKg: number | null } | null | "none">(null);
  const [loads, setLoads] = useState<{ equipment: EquipmentType; own: GymLoadSpec | null; gym: GymLoadSpec | null } | null>(null);
  const [picking, setPicking] = useState(false);
  const [nextTarget, setNextTarget] = useState<string | null>(null);
  const [nextParts, setNextParts] = useState<{ load: number; reps: number } | null>(null);
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
  const [prSets, setPrSets] = useState<PrSetRef[] | undefined>(undefined);
  const [sheet, setSheet] = useState<SheetKind | null>(null);

  const refreshLoads = useCallback(async (exerciseId: string) => {
    const cur = await repos.getExerciseLoads(exerciseId);
    if (!cur) return setLoads(null);
    const gymId = await repos.getActiveGymId();
    const gym = gymId ? findSpec(await repos.loadGymFingerprint(gymId), cur.equipment) : null;
    setLoads({ equipment: cur.equipment, own: cur.spec, gym });
  }, [repos]);

  const name = data && data !== "none" ? exerciseLabels(data.lift, lang).primary : null;
  useLayoutEffect(() => {
    nav.setOptions({
      ...(name ? { title: name } : {}),
      headerRight: () => <IconButton icon="settings" label={t("trend.setup.open")} onPress={() => setSheet("menu")} />,
    });
  }, [nav, name, t]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      history.getLiftTrend(lineId).then(async (r) => {
        if (!r) {
          setData("none");
          setLoads(null);
          return;
        }
        const rawGoal = await repos.getSetting(goalSettingKey(r.lift.exerciseId, r.lift.setup)).catch(() => null);
        const goalKg = rawGoal ? Number(rawGoal) : NaN;
        if (!alive) return;
        setData({ ...r, goalKg: Number.isFinite(goalKg) && goalKg > 0 ? goalKg : null });
        void achievements.listCabinet().then((rows) => {
          if (!alive) return;
          setPrSets(verifiedPrs(rows)
            .filter((row) => row.evidence.identity.exerciseId === r.lift.exerciseId && row.evidence.identity.setup === r.lift.setup)
            .map((row) => ({ setId: row.evidence.newBest.setId, localDate: row.evidence.newBest.localDate, load: row.evidence.newBest.load, reps: row.evidence.newBest.reps })));
        }).catch((e) => diagnostics.record("warn", "lift PRs", e));
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
          const [lifts, gymId, next] = await Promise.all([history.listLifts(), repos.getActiveGymId(), repos.getNextDay()]);
          setSetups(lifts.filter((l) => l.exerciseId === r.lift.exerciseId).map((l) => ({
            lineId: l.lineId,
            label: `${l.gymName} · ${t(`setup.${l.setup}` as never)}`,
            selected: l.lineId === lineId,
          })));
          let rec: string | null = null;
          let parts: { load: number; reps: number } | null = null;
          let why: string | null = null;
          if (gymId && next) {
            const days = await repos.listDays(next.versionId);
            for (const d of days) {
              const planned = await finish.getPlannedSession(d.id);
              const tg = planned ? await finish.getTargetForExercise(planned.id, r.lift.exerciseId) : null;
              if (tg && hasConcreteTarget(tg)) {
                rec = targetText(tg, fmt, letters);
                parts = tg.measure === "reps" && tg.reps != null && tg.effectiveLoad != null ? { load: tg.effectiveLoad, reps: tg.reps } : null;
                const stored = await finish.getDecision(tg.id);
                if (stored) {
                  const sections = describeDecision(stored.payload, { ruleVersion: stored.ruleVersion, path: stored.path }, (k, params) => t(k as never, params), lang, unit);
                  why = sections[0]?.lines[0] ?? null;
                } else {
                  why = shortReason(renderReason(localizeReason(tg.reason, unit, lang), lang));
                }
                break;
              }
              const preview = (await finish.previewDayLoads(d.id, gymId)).find((pv) => pv.exerciseId === r.lift.exerciseId);
              if (preview && preview.proposal.currency !== "none" && preview.proposal.load != null) {
                rec = targetText({ exerciseId: r.lift.exerciseId, status: "proposed", currency: preview.proposal.currency, measure: r.lift.measure, reps: preview.proposal.reps, durationS: preview.proposal.durationS, distanceM: preview.proposal.distanceM, effectiveLoad: preview.proposal.load }, fmt, letters);
                parts = r.lift.measure === "reps" && preview.proposal.reps != null ? { load: preview.proposal.load, reps: preview.proposal.reps } : null;
                why = shortReason(renderReason(localizeReason(preview.proposal.reason, unit, lang), lang));
                break;
              }
            }
          }
          if (!alive) return;
          setNextTarget(rec);
          setNextParts(parts);
          setWhySentence(why);
        })();
      });
      return () => { alive = false; };
    }, [history, lineId, refreshLoads, programmes, finish, repos, achievements, t, fmt, lang, unit]),
  );

  if (data === null) return <LoadingState />;
  if (data === "none") return <EmptyState icon="progress" title={t("empty.noSets")} body={t("trend.noPoints")} />;

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
  const saveGoal = async (kg: number | null) => {
    try {
      await repos.setSetting(goalSettingKey(data.lift.exerciseId, data.lift.setup), kg === null ? "" : String(Math.round(kg * 1000) / 1000));
    } catch (e) {
      diagnostics.record("warn", "progress goal", e);
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
      setSheet("menu");
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
    if (r) setData({ ...r, goalKg: data.goalKg });
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
  const jumpKg = loads ? matchingJumpKg(loads.own ?? loads.gym) : null;
  const exerciseName = exerciseLabels(data.lift, lang).primary;

  // ---- the gear sheet: one row per setting, each opening its existing editor ----------------------------------------------
  const menu = (
    <View>
      <ListRow title={t("trend.setup.target")} trailing={pin ? pinTarget : t("trend.setup.targetNone")} onPress={() => setSheet("pin")} />
      {rx ? <ListRow title={t("trend.setup.setsReps")} trailing={isolateLtr(`${rx.sets} × ${rx.repMin}–${rx.repMax}`)} onPress={() => setSheet("rx")} /> : null}
      {loads ? (
        <ListRow
          title={t("trend.setup.jumps")}
          trailing={jumpKg !== null ? `${isolateLtr(weightText(jumpKg, unit))} ${unitText}` : t("trend.setup.jumpsDefault")}
          onPress={() => setSheet("jumps")}
        />
      ) : null}
      <ListRow title={t("trend.setup.focus")} trailing={pin ? t("trend.setup.focusWeeks", { n: pin.weeks ?? 4 }) : t("trend.setup.focusOff")} onPress={() => setSheet("pin")} last={!custom && setups.length <= 1} />
      {custom ? <ListRow title={t("pick.edit")} onPress={() => setSheet("custom")} last={setups.length <= 1} /> : null}
      {setups.length > 1 ? <ListRow title={t("trend.setup.line")} trailing={setups.find((s) => s.selected)?.label} onPress={() => setSheet("setups")} last /> : null}
    </View>
  );

  const pinEditor = (
    <View style={{ gap: space.md }}>
      {pin ? (
        <View accessible accessibilityRole="progressbar" accessibilityLabel={t("achv.pin.a11y", { pct: pinPct })} accessibilityValue={{ min: 0, max: 100, now: pinPct }} style={{ gap: space.xs }}>
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
      <BigButton variant="primary" label={t("achv.pin.save")} onPress={() => void savePin()} />
      {pin ? <BigButton variant="quiet" label={t("achv.pin.clear")} onPress={() => void clearPin()} /> : null}
    </View>
  );

  const rxEditor = rx ? (
    <View style={{ gap: space.md }}>
      <Field label={t("ex.sets")} value={rxSets} onChangeText={(s) => { setRxSets(s); setRxSaved(false); }} numeric />
      <Field label={t("ex.repMin")} value={rxMin} onChangeText={(s) => { setRxMin(s); setRxSaved(false); }} numeric />
      <Field label={t("ex.repMax")} value={rxMax} onChangeText={(s) => { setRxMax(s); setRxSaved(false); }} numeric />
      {rxSaved ? <InlineStatus kind="success" text={t("ex.prescriptionSaved")} /> : null}
      <BigButton variant="primary" label={t("ex.savePrescription")} onPress={() => void saveRx()} />
    </View>
  ) : null;

  const jumpsEditor = loads ? (
    <View style={{ gap: space.md }}>
      <AppText>
        {loads.own
          ? t("loads.state.own", { what: loadsSummaryText(loads.own, unit, unitText, t as never) })
          : t("loads.state.default", { equipment: t(`equipment.${loads.equipment}` as never) })}
      </AppText>
      {!loads.own && loads.gym ? <AppText style={{ color: p.muted }}>{loadsSummaryText(loads.gym, unit, unitText, t as never)}</AppText> : null}
      <AppText style={{ color: p.muted, fontSize: ty.caption }}>{t("loads.pickHint")}</AppText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {TREND_LOAD_JUMPS_KG.map((kg) => (
          <Chip key={kg} label={t("loads.jump", { step: weightText(kg, unit), unit: unitText })} selected={jumpKg === kg} onPress={() => void onPickJump(kg)} />
        ))}
      </View>
      <BigButton
        variant="secondary"
        label={t("loads.open")}
        onPress={() => {
          setSheet(null);
          nav.navigate("ExerciseLoads", { exerciseId: data.lift.exerciseId, gymId: data.lift.gymId, setup: data.lift.setup });
        }}
      />
    </View>
  ) : null;

  const customEditor = custom ? (
    <View style={{ gap: space.md }}>
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
      <BigButton variant="primary" label={t("pick.saveEdit")} onPress={() => void saveCustom()} />
    </View>
  ) : null;

  const setupsEditor = (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
      {setups.map((s) => (
        <Chip key={s.lineId} label={s.label} selected={s.selected} onPress={() => { setSheet(null); if (!s.selected) nav.navigate("LiftTrend", { lineId: s.lineId }); }} />
      ))}
    </View>
  );

  const sheetTitle =
    sheet === "pin" ? t("achv.pin.title")
    : sheet === "rx" ? t("trend.setup.setsReps")
    : sheet === "jumps" ? t("trend.setup.jumps")
    : sheet === "custom" ? t("pick.edit")
    : sheet === "setups" ? t("trend.setup.line")
    : t("trend.setup.title", { name: exerciseName });
  const sheetBody =
    sheet === "pin" ? pinEditor
    : sheet === "rx" ? rxEditor
    : sheet === "jumps" ? jumpsEditor
    : sheet === "custom" ? customEditor
    : sheet === "setups" ? setupsEditor
    : menu;

  return (
    <>
      <LiftTrendView
        lift={data.lift}
        trend={data.trend}
        sessions={data.sessions}
        nextTarget={nextTarget}
        nextParts={nextParts}
        whySentence={whySentence}
        goalKg={data.goalKg}
        onGoalChange={(kg) => void saveGoal(kg)}
        prSets={prSets}
      />
      <Sheet visible={sheet !== null} title={sheetTitle} onClose={() => setSheet(sheet === null || sheet === "menu" ? null : "menu")}>
        {sheetBody}
      </Sheet>
    </>
  );
}
