import { useNavigation } from "@react-navigation/native";
import { HealthNote } from "../components/HealthNote";
import { buildFlags } from "../buildConfig";
import { UpdateCard } from "../components/UpdateCard";
import { hasSelfUpdater } from "../logic/buildFlags";
import React, { useCallback, useEffect, useState } from "react";
import type { CeilingClass, RepCeilings } from "@gain/engine";
import { View } from "react-native";
import { useServices } from "../AppContext";
import { useI18n } from "../i18n";
import { space, type as ty, useAppearance, usePalette, setAppearance, APPEARANCES } from "../theme";
import { AppText, Chip, InlineStatus, Screen, Stepper } from "../ui";
import { Block, Group, LinkRow, SelectRow, SwitchRow } from "../components/SettingsRows";
import { unitLabel } from "../logic/units";
import type { StringKey } from "../i18n/strings";
import Constants from "expo-constants";
import { defaultGymLoads, isStandardRack } from "../logic/defaultGym";
import { loadReminderSettings, REMINDER_KEYS, reminderText, serializeDays, serializeTime, syncReminders, toggleDay, type ReminderSettings } from "../logic/reminders";
import { loadRestSettings, REST_CHOICES, REST_KEYS, type RestSettings } from "../logic/restAlert";

const KINDS: CeilingClass[] = ["upper", "lower", "lateral_raise"];

/** The default rep ceilings (reps at which load goes up) per kind of lift. Per-lift overrides live on the program row. */
function CeilingsCard() {
  const { t } = useI18n();
  const { repos } = useServices();
  const [c, setC] = useState<RepCeilings | null>(null);
  const [useGain, setUseGain] = useState(false);
  useEffect(() => {
    void repos.getRepCeilingDefaults().then(setC);
    void repos.getUseGainCeilings().then(setUseGain);
  }, [repos]);
  const bump = useCallback(
    async (kind: CeilingClass, d: number) => {
      if (!c) return;
      setC(await repos.setRepCeilingDefaults({ [kind]: Math.min(100, Math.max(1, c[kind] + d)) }));
    },
    [repos, c],
  );
  if (!c) return null;
  return (
    <Block title={t("settings.ceilings")} note={t("settings.ceilings.note")}>
      <SwitchRow
        label={t("settings.gainCeil")}
        note={t("settings.gainCeil.note")}
        value={useGain}
        onChange={(on) => {
          setUseGain(on);
          void repos.setUseGainCeilings(on);
        }}
      />
      {KINDS.map((k) => (
        <Stepper key={k} label={t(`settings.ceilings.${k}` as const)} value={c[k]} min={1} max={100} onChange={(n) => void bump(k, n - c[k])} />
      ))}
    </Block>
  );
}

/** Which day the training week starts on (Monday by default). Decides the week the weekly review covers. */
function WeekStartCard() {
  const { t } = useI18n();
  const { weekly } = useServices();
  const [day, setDay] = useState<number | null>(null);
  useEffect(() => {
    void weekly.weekStartsOn().then(setDay);
  }, [weekly]);
  if (day === null) return null;
  return (
    <Block title={t("weekly.settings.weekStart")}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {[6, 0, 1, 2, 3, 4, 5].map((d) => (
          <Chip key={d} label={t(`weekly.day.${d}` as StringKey)} selected={day === d} onPress={() => void weekly.setWeekStartsOn(d).then(() => setDay(d))} />
        ))}
      </View>
    </Block>
  );
}

/**
 * After a unit switch the silent default gym follows: an untouched standard rack is swapped for the new unit's standard rack.
 * No screen, no question. A rack that was edited (only possible through restore/import of older data) is never touched.
 */
function useSilentRackSync() {
  const { unit } = useI18n();
  const { repos, gyms } = useServices();
  useEffect(() => {
    (async () => {
      const id = await repos.getActiveGymId();
      const g = id ? await gyms.getGym(id) : null;
      const other = unit === "kg" ? "lb" : "kg";
      if (g && isStandardRack(g.loads, other) && !isStandardRack(g.loads, unit)) await gyms.updateGym(g.id, { name: g.name, loads: defaultGymLoads(unit) });
    })().catch(() => undefined);
  }, [repos, gyms, unit]);
}

