# SYNTHETIC sample backup (not a real lifter)

`P00-synthetic.json` is made-up data in the shape of a GAIN backup (only the `session`, `workout_set` and `target` tables, which are the only ones `pilot-metrics` reads): one invented lifter, bench and squat, 11 finished sessions over 5 weeks with a gap in week 3. It exists so the pilot-metrics script can be run end to end before a real file exists, and so the output columns can be seen. It is **not** evidence about the app or about any person.

```
npm ci
npm run pilot-metrics -w @gain/mobile -- --tz-minutes 180 $PWD/docs/pilot/sample/P00-synthetic.json
```

Output of that command (the CSV on stdout, the summary on stderr), checked on 2026-10-04 on the build box:

```
pilot_code,week,sessions_done,active,targets_accepted,targets_edited,targets_rejected,targets_never_acted_on,comparable,loaded_same,loaded_more,loaded_less,both_comparable,both_app_same,both_repeat_same,days_planned,app_version,on_pace_status,bugs_quotes
P00-synthetic,0,3,1,2,2,0,0,4,4,0,0,4,4,2,,,,
P00-synthetic,1,3,1,6,0,0,0,6,4,2,0,6,4,4,,,,
P00-synthetic,2,3,1,4,2,0,0,6,4,2,0,6,4,2,,,,
P00-synthetic,3,0,0,0,0,0,0,0,0,0,0,0,0,0,,,,
P00-synthetic,4,2,1,4,0,0,0,4,4,0,0,4,4,2,,,,
P00-synthetic,5,0,0,0,0,0,0,0,0,0,0,0,0,0,,,,
week 1: retained 1 of 1 who reached it
week 2: retained 1 of 1 who reached it
week 6: retained 0 of 0 who reached it
targets compared with what was loaded: 20 (same 16, loaded more 4, loaded less 0)
like-for-like with "repeat the last load" (20 targets that also have a previous load): app's number matched 16, repeat-last matched 10
```

The file is invented so that the lifter mostly loads the app's number; those counts say nothing about how the app will do. The unit tests (`apps/mobile/test/pilotMetrics.test.ts`) cover the definitions with hand-computed cases.
