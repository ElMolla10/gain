import type { Db } from "./driver";

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
];

export const LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1]!.version;

/** Applies pending migrations in order, each in a transaction, tracked with PRAGMA user_version. */
export async function migrate(db: Db): Promise<{ from: number; to: number }> {
  const row = await db.get<{ user_version: number }>("PRAGMA user_version");
  const from = Number(row?.user_version ?? 0);
  if (from > LATEST_VERSION) throw new Error(`Database is newer (v${from}) than this app (v${LATEST_VERSION})`);
  let current = from;
  for (const m of MIGRATIONS) {
    if (m.version <= current) continue;
    await db.transaction(async () => {
      await db.exec(m.sql);
      await db.exec(`PRAGMA user_version = ${m.version}`);
    });
    current = m.version;
  }
  return { from, to: current };
}
