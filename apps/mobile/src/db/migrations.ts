import type { Db } from "./driver";
import { TIMED_LIBRARY } from "./library/measures";

/**
 * Schema. Conventions for every table (so sync can come later without a rewrite):
 *   id TEXT PRIMARY KEY  (client-generated UUID v4)
 *   created_at / updated_at INTEGER (unix ms)
 *   deleted_at INTEGER NULL (soft delete; rows are never physically removed by the app)
 * The spec's `set` table is called `workout_set` because SET is an SQL keyword.
 */
const TS = `created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER`;
const EQUIP = `('dumbbell','barbell','plate','cable','machine','assisted')`;
const SETUP = `('free','assisted','bodyweight_plus_added')`;

export const MIGRATIONS: { version: number; name: string; sql: string }[] = [
  {
    version: 1,
    name: "initial schema",
    sql: `
CREATE TABLE setting (
  id TEXT PRIMARY KEY, value TEXT NOT NULL, ${TS}
);

CREATE TABLE gym (
  id TEXT PRIMARY KEY, name TEXT NOT NULL,
  is_sample INTEGER NOT NULL DEFAULT 0,
  ${TS}
);

-- What loads exist for one equipment type in one gym: an explicit list (dumbbell pairs) or an increment grid.
CREATE TABLE gym_load (
  id TEXT PRIMARY KEY,
  gym_id TEXT NOT NULL REFERENCES gym(id),
  equipment TEXT NOT NULL CHECK (equipment IN ${EQUIP}),
  loads_json TEXT,
  increment REAL,
  min_load REAL,
  max_load REAL,
  ${TS},
  CHECK (loads_json IS NOT NULL OR increment IS NOT NULL)
);
CREATE UNIQUE INDEX gym_load_one_per_type ON gym_load(gym_id, equipment) WHERE deleted_at IS NULL;

CREATE TABLE exercise (
  id TEXT PRIMARY KEY,
  seed_key TEXT,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  aliases_ar_json TEXT NOT NULL DEFAULT '[]',
  pattern TEXT NOT NULL,
  equipment TEXT NOT NULL CHECK (equipment IN ${EQUIP}),
  setup TEXT NOT NULL DEFAULT 'free' CHECK (setup IN ${SETUP}),
  is_sample INTEGER NOT NULL DEFAULT 0,
  ${TS}
);
CREATE UNIQUE INDEX exercise_seed_key ON exercise(seed_key) WHERE seed_key IS NOT NULL AND deleted_at IS NULL;

-- One history stream per exercise + gym + setup. Streams never mix.
CREATE TABLE exercise_line (
  id TEXT PRIMARY KEY,
  exercise_id TEXT NOT NULL REFERENCES exercise(id),
  gym_id TEXT NOT NULL REFERENCES gym(id),
  setup TEXT NOT NULL CHECK (setup IN ${SETUP}),
  ${TS}
);
CREATE UNIQUE INDEX exercise_line_unique ON exercise_line(exercise_id, gym_id, setup) WHERE deleted_at IS NULL;

CREATE TABLE programme (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, is_sample INTEGER NOT NULL DEFAULT 0, ${TS}
);
-- Versions keep old sessions readable when the programme is edited.
CREATE TABLE programme_version (
  id TEXT PRIMARY KEY,
  programme_id TEXT NOT NULL REFERENCES programme(id),
  version INTEGER NOT NULL,
  ${TS}
);
CREATE UNIQUE INDEX programme_version_unique ON programme_version(programme_id, version) WHERE deleted_at IS NULL;
CREATE TABLE programme_day (
  id TEXT PRIMARY KEY,
  programme_version_id TEXT NOT NULL REFERENCES programme_version(id),
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  ${TS}
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
  ${TS}
);

CREATE TABLE session (
  id TEXT PRIMARY KEY,
  programme_version_id TEXT NOT NULL REFERENCES programme_version(id),
  programme_day_id TEXT NOT NULL REFERENCES programme_day(id),
  gym_id TEXT NOT NULL REFERENCES gym(id),
  status TEXT NOT NULL CHECK (status IN ('planned','in_progress','finished','skipped')),
  planned_for TEXT,
  started_at INTEGER,
  finished_at INTEGER,
  ${TS}
);
-- At most one open (planned or in-progress) session per programme day: re-opening never duplicates it.
CREATE UNIQUE INDEX session_one_open_per_day ON session(programme_day_id)
  WHERE status IN ('planned','in_progress') AND deleted_at IS NULL;

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
  ${TS}
);
CREATE INDEX workout_set_session ON workout_set(session_id);
CREATE INDEX workout_set_line ON workout_set(line_id);

CREATE TABLE goal (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('lift','bodyweight','muscle')),
  exercise_id TEXT REFERENCES exercise(id),
  target_load REAL,
  target_reps INTEGER,
  target_weight_kg REAL,
  target_date TEXT,
  note TEXT,
  ${TS}
);
CREATE TABLE bodyweight_entry (
  id TEXT PRIMARY KEY, weight_kg REAL NOT NULL, measured_at INTEGER NOT NULL, ${TS}
);

-- The next-session target written for an exercise, and what the lifter did with it.
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
  ${TS}
);
CREATE INDEX target_session ON target(session_id);

-- The inputs behind every material suggestion ("Why this weight?" reads this).
CREATE TABLE decision_log (
  id TEXT PRIMARY KEY,
  target_id TEXT NOT NULL REFERENCES target(id),
  rule_version TEXT NOT NULL,
  path TEXT NOT NULL CHECK (path IN ('rule','model')),
  inputs_json TEXT NOT NULL,
  ${TS}
);
CREATE INDEX decision_log_target ON decision_log(target_id);

CREATE TABLE rejection_memory (
  id TEXT PRIMARY KEY,
  line_id TEXT NOT NULL REFERENCES exercise_line(id),
  jump_kind TEXT NOT NULL,
  count INTEGER NOT NULL,
  last_rejected_at INTEGER NOT NULL,
  ${TS}
);
CREATE UNIQUE INDEX rejection_memory_unique ON rejection_memory(line_id, jump_kind) WHERE deleted_at IS NULL;
`,
  },
  {
    version: 2,
    name: "per-lift rep ceiling",
    // NULL = use the default for the kind of lift (10 upper, 12 legs, 15 lateral raises, or the lifter's edited defaults).
    sql: `ALTER TABLE programme_day_exercise ADD COLUMN rep_ceiling INTEGER CHECK (rep_ceiling IS NULL OR (rep_ceiling >= 1 AND rep_ceiling <= 100));`,
  },
  {
    version: 3,
    name: "history import",
    sql: `
-- 'import_history' is a hidden programme that only holds imported sessions (sessions need a programme day). It is never listed,
-- never active and never planned from.
ALTER TABLE programme ADD COLUMN kind TEXT NOT NULL DEFAULT 'user' CHECK (kind IN ('user','import_history'));

CREATE TABLE import_batch (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('hevy','strong')),
  file_name TEXT,
  gym_id TEXT NOT NULL REFERENCES gym(id),
  workouts INTEGER NOT NULL,
  sets INTEGER NOT NULL,
  ${TS}
);

-- The lifter's answer to "which exercise is this title?", remembered per source so a second file does not ask again.
CREATE TABLE import_mapping (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('hevy','strong')),
  source_title TEXT NOT NULL,
  exercise_id TEXT NOT NULL REFERENCES exercise(id),
  ${TS}
);
CREATE UNIQUE INDEX import_mapping_unique ON import_mapping(source, source_title) WHERE deleted_at IS NULL;

-- source|start|title of the workout: importing the same file twice finds the key and adds nothing.
ALTER TABLE session ADD COLUMN import_key TEXT;
ALTER TABLE session ADD COLUMN import_batch_id TEXT REFERENCES import_batch(id);
CREATE UNIQUE INDEX session_import_key ON session(import_key) WHERE import_key IS NOT NULL AND deleted_at IS NULL;
`,
  },
  {
    version: 4,
    name: "weekly review",
    sql: `
-- One review per training week. inputs_json = what the rule saw, review_json = what it proposed, applied_json = what the lifter's tap changed (null if nothing).
CREATE TABLE weekly_review (
  id TEXT PRIMARY KEY,
  week_start TEXT NOT NULL,
  rule_version TEXT NOT NULL,
  inputs_json TEXT NOT NULL,
  review_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','accepted','edited','skipped')),
  applied_json TEXT,
  decided_at INTEGER,
  ${TS}
);
CREATE UNIQUE INDEX weekly_review_week ON weekly_review(week_start) WHERE deleted_at IS NULL;
`,
  },
  {
    version: 5,
    name: "short week",
    sql: `
-- A one-week programme rebuild ("I can train 3 days" / "I have 35 minutes"). original_version_id comes back after the week or on undo.
-- Every change is a new programme version, so old sessions stay readable. cuts_json = the list the lifter saw before saving.
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
  ${TS}
);
CREATE UNIQUE INDEX short_week_one_active ON short_week(programme_id) WHERE status = 'active' AND deleted_at IS NULL;
`,
  },
  {
    version: 6,
    name: "session_exercise",
    sql: `
-- Per-workout changes to ONE programme slot of the open workout (v0.9.0 logger): the lifter removed the exercise, swapped it for another
-- one for today only, wrote a note, or switched its rest timer off. The programme itself is never changed by any of this.
CREATE TABLE session_exercise (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES session(id),
  slot_exercise_id TEXT NOT NULL REFERENCES exercise(id),
  removed INTEGER NOT NULL DEFAULT 0,
  replaced_by TEXT REFERENCES exercise(id),
  note TEXT,
  rest_off INTEGER NOT NULL DEFAULT 0,
  ${TS}
);
CREATE UNIQUE INDEX session_exercise_slot ON session_exercise(session_id, slot_exercise_id) WHERE deleted_at IS NULL;
`,
  },
  {
    version: 7,
    name: "added exercises and supersets",
    sql: `
-- added = 1: an exercise the lifter added to today's workout that is not in the programme day (slot_exercise_id is then the exercise itself;
-- position orders the added ones). superset_group: exercises of one workout that share the same value are a superset (shown next to each
-- other; the rest timer starts after the last one). Neither changes the programme.
ALTER TABLE session_exercise ADD COLUMN added INTEGER NOT NULL DEFAULT 0;
ALTER TABLE session_exercise ADD COLUMN position INTEGER;
ALTER TABLE session_exercise ADD COLUMN superset_group TEXT;
`,
  },
  {
    version: 8,
    name: "backup and sync",
    sql: `
-- Opt-in backup/sync bookkeeping. NOTHING here is exported in the backup file or synced; "delete everything" and "restore" disconnect sync.
-- sync_state: key/value (enabled, account_id, device_token, recovery_code, cursor, last_sync_at, last_error, ...).
CREATE TABLE sync_state (id TEXT PRIMARY KEY, value TEXT NOT NULL);
-- The version (updated_at:deleted_at) of every row the server is known to have. A row whose current version differs is "dirty".
CREATE TABLE sync_row_state (tbl TEXT NOT NULL, row_id TEXT NOT NULL, version TEXT NOT NULL, PRIMARY KEY (tbl, row_id));
-- Events built but not yet acknowledged. The event id stays the same across retries, so re-sending is always safe.
CREATE TABLE sync_outbox (
  event_id TEXT PRIMARY KEY, tbl TEXT NOT NULL, row_id TEXT NOT NULL,
  updated_at INTEGER NOT NULL, deleted_at INTEGER, data TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX sync_outbox_row ON sync_outbox(tbl, row_id);
-- Rows received from the server that could not be applied yet: waiting_parent (its parent row has not arrived), conflict (a local unique
-- rule refuses it, e.g. a second open workout for the same day), newer_app (it has columns this app version does not know).
CREATE TABLE sync_parked (
  tbl TEXT NOT NULL, row_id TEXT NOT NULL, seq INTEGER NOT NULL,
  updated_at INTEGER NOT NULL, deleted_at INTEGER, data TEXT NOT NULL, reason TEXT NOT NULL, detail TEXT,
  PRIMARY KEY (tbl, row_id)
);
`,
  },
  {
    version: 9,
    name: "time and distance exercises",
    sql: `
-- How an exercise is counted: reps (default, everything that existed before), time (a hold, seconds) or distance (a carry, metres).
-- A timed or distance set stores reps = 1 (one hold / one carry) so every reps-based query keeps working, plus duration_s / distance_m.
ALTER TABLE exercise ADD COLUMN measure TEXT NOT NULL DEFAULT 'reps' CHECK (measure IN ('reps','time','distance'));
ALTER TABLE workout_set ADD COLUMN duration_s INTEGER CHECK (duration_s IS NULL OR (duration_s >= 1 AND duration_s <= 3600));
ALTER TABLE workout_set ADD COLUMN distance_m REAL CHECK (distance_m IS NULL OR (distance_m > 0 AND distance_m <= 5000));
-- The next-session target of a timed or distance exercise (reps is NULL then).
ALTER TABLE target ADD COLUMN duration_s INTEGER;
ALTER TABLE target ADD COLUMN distance_m REAL;
-- Existing library rows that are really holds or carries become timed ONLY when the lifter has no logged set and no programme slot for them,
-- so nothing already planned or done changes meaning. The lifter can switch the others in the programme editor.
${Object.entries(TIMED_LIBRARY)
  .map(
    ([k, m]) => `UPDATE exercise SET measure = '${m}' WHERE seed_key = '${k}' AND deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM workout_set ws WHERE ws.exercise_id = exercise.id)
  AND NOT EXISTS (SELECT 1 FROM programme_day_exercise pde WHERE pde.exercise_id = exercise.id)
  AND NOT EXISTS (SELECT 1 FROM session_exercise se WHERE se.slot_exercise_id = exercise.id OR se.replaced_by = exercise.id);`,
  )
  .join("\n")}
`,
  },
];

