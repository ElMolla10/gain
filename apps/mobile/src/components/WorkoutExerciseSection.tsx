import { PersonalMilestoneLine } from "./PersonalMilestoneLine";
import React from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { findSpec, renderReason, type GymFingerprint, type OutlierResult, type Decision } from "@gain/engine";
import type { Disp, ExInfo } from "../logic/workoutTypes";
import type { ExerciseState, SetRow } from "../db/workoutRepo";
import { useI18n } from "../i18n";
import { exerciseLabels, formatLoad, isolateLtr } from "../i18n/format";
import { localizeReason, weightText } from "../logic/units";
import { isIsolationPattern, warmupOffer, warmupsUsuallySkipped } from "../logic/warmups";
import { plateLine } from "../logic/plateText";
import { isTimed, quantityText, setQuantity } from "../logic/quantity";
import { workingIndexes } from "../logic/liveSummary";
import { focusedRowKey } from "../logic/workoutFocus";
import { rowLabels, type SetRowDraft } from "../logic/workoutRows";
import { LIVE_MISSING_FEATURES, nextAdaptiveRow, suggestedNextLoad, trustedWorkingSet, type ReportedSymptom } from "../logic/liveAdaptation";
import { nextSetState } from "../logic/nextSetCard";
import { describeWhyWeight, sessionPosition } from "../logic/why";
import { formatClock } from "../logic/restTimer";
import { radius, space, type as ty, useLogPalette } from "../theme";
import { AppText, BigButton, IconButton, InlineStatus, Notice, QuietAction } from "../ui";
import { RestToggle, TargetLine } from "./LogParts";
import { Icon } from "./Icon";
import { LiveSuggestion, LoadSettings } from "./LiveSuggestion";
import { WorkoutSetRow, type WorkoutSetRowProps } from "./WorkoutSetRow";
import type { PreviousSource } from "./PreviousSourceToggle";

export interface LiveCard { decision: Decision; key: string; performance: string; snapshot: string; starting?: boolean }
interface Props extends Pick<WorkoutSetRowProps, "onPatch" | "onKind" | "onAskDelete" | "onDelete" | "onLog" | "onUntick"> {
  active?: boolean; liveDetailsOpen?: boolean; onLiveDetails?: () => void;
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
}