/** Opt-in reminders on the chosen weekdays at a chosen time (local notifications; off by default; not verified on a phone). */
function ReminderCard() {
  const { t, lang } = useI18n();
  const p = usePalette();
  const { repos, reminders } = useServices();
  const [s, setS] = useState<ReminderSettings | null>(null);
  const [note, setNote] = useState<StringKey | null>(null);
  useEffect(() => {
    void loadReminderSettings(repos).then(setS);
  }, [repos]);
  if (!s) return null;
  const apply = async (next: ReminderSettings) => {
    await repos.setSetting(REMINDER_KEYS.on, next.on ? "1" : "0");
    await repos.setSetting(REMINDER_KEYS.days, serializeDays(next.days));
    await repos.setSetting(REMINDER_KEYS.time, serializeTime(next.hour, next.minute));
    setS(next);
    const r = await syncReminders(reminders, next, reminderText(lang));
    setNote(r === "failed" ? "remind.failed" : null);
  };
  return (
    <>
      <SwitchRow
        label={t("remind.settings")}
        note={t("remind.intro")}
        value={s.on}
        onChange={async (on) => {
          if (!on) return void apply({ ...s, on: false });
          const r = await reminders.ensurePermission();
          if (r === "granted") await apply({ ...s, on: true });
          else {
            setNote(r === "denied" ? "remind.perm.denied" : "remind.perm.unavailable");
            await apply({ ...s, on: false });
          }
        }}
      />
      {s.on ? (
        <Block>
          <AppText style={{ color: p.muted, fontSize: ty.secondary }}>{t("remind.days")}</AppText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            {[6, 0, 1, 2, 3, 4, 5].map((d) => (
              <Chip key={d} label={t(`weekly.day.${d}` as StringKey)} selected={s.days.includes(d)} onPress={() => void apply({ ...s, days: toggleDay(s.days, d) })} />
            ))}
          </View>
          <Stepper label={t("remind.hour")} value={s.hour} min={0} max={23} onChange={(n) => void apply({ ...s, hour: n })} />
          <Stepper label={t("remind.minute")} value={s.minute} min={0} max={55} step={5} onChange={(n) => void apply({ ...s, minute: n })} />
          {s.days.length === 0 ? <AppText style={{ color: p.muted, fontSize: ty.secondary }}>{t("remind.pickDays")}</AppText> : null}
          <AppText style={{ color: p.muted, fontSize: ty.secondary }}>{t("remind.note")}</AppText>
        </Block>
      ) : null}
      {note ? <InlineStatus kind="error" text={t(note)} /> : null}
    </>
  );
}

function RestCard() {
  const { t } = useI18n();
  const p = usePalette();
  const { repos, restAlerts } = useServices();
  const [s, setS] = useState<RestSettings | null>(null);
  const [note, setNote] = useState<StringKey | null>(null);
  useEffect(() => {
    void loadRestSettings(repos).then(setS);
  }, [repos]);
  if (!s) return null;
  const save = async (key: keyof typeof REST_KEYS, value: string, next: RestSettings) => {
    await repos.setSetting(REST_KEYS[key], value);
    setS(next);
  };
  return (
    <>
      <Block title={t("rest.settings")}>
        <AppText style={{ color: p.muted, fontSize: ty.secondary }}>{t("rest.default")}</AppText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          {REST_CHOICES.map((n) => (
            <Chip key={n} label={t("rest.defaultValue", { n })} selected={s.seconds === n} onPress={() => void save("seconds", String(n), { ...s, seconds: n })} />
          ))}
        </View>
      </Block>
      <SwitchRow label={t("rest.vibrate")} value={s.vibrate} onChange={(on) => void save("vibrate", on ? "1" : "0", { ...s, vibrate: on })} />
      <SwitchRow
        label={t("rest.notify")}
        note={t("rest.notifyNote")}
        value={s.notify}
        onChange={async (on) => {
          if (!on) {
            setNote(null);
            await restAlerts.cancel();
            return save("notify", "0", { ...s, notify: false });
          }
          const r = await restAlerts.ensurePermission();
          if (r === "granted") {
            setNote(null);
            await save("notify", "1", { ...s, notify: true });
          } else {
            setNote(r === "denied" ? "rest.perm.denied" : "rest.perm.unavailable");
            await save("notify", "0", { ...s, notify: false });
          }
        }}
      />
      {note ? <InlineStatus kind="error" text={t(note)} /> : null}
    </>
  );
}

