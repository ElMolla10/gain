import { isTrustedWorkingSet, type HistorySession, type SetupType } from "@gain/engine";

/** GAIN's personal exercise path. These are gains over the first saved session, not population percentiles. */
export const PATH_TIERS = [
  { score: 100, name: "origin" },
  { score: 110, name: "builder" },
  { score: 120, name: "climber" },
  { score: 135, name: "drive" },
  { score: 150, name: "ascent" },
  { score: 175, name: "summit" },
  { score: 200, name: "beyond" },
] as const;

export interface SessionStrength { at: number; strength: number }

/** The best valid set in the first session anchors the path. Later improvements never move that baseline. */
export function pathFromSessionStrengths(sessions: readonly SessionStrength[]) {
  const valid = sessions.filter(s => Number.isFinite(s.at) && Number.isFinite(s.strength) && s.strength > 0)
    .sort((a, b) => a.at - b.at);
  if (!valid.length) return null;
  const baseline = valid[0]!.strength;
  const best = Math.max(...valid.map(s => s.strength));
  const score = Math.floor(100 * best / baseline + 1e-7);
  const tier = [...PATH_TIERS].reverse().find(t => score >= t.score)!;
  const next = PATH_TIERS.find(t => t.score > score) ?? null;
  const progress = next ? Math.max(0, Math.min(1, (score - tier.score) / (next.score - tier.score))) : 1;
  return { baseline, best, score, tier: tier.name, next: next?.name ?? null, nextScore: next?.score ?? null, progress };
}

/** Only comparable free-weight working sets of 1–12 reps; bodyweight and assisted lines need their own measure. */
export function exercisePath(sessions: readonly HistorySession[], setup: SetupType) {
  if (setup !== "free") return null;
  const bySession = sessions.map(session => {
    const at = Date.parse(session.performedAt);
    const strength = Math.max(0, ...session.sets
      .filter(s => isTrustedWorkingSet(s) && s.load > 0 && Number.isFinite(s.load) && Number.isInteger(s.reps) && s.reps >= 1 && s.reps <= 12)
      .map(s => s.reps === 1 ? s.load : s.load * (1 + s.reps / 30)));
    return { at, strength };
  });
  return pathFromSessionStrengths(bySession);
}