/** One exercise's presentation. Screen handlers own all database writes and draft changes. */
export function WorkoutExerciseSection({ active = true, liveDetailsOpen = false, onLiveDetails, suggestionOpen = false, onToggleSuggestion, loadsOpen = false, onToggleLoads, ex, position, info, list, st, gym, exSets, outliers, candidate, card, expanded, supersetLabel, afterExercise, readiness, restDurationMs, busy, warmOpen, warmDone, onOpenProgress, onToggleRest, onMenu, onWhy, onWhyLong, onLiveApply, onLiveOwn, onLiveReport, onLiveKeep, onPickJump, listText, onListChange, onSaveList, focusRow, onOutlierConfirm, onOutlierReject, onWarmConfirm, onWarmOpen, onWarmClose, onAddSet, onOpenTrend, onPatch, onKind, onAskDelete, onDelete, onLog, onUntick, previousSource = "any", strengthPrSetId }: Props) {
  const { t, lang, unit, unitText, fmt } = useI18n();
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
  const suggestedWeight = suggestedKg === null ? "" : formatLoad(suggestedKg, lang, unit);
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
  const plates = !timed ? plateLine(spec, typeof tLoad === "number" ? tLoad : workingLoad, unit, t) : null;
  const suggestedPlates = !timed && suggestedKg !== null ? plateLine(spec, suggestedKg, unit, t) : null;
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
  const canEditLoads = !!onPickJump && !timed && ex.setup !== "assisted" && ex.equipment !== "assisted";
  const live = card && showCard ? <LiveSuggestion decision={card.decision} state={nextSetState({ decision: card.decision, starting: card.starting, spec })}
    basis={basis} repMin={ex.repMin} repMax={ex.repMax} equipment={ex.equipment} loadSpec={spec}
    detailsOpen={liveDetailsOpen} onToggleDetails={onLiveDetails}
    manualLoad={nextAdaptiveRow(list)?.load !== null || nextAdaptiveRow(list)?.reps !== null} busy={busy}
    onApply={onLiveApply} onOwn={onLiveOwn} onReport={onLiveReport} onKeep={onLiveKeep} whySentence={whySentence} /> : null;

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
        <RestToggle off={st.restOff} text={st.restOff ? t("workout.restOffShort") : formatClock(restDurationMs)} a11y={`${st.restOff ? t("workout.restLineOff") : t("workout.restLine", { time: formatClock(restDurationMs) })}: ${labels.primary}`} onPress={() => onToggleRest()} />
        {canEditLoads ? <QuietAction label={t("workout.loads")} accessibilityLabel={`${t("workout.loads")}: ${labels.primary}`} expanded={loadsOpen} onPress={() => onToggleLoads?.()} /> : null}
        <IconButton icon="more" label={`${t("workout.menu.title")}: ${labels.primary}`} color={p.muted} onPress={() => onMenu()} />
      </View>
      {canEditLoads && loadsOpen ? <LoadSettings loadSpec={spec} busy={busy} onPickJump={onPickJump!} listText={listText} onListChange={onListChange} onSaveList={onSaveList} /> : null}

      {/* Tight vertical rhythm (spacing tokens): exercise block starts space.md below the previous one; heading, target line and set table sit directly on each other (the 48 dp controls already carry the breathing room), with space.xs above the column heads. */}
      {/* Compact target line: "Target 55 kg × 9 · Why". It wraps onto a second line when it is long and is never cut off. */}
      <View style={{ paddingHorizontal: space.lg }}>
        <TargetLine
          label={t("workout.nextTarget")}
          value={targetText}
          whyLabel={t("workout.whyShort")}
          suggestedLabel={suggestedWeight && !showCard ? t("workout.suggestedWeight") : undefined}
          suggestedValue={suggestedWeight}
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
        {plates ? <AppText ltr style={{ fontSize: ty.label, color: p.muted }}>{plates.text}</AppText> : null}
        {suggestedPlates && suggestedPlates.text !== plates?.text ? <AppText ltr style={{ fontSize: ty.label, color: p.muted }}>{suggestedPlates.text}</AppText> : null}
        {info.prefill.estimated && exSets.length === 0 ? <AppText style={{ fontSize: ty.label, color: p.muted }}>{t("coach.start.estimate")}</AppText> : null}
        {info.stored && expanded ? <AppText style={{ fontSize: ty.label, color: p.muted }}>{reasonText}</AppText> : null}
        <PersonalMilestoneLine onOpen={onOpenProgress} history={info.personalHistory ?? []} today={exSets} spec={spec} measure={ex.measure} repMin={ex.repMin} repMax={ex.repMax} setup={ex.setup} />
        {ex.topSets && !timed ? <AppText style={{ fontSize: ty.label, color: p.muted }}>{t("workout.topset.note", { n: ex.topSets })}</AppText> : null}
      </View>


      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: space.md, marginTop: space.xs }}>
        <View style={colSet}><AppText style={head}>{t("workout.col.set").toUpperCase()}</AppText></View>
        <View style={{ flex: 1.3 }}><AppText style={head}>{t("workout.col.prev").toUpperCase()}</AppText></View>
        {stacked ? null : (
          <>
            <View style={{ flex: 1 }}><AppText style={head}>{unitText.toUpperCase()}</AppText></View>
            <View style={{ flex: 1 }}><AppText style={head}>{(timed ? (ex.measure === "time" ? t("workout.col.sec") : t("workout.col.metres")) : t("workout.col.reps")).toUpperCase()}</AppText></View>
            {ex.trackEffort ? <View style={{ width: 52 }}><AppText style={head}>{t("workout.col.rir").toUpperCase()}</AppText></View> : null}
          </>
        )}
        <View style={colTick}><Icon name="check" color={p.muted} size={16} /></View>
      </View>

      {card?.decision.action === "stop" ? live : null}
      <View>
        {list.map((row, i) => (
          <React.Fragment key={row.key}>
            {card?.decision.action !== "stop" && card?.key === row.key ? live : null}
            <WorkoutSetRow key={row.key} ex={ex} row={row} label={numbering[i] ?? i + 1}
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
                  : isolateLtr(`${weightText(s.load, unit)} ${unitText} × ${s.reps}`)} · {timed ? t("workout.outlier.bodyTimed") : t("workout.outlier.body", { load: o?.expected ? fmt(o.expected.medianLoad) : "?", reps: o?.expected?.medianReps ?? "?" })}
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
              <AppText key={i} ltr style={{ fontSize: 16 }}>{fmt(w.load)} × {isolateLtr(String(w.reps))}</AppText>
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

      <View style={{ paddingHorizontal: space.md }}>
        <BigButton
          variant="secondary"
          icon="plus"
          label={t("workout.addSet")}
          onPress={() => onAddSet()}
          accessibilityHint={labels.primary}
        />
      </View>
    </View>
  );
}
