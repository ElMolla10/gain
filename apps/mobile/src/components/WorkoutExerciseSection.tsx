import { canEditLoadsFor } from "../logic/setRowState";
import { loadTargetText } from "../logic/bidiText";
import { PersonalMilestoneLine } from "./PersonalMilestoneLine";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, View, useWindowDimensions } from "react-native";
import { findSpec, renderReason, type GymFingerprint, type OutlierResult, type Decision } from "@gain/engine";
import type { Disp, ExInfo } from "../logic/workoutTypes";
import type { ExerciseState, SetRow } from "../db/workoutRepo";
import { useI18n } from "../i18n";
import { exerciseLabels, formatLoad, isolateLtr } from "../i18n/format";
import { localizeReason, unitLabel, type Unit } from "../logic/units";
import { isIsolationPattern, warmupOffer, warmupsUsuallySkipped } from "../logic/warmups";
import { foldedSummary } from "../logic/foldedSummary";
import { isTimed, quantityText, setQuantity } from "../logic/quantity";
import { workingIndexes } from "../logic/liveSummary";
import { focusedRowKey } from "../logic/workoutFocus";
import { rowLabels, type SetRowDraft } from "../logic/workoutRows";
import { LIVE_MISSING_FEATURES, nextAdaptiveRow, suggestedNextLoad, trustedWorkingSet, type ReportedSymptom } from "../logic/liveAdaptation";
import { nextSetState } from "../logic/nextSetCard";
import { describeWhyWeight, sessionPosition } from "../logic/why";
import { formatClock } from "../logic/restTimer";
import { radius, space, type as ty, useLogPalette } from "../theme";
import { AppText, BigButton, IconButton, InlineStatus, Notice, QuietAction, useReducedMotion } from "../ui";
import { RACK_MOTION } from "../logic/rackMotion";
import { RestToggle, TargetLine, UnitToggle } from "./LogParts";
import { Icon } from "./Icon";
import { LiveSuggestion, LoadSettings } from "./LiveSuggestion";
import { MemoWorkoutSetRow, type WorkoutSetRowProps } from "./WorkoutSetRow";
import type { PreviousSource } from "./PreviousSourceToggle";

/** A finished exercise folds this long after focus moves on (logger spec §4). */
export const FOLD_DELAY_MS = 600;
/** Fold only when every row is saved and none is being edited, nothing is unconfirmed, and focus is elsewhere. */
export const shouldFold = (list: readonly SetRowDraft[], unconfirmed: number, active: boolean): boolean =>
  !active && unconfirmed === 0 && list.some((r) => r.saved && !r.warmup) && list.every((r) => r.saved && !r.dirty);

export interface LiveCard { decision: Decision; key: string; performance: string; snapshot: string; starting?: boolean }
export interface ExerciseSectionProps extends Pick<WorkoutSetRowProps, "onPatch" | "onKind" | "onAskDelete" | "onDelete" | "onLog" | "onUntick"> {
  active?: boolean; liveDetailsOpen?: boolean; onLiveDetails?: () => void;
  /** Rest is on in general (rest.auto); without it the rest chip moves into the ⋮ menu. */
  restGlobal?: boolean;
  /** The Next-set card is closed by default (a stop warning always shows); the row still carries the suggestion as ghost values. */
  suggestionOpen?: boolean; onToggleSuggestion?: () => void;
  /** Available-load settings, closed by default behind the header's Loads control. */
  loadsOpen?: boolean; onToggleLoads?: () => void;
  ex: Disp; position: number; info: ExInfo; list: SetRowDraft[]; st: ExerciseState;
  gym: GymFingerprint; exSets: SetRow[]; outliers: Record<string, OutlierResult>;
  candidate?: LiveCard; card?: LiveCard; expanded: boolean; supersetLabel?: string;
  /** Earlier same-muscle exercise when a later-in-session reduction was applied. */
  afterExercise?: string | null;
  /** Session readiness when a modest reduction was applied. */
  readiness?: "fatigued" | "returning" | null;
  restDurationMs: number; busy: boolean; warmOpen: boolean; warmDone: boolean;
  onOpenProgress: () => void; onToggleRest: () => void; onMenu: () => void; onWhy: () => void; onWhyLong: () => void;
  onLiveApply: () => void; onLiveOwn: () => void; onLiveReport: (symptom: ReportedSymptom) => void; onLiveKeep: () => void;
  onPickJump?: (kg: number) => void; listText?: string; onListChange?: (text: string) => void; onSaveList?: () => void;
  focusRow?: { key: string; nonce: number } | null;
  onOutlierConfirm: (set: SetRow) => Promise<void>; onOutlierReject: (set: SetRow) => Promise<void>;
  onWarmConfirm: (steps: { load: number; reps: number }[]) => Promise<void>;
  onWarmOpen: () => void; onWarmClose: () => void; onAddSet: () => void;
  onOpenTrend?: () => void;
  previousSource?: PreviousSource;
  strengthPrSetId?: string | null;
  /** This exercise's own kg / lb choice (null or absent: follow the app-wide unit) and the handler that flips it. Loads stay stored in kg. */
  unitOverride?: Unit | null; onToggleUnit?: () => void;
}

