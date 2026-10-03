import { File } from "expo-file-system";
import { ImportParseError, parseImport, toKilograms, type EquipmentType, type ImportParse, type SetupType, type WeightUnit } from "@gain/engine";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { useServices } from "../AppContext";
import { ExercisePicker } from "../components/ExercisePicker";
import type { BatchInfo, ImportPreview, ImportResult, TitlePreview } from "../db/importRepo";
import type { LibraryExercise } from "../db/programmeRepo";
import { useI18n } from "../i18n";
import type { StringKey } from "../i18n/strings";
import { PATTERNS } from "../logic/exposure";
import { GYM_EQUIPMENT } from "../logic/gymInput";
import { applyEquipmentToUnresolved, dateRange, heaviestLoad, resolveAll, type Override } from "../logic/importFlow";
import { space, usePalette } from "../theme";
import { AppText, ArDraftNote, BigButton, Card, Chip } from "../ui";

const SETUPS: SetupType[] = ["free", "assisted", "bodyweight_plus_added"];

function TitleCard(props: { row: ReturnType<typeof resolveAll>["rows"][number]; override: Override | undefined; library: LibraryExercise[]; onChange: (o: Override | undefined) => void; onPickExisting: () => void }) {
  const { t } = useI18n();
  const p = usePalette();
  const [open, setOpen] = useState(false);
  const { row, override } = props;
  const nameOf = (id: string) => props.library.find((e) => e.id === id)?.nameEn ?? "?";
  const s = row.title.suggestion;
  const c = row.choice;
  let status: string;
  if (c?.kind === "existing") status = t(`import.ex.${row.origin === "picked" ? "picked" : row.origin === "saved" ? "saved" : "library"}` as StringKey, { name: nameOf(c.exerciseId) });
  else if (c?.kind === "new") status = t("import.ex.new", { equipment: t(`equipment.${c.equipment}` as StringKey) });
  else status = t(row.missing.includes("equipment") ? "import.ex.needEquipment" : "import.ex.needSetup");
  const newDraft = c?.kind === "new" ? c : null;
  const pattern = newDraft?.pattern ?? (s.kind === "new" ? s.pattern : "other");
  const set = (o: Override) => props.onChange({ ...override, ...o });
  return (
    <Card>
      <AppText ltr style={{ fontWeight: "700" }}>{row.title.title}</AppText>
      <AppText style={{ color: p.muted }}>{t("import.ex.counts", { workouts: row.title.workouts, sets: row.title.sets })}</AppText>
      <AppText style={{ color: p.text, fontWeight: "600" }}>{c ? "✓ " : "! "}{status}</AppText>
      {open ? (
        <View style={{ gap: space.sm }}>
          <BigButton label={t("import.ex.useExisting")} selected={false} onPress={props.onPickExisting} />
          <BigButton label={t("import.ex.createNew")} selected={!!override?.createNew || (c?.kind === "new")} onPress={() => props.onChange({ ...override, exerciseId: undefined, createNew: true })} />
          {c?.kind === "new" || s.kind === "new" || override?.createNew ? (
            <>
              <AppText style={{ fontWeight: "600" }}>{t("import.ex.equipment")}</AppText>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                {GYM_EQUIPMENT.map((e: EquipmentType) => (
                  <Chip key={e} label={t(`equipment.${e}` as StringKey)} selected={newDraft?.equipment === e} onPress={() => set({ exerciseId: undefined, createNew: true, equipment: e, setup: undefined })} />
                ))}
              </View>
              <AppText style={{ fontWeight: "600" }}>{t("import.ex.setup")}</AppText>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                {SETUPS.map((x) => (
                  <Chip key={x} label={t(`setup.${x}` as StringKey)} selected={newDraft?.setup === x} onPress={() => set({ exerciseId: undefined, createNew: true, setup: x })} />
                ))}
              </View>
              <AppText style={{ fontWeight: "600" }}>{t("import.ex.pattern")}</AppText>
              <AppText style={{ color: p.muted, fontSize: 13 }}>{t("import.ex.guess", { pattern: t(`pattern.${pattern}` as StringKey) })}</AppText>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                {PATTERNS.map((x) => (
                  <Chip key={x} label={t(`pattern.${x}` as StringKey)} selected={pattern === x} onPress={() => set({ exerciseId: undefined, createNew: true, pattern: x })} />
                ))}
              </View>
            </>
          ) : null}
          <BigButton label={t("import.ex.done")} selected={false} onPress={() => setOpen(false)} />
        </View>
      ) : (
        <BigButton label={t("import.ex.change")} selected={false} onPress={() => setOpen(true)} />
      )}
    </Card>
  );
}

