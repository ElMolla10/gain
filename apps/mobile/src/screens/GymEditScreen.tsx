import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { derivePlates, platesOf, type GymLoadSpec, type SetupType } from "@gain/engine";
import React, { useCallback, useLayoutEffect, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { useServices } from "../AppContext";
import { useI18n } from "../i18n";
import { exerciseLabels } from "../i18n/format";
import { defaultGymLoads, defaultGymName } from "../logic/defaultGym";
import { cleanSpec, parseNumberList, validateGym } from "../logic/gymInput";
import { formatList, parseNumber } from "../logic/gymInput";
import { kgToUnit, unitToKg, weightText } from "../logic/units";
import { radius, space, type as ty, usePalette } from "../theme";
import { AppText, BigButton, Card, Field, InlineStatus, LoadingState, Screen } from "../ui";
import { RackGlyph, glyphFor } from "../components/today/RackRow";
import { haptics } from "../haptics";

function numField(text: string, unit: "kg" | "lb"): number | undefined {
  const n = parseNumber(text);
  return n === null ? undefined : unitToKg(n, unit);
}

const KG_DENOMINATIONS = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5];
const LB_DENOMINATIONS = [45, 35, 25, 10, 5, 2.5, 1.25];

export function GymEditScreen() {
  const { gyms, repos } = useServices();
  const { t, lang, unit, unitText } = useI18n();
  const p = usePalette();
  const nav = useNavigation<{ navigate: (name: string, params?: object) => void; goBack: () => void; setOptions: (o: { title: string }) => void }>();
  const gymId = (useRoute().params as { gymId?: string } | undefined)?.gymId;
  // One title (N-2): the native header says Add or Edit; the body has no second title.
  useLayoutEffect(() => nav.setOptions({ title: gymId ? t("gyms.edit") : t("gyms.add") }), [nav, gymId, t]);
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

  const togglePlateDenomination = (denom: number) => {
    haptics.selection();
    const currentList = parseNumberList(platesText).values;
    let nextList: number[];
    if (currentList.some((v) => Math.abs(v - denom) < 0.01)) {
      nextList = currentList.filter((v) => Math.abs(v - denom) >= 0.01);
    } else {
      nextList = [...currentList, denom].sort((a, b) => b - a);
    }
    setPlatesText(nextList.join(", "));
    setSaved(false);
  };

  const applyDumbbellPreset = (kind: "standard" | "heavy" | "home") => {
    haptics.selection();
    const maxKg = kind === "heavy" ? 60 : kind === "home" ? 32 : 50;
    const listKg: number[] = [];
    for (let w = 2; w <= maxKg; w += 2) listKg.push(w);
    const convertedLoads = listKg.map((k) => unitToKg(kgToUnit(k, unit), unit));
    patch("dumbbell", { loads: convertedLoads });
  };

  const save = async () => {
    const next = loads.map((l) => {
      if (l.equipment !== "barbell") return cleanSpec(l);
      const parsed = parseNumberList(platesText);
      const plates = parsed.values.map((v) => unitToKg(v, unit));
      const derived = l.increment !== undefined ? derivePlates(l.increment) : [];
      const same = plates.length === derived.length && plates.every((x: number, i: number) => Math.abs(x - (derived[i] ?? 0)) < 1e-6);
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

  const availableDenominations = unit === "lb" ? LB_DENOMINATIONS : KG_DENOMINATIONS;
  const currentPlatesValues = parseNumberList(platesText).values;

  return (
    <Screen>
      <Field label={t("gyms.name")} value={name} onChangeText={(s) => { setName(s); setSaved(false); }} />

      {bar ? (
        <Card style={{ gap: space.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <RackGlyph name={glyphFor("barbell", "free")} color={p.muted} />
            <AppText style={{ fontSize: ty.section, fontWeight: "600" }}>{t("equipment.barbell")}</AppText>
          </View>
          <Field label={t("loads.step", { unit: unitText })} value={textOf(bar.increment)} onChangeText={(s) => patch("barbell", { increment: numField(s, unit) })} numeric />
          <Field label={t("loads.min", { unit: unitText })} value={textOf(bar.min)} onChangeText={(s) => patch("barbell", { min: numField(s, unit) })} numeric />

          {/* Interactive Plate Palette Toggle */}
          <View style={{ gap: space.xs, marginTop: space.xs }}>
            <AppText style={{ fontSize: ty.caption, fontWeight: "600", color: p.muted }}>
              {t("gyms.platePalette.title")}
            </AppText>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
              {availableDenominations.map((denom) => {
                const isSelected = currentPlatesValues.some((v) => Math.abs(v - denom) < 0.01);
                return (
                  <Pressable
                    key={denom}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => togglePlateDenomination(denom)}
                    hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
                    style={({ pressed }) => ({
                      minWidth: 44,
                      minHeight: 38,
                      paddingHorizontal: space.sm,
                      borderRadius: radius.button,
                      borderWidth: 1,
                      borderColor: isSelected ? p.accent : p.border,
                      backgroundColor: isSelected ? p.tint : pressed ? p.raised : p.card,
                      alignItems: "center",
                      justifyContent: "center",
                    })}
                  >
                    <AppText style={{ fontSize: ty.label, fontWeight: isSelected ? "600" : "400", color: isSelected ? p.accent : p.text }}>
                      {denom}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Field label={t("gyms.plates")} hint={t("gyms.plates.hint")} value={platesText} onChangeText={(s) => { setPlatesText(s); setSaved(false); }} keyboardType="numbers-and-punctuation" />
        </Card>
      ) : null}

      {db ? (
        <Card style={{ gap: space.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <RackGlyph name={glyphFor("dumbbell", "free")} color={p.muted} />
            <AppText style={{ fontSize: ty.section, fontWeight: "600" }}>{t("equipment.dumbbell")}</AppText>
          </View>

          {/* Dumbbell Quick Presets */}
          <View style={{ gap: space.xs }}>
            <AppText style={{ fontSize: ty.caption, fontWeight: "600", color: p.muted }}>
              {t("gyms.dbRack.title")}
            </AppText>
            <View style={{ flexDirection: "row", gap: space.xs, flexWrap: "wrap" }}>
              {(["standard", "heavy", "home"] as const).map((k) => (
                <Pressable
                  key={k}
                  accessibilityRole="button"
                  onPress={() => applyDumbbellPreset(k)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  style={({ pressed }) => ({
                    paddingHorizontal: space.sm,
                    minHeight: 36,
                    borderRadius: radius.button,
                    backgroundColor: pressed ? p.raised : p.card,
                    borderWidth: 1,
                    borderColor: p.border,
                    alignItems: "center",
                    justifyContent: "center",
                  })}
                >
                  <AppText style={{ fontSize: ty.caption, color: p.text }}>
                    {t(`gyms.dbRack.${k}`)}
                  </AppText>
                </Pressable>
              ))}
            </View>
          </View>

          <Field label={t("loads.list", { unit: unitText })} value={db.loads ? formatList(db.loads.map((x) => kgToUnit(x, unit))) : ""} onChangeText={(s) => patch("dumbbell", { loads: parseNumberList(s).values.map((v) => unitToKg(v, unit)) })} keyboardType="numbers-and-punctuation" />
        </Card>
      ) : null}

      {machine ? (
        <Card style={{ gap: space.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <RackGlyph name={glyphFor("machine", "free")} color={p.muted} />
            <AppText style={{ fontSize: ty.section, fontWeight: "600" }}>{t("equipment.machine")}</AppText>
          </View>
          <Field label={t("loads.step", { unit: unitText })} value={textOf(machine.increment)} onChangeText={(s) => patch("machine", { increment: numField(s, unit) })} numeric />
        </Card>
      ) : null}

      {plate ? (
        <Card style={{ gap: space.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <RackGlyph name={glyphFor("plate", "free")} color={p.muted} />
            <AppText style={{ fontSize: ty.section, fontWeight: "600" }}>{t("equipment.plate")}</AppText>
          </View>
          <Field label={t("loads.step", { unit: unitText })} value={textOf(plate.increment)} onChangeText={(s) => patch("plate", { increment: numField(s, unit) })} numeric />
        </Card>
      ) : null}

      {cable ? (
        <Card style={{ gap: space.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <RackGlyph name={glyphFor("cable", "free")} color={p.muted} />
            <AppText style={{ fontSize: ty.section, fontWeight: "600" }}>{t("equipment.cable")}</AppText>
          </View>
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
