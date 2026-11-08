import type { EquipmentType } from "@gain/engine";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import React, { useCallback, useRef, useState } from "react";
import { View } from "react-native";
import { useServices } from "../AppContext";
import { DraftInvalid, SessionInProgress, type LibraryExercise } from "../db/programmeRepo";
import { useI18n } from "../i18n";
import { isolateLtr } from "../i18n/format";
import type { StringKey } from "../i18n/strings";
import { ceilingForName } from "../logic/ceilings";
import { DAYS_OPTIONS, MINUTES_OPTIONS } from "../logic/onboarding";
import { GYM_EQUIPMENT } from "../logic/gymInput";
import {
  parseMusclePriorities,
  serializeMusclePriorities,
  type MusclePriorities,
} from "../logic/musclePriority";
import { MusclePriorityGrid } from "../components/coach/MusclePriorityGrid";
import {
  generateProgramme,
  type GeneratedProgramme,
  type GeneratorExperience,
  type GeneratorGoal,
} from "../logic/programGenerator";
import { space, type as ty, usePalette } from "../theme";
import { AppText, BigButton, Chip, Field, Notice, Screen, SectionTitle } from "../ui";
import { SwitchRow } from "../components/SettingsRows";
import { GeneratedProgrammeHero } from "../components/coach/GeneratedProgrammeHero";

const GOALS: GeneratorGoal[] = ["hypertrophy", "strength", "general"];
const LEVELS: GeneratorExperience[] = ["beginner", "intermediate"];

function splitAvoid(text: string): string[] {
  return text.split(/[,،;]+/).map((s) => s.trim()).filter(Boolean);
}