export function ImportScreen() {
  const { t, lang, fmt } = useI18n();
  const p = usePalette();
  const { imports, repos, programmes } = useServices();
  const [parsed, setParsed] = useState<{ name: string; parse: ImportParse } | null>(null);
  const [unit, setUnit] = useState<WeightUnit | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [gymId, setGymId] = useState<string | null>(null);
  const [library, setLibrary] = useState<LibraryExercise[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [pickFor, setPickFor] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<(ImportResult) | null>(null);
  const [undone, setUndone] = useState<number | null>(null);
  const [batches, setBatches] = useState<BatchInfo[]>([]);

  const refreshBatches = useCallback(() => void imports.listBatches().then(setBatches), [imports]);
  useEffect(() => {
    refreshBatches();
    // No gym choice in the UI: imported workouts go to the silent default gym (the one in use).
    void repos.getActiveGymId().then((id) => setGymId((cur) => cur ?? id));
    void programmes.listExercises().then(setLibrary);
  }, [imports, repos, programmes, refreshBatches]);

  /** The weights in kilograms; null until a file that does not state its unit has been given one. */
  const kgParse = useMemo(() => {
    if (!parsed) return null;
    try {
      return toKilograms(parsed.parse, unit ?? undefined);
    } catch {
      return null;
    }
  }, [parsed, unit]);

  /** Heaviest set in the file, in kg (shown in the lifter's unit, so a converted lb file is easy to sanity-check). */
  const heaviestKg = useMemo(() => heaviestLoad(kgParse), [kgParse]);

  useEffect(() => {
    setPreview(null);
    if (!kgParse) return;
    let live = true;
    void imports.preview(kgParse).then((pv) => live && setPreview(pv)).catch((e: Error) => live && setError(t("import.readFailed", { detail: e.message })));
    return () => {
      live = false;
    };
  }, [kgParse, imports, t]);

  async function choose() {
    setError(null);
    setResult(null);
    setUndone(null);
    try {
      const picked = await File.pickFileAsync({ mimeTypes: ["text/csv", "text/comma-separated-values", "application/csv", "text/plain", "application/vnd.ms-excel", "*/*"] });
      if (picked.canceled) return;
      setBusy(t("import.reading"));
      const text = await picked.result.text();
      const parse = parseImport(text);
      setParsed({ name: picked.result.name, parse });
      setUnit(parse.unit === "unknown" ? null : parse.unit);
      setOverrides({});
    } catch (e) {
      setParsed(null);
      setError(t("import.readFailed", { detail: e instanceof ImportParseError || e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy(null);
    }
  }

  const titles = preview?.titles ?? [];
  const res = useMemo(() => resolveAll(titles, overrides), [titles, overrides]);
  const canImport = !!preview && preview.newWorkouts > 0 && !!gymId && res.ready && !busy;

  async function run() {
    if (!kgParse || !gymId || !canImport) return;
    setBusy(t("import.working"));
    setError(null);
    try {
      const r = await imports.importHistory({ parse: kgParse, gymId, mappings: res.mappings, fileName: parsed?.name });
      setResult(r);
      setParsed(null);
      setPreview(null);
      refreshBatches();
    } catch (e) {
      setError(t("import.failed", { detail: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy(null);
    }
  }
  async function undo(batchId: string) {
    const r = await imports.undoBatch(batchId);
    setUndone(r.workouts);
    setResult(null);
    refreshBatches();
  }

  const unitFromFile = parsed && parsed.parse.unit !== "unknown";
  return (
    <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space.xl * 3 }}>
      <ArDraftNote />
      <AppText style={{ color: p.muted }}>{t("import.intro")}</AppText>
      <BigButton label={parsed ? t("import.pickAnother") : t("import.pick")} selected={!parsed} disabled={!!busy} onPress={() => void choose()} />
      {busy ? <AppText style={{ color: p.muted }}>{busy}</AppText> : null}
      {error ? <AppText style={{ color: p.text, fontWeight: "600" }}>{error}</AppText> : null}
      {undone !== null ? <AppText style={{ fontWeight: "700" }}>{t("import.undone", { workouts: undone })}</AppText> : null}

      {result ? (
        <Card>
          <AppText style={{ fontSize: 20, fontWeight: "800" }}>✓ {t("import.done.title")}</AppText>
          <AppText>{t("import.done.body", { workouts: result.workouts, sets: result.sets, exercises: result.newExercises })}</AppText>
          {result.skippedSets > 0 ? <AppText style={{ color: p.muted }}>{t("import.done.skipped", { n: result.skippedSets })}</AppText> : null}
          {result.batchId ? <BigButton label={t("import.undo")} selected={false} onPress={() => void undo(result.batchId!)} /> : null}
        </Card>
      ) : null}

      {parsed ? (
        <Card>
          <AppText ltr style={{ fontWeight: "700" }}>{t("import.fileInfo", { name: parsed.name, source: t(`import.source.${parsed.parse.source}` as StringKey) })}</AppText>
          {unitFromFile ? (
            <AppText style={{ color: p.muted }}>{t("import.unit.fromFile", { unit: parsed.parse.unit })}</AppText>
          ) : (
            <>
              <AppText style={{ fontWeight: "700" }}>{t("import.unit.title")}</AppText>
              <AppText style={{ color: p.muted }}>{t("import.unit.note")}</AppText>
              <BigButton label={t("import.unit.kg")} selected={unit === "kg"} onPress={() => setUnit("kg")} />
              <BigButton label={t("import.unit.lb")} selected={unit === "lb"} onPress={() => setUnit("lb")} />
            </>
          )}
        </Card>
      ) : null}

      {preview ? (
        <>
          <Card>
            <AppText style={{ fontWeight: "700" }}>{t("import.preview.title")}</AppText>
            {preview.newWorkouts > 0 ? (
              <>
                <AppText>{t("import.preview.workouts", { n: preview.newWorkouts, sets: preview.newSets })}</AppText>
                <AppText style={{ color: p.muted }}>{t("import.preview.range", { range: dateRange(preview.firstDate, preview.lastDate) })}</AppText>
                {heaviestKg !== null ? <AppText style={{ color: p.muted }}>{t("import.preview.heaviest", { load: fmt(heaviestKg) })}</AppText> : null}
              </>
            ) : (
              <AppText>{t("import.preview.nothing")}</AppText>
            )}
            {preview.duplicateWorkouts > 0 ? <AppText style={{ color: p.muted }}>{t("import.preview.duplicates", { n: preview.duplicateWorkouts })}</AppText> : null}
            {preview.emptyWorkouts > 0 ? <AppText style={{ color: p.muted }}>{t("import.preview.empty", { n: preview.emptyWorkouts })}</AppText> : null}
            {preview.warnings.length > 0 ? <AppText style={{ color: p.muted }}>{t("import.preview.warnings", { n: preview.warnings.length })}</AppText> : null}
          </Card>

          {preview.newWorkouts > 0 ? (
            <>
              <AppText style={{ fontSize: 20, fontWeight: "800" }}>{t("import.ex.title")}</AppText>
              <AppText style={{ color: p.muted }}>{t("import.ex.note", { n: titles.length })}</AppText>
              {titles.some((x) => res.rows.find((r) => r.title === x)?.missing.includes("equipment")) ? (
                <Card>
                  <AppText style={{ fontWeight: "700" }}>{t("import.bulk.title", { n: res.rows.filter((r) => r.missing.includes("equipment")).length })}</AppText>
                  <AppText style={{ color: p.muted }}>{t("import.bulk.note")}</AppText>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                    {GYM_EQUIPMENT.map((e) => (
                      <Chip key={e} label={t(`equipment.${e}` as StringKey)} onPress={() => setOverrides(applyEquipmentToUnresolved(titles, overrides, e))} />
                    ))}
                  </View>
                </Card>
              ) : null}
              {res.rows.map((row) => (
                <TitleCard
                  key={row.title.title}
                  row={row}
                  override={overrides[row.title.title]}
                  library={library}
                  onChange={(o) => setOverrides((cur) => ({ ...cur, [row.title.title]: o ?? {} }))}
                  onPickExisting={() => setPickFor(row.title.title)}
                />
              ))}
              {!res.ready ? <AppText style={{ color: p.muted }}>{t("import.go.blocked")}</AppText> : null}
              <BigButton label={t("import.go", { n: preview.newWorkouts })} disabled={!canImport} onPress={() => void run()} />
            </>
          ) : null}
        </>
      ) : null}

      {batches.length > 0 ? (
        <Card>
          <AppText style={{ fontWeight: "700" }}>{t("import.history.title")}</AppText>
          {batches.map((b) => (
            <View key={b.id} style={{ gap: space.xs }}>
              <AppText>{t("import.history.row", { source: t(`import.source.${b.source}` as StringKey), workouts: b.workouts, sets: b.sets })}</AppText>
              <AppText ltr style={{ color: p.muted, fontSize: 13 }}>{new Date(b.createdAt).toISOString().slice(0, 10)}{b.fileName ? ` · ${b.fileName}` : ""}</AppText>
              <BigButton label={t("import.undo")} selected={false} onPress={() => void undo(b.id)} />
            </View>
          ))}
        </Card>
      ) : null}

      <ExercisePicker
        visible={pickFor !== null}
        exercises={library}
        onClose={() => setPickFor(null)}
        onPick={(id) => {
          if (pickFor) setOverrides((cur) => ({ ...cur, [pickFor]: { exerciseId: id } }));
          setPickFor(null);
        }}
        onCreate={async (input) => {
          const id = await programmes.createExercise(input);
          setLibrary(await programmes.listExercises());
          return id;
        }}
      />
    </ScrollView>
  );
}
