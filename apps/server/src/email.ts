import type { Env } from "./types";
import { HttpError } from "./types";

export type EmailMode = "dev" | "sent";

/**
 * Delivers a sign-in code. Providers:
 *  - dev: DEV_EMAIL_CODES="1" -> nothing is sent, the caller returns the code in the API response (local development only).
 *  - Resend (https://resend.com): RESEND_API_KEY secret + EMAIL_FROM var. Not exercised against the real service yet (no key on file).
 * With neither configured the endpoint answers 501 `email_not_configured` and the app falls back to the recovery code.
 */
export async function sendSignInCode(env: Env, to: string, code: string, fetchFn: typeof fetch = fetch): Promise<EmailMode> {
  if (env.DEV_EMAIL_CODES === "1") return "dev";
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) throw new HttpError(501, "email_not_configured");
  const res = await fetchFn("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [to],
      subject: "Your GAIN sign-in code",
      text: `Your GAIN sign-in code is ${code}. It works for 10 minutes. If you did not ask for it, ignore this email.\n\nرمز الدخول إلى GAIN: ${code} (صالح لمدة 10 دقائق).`,
    }),
  });
  if (!res.ok) throw new HttpError(502, "email_send_failed");
  return "sent";
}
