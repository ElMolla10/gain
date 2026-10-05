# SYNTHETIC sample backup (not a real lifter)

`P00-synthetic.json` is made-up data in the shape of a GAIN backup (the metric tables plus the exercise/line metadata needed to establish equipment, gym and setup): one invented lifter, bench and squat, 11 finished sessions over 5 weeks with a gap in week 3. It exists so the pilot-metrics script can be run end to end before a real file exists, and so the output columns can be seen. It is **not** evidence about the app or about any person.

```
npm ci
npm run pilot-metrics -w @gain/mobile -- --tz-minutes 180 $PWD/docs/pilot/sample/P00-synthetic.json
```

Output of that command (the CSV on stdout, the summary on stderr), checked on 2026-10-05 (Cairo) after the strict line-metadata/effective-load exclusions were added:

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
comparable: 20 (loaded_same 16, loaded_more 4, loaded_less 0)
both_comparable: 20 (both_app_same 16, both_repeat_same 10; newest earlier like-for-like session with knowable effective load)
```

The file is invented so that the lifter mostly loads the app's number; those counts say nothing about how the app will do. The unit tests (`apps/mobile/test/pilotMetrics.test.ts`) cover the definitions with hand-computed cases.
