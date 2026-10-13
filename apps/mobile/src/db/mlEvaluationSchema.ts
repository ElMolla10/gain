// Local only: deliberately absent from SYNC_TABLES. Triggers run atomically with workout writes,
// including writes from history/sync, so a crash cannot leave a stale successful evaluation.
const invalidate = `state = 'invalid', invalid_reason = 'edited'`;
const eligible = `NEW.deleted_at IS NULL AND NEW.is_warmup = 0 AND NEW.duration_s IS NULL AND NEW.distance_m IS NULL
  AND EXISTS (SELECT 1 FROM session s WHERE s.id = NEW.session_id AND s.deleted_at IS NULL AND s.status IN ('in_progress','finished'))
  AND NEW.load > 0 AND NEW.reps > 0 AND NEW.outlier_status IN ('none','confirmed')
  AND NOT EXISTS (SELECT 1 FROM json_each(NEW.tags_json) WHERE value IN ('drop','failure'))
  AND EXISTS (SELECT 1 FROM exercise e JOIN exercise_line l ON l.exercise_id = e.id
    WHERE e.id = NEW.exercise_id AND l.id = NEW.line_id AND e.measure = 'reps' AND l.setup = 'free' AND e.equipment != 'assisted')`;
const match = `UPDATE ml_prediction SET state = 'evaluated', actual_reps = NEW.reps,
  signed_error = NEW.reps - predicted_reps, absolute_error = ABS(NEW.reps - predicted_reps),
  within_one = ABS(NEW.reps - predicted_reps) <= 1, within_two = ABS(NEW.reps - predicted_reps) <= 2,
  evaluated_at = NEW.updated_at
  WHERE target_set_id = NEW.id AND session_id = NEW.session_id AND exercise_id = NEW.exercise_id
    AND state = 'pending' AND proposed_weight = NEW.load AND ${eligible};`;
const reject = `UPDATE ml_prediction SET state = 'invalid', invalid_reason = CASE
    WHEN proposed_weight != NEW.load THEN 'weight_changed' ELSE 'ineligible' END
  WHERE target_set_id = NEW.id AND state = 'pending'
    AND (session_id != NEW.session_id OR exercise_id != NEW.exercise_id OR proposed_weight != NEW.load
      OR NEW.deleted_at IS NOT NULL OR NEW.is_warmup != 0 OR NEW.duration_s IS NOT NULL OR NEW.distance_m IS NOT NULL
      OR NEW.outlier_status = 'rejected' OR NEW.load <= 0 OR NEW.reps <= 0
      OR NOT EXISTS (SELECT 1 FROM exercise e JOIN exercise_line l ON l.exercise_id = e.id
        WHERE e.id = NEW.exercise_id AND l.id = NEW.line_id AND e.measure = 'reps' AND l.setup = 'free' AND e.equipment != 'assisted')
      OR EXISTS (SELECT 1 FROM json_each(NEW.tags_json) WHERE value IN ('drop','failure')));`;
const changed = `NEW.load IS NOT OLD.load OR NEW.reps IS NOT OLD.reps OR NEW.is_warmup IS NOT OLD.is_warmup
  OR NEW.tags_json IS NOT OLD.tags_json OR NEW.duration_s IS NOT OLD.duration_s OR NEW.distance_m IS NOT OLD.distance_m
  OR NEW.session_id IS NOT OLD.session_id OR NEW.exercise_id IS NOT OLD.exercise_id OR NEW.line_id IS NOT OLD.line_id
  OR NEW.deleted_at IS NOT OLD.deleted_at`;

