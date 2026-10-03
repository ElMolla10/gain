import { describe, expect, it } from "vitest";
import { apkAsset, checkForUpdate, compareVersions, expectedSha256, newestRelease, parseVersion, shaMatches, toHex, trimNotes, type FetchLike, type GithubRelease } from "../src/logic/updateCheck";

const HEX = "396c6c90f218103f8d14884a9b3e27eccb8950b467ccdf00ae42a276dc6c310e";
const rel = (tag: string, extra: Partial<GithubRelease> = {}): GithubRelease => ({
  tag_name: tag,
  prerelease: true,
  body: `GAIN ${tag}\n\nSHA-256 of the APK (gain-${tag}-arm64.apk): ${HEX}\n\nWhat is new...`,
  assets: [{ name: `gain-${tag}-arm64.apk`, browser_download_url: `https://github.com/ElMolla10/gain/releases/download/${tag}/gain-${tag}-arm64.apk`, size: 33_000_000 }],
  ...extra,
});
const ok = (data: unknown): FetchLike => async () => ({ ok: true, status: 200, json: async () => data });

describe("versions", () => {
  it("parses tags and versions, rejects junk", () => {
    expect(parseVersion("v0.8.0")).toEqual({ major: 0, minor: 8, patch: 0, pre: "" });
    expect(parseVersion("0.10.2-rc.1")).toEqual({ major: 0, minor: 10, patch: 2, pre: "rc.1" });
    expect(parseVersion("latest")).toBeNull();
    expect(parseVersion("1.2")).toBeNull();
    expect(parseVersion(null)).toBeNull();
  });
  it("compares numerically (0.10.0 > 0.9.0), and a plain release beats its pre-release", () => {
    const c = (a: string, b: string) => Math.sign(compareVersions(parseVersion(a)!, parseVersion(b)!));
    expect(c("0.10.0", "0.9.9")).toBe(1);
    expect(c("0.8.0", "0.8.0")).toBe(0);
    expect(c("0.7.0", "0.8.0")).toBe(-1);
    expect(c("0.8.0", "0.8.0-rc.1")).toBe(1);
    expect(c("1.0.0", "0.99.99")).toBe(1);
  });
  it("newest release ignores drafts and unparsable tags; pre-releases count", () => {
    const n = newestRelease([rel("v0.7.0"), rel("v0.9.0", { draft: true }), rel("nightly"), rel("v0.8.0")]);
    expect(n?.release.tag_name).toBe("v0.8.0");
    expect(newestRelease([])).toBeNull();
  });
});

describe("the APK and its hash", () => {
  it("finds the arm64 APK asset over https only", () => {
    expect(apkAsset(rel("v0.8.0"))!.name).toBe("gain-v0.8.0-arm64.apk");
    expect(apkAsset(rel("v0.8.0", { assets: [{ name: "notes.txt", browser_download_url: "https://x/y" }] }))).toBeNull();
    expect(apkAsset(rel("v0.8.0", { assets: [{ name: "gain-v0.8.0-arm64.apk", browser_download_url: "http://insecure/x.apk" }] }))).toBeNull();
  });
  it("takes the SHA-256 from GitHub's digest, else the release notes; null when neither", () => {
    const r = rel("v0.8.0");
    expect(expectedSha256(r, r.assets![0]!)).toBe(HEX);
    const withDigest = { ...r.assets![0]!, digest: `sha256:${"A".repeat(64)}` };
    expect(expectedSha256({ ...r, body: "" }, withDigest)).toBe("a".repeat(64));
    expect(expectedSha256({ ...r, body: "no hash here" }, r.assets![0]!)).toBeNull();
    expect(expectedSha256({ ...r, body: `commit ${"b".repeat(64)} unrelated` }, r.assets![0]!)).toBeNull();
  });
  it("compares hashes case-insensitively and renders bytes as hex", () => {
    expect(shaMatches(HEX.toUpperCase(), HEX)).toBe(true);
    expect(shaMatches(HEX, "0".repeat(64))).toBe(false);
    expect(toHex(new Uint8Array([0, 15, 255]).buffer)).toBe("000fff");
  });
  it("trims long notes", () => {
    expect(trimNotes("a\r\nb")).toBe("a\nb");
    expect(trimNotes("x".repeat(2000), 100)).toHaveLength(101);
  });
});

describe("checkForUpdate", () => {
  it("says up to date when the newest release is the installed one or older", async () => {
    expect(await checkForUpdate("0.8.0", ok([rel("v0.8.0"), rel("v0.7.0")]))).toEqual({ kind: "up_to_date", installed: "0.8.0", latest: "0.8.0" });
    expect(await checkForUpdate("0.9.0", ok([rel("v0.8.0")]))).toMatchObject({ kind: "up_to_date" });
  });
  it("offers a newer release with version, notes, url and verified hash", async () => {
    const r = await checkForUpdate("0.8.0", ok([rel("v0.8.0"), rel("v0.9.0"), rel("v0.7.0")]));
    expect(r).toMatchObject({ kind: "available", version: "0.9.0", tag: "v0.9.0", assetName: "gain-v0.9.0-arm64.apk", sha256: HEX, size: 33_000_000, prerelease: true });
    if (r.kind === "available") {
      expect(r.url).toMatch(/^https:\/\/github\.com\/ElMolla10\/gain\/releases\/download\/v0\.9\.0\//);
      expect(r.notes).toContain("What is new");
    }
  });
  it("offers the update but without a hash when the notes carry none", async () => {
    const r = await checkForUpdate("0.7.0", ok([rel("v0.8.0", { body: "just notes" })]));
    expect(r).toMatchObject({ kind: "available", sha256: null });
  });
  it("names each failure instead of throwing", async () => {
    expect(await checkForUpdate("0.8.0", async () => { throw new TypeError("Network request failed"); })).toEqual({ kind: "error", reason: "offline" });
    expect(await checkForUpdate("0.8.0", async () => ({ ok: false, status: 403, json: async () => ({}) }))).toEqual({ kind: "error", reason: "rate_limited", status: 403 });
    expect(await checkForUpdate("0.8.0", async () => ({ ok: false, status: 500, json: async () => ({}) }))).toEqual({ kind: "error", reason: "http", status: 500 });
    expect(await checkForUpdate("0.8.0", ok({ message: "nope" }))).toEqual({ kind: "error", reason: "bad_response" });
    expect(await checkForUpdate("0.8.0", ok([]))).toEqual({ kind: "error", reason: "bad_response" });
    expect(await checkForUpdate("0.7.0", ok([rel("v0.8.0", { assets: [] })]))).toEqual({ kind: "error", reason: "no_apk" });
  });
  it("a request that never answers times out as offline", async () => {
    const hang: FetchLike = (_u, init) => new Promise((_res, rej) => init?.signal?.addEventListener("abort", () => rej(new Error("aborted"))));
    expect(await checkForUpdate("0.8.0", hang, 20)).toEqual({ kind: "error", reason: "offline" });
  });
  it("asks the public releases endpoint with no token", async () => {
    let seen: { url: string; headers?: Record<string, string> } | null = null;
    await checkForUpdate("0.8.0", async (url, init) => { seen = { url, headers: init?.headers }; return { ok: true, status: 200, json: async () => [] }; });
    expect(seen!.url).toBe("https://api.github.com/repos/ElMolla10/gain/releases?per_page=30");
    expect(Object.keys(seen!.headers ?? {}).map((k) => k.toLowerCase())).not.toContain("authorization");
  });
});
