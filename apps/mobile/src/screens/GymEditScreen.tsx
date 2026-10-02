import type { GymLoadSpec } from "@gain/engine";
import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useEffect, useState } from "react";
import { ScrollView } from "react-native";
import { useServices } from "../AppContext";
import { GymFormView, useProblemLines } from "../components/GymFormView";
import { GymInvalid } from "../db/gymRepo";
import { useI18n } from "../i18n";
import { defaultGymLoads } from "../logic/defaultGym";
import { emptyForm, formFromLoads, loadsFromForm, type GymForm } from "../logic/gymForm";
import { space, usePalette } from "../theme";
import { AppText, ArDraftNote, BigButton, Field } from "../ui";

export function GymEditScreen() {
  const { gyms } = useServices();
  const { t, unit, unitText } = useI18n();
  const p = usePalette();
  const nav = useNavigation<{ goBack: () => void }>();
  const params = (useRoute().params ?? {}) as { gymId?: string; copyFromId?: string };
  const [name, setName] = useState("");
  const [form, setForm] = useState<GymForm | null>(null);
  /** The gym as saved (kg): an unchanged number keeps its exact stored value when shown and saved in lb. */
  const [original, setOriginal] = useState<GymLoadSpec[] | undefined>(undefined);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const src = params.gymId ?? params.copyFromId;
      const g = src ? await gyms.getGym(src) : null;
      setOriginal(g?.loads);
      setForm(g ? formFromLoads(g.loads, unit) : emptyForm());
      setName(params.copyFromId && g ? t("gym.copyName", { name: g.name }).replace(/[\u2066\u2069]/g, "") : (g?.name ?? ""));
    })().catch(() => setForm(emptyForm()));
    // Load once per screen open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gyms, params.gymId, params.copyFromId]);

  const problems = useProblemLines(name, form ?? emptyForm(), original);
  if (!form) return <AppText style={{ padding: space.lg }}>{t("common.loading")}</AppText>;

  async function save() {
    setTouched(true);
    if (!form) return;
    const r = loadsFromForm(name, form, unit, original);
    if (r.problems.length > 0) return;
    setSaving(true);
    try {
      if (params.gymId) await gyms.updateGym(params.gymId, { name, loads: r.loads });
      else await gyms.createGym({ name, loads: r.loads, activate: !params.copyFromId });
      nav.goBack();
    } catch (e) {
      if (!(e instanceof GymInvalid)) throw e;
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space.xl * 3 }} keyboardShouldPersistTaps="handled">
      <Field label={t("gym.name")} value={name} onChangeText={setName} placeholder={t("gym.name.placeholder")} />
      <AppText style={{ fontWeight: "700" }}>{t("gym.has")}</AppText>
      <GymFormView form={form} onChange={setForm} />
      <BigButton label={t("gym.defaults", { unit: unitText })} selected={false} onPress={() => setForm(formFromLoads(defaultGymLoads(unit), unit))} />
      <AppText style={{ color: p.muted, fontSize: 13 }}>{t("gym.defaults.note")}</AppText>
      {touched && problems.length > 0 ? problems.map((m, i) => <AppText key={i} style={{ color: p.text, fontWeight: "600" }}>⚠ {m}</AppText>) : null}
      <BigButton label={t("gym.save")} disabled={saving} onPress={() => void save()} />
      <ArDraftNote />
    </ScrollView>
  );
}
