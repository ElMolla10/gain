import type { GymLoadSpec } from "@gain/engine";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../src/i18n/format";
import { defaultGymLoads } from "../src/logic/defaultGym";
import { todayHero, type HeroExercise, type TodayHero } from "../src/logic/todayHero";
import { byType, expand, texts } from "./achievementRender";

const settings = vi.hoisted(() => ({ lang: "en" as "en" | "ar", fontScale: 1, unit: "kg" as "kg" | "lb" }));
vi.mock("react", async (orig) => (await import("./achievementRender")).mockReactHooks(await orig(), { useContext: () => null }));
vi.mock("react-native", () => ({ View: "View", Pressable: "Pressable", useWindowDimensions: () => ({ fontScale: settings.fontScale, width: 400, height: 800 }) }));
vi.mock("react-native-svg", () => ({ Image: "SvgImage", default: "Svg", Circle: "Circle", Defs: "Defs", Ellipse: "Ellipse", G: "G", Line: "Line", LinearGradient: "LinearGradient", Path: "Path", Polygon: "Polygon", Rect: "Rect", Stop: "Stop", Text: "SvgText" }));
vi.mock("../src/i18n", () => ({ useI18n: () => ({ lang: settings.lang, unit: settings.unit, direction: settings.lang === "ar" ? "rtl" : "ltr", t: (k: Parameters<typeof translate>[1], p?: Record<string, string | number>) => translate(settings.lang, k, p) }) }));
vi.mock("../src/theme", () => ({
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  type: { display: 48, load: 36, title: 28, section: 20, body: 16, label: 14, caption: 13 },
  usePalette: () => ({ muted: "muted", text: "text", edge: "edge", accent: "accent" }),
  useIsDark: () => true,
}));
vi.mock("../src/ui", () => ({ AppText: "AppText", QuietAction: "QuietAction" }));

import { TodayBar } from "../src/components/today/TodayBar";

const gym = (extra: GymLoadSpec[] = []) => ({ gymId: "g", loads: [...defaultGymLoads("kg").filter((s) => !extra.some((e) => e.equipment === s.equipment)), ...extra] });
const ex = (over: Partial<HeroExercise> = {}): HeroExercise => ({ exerciseId: "bench", nameEn: "Barbell Bench Press", nameAr: "بنش برس", equipment: "barbell", setup: "free", measure: "reps", pattern: "horizontal_push", loadSpec: null, isGoalLift: true, ...over });
const hero = (load: number, over: Partial<HeroExercise> = {}, g = gym(), reps = 6, normalLoad?: number): TodayHero => todayHero({ target: { exerciseId: "bench", load, reps, measure: "reps" }, exercise: ex(over), gym: g, normalLoad })!;
const strip = (s: string) => s.replace(/[\u2066-\u2069]/g, "").replace(/\u00a0/g, " ");