export function SettingsScreen() {
  const { t, lang, setLang, rtlOverride, setRtlOverride, needsRestart, unit, setUnit, showSecondName, setShowSecond } = useI18n();
  const { repos } = useServices();
  const p = usePalette();
  const appearance = useAppearance();
  const version = Constants.expoConfig?.version ?? "0";
  useSilentRackSync();
  const nav = useNavigation<{ navigate: (n: "Setup" | "Import" | "Goals" | "StoppedSuggestions" | "DecisionLog" | "Data" | "Sync" | "Diagnostics" | "Privacy") => void }>();
  return (
    <Screen tab title={t("tab.settings")}>
      <Group title={t("settings.group.training")}>
        <CeilingsCard />
        <RestCard />
        <WeekStartCard />
        <ReminderCard />
        <LinkRow label={t("goals.entry")} onPress={() => nav.navigate("Goals")} />
        <LinkRow label={t("stop.entry")} onPress={() => nav.navigate("StoppedSuggestions")} />
        <LinkRow label={t("settings.setupAgain")} note={t("settings.setupAgainNote")} onPress={() => nav.navigate("Setup")} />
      </Group>

      <Group title={t("settings.group.display")}>
        <SelectRow
          label={t("settings.language")}
          value={lang}
          options={[
            { value: "en", label: t("settings.language.en") },
            { value: "ar", label: t("settings.language.ar") },
          ]}
          onChange={setLang}
        />
        <SelectRow
          label={t("settings.units")}
          note={t("settings.units.note")}
          value={unit}
          options={[
            { value: "kg", label: unitLabel("kg", lang) },
            { value: "lb", label: unitLabel("lb", lang) },
          ]}
          onChange={setUnit}
        />
        <SelectRow
          label={t("settings.appearance")}
          value={appearance}
          options={APPEARANCES.map((a) => ({ value: a, label: t(`settings.appearance.${a}` as const) }))}
          onChange={(a) => {
            setAppearance(a);
            void repos.setSetting("appearance", a);
          }}
        />
      </Group>

      <Group title={t("settings.group.advanced")}>
        <SelectRow
          label={t("settings.direction")}
          note={needsRestart ? t("settings.restartNote") : undefined}
          value={rtlOverride}
          options={[
            { value: "auto", label: t("settings.direction.auto") },
            { value: "on", label: t("settings.direction.rtl") },
            { value: "off", label: t("settings.direction.ltr") },
          ]}
          onChange={setRtlOverride}
        />
        <SwitchRow label={t("settings.secondName")} note={t("settings.secondNameNote")} value={showSecondName} onChange={setShowSecond} />
      </Group>

      <Group title={t("settings.group.data")}>
        <LinkRow label={t("data.entry")} onPress={() => nav.navigate("Data")} />
        <LinkRow label={t("sync.entry")} onPress={() => nav.navigate("Sync")} />
        <LinkRow label={t("import.entry")} note={t("import.entryNote")} onPress={() => nav.navigate("Import")} />
        <LinkRow label={t("dec.entry")} onPress={() => nav.navigate("DecisionLog")} />
      </Group>

      <Group title={t("settings.group.about")}>
        <LinkRow label={t("privacy.entry")} onPress={() => nav.navigate("Privacy")} />
        <LinkRow label={t("diag.entry")} onPress={() => nav.navigate("Diagnostics")} />
        <View style={{ paddingVertical: space.md, gap: space.sm }}>
          <AppText style={{ color: p.muted, fontSize: ty.secondary }}>{t("settings.privacy")}</AppText>
          <HealthNote />
          {hasSelfUpdater(buildFlags) ? <UpdateCard /> : null}
          <AppText style={{ color: p.muted, fontSize: ty.secondary }}>{t("settings.version", { v: version })}</AppText>
          {buildFlags.pilotTemplateIds ? <AppText style={{ color: p.muted, fontSize: ty.secondary }}>{t("settings.pilotBuild")}</AppText> : null}
        </View>
      </Group>
    </Screen>
  );
}
