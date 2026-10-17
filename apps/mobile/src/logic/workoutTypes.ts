import type { GymFingerprint, LineIdentity, LoggedSet, Proposal } from "@gain/engine";
import type { LoadSource } from "../db/exerciseGrid";
import type { Repos } from "../db/repos";
import type { TargetRow } from "../db/finishRepo";
import type { MilestoneSession } from "./personalProgress";
import type { Prefill } from "./workoutRows";

export type DayEx = Awaited<ReturnType<Repos["listDayExercises"]>>[number] & { loadSource?: LoadSource };
/** What is shown for one program slot today: the program's exercise, or the one swapped in for today. `slot` = the program's exercise id. */
export type Disp = DayEx & { slot: string };
export interface ExInfo {
  proposal: Proposal;
  personalHistory?: MilestoneSession[];
  line: LineIdentity;
  lineId: string;
  last: { performedAt: string; sets: LoggedSet[] } | null;
  /** Display history is independent of the comparable line used by the coach. */
  previous?: { any: ExInfo["last"]; routine: ExInfo["last"] };
  /** The target written when the previous workout was finished, if any. */
  stored: TargetRow | null;
  prefill: Prefill;
}

export interface LoadedWorkout {
  sessionId: string;
  resumed: boolean;
  startedAt: number;
  pausedMs: number;
  pausedAt: number | null;
  gym: GymFingerprint;
  slots: DayEx[];
  info: Record<string, ExInfo>;
}
