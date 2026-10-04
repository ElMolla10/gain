/**
 * What the build switches in build-flags.js / app.config.js (`expo.extra`) mean at run time. Pure: the caller passes `Constants.expoConfig?.extra`.
 * Unknown or missing values fall back to the ordinary sideload app with every template, never to a restricted one.
 */
export type Distribution = "sideload" | "play";

export interface BuildFlags {
  distribution: Distribution;
  /** Template ids a pilot build offers, or null for all of them. */
  pilotTemplateIds: readonly string[] | null;
}

export function readBuildFlags(extra: unknown): BuildFlags {
  const e = extra && typeof extra === "object" ? (extra as Record<string, unknown>) : {};
  const ids = Array.isArray(e.pilotTemplateIds) && e.pilotTemplateIds.length > 0 && e.pilotTemplateIds.every((x) => typeof x === "string") ? (e.pilotTemplateIds as string[]) : null;
  return { distribution: e.distribution === "play" ? "play" : "sideload", pilotTemplateIds: ids };
}

/**
 * The self-updater (Settings > Check for updates, the APK download and installer hand-off) exists only in the sideload build, and only on
 * Android: an iPhone cannot install an APK. `os` is `Platform.OS`; left out it means Android, which is how the APK builds have always behaved.
 */
export const hasSelfUpdater = (f: BuildFlags, os: string = "android"): boolean => f.distribution === "sideload" && os === "android";
