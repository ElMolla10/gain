import { describe, expect, it, vi } from "vitest";
import { sha256Hex } from "../src/util";
import { makeWorld } from "./harness";

// Test codes come from the mocked email transport, never the public API response.
const emailWorld = () => makeWorld({ RESEND_API_KEY: "re_test", EMAIL_FROM: "GAIN <no-reply@example.com>" });
function deliveredCode(w: ReturnType<typeof makeWorld>, email: string): string {
  const message = [...w.mail].reverse().find(mail => mail.to === email);
  if (!message) throw new Error("No email delivered");
  return /(\d{8})/.exec(message.body)![1]!;
}
async function startCode(w: ReturnType<typeof makeWorld>, email: string): Promise<string> {
  const response = await w.call("POST", "/v1/auth/email/start", { body: { email } });
  expect(response.status).toBe(202);
  expect(response.body).toEqual({ sent: true });
  return deliveredCode(w, email.toLowerCase().trim());
}

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

  it.each([{}, { RESEND_API_KEY: "re_test", EMAIL_FROM: "sender@example.com" }])("retired dev mode fails closed even with provider configuration: %j", async provider => {
    const w = makeWorld({ ...provider, DEV_EMAIL_CODES: "1" });
    const response = await w.call("POST", "/v1/auth/email/start", { body: { email: "me@example.com" }, headers: { host: "localhost", "x-forwarded-host": "127.0.0.1" } });
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ error: "unsafe_email_configuration" });
    expect(w.mail).toHaveLength(0);
    expect(w.db.raw.prepare("SELECT COUNT(*) AS n FROM email_code").get()).toMatchObject({ n: 0 });
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
    const w = emailWorld();
    await startCode(w, "a@b.co");
    const bad = deliveredCode(w, "a@b.co") === "00000000" ? "11111111" : "00000000";
    for (let i = 0; i < 5; i++) expect((await w.call("POST", "/v1/auth/email/verify", { body: { email: "a@b.co", code: bad } })).status).toBe(401);
    expect((await w.call("POST", "/v1/auth/email/verify", { body: { email: "a@b.co", code: deliveredCode(w, "a@b.co") } })).status).toBe(401);
    await startCode(w, "c@d.co");
    w.tick(11 * 60 * 1000);
    expect((await w.call("POST", "/v1/auth/email/verify", { body: { email: "c@d.co", code: deliveredCode(w, "c@d.co") } })).status).toBe(401);
  });

  it("signing in again with the same email returns the SAME account; linking to a second account is refused", async () => {
    const w = emailWorld();
    const code = (email: string) => startCode(w, email);
    const first = (await w.call("POST", "/v1/auth/email/verify", { body: { email: "m@x.co", code: await code("m@x.co") } })).body;
    const again = (await w.call("POST", "/v1/auth/email/verify", { body: { email: "m@x.co", code: await code("m@x.co") } })).body;
    expect(again.accountId).toBe(first.accountId);
    expect(again.recoveryCode).toBeUndefined();
    const other = await w.newAccount("3.3.3.3");
    const link = await w.call("POST", "/v1/auth/email/verify", { token: other.deviceToken, body: { email: "m@x.co", code: await code("m@x.co") } });
    expect(link.status).toBe(409);
  });

  it("an anonymous account can link an email, then sign in from another phone with it", async () => {
    const w = emailWorld();
    const a = await w.newAccount();
    const c1 = await startCode(w, "l@x.co");
    const link = await w.call("POST", "/v1/auth/email/verify", { token: a.deviceToken, body: { email: "l@x.co", code: c1 } });
    expect(link.body.linked).toBe(true);
    const c2 = await startCode(w, "l@x.co");
    const signin = await w.call("POST", "/v1/auth/email/verify", { body: { email: "l@x.co", code: c2 } });
    expect(signin.body.accountId).toBe(a.accountId);
  });

  it("emails are rate limited", async () => {
    const w = emailWorld();
    const st: number[] = [];
    for (let i = 0; i < 7; i++) st.push((await w.call("POST", "/v1/auth/email/start", { body: { email: "r@x.co" } })).status);
    expect(st).toEqual([202, 202, 202, 202, 202, 429, 429]);
  });

  it("bad addresses are 400", async () => {
    const w = emailWorld();
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

describe("auth races and rollback", () => {
  it("only one concurrent request can consume a valid email code", async () => {
    const w = emailWorld();
    await startCode(w, "race@example.com");
    const requests = await Promise.all([1, 2, 3].map(() => w.call("POST", "/v1/auth/email/verify", { body: { email: "race@example.com", code: deliveredCode(w, "race@example.com") } })));
    expect(requests.map(r => r.status).sort()).toEqual([200, 401, 401]);
    expect(w.db.raw.prepare("SELECT COUNT(*) AS n FROM device").get()).toMatchObject({ n: 1 });
  });
  it("rejects at the exact expiry boundary", async () => {
    const w = emailWorld();
    await startCode(w, "expires@example.com");
    w.tick(10 * 60 * 1000);
    expect((await w.call("POST", "/v1/auth/email/verify", { body: { email: "expires@example.com", code: deliveredCode(w, "expires@example.com") } })).status).toBe(401);
  });
  it("invalid bearer authentication does not burn a valid code", async () => {
    const w = emailWorld();
    await startCode(w, "link@example.com");
    const body = { email: "link@example.com", code: deliveredCode(w, "link@example.com") };
    expect((await w.call("POST", "/v1/auth/email/verify", { token: "not-a-valid-token", body })).status).toBe(401);
    expect((await w.call("POST", "/v1/auth/email/verify", { body })).status).toBe(200);
  });
  it("device insertion failure rolls back anonymous account creation", async () => {
    const w = makeWorld();
    w.db.raw.exec("CREATE TRIGGER reject_device BEFORE INSERT ON device BEGIN SELECT RAISE(ABORT, 'device write failed'); END");
    expect((await w.call("POST", "/v1/account", { body: {} })).status).toBe(500);
    expect(w.db.raw.prepare("SELECT COUNT(*) AS n FROM account").get()).toMatchObject({ n: 0 });
    expect(w.db.raw.prepare("SELECT COUNT(*) AS n FROM device").get()).toMatchObject({ n: 0 });
  });
});

it.each([true, false])("a stale verify does not consume or lock a replacement code (correct old code: %s)", async correct => {
  const w = emailWorld();
  const email = "replaced@example.com";
  await startCode(w, email);
  let release!: () => void, observed!: () => void;
  const gate = new Promise<void>(r => { release = r; });
  const read = new Promise<void>(r => { observed = r; });
  const prepare = w.db.prepare.bind(w.db);
  const spy = vi.spyOn(w.db, "prepare").mockImplementation(sql => {
    const statement = prepare(sql);
    if (!sql.startsWith("SELECT code_hash, expires_at, attempts")) return statement;
    return { ...statement, bind: (...args: unknown[]) => {
      const bound = statement.bind(...args);
      return { ...bound, first: async () => { const row = await bound.first(); observed(); await gate; return row; } } as D1PreparedStatement;
    } } as D1PreparedStatement;
  });
  const bad = deliveredCode(w, email) === "00000000" ? "11111111" : "00000000";
  const pending = w.call("POST", "/v1/auth/email/verify", { body: { email, code: correct ? deliveredCode(w, email) : bad } });
  await read;
  const replacement = deliveredCode(w, email) === "12345678" ? "87654321" : "12345678";
  w.db.raw.prepare("UPDATE email_code SET code_hash = ?, attempts = 0 WHERE email = ?").run(await sha256Hex(`${email}|${replacement}`), email);
  release();
  expect((await pending).status).toBe(401);
  spy.mockRestore();
  expect(w.db.raw.prepare("SELECT attempts FROM email_code WHERE email = ?").get(email)).toMatchObject({ attempts: 0 });
  expect((await w.call("POST", "/v1/auth/email/verify", { body: { email, code: replacement } })).status).toBe(200);
});
