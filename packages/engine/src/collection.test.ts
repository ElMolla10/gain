import { describe, expect, it } from "vitest";
import { evaluateAchievements, reconcileAchievements, COLLECTION_CATALOG, MEDAL_IDS, PLATE_IDS, shiftLocalDate, type AchievementSession, type AchievementSet, type LiftPin, type StoredAchievement } from "./achievements";
const day = 86400000;
function set(id: string, load=70, reps=8, extra: Partial<AchievementSet>={}): AchievementSet {
 return { id, exerciseId: "bench", equipment: "barbell", setup: "free", load, reps, warmup: false, tags: [], outlierStatus: "none", ...extra };
}
function session(id: string, date: string, sets=[set(`${id}-set`)], offset=0): AchievementSession {
 const start=Date.parse(`${date}T12:00:00Z`)+offset;
 return { id, localCalendarDate: date, startedAtUtc: start, finishedAtUtc: start+3600000, sets };
}
const awards = (history: AchievementSession[]) => evaluateAchievements(history).earned;
const ids = (history: AchievementSession[]) => awards(history).map(e=>e.badgeId);
const dates = (n: number) => Array.from({length:n},(_,i)=>session(`s${String(i).padStart(4,"0")}`,shiftLocalDate("2024-01-01",i)));
describe("permanent collection v2",()=>{
 it("owns exactly 21 stable milestones, 15 medals and six plates",()=>{
  expect(COLLECTION_CATALOG).toHaveLength(21);expect(MEDAL_IDS.size).toBe(15);expect(PLATE_IDS.size).toBe(6);
  expect(new Set(COLLECTION_CATALOG.map(d=>d.id)).size).toBe(21);
 });
 it("first short finished session is a baseline, without plate or PR",()=>{
  expect(ids([session("s","2026-01-01")])).toEqual(["first_workout"]);
  expect(ids([session("s","2026-01-01",[set("a"),set("b",100,20)])])).toEqual(["first_workout"]);
 });
 it.each([9,10,49,50,76,99,100,249,250,499,500,999,1000])("crosses each plate exactly once at %i dates",n=>{
  const history=dates(n);const earned=awards([...history,session("double",history.at(-1)!.localCalendarDate)]).filter(e=>PLATE_IDS.has(e.badgeId));
  expect(earned.map(e=>e.progressTarget)).toEqual([10,50,100,250,500,1000].filter(t=>t<=n));
  for(const e of earned) expect(e.earnedLocalDate).toBe(history[e.progressTarget-1]!.localCalendarDate);
  if(n===76)expect(evaluateAchievements(history).inProgress.find(p=>p.badgeId==="lifetime_plate_100")).toMatchObject({current:76,target:100});
 });
 it("uses distinct dates per exact variation, independent of program and session count",()=>{
  const history=dates(9);history.push(session("again",history[8]!.localCalendarDate));expect(ids(history)).not.toContain("dedicated_days_10");
  history.push(session("tenth","2024-01-10"));expect(ids(history)).toContain("dedicated_days_10");
  const split=dates(10).map((s,i)=>({...s,sets:[set(`x${i}`,70,8,{exerciseId:i<5?"bench":"incline"})]}));expect(ids(split)).not.toContain("dedicated_days_10");
  const mixed=dates(10).map((s,i)=>({...s,sets:[set(`x${i}`,70,8,{setup:i<5?"free":"bodyweight_plus_added"})]}));expect(ids(mixed)).not.toContain("dedicated_days_10");
 });
 it.each([10,25,50,100])("awards Dedicated %i at the actual distinct-date crossing",tier=>{
  const h=dates(tier);expect(awards(h.slice(0,-1)).some(e=>e.badgeId===`dedicated_days_${tier}`)).toBe(false);
  const earned=awards(h).filter(e=>e.badgeId===`dedicated_days_${tier}`);expect(earned).toHaveLength(1);expect(earned[0]!.earnedLocalDate).toBe(h.at(-1)!.localCalendarDate);
 });
 it("awards Dedicated once to the deterministic first identity at a crossing",()=>{
  const history=dates(10).map(s=>({...s,sets:[set(`${s.id}z`,70,8,{exerciseId:"curl"}),set(`${s.id}a`)]}));
  const found=awards(history).filter(e=>e.badgeId==="dedicated_days_10");expect(found).toHaveLength(1);expect(found[0]!.evidence).toMatchObject({identity:{exerciseId:"bench"}});
 });
 it("counts one session per week, missing weeks and year boundaries",()=>{
  const history=["2025-12-28","2025-12-29","2026-01-15","2026-02-05"].map((d,i)=>session(`w${i}`,d));
  expect(ids(history)).toContain("showing_up_4");expect(evaluateAchievements(history).stats.qualifiedWeeksLifetime).toBe(4);
  expect(evaluateAchievements([session("sun","2025-12-28"),session("mon","2025-12-29")],{weekStartsOn:0}).stats.qualifiedWeeksLifetime).toBe(1);
 });
 it.each([4,12,26,52])("crosses Showing Up %i once",n=>{
  const history=Array.from({length:n},(_,i)=>session(`w${i}`,shiftLocalDate("2024-01-01",i*14)));
  expect(awards(history).filter(e=>e.badgeId===`showing_up_${n}`)).toHaveLength(1);
 });
 it.each([[70,9,true],[72.5,8,true],[80,3,false],[70,8,false],[65,12,false]])("compares 70x8 with %ix%i -> %s",(load,reps,pr)=>{
  expect(ids([session("base","2026-01-01"),session("next","2026-01-02",[set("n",load,reps)])]).includes("first_pr")).toBe(pr);
 });
 it("normalizes converted unit ties using the persisted load precision",()=>{
  expect(ids([session("a","2026-01-01"),session("b","2026-01-02",[set("b",70.005,8)])])).not.toContain("first_pr");
  expect(ids([session("a","2026-01-01"),session("b","2026-01-02",[set("b",70.005,9)])])).toContain("first_pr");
 });
 it("does not count easier weeks, ties, unlike measures, or setup changes as PRs",()=>{
  expect(ids([session("a","2026-01-01"),session("b","2026-01-02",[set("b",60)]),session("c","2026-01-03")])).not.toContain("first_pr");
  expect(ids([session("a","2026-01-01"),session("b","2026-01-02",[set("b",80,8,{setup:"bodyweight_plus_added"})])])).not.toContain("first_pr");
  expect(ids([session("a","2026-01-01",[set("a",20,1,{measure:"time",durationS:30})]),session("b","2026-01-02",[set("b",20,1,{measure:"distance",distanceM:40})])])).not.toContain("first_pr");
 });
 it("records repeated equal PR sets once per workout, with deterministic evidence",()=>{
  const h=[session("a","2026-01-01"),session("b","2026-01-02",[set("z",72.5,8),set("a",72.5,8),set("m",70,9)])];
  const prs=awards(h).filter(e=>e.badgeId==="strength_pr_v2");expect(prs.map(e=>e.primarySetId)).toEqual(["a","m"]);
 });
 it("uses every real prior benchmark and blocks dominated candidates",()=>{
  const h=[session("a","2026-01-01",[set("a",70,8),set("b",80,10)]),session("b","2026-01-02",[set("c",72.5,8)])];expect(ids(h)).not.toContain("first_pr");
 });
 it("supports assistance, bodyweight, time and distance without invented bodyweight",()=>{
  for(const [before,after] of [
   [set("a",30,8,{setup:"assisted"}),set("b",25,8,{setup:"assisted"})],
   [set("a",0,8),set("b",0,10)],
   [set("a",20,1,{measure:"time",durationS:30}),set("b",20,1,{measure:"time",durationS:35})],
   [set("a",20,1,{measure:"distance",distanceM:30}),set("b",25,1,{measure:"distance",distanceM:30})],
  ])expect(ids([session("a","2026-01-01",[before!]),session("b","2026-01-02",[after!])])).toContain("first_pr");
 });
 it("never awards invalid, warmup, rejected, deleted-input, or unresolved outlier sets",()=>{
  for(const extra of [{warmup:true},{outlierStatus:"unconfirmed" as const},{outlierStatus:"rejected" as const},{load:NaN},{reps:0}])expect(ids([session("a","2026-01-01",[set("a",70,8,extra)])])).toEqual([]);
 });
 it("keeps subsequent PR events but one First PR medal, with distinct Across the Board identities",()=>{
  const h=[session("a","2026-01-01",Array.from({length:10},(_,i)=>set(`a${i}`,70,8,{exerciseId:`lift${i}`}))),session("b","2026-01-02",Array.from({length:10},(_,i)=>set(`b${i}`,70,9,{exerciseId:`lift${i}`}))),session("c","2026-01-03",[set("c",70,10,{exerciseId:"lift0"})])];
  expect(ids(h).filter(id=>id==="first_pr")).toHaveLength(1);expect(ids(h).filter(id=>id==="strength_pr_v2")).toHaveLength(11);
  for(const n of [3,5,10])expect(ids(h)).toContain(`across_the_board_${n}`);
 });
 it("requires explicit timestamped target versions above an established best before start",()=>{
  const h=[session("base","2026-01-01"),session("win","2026-01-03",[set("w",72.5,8)])];
  const pin:LiftPin={id:"target-v1",exerciseId:"bench",equipment:"barbell",setup:"free",load:72.5,reps:8,explicit:true,setAtUtc:Date.parse("2026-01-02T12:00:00Z")};
  expect(evaluateAchievements(h,{pins:[pin]}).earned.find(e=>e.badgeId==="called_it")?.evidence).toMatchObject({targetVersionId:"target-v1",baseline:{sessionId:"base"}});
  for(const p of [{...pin,explicit:false},{...pin,setAtUtc:undefined},{...pin,setAtUtc:h[1]!.startedAtUtc},{...pin,load:70},{...pin,endedAtUtc:Date.parse("2026-01-03T11:00:00Z")}])expect(evaluateAchievements(h,{pins:[p]}).earned.map(e=>e.badgeId)).not.toContain("called_it");
  const edit={...pin,id:"v2",setAtUtc:Date.parse("2026-01-03T12:30:00Z"),load:70};
  expect(evaluateAchievements(h,{pins:[{...pin,endedAtUtc:edit.setAtUtc},edit]}).earned.find(e=>e.badgeId==="called_it")?.evidence).toMatchObject({targetVersionId:"target-v1"});
 });
 it.each([["2026-03-29",true],["2026-03-30",false],["2026-03-16",false]])("comeback second date %s -> %s",(second,qualifies)=>{
  expect(ids([session("old","2026-03-01"),session("return","2026-03-16"),session("second",second,undefined,7200000)]).includes("back_at_it")).toBe(qualifies);
 });
 it("requires history and 14 full dates, not a difference of 14 dates",()=>{
  expect(ids([session("return","2026-03-16"),session("next","2026-03-17")])).not.toContain("back_at_it");
  expect(ids([session("old","2026-03-01"),session("return","2026-03-15"),session("next","2026-03-16")])).not.toContain("back_at_it");
 });
 it("counts reliable ambiguous import dates for plates but not exact-identity medals",()=>{
  const h=dates(10).map(s=>({...s,importKey:`file|${s.id}`,sets:s.sets.map(x=>({...x,identityReliable:false}))}));
  const replay=evaluateAchievements([...h,{...h[0]!,id:"duplicate"}]);expect(replay.stats.qualifyingDays).toBe(10);expect(replay.earned.map(e=>e.badgeId)).toContain("lifetime_plate_10");expect(replay.earned.map(e=>e.badgeId)).not.toContain("dedicated_days_10");
 });
 it("replays shuffled history and incremental reconciliation identically including crossing evidence",()=>{
  const h=dates(105).map((s,i)=>({...s,sets:[set(`${s.id}s`,70,8+Math.floor(i/10))]}));
  let stored: StoredAchievement[]=[];
  for(let i=1;i<=h.length;i++){
   const replay=evaluateAchievements(h.slice(0,i)).earned;
   for(const op of reconcileAchievements(stored,replay)){
    if(op.kind==="insert") stored.push({id:`row${stored.length}`,badgeId:op.event.badgeId,status:"earned",primarySessionId:op.event.primarySessionId,primarySetId:op.event.primarySetId,evidence:op.event.evidence,earnedLocalDate:op.event.earnedLocalDate});
    else throw new Error(`Unexpected reconciliation: ${op.kind}`);
   }
  }
  const replay=evaluateAchievements([...h].reverse()).earned;
  expect(stored.map(r=>[r.badgeId,r.earnedLocalDate,r.evidence])).toEqual(replay.map(e=>[e.badgeId,e.earnedLocalDate,e.evidence]));
  expect(reconcileAchievements(stored,replay)).toEqual([]);
 });
});
