import type { EquipmentType, GymLoadSpec } from "@gain/engine";
import React from "react";
import { View } from "react-native";
import { useI18n } from "../i18n";
import type { Unit } from "../logic/units";
import { isolateLtr } from "../i18n/format";
import type { StringKey } from "../i18n/strings";
import { GYM_EQUIPMENT, listJumps, parseNumberList } from "../logic/gymInput";
import { loadsFromForm, type EquipmentForm, type GymForm } from "../logic/gymForm";
import { space, usePalette } from "../theme";
import { AppText, Card, Chip, Field } from "../ui";

/** Quick step choices per unit (suggestions to tap, never assumed). lb: 2.5 / 5 / 10 lb are the steps real racks and plate sets give. */
const CHIPS: Record<Unit, Partial<Record<EquipmentType, string[]>>> = {
  kg: {
    barbell: ["2.5", "1.25", "5"],
    plate: ["2.5", "1.25", "5"],
    cable: ["5", "2.5", "10"],
    machine: ["5", "2.5", "10"],
    assisted: ["5", "2.5", "10"],
  },
  lb: {
    barbell: ["5", "2.5", "10"],
    plate: ["2.5", "5", "10"],
    cable: ["5", "10", "2.5"],
    machine: ["10", "5", "15"],
    assisted: ["10", "5", "15"],
  },
};

const LB_HINTS = new Set<EquipmentType>(["barbell", "cable", "machine"]);

/**
 * The editable rack: for each kind of equipment, either the exact loads that exist or a step from a first rung.
 * `only` limits the sections (onboarding shows only the equipment the lifter said they use).
 * Nothing is prefilled: the quick numbers are suggestions to tap, never values the app assumes.
 */
export function GymFormView(props: { form: GymForm; onChange: (f: GymForm) => void; only?: EquipmentType[] }) {
  const { t, unit, unitText } = useI18n();
  const p = usePalette();
  const sections = GYM_EQUIPMENT.filter((e) => !props.only || props.only.includes(e) || props.form[e].enabled);
  const set = (e: EquipmentType, patch: Partial<EquipmentForm>) => props.onChange({ ...props.form, [e]: { ...props.form[e], ...patch } });

  return (
    <View style={{ gap: space.md }}>
      {sections.map((e) => {
        const f = props.form[e];
        const parsed = f.mode === "list" ? parseNumberList(f.listText) : null;
        return (
          <Card key={e}>
            <Chip label={t(`equipment.${e}` as StringKey)} selected={f.enabled} onPress={() => set(e, { enabled: !f.enabled })} />
            {f.enabled ? (
              <View style={{ gap: space.sm }}>
                <AppText style={{ color: p.muted, fontSize: 13 }}>{t((unit === "lb" && LB_HINTS.has(e) ? `gym.hint.${e}.lb` : `gym.hint.${e}`) as StringKey)}</AppText>
                <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
                  <Chip label={t("gym.mode.list")} selected={f.mode === "list"} onPress={() => set(e, { mode: "list" })} />
                  <Chip label={t("gym.mode.grid")} selected={f.mode === "grid"} onPress={() => set(e, { mode: "grid" })} />
                </View>
                {f.mode === "list" ? (
                  <>
                    <Field label={t("gym.list.label", { unit: unitText })} value={f.listText} onChangeText={(s) => set(e, { listText: s })} placeholder={t("gym.list.placeholder")} keyboardType="numbers-and-punctuation" numeric />
                    {parsed && parsed.values.length > 0 ? (
                      <>
                        <AppText ltr style={{ color: p.muted, fontSize: 13 }}>
                          {t("gym.preview", { list: isolateLtr(parsed.values.slice(0, 12).join(", ")) })}
                        </AppText>
                        <AppText ltr style={{ color: p.muted, fontSize: 13 }}>
                          {t("gym.previewJumps", { list: isolateLtr(listJumps(parsed.values).slice(0, 12).join(", ")) })}
                        </AppText>
                      </>
                    ) : null}
                  </>
                ) : (
                  <>
                    <AppText style={{ color: p.muted, fontSize: 13 }}>{t("gym.chip.pick")}</AppText>
                    <View style={{ flexDirection: "row", gap: space.sm, flexWrap: "wrap" }}>
                      {(CHIPS[unit][e] ?? []).map((c) => (
                        <Chip key={c} label={c} selected={f.incrementText === c} onPress={() => set(e, { incrementText: c })} />
                      ))}
                    </View>
                    <Field label={t("gym.inc.label", { unit: unitText })} value={f.incrementText} onChangeText={(s) => set(e, { incrementText: s })} numeric />
                    <Field label={t(e === "barbell" ? "gym.min.bar" : "gym.min.label", { unit: unitText })} value={f.minText} onChangeText={(s) => set(e, { minText: s })} numeric />
                    <Field label={t("gym.max.label", { unit: unitText })} value={f.maxText} onChangeText={(s) => set(e, { maxText: s })} numeric />
                  </>
                )}
              </View>
            ) : null}
          </Card>
        );
      })}
    </View>
  );
}

/** Problems as readable lines (empty array = nothing to fix). */
export function useProblemLines(name: string, form: GymForm, original?: GymLoadSpec[]): string[] {
  const { t, unit } = useI18n();
  return loadsFromForm(name, form, unit, original).problems.map((pr) =>
    t(`gym.problem.${pr.code}` as StringKey, { equipment: pr.equipment ? t(`equipment.${pr.equipment}` as StringKey) : "", detail: (pr.detail ?? []).join(" ") }),
  );
}
