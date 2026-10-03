import React, { useEffect, useState } from "react";
import { useServices } from "../AppContext";
import { SaveStatus } from "../ui";

/**
 * "Saved on this phone" is always true once a set or workout is written (SQLite is the source of truth). "Backup synced" appears only
 * when Back up and sync is ON and the server has acknowledged everything written up to `since`. Checked locally (no network call here):
 * the sync itself is started elsewhere. Re-checked a few times because the quiet sync after a workout finishes a moment later.
 */
export function SaveStatusLine({ since }: { since: number }) {
  const { sync } = useServices();
  const [state, setState] = useState<"synced" | "pending" | "failed" | null>(null);
  useEffect(() => {
    let alive = true;
    let tries = 0;
    const check = async () => {
      try {
        const info = await sync.getInfo();
        if (!alive) return;
        if (info.status !== "on") return setState(null);
        const caughtUp = info.lastSyncAt !== null && info.lastSyncAt >= since && info.pendingOut === 0;
        setState(caughtUp ? "synced" : info.lastError ? "failed" : "pending");
        if (caughtUp) return;
      } catch {
        if (alive) setState(null);
      }
      if (alive && ++tries < 6) timer = setTimeout(check, 2500);
    };
    let timer = setTimeout(check, 400);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [sync, since]);
  return <SaveStatus synced={state} />;
}