import { StackArt, knownLoadLabel } from "../src/components/today/EquipmentArt";
const compact=(h:TodayHero)=>expand(React.createElement(TodayBar,{hero:h,name:h.kind==="firstRun"?"Workout":h.nameEn,compact:true}));
const stamps=(tree:unknown)=>byType(tree,"SvgText").map(n=>n.props.children);
const pictures=(tree:unknown)=>byType(tree,"SvgImage").map(n=>n.props.href);
beforeEach(()=>{settings.lang="en";settings.unit="kg";settings.fontScale=1;});
describe("premium Today equipment",()=>{
 it.each([10,12.5])("shows %s kg per dumbbell, never a doubled pair weight",load=>{
  const h=hero(load,{equipment:"dumbbell",nameEn:"Dumbbell Lateral Raise"},gym(),11);const tree=compact(h);
  expect(stamps(tree)).toEqual([String(load)]);expect(pictures(tree)).toHaveLength(2);
  expect(strip(texts(tree).join(" "))).toContain(`${load} kg each`);
 });
 it("keeps the same art and frame while units or the resolved target change",()=>{
  const kg=compact(hero(12.5,{equipment:"dumbbell"}));settings.unit="lb";const lb=compact(hero(12.5,{equipment:"dumbbell"}));
  expect(stamps(lb)).toEqual(["27.6"]);expect(pictures(lb)).toEqual(pictures(kg));expect(byType(lb,"Svg")[0]!.props.height).toBe(byType(kg,"Svg")[0]!.props.height);
  settings.unit="kg";const ease=compact(hero(10,{equipment:"dumbbell"},gym(),11,12.5));expect(stamps(ease)).toEqual(["10"]);expect(pictures(ease)).toEqual(pictures(kg));
 });
 it("supports single-dumbbell metadata and keeps timed holds single",()=>{
  const single=compact(hero(12.5,{equipment:"dumbbell",dumbbellCount:1}));expect(pictures(single)).toHaveLength(1);expect(strip(texts(single).join(" "))).toContain("One dumbbell");
  const hold=todayHero({target:{exerciseId:"x",load:10,reps:null,measure:"time",durationS:30},exercise:ex({equipment:"dumbbell",measure:"time"}),gym:gym()})!;
  expect(pictures(compact(hold))).toHaveLength(1);
 });
 it.each([[70,"Machine Chest Press"],[47.5,"Seated Leg Curl"]])("prints the resolved %s machine target without guessing a hole",(load,name)=>{
  const h=hero(Number(load),{equipment:"machine",machineLoadKind:"pin",nameEn:String(name)});expect(h.kind).toBe("stack");
  const tree=compact(h);expect(stamps(tree)).toEqual([String(load)]);
  const stamp=byType(tree,"SvgText")[0]!;const holes=byType(tree,"Ellipse").filter(n=>n.props.fill==="#080b08");
  expect(holes.every(n=>n.props.cx!==stamp.props.x)).toBe(true);
 });
 it("places a known pin at the actual configured hole, including fractional rungs",()=>{
  const h=hero(47.5,{equipment:"machine",machineLoadKind:"pin",stackSpec:{equipment:"machine",loads:[10,20,30,47.5,60]}});
  if(h.kind!=="stack")throw new Error("stack");expect(h.pinIndex).toBe(4);
  const tree=compact(h);const hole=byType(tree,"Ellipse").filter(n=>n.props.fill==="#080b08")[3]!;
  const knob=byType(tree,"Rect").find(n=>n.props.width===22)!;expect(knob.props.x+10).toBe(hole.props.cx);expect(knob.props.y+3.5).toBe(hole.props.cy);
 });
 it("does not map an off-grid or over-maximum manual target to a hole",()=>{
  for(const load of [47.5,105]){const h=hero(load,{equipment:"machine",stackSpec:{equipment:"machine",min:5,increment:5,max:100}});if(h.kind!=="stack")throw new Error("stack");expect(h.pinIndex).toBeNull();}
 });
 it("uses the stack for timed pin-loaded work and preserves the resolved quantity",()=>{
  const h=todayHero({target:{exerciseId:"x",load:12.5,reps:null,measure:"time",durationS:30},exercise:ex({equipment:"machine",measure:"time"}),gym:null})!;
  expect(h.kind).toBe("stack");const tree=compact(h);expect(stamps(tree)).toEqual(["12.5"]);expect(strip(texts(tree).join(" "))).toContain("30");
 });
 it("keeps missing targets unnumbered before gym metadata loads",()=>{
  for(const equipment of ["dumbbell","machine"] as const){const h=todayHero({target:null,exercise:ex({equipment}),gym:null})!;expect(h.kind).toBe("unloaded");const tree=compact(h);expect(stamps(tree)).toEqual([]);expect(pictures(tree).length).toBeGreaterThan(0);}
  expect(knownLoadLabel(null,"kg")).toBeNull();expect(knownLoadLabel(NaN,"kg")).toBeNull();
 });
 it("keeps plate-loaded machines on HornArt and assistance as assistance",()=>{
  expect(hero(60,{equipment:"machine",machineLoadKind:"plate"}).kind).toBe("horn");
  const assisted=hero(25,{equipment:"assisted",setup:"assisted"});expect(assisted.kind).toBe("assisted");const tree=compact(assisted);expect(strip(texts(tree).join(" "))).toContain("Assistance");expect(stamps(tree)).toEqual(["25"]);
 });
 it("does not mirror the numeric stamp in Arabic RTL",()=>{
  settings.lang="ar";const tree=compact(hero(12.5,{equipment:"dumbbell"}));expect(stamps(tree)).toEqual(["12.5"]);expect(byType(tree,"Svg")[0]!.props.style.direction).toBe("ltr");
 });
});
