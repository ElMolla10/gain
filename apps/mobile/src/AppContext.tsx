import type { Reminders } from "./logic/reminders";
import React, { createContext, useContext } from "react";
import type { Repos } from "./db/repos";
import type { Db } from "./db/driver";
import type { RestAlerts } from "./logic/restAlert";
import type { DataRepo } from "./db/dataRepo";
import type { DecisionRepo } from "./db/decisionRepo";
import type { FinishRepo } from "./db/finishRepo";
import type { GoalRepo } from "./db/goalRepo";
import type { GymRepo } from "./db/gymRepo";
import type { HistoryRepo } from "./db/historyRepo";
import type { ImportRepo } from "./db/importRepo";
import type { OnboardingRepo } from "./db/onboardingRepo";
import type { RejectionRepo } from "./db/rejectionRepo";
import type { ProgrammeRepo } from "./db/programmeRepo";
import type { ShortWeekRepo } from "./db/shortWeekRepo";
import type { WeeklyRepo } from "./db/weeklyRepo";
import type { WorkoutRepo } from "./db/workoutRepo";
import type { CoachLinks } from "./sync/coachLinks";
import type { SyncEngine } from "./sync/engine";

export interface AppServices {
  db: Db;
  repos: Repos;
  workout: WorkoutRepo;
  finish: FinishRepo;
  gyms: GymRepo;
  programmes: ProgrammeRepo;
  onboarding: OnboardingRepo;
  imports: ImportRepo;
  goals: GoalRepo;
  weekly: WeeklyRepo;
  shortWeek: ShortWeekRepo;
  rejections: RejectionRepo;
  history: HistoryRepo;
  decisions: DecisionRepo;
  data: DataRepo;
  restAlerts: RestAlerts;
  reminders: Reminders;
  /** Opt-in backup/sync and coach links. Nothing here touches the network until the lifter turns it on or taps Share as a link. */
  sync: SyncEngine;
  coachLinks: CoachLinks;
  /** Sync quietly when it is on (throttled); a no-op when it is off. */
  autoSync: (force?: boolean) => void;
  /** Reload everything from the database (after a restore or delete-all) without restarting the process. */
  restart: () => void;
}
const Ctx = createContext<AppServices | null>(null);
export const ServicesProvider = Ctx.Provider;
export function useServices(): AppServices {
  const v = useContext(Ctx);
  if (!v) throw new Error("useServices outside provider");
  return v;
}
