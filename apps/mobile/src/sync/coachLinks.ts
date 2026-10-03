import type { CoachCardPayload } from "@gain/sync";
import type { SyncEngine, SyncError } from "./engine";

/** Private coach-card links (Step 22). Uploads ONE card the lifter chose to share; the link is a snapshot, not live data. */
export interface CoachLink {
  id: string;
  createdAt: number;
  expiresAt: number;
  revokedAt: number | null;
  views: number;
  active: boolean;
}
export type CoachResult<T> = ({ ok: true } & T) | { ok: false; error: SyncError | "too_many_links" | "bad_card"; detail?: string };

export function createCoachLinks(engine: SyncEngine) {
  async function create(card: CoachCardPayload, expiresInDays = 7, label?: string): Promise<CoachResult<{ url: string; id: string; expiresAt: number }>> {
    const acct = await engine.ensureAccount(label);
    if (!acct.ok) return acct;
    const res = await engine.api("POST", "/v1/coach-links", { card, expiresInDays });
    if ("error" in res) {
      if (res.error === "bad_response" && res.detail?.includes("too_many_links")) return { ok: false, error: "too_many_links" };
      if (res.error === "bad_response" && res.detail?.includes("bad_card")) return { ok: false, error: "bad_card" };
      return { ok: false, error: res.error, detail: res.detail };
    }
    const j = res.json as { url?: string; id?: string; expiresAt?: number };
    if (!j?.url || !j.id || typeof j.expiresAt !== "number") return { ok: false, error: "bad_response" };
    return { ok: true, url: j.url, id: j.id, expiresAt: j.expiresAt };
  }
  async function list(): Promise<CoachResult<{ links: CoachLink[] }>> {
    if (!(await engine.token())) return { ok: true, links: [] };
    const res = await engine.api("GET", "/v1/coach-links");
    if ("error" in res) return { ok: false, error: res.error, detail: res.detail };
    return { ok: true, links: ((res.json as { links?: CoachLink[] })?.links ?? []) as CoachLink[] };
  }
  async function revoke(id: string): Promise<CoachResult<object>> {
    const res = await engine.api("DELETE", `/v1/coach-links/${encodeURIComponent(id)}`);
    if ("error" in res) return { ok: false, error: res.error, detail: res.detail };
    return { ok: true };
  }
  return { create, list, revoke };
}
export type CoachLinks = ReturnType<typeof createCoachLinks>;
