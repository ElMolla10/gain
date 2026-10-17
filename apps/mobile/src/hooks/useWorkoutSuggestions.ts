import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { expectationPenaltyReps, findSpec, orderAdjustedReps, readinessPenaltyReps, sessionOrderFatigue, type Decision, type ReadinessFlag } from "@gain/engine";
import { useServices } from "../AppContext";
import { useI18n } from "../i18n";
import { exerciseLabels } from "../i18n/format";
import { diagnostics } from "../diagnostics";
import type { ExerciseState, SetRow } from "../db/workoutRepo";
import type { LoadedWorkout, DayEx, Disp } from "../logic/workoutTypes";
import type { SetRowDraft } from "../logic/workoutRows";
import { applyExpectedReps, applyLiveTarget, liveContext, livePerformanceKey, tryLiveRecommendation, nextAdaptiveRow, trustedWorkingSet } from "../logic/liveAdaptation";
import { muscleGroupOf } from "../logic/muscleVolume";
import { evaluationPrediction } from "../logic/mlEvaluation";
import { orderSlots } from "../logic/superset";

/** Suggestions follow saved facts; cancellation prevents stale cards overwriting edits. */
export function useWorkoutSuggestions({ loaded, rows, setRows, sets, exState, makeDisp, readiness }: {
  loaded: LoadedWorkout | null | "nogym";
  rows: Record<string, SetRowDraft[]>;
  setRows: Dispatch<SetStateAction<Record<string, SetRowDraft[]>>>;
  sets: SetRow[]; exState: Record<string, ExerciseState>;
  makeDisp: (slot: DayEx, state?: ExerciseState) => Disp;
  readiness: ReadinessFlag | null;
}) {
  const { mlEvaluation } = useServices();
  const { lang } = useI18n();
  const [liveCards, setLiveCards] = useState<Record<string, { decision: Decision; key: string; performance: string; snapshot: string; fatigueKey: string; specKey: string; starting?: boolean }>>({});
  const [reportedSymptoms, setReportedSymptoms] = useState<Record<string, Decision>>({});
  const [liveDismissed, setLiveDismissed] = useState<Record<string, string>>({});
  const [liveManual, setLiveManual] = useState<Record<string, boolean>>({});

  // Run after persistence has refreshed `sets`. Cancelling the scheduled work prevents stale cards after edits or leaving.
  useEffect(() => {
    if (!loaded || loaded === "nogym") return;
    let cancelled = false;
    const handle = setTimeout(async () => {
      const cards: typeof liveCards = {};
      const rowUpdates: Record<string, { before: string; after: SetRowDraft[] }> = {};
      const supportedExerciseIds = loaded.slots
        .map(slot => makeDisp(slot, exState[slot.exerciseId]))
        .filter(ex => ex.measure === "reps" && ex.setup === "free" && ex.equipment !== "assisted")
        .map(ex => ex.exerciseId);
      const programmeIds = loaded.slots.filter((s) => !exState[s.exerciseId]?.added).map((s) => s.exerciseId);
      const order = orderSlots(programmeIds, exState);
      const fatigueSlots = order.flatMap((id) => {
        const slot = loaded.slots.find((x) => x.exerciseId === id);
        if (!slot || exState[id]?.removed) return [];
        const ex = makeDisp(slot, exState[id]);
        return [{
          exerciseId: ex.exerciseId,
          name: exerciseLabels(ex, lang).primary,
          muscle: muscleGroupOf({ seedKey: ex.seedKey ?? null, pattern: ex.pattern, equipment: ex.equipment }),
          done: sets.some((s) => s.exerciseId === ex.exerciseId && trustedWorkingSet(s)),
        }];
      });
      for (const slot of loaded.slots) {
        if (exState[slot.exerciseId]?.removed) continue;
        const ex = makeDisp(slot, exState[slot.exerciseId]);
        const list = rows[ex.exerciseId] ?? [];
        const performance = livePerformanceKey(sets, ex.exerciseId);
        if (liveDismissed[ex.exerciseId] === performance) continue;
        const fatigue = sessionOrderFatigue(fatigueSlots, ex.exerciseId);
        const readyPen = readinessPenaltyReps(readiness);
        const combinedPen = expectationPenaltyReps(fatigue?.penaltyReps ?? 0, readyPen);
        const fatigueKey = `${fatigue ? `${fatigue.earlierName}:${fatigue.penaltyReps}` : ""}:${readiness ?? ""}`;
        const reported = reportedSymptoms[ex.exerciseId];
        if (reported) {
          const specKey = JSON.stringify((ex.loadSpec ?? findSpec(loaded.gym, ex.equipment)) ?? null);
          cards[ex.exerciseId] = { decision: reported, key: nextAdaptiveRow(list)?.key ?? "", performance, snapshot: JSON.stringify(list), fatigueKey, specKey };
          continue;
        }
        const next = nextAdaptiveRow(list);
        const spec = ex.loadSpec ?? findSpec(loaded.gym, ex.equipment);
        const specKey = JSON.stringify(spec ?? null);
        const existing = liveCards[ex.exerciseId];
        const manual = !!liveManual[ex.exerciseId];
        // A target filled by this exact saved performance is still the same
        // recommendation. Do not feed it back into the model as new user input,
        // and keep it while the lifter types into the row (drafts are not logged sets).
        if (next && existing?.performance === performance && existing.key === next.key && existing.fatigueKey === fatigueKey && existing.specKey === specKey
            && (manual || (next.ghostLoad === existing.decision.suggestedWeightKg
            && next.ghostReps === existing.decision.suggestedReps))) {
          cards[ex.exerciseId] = { ...existing, snapshot: JSON.stringify(list) };
          continue;
        }
        const info = loaded.info[ex.exerciseId];
        // The suggestion follows logged sets only: the next row's half-typed draft never becomes the model's input.
        const logged = next ? list.map(r => r.key === next.key ? { ...r, load: null, reps: null } : r) : list;
        const context = liveContext({ exerciseId: ex.exerciseId, equipment: ex.equipment, setup: ex.setup, measure: ex.measure, sets, supportedExerciseIds, rows: logged, last: info?.last, targetReps: info?.prefill.reps ?? ex.repMax, sessionFatigueReps: combinedPen });
        if (!context) {
          let filled = list;
          const protect = info?.proposal.currency === "load";
          const expected = info?.prefill.reps != null ? orderAdjustedReps(info.prefill.reps, combinedPen, protect) : null;
          if (next && !manual && next.reps === null && expected != null) {
            filled = applyExpectedReps(list, next.key, expected);
            if (filled !== list) rowUpdates[ex.exerciseId] = { before: JSON.stringify(list), after: filled };
          }
          if (next && info?.prefill.load != null && info.prefill.load > 0 && ex.measure === "reps") {
            cards[ex.exerciseId] = {
              decision: { action: "maintain", suggestedWeightKg: info.prefill.load, suggestedReps: expected ?? info.prefill.reps ?? ex.repMin, predictedReps: expected ?? info.prefill.reps ?? 0, reason: "within_range", predictionAvailable: false },
              key: next.key, performance, snapshot: JSON.stringify(filled), fatigueKey, specKey, starting: true,
            };
          }
          continue;
        }
        const decision = tryLiveRecommendation(context, ex.repMin, ex.repMax, spec, undefined, e => diagnostics.record("warn", "live adaptation", e));
        if (decision) {
          const key = nextAdaptiveRow(list)!.key;
          const filled = decision.action === "stop" || manual ? list : applyLiveTarget(list, key, decision.suggestedWeightKg, decision.suggestedReps);
          cards[ex.exerciseId] = { decision, key, performance, snapshot: JSON.stringify(filled), fatigueKey, specKey };
          if (filled !== list) rowUpdates[ex.exerciseId] = { before: JSON.stringify(list), after: filled };
          const prediction = evaluationPrediction(loaded.sessionId, ex.exerciseId, list, sets, context, decision);
          if (prediction && !cancelled) {
            try { await mlEvaluation.record(prediction); }
            catch (e) { diagnostics.record("warn", "ML evaluation capture", e); }
          }
        }
      }
      if (!cancelled) {
        if (Object.keys(rowUpdates).length) setRows(current => {
          let changed = false;
          const nextRows = { ...current };
          for (const [exerciseId, update] of Object.entries(rowUpdates)) {
            if (JSON.stringify(current[exerciseId] ?? []) !== update.before) continue;
            nextRows[exerciseId] = update.after;
            changed = true;
          }
          return changed ? nextRows : current;
        });
        setLiveCards(cards);
      }
    }, 0);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [loaded, rows, sets, exState, liveDismissed, liveManual, reportedSymptoms, makeDisp, mlEvaluation, lang, readiness]);


  return { liveCards, reportedSymptoms, setReportedSymptoms, liveDismissed, setLiveDismissed, liveManual, setLiveManual };
}
