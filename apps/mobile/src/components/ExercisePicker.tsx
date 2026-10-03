import type { EquipmentType, SetupType } from "@gain/engine";
import React, { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import type { LibraryExercise, NewExerciseInput } from "../db/programmeRepo";
import { useI18n } from "../i18n";
import { exerciseLabels } from "../i18n/format";
import type { StringKey } from "../i18n/strings";
import { GYM_EQUIPMENT } from "../logic/gymInput";
import { PATTERNS } from "../logic/exposure";
import { buildSearchIndex, GEARS, metaOf, MUSCLE_GROUPS, PICKER_PAGE, searchExercises, type Gear, type LibraryGroup } from "../logic/exerciseSearch";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { space, type as ty, usePalette } from "../theme";
import { AppText, ArDraftNote, BigButton, Card, Chip, EmptyState, Field, FilterPanel, IconButton, InlineStatus } from "../ui";

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
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [pattern, setPattern] = useState<string>("other");
  const [equipment, setEquipment] = useState<EquipmentType>("machine");
  const [setup, setSetup] = useState<SetupType>("free");
  const [error, setError] = useState<string | null>(null);
  const [group, setGroup] = useState<LibraryGroup | null>(null);
  const [gear, setGear] = useState<Gear | null>(null);
  const [limit, setLimit] = useState(PICKER_PAGE);

  // The searchable text is built once per list; a keystroke only filters it.
  const index = useMemo(() => buildSearchIndex(props.exercises), [props.exercises]);
  const found = useMemo(() => searchExercises(index, { query: q, group, gear, exclude: props.exclude }), [index, q, group, gear, props.exclude]);
  const shown = found.slice(0, limit);

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
      <View style={{ flex: 1, backgroundColor: p.bg, paddingTop: insets.top }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingStart: space.lg, paddingEnd: space.xs, gap: space.sm }}>
          <AppText accessibilityRole="header" style={{ fontSize: ty.section, fontWeight: "600", flex: 1 }}>{t("pick.title")}</AppText>
          <IconButton icon="close" label={t("pick.close")} onPress={props.onClose} />
        </View>
        <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: space.xl + insets.bottom }} keyboardShouldPersistTaps="handled">
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
              {error ? <InlineStatus kind="error" text={error} /> : null}
              <BigButton label={t("pick.save")} onPress={() => void create()} />
              <BigButton variant="secondary" label={t("common.cancel")} onPress={() => setCreating(false)} />
            </Card>
          ) : (
            <>
              <Field label={t("pick.search")} value={q} onChangeText={(v) => { setQ(v); setLimit(PICKER_PAGE); }} />
              <FilterPanel
                title={t("pick.filters")}
                activeCount={(group ? 1 : 0) + (gear ? 1 : 0)}
                clearLabel={t("tpl.clear")}
                onClear={() => {
                  setGroup(null);
                  setGear(null);
                  setLimit(PICKER_PAGE);
                }}
              >
                <AppText style={{ fontWeight: "600" }}>{t("pick.filter.muscle")}</AppText>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                  <Chip label={t("pick.all")} selected={group === null} onPress={() => { setGroup(null); setLimit(PICKER_PAGE); }} />
                  {MUSCLE_GROUPS.map((x) => (
                    <Chip key={x} label={t(`group.${x}` as StringKey)} selected={group === x} onPress={() => { setGroup(group === x ? null : x); setLimit(PICKER_PAGE); }} />
                  ))}
                </View>
                <AppText style={{ fontWeight: "600" }}>{t("pick.filter.gear")}</AppText>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                  <Chip label={t("pick.all")} selected={gear === null} onPress={() => { setGear(null); setLimit(PICKER_PAGE); }} />
                  {GEARS.map((x) => (
                    <Chip key={x} label={t(`gear.${x}` as StringKey)} selected={gear === x} onPress={() => { setGear(gear === x ? null : x); setLimit(PICKER_PAGE); }} />
                  ))}
                </View>
              </FilterPanel>
              <AppText style={{ color: p.muted, fontSize: ty.caption }}>{t("pick.count", { n: found.length })}</AppText>
              {shown.length === 0 ? <EmptyState icon="dumbbell" title={t("pick.none")} actionLabel={t("pick.create")} onAction={() => setCreating(true)} /> : null}
              <View>
                {shown.map((e) => {
                  const l = exerciseLabels(e, lang);
                  const m = metaOf(e);
                  return (
                    <Pressable key={e.id} accessibilityRole="button" onPress={() => props.onPick(e.id)} style={({ pressed }) => ({ minHeight: 56, paddingVertical: space.sm, borderBottomWidth: 1, borderColor: p.border, backgroundColor: pressed ? p.raised : "transparent" })}>
                      <AppText style={{ fontWeight: "600" }}>{l.primary}</AppText>
                      <AppText style={{ color: p.muted, fontSize: ty.caption }}>
                        {l.secondary}
                        {e.isCustom ? ` · ${t("pick.own")}` : ""}
                      </AppText>
                      <AppText style={{ color: p.muted, fontSize: ty.caption }}>
                        {m.group ? `${t(`group.${m.group}` as StringKey)} · ` : ""}
                        {t(`gear.${m.gear}` as StringKey)}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
              {found.length > shown.length ? <BigButton variant="secondary" label={t("pick.more", { n: found.length - shown.length })} onPress={() => setLimit(limit + PICKER_PAGE)} /> : null}
              {shown.length > 0 ? <BigButton variant="secondary" icon="plus" label={t("pick.create")} onPress={() => setCreating(true)} /> : null}
            </>
          )}
          <ArDraftNote />
        </ScrollView>
      </View>
    </Modal>
  );
}
