import React from "react";
import { useI18n } from "../i18n";
import { isolateLtr } from "../i18n/format";
import type { StringKey } from "../i18n/strings";
import { diffExposure, goalLiftFrequency, type ExposureRow } from "../logic/exposure";
import type { ProgrammeDraft } from "../logic/programmeDraft";
import { space, usePalette } from "../theme";
import { AppText, Card } from "../ui";

const n = (x: number) => isolateLtr(String(x));
const signed = (x: number) => isolateLtr(`${x > 0 ? "+" : ""}${x}`);

/** Exposure per muscle group for a programme: observed arithmetic, never a judgement. */
export function ExposureView(props: { rows: ExposureRow[] }) {
  const { t } = useI18n();
  const p = usePalette();
  const weekly = props.rows.length > 0 && props.rows.every((r) => r.setsPerWeek !== null);
  return (
    <Card>
      <AppText style={{ fontWeight: "600" }}>{t("prog.exposure.title")}</AppText>
      <AppText style={{ color: p.muted, fontSize: 13 }}>{t("prog.exposure.note")}</AppText>
      {weekly ? <AppText style={{ color: p.muted, fontSize: 13 }}>{t("prog.perWeek")}</AppText> : <AppText style={{ color: p.muted, fontSize: 13 }}>{t("prog.exposure.unknown")}</AppText>}
      {props.rows.map((r) => (
        <AppText key={r.group}>
          {r.setsPerWeek !== null
            ? t("prog.exposure.row", { group: t(`muscle.${r.group}` as StringKey), sets: n(r.setsPerWeek), sessions: n(r.sessionsPerWeek ?? 0) })
            : t("prog.exposure.rowRotation", { group: t(`muscle.${r.group}` as StringKey), sets: n(r.setsPerRotation), sessions: n(r.daysPerRotation) })}
        </AppText>
      ))}
    </Card>
  );
}

/** What an edit changes: groups whose exposure moved, and goal lifts trained less often. */
export function EffectView(props: { before: ExposureRow[]; after: ExposureRow[]; beforeDraft: ProgrammeDraft; afterDraft: ProgrammeDraft; nameOf: (exerciseId: string) => string }) {
  const { t } = useI18n();
  const p = usePalette();
  const changes = diffExposure(props.before, props.after);
  const fb = goalLiftFrequency(props.beforeDraft);
  const fa = goalLiftFrequency(props.afterDraft);
  const goal = [...fb].filter(([id, c]) => (fa.get(id) ?? 0) < c);
  const num = (r: ExposureRow | null, which: "sets" | "sessions") => (r ? (which === "sets" ? (r.setsPerWeek ?? r.setsPerRotation) : (r.sessionsPerWeek ?? r.daysPerRotation)) : 0);
  return (
    <Card>
      <AppText style={{ fontWeight: "600" }}>{t("prog.effect.title")}</AppText>
      <AppText style={{ color: p.muted, fontSize: 13 }}>{t("prog.effect.note")}</AppText>
      {changes.length === 0 && goal.length === 0 ? <AppText>{t("prog.effect.none")}</AppText> : null}
      {changes.map((c) => {
        const group = t(`muscle.${c.group}` as StringKey);
        if (c.kind === "added") return <AppText key={c.group}>{t("prog.effect.added", { group, after: n(num(c.after, "sets")), sa: n(num(c.after, "sessions")) })}</AppText>;
        if (c.kind === "removed") return <AppText key={c.group}>{t("prog.effect.removed", { group, before: n(num(c.before, "sets")) })}</AppText>;
        return (
          <AppText key={c.group} style={{ fontWeight: "600" }}>
            {t(c.kind === "up" ? "prog.effect.up" : "prog.effect.down", {
              group,
              before: n(num(c.before, "sets")),
              after: n(num(c.after, "sets")),
              delta: signed(c.deltaSets),
              sb: n(num(c.before, "sessions")),
              sa: n(num(c.after, "sessions")),
            })}
          </AppText>
        );
      })}
      {goal.map(([id, c]) => (
        <AppText key={id} style={{ fontWeight: "600" }}>
          ⚠ {t("prog.effect.goal", { name: props.nameOf(id), before: n(c), after: n(fa.get(id) ?? 0) })}
        </AppText>
      ))}
    </Card>
  );
}
