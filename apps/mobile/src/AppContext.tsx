import React, { createContext, useContext } from "react";
import type { Repos } from "./db/repos";
import type { Db } from "./db/driver";
import type { FinishRepo } from "./db/finishRepo";
import type { GoalRepo } from "./db/goalRepo";
import type { GymRepo } from "./db/gymRepo";
import type { ImportRepo } from "./db/importRepo";
import type { OnboardingRepo } from "./db/onboardingRepo";
import type { ProgrammeRepo } from "./db/programmeRepo";
import type { WorkoutRepo } from "./db/workoutRepo";

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
}
const Ctx = createContext<AppServices | null>(null);
export const ServicesProvider = Ctx.Provider;
export function useServices(): AppServices {
  const v = useContext(Ctx);
  if (!v) throw new Error("useServices outside provider");
  return v;
}