export const ML_EVALUATION_SQL = `
CREATE TABLE ml_prediction (
  id TEXT PRIMARY KEY,
  model_version TEXT NOT NULL,
  session_id TEXT NOT NULL REFERENCES session(id),
  exercise_id TEXT NOT NULL REFERENCES exercise(id),
  target_set_id TEXT NOT NULL,
  predicted_reps REAL NOT NULL CHECK (predicted_reps >= 0 AND predicted_reps <= 50),
  proposed_weight REAL NOT NULL CHECK (proposed_weight > 0),
  features_json TEXT NOT NULL CHECK (json_valid(features_json)),
  source_set_ids_json TEXT NOT NULL CHECK (json_valid(source_set_ids_json)),
  generated_at INTEGER NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','evaluated','invalid')),
  invalid_reason TEXT,
  actual_reps REAL, signed_error REAL, absolute_error REAL,
  within_one INTEGER, within_two INTEGER, evaluated_at INTEGER,
  UNIQUE (target_set_id, model_version),
  CHECK (state != 'evaluated' OR (actual_reps IS NOT NULL AND absolute_error IS NOT NULL
    AND signed_error IS NOT NULL AND within_one IS NOT NULL AND within_two IS NOT NULL AND evaluated_at IS NOT NULL))
);
CREATE INDEX ml_prediction_session ON ml_prediction(session_id, state);
CREATE TRIGGER ml_set_insert AFTER INSERT ON workout_set BEGIN
  ${reject}
  ${match}
  -- Another logged set changes the next-set context. Never later match an abandoned target.
  UPDATE ml_prediction SET state = 'invalid', invalid_reason = 'context_changed'
    WHERE session_id = NEW.session_id AND target_set_id != NEW.id AND state = 'pending'
      AND NOT EXISTS (SELECT 1 FROM json_each(source_set_ids_json) WHERE value = NEW.id)
      AND NOT EXISTS (SELECT 1 FROM workout_set w WHERE w.id = target_set_id);
END;
CREATE TRIGGER ml_set_update AFTER UPDATE ON workout_set BEGIN
  UPDATE ml_prediction SET ${invalidate}
    WHERE target_set_id = NEW.id AND state != 'invalid' AND (${changed}
      OR (state = 'evaluated' AND NEW.outlier_status NOT IN ('none','confirmed')));
  UPDATE ml_prediction SET state = 'invalid', invalid_reason = 'context_changed'
    WHERE state != 'invalid' AND EXISTS (SELECT 1 FROM json_each(source_set_ids_json) WHERE value = NEW.id)
      AND (${changed} OR NEW.outlier_status IS NOT OLD.outlier_status);
  ${reject}
  ${match}
END;
CREATE TRIGGER ml_set_delete AFTER DELETE ON workout_set BEGIN
  UPDATE ml_prediction SET state = 'invalid', invalid_reason = 'deleted'
    WHERE state != 'invalid' AND (target_set_id = OLD.id
      OR EXISTS (SELECT 1 FROM json_each(source_set_ids_json) WHERE value = OLD.id));
END;
CREATE TRIGGER ml_session_update AFTER UPDATE ON session BEGIN
  UPDATE ml_prediction SET state = 'invalid', invalid_reason = 'session_deleted'
    WHERE NEW.deleted_at IS NOT NULL AND (session_id = NEW.id OR EXISTS (
      SELECT 1 FROM workout_set w JOIN json_each(source_set_ids_json) j ON j.value = w.id WHERE w.session_id = NEW.id));
  UPDATE ml_prediction SET state = 'invalid', invalid_reason = 'skipped'
    WHERE session_id = NEW.id AND NEW.status = 'skipped';
  UPDATE ml_prediction SET state = 'invalid', invalid_reason = 'skipped'
    WHERE session_id = NEW.id AND state = 'pending' AND NEW.status != 'in_progress'
      AND NOT EXISTS (SELECT 1 FROM workout_set w WHERE w.id = target_set_id AND w.deleted_at IS NULL);
END;
-- Also runs when cloud backup replacement disables foreign keys. Local forecasts must not
-- become orphaned or get reassigned to unrelated replacement history.
CREATE TRIGGER ml_session_delete BEFORE DELETE ON session BEGIN
  DELETE FROM ml_prediction WHERE session_id = OLD.id;
END;
CREATE TRIGGER ml_exercise_delete BEFORE DELETE ON exercise BEGIN
  DELETE FROM ml_prediction WHERE exercise_id = OLD.id;
END;
CREATE TRIGGER ml_exercise_removed AFTER UPDATE ON session_exercise
  WHEN NEW.removed != 0 OR NEW.replaced_by IS NOT OLD.replaced_by BEGIN
  UPDATE ml_prediction SET state = 'invalid', invalid_reason = 'skipped'
    WHERE session_id = NEW.session_id AND exercise_id IN (NEW.slot_exercise_id, OLD.replaced_by)
      AND state = 'pending';
END;
CREATE TRIGGER ml_exercise_removed_insert AFTER INSERT ON session_exercise
  WHEN NEW.removed != 0 OR NEW.replaced_by IS NOT NULL BEGIN
  UPDATE ml_prediction SET state = 'invalid', invalid_reason = 'skipped'
    WHERE session_id = NEW.session_id AND exercise_id = NEW.slot_exercise_id AND state = 'pending';
END;
`;
