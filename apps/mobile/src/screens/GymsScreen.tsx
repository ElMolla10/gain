import { useFocusEffect, useNavigation } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { useServices } from "../AppContext";
import { useI18n } from "../i18n";
import { isolateLtr } from "../i18n/format";
import type { GymSummary } from "../db/gymRepo";
import { defaultGymLoads } from "../logic/defaultGym";
import { radius, space, type as ty, usePalette } from "../theme";
import { AppText, BigButton, Card, InlineStatus, LoadingState, Screen } from "../ui";
import { RackGlyph, glyphFor } from "../components/today/RackRow";
import { haptics } from "../haptics";
import type { EquipmentType } from "@gain/engine";

type Nav = { navigate: (name: "GymEdit" | "PlateCalc", params?: { gymId?: string }) => void };

export function GymsScreen() {
  const { gyms } = useServices();
  const { t, unit } = useI18n();
  const p = usePalette();
  const nav = useNavigation<Nav>();
  const [list, setList] = useState<GymSummary[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [creatingPreset, setCreatingPreset] = useState(false);

  const load = useCallback(() => {
    void gyms.listGyms().then(setList);
  }, [gyms]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!list) return <LoadingState />;

  const createFromPreset = async (presetKey: "commercial" | "powerlifting" | "garage") => {
    setCreatingPreset(true);
    setNote(null);
    try {
      const baseLoads = defaultGymLoads(unit);
      let name = t(`gyms.preset.${presetKey}`);
      let loads = baseLoads;

      if (presetKey === "powerlifting") {
        loads = baseLoads.map((l) => {
          if (l.equipment === "barbell") {
            return { ...l, increment: 0.5, plates: [25, 20, 15, 10, 5, 2.5, 1.25, 0.5] };
          }
          return l;
        });
      } else if (presetKey === "garage") {
        const homeDbs: number[] = [];
        for (let i = 2; i <= 32; i += 2) homeDbs.push(i);
        loads = baseLoads.map((l) => {
          if (l.equipment === "barbell") return { ...l, increment: 2.5, plates: [20, 15, 10, 5, 2.5] };
          if (l.equipment === "dumbbell") return { ...l, loads: homeDbs };
          return l;
        });
      }

      await gyms.createGym({ name, loads, activate: false });
      haptics.celebrate();
      load();
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    } finally {
      setCreatingPreset(false);
    }
  };

  return (
    <Screen>
      <AppText style={{ color: p.muted, fontSize: ty.label }}>{t("gyms.entryNote")}</AppText>

      {/* Gym Sanctuary Cards */}
      <View style={{ gap: space.md }}>
        {list.map((g) => {
          const isActive = g.isActive;
          return (
            <Card
              key={g.id}
              style={{
                gap: space.md,
                borderWidth: isActive ? 1.5 : 1,
                borderColor: isActive ? p.accent : p.border,
                backgroundColor: isActive ? p.tint : p.card,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
                <View style={{ gap: 2, flex: 1 }}>
                  <AppText style={{ fontSize: ty.section, fontWeight: "600", color: p.text }}>
                    {g.name}
                  </AppText>
                  <AppText style={{ color: p.muted, fontSize: ty.caption }}>
                    {t("gyms.forgedSessions", { n: isolateLtr(String(g.finishedSessions)) })}
                  </AppText>
                </View>

                {isActive ? (
                  <View style={{ paddingHorizontal: space.sm, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: p.raised, borderWidth: 1, borderColor: p.edge }}>
                    <AppText style={{ fontSize: ty.caption, fontWeight: "600", color: p.accent }}>
                      {t("gyms.activeSanctuary")}
                    </AppText>
                  </View>
                ) : null}
              </View>

              {/* Equipment Inventory Badges */}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs }}>
                {g.equipment.map((eq) => (
                  <View
                    key={eq}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      paddingHorizontal: space.sm,
                      paddingVertical: 4,
                      borderRadius: radius.button,
                      backgroundColor: p.raised,
                    }}
                  >
                    <RackGlyph name={glyphFor(eq as EquipmentType, "free")} color={p.muted} />
                    <AppText style={{ fontSize: ty.caption, color: p.muted }}>
                      {t(`equipment.${eq}` as never)}
                    </AppText>
                  </View>
                ))}
              </View>

              {/* Actions */}
              <View style={{ gap: space.xs }}>
                {isActive ? (
                  <BigButton
                    icon="timer"
                    label={t("plates.studio")}
                    onPress={() => nav.navigate("PlateCalc")}
                  />
                ) : (
                  <BigButton
                    label={t("gyms.use")}
                    onPress={() => {
                      haptics.selection();
                      void gyms.setActiveGym(g.id).then(() => {
                        setNote(null);
                        load();
                      });
                    }}
                  />
                )}
                <BigButton
                  variant="secondary"
                  label={t("gyms.edit")}
                  onPress={() => nav.navigate("GymEdit", { gymId: g.id })}
                />
              </View>
            </Card>
          );
        })}
      </View>

      {note ? <InlineStatus kind="error" text={note} /> : null}

      {/* Add Custom Gym */}
      <BigButton icon="plus" label={t("gyms.add")} onPress={() => nav.navigate("GymEdit")} />

      {/* Quick Archetype Presets */}
      <View style={{ gap: space.sm, marginTop: space.sm }}>
        <AppText style={{ fontSize: ty.caption, fontWeight: "600", color: p.muted }}>
          {t("gyms.preset.title")}
        </AppText>
        <View style={{ flexDirection: "row", gap: space.xs, flexWrap: "wrap" }}>
          {(["commercial", "powerlifting", "garage"] as const).map((preset) => (
            <Pressable
              key={preset}
              accessibilityRole="button"
              disabled={creatingPreset}
              onPress={() => void createFromPreset(preset)}
              style={({ pressed }) => ({
                flex: 1,
                minWidth: 100,
                minHeight: 44,
                paddingHorizontal: space.sm,
                borderRadius: radius.button,
                borderWidth: 1,
                borderColor: p.border,
                backgroundColor: pressed ? p.raised : p.card,
                alignItems: "center",
                justifyContent: "center",
              })}
            >
              <AppText style={{ fontSize: ty.caption, fontWeight: "600", textAlign: "center" }}>
                {t(`gyms.preset.${preset}`)}
              </AppText>
            </Pressable>
          ))}
        </View>
      </View>
    </Screen>
  );
}
