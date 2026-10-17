import React, { useRef, useState } from "react";
import { View } from "react-native";
import * as Sharing from "expo-sharing";
import { useI18n } from "../i18n";
import type { SessionSummary } from "../db/finishRepo";
import type { SessionDetail } from "../db/historyRepo";
import { improvementLines, personalBestLines, workoutRecapStats } from "../logic/workoutRecap";
import { AppText, BigButton, InlineStatus } from "../ui";
import { achievementPalette as p, space, type as ty } from "../theme";
import { diagnostics } from "../diagnostics";
import { formatDay } from "../logic/dateText";

/** The exact preview is captured locally. Native capture loads only when sharing is requested. */
export function AchievementCard({ detail, summary }: { detail: SessionDetail; summary: SessionSummary }) {
  const { t, lang, unit } = useI18n();
  const layout = useRef({ width: 0, height: 0 });
  const ref = useRef<View>(null); const lock = useRef(false);
  const [busy, setBusy] = useState(false); const [failed, setFailed] = useState(false); const [ready, setReady] = useState(false);
  const stats = workoutRecapStats(detail, summary);
  const lines = personalBestLines(summary, lang, unit);
  const highlights = (lines.length ? lines : improvementLines(summary, lang, unit)).slice(0, 3);
  const share = async () => {
    if (lock.current || !ref.current || !ready) return;
    lock.current = true; setBusy(true); setFailed(false);
    let uri: string | null = null;
    let release: ((uri: string) => void) | undefined;
    try {
      if (!await Sharing.isAvailableAsync()) throw new Error("Sharing unavailable");
      const { captureRef, releaseCapture } = await import("react-native-view-shot"); release = releaseCapture;
      uri = await captureRef(ref, { format: "png", result: "tmpfile", width: 1080, height: Math.round(1080 * layout.current.height / layout.current.width) });
      await Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png", dialogTitle: t("progress.share") });
    } catch (e) { diagnostics.record("warn", "share achievement", e); setFailed(true); }
    finally { if (uri) release?.(uri); lock.current = false; setBusy(false); }
  };
  if (summary.totals.counted === 0) return null;
  return <View style={{ gap: space.sm }}>
    <AppText accessibilityRole="header" style={{ fontWeight: "600" }}>{t("progress.cardPreview")}</AppText>
    <View ref={ref} collapsable={false} onLayout={event => { layout.current = event.nativeEvent.layout; setReady(layout.current.width > 0 && layout.current.height > 0); }} style={{ padding: 24, gap: 18, borderRadius: 24, backgroundColor: p.card, borderWidth: 1, borderColor: p.border }}>
      <AppText ltr style={{ color: p.accent, fontSize: ty.section, fontWeight: "700" }}>{t("app.name")}</AppText>
      <AppText style={{ color: p.text, fontSize: ty.title, fontWeight: "700" }}>{t("progress.cardTitle")}</AppText>
      <AppText style={{ color: p.muted }}>{formatDay(detail.finishedAt, lang)}</AppText>
      <AppText style={{ color: p.text, fontSize: ty.section }}>{stats.sets} {t("workout.stat.sets")} · {stats.exercises} {t("recap.exercises")}</AppText>
      {highlights.map((line, i) => <AppText key={i} style={{ color: p.accent, fontSize: ty.body }}>{line}</AppText>)}
      {!highlights.length ? <AppText style={{ color: p.muted }}>{t("progress.steady")}</AppText> : null}
      <AppText style={{ color: p.muted, fontSize: ty.caption }}>{t("progress.note")}</AppText>
    </View>
    <AppText>{t("progress.shareNote")}</AppText>
    <BigButton variant="secondary" icon="export" label={t("progress.share")} loading={busy} disabled={busy || !ready} onPress={() => void share()} />
    {failed ? <InlineStatus kind="error" text={t("recap.shareFailed")} /> : null}
  </View>;
}
