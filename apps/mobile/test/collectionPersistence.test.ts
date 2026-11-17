import { describe, expect, it } from "vitest";
import { COLLECTION_IDS } from "@gain/engine";
import { freshDb } from "./helpers";
import { copyAtVersion } from "./realData";
import { migrate } from "../src/db/migrations";
const DAY=86400000;
async function setup(){
 const c=await freshDb();await c.repos.seedIfNeeded();const gymId=(await c.repos.getActiveGymId())!;const gym=await c.repos.loadGymFingerprint(gymId);const day=(await c.repos.getNextDay())!.day;const ex=(await c.repos.listDayExercises(day.id))[0]!;
 const train=async(load=60,reps=8)=>{const {id}=await c.workout.startOrResumeSession(day.id,gymId);await c.workout.logSet({sessionId:id,exerciseId:ex.exerciseId,load,reps},{gym,equipment:ex.equipment,setup:ex.setup});c.deps.tick();await c.workout.finishSession(id);c.deps.tick();return id;};
 return {...c,gymId,gym,day,ex,train};
}
describe("collection persistence and migration",()=>{
 it("awards one-set first workouts and never duplicates rows or celebrations after restart/retry",async()=>{
  const c=await setup();await c.achievements.ensureBackfill();const id=await c.train();await c.achievements.sync();
  expect((await c.achievements.listForSession(id)).map(r=>r.badgeId)).toEqual(["first_workout"]);
  const before=await c.db.all("SELECT id, badge_id, earned_local_date, evidence_payload_json FROM user_achievements ORDER BY id");
  await c.achievements.markCelebrated(["collection:v2:first_workout"]);await c.achievements.sync();await c.achievements.ensureBackfill();
  expect(await c.achievements.listForSession(id)).toEqual([]);expect(await c.db.all("SELECT id, badge_id, earned_local_date, evidence_payload_json FROM user_achievements ORDER BY id")).toEqual(before);
 });
 it("keeps legacy awards, dates, evidence and workout records while silently replaying the new collection",async()=>{
  const c=await setup();const id=await c.train();const t=c.deps.now();const payload=JSON.stringify({kind:"workhorse",identity:{exerciseId:c.ex.exerciseId,equipment:c.ex.equipment,setup:c.ex.setup},saved:"legacy-proof"});
  await c.db.run("INSERT INTO user_achievements (id,badge_id,rule_version,status,earned_at_utc,earned_local_date,primary_session_id,evidence_payload_json,created_at,updated_at) VALUES ('old','workhorse',1,'earned',?,'2020-01-01',?,?,?,?)",[t,id,payload,t,t]);
  const before=await c.db.get("SELECT badge_id,earned_at_utc,earned_local_date,primary_session_id,evidence_payload_json FROM user_achievements WHERE id='old'");
  await c.achievements.ensureBackfill();await c.achievements.ensureBackfill();
  expect(await c.db.get("SELECT badge_id,earned_at_utc,earned_local_date,primary_session_id,evidence_payload_json FROM user_achievements WHERE id='old'")).toEqual(before);
  expect((await c.achievements.getHome()).bannerCount).toBeNull();expect(await c.achievements.listForSession(id)).toEqual([]);
  expect(await c.db.get("SELECT id FROM session WHERE id=?",[id])).toEqual({id});
  expect((await c.achievements.listCabinet()).filter(r=>!COLLECTION_IDS.has(r.badgeId) && r.status!=="earned")).toEqual([]);
 });
 it("migrates v20 repeatably without inferring old explicit targets",async()=>{
  const c=await setup();await c.train();await c.achievements.setPin({exerciseId:c.ex.exerciseId,equipment:c.ex.equipment,setup:c.ex.setup,load:65,reps:8});
  const old=await copyAtVersion(c.db,20);const sessions=await old.all("SELECT * FROM session");const pins=await old.all("SELECT id,created_at,load,reps FROM lift_pin");
  expect(await migrate(old)).toMatchObject({from:20,to:21});expect(await old.all("SELECT * FROM session")).toEqual(sessions);expect(await old.all("SELECT id,created_at,load,reps FROM lift_pin")).toEqual(pins);
  expect(await old.get("SELECT explicit_target FROM lift_pin")).toEqual({explicit_target:0});expect(await migrate(old)).toMatchObject({from:21,to:21});
 });
 it("uses the target version active at workout start even after a mid-workout edit",async()=>{
  const c=await setup();await c.train();c.deps.tick(DAY);await c.achievements.setPin({exerciseId:c.ex.exerciseId,equipment:c.ex.equipment,setup:c.ex.setup,load:65,reps:8});
  const oldTarget=await c.db.get<{id:string}>("SELECT id FROM lift_pin WHERE deleted_at IS NULL");c.deps.tick();
  const {id}=await c.workout.startOrResumeSession(c.day.id,c.gymId);c.deps.tick();await c.achievements.setPin({exerciseId:c.ex.exerciseId,equipment:c.ex.equipment,setup:c.ex.setup,load:80,reps:8});
  await c.workout.logSet({sessionId:id,exerciseId:c.ex.exerciseId,load:65,reps:8},{gym:c.gym,equipment:c.ex.equipment,setup:c.ex.setup});c.deps.tick();await c.workout.finishSession(id);await c.achievements.sync();
  const award=(await c.achievements.listEarned()).find(r=>r.badgeId==="called_it");expect(award?.evidence).toMatchObject({targetVersionId:oldTarget!.id,target:{load:65,reps:8}});
 });
 it("preserves undated history without inventing a training date",async()=>{
  const c=await setup();const id=await c.train();await c.db.run("UPDATE session SET local_calendar_date=NULL,updated_at=? WHERE id=?",[c.deps.now(),id]);await c.achievements.ensureBackfill();
  expect((await c.achievements.getHome()).stats.qualifyingDays).toBe(0);expect(await c.db.get("SELECT local_calendar_date FROM session WHERE id=?",[id])).toEqual({local_calendar_date:null});
 });
 it("matches incremental SQLite awards with silent full replay, IDs, dates and evidence included",async()=>{
  const c=await setup();await c.achievements.ensureBackfill();
  for(let i=0;i<12;i++){await c.train(60,8+Math.floor(i/3));await c.achievements.sync();c.deps.tick(DAY);}
  const query="SELECT id,badge_id,earned_local_date,evidence_payload_json FROM user_achievements WHERE status='earned' ORDER BY id";
  const incremental=await c.db.all(query);await c.db.exec("DELETE FROM user_achievements");await c.achievements.sync({backfill:true});expect(await c.db.all(query)).toEqual(incremental);
 });
});
