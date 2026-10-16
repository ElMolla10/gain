import React, { useCallback, useState } from "react";
import { weekStartOf, type MuscleVolumeRow } from "@gain/engine";
import { useFocusEffect } from "@react-navigation/native";
import { useServices } from "../AppContext";
import { isolateLtr } from "../i18n/format";
import { useI18n } from "../i18n";
import type { StringKey } from "../i18n/strings";
import { parseMusclePriorities, rankOf } from "../logic/musclePriority";
import { muscleVolumeRows } from "../logic/muscleVolume";
import { AppText, Card } from "../ui";

/** Completed trusted working sets this week vs the program (or default) range, per muscle. */
export function MuscleVolumeCard() {
  const { history, programmes, repos } = useServices();
  const { t } = useI18n();
  const [rows, setRows] = useState<MuscleVolumeRow[]>([]);
  const [priorities, setPriorities] = useState(parseMusclePriorities(null));

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void (async () => {
        const tz = -new Date().getTimezoneOffset() * 60_000;
        const raw = await repos.getSetting("week_starts_on");
        const v = raw === null || raw === "" ? Number.NaN : Number(raw);
        const startsOn = Number.isInteger(v) && v >= 0 && v <= 6 ? v : 1;
        const weekStart = weekStartOf(Date.now() + tz, startsOn);
        const from = Date.parse(`${weekStart}T00:00:00.000Z`) - tz;
        const sets = await history.weekExerciseSets(from, from + 7 * 86_400_000);
        const active = await programmes.getActive();
        const planned = active ? await programmes.exposureOf(await programmes.loadDraft(active.versionId)) : [];
        const rankRaw = await repos.getSetting("muscle_priorities");
        if (alive) {
          setRows(muscleVolumeRows(sets, planned));
          setPriorities(parseMusclePriorities(rankRaw));
        }
      })().catch(() => alive && setRows([]));
      return () => {
        alive = false;
      };
    }, [history, programmes, repos]),
  );

  if (rows.length === 0) return null;
  return (
    <Card>
      <AppText style={{ fontWeight: "600" }}>{t("volume.title")}</AppText>
      {rows.map((r) => {
        const rank = rankOf(priorities, r.group);
        return (
          <AppText key={r.group}>
            {t("volume.row", { muscle: t(`muscle.${r.group}` as StringKey), done: isolateLtr(String(r.completed)), min: isolateLtr(String(r.min)), max: isolateLtr(String(r.max)) })}
            {rank !== "normal" ? ` · ${t(`coach.rank.${rank}` as StringKey)}` : ""}
          </AppText>
        );
      })}
    </Card>
  );
}
