import { useFocusEffect, useNavigation } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { Linking, View } from "react-native";
import { useServices } from "../AppContext";
import { diagnostics } from "../diagnostics";
import type { LiftItem } from "../db/historyRepo";
import { CATALOG_BY_KEY } from "../db/libraryDraft";
import { useI18n } from "../i18n";
import { exerciseLabels, formatLoad } from "../i18n/format";
import { modeledBodyweightIndex, modeledStrengthIndex, type ComparisonSex } from "../logic/worldStrength";
import { space, usePalette } from "../theme";
import { AppText, BigButton, Card, Chip, EmptyState, ErrorState, Field, InlineStatus, ListRow, LoadingState, Screen } from "../ui";

type Performance = Awaited<ReturnType<ReturnType<typeof useServices>["history"]["getWorldLiftPerformances"]>>[number];
type BodyweightPerformance = Awaited<ReturnType<ReturnType<typeof useServices>["history"]["getWorldBodyweightPerformances"]>>[number];
export function YouVsWorldScreen() {
  const { history, repos } = useServices();
  const { t, lang, unit } = useI18n();
  const p = usePalette();
  const nav = useNavigation<{ navigate: (name: string, params: object) => void }>();
  const [rows, setRows] = useState<{ lift: LiftItem; performance: Performance }[] | null>(null);
  const [bodyweightRows, setBodyweightRows] = useState<{ lift: LiftItem; performance: BodyweightPerformance }[]>([]);
  const [sex, setSex] = useState<ComparisonSex | null>(null);
  const [bodyweight, setBodyweight] = useState("");
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useFocusEffect(useCallback(() => {
    let alive = true;
    setFailed(false);
    void Promise.all([history.getWorldLiftPerformances(), history.listLifts(), repos.getSetting("world_comparison_sex"), repos.getSetting("world_comparison_bodyweight_kg"), repos.getSetting("bodyweight_kg"), repos.getSetting("world_comparison_age"), repos.getSetting("birth_date"), repos.getSetting("world_comparison_height_cm"), repos.getSetting("height_cm"), history.getWorldBodyweightPerformances()])
      .then(([performances, lifts, savedSex, savedWeight, profileWeight, savedAge, birthDate, savedHeight, profileHeight, bodyweightSets]) => {
        if (!alive) return;
        setSex(savedSex === "male" || savedSex === "female" ? savedSex : null);
        setBodyweight(savedWeight ?? profileWeight ?? "");
        const birth = birthDate ? new Date(birthDate) : null;
        const years = birth && Number.isFinite(birth.getTime()) ? Math.floor((Date.now() - birth.getTime()) / (365.2425 * 86_400_000)) : null;
        setAge(savedAge ?? (years !== null ? String(years) : ""));
        setHeight(savedHeight ?? profileHeight ?? "");
        setSaveState("idle");
        const liftsById = new Map(lifts.map(lift => [lift.lineId, lift]));
        setRows(performances.flatMap(performance => {
          if (performance.setup !== "free" || !performance.seedKey || CATALOG_BY_KEY.get(performance.seedKey)?.equipment !== performance.equipment) return [];
          const lift = liftsById.get(performance.lineId);
          return lift ? [{ lift, performance }] : [];
        }));
        setBodyweightRows(bodyweightSets.flatMap(performance => {
          const lift = liftsById.get(performance.lineId);
          return lift && performance.seedKey ? [{ lift, performance }] : [];
        }));
      }).catch(e => { diagnostics.record("warn", "you vs world", e); if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [history, repos, attempt]));
  if (failed) return <ErrorState title={t("progress.loadingFailed")} body={t("progress.loadingFailed")} retryLabel={t("history.error.retry")} onRetry={() => setAttempt(n => n + 1)} />;
  if (!rows) return <LoadingState />;
  const parsedWeight = Number(bodyweight.replace(",", "."));
  const validWeight = bodyweight.trim() === "" ? null : Number.isFinite(parsedWeight) && parsedWeight >= 25 && parsedWeight <= 400 ? parsedWeight : null;
  const weightError = bodyweight.trim() !== "" && validWeight === null;
  const years = Number(age), cm = Number(height.replace(",", "."));
  const validAge = Number.isInteger(years) && years >= 12 && years <= 100;
  const validHeight = Number.isFinite(cm) && cm >= 100 && cm <= 230;
  const ready = sex !== null && validWeight !== null && validAge && validHeight;
  const ranked = ready ? rows.flatMap(r => {
    const model = modeledStrengthIndex(r.performance.seedKey, r.performance.strength, sex!, years, validWeight!, cm);
    return model === null ? [] : [{ ...r, ...model }];
  }).sort((a, b) => b.score - a.score) : [];
  const bestBodyweight = new Map<string, { lift: LiftItem; model: NonNullable<ReturnType<typeof modeledBodyweightIndex>> }>();
  if (ready) for (const r of bodyweightRows) {
    const model = modeledBodyweightIndex(r.performance.seedKey, r.performance, sex!, years, validWeight!, cm);
    if (!model) continue;
    const key = `${r.lift.lineId}:${model.metric}`;
    if ((bestBodyweight.get(key)?.model.score ?? -1) < model.score) bestBodyweight.set(key, { lift: r.lift, model });
  }
  const bodyweightRanked = [...bestBodyweight.entries()].sort((a, b) => b[1].model.score - a[1].model.score);
  const saveProfile = async () => {
    if (!ready || saveState === "saving") return;
    setSaveState("saving");
    try {
      await Promise.all([repos.setSetting("world_comparison_sex", sex!), repos.setSetting("world_comparison_bodyweight_kg", String(validWeight)), repos.setSetting("world_comparison_age", String(years)), repos.setSetting("world_comparison_height_cm", String(cm))]);
      setSaveState("saved");
    } catch (error) { diagnostics.record("warn", "save comparison details", error); setSaveState("failed"); }
  };
  return <Screen title={t("world.title")}>
    <Card style={{ gap: space.sm }}>
      <AppText style={{ color: p.muted }}>{t("world.intro")}</AppText>
      <AppText>{t("world.category")}</AppText>
      <View style={{ flexDirection: "row", gap: space.sm }}>
        {(["male", "female"] as const).map(value => <Chip key={value} label={t(value === "male" ? "world.male" : "world.female")}
          selected={sex === value} disabled={saveState === "saving"} onPress={() => { setSex(value); setSaveState("idle"); }} />)}
      </View>
      <Field label={t("world.bodyweight")} value={bodyweight} numeric onChangeText={value => { setBodyweight(value); setSaveState("idle"); }}
        hint={t("world.bodyweightHint")} error={weightError ? t("world.invalidWeight") : undefined} />
      <Field label={t("world.age")} value={age} numeric onChangeText={value => { setAge(value); setSaveState("idle"); }} error={age.trim() && !validAge ? t("world.invalidAge") : undefined} />
      <Field label={t("world.height")} value={height} numeric onChangeText={value => { setHeight(value); setSaveState("idle"); }} error={height.trim() && !validHeight ? t("world.invalidHeight") : undefined} />
      <BigButton variant="secondary" label={t("world.saveProfile")} disabled={!ready || saveState === "saving"} loading={saveState === "saving"} onPress={() => void saveProfile()} />
      {saveState === "saved" ? <InlineStatus kind="success" text={t("world.saved")} /> : saveState === "failed" ? <InlineStatus kind="error" text={t("world.saveFailed")} /> : null}
    </Card>
    <Card><AppText style={{ color: p.muted }}>{t("world.rule")}</AppText></Card>
    {!ready ? <EmptyState icon="progress" title={t("world.chooseCategory")} /> : ranked.length ? <Card style={{ paddingVertical: space.xs }}>
      {ranked.map((r, i) => <ListRow key={r.lift.lineId} title={exerciseLabels(r.lift, lang).primary}
        note={`${t("world.index", { score: r.score })} · ${t(r.basis === "published_anchor" ? "world.anchor" : "world.estimate")} · ${t(r.ageClass === "youth" ? "world.youth" : "world.adult")}`}
        last={i === ranked.length - 1} onPress={() => nav.navigate("LiftTrend", { lineId: r.lift.lineId })} />)}
    </Card> : <EmptyState icon="progress" title={t("world.empty")} body={t("world.coverage")} />}
    {ready ? <Card>
      <AppText accessibilityRole="header">{t("world.bodyweightTitle")}</AppText>
      <AppText style={{ color: p.muted }}>{t("world.bodyweightRule")}</AppText>
      {bodyweightRanked.length ? bodyweightRanked.map(([key, { lift, model }], i) => <ListRow key={key}
        title={exerciseLabels(lift, lang).primary}
        note={`${t("world.index", { score: model.score })} · ${model.metric === "weighted_bodyweight" ? t("world.weightedBodyweight", { value: formatLoad(model.value, lang, unit) }) : t(model.metric === "seconds" ? "world.holdResult" : "world.repResult", { n: model.value })}`}
        last={i === bodyweightRanked.length - 1} onPress={() => nav.navigate("LiftTrend", { lineId: lift.lineId })} />)
        : <AppText style={{ color: p.muted }}>{t("world.bodyweightEmpty")}</AppText>}
    </Card> : null}
    <Card><AppText style={{ color: p.muted }}>{t("world.source")}</AppText>
      <BigButton variant="secondary" label="Powered by FitnessVolt ↗" onPress={() => void Linking.openURL("https://fitnessvolt.com/strength-standards/")} />
    </Card>
  </Screen>;
}