/** One exercise's presentation. Screen handlers own all database writes and draft changes. */
export function WorkoutExerciseSection({ restGlobal = true, active = true, liveDetailsOpen = false, onLiveDetails, suggestionOpen = false, onToggleSuggestion, loadsOpen = false, onToggleLoads, ex, position, info, list, st, gym, exSets, outliers, candidate, card, expanded, supersetLabel, afterExercise, readiness, restDurationMs, busy, warmOpen, warmDone, onOpenProgress, onToggleRest, onMenu, onWhy, onWhyLong, onLiveApply, onLiveOwn, onLiveReport, onLiveKeep, onPickJump, listText, onListChange, onSaveList, focusRow, onOutlierConfirm, onOutlierReject, onWarmConfirm, onWarmOpen, onWarmClose, onAddSet, onOpenTrend, onPatch, onKind, onAskDelete, onDelete, onLog, onUntick, previousSource = "any", strengthPrSetId, unitOverride, onToggleUnit }: ExerciseSectionProps) {
  const { t, lang, unit: appUnit } = useI18n();
  const unit = unitOverride ?? appUnit;
  const unitText = unitLabel(unit, lang);
  const fmt = (kg: number) => formatLoad(kg, lang, unit);
  const p = useLogPalette();
  const { fontScale } = useWindowDimensions();

  const labels = exerciseLabels(ex, lang);
  const pr = info.proposal;
  const spec = ex.loadSpec ?? findSpec(gym, ex.equipment);
  const numbering = rowLabels(list);
  const currentKey = focusedRowKey(list);
  const widx = workingIndexes(list);
  const workingLoad = info.stored ? (info.stored.status === "rejected" ? null : info.stored.effectiveLoad) : pr.status === "proposed" ? pr.load : null;
  const timed = isTimed(ex.measure);
  const qUnits = { s: t("qty.s"), m: t("qty.m") };
  const offer = timed ? ({ kind: "none", reason: "already_started" } as unknown as ReturnType<typeof warmupOffer>) : warmupOffer({ workingLoad, spec, setup: ex.setup, loggedToday: exSets.length, isolation: isIsolationPattern(ex.pattern) });
  const pending = exSets.filter((s) => s.outlierStatus === "unconfirmed");
  // "Maintain" is an actual recommendation too: show its current load, not a blank.
  // If inference is unavailable or tells the lifter to stop, do not fake a weight.
  const suggestedKg = suggestedNextLoad(candidate?.decision, exSets.some(s => !s.warmup && s.outlierStatus !== "unconfirmed" && s.outlierStatus !== "rejected"));
  const trusted = exSets.filter(trustedWorkingSet);
  const basis = trusted.at(-1);
  const why = card
    ? describeWhyWeight(
        {
          trigger: basis ? { load: basis.load, reps: basis.reps, rir: basis.rir } : null,
          position: sessionPosition(trusted.length > 0 ? trusted.length - 1 : null),
          afterExercise: afterExercise ?? null,
          readiness: readiness ?? null,
          action: card.decision.action,
          loadSpec: spec,
          loadSource: ex.loadSource ?? (ex.loadSpec ? "exercise" : "gym"),
          experimental: card.decision.predictionAvailable !== false && card.decision.reason !== "reported_symptoms",
          missing: card.decision.predictionAvailable !== false && card.decision.reason !== "reported_symptoms" ? LIVE_MISSING_FEATURES : undefined,
        },
        (k, params) => t(k as never, params),
        lang,
        unit,
      )
    : null;
  const whySentence = why ? [why.sentence, ...why.details].join(" ") : null;

  // GAIN's target for today and its reason, kept to one line until tapped.
  const storedQ = info.stored ? (ex.measure === "time" ? info.stored.durationS : ex.measure === "distance" ? info.stored.distanceM : info.stored.reps) : null;
  const proposedQ = ex.measure === "time" ? pr.durationS ?? null : ex.measure === "distance" ? pr.distanceM ?? null : pr.reps;
  const targetNone = info.stored ? info.stored.status === "rejected" || info.stored.effectiveLoad === null || storedQ === null : !(pr.status === "proposed" && pr.load !== null && proposedQ !== null);
  const tLoad = info.stored ? info.stored.effectiveLoad : pr.load;
  const tReps = info.stored ? storedQ : proposedQ;
  // A hold or carry target: "45 s" (or "24 kg × 45 s" when it is loaded); a reps target: "60 kg × 8".
  const targetText = targetNone ? t("workout.targetNone") : timed ? ((tLoad as number) > 0 ? `${formatLoad(tLoad as number, lang, unit)} × ${isolateLtr(quantityText(tReps as number, ex.measure, qUnits))}` : isolateLtr(quantityText(tReps as number, ex.measure, qUnits))) : `${formatLoad(tLoad as number, lang, unit)} × ${isolateLtr(String(tReps))}`;
  const reasonText = info.stored?.status === "rejected" ? t("finish.rejectedNote") : renderReason(localizeReason(info.stored ? info.stored.reason : pr.reason, unit, lang), lang);

  const colSet = { width: 48, alignItems: "center" as const };
  const colTick = { width: 48, alignItems: "center" as const };
  const head = { color: p.muted, fontSize: 13, fontWeight: "600" as const, textAlign: "center" as const };
  // At large font sizes the five columns no longer fit side by side: the row becomes two lines (set, previous, tick / weight, reps).
  const stacked = fontScale > 1.3;

  // Only a stop warning opens on its own; any other suggestion is one tap away ("Next set details").
  const showCard = !!card && (card.decision.action === "stop" || suggestionOpen);
  const canEditLoads = !!onPickJump && canEditLoadsFor(ex);
  const live = card && showCard ? <LiveSuggestion unit={unit} decision={card.decision} state={nextSetState({ decision: card.decision, starting: card.starting, spec })}
    basis={basis} repMin={ex.repMin} repMax={ex.repMax} equipment={ex.equipment} loadSpec={spec}
    detailsOpen={liveDetailsOpen} onToggleDetails={onLiveDetails}
    manualLoad={nextAdaptiveRow(list)?.load !== null || nextAdaptiveRow(list)?.reps !== null} busy={busy}
    onApply={onLiveApply} onOwn={onLiveOwn} onKeep={onLiveKeep} whySentence={whySentence} /> : null;

  return (
    <View key={ex.id} style={{ paddingTop: space.md, borderStartWidth: supersetLabel ? 4 : 0, borderStartColor: p.fill }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs, paddingStart: space.lg, paddingEnd: space.xs }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("workout.openProgress", { exercise: labels.primary })}
          onPress={onOpenProgress} style={{ flex: 1, minHeight: 48, justifyContent: "center" }}>
          {supersetLabel ? (
            <AppText style={{ color: p.accent, fontSize: 13, fontWeight: "600" }}>{t("workout.superset.label", { letter: supersetLabel! })}</AppText>
          ) : null}
          {onOpenTrend ? (
            <Pressable accessibilityRole="button" accessibilityLabel={labels.primary} onPress={onOpenTrend}>
              <AppText accessibilityRole="header" style={{ fontSize: ty.section, fontWeight: "600" }}>{labels.primary}</AppText>
            </Pressable>
          ) : (
            <AppText accessibilityRole="header" style={{ fontSize: ty.section, fontWeight: "600" }}>{labels.primary}</AppText>
          )}
          {labels.secondary ? <AppText style={{ color: p.muted, fontSize: 13 }}>{labels.secondary}</AppText> : null}
        </Pressable>
        {/* Rest control stays one tap away, in the exercise header: the length (or Off) beside the options menu, not a row of its own. */}
        {/* The rest chip only when rest is on in general; otherwise the ⋮ menu offers "Rest after this exercise" (logger spec §4). */}
        {onToggleUnit ? <UnitToggle unit={unit} kgText={unitLabel("kg", lang)} lbText={unitLabel("lb", lang)} a11y={t("workout.unitToggle.a11y", { exercise: labels.primary, unit: unitLabel(unit, lang), other: unitLabel(unit === "kg" ? "lb" : "kg", lang) })} onPress={onToggleUnit} /> : null}
        {restGlobal ? <RestToggle off={st.restOff} text={st.restOff ? t("workout.restOffShort") : formatClock(restDurationMs)} a11y={`${st.restOff ? t("workout.restLineOff") : t("workout.restLine", { time: formatClock(restDurationMs) })}: ${labels.primary}`} onPress={() => onToggleRest()} /> : null}
        <IconButton icon="more" label={`${t("workout.menu.title")}: ${labels.primary}`} color={p.muted} onPress={() => onMenu()} />
      </View>
      {canEditLoads && loadsOpen ? (
        <View style={{ gap: space.xs }}>
          <LoadSettings unit={unit} loadSpec={spec} busy={busy} onPickJump={onPickJump!} listText={listText} onListChange={onListChange} onSaveList={onSaveList} />
          <View style={{ paddingHorizontal: space.md, alignItems: "flex-start" }}>
            <QuietAction label={t("common.close")} accessibilityLabel={`${t("common.close")}: ${t("workout.loads")}, ${labels.primary}`} expanded onPress={() => onToggleLoads?.()} />
          </View>
        </View>
      ) : null}

      {/* Tight vertical rhythm (spacing tokens): exercise block starts space.md below the previous one; heading, target line and set table sit directly on each other (the 48 dp controls already carry the breathing room), with space.xs above the column heads. */}
      {/* Compact target line: "Target 55 kg × 9 · Why". It wraps onto a second line when it is long and is never cut off. */}
      <View style={{ paddingHorizontal: space.lg }}>
        <TargetLine
          label={t("workout.nextTarget")}
          value={targetText}
          whyLabel={t("workout.whyShort")}
          whyA11y={`${t("workout.whyShort")}: ${labels.primary}`}
          expanded={info.stored ? undefined : expanded}
          reason={reasonText}
          onWhy={() => onWhy()}
          onWhyLong={() => onWhyLong()}
          moreLabel={card && card.decision.action !== "stop" && onToggleSuggestion ? t("workout.nextSetDetails") : undefined}
          moreA11y={`${t("workout.nextSetDetails")}: ${labels.primary}`}
          moreExpanded={suggestionOpen}
          onMore={() => onToggleSuggestion?.()}
        />
        {!why && afterExercise ? <AppText style={{ fontSize: ty.label, color: p.muted }}>{t("why.weight.afterExercise", { exercise: afterExercise })}</AppText> : null}
        {!why && readiness ? <AppText style={{ fontSize: ty.label, color: p.muted }}>{t(readiness === "fatigued" ? "why.weight.fatigued" : "why.weight.returning")}</AppText> : null}
        {info.prefill.estimated && exSets.length === 0 ? <AppText style={{ fontSize: ty.label, color: p.muted }}>{t("coach.start.estimate")}</AppText> : null}
        {info.stored && expanded ? <AppText style={{ fontSize: ty.label, color: p.muted }}>{reasonText}</AppText> : null}
        <PersonalMilestoneLine unit={unit} onOpen={onOpenProgress} history={info.personalHistory ?? []} today={exSets} spec={spec} measure={ex.measure} repMin={ex.repMin} repMax={ex.repMax} setup={ex.setup} />
        {ex.topSets && !timed ? <AppText style={{ fontSize: ty.label, color: p.muted }}>{t("workout.topset.note", { n: ex.topSets })}</AppText> : null}
      </View>


      {/* Column heads, once per exercise. At large text Previous is a caption inside each row, so it has no column here (L-8).
          A head never runs past its column (AR "مجموعة" at 1.5x): one line, shrinks to fit (C-R2). */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.md, marginTop: space.xs }}>
        <View style={colSet}><AppText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={head}>{t("workout.col.set").toUpperCase()}</AppText></View>
        {stacked ? null : <View style={{ flex: 1.1 }}><AppText style={head}>{t("workout.col.prev").toUpperCase()}</AppText></View>}
        <View style={{ flex: 1 }}><AppText style={head}>{unitText.toUpperCase()}</AppText></View>
        <View style={{ flex: 1 }}><AppText style={head}>{(timed ? (ex.measure === "time" ? t("workout.col.sec") : t("workout.col.metres")) : t("workout.col.reps")).toUpperCase()}</AppText></View>
        {ex.trackEffort ? <View style={{ width: stacked ? 64 : 52 }}><AppText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={head}>{t("workout.col.rir").toUpperCase()}</AppText></View> : null}
        <View style={colTick}><Icon name="check" color={p.muted} size={16} /></View>
      </View>

      {card?.decision.action === "stop" ? live : null}
      <View>
        {list.map((row, i) => (
          <React.Fragment key={row.key}>
            {card?.decision.action !== "stop" && card?.key === row.key ? live : null}
            <MemoWorkoutSetRow key={row.key} ex={ex} unit={unit} row={row} label={numbering[i] ?? i + 1}
              workingIndex={widx[i] ?? null} lastSets={(info.previous ? info.previous[previousSource] : info.last)?.sets ?? null}
              strengthPr={strengthPrSetId === row.key}
              current={active && currentKey === row.key} stacked={stacked} busy={busy}
              autoFocus={focusRow?.key === row.key} focusNonce={focusRow?.nonce}
              onPatch={onPatch} onKind={onKind} onAskDelete={onAskDelete}
              onDelete={onDelete} onLog={onLog} onUntick={onUntick} />
          </React.Fragment>
        ))}
      </View>

      {pending.map((s) => {
        const o = outliers[s.id];
        return (
          <View key={s.id} style={{ marginHorizontal: space.md }}>
            <Notice kind="warn" title={t("workout.outlier.title")}>
              <AppText>
                {timed
                  ? isolateLtr(quantityText(setQuantity(s, ex.measure), ex.measure, qUnits))
                  : loadTargetText(s.load, s.reps, "reps", lang, unit, qUnits)} · {timed ? t("workout.outlier.bodyTimed") : t("workout.outlier.body", { load: o?.expected ? fmt(o.expected.medianLoad) : "?", reps: o?.expected?.medianReps ?? "?" })}
              </AppText>
              <AppText style={{ color: p.muted }}>{t("workout.outlier.note")}</AppText>
              <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
                <View style={{ flexGrow: 1, flexBasis: 140 }}>
                  <BigButton
                    label={t("workout.outlier.confirm")}
                    onPress={() => onOutlierConfirm(s)}
                  />
                </View>
                <View style={{ flexGrow: 1, flexBasis: 140 }}>
                  <BigButton
                    variant="secondary"
                    label={t("workout.outlier.reject")}
                    onPress={() => onOutlierReject(s)}
                  />
                </View>
              </View>
            </Notice>
          </View>
        );
      })}

      {offer.kind === "offer" ? (
        warmOpen ? (
          <View style={{ marginHorizontal: space.md, padding: space.md, gap: space.sm, borderRadius: radius.card, backgroundColor: p.card, borderWidth: 1, borderColor: p.line }}>
            <AppText style={{ fontWeight: "600" }}>{t("warm.title", { load: fmt(offer.workingLoad) })}</AppText>
            {offer.sets.map((w, i) => (
              <AppText key={i} style={{ fontSize: 16, fontVariant: ["tabular-nums"] }}>{`${fmt(w.load)} × ${isolateLtr(String(w.reps))}`}</AppText>
            ))}
            <AppText style={{ color: p.muted, fontSize: 13 }}>{t("warm.note")}</AppText>
            <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
              <View style={{ flexGrow: 1, flexBasis: 140 }}>
                <BigButton
                  label={t("warm.confirm")}
                  disabled={busy}
                  onPress={() => onWarmConfirm(offer.sets)}
                />
              </View>
              <View style={{ flexGrow: 1, flexBasis: 140 }}>
                <BigButton variant="secondary" label={t("warm.cancel")} onPress={() => onWarmClose()} />
              </View>
            </View>
          </View>
        ) : (
          <View style={{ paddingHorizontal: space.md, alignItems: "flex-start" }}>
            <BigButton variant="quiet" icon="plus" label={warmupsUsuallySkipped(position, ex.pattern) ? t("warm.addAnyway") : t("warm.add")} onPress={() => onWarmOpen()} />
          </View>
        )
      ) : null}
      {warmDone ? <InlineStatus kind="success" text={t("warm.added")} /> : null}
      {!spec ? <AppText style={{ color: p.muted, fontSize: 13, paddingHorizontal: space.lg }}>{t("workout.stepFallback")}</AppText> : null}

      {/* "+ Set" is a quiet 48 dp text action (logger spec §4); the dock carries the primary action. */}
      <View style={{ paddingHorizontal: space.md, alignItems: "flex-start" }}>
        <QuietAction icon="plus" label={t("workout.addSet")} accessibilityLabel={`${t("workout.addSet")}: ${labels.primary}`} onPress={() => onAddSet()} />
      </View>
    </View>
  );
}

