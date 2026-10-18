/**
 * Why the app could not open the lifter's data at launch, in a form the boot screen can explain and the lifter can copy into a message.
 * Pure (no React Native), so it is unit-tested.
 */
export type BootStage = "open" | "backup" | "migrate" | "repos" | "settings";
export type BootFailureKind = "db_newer" | "failed";

export interface BootFailure {
  kind: BootFailureKind;
  /** Plain text for the copyable Details box: stage, error name/code and message, schema numbers when known, the first stack lines. */
  details: string;
}

export function bootFailure(stage: BootStage, err: unknown, extra?: { appSchema?: number; appVersion?: string; platform?: string }): BootFailure {
  const e = (err ?? {}) as { name?: unknown; message?: unknown; code?: unknown; from?: unknown; to?: unknown; stack?: unknown };
  const name = typeof e.name === "string" ? e.name : typeof err;
  const message = typeof e.message === "string" ? e.message : String(err);
  const code = e.code !== undefined && e.code !== null ? String(e.code) : null;
  const kind: BootFailureKind = code === "db_newer" ? "db_newer" : "failed";
  const lines = [`GAIN boot error`, `stage: ${stage}`, `error: ${name}${code ? ` [${code}]` : ""}: ${message}`];
  if (typeof e.from === "number" && typeof e.to === "number") lines.push(`data schema: v${e.from} · app schema: v${e.to}`);
  else if (extra?.appSchema !== undefined) lines.push(`app schema: v${extra.appSchema}`);
  if (extra?.appVersion) lines.push(`app: ${extra.appVersion}`);
  if (extra?.platform) lines.push(`platform: ${extra.platform}`);
  if (typeof e.stack === "string") {
    const stack = e.stack.split("\n").slice(1, 5).map((l) => l.trim()).filter(Boolean);
    if (stack.length) lines.push(...stack.map((l) => `  ${l}`));
  }
  return { kind, details: lines.join("\n") };
}
