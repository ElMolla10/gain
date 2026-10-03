/**
 * Check for updates (v0.8.0): ask GitHub's public releases API for the newest release (pre-releases included), compare it with the
 * installed version, and describe what to download. Pure apart from the injected `fetch`, so every outcome is tested without a phone.
 * Nothing is installed from here: the screen downloads, checks the SHA-256 and hands the file to Android's own installer.
 */

export const RELEASES_URL = "https://api.github.com/repos/ElMolla10/gain/releases?per_page=30";

export interface Version {
  major: number;
  minor: number;
  patch: number;
  /** Text after "-" (e.g. "rc.1"); empty for a plain release. */
  pre: string;
}

/** "v0.8.0", "0.8.0", "0.8.0-rc.1" -> parts; null for anything else. */
export function parseVersion(s: string | null | undefined): Version | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec((s ?? "").trim());
  return m ? { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]), pre: m[4] ?? "" } : null;
}

/** Negative when a < b. A plain release is newer than its own pre-release tag (0.8.0 > 0.8.0-rc.1). */
export function compareVersions(a: Version, b: Version): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;
  if (a.pre === b.pre) return 0;
  if (a.pre === "") return 1;
  if (b.pre === "") return -1;
  return a.pre < b.pre ? -1 : 1;
}

export interface GithubAsset {
  name: string;
  browser_download_url: string;
  size?: number;
  /** "sha256:<hex>", present on newer GitHub releases. */
  digest?: string | null;
}
export interface GithubRelease {
  tag_name: string;
  name?: string | null;
  body?: string | null;
  draft?: boolean;
  prerelease?: boolean;
  assets?: GithubAsset[];
}

const APK_NAME = /^gain-v\d+\.\d+\.\d+.*-arm64\.apk$/;

/** The newest published (non-draft) release by version number. Pre-releases count: every GAIN release so far is one. */
export function newestRelease(releases: GithubRelease[]): { release: GithubRelease; version: Version } | null {
  let best: { release: GithubRelease; version: Version } | null = null;
  for (const r of releases) {
    if (!r || r.draft) continue;
    const v = parseVersion(r.tag_name);
    if (!v) continue;
    if (!best || compareVersions(v, best.version) > 0) best = { release: r, version: v };
  }
  return best;
}

export const apkAsset = (r: GithubRelease): GithubAsset | null => (r.assets ?? []).find((a) => APK_NAME.test(a.name) && /^https:\/\//.test(a.browser_download_url)) ?? null;

const HEX64 = /\b([0-9a-fA-F]{64})\b/;

/**
 * The SHA-256 the release promises for this APK: GitHub's own asset digest when present, else the hash written in the release notes
 * ("SHA-256 of the APK (gain-v0.8.0-arm64.apk): <hex>"). Null when neither exists (the screen then says it could not verify).
 */
export function expectedSha256(release: GithubRelease, asset: GithubAsset): string | null {
  const d = /^sha256:([0-9a-fA-F]{64})$/.exec(asset.digest ?? "");
  if (d) return d[1]!.toLowerCase();
  for (const line of (release.body ?? "").split(/\r?\n/)) {
    if (!/sha-?256/i.test(line) && !line.includes(asset.name)) continue;
    const m = HEX64.exec(line);
    if (m) return m[1]!.toLowerCase();
  }
  return null;
}

export const toHex = (buf: ArrayBuffer): string => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");

export const shaMatches = (actualHex: string, expectedHex: string): boolean => actualHex.trim().toLowerCase() === expectedHex.trim().toLowerCase();

export type UpdateFailure = "offline" | "rate_limited" | "http" | "bad_response" | "no_apk";

export type UpdateResult =
  | { kind: "up_to_date"; installed: string; latest: string }
  | { kind: "available"; installed: string; version: string; tag: string; notes: string; assetName: string; url: string; size: number | null; sha256: string | null; prerelease: boolean }
  | { kind: "error"; reason: UpdateFailure; status?: number };

/** Release notes can be long; the screen shows the start. Windows line ends are normalised. */
export const trimNotes = (body: string | null | undefined, max = 1500): string => {
  const s = (body ?? "").replace(/\r\n/g, "\n").trim();
  return s.length > max ? `${s.slice(0, max).trimEnd()}…` : s;
};

export type FetchLike = (url: string, init?: { headers?: Record<string, string>; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

/** Ask GitHub and decide. Never throws: offline, rate limit, bad data and a missing APK are each a named result. */
export async function checkForUpdate(installedVersion: string, doFetch: FetchLike, timeoutMs = 15_000): Promise<UpdateResult> {
  const installed = parseVersion(installedVersion);
  const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
  try {
    const res = await doFetch(RELEASES_URL, { headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }, signal: ctl?.signal });
    if (!res.ok) return { kind: "error", reason: res.status === 403 || res.status === 429 ? "rate_limited" : "http", status: res.status };
    const data = await res.json();
    if (!Array.isArray(data)) return { kind: "error", reason: "bad_response" };
    const newest = newestRelease(data as GithubRelease[]);
    if (!newest) return { kind: "error", reason: "bad_response" };
    const latestText = `${newest.version.major}.${newest.version.minor}.${newest.version.patch}${newest.version.pre ? `-${newest.version.pre}` : ""}`;
    if (installed && compareVersions(newest.version, installed) <= 0) return { kind: "up_to_date", installed: installedVersion, latest: latestText };
    const asset = apkAsset(newest.release);
    if (!asset) return { kind: "error", reason: "no_apk" };
    return {
      kind: "available",
      installed: installedVersion,
      version: latestText,
      tag: newest.release.tag_name,
      notes: trimNotes(newest.release.body),
      assetName: asset.name,
      url: asset.browser_download_url,
      size: typeof asset.size === "number" ? asset.size : null,
      sha256: expectedSha256(newest.release, asset),
      prerelease: !!newest.release.prerelease,
    };
  } catch {
    // fetch rejects when there is no network (or the request timed out).
    return { kind: "error", reason: "offline" };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