/**
 * The exercise block as the logger shows it: the full section, or, once finished and focus has moved on, folded to one 56 dp line
 * (logger spec §4) after FOLD_DELAY_MS. Tap to unfold; the unfolded choice is session-only state. The fold state lives here so the
 * section itself stays a plain function of its props.
 */
export function ExerciseBlock(props: ExerciseSectionProps) {
  const { list, exSets, active = true, ex, supersetLabel } = props;
  const { t, lang, unit } = useI18n();
  const p = useLogPalette();
  const reduced = useReducedMotion();
  const unconfirmed = exSets.filter((s) => s.outlierStatus === "unconfirmed").length;
  const foldable = shouldFold(list, unconfirmed, active);
  // open → (600 ms) folding: the measured section collapses to 56 dp over 200 ms (Animated height, no LayoutAnimation) → folded.
  // Reduce Motion skips the collapse.
  const [phase, setPhase] = useState<"open" | "folding" | "folded">("open");
  const [unfolded, setUnfolded] = useState(false);
  const measured = useRef(0);
  const height = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!foldable || unfolded) { setPhase("open"); return; }
    const id = setTimeout(() => {
      if (reduced || measured.current <= 0) return setPhase("folded");
      height.setValue(measured.current);
      setPhase("folding");
      Animated.timing(height, { toValue: RACK_MOTION.foldTo, duration: RACK_MOTION.fold, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(() => setPhase("folded"));
    }, FOLD_DELAY_MS);
    return () => clearTimeout(id);
  }, [foldable, unfolded, reduced, height]);
  if (phase === "folded" && foldable && !unfolded) {
    return <FoldedExercise name={exerciseLabels(ex, lang).primary} list={list} superset={!!supersetLabel} onUnfold={() => setUnfolded(true)} t={t} lang={lang} unit={props.unitOverride ?? unit} p={p} />;
  }
  if (phase === "folding") return <Animated.View style={{ height, overflow: "hidden" }}><WorkoutExerciseSection {...props} /></Animated.View>;
  return <View onLayout={(e) => { measured.current = e.nativeEvent.layout.height; }}><WorkoutExerciseSection {...props} /></View>;
}

