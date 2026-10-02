import { renderReason, type DecisionInputs, type Locale, type ReasonText } from "@gain/engine";
import { localizeReason, unitLabel, weightText, type Unit } from "./units";

export interface DecisionPayload {
  proposal: {
    load: number | null;
    reps: number | null;
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
  const out: WhySection[] = [];
  out.push({ title: L("why.sentence"), lines: [renderReason(localizeReason(p.reason, unit, locale), locale)] });

  out.push({
    title: L("why.observed"),
    lines:
      i.sessions.length === 0
        ? [L("why.noSessions")]
        : i.sessions.map((s) =>
            L("why.session", {
              date: s.performedAt.slice(0, 10),
              load: W(s.topLoad),
              reps: s.repsAtTop,
              sets: s.setsAtTop,
              effort: s.rir === null ? L("why.effortNone") : String(s.rir),
            }),
          ),
  });

  const g = i.gym;
  const gymLines: string[] = [];
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
  if (i.trackEffort) ruleLines.push(L("why.effortTracked"));
  if (p.needsModel.needed) ruleLines.push(L("why.needsModel"));
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
