import * as authApi from "./auth";
import * as syncApi from "./sync";
import { HttpError, type Env } from "./types";
import { json } from "./util";

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

    if (path === "/v1/account" && m === "POST") return await authApi.createAccount(req, env, now);
    if (path === "/v1/auth/recover" && m === "POST") return await authApi.recover(req, env, now);
    if (path === "/v1/auth/email/start" && m === "POST") return await authApi.emailStart(req, env, now, deps.fetch);
    if (path === "/v1/auth/email/verify" && m === "POST") return await authApi.emailVerify(req, env, now);

    const protectedRoute = path === "/v1/me" || path === "/v1/auth/logout" || path === "/v1/account" || path.startsWith("/v1/sync/");
    if (protectedRoute) {
      const auth = await authApi.authenticate(req, env, now);
      if (path === "/v1/me" && m === "GET") return await authApi.me(auth, env);
      if (path === "/v1/auth/logout" && m === "POST") return await authApi.logout(auth, env);
      if (path === "/v1/account" && m === "DELETE") return await authApi.deleteAccount(auth, env);
      if (path === "/v1/sync/push" && m === "POST") return await syncApi.push(req, env, auth, now);
      if (path === "/v1/sync/pull" && m === "GET") return await syncApi.pull(req, env, auth, now);
      if (path === "/v1/sync/data" && m === "DELETE") return await syncApi.wipeData(env, auth);
    }
    return json({ error: "not_found" }, 404);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.code, ...e.extra }, e.status, e.status === 429 ? { "retry-after": "60" } : {});
    console.error("unhandled", e instanceof Error ? e.message : String(e));
    return json({ error: "server_error" }, 500);
  }
}

export default {
  fetch(req: Request, env: Env): Promise<Response> {
    return handle(req, env, { now: () => Date.now(), fetch });
  },
};
