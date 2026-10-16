import { renderReason, type DecisionInputs, type GymLoadSpec, type Locale, type ReasonText } from "@gain/engine";
import { isolateLtr } from "../i18n/format";
import { quantityText } from "./quantity";
import { loadsSummaryText } from "./exerciseLoads";
import { localizeReason, unitLabel, weightText, type Unit } from "./units";

export interface DecisionPayload {
  proposal: {
    load: number | null;
    reps: number | null;
    /** Time / distance exercises: the target seconds / metres (reps is null). Absent in decisions stored before v0.13. */
    durationS?: number | null;
    distanceM?: number | null;
    currency: string;
    jumpKind: string | null;
    confidence: string;
    reason: ReasonText;
    warnings: string[];
    needsModel: { needed: boolean; reasons: string[] };
    targetRir: number | null;
    quality: string | null;
  };
  inputs: DecisionInputs;
}

export interface WhySection {
  title: string;
  lines: string[];
}

export type WhyAction = "increase" | "maintain" | "decrease" | "stop" | "load" | "reps" | "effort" | "quality" | "none";
export type WhyPosition = "early" | "late";
export interface WhyTrigger {
  load: number;
  reps: number;
  rir?: number | null;
}
export interface WhyWeightInput {
  trigger?: WhyTrigger | null;
  position?: WhyPosition | null;
  action: WhyAction;
  loadSpec?: GymLoadSpec | null;
  loadSource?: "line" | "exercise" | "gym";
  experimental?: boolean;
  missing?: string[];
}

/** First 1–2 working sets of this exercise are early; 3rd and later are late. Unknown (no index) is omitted. */
export function sessionPosition(workingSetsBefore: number | null | undefined): WhyPosition | null {
  if (workingSetsBefore == null || !Number.isFinite(workingSetsBefore)) return null;
  return workingSetsBefore <= 1 ? "early" : "late";
}

/**
 * One short sentence plus the triggering set: last logged load × reps, session position when known,
 * maintain / increase / decrease, and the gym or machine loads that were considered. No feature vectors.
 */
export function describeWhyWeight(
  input: WhyWeightInput,
  L: (k: string, params?: Record<string, string | number>) => string,
  locale: Locale,
  unit: Unit = "kg",
): { sentence: string; details: string[] } {
  const W = (kg: number): string => `${weightText(kg, unit)} ${unitLabel(unit, locale)}`;
  const parts: string[] = [];
  if (input.trigger && input.trigger.load > 0 && input.trigger.reps > 0) {
    let set = L("why.weight.after", { set: isolateLtr(`${W(input.trigger.load)} × ${input.trigger.reps}`) });
    if (input.trigger.rir != null) set += L("why.weight.effort", { effort: String(input.trigger.rir) });
    if (input.position) set += L(`why.weight.${input.position}`);
    parts.push(set);
  }
  parts.push(L(`why.weight.action.${input.action}`));
  if (input.loadSpec) {
    const what = loadsSummaryText(input.loadSpec, unit, unitLabel(unit, locale), L);
    parts.push(L(input.loadSource === "line" ? "why.weight.loads.line" : input.loadSource === "exercise" ? "why.weight.loads.own" : "why.weight.loads.gym", { what }));
  } else {
    parts.push(L(input.loadSource === "gym" ? "why.weight.loads.gymDefault" : "why.weight.loads.unknown"));
  }
  const sentence = parts.join(L("why.weight.join"));
  const details: string[] = [];
  if (input.experimental) {
    details.push(L("why.weight.experimental"));
    if (input.missing && input.missing.length > 0) details.push(L("why.weight.missing", { what: input.missing.join(L("why.weight.missing.join")) }));
  }
  return { sentence, details };
}

function actionFromCurrency(currency: string): WhyAction {
  if (currency === "load" || currency === "reps" || currency === "effort" || currency === "quality" || currency === "none") return currency;
  return "none";
}

function triggerFromInputs(i: DecisionInputs): WhyTrigger | null {
  const s = i.sessions[0];
  if (!s) return null;
  const reps = i.policy.trigger.repsBasis === "best_set" ? (s.bestRepsAtTop ?? s.repsAtTop) : s.repsAtTop;
  return { load: s.topLoad, reps, rir: s.rir };
}

