import * as authApi from "./auth";
import * as coachApi from "./coach";
import * as syncApi from "./sync";
import { HttpError, type Env } from "./types";
import { pruneRateLimits } from "./ratelimit";
import { json } from "./util";

/** Largest request body any endpoint accepts (a full push is at most 8 MB of JSON). Checked from Content-Length before anything is read. */
export const MAX_REQUEST_BYTES = 9 * 1024 * 1024;

export interface Deps {
  now: () => number;
  fetch: typeof fetch;
}

/** The whole API. `deps` lets tests control the clock and the email provider. */
export async function handle(req: Request, env: Env, deps: Deps): Promise<Response> {
  const now = deps.now();
  const url = new URL(req.url);
  const path = url.pathname;
  const m = req.method;
  try {
    if (path === "/health" && m === "GET") return json({ ok: true });

    // Kill switch (an env var the operator flips in the dashboard; no deploy needed): see docs/SYNC.md.
    const ks = env.KILL_SWITCH;
    if (ks === "1") throw new HttpError(503, "service_paused", {});
    if (ks === "writes" && m === "POST" && path !== "/v1/auth/recover" && path !== "/v1/auth/logout") throw new HttpError(503, "service_paused", {});
    if (Number(req.headers.get("content-length") ?? "0") > MAX_REQUEST_BYTES) throw new HttpError(413, "too_big");

    if (path === "/v1/account" && m === "POST") return await authApi.createAccount(req, env, now);
    if (path === "/v1/auth/recover" && m === "POST") return await authApi.recover(req, env, now);
    if (path === "/v1/auth/email/start" && m === "POST") return await authApi.emailStart(req, env, now, deps.fetch);
    if (path === "/v1/auth/email/verify" && m === "POST") return await authApi.emailVerify(req, env, now);

    const view = /^\/c\/([^/]+)$/.exec(path);
    if (view && m === "GET") return await coachApi.viewCard(req, env, view[1]!, now);

    const protectedRoute = path === "/v1/me" || path.startsWith("/v1/coach-links") || path === "/v1/auth/logout" || path === "/v1/account" || path.startsWith("/v1/sync/");
    if (protectedRoute) {
      const auth = await authApi.authenticate(req, env, now);
      if (path === "/v1/me" && m === "GET") return await authApi.me(auth, env);
      if (path === "/v1/auth/logout" && m === "POST") return await authApi.logout(auth, env);
      if (path === "/v1/account" && m === "DELETE") return await authApi.deleteAccount(auth, env);
      if (path === "/v1/sync/push" && m === "POST") return await syncApi.push(req, env, auth, now);
      if (path === "/v1/sync/pull" && m === "GET") return await syncApi.pull(req, env, auth, now);
      if (path === "/v1/sync/data" && m === "DELETE") return await syncApi.wipeData(env, auth);
      if (path === "/v1/coach-links" && m === "POST") return await coachApi.createLink(req, env, auth, now);
      if (path === "/v1/coach-links" && m === "GET") return await coachApi.listLinks(env, auth, now);
      const rev = /^\/v1\/coach-links\/([A-Za-z0-9-]{1,64})$/.exec(path);
      if (rev && m === "DELETE") return await coachApi.revokeLink(env, auth, rev[1]!, now);
    }
    return json({ error: "not_found" }, 404);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.code, ...e.extra }, e.status, e.status === 429 ? { "retry-after": "60" } : {});
    console.error("unhandled", e instanceof Error ? e.message : String(e));
    return json({ error: "server_error" }, 500);
  }
}

/** Daily housekeeping (cron trigger): expired coach links, finished rate-limit windows, expired sign-in codes, devices unused for over 400 days. */
export async function runMaintenance(env: Env, now: number): Promise<{ links: number; codes: number; devices: number }> {
  const day = 24 * 3600 * 1000;
  const links = await env.DB.prepare("DELETE FROM coach_link WHERE expires_at < ? OR (revoked_at IS NOT NULL AND revoked_at < ?)").bind(now - day, now - 30 * day).run();
  await pruneRateLimits(env.DB, now);
  const codes = await env.DB.prepare("DELETE FROM email_code WHERE expires_at < ?").bind(now - day).run();
  const devices = await env.DB.prepare("DELETE FROM device WHERE last_seen_at < ?").bind(now - 400 * day).run();
  return { links: links.meta?.changes ?? 0, codes: codes.meta?.changes ?? 0, devices: devices.meta?.changes ?? 0 };
}

export default {
  scheduled(_event: unknown, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }): void {
    ctx.waitUntil(runMaintenance(env, Date.now()));
  },
  fetch(req: Request, env: Env): Promise<Response> {
    return handle(req, env, { now: () => Date.now(), fetch });
  },
};
