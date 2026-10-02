import type { EquipmentType, SetupType } from "@gain/engine";
import React, { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import type { LibraryExercise, NewExerciseInput } from "../db/programmeRepo";
import { useI18n } from "../i18n";
import { exerciseLabels, matchesExercise } from "../i18n/format";
import type { StringKey } from "../i18n/strings";
import { GYM_EQUIPMENT } from "../logic/gymInput";
import { PATTERNS } from "../logic/exposure";
import { space, usePalette } from "../theme";
import { AppText, ArDraftNote, BigButton, Card, Chip, Field } from "../ui";

const SETUPS: SetupType[] = ["free", "assisted", "bodyweight_plus_added"];

/** The kind of setup that matches the equipment, as a starting suggestion the lifter can change. */
const defaultSetup = (e: EquipmentType): SetupType => (e === "assisted" ? "assisted" : "free");

/**
 * Pick an exercise from the library (search by English name or Arabic alias) or add the lifter's own.
 * A new exercise is never classified for the lifter: they choose the movement, equipment and how it is loaded,
 * because loads only compare within the same setup.
 */
export function ExercisePicker(props: {
  visible: boolean;
  exercises: LibraryExercise[];
  onClose: () => void;
  onPick: (exerciseId: string) => void;
  onCreate: (input: NewExerciseInput) => Promise<string>;
  /** Exercises to hide (already in the day). */
  exclude?: string[];
}) {
  const { t, lang } = useI18n();
  const p = usePalette();
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [pattern, setPattern] = useState<string>("other");
  const [equipment, setEquipment] = useState<EquipmentType>("machine");
  const [setup, setSetup] = useState<SetupType>("free");
  const [error, setError] = useState<string | null>(null);

  const shown = useMemo(() => props.exercises.filter((e) => !props.exclude?.includes(e.id) && matchesExercise(q, e)), [props.exercises, props.exclude, q]);

  async function create() {
    if (nameEn.trim() === "") return setError(t("pick.nameMissing"));
    const id = await props.onCreate({ nameEn, nameAr, pattern, equipment, setup });
    setCreating(false);
    setNameEn("");
    setNameAr("");
    props.onPick(id);
  }

  return (
    <Modal visible={props.visible} animationType="slide" onRequestClose={props.onClose}>
      <View style={{ flex: 1, backgroundColor: p.bg, paddingTop: space.xl }}>
        <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space.xl * 2 }} keyboardShouldPersistTaps="handled">
          <AppText style={{ fontSize: 22, fontWeight: "800" }}>{t("pick.title")}</AppText>
          {creating ? (
            <Card>
              <Field label={t("pick.name")} value={nameEn} onChangeText={setNameEn} />
              <Field label={t("pick.nameAr")} value={nameAr} onChangeText={setNameAr} />
              <AppText style={{ fontWeight: "600" }}>{t("pick.pattern")}</AppText>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                {PATTERNS.map((x) => (
                  <Chip key={x} label={t(`pattern.${x}` as StringKey)} selected={pattern === x} onPress={() => setPattern(x)} />
                ))}
              </View>
              <AppText style={{ fontWeight: "600" }}>{t("pick.equipment")}</AppText>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                {GYM_EQUIPMENT.map((x) => (
                  <Chip
                    key={x}
                    label={t(`equipment.${x}` as StringKey)}
                    selected={equipment === x}
                    onPress={() => {
                      setEquipment(x);
                      setSetup(defaultSetup(x));
                    }}
                  />
                ))}
              </View>
              <AppText style={{ fontWeight: "600" }}>{t("pick.setup")}</AppText>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                {SETUPS.map((x) => (
                  <Chip key={x} label={t(`setup.${x}` as StringKey)} selected={setup === x} onPress={() => setSetup(x)} />
                ))}
              </View>
              {error ? <AppText style={{ fontWeight: "600" }}>⚠ {error}</AppText> : null}
              <BigButton label={t("pick.save")} onPress={() => void create()} />
              <BigButton label={t("common.cancel")} selected={false} onPress={() => setCreating(false)} />
            </Card>
          ) : (
            <>
              <Field label={t("pick.search")} value={q} onChangeText={setQ} />
              {shown.length === 0 ? <AppText style={{ color: p.muted }}>{t("pick.none")}</AppText> : null}
              {shown.map((e) => {
                const l = exerciseLabels(e, lang);
                return (
                  <Pressable key={e.id} accessibilityRole="button" onPress={() => props.onPick(e.id)} style={{ minHeight: 56, paddingVertical: space.sm, borderBottomWidth: 1, borderColor: p.border }}>
                    <AppText style={{ fontWeight: "600" }}>{l.primary}</AppText>
                    <AppText style={{ color: p.muted, fontSize: 13 }}>
                      {l.secondary}
                      {e.isCustom ? ` · ${t("pick.own")}` : ""}
                    </AppText>
                  </Pressable>
                );
              })}
              <BigButton label={t("pick.create")} selected={false} onPress={() => setCreating(true)} />
            </>
          )}
          <BigButton label={t("pick.close")} selected={false} onPress={props.onClose} />
          <ArDraftNote />
        </ScrollView>
      </View>
    </Modal>
  );
}
