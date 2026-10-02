import { randomUUID } from "node:crypto";
import type { Deps } from "../src/db/driver";
import { migrate } from "../src/db/migrations";
import { createGoalRepo } from "../src/db/goalRepo";
import { createGymRepo } from "../src/db/gymRepo";
import { createImportRepo } from "../src/db/importRepo";
import { createOnboardingRepo } from "../src/db/onboardingRepo";
import { createProgrammeRepo } from "../src/db/programmeRepo";
import { createRepos } from "../src/db/repos";
import { createFinishRepo } from "../src/db/finishRepo";
import { createShortWeekRepo } from "../src/db/shortWeekRepo";
import { createWeeklyRepo } from "../src/db/weeklyRepo";
import { createWorkoutRepo } from "../src/db/workoutRepo";
import { openNodeDb } from "./nodeDriver";

export function testDeps(start = 1_700_000_000_000): Deps & { tick: (ms?: number) => void } {
  let t = start;
  return { newId: () => randomUUID(), now: () => t, tick: (ms = 1000) => void (t += ms) };
}

export async function freshDb() {
  const db = openNodeDb();
  await migrate(db);
  const deps = testDeps();
  const repos = createRepos(db, deps);
  const workout = createWorkoutRepo(db, deps);
  const finish = createFinishRepo(db, deps, repos, workout);
  const gyms = createGymRepo(db, deps, repos, finish);
  const programmes = createProgrammeRepo(db, deps, repos, finish);
  const onboarding = createOnboardingRepo(db, deps, repos, gyms, programmes);
  const imports = createImportRepo(db, deps, repos, workout, programmes, finish);
  const goals = createGoalRepo(db, deps, repos);
  const weekly = createWeeklyRepo(db, deps, repos, goals);
  const shortWeek = createShortWeekRepo(db, deps, repos, programmes, goals);
  return { db, deps, repos, workout, finish, gyms, programmes, onboarding, imports, goals, weekly, shortWeek };
}