/** One line for a finished exercise: name, "57.5 kg × 8, 9, 10", a done check and a chevron. A button that unfolds it. */
export function FoldedExercise({ name, list, superset, onUnfold, t, lang, unit, p }: { name: string; list: readonly SetRowDraft[]; superset: boolean; onUnfold: () => void; t: ReturnType<typeof useI18n>["t"]; lang: ReturnType<typeof useI18n>["lang"]; unit: ReturnType<typeof useI18n>["unit"]; p: ReturnType<typeof useLogPalette> }) {
  const done = list.filter((r) => r.saved && !r.warmup && r.load !== null && r.reps !== null).map((r) => ({ load: r.load as number, reps: r.reps as number, tags: r.tags }));
  const summary = foldedSummary(done, lang, unit);
  const n = done.filter((d) => !d.tags.includes("drop")).length;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t("rack.fold.a11y", { exercise: name, n, summary })}
      accessibilityHint={t("rack.fold.hint")}
      accessibilityState={{ expanded: false }}
      onPress={onUnfold}
      style={({ pressed }) => ({ minHeight: 56, marginTop: space.md, paddingHorizontal: space.lg, flexDirection: "row", alignItems: "center", gap: space.md, borderStartWidth: superset ? 4 : 0, borderStartColor: p.fill, opacity: pressed ? 0.7 : 1 })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <AppText numberOfLines={1} style={{ fontSize: 16, fontWeight: "600" }}>{name}</AppText>
        <AppText numberOfLines={1} style={{ fontSize: ty.label, color: p.muted, fontVariant: ["tabular-nums"] }}>{summary}</AppText>
      </View>
      <Icon name="check" color={p.accent} size={20} />
      <Icon name="chevron" color={p.muted} size={20} />
    </Pressable>
  );
}
