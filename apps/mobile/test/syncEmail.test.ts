import { describe, expect, it } from "vitest";
import { createSyncEngine } from "../src/sync/engine";
import type { Transport } from "../src/sync/transport";
import { freshDb } from "./helpers";

function transport(handlers: Record<string, (opts?: { token?: string | null; body?: unknown }) => { status: number; json: unknown }>): Transport {
  return {
    request: async (method, path, opts) => {
      const fn = handlers[`${method} ${path}`] ?? handlers[`${method} ${path.split("?")[0]}`];
      if (!fn) return { status: 404, json: { error: "missing" } };
      return fn(opts);
    },
  };
}

describe("optional email account", () => {
  it("creates an account from an emailed code, shows the recovery code once, and keeps local data on sign-out", async () => {
    const c = await freshDb();
    await c.repos.setSetting("onboarding_state", "done");
    const t = transport({
      "POST /v1/auth/email/start": () => ({ status: 202, json: { sent: true } }),
      "POST /v1/auth/email/verify": () => ({ status: 200, json: { accountId: "acc-e", deviceToken: "tok-e", recoveryCode: "REC-ONCE" } }),
      "GET /v1/me": () => ({ status: 200, json: { rows: 0 } }),
      "POST /v1/sync/push": (opts) => {
        const events = (opts?.body as { events?: { eventId: string }[] })?.events ?? [];
        return { status: 200, json: { results: events.map((e) => ({ eventId: e.eventId, status: "applied" })), head: events.length } };
      },
      "GET /v1/sync/pull": () => ({ status: 200, json: { rows: [], next: 0, hasMore: false, head: 0 } }),
      "POST /v1/auth/logout": () => ({ status: 200, json: { ok: true } }),
    });
    const sync = createSyncEngine(c.db, c.deps, t);
    expect((await sync.startEmail("me@x.co")).ok).toBe(true);
    const v = await sync.verifyEmail({ email: "me@x.co", code: "12345678" });
    expect(v).toMatchObject({ ok: true, needsChoice: false, recoveryCode: "REC-ONCE" });
    expect(await sync.status()).toBe("on");
    expect((await sync.getInfo()).email).toBe("me@x.co");
    expect(await sync.getRecoveryCode()).toBe("REC-ONCE");
    const s = await sync.syncNow();
    expect(s.ok).toBe(true);
    expect((await sync.disconnect({ deleteServerData: false })).ok).toBe(true);
    expect(await sync.status()).toBe("off");
    expect(await c.repos.getSetting("onboarding_state")).toBe("done");
  });

  it("maps email errors without blocking local data", async () => {
    const c = await freshDb();
    const t = transport({
      "POST /v1/auth/email/start": () => ({ status: 501, json: { error: "email_not_configured" } }),
      "POST /v1/auth/email/verify": () => ({ status: 401, json: { error: "bad_code" } }),
    });
    const sync = createSyncEngine(c.db, c.deps, t);
    expect(await sync.startEmail("a@b.co")).toEqual({ ok: false, error: "email_not_configured" });
    expect(await sync.verifyEmail({ email: "a@b.co", code: "00000000" })).toEqual({ ok: false, error: "bad_code" });
    expect(await sync.status()).toBe("off");
  });
});
