import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CATALOG } from "../src/db/libraryDraft";
import { translate } from "../src/i18n/format";
import { nodes, texts } from "./achievementRender";
import { GYM_EQUIPMENT } from "../src/logic/gymInput";

const runtime = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, lang: "en" as "en" | "ar" }));
const services = vi.hoisted(() => ({
  programmes: { seedKeyMap: vi.fn(), listExercises: vi.fn(), createProgramme: vi.fn() },
  repos: { getRepCeilingDefaults: vi.fn(), setSetting: vi.fn() },
  gyms: {},
}));
const navigation = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock("react", async orig => {
  const state = <T,>(initial: T | (() => T)) => {
    const i = runtime.cursor++;
    if (i >= runtime.slots.length) runtime.slots[i] = typeof initial === "function" ? (initial as () => T)() : initial;
    return [runtime.slots[i] as T, (value: T | ((before: T) => T)) => { runtime.slots[i] = typeof value === "function" ? (value as (before:T)=>T)(runtime.slots[i] as T) : value; }] as const;
  };
  return (await import("./achievementRender")).mockReactHooks(await orig(), { useState: state, useRef: <T,>(value:T) => state({current:value})[0] });
});
vi.mock("@react-navigation/native", () => ({ useFocusEffect: () => {}, useNavigation: () => navigation }));
vi.mock("react-native", () => ({ View: "View", Pressable: "Pressable", StyleSheet: {create: (s:unknown)=>s}, useWindowDimensions:()=>({fontScale:1,width:375,height:667}) }));
vi.mock("../src/AppContext", () => ({ useServices: () => services }));
vi.mock("../src/i18n", () => ({ useI18n: () => ({ lang: runtime.lang, t: (k:Parameters<typeof translate>[1],p?:Record<string,string|number>) => translate(runtime.lang,k,p) }) }));
vi.mock("../src/theme", () => ({ space:{xs:4,sm:8,md:12,lg:16},type:{label:14},usePalette:()=>({muted:"muted"}) }));
vi.mock("../src/ui", () => ({ AppText:"AppText",BigButton:"BigButton",Chip:"Chip",Field:"Field",Notice:"Notice",Screen:"Screen",SectionTitle:"SectionTitle" }));
vi.mock("../src/components/coach/MusclePriorityGrid", () => ({ MusclePriorityGrid:"MusclePriorityGrid" }));
vi.mock("../src/components/SettingsRows", () => ({ SwitchRow:"SwitchRow" }));
import { ProgramGenerateScreen } from "../src/screens/ProgramGenerateScreen";
import { GeneratedProgrammeHero } from "../src/components/coach/GeneratedProgrammeHero";

const keys = new Map(CATALOG.map(c=>[c.key,{exerciseId:c.key,equipment:c.equipment}]));
const render = () => { runtime.cursor=0; return nodes(ProgramGenerateScreen()); };
const toggle = () => render().find(n=>n.type==="SwitchRow")!;
const preview = () => render().find(n=>n.type===GeneratedProgrammeHero);
const flush = () => new Promise<void>(resolve=>setImmediate(resolve));
const build = async () => { render().find(n=>n.type==="BigButton" && n.props.label===translate(runtime.lang,"coach.generate"))!.props.onPress(); await flush(); };
beforeEach(() => {
  runtime.slots=[];runtime.cursor=0;runtime.lang="en";vi.clearAllMocks();
  services.programmes.seedKeyMap.mockResolvedValue(keys);
  services.programmes.listExercises.mockResolvedValue(CATALOG.map(c=>({id:c.key,seedKey:c.key,nameEn:c.en,nameAr:c.ar})));
  services.programmes.createProgramme.mockResolvedValue({programmeId:"new",versionId:"new-version"});
  services.repos.getRepCeilingDefaults.mockResolvedValue({upper:10,lower:12,lateral_raise:15});
});

describe("Build me a program: skip-leg control and preview lifecycle", () => {
  it.each(["en","ar"] as const)("%s defaults off, explains the scope, and passes the exact displayed draft to save", async lang => {
    runtime.lang=lang;
    expect(toggle().props.value).toBe(false);
    expect(toggle().props.label).toBe(translate(lang,"coach.skipLegs"));
    expect(toggle().props.note).toBe(translate(lang,"coach.skipLegs.note"));
    await build(); expect(preview()).toBeDefined();
    toggle().props.onChange(true); expect(preview()).toBeUndefined();
    await build();const shown=preview()!;expect(shown).toBeDefined();expect(shown.props.preview.draft.days).toHaveLength(4);
    shown.props.onSave();await flush();
    expect(services.programmes.createProgramme).toHaveBeenCalledOnce();
    expect(services.programmes.createProgramme.mock.calls[0]![0]).toBe(shown.props.preview.draft);
    expect(services.programmes.createProgramme.mock.calls[0]![1]).toMatchObject({activate:true});
    expect(navigation.navigate).toHaveBeenCalledOnce();
  });
  it.each([3,6])("the screen keeps all %i selected days in its preview and save request", async days => {
    render().find(n=>n.type==="Chip" && String(n.props.label).replace(/[\u2066-\u2069]/g,"")===String(days))!.props.onPress();
    toggle().props.onChange(true);await build();
    const shown=preview()!;expect(shown.props.preview.draft.days).toHaveLength(days);
    shown.props.onSave();await flush();
    expect(services.programmes.createProgramme.mock.calls[0]![0]).toBe(shown.props.preview.draft);
  });
  it("changing the option in either direction clears an existing preview", async () => {
    toggle().props.onChange(true);await build();expect(preview()).toBeDefined();
    toggle().props.onChange(false);expect(preview()).toBeUndefined();
    await build();expect(preview()).toBeDefined();toggle().props.onChange(true);expect(preview()).toBeUndefined();
  });
  it("an earlier asynchronous build cannot restore a preview after the option changed", async () => {
    let resolve!: (value:typeof keys)=>void;
    services.programmes.seedKeyMap.mockReturnValueOnce(new Promise<typeof keys>(r=>{resolve=r;}));
    toggle().props.onChange(true);
    render().find(n=>n.type==="BigButton" && n.props.label===translate("en","coach.generate"))!.props.onPress();
    toggle().props.onChange(false);resolve(keys);await flush();
    expect(preview()).toBeUndefined();expect(services.programmes.createProgramme).not.toHaveBeenCalled();
  });
  it.each(["en","ar"] as const)("%s impossible equipment choice shows an explanation with no saveable partial preview", async lang => {
    runtime.lang=lang;toggle().props.onChange(true);await build();expect(preview()).toBeDefined();
    for (const eq of GYM_EQUIPMENT) {
      const label=translate(lang,`coach.eq.${eq}`);
      render().find(n=>n.type==="Chip" && n.props.label===label)!.props.onPress();
    }
    await build();expect(preview()).toBeUndefined();
    const notice=render().find(n=>n.type==="Notice")!;
    expect(notice.props.children).toBe(translate(lang,"coach.skipLegs.unavailable",{n:4}));
    expect(services.programmes.createProgramme).not.toHaveBeenCalled();
    expect(navigation.navigate).not.toHaveBeenCalled();
    expect(texts(React.createElement("AppText",null,notice.props.children)).join(" ")).not.toContain("undefined");
  });
});