/** "Why this weight?": the logged inputs, as plain facts. Observed numbers first, then the rule's reading of them. Not a chatbot paragraph. */
export function describeDecision(
  payload: DecisionPayload,
  meta: { ruleVersion: string; path: string },
  L: (k: string, params?: Record<string, string | number>) => string,
  locale: Locale,
  unit: Unit = "kg",
): WhySection[] {
  /** A kilogram weight as "62.5 kg" / "137.8 lb" in the lifter's unit. The engine and the stored decision stay in kilograms. */
  const W = (kg: number): string => `${weightText(kg, unit)} ${unitLabel(unit, locale)}`;
  const { proposal: p, inputs: i } = payload;
  const compact = describeWhyWeight(
    {
      trigger: triggerFromInputs(i),
      action: actionFromCurrency(p.currency),
      loadSpec: i.gym.loadSpec ?? null,
      loadSource: i.gym.loadSource ?? (i.gym.loadSpec ? "exercise" : "gym"),
    },
    L,
    locale,
    unit,
  );
  const out: WhySection[] = [];
  out.push({ title: L("why.sentence"), lines: [compact.sentence, renderReason(localizeReason(p.reason, unit, locale), locale), ...compact.details] });

  out.push({
    title: L("why.observed"),
    lines:
      i.sessions.length === 0
        ? [L("why.noSessions")]
        : i.sessions.map((s) =>
            i.measure === "time" || i.measure === "distance"
              ? L(s.topLoad > 0 ? "why.sessionTimed" : "why.sessionTimedBare", { date: s.performedAt.slice(0, 10), load: W(s.topLoad), q: quantityText(s.repsAtTop, i.measure, { s: L("qty.s"), m: L("qty.m") }), sets: s.setsAtTop })
              : L(i.policy.trigger.repsBasis === "best_set" ? "why.sessionBest" : "why.session", {
              date: s.performedAt.slice(0, 10),
              load: W(s.topLoad),
              reps: i.policy.trigger.repsBasis === "best_set" ? (s.bestRepsAtTop ?? s.repsAtTop) : s.repsAtTop,
              sets: s.setsAtTop,
              effort: s.rir === null ? L("why.effortNone") : String(s.rir),
            }),
          ),
  });

  const g = i.gym;
  const gymLines: string[] = [];
  // Where the grid comes from, never implied: the lifter's own weights for this exercise, or the standard steps (a typical set, not a measurement).
  // Decisions stored before v0.21.0 have no `loadSource` and show the standard-steps line like any default one.
  if (g.loadSource === "line" && g.loadSpec) gymLines.push(L("why.loads.line", { what: loadsSummaryText(g.loadSpec, unit, unitLabel(unit, locale), L) }));
  else if (g.loadSource === "exercise" && g.loadSpec) gymLines.push(L("why.loads.own", { what: loadsSummaryText(g.loadSpec, unit, unitLabel(unit, locale), L) }));
  else if (g.anchorLoad !== null || g.nextHarderLoad !== null || g.nextEasierLoad !== null) gymLines.push(L("why.loads.gym"));
  if (g.anchorLoad !== null) gymLines.push(L("why.anchor", { load: W(g.anchorLoad), onGym: g.anchorOnGymLoads ? L("why.yes") : L("why.no") }));
  gymLines.push(g.nextHarderLoad !== null ? L("why.nextLoad", { load: W(g.nextHarderLoad), jump: W(g.jump ?? 0) }) : L("why.noNextLoad"));
  if (g.jumpTooBig !== null) {
    const pct = Math.round((g.jumpRatio ?? 0) * 1000) / 10;
    const max = Math.round(g.maxJumpRatio * 100);
    // An oversized real step that was proposed anyway (default `oversizedStep: load`) is explained as such, not as "other ways come first".
    const key = !g.jumpTooBig ? "why.jumpSmall" : p.currency === "load" ? "why.jumpBigTaken" : "why.jumpBig";
    gymLines.push(L(key, { pct, max }));
  }
  out.push({ title: L("why.gym"), lines: gymLines });

  const x = i.excluded;
  out.push({
    title: L("why.excluded"),
    lines: [L("why.excludedCounts", { warmups: x.warmupSets, drops: x.dropSets, unconfirmed: x.unconfirmedOutlierSets, other: x.incomparableSessions })],
  });

  const ruleLines = [
    L("why.currency", { currency: L(`why.currency.${p.currency}`) }),
    L("why.confidence", { confidence: L(`why.confidence.${p.confidence}`), factors: i.confidenceFactors.join(", ") || "-" }),
    L("why.ruleVersion", { version: meta.ruleVersion, path: meta.path }),
    L("why.range", { min: i.repRange.min, max: i.repRange.max }),
  ];
  // Say where the top of the range comes from, never silently (rule-v0.4). Decisions stored before rule-v0.4 have no `repTopBasis`: they always used a
  // ceiling (the lift's own or the GAIN default), shown as before when it differed from the program's top.
  const pr = i.programmeRepRange;
  const reps = i.measure !== "time" && i.measure !== "distance";
  if (reps && i.repTopBasis === "program") {
    ruleLines.push(L("range.why.program", { pmin: pr?.min ?? i.repRange.min, max: i.repRange.max, gain: i.gainCeiling ?? i.repRange.max }));
  } else if (reps && i.repTopBasis === "no_upper_bound") {
    ruleLines.push(L("range.why.noTop", { max: i.repRange.max }));
  } else if (reps && i.repTopBasis === "gain_setting") {
    ruleLines.push(L("range.why.setting", { pmin: pr?.min ?? i.repRange.min, pmax: pr?.max ?? i.repRange.max, max: i.repRange.max }));
  } else if (reps && i.repTopBasis === "lift") {
    ruleLines.push(L("range.why", { pmin: pr?.min ?? i.repRange.min, pmax: pr?.max ?? i.repRange.max, max: i.repRange.max, source: L("range.src.lift") }));
  } else if (reps && pr && pr.max !== i.repRange.max) {
    ruleLines.push(L("range.why", { pmin: pr.min, pmax: pr.max ?? i.repRange.max, max: i.repRange.max, source: L(i.policy.ceilingSource === "lift" ? "range.src.lift" : "range.src.default") }));
  }
  if (i.trackEffort) ruleLines.push(L("why.effortTracked"));
  if (p.needsModel.needed) ruleLines.push(L("why.needsModel"));
  if (i.measure === undefined || i.measure === "reps") ruleLines.push(i.policy.trigger.repsBasis === "best_set" ? L("why.oneSetNote") : L("why.weakestNote", { n: i.readiness.requiredSetsAtTop ?? 1 }));
  if (i.topSets !== undefined && i.policy.trigger.repsBasis !== "best_set" && (i.measure === undefined || i.measure === "reps")) ruleLines.push(L("why.topSets", { n: i.topSets }));
  for (const w of p.warnings) ruleLines.push(L(`why.warning.${w}`));
  out.push({ title: L("why.rule"), lines: ruleLines });

  if (i.rejections.length > 0) {
    out.push({
      title: L("why.rejections"),
      lines: i.rejections.map((r) => L("why.rejection", { kind: r.jumpKind, count: r.count, blocked: r.blocked ? L("why.blocked") : L("why.notBlocked") })),
    });
  }
  return out;
}

/**
 * Like `describeDecision`, but a stored decision from an older (or newer) rule version whose inputs this build cannot
 * read still shows something true: the stored sentence, the rule version and path, and a note. It never throws.
 */
export function describeDecisionSafe(
  payload: DecisionPayload | null | undefined,
  meta: { ruleVersion: string; path: string; reason: ReasonText },
  L: (k: string, params?: Record<string, string | number>) => string,
  locale: Locale,
  unit: Unit = "kg",
): WhySection[] {
  try {
    if (payload) return describeDecision(payload, { ruleVersion: meta.ruleVersion, path: meta.path }, L, locale, unit);
  } catch {
    // fall through to the stored-sentence view
  }
  let sentence: string;
  try {
    sentence = renderReason(localizeReason(meta.reason, unit, locale), locale);
  } catch {
    sentence = meta.reason.key;
  }
  return [
    { title: L("why.sentence"), lines: [sentence] },
    { title: L("why.rule"), lines: [L("why.ruleVersion", { version: meta.ruleVersion, path: meta.path }), L("why.oldFormat")] },
  ];
}
