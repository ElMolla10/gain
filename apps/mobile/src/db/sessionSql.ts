/**
 * A finished session that has no logged set (everything deleted, or never ticked) is an EMPTY session. It stays in the database
 * (the lifter chose "Finish anyway") but it is not a workout: it must not appear in History, count in weekly numbers or the data
 * summary, or move the programme rotation. `alias` is the SQL alias of the session table in the query.
 */
export const hasLoggedSets = (alias: string): string =>
  `EXISTS (SELECT 1 FROM workout_set w_ne WHERE w_ne.session_id = ${alias}.id AND w_ne.deleted_at IS NULL AND w_ne.outlier_status <> 'rejected')`;
