export interface Env {
  DB: D1Database;
  /** "1" = /v1/auth/email/start returns the code in the response instead of emailing it. Local development only. */
  DEV_EMAIL_CODES?: string;
  /** Secret. When set (with EMAIL_FROM) email codes are sent through Resend. */
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  /** Overrides the origin used in coach links (tests, custom domain). Defaults to the request origin. */
  PUBLIC_BASE_URL?: string;
  /** Maximum characters of synced data per account (default 25,000,000). A push that would go past it is refused with 413 quota_exceeded. */
  ACCOUNT_QUOTA_BYTES?: string;
  /** Kill switch. "1" = every endpoint except /health answers 503 service_paused. "writes" = reads still work (pull, coach views, /me) but new accounts, pushes and coach links are refused. Anything else = normal. */
  KILL_SWITCH?: string;
}

export class HttpError extends Error {
  constructor(public status: number, public code: string, public extra: Record<string, unknown> = {}) {
    super(code);
  }
}
