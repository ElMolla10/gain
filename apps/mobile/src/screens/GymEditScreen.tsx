import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { derivePlates, platesOf, type GymLoadSpec, type SetupType } from "@gain/engine";
import React, { useCallback, useState } from "react";
import { Alert, View } from "react-native";
import { useServices } from "../AppContext";
import { useI18n } from "../i18n";
import { exerciseLabels } from "../i18n/format";
import { defaultGymLoads, defaultGymName } from "../logic/defaultGym";
import { cleanSpec, formatList, parseNumber, parseNumberList, validateGym } from "../logic/gymInput";
import { kgToUnit, unitToKg, weightText } from "../logic/units";
import { space, usePalette } from "../theme";
import { AppText, BigButton, Card, Field, InlineStatus, LoadingState, Screen } from "../ui";

function numField(text: string, unit: "kg" | "lb"): number | undefined {
  const n = parseNumber(text);
  return n === null ? undefined : unitToKg(n, unit);
}

export function GymEditScreen() {
  const { gyms, repos } = useServices();
  const { t, lang, unit, unitText } = useI18n();
  const p = usePalette();
  const nav = useNavigation<{ navigate: (name: string, params?: object) => void; goBack: () => void }>();
  const gymId = (useRoute().params as { gymId?: string } | undefined)?.gymId;
  const [name, setName] = useState("");
  const [loads, setLoads] = useState<GymLoadSpec[] | null>(null);
  const [platesText, setPlatesText] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [machines, setMachines] = useState<{ exerciseId: string; nameEn: string; nameAr: string; setup: SetupType; hasOwn: boolean }[]>([]);

  const load = useCallback(async () => {
    if (gymId) {
      const g = await gyms.getGym(gymId);
      if (!g) return;
      setName(g.name);
      setLoads(g.loads);
      const bar = g.loads.find((l) => l.equipment === "barbell");
      setPlatesText(bar ? platesOf(bar).map((x) => weightText(x, unit)).join(", ") : "");
      setMachines(await repos.listGymMachines(gymId));
    } else {
      const std = defaultGymLoads(unit);
      setName(defaultGymName(lang));
      setLoads(std);
      const bar = std.find((l) => l.equipment === "barbell");
      setPlatesText(bar ? platesOf(bar).map((x) => weightText(x, unit)).join(", ") : "");
      setMachines([]);
    }
  }, [gyms, repos, gymId, unit, lang]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (!loads) return <LoadingState />;

  const patch = (equipment: GymLoadSpec["equipment"], next: Partial<GymLoadSpec>) => {
    setSaved(false);
    setLoads((cur) => (cur ?? []).map((l) => (l.equipment === equipment ? { ...l, ...next } : l)));
  };
  const textOf = (n: number | undefined) => (n === undefined ? "" : String(kgToUnit(n, unit)));

  const save = async () => {
    const next = loads.map((l) => {
      if (l.equipment !== "barbell") return cleanSpec(l);
      const parsed = parseNumberList(platesText);
      const plates = parsed.values.map((v) => unitToKg(v, unit));
      const derived = l.increment !== undefined ? derivePlates(l.increment) : [];
      const same = plates.length === derived.length && plates.every((x, i) => Math.abs(x - (derived[i] ?? 0)) < 1e-6);
      return cleanSpec({ ...l, plates: same || plates.length === 0 ? undefined : plates });
    });
    const problems = validateGym(name, next);
    if (problems.length > 0) {
      setError(problems.map((x) => x.code).join(", "));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (gymId) await gyms.updateGym(gymId, { name, loads: next });
      else await gyms.createGym({ name, loads: next });
      setSaved(true);
      nav.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const bar = loads.find((l) => l.equipment === "barbell");
  const db = loads.find((l) => l.equipment === "dumbbell");
  const machine = loads.find((l) => l.equipment === "machine");
  const plate = loads.find((l) => l.equipment === "plate");
  const cable = loads.find((l) => l.equipment === "cable");

  return (
    <Screen title={gymId ? t("gyms.edit") : t("gyms.add")}>
      <Field label={t("gyms.name")} value={name} onChangeText={(s) => { setName(s); setSaved(false); }} />
      {bar ? (
        <Card>
          <AppText style={{ fontWeight: "600" }}>{t("equipment.barbell")}</AppText>
          <Field label={t("loads.step", { unit: unitText })} value={textOf(bar.increment)} onChangeText={(s) => patch("barbell", { increment: numField(s, unit) })} numeric />
          <Field label={t("loads.min", { unit: unitText })} value={textOf(bar.min)} onChangeText={(s) => patch("barbell", { min: numField(s, unit) })} numeric />
          <Field label={t("gyms.plates")} hint={t("gyms.plates.hint")} value={platesText} onChangeText={(s) => { setPlatesText(s); setSaved(false); }} keyboardType="numbers-and-punctuation" />
        </Card>
      ) : null}
      {db ? (
        <Card>
          <AppText style={{ fontWeight: "600" }}>{t("equipment.dumbbell")}</AppText>
          <Field label={t("loads.list", { unit: unitText })} value={db.loads ? formatList(db.loads.map((x) => kgToUnit(x, unit))) : ""} onChangeText={(s) => patch("dumbbell", { loads: parseNumberList(s).values.map((v) => unitToKg(v, unit)) })} keyboardType="numbers-and-punctuation" />
        </Card>
      ) : null}
      {machine ? (
        <Card>
          <AppText style={{ fontWeight: "600" }}>{t("equipment.machine")}</AppText>
          <Field label={t("loads.step", { unit: unitText })} value={textOf(machine.increment)} onChangeText={(s) => patch("machine", { increment: numField(s, unit) })} numeric />
        </Card>
      ) : null}
      {plate ? (
        <Card>
          <AppText style={{ fontWeight: "600" }}>{t("equipment.plate")}</AppText>
          <Field label={t("loads.step", { unit: unitText })} value={textOf(plate.increment)} onChangeText={(s) => patch("plate", { increment: numField(s, unit) })} numeric />
        </Card>
      ) : null}
      {cable ? (
        <Card>
          <AppText style={{ fontWeight: "600" }}>{t("equipment.cable")}</AppText>
          <Field label={t("loads.step", { unit: unitText })} value={textOf(cable.increment)} onChangeText={(s) => patch("cable", { increment: numField(s, unit) })} numeric />
        </Card>
      ) : null}
      {gymId ? (
        <Card>
          <AppText style={{ fontWeight: "600" }}>{t("loads.machines")}</AppText>
          {machines.length === 0 ? <AppText style={{ color: p.muted }}>{t("loads.machines.empty")}</AppText> : machines.map((m) => (
            <BigButton
              key={`${m.exerciseId}:${m.setup}`}
              variant="secondary"
              label={`${exerciseLabels(m, lang).primary} · ${t(`setup.${m.setup}` as never)}${m.hasOwn ? ` · ${t("loads.machines.open")}` : ""}`}
              onPress={() => nav.navigate("ExerciseLoads", { exerciseId: m.exerciseId, gymId, setup: m.setup })}
            />
          ))}
        </Card>
      ) : null}
      {error ? <InlineStatus kind="error" text={error} /> : null}
      {saved ? <InlineStatus kind="success" text={t("gyms.saved")} /> : null}
      <BigButton label={t("gyms.save")} onPress={() => void save()} loading={busy} />
      {gymId ? (
        <View style={{ gap: space.sm }}>
          <BigButton variant="secondary" label={t("gyms.copy")} onPress={() => void gyms.copyGym(gymId, `${name} 2`).then(() => nav.goBack())} />
          <BigButton
            variant="danger"
            label={t("gyms.delete")}
            onPress={() => {
              Alert.alert(t("gyms.delete"), undefined, [
                { text: t("common.close"), style: "cancel" },
                {
                  text: t("gyms.delete"),
                  style: "destructive",
                  onPress: () =>
                    void gyms.deleteGym(gymId).then(() => nav.goBack()).catch((e: Error) => setError(/Switch|only/.test(e.message) ? t("gyms.delete.blocked") : e.message)),
                },
              ]);
            }}
          />
        </View>
      ) : null}
      <AppText style={{ color: p.muted }}>{t("gyms.entryNote")}</AppText>
    </Screen>
  );
}
