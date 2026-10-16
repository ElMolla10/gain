import type { LineIdentity, LoggedSet, Proposal } from "@gain/engine";
import type { Repos } from "../db/repos";
import type { TargetRow } from "../db/finishRepo";
import type { Prefill } from "./workoutRows";

export type DayEx = Awaited<ReturnType<Repos["listDayExercises"]>>[number];
/** What is shown for one program slot today: the program's exercise, or the one swapped in for today. `slot` = the program's exercise id. */
export type Disp = DayEx & { slot: string };
export interface ExInfo {
  proposal: Proposal;
  line: LineIdentity;
  lineId: string;
  last: { performedAt: string; sets: LoggedSet[] } | null;
  /** The target written when the previous workout was finished, if any. */
  stored: TargetRow | null;
  prefill: Prefill;
}
