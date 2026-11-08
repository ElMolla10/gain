import { beforeEach, describe, expect, it, vi } from "vitest";
import { CATALOG } from "../src/db/libraryDraft";
import type { LibraryExercise } from "../src/db/programmeRepo";
import { translate } from "../src/i18n/format";
import { generateProgramme } from "../src/logic/programGenerator";
import { GYM_EQUIPMENT } from "../src/logic/gymInput";
import { flat, nodes, texts } from "./achievementRender";

const display=vi.hoisted(()=>({lang:"en" as "en"|"ar",fontScale:1}));
vi.mock("react-native",()=>({View:"View",StyleSheet:{create:(s:unknown)=>s},useWindowDimensions:()=>({width:320,height:667,fontScale:display.fontScale})}));
vi.mock("../src/i18n",()=>({useI18n:()=>({lang:display.lang,t:(k:Parameters<typeof translate>[1],p?:Record<string,string|number>)=>translate(display.lang,k,p)})}));
vi.mock("../src/theme",()=>({space:{xs:4,sm:8,md:12,lg:16},type:{},usePalette:()=>({text:"text",muted:"muted"})}));
vi.mock("../src/ui",()=>({AppText:"AppText",BigButton:"BigButton",Card:"Card"}));
import { GeneratedProgrammeHero } from "../src/components/coach/GeneratedProgrammeHero";

const library=CATALOG.map(c=>({id:c.key,seedKey:c.key,nameEn:c.en,nameAr:c.ar})) as unknown as LibraryExercise[];
const byKey=new Map(CATALOG.map(c=>[c.key,{exerciseId:c.key,equipment:c.equipment}]));
const clean=(s:string)=>s.replace(/[\u2066-\u2069]/g,"");
const style=(s:unknown)=>Object.assign({},...(Array.isArray(s)?s:[s]));
beforeEach(()=>{display.lang="en";display.fontScale=1;});

// Component contracts are not native pixel/layout or VoiceOver verification.
describe("exact generated preview in English and Egyptian Arabic",()=>{
  it.each(["en","ar"] as const)("%s renders all six days, exact names and prescriptions with localized counts",lang=>{
    display.lang=lang;
    const preview=generateProgramme({goal:"hypertrophy",experience:"intermediate",daysPerWeek:6,sessionMinutes:75,equipment:[...GYM_EQUIPMENT],priorities:{},avoid:[],lang,skipLegs:true},{byKey},()=>10)!;
    const tree=GeneratedProgrammeHero({preview,library,minutes:75,busy:false,onSave:vi.fn()});
    const copy=texts(tree).map(clean);
    for(const day of preview.draft.days){
      expect(copy).toContain(day.name);
      for(const e of day.exercises){
        const exercise=library.find(l=>l.id===e.exerciseId)!;
        expect(copy.some(s=>s.endsWith(lang==="ar"?exercise.nameAr!:exercise.nameEn))).toBe(true);
        expect(copy).toContain(`${e.sets} × ${e.repMin}-${e.repMax}`);
      }
    }
    expect(copy.join(" ")).toContain(lang==="ar"?"مجموعات في الأسبوع":"weekly sets");
    if(lang==="ar") expect(copy.join(" ")).not.toMatch(/movements|exercises|weekly sets/);
    const save=nodes(tree).find(n=>n.type==="BigButton")!;
    expect(save.props.label).toBe(translate(lang,"coach.blueprint.launch"));
  });
  it.each(["en","ar"] as const)("%s stacks name and prescription at large text without shrinking or truncating them",lang=>{
    display.lang=lang;display.fontScale=2.14;
    const preview=generateProgramme({goal:"general",experience:"beginner",daysPerWeek:3,sessionMinutes:30,equipment:[...GYM_EQUIPMENT],priorities:{},avoid:[],lang,skipLegs:true},{byKey},()=>10)!;
    const tree=GeneratedProgrammeHero({preview,library,minutes:30,busy:false,onSave:vi.fn()});
    const rows=nodes(tree).filter(n=>n.type==="View" && Array.isArray(n.props.children) && clean(flat(n.props.children[0]?.props?.children)).match(/^\d+\. /));
    expect(rows.length).toBe(preview.draft.days.reduce((n,d)=>n+d.exercises.length,0));
    for(const row of rows){
      expect(style(row.props.style).flexDirection).toBe("column");
      expect(row.props.children[0].props.numberOfLines).toBeUndefined();
      expect(row.props.children[0].props.adjustsFontSizeToFit).toBeUndefined();
      expect(style(row.props.children[1].props.style).width).toBeUndefined();
    }
  });
});
