# Performance budget (Step 15) — Node measurements, phone thresholds PROPOSED

Status: tests exist (`test/performance.test.ts`); **phone timings are NOT measured**. The lowest-spec phone to support is **Mohamed's decision** (not yet taken). Numbers below are Node 22 on the dev box and are ~5-20x faster than a low-end phone would be; they prove the *shape* (no query grows with history length), not the phone speed.

## What is tested
A synthetic lifter with **2 years of history** (104 weeks, ~416 sessions, ~8,900 sets), 40 gyms and a full backup/restore.

| Read | 8 weeks | 104 weeks | SQL statements (both) |
| --- | --- | --- | --- |
| Session list | 0.6 ms | 3 ms | 1 |
| Lift list | 0.7 ms | 8 ms | 1 |
| Lift trend | 1.6 ms | 10 ms | 2 |
| Session detail | 0.4 ms | 0.3 ms | 2 |
| Live target (during a workout) | 1.3 ms | 2 ms | 3 |
| Today / next day | 0.3 ms | 0.3 ms | 4 |
| Plan the next session | 4 ms | 19 ms | 36 |

The test fails if any read exceeds **1.5 s on Node**, or if the number of statements grows with history (that is how an N+1 query would show up). No N+1 was found; no repository code needed changing for performance.
Also tested: JSON and CSV export and a full restore of the two-year history complete and keep every set; the 40-gym list works.

## PROPOSED phone thresholds (unagreed — need Mohamed's decision on the target phone)
- Tap on a tick to "saved" on screen: under 150 ms.
- Today screen ready after launch: under 2 s cold start.
- History/lift list scroll without visible stutter with 2 years of data.
- Export of 2 years: under 10 s.
To check on a real phone: install a restored 2-year backup (the test can generate one: see `lifter()` in the test) and time those four actions.

## On-device timings (Developer Mode)
Turn on Developer Mode, then open Settings > Diagnostics > Timings. Each line shows a name, the number of samples (n, last 50 kept), the median and the p90 in milliseconds. Samples are recorded only while Developer Mode is on, stay in a local file (`gain-perf.json`) and are never uploaded. "Clear timings" empties them.
- `boot`: from App.tsx module load until the boot state is set (DB open, backup, migrations, seeds, achievements). Not including font load.
- `workoutOpen`: Workout screen mount until the session is ready.
- `tickSaved`: in logRow, from the tap until the row is marked saved.
- `loggerCommit`: React Profiler `actualDuration` per commit of the logger's scroll content (keystrokes, ticks).

First phone measurements (fill in after a run: cold launch, then one workout with a few typed cells and 5 ticked sets):

| Phone / build | boot median / p90 | workoutOpen median / p90 | tickSaved median / p90 | loggerCommit median / p90 |
| --- | --- | --- | --- | --- |
| _(iPhone model, iOS, Release)_ | _ | _ | _ | _ |

## Not covered
Rendering cost of lists (FlatList/ScrollView), JS bundle start-up time, memory on a 2 GB phone, battery. All need a device or profiler.
