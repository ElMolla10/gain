import React, { useEffect, useState } from "react";
import { useI18n } from "../../i18n";
import { clockText } from "../../logic/todayState";
import { elapsedMs } from "../../logic/workoutClock";
import { BigButton } from "../../ui";

/**
 * "Resume · 08:41 · 2 of 18 sets": the in-progress footer. The 1 Hz clock lives in this component only, so the screen never re-renders
 * for it (like RestClock). A paused workout shows its frozen time and stops ticking.
 */
export function ResumeFooter({ startedAt, pausedMs, pausedAt, saved, total, onPress, disabled }: { startedAt: number | null; pausedMs: number; pausedAt: number | null; saved: number; total: number; onPress: () => void; disabled?: boolean }) {
  const { t } = useI18n();
  const [now, setNow] = useState(() => Date.now());
  const ticking = startedAt !== null && pausedAt === null;
  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [ticking]);
  const label = startedAt === null ? t("today.resume") : t("today.resumeClock", { clock: clockText(elapsedMs(startedAt, pausedMs, pausedAt, now)), n: saved, total });
  return <BigButton hero label={label} disabled={disabled} loading={disabled} onPress={onPress} />;
}
