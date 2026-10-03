import { describe, expect, it } from "vitest";
import { makeWorld } from "./harness";

describe("anonymous accounts and recovery", () => {
  it("creates an account, never stores the token or recovery code in plain", async () => {
    const w = makeWorld();
    const a = await w.newAccount();
    expect(a.deviceToken.length).toBeGreaterThanOrEqual(40);
    expect(a.recoveryCode).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){4}$/);
    const dump = JSON.stringify([w.db.raw.prepare("SELECT * FROM account").all(), w.db.raw.prepare("SELECT * FROM device").all()]);
    expect(dump).not.toContain(a.deviceToken);
    expect(dump).not.toContain(a.recoveryCode);
    const me = await w.call("GET", "/v1/me", { token: a.deviceToken });
    expect(me.status).toBe(200);
    expect(me.body.accountId).toBe(a.accountId);
  });

  it("a new phone signs in with the recovery code (any case, with or without dashes) and sees the same account", async () => {
    const w = makeWorld();
    const a = await w.newAccount();
    for (const form of [a.recoveryCode, a.recoveryCode.toLowerCase(), a.recoveryCode.replace(/-/g, " ")]) {
      const r = await w.call("POST", "/v1/auth/recover", { body: { recoveryCode: form, label: "new phone" } });
      expect(r.status).toBe(200);
      expect(r.body.accountId).toBe(a.accountId);
      expect(r.body.deviceToken).not.toBe(a.deviceToken);
    }
    expect((await w.call("GET", "/v1/me", { token: a.deviceToken })).body.devices).toBe(4);
  });

  it("a wrong recovery code is refused and attempts are rate limited per address", async () => {
    const w = makeWorld();
    await w.newAccount();
    const codes: number[] = [];
    for (let i = 0; i < 12; i++) codes.push((await w.call("POST", "/v1/auth/recover", { body: { recoveryCode: "AAAA-BBBB-CCCC-DDDD-EEEE" } })).status);
    expect(codes.slice(0, 10).every((c) => c === 401)).toBe(true);
    expect(codes.slice(10)).toEqual([429, 429]);
    // another address is not affected
    expect((await w.call("POST", "/v1/auth/recover", { body: { recoveryCode: "AAAA-BBBB-CCCC-DDDD-EEEE" }, ip: "9.9.9.9" })).status).toBe(401);
  });

  it("account creation is rate limited per address", async () => {
    const w = makeWorld();
    let blocked = 0;
    for (let i = 0; i < 22; i++) if ((await w.call("POST", "/v1/account", { body: {} })).status === 429) blocked++;
    expect(blocked).toBe(2);
  });

  it("logout kills only that phone's token", async () => {
    const w = makeWorld();
    const a = await w.newAccount();
    const b = (await w.call("POST", "/v1/auth/recover", { body: { recoveryCode: a.recoveryCode } })).body as { deviceToken: string };
    expect((await w.call("POST", "/v1/auth/logout", { token: a.deviceToken })).status).toBe(200);
    expect((await w.call("GET", "/v1/me", { token: a.deviceToken })).status).toBe(401);
    expect((await w.call("GET", "/v1/me", { token: b.deviceToken })).status).toBe(200);
  });
});

