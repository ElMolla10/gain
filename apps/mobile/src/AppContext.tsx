import React, { createContext, useContext } from "react";
import type { Repos } from "./db/repos";
import type { Db } from "./db/driver";
import type { FinishRepo } from "./db/finishRepo";
import type { GymRepo } from "./db/gymRepo";
import type { WorkoutRepo } from "./db/workoutRepo";

export interface AppServices {
  db: Db;
  repos: Repos;
  workout: WorkoutRepo;
  finish: FinishRepo;
  gyms: GymRepo;
}
const Ctx = createContext<AppServices | null>(null);
export const ServicesProvider = Ctx.Provider;
export function useServices(): AppServices {
  const v = useContext(Ctx);
  if (!v) throw new Error("useServices outside provider");
  return v;
}
