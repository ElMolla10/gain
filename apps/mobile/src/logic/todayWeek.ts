/**
 * Today's "This week" block (spec §0 row 5), pure. The pace glyph mirrors with the reading direction (except ◌ and ✓, which have no
 * direction); exactly ONE decision card is chosen by priority: weekly review > deload offer > active weekly plan > periodization.
 */
import type { PaceStatus } from "@gain/engine";
import type { Lang } from "../i18n/format";

const GLYPHS: Record<PaceStatus, [string, string]> = {
  ahead: ["↗", "↖"],
  on_pace: ["→", "←"],
  behind: ["↘", "↙"],
  too_thin: ["◌", "◌"],
  reached: ["✓", "✓"],
};
export const paceGlyph = (status: PaceStatus, lang: Lang): string => GLYPHS[status][lang === "ar" ? 1 : 0];

export type WeekDecision = "weekly" | "deload" | "planActive" | "periodization";

/** The one card shown. Periodization is last because it decides for itself whether it is due (its card renders nothing otherwise). */
export function pickDecision(input: { weeklyDue: boolean; deloadStatus: string | null; planActive: boolean }): WeekDecision {
  if (input.weeklyDue) return "weekly";
  if (input.deloadStatus === "suggested") return "deload";
  if (input.planActive) return "planActive";
  return "periodization";
}