describe("email sign-in (optional)", () => {
  it("answers 501 email_not_configured when no provider is set, and stores no code", async () => {
    const w = makeWorld();
    const r = await w.call("POST", "/v1/auth/email/start", { body: { email: "a@b.co" } });
    expect(r.status).toBe(501);
    expect(r.body.error).toBe("email_not_configured");
    expect((w.db.raw.prepare("SELECT COUNT(*) AS n FROM email_code").get() as { n: number }).n).toBe(0);
  });

  it("dev mode returns the code in the response (never enabled in wrangler.toml)", async () => {
    const w = makeWorld({ DEV_EMAIL_CODES: "1" });
    const r = await w.call("POST", "/v1/auth/email/start", { body: { email: "Me@Example.com " } });
    expect(r.status).toBe(202);
    expect(r.body.devCode).toMatch(/^\d{8}$/);
    const v = await w.call("POST", "/v1/auth/email/verify", { body: { email: "me@example.com", code: r.body.devCode } });
    expect(v.status).toBe(200);
    expect(v.body.deviceToken).toBeTruthy();
    expect(v.body.recoveryCode).toBeTruthy(); // first use creates the account
  });

  it("the deployed config never has dev codes on", async () => {
    const { readFileSync } = await import("node:fs");
    const toml = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
    expect(toml).toMatch(/DEV_EMAIL_CODES = "0"/);
  });

  it("with a provider key the code goes by email (mocked Resend), not in the response", async () => {
    const w = makeWorld({ RESEND_API_KEY: "re_test", EMAIL_FROM: "GAIN <no-reply@example.com>" });
    const r = await w.call("POST", "/v1/auth/email/start", { body: { email: "x@y.co" } });
    expect(r.status).toBe(202);
    expect(r.body).toEqual({ sent: true });
    expect(w.mail).toHaveLength(1);
    expect(w.mail[0]!.to).toBe("x@y.co");
    const code = /(\d{8})/.exec(w.mail[0]!.body)![1]!;
    const v = await w.call("POST", "/v1/auth/email/verify", { body: { email: "x@y.co", code } });
    expect(v.status).toBe(200);
    // one use only
    expect((await w.call("POST", "/v1/auth/email/verify", { body: { email: "x@y.co", code } })).status).toBe(401);
  });

  it("wrong codes lock the code after 5 tries; codes expire after 10 minutes", async () => {
    const w = makeWorld({ DEV_EMAIL_CODES: "1" });
    const s = await w.call("POST", "/v1/auth/email/start", { body: { email: "a@b.co" } });
    const bad = s.body.devCode === "00000000" ? "11111111" : "00000000";
    for (let i = 0; i < 5; i++) expect((await w.call("POST", "/v1/auth/email/verify", { body: { email: "a@b.co", code: bad } })).status).toBe(401);
    expect((await w.call("POST", "/v1/auth/email/verify", { body: { email: "a@b.co", code: s.body.devCode } })).status).toBe(401);
    const s2 = await w.call("POST", "/v1/auth/email/start", { body: { email: "c@d.co" } });
    w.tick(11 * 60 * 1000);
    expect((await w.call("POST", "/v1/auth/email/verify", { body: { email: "c@d.co", code: s2.body.devCode } })).status).toBe(401);
  });

  it("signing in again with the same email returns the SAME account; linking to a second account is refused", async () => {
    const w = makeWorld({ DEV_EMAIL_CODES: "1" });
    const code = async (email: string) => (await w.call("POST", "/v1/auth/email/start", { body: { email } })).body.devCode as string;
    const first = (await w.call("POST", "/v1/auth/email/verify", { body: { email: "m@x.co", code: await code("m@x.co") } })).body;
    const again = (await w.call("POST", "/v1/auth/email/verify", { body: { email: "m@x.co", code: await code("m@x.co") } })).body;
    expect(again.accountId).toBe(first.accountId);
    expect(again.recoveryCode).toBeUndefined();
    const other = await w.newAccount("3.3.3.3");
    const link = await w.call("POST", "/v1/auth/email/verify", { token: other.deviceToken, body: { email: "m@x.co", code: await code("m@x.co") } });
    expect(link.status).toBe(409);
  });

  it("an anonymous account can link an email, then sign in from another phone with it", async () => {
    const w = makeWorld({ DEV_EMAIL_CODES: "1" });
    const a = await w.newAccount();
    const c1 = (await w.call("POST", "/v1/auth/email/start", { body: { email: "l@x.co" } })).body.devCode;
    const link = await w.call("POST", "/v1/auth/email/verify", { token: a.deviceToken, body: { email: "l@x.co", code: c1 } });
    expect(link.body.linked).toBe(true);
    const c2 = (await w.call("POST", "/v1/auth/email/start", { body: { email: "l@x.co" } })).body.devCode;
    const signin = await w.call("POST", "/v1/auth/email/verify", { body: { email: "l@x.co", code: c2 } });
    expect(signin.body.accountId).toBe(a.accountId);
  });

  it("emails are rate limited", async () => {
    const w = makeWorld({ DEV_EMAIL_CODES: "1" });
    const st: number[] = [];
    for (let i = 0; i < 7; i++) st.push((await w.call("POST", "/v1/auth/email/start", { body: { email: "r@x.co" } })).status);
    expect(st).toEqual([202, 202, 202, 202, 202, 429, 429]);
  });

  it("bad addresses are 400", async () => {
    const w = makeWorld({ DEV_EMAIL_CODES: "1" });
    expect((await w.call("POST", "/v1/auth/email/start", { body: { email: "nope" } })).status).toBe(400);
  });
});

describe("misc", () => {
  it("unknown routes are 404 json and health works", async () => {
    const w = makeWorld();
    expect((await w.call("GET", "/health")).status).toBe(200);
    expect((await w.call("GET", "/nope")).status).toBe(404);
    expect((await w.call("PUT", "/v1/sync/push", { token: (await w.newAccount()).deviceToken })).status).toBe(404);
  });
});