export function ProgramGenerateScreen() {
  const { programmes, repos, gyms } = useServices();
  const { t, lang } = useI18n();
  const p = usePalette();
  const nav = useNavigation<{ goBack: () => void; navigate: (name: string, params?: object) => void }>();
  const [skipLegs, setSkipLegs] = useState(false);
  const generation = useRef(0);
  const [goal, setGoal] = useState<GeneratorGoal>("hypertrophy");
  const [experience, setExperience] = useState<GeneratorExperience>("intermediate");
  const [days, setDays] = useState(4);
  const [minutes, setMinutes] = useState(75);
  const [equipment, setEquipment] = useState<EquipmentType[]>([...GYM_EQUIPMENT]);
  const [priorities, setPriorities] = useState<MusclePriorities>({});
  const [avoidText, setAvoidText] = useState("");
  const [preview, setPreview] = useState<GeneratedProgramme | null>(null);
  const [library, setLibrary] = useState<LibraryExercise[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const activatingRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void (async () => {
        const [raw, gymId, dpw, mins] = await Promise.all([
          repos.getSetting("muscle_priorities"),
          repos.getActiveGymId(),
          repos.getSetting("days_per_week"),
          repos.getSetting("session_minutes"),
        ]);
        if (!alive) return;
        setPriorities(parseMusclePriorities(raw));
        const n = Number(dpw);
        if (Number.isInteger(n) && n >= 2 && n <= 6) setDays(n);
        const m = Number(mins);
        if (Number.isInteger(m) && m >= 30) setMinutes(MINUTES_OPTIONS.includes(m as (typeof MINUTES_OPTIONS)[number]) ? m : 75);
        if (gymId) {
          const g = await gyms.getGym(gymId);
          if (alive && g && g.loads.length > 0) setEquipment(g.loads.map((l) => l.equipment));
        }
      })();
      return () => {
        alive = false;
      };
    }, [repos, gyms]),
  );

  function clearPreview() {
    generation.current++;
    setPreview(null);
    setMessage(null);
  }

  function toggleEq(eq: EquipmentType) {
    setEquipment((cur) => (cur.includes(eq) ? cur.filter((x) => x !== eq) : [...cur, eq]));
    clearPreview();
  }

  async function build() {
    const request = ++generation.current;
    setPreview(null);
    setMessage(null);
    const [seedKeys, ceilings, lib] = await Promise.all([programmes.seedKeyMap(), repos.getRepCeilingDefaults(), programmes.listExercises()]);
    if (request !== generation.current) return;
    setLibrary(lib);
    const eq = skipLegs ? equipment : equipment.length > 0 ? equipment : [...GYM_EQUIPMENT];
    const got = generateProgramme(
      { skipLegs, goal, experience, daysPerWeek: days, sessionMinutes: minutes, equipment: eq, priorities, avoid: splitAvoid(avoidText), lang },
      { byKey: seedKeys },
      (key) => ceilingForName(lib.find((e) => e.seedKey === key)?.nameEn ?? key, ceilings),
    );
    if (!got) return setMessage(t(skipLegs ? "coach.skipLegs.unavailable" : "ob.programme.none", { n: days }));
    setPreview(got);
  }

  async function save() {
    if (!preview || busy || activatingRef.current) return;
    activatingRef.current = true;
    setBusy(true);
    setMessage(null);
    try {
      await programmes.createProgramme(preview.draft, {
        activate: true,
        alsoInTransaction: async () => {
          await repos.setSetting("muscle_priorities", serializeMusclePriorities(priorities));
        },
      });
      nav.navigate("Tabs", { screen: "Programme", params: { activated: true } });
    } catch (e) {
      if (e instanceof SessionInProgress) setMessage(t("prog.openWorkout"));
      else if (e instanceof DraftInvalid) setMessage(t("ob.error"));
      else setMessage(t("prog.switch.error"));
    } finally {
      activatingRef.current = false;
      setBusy(false);
    }
  }

  return (
    <Screen>
      <AppText style={{ color: p.muted }}>{t("coach.build.note")}</AppText>
      {message ? <Notice kind="error">{message}</Notice> : null}

      <SectionTitle>{t("coach.goal")}</SectionTitle>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {GOALS.map((g) => (
          <Chip key={g} label={t(`coach.goal.${g}` as StringKey)} selected={goal === g} onPress={() => { setGoal(g); clearPreview(); }} />
        ))}
      </View>
      <SectionTitle>{t("coach.experience")}</SectionTitle>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {LEVELS.map((l) => (
          <Chip key={l} label={t(`coach.experience.${l}` as StringKey)} selected={experience === l} onPress={() => { setExperience(l); clearPreview(); }} />
        ))}
      </View>
      <SectionTitle>{t("coach.days")}</SectionTitle>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {DAYS_OPTIONS.map((d) => (
          <Chip key={d} label={isolateLtr(String(d))} selected={days === d} onPress={() => { setDays(d); clearPreview(); }} />
        ))}
      </View>
      <SwitchRow label={t("coach.skipLegs")} note={t("coach.skipLegs.note")} value={skipLegs} onChange={(value) => { setSkipLegs(value); clearPreview(); }} />
      <SectionTitle>{t("coach.minutes")}</SectionTitle>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {MINUTES_OPTIONS.map((m) => (
          <Chip key={m} label={t("ob.minutesValue", { n: m })} selected={minutes === m} onPress={() => { setMinutes(m); clearPreview(); }} />
        ))}
      </View>
      <SectionTitle>{t("coach.equipment")}</SectionTitle>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {GYM_EQUIPMENT.map((eq) => (
          <Chip key={eq} label={t(`coach.eq.${eq}` as StringKey)} selected={equipment.includes(eq)} onPress={() => toggleEq(eq)} />
        ))}
      </View>

      <SectionTitle>{t("coach.priority.title")}</SectionTitle>
      <AppText style={{ color: p.muted, fontSize: ty.label }}>{t("coach.priority.note")}</AppText>
      <MusclePriorityGrid
        priorities={priorities}
        onSetRank={(g, r) => {
          setPriorities((cur) => ({ ...cur, [g]: r }));
          clearPreview();
        }}
      />

      <Field label={t("coach.avoid")} hint={t("coach.avoid.hint")} value={avoidText} onChangeText={(s) => { setAvoidText(s); clearPreview(); }} />
      <BigButton label={t("coach.generate")} onPress={() => void build()} />

      {preview ? (
        <GeneratedProgrammeHero
          preview={preview}
          library={library}
          minutes={minutes}
          busy={busy}
          onSave={() => void save()}
        />
      ) : null}
    </Screen>
  );
}
