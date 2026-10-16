import type { LineIdentity, LoggedSet, Proposal } from "@gain/engine";
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
  /** The target written when the previous workout was finished, if any. */
  stored: TargetRow | null;
  prefill: Prefill;
}