export const LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1]!.version;

/** The schema version the database is at and the one this app needs. `from` 0 = a brand-new database (nothing to protect). */
export async function migrationInfo(db: Db, migrations: readonly { version: number }[] = MIGRATIONS): Promise<{ from: number; to: number }> {
  const row = await db.get<{ user_version: number }>("PRAGMA user_version");
  return { from: Number(row?.user_version ?? 0), to: migrations[migrations.length - 1]!.version };
}

/**
 * Applies pending migrations in order, each in its own transaction together with its `user_version` bump, so a failure (or the process
 * being killed) leaves the database at the last complete version, never half-migrated. Safety rule: callers take a backup first when
 * `migrationInfo` says `0 < from < to` (see preMigrate.ts).
 */
export async function migrate(db: Db, migrations: readonly { version: number; name: string; sql: string }[] = MIGRATIONS): Promise<{ from: number; to: number }> {
  const { from, to } = await migrationInfo(db, migrations);
  if (from > to) throw new Error(`Database is newer (v${from}) than this app (v${to})`);
  let current = from;
  for (const m of migrations) {
    if (m.version <= current) continue;
    await db.transaction(async () => {
      await db.exec(m.sql);
      await db.exec(`PRAGMA user_version = ${m.version}`);
    });
    current = m.version;
  }
  return { from, to: current };
}
