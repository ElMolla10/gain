-- Schema of a GAIN database written by branch fix/ios-offline-install (d63378c, = v0.22.0 #149 + iOS install docs). user_version 11.
-- Dumped from sqlite_master of a database that branch's own code created; used by test/dbOpenAnyState.test.ts.
CREATE TABLE setting (
  id TEXT PRIMARY KEY, value TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER
);
CREATE TABLE gym (
  id TEXT PRIMARY KEY, name TEXT NOT NULL,
  is_sample INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER
);
CREATE TABLE gym_load (
  id TEXT PRIMARY KEY,
  gym_id TEXT NOT NULL REFERENCES gym(id),
  equipment TEXT NOT NULL CHECK (equipment IN ('dumbbell','barbell','plate','cable','machine','assisted')),
  loads_json TEXT,
  increment REAL,
  min_load REAL,
  max_load REAL,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER,
  CHECK (loads_json IS NOT NULL OR increment IS NOT NULL)
);
CREATE TABLE exercise (
  id TEXT PRIMARY KEY,
  seed_key TEXT,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  aliases_ar_json TEXT NOT NULL DEFAULT '[]',
  pattern TEXT NOT NULL,
  equipment TEXT NOT NULL CHECK (equipment IN ('dumbbell','barbell','plate','cable','machine','assisted')),
  setup TEXT NOT NULL DEFAULT 'free' CHECK (setup IN ('free','assisted','bodyweight_plus_added')),
  is_sample INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER
, measure TEXT NOT NULL DEFAULT 'reps' CHECK (measure IN ('reps','time','distance')), load_spec_json TEXT);
CREATE TABLE exercise_line (
  id TEXT PRIMARY KEY,
  exercise_id TEXT NOT NULL REFERENCES exercise(id),
  gym_id TEXT NOT NULL REFERENCES gym(id),
  setup TEXT NOT NULL CHECK (setup IN ('free','assisted','bodyweight_plus_added')),
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER
);
CREATE TABLE programme (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, is_sample INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER
, kind TEXT NOT NULL DEFAULT 'user' CHECK (kind IN ('user','import_history')));
CREATE TABLE programme_version (
  id TEXT PRIMARY KEY,
  programme_id TEXT NOT NULL REFERENCES programme(id),
  version INTEGER NOT NULL,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER
);
CREATE TABLE programme_day (
  id TEXT PRIMARY KEY,
  programme_version_id TEXT NOT NULL REFERENCES programme_version(id),
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER
);
CREATE TABLE programme_day_exercise (
  id TEXT PRIMARY KEY,
  programme_day_id TEXT NOT NULL REFERENCES programme_day(id),
  exercise_id TEXT NOT NULL REFERENCES exercise(id),
  position INTEGER NOT NULL,
  sets INTEGER NOT NULL,
  rep_min INTEGER NOT NULL,
  rep_max INTEGER NOT NULL,
  is_goal_lift INTEGER NOT NULL DEFAULT 0,
  track_effort INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER
, rep_ceiling INTEGER CHECK (rep_ceiling IS NULL OR (rep_ceiling >= 1 AND rep_ceiling <= 100)), top_sets INTEGER CHECK (top_sets IS NULL OR (top_sets >= 1 AND top_sets <= 11)));
CREATE TABLE session (
  id TEXT PRIMARY KEY,
  programme_version_id TEXT NOT NULL REFERENCES programme_version(id),
  programme_day_id TEXT NOT NULL REFERENCES programme_day(id),
  gym_id TEXT NOT NULL REFERENCES gym(id),
  status TEXT NOT NULL CHECK (status IN ('planned','in_progress','finished','skipped')),
  planned_for TEXT,
  started_at INTEGER,
  finished_at INTEGER,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER
, import_key TEXT, import_batch_id TEXT REFERENCES import_batch(id));
CREATE TABLE workout_set (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES session(id),
  exercise_id TEXT NOT NULL REFERENCES exercise(id),
  line_id TEXT NOT NULL REFERENCES exercise_line(id),
  position INTEGER NOT NULL,
  load REAL NOT NULL,
  reps INTEGER NOT NULL,
  rir REAL,
  is_warmup INTEGER NOT NULL DEFAULT 0,
  tags_json TEXT NOT NULL DEFAULT '[]',
  outlier_status TEXT NOT NULL DEFAULT 'none' CHECK (outlier_status IN ('none','unconfirmed','confirmed','rejected')),
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER
, duration_s INTEGER CHECK (duration_s IS NULL OR (duration_s >= 1 AND duration_s <= 3600)), distance_m REAL CHECK (distance_m IS NULL OR (distance_m > 0 AND distance_m <= 5000)));
CREATE TABLE goal (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('lift','bodyweight','muscle')),
  exercise_id TEXT REFERENCES exercise(id),
  target_load REAL,
  target_reps INTEGER,
  target_weight_kg REAL,
  target_date TEXT,
  note TEXT,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER
);
CREATE TABLE bodyweight_entry (
  id TEXT PRIMARY KEY, weight_kg REAL NOT NULL, measured_at INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER
);
CREATE TABLE target (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES session(id),
  exercise_id TEXT NOT NULL REFERENCES exercise(id),
  line_id TEXT NOT NULL REFERENCES exercise_line(id),
  load REAL,
  reps INTEGER,
  target_rir REAL,
  quality TEXT,
  planned_sets INTEGER,
  currency TEXT NOT NULL CHECK (currency IN ('reps','effort','quality','load','none')),
  jump_kind TEXT,
  rule_version TEXT NOT NULL,
  path TEXT NOT NULL DEFAULT 'rule' CHECK (path IN ('rule','model')),
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','accepted','edited','rejected')),
  reason_key TEXT NOT NULL,
  reason_params_json TEXT NOT NULL DEFAULT '{}',
  confidence TEXT NOT NULL,
  edited_load REAL,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER
, duration_s INTEGER, distance_m REAL);
CREATE TABLE decision_log (
  id TEXT PRIMARY KEY,
  target_id TEXT NOT NULL REFERENCES target(id),
  rule_version TEXT NOT NULL,
  path TEXT NOT NULL CHECK (path IN ('rule','model')),
  inputs_json TEXT NOT NULL,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER
);
CREATE TABLE rejection_memory (
  id TEXT PRIMARY KEY,
  line_id TEXT NOT NULL REFERENCES exercise_line(id),
  jump_kind TEXT NOT NULL,
  count INTEGER NOT NULL,
  last_rejected_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER
);
CREATE TABLE import_batch (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('hevy','strong')),
  file_name TEXT,
  gym_id TEXT NOT NULL REFERENCES gym(id),
  workouts INTEGER NOT NULL,
  sets INTEGER NOT NULL,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER
);
CREATE TABLE import_mapping (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('hevy','strong')),
  source_title TEXT NOT NULL,
  exercise_id TEXT NOT NULL REFERENCES exercise(id),
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER
);
CREATE TABLE weekly_review (
  id TEXT PRIMARY KEY,
  week_start TEXT NOT NULL,
  rule_version TEXT NOT NULL,
  inputs_json TEXT NOT NULL,
  review_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','accepted','edited','skipped')),
  applied_json TEXT,
  decided_at INTEGER,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER
);
CREATE TABLE short_week (
  id TEXT PRIMARY KEY,
  programme_id TEXT NOT NULL REFERENCES programme(id),
  original_version_id TEXT NOT NULL REFERENCES programme_version(id),
  short_version_id TEXT NOT NULL REFERENCES programme_version(id),
  week_start TEXT NOT NULL,
  days INTEGER NOT NULL,
  minutes INTEGER,
  cuts_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended','undone','superseded')),
  restored_version_id TEXT REFERENCES programme_version(id),
  ended_at INTEGER,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER
);
CREATE TABLE session_exercise (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES session(id),
  slot_exercise_id TEXT NOT NULL REFERENCES exercise(id),
  removed INTEGER NOT NULL DEFAULT 0,
  replaced_by TEXT REFERENCES exercise(id),
  note TEXT,
  rest_off INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER
, added INTEGER NOT NULL DEFAULT 0, position INTEGER, superset_group TEXT);
CREATE TABLE sync_state (id TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE sync_row_state (tbl TEXT NOT NULL, row_id TEXT NOT NULL, version TEXT NOT NULL, PRIMARY KEY (tbl, row_id));
CREATE TABLE sync_outbox (
  event_id TEXT PRIMARY KEY, tbl TEXT NOT NULL, row_id TEXT NOT NULL,
  updated_at INTEGER NOT NULL, deleted_at INTEGER, data TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE sync_parked (
  tbl TEXT NOT NULL, row_id TEXT NOT NULL, seq INTEGER NOT NULL,
  updated_at INTEGER NOT NULL, deleted_at INTEGER, data TEXT NOT NULL, reason TEXT NOT NULL, detail TEXT,
  PRIMARY KEY (tbl, row_id)
);
CREATE UNIQUE INDEX gym_load_one_per_type ON gym_load(gym_id, equipment) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX exercise_seed_key ON exercise(seed_key) WHERE seed_key IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX exercise_line_unique ON exercise_line(exercise_id, gym_id, setup) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX programme_version_unique ON programme_version(programme_id, version) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX session_one_open_per_day ON session(programme_day_id)
  WHERE status IN ('planned','in_progress') AND deleted_at IS NULL;
CREATE INDEX workout_set_session ON workout_set(session_id);
CREATE INDEX workout_set_line ON workout_set(line_id);
CREATE INDEX target_session ON target(session_id);
CREATE INDEX decision_log_target ON decision_log(target_id);
CREATE UNIQUE INDEX rejection_memory_unique ON rejection_memory(line_id, jump_kind) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX import_mapping_unique ON import_mapping(source, source_title) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX session_import_key ON session(import_key) WHERE import_key IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX weekly_review_week ON weekly_review(week_start) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX short_week_one_active ON short_week(programme_id) WHERE status = 'active' AND deleted_at IS NULL;
CREATE UNIQUE INDEX session_exercise_slot ON session_exercise(session_id, slot_exercise_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX sync_outbox_row ON sync_outbox(tbl, row_id);
PRAGMA user_version = 11;
