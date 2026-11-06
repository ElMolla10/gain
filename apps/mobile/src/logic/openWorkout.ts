import type { Db } from "../db/driver";
import type { GymRepo } from "../db/gymRepo";
import type { Repos } from "../db/repos";
import type { WorkoutRepo } from "../db/workoutRepo";

/** Resume with the workout's own gym; changing the active gym only affects new sessions. */
export async function openWorkoutContext(dayId: string, deps: { db: Db; repos: Repos; workout: WorkoutRepo; gyms: GymRepo }) {
  const existing = await deps.db.get<{ gym_id: string }>(
    "SELECT gym_id FROM session WHERE programme_day_id = ? AND status IN ('planned','in_progress') AND deleted_at IS NULL",
    [dayId],
  );
  const gymId = existing ? existing.gym_id : await deps.repos.getActiveGymId();
  if (!gymId) {
    if (existing) throw new Error("Workout gym is unavailable");
    return null;
  }
  if (!(await deps.gyms.getGym(gymId))) throw new Error("Workout gym is unavailable");
  const opened = await deps.workout.startOrResumeSession(dayId, gymId);
  // The stored session is authoritative even if another async operation created it while opening.
  const session = await deps.workout.getSession(opened.id);
  if (!session || !(await deps.gyms.getGym(session.gym_id))) throw new Error("Workout gym is unavailable");
  return { ...opened, gym: await deps.repos.loadGymFingerprint(session.gym_id) };
}
