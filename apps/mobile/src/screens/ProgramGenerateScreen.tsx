import type { EquipmentType } from "@gain/engine";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
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
  RANKABLE_MUSCLES,
  parseMusclePriorities,
  serializeMusclePriorities,
  type MusclePriorities,
  type MuscleRank,
} from "../logic/musclePriority";
import {
  generateProgramme,
  type GeneratedProgramme,
  type GeneratorExperience,
  type GeneratorGoal,
} from "../logic/programGenerator";
import { space, type as ty, usePalette } from "../theme";
import { AppText, BigButton, Chip, Field, Notice, Screen, SectionTitle } from "../ui";
import { GeneratedProgrammeHero } from "../components/coach/GeneratedProgrammeHero";

const GOALS: GeneratorGoal[] = ["hypertrophy", "strength", "general"];
const LEVELS: GeneratorExperience[] = ["beginner", "intermediate"];
const RANKS: MuscleRank[] = ["priority", "normal", "maintenance", "reduced"];

function splitAvoid(text: string): string[] {
  return text.split(/[,،;]+/).map((s) => s.trim()).filter(Boolean);
}

export function ProgramGenerateScreen() {
  const { programmes, repos, gyms } = useServices();
  const { t, lang } = useI18n();
  const p = usePalette();
  const nav = useNavigation<{ goBack: () => void; navigate: (n: "ProgrammeEdit", params?: { programmeId: string }) => void }>();
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

  function toggleEq(eq: EquipmentType) {
    setEquipment((cur) => (cur.includes(eq) ? cur.filter((x) => x !== eq) : [...cur, eq]));
    setPreview(null);
  }

  async function build() {
    setMessage(null);
    const [seedKeys, ceilings, lib] = await Promise.all([programmes.seedKeyMap(), repos.getRepCeilingDefaults(), programmes.listExercises()]);
    setLibrary(lib);
    const eq = equipment.length > 0 ? equipment : [...GYM_EQUIPMENT];
    const got = generateProgramme(
      { goal, experience, daysPerWeek: days, sessionMinutes: minutes, equipment: eq, priorities, avoid: splitAvoid(avoidText), lang },
      { byKey: seedKeys },
      (key) => ceilingForName(lib.find((e) => e.seedKey === key)?.nameEn ?? key, ceilings),
    );
    if (!got) return setMessage(t("ob.programme.none", { n: days }));
    setPreview(got);
  }

  async function save() {
    if (!preview || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await repos.setSetting("muscle_priorities", serializeMusclePriorities(priorities));
      const made = await programmes.createProgramme(preview.draft, { activate: true });
      nav.navigate("ProgrammeEdit", { programmeId: made.programmeId });
      setBusy(false);
    } catch (e) {
      setBusy(false);
      if (e instanceof SessionInProgress) setMessage(t("prog.openWorkout"));
      else if (e instanceof DraftInvalid) setMessage(t("ob.error"));
      else setMessage(t("prog.switch.error"));
    }
  }

  return (
    <Screen>
      <AppText style={{ color: p.muted }}>{t("coach.build.note")}</AppText>
      {message ? <Notice kind="warn">{message}</Notice> : null}

      <SectionTitle>{t("coach.goal")}</SectionTitle>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {GOALS.map((g) => (
          <Chip key={g} label={t(`coach.goal.${g}` as StringKey)} selected={goal === g} onPress={() => { setGoal(g); setPreview(null); }} />
        ))}
      </View>
      <SectionTitle>{t("coach.experience")}</SectionTitle>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {LEVELS.map((l) => (
          <Chip key={l} label={t(`coach.experience.${l}` as StringKey)} selected={experience === l} onPress={() => { setExperience(l); setPreview(null); }} />
        ))}
      </View>
      <SectionTitle>{t("coach.days")}</SectionTitle>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {DAYS_OPTIONS.map((d) => (
          <Chip key={d} label={isolateLtr(String(d))} selected={days === d} onPress={() => { setDays(d); setPreview(null); }} />
        ))}
      </View>
      <SectionTitle>{t("coach.minutes")}</SectionTitle>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {MINUTES_OPTIONS.map((m) => (
          <Chip key={m} label={t("ob.minutesValue", { n: m })} selected={minutes === m} onPress={() => { setMinutes(m); setPreview(null); }} />
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
      {RANKABLE_MUSCLES.map((g) => (
        <View key={g} style={{ gap: space.xs }}>
          <AppText style={{ fontWeight: "600" }} accessibilityRole="header">{t(`muscle.${g}` as StringKey)}</AppText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            {RANKS.map((r) => (
              <Chip
                key={r}
                label={t(`coach.rank.${r}` as StringKey)}
                selected={(priorities[g] ?? "normal") === r}
                onPress={() => {
                  setPriorities((cur) => ({ ...cur, [g]: r }));
                  setPreview(null);
                }}
              />
            ))}
          </View>
        </View>
      ))}

      <Field label={t("coach.avoid")} hint={t("coach.avoid.hint")} value={avoidText} onChangeText={(s) => { setAvoidText(s); setPreview(null); }} />
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
