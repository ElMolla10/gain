/** The ONLY place the sync layer touches the network. Tests pass a fake with the same shape. */
export const SYNC_BASE_URL = "https://gain-sync.elmolla10.workers.dev";

export interface TransportResponse {
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json: any;
}
export interface Transport {
  /** Rejects with TransportError when the request could not be completed (offline, DNS, timeout). Any HTTP status resolves. */
  request(method: "GET" | "POST" | "DELETE", path: string, opts?: { token?: string | null; body?: unknown }): Promise<TransportResponse>;
}

export class TransportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransportError";
  }
}

export function createFetchTransport(baseUrl: string = SYNC_BASE_URL, fetchFn: typeof fetch = fetch, timeoutMs = 20_000): Transport {
  return {
    async request(method, path, opts = {}) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), timeoutMs);
      try {
        const res = await fetchFn(baseUrl + path, {
          method,
          headers: { ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}), ...(opts.body !== undefined ? { "content-type": "application/json" } : {}) },
          body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
          signal: ctl.signal,
        });
        let json: unknown = null;
        try {
          json = await res.json();
        } catch {
          json = null;
        }
        return { status: res.status, json };
      } catch (e) {
        throw new TransportError(e instanceof Error ? e.message : String(e));
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
