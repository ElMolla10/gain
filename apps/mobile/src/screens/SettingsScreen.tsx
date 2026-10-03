import { useNavigation } from "@react-navigation/native";
import { HealthNote } from "../components/HealthNote";
import { UpdateCard } from "../components/UpdateCard";
import React, { useCallback, useEffect, useState } from "react";
import type { CeilingClass, RepCeilings } from "@gain/engine";
import { ScrollView, View } from "react-native";
import { useServices } from "../AppContext";
import { useI18n } from "../i18n";
import { space, usePalette } from "../theme";
import { AppText, BigButton, Card, Chip } from "../ui";
import type { StringKey } from "../i18n/strings";
import Constants from "expo-constants";
import { defaultGymLoads, isStandardRack } from "../logic/defaultGym";
import { loadRestSettings, REST_CHOICES, REST_KEYS, type RestSettings } from "../logic/restAlert";

const KINDS: CeilingClass[] = ["upper", "lower", "lateral_raise"];

/** The default rep ceilings (reps at which load goes up) per kind of lift. Per-lift overrides live on the programme row. */
function CeilingsCard() {
  const { t } = useI18n();
  const { repos } = useServices();
  const [c, setC] = useState<RepCeilings | null>(null);
  useEffect(() => {
    void repos.getRepCeilingDefaults().then(setC);
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
    <Card>
      <AppText style={{ fontWeight: "700" }}>{t("settings.ceilings")}</AppText>
      <AppText>{t("settings.ceilings.note")}</AppText>
      {KINDS.map((k) => (
        <View key={k} style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <AppText style={{ flex: 1 }}>{t(`settings.ceilings.${k}` as const)}</AppText>
          <BigButton label="-" selected={false} accessibilityHint={t("settings.ceilings.less")} onPress={() => void bump(k, -1)} />
          <AppText ltr style={{ minWidth: 32, textAlign: "center", fontWeight: "700" }}>{String(c[k])}</AppText>
          <BigButton label="+" selected={false} accessibilityHint={t("settings.ceilings.more")} onPress={() => void bump(k, 1)} />
        </View>
      ))}
    </Card>
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
    <Card>
      <AppText style={{ fontWeight: "700" }}>{t("weekly.settings.weekStart")}</AppText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {[6, 0, 1, 2, 3, 4, 5].map((d) => (
          <Chip key={d} label={t(`weekly.day.${d}` as StringKey)} selected={day === d} onPress={() => void weekly.setWeekStartsOn(d).then(() => setDay(d))} />
        ))}
      </View>
    </Card>
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
    <Card>
      <AppText style={{ fontWeight: "700" }}>{t("rest.settings")}</AppText>
      <AppText style={{ color: p.muted }}>{t("rest.default")}</AppText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {REST_CHOICES.map((n) => (
          <Chip key={n} label={t("rest.defaultValue", { n })} selected={s.seconds === n} onPress={() => void save("seconds", String(n), { ...s, seconds: n })} />
        ))}
      </View>
      <AppText style={{ color: p.muted }}>{t("rest.vibrate")}</AppText>
      <View style={{ flexDirection: "row", gap: space.sm }}>
        <Chip label={t("rest.on")} selected={s.vibrate} onPress={() => void save("vibrate", "1", { ...s, vibrate: true })} />
        <Chip label={t("rest.off")} selected={!s.vibrate} onPress={() => void save("vibrate", "0", { ...s, vibrate: false })} />
      </View>
      <AppText style={{ color: p.muted }}>{t("rest.notify")}</AppText>
      <View style={{ flexDirection: "row", gap: space.sm }}>
        <Chip
          label={t("rest.on")}
          selected={s.notify}
          onPress={async () => {
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
        <Chip
          label={t("rest.off")}
          selected={!s.notify}
          onPress={async () => {
            setNote(null);
            await restAlerts.cancel();
            await save("notify", "0", { ...s, notify: false });
          }}
        />
      </View>
      {note ? <AppText style={{ color: p.danger }}>{t(note)}</AppText> : null}
      <AppText style={{ color: p.muted, fontSize: 13 }}>{t("rest.notifyNote")}</AppText>
    </Card>
  );
}

export function SettingsScreen() {
  const { t, lang, setLang, rtlOverride, setRtlOverride, needsRestart, unit, setUnit } = useI18n();
  const p = usePalette();
  const version = Constants.expoConfig?.version ?? "0";
  useSilentRackSync();
  const nav = useNavigation<{ navigate: (n: "Setup" | "Import" | "Goals" | "StoppedSuggestions" | "DecisionLog" | "Data" | "Diagnostics" | "Privacy") => void }>();
  return (
    <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md }}>
      <Card>
        <AppText style={{ fontWeight: "700" }}>{t("settings.language")}</AppText>
        <BigButton label={t("settings.language.en")} selected={lang === "en"} onPress={() => setLang("en")} />
        <BigButton label={t("settings.language.ar")} selected={lang === "ar"} onPress={() => setLang("ar")} />
      </Card>
      <Card>
        <AppText style={{ fontWeight: "700" }}>{t("settings.direction")}</AppText>
        <BigButton label={t("settings.direction.auto")} selected={rtlOverride === "auto"} onPress={() => setRtlOverride("auto")} />
        <BigButton label={t("settings.direction.rtl")} selected={rtlOverride === "on"} onPress={() => setRtlOverride("on")} />
        <BigButton label={t("settings.direction.ltr")} selected={rtlOverride === "off"} onPress={() => setRtlOverride("off")} />
        {needsRestart ? <AppText style={{ color: p.muted }}>{t("settings.restartNote")}</AppText> : null}
      </Card>
      <CeilingsCard />
      <Card>
        <AppText style={{ fontWeight: "700" }}>{t("settings.units")}</AppText>
        <BigButton label={t("settings.units.kg")} selected={unit === "kg"} onPress={() => setUnit("kg")} />
        <BigButton label={t("settings.units.lb")} selected={unit === "lb"} onPress={() => setUnit("lb")} />
        <AppText style={{ color: p.muted, fontSize: 13 }}>{t("settings.units.note")}</AppText>
      </Card>
      <WeekStartCard />
      <RestCard />
      <Card>
        <BigButton label={t("goals.entry")} selected={false} onPress={() => nav.navigate("Goals")} />
        <BigButton label={t("data.entry")} selected={false} onPress={() => nav.navigate("Data")} />
        <BigButton label={t("dec.entry")} selected={false} onPress={() => nav.navigate("DecisionLog")} />
        <BigButton label={t("stop.entry")} selected={false} onPress={() => nav.navigate("StoppedSuggestions")} />
        <BigButton label={t("privacy.entry")} selected={false} onPress={() => nav.navigate("Privacy")} />
        <BigButton label={t("diag.entry")} selected={false} onPress={() => nav.navigate("Diagnostics")} />
      </Card>
      <Card>
        <BigButton label={t("import.entry")} selected={false} onPress={() => nav.navigate("Import")} />
        <AppText style={{ color: p.muted, fontSize: 13 }}>{t("import.entryNote")}</AppText>
      </Card>
      <Card>
        <BigButton label={t("settings.setupAgain")} selected={false} onPress={() => nav.navigate("Setup")} />
        <AppText style={{ color: p.muted, fontSize: 13 }}>{t("settings.setupAgainNote")}</AppText>
      </Card>
      <AppText style={{ color: p.muted }}>{t("settings.privacy")}</AppText>
      <HealthNote />
      <UpdateCard />
      <AppText style={{ color: p.muted }}>{t("settings.version", { v: version })}</AppText>
    </ScrollView>
  );
}
