import { File } from "expo-file-system";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { Share, View } from "react-native";
import { useServices } from "../AppContext";
import { useI18n } from "../i18n";
import { draftFromShare, exportProgrammeShare, formatProgrammeShareText, parseProgrammeShare, programmeShareSummary, ProgrammeShareError, shareExerciseMeta, type ProgrammeSharePayload } from "../logic/programmeShare";
import { space, usePalette } from "../theme";
import { AppText, BigButton, Card, Field, InlineStatus, LoadingState, Notice, Screen } from "../ui";

export function ProgrammeShareScreen() {
  const { programmes } = useServices();
  const { t } = useI18n();
  const p = usePalette();
  const [json, setJson] = useState<string | null>(null);
  const [incoming, setIncoming] = useState("");
  const [preview, setPreview] = useState<ProgrammeSharePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const a = await programmes.getActive();
        if (!a) return setJson("");
        const [draft, lib] = await Promise.all([programmes.loadDraft(a.versionId), programmes.listExercises()]);
        setJson(JSON.stringify(exportProgrammeShare(draft, new Map(lib.map((e) => [e.id, e]))), null, 2));
      })();
    }, [programmes]),
  );

  if (json === null) return <LoadingState />;

  const show = (text: string) => {
    setError(null);
    try {
      setPreview(parseProgrammeShare(text));
    } catch (e) {
      setPreview(null);
      setError(e instanceof ProgrammeShareError || e instanceof Error ? e.message : String(e));
    }
  };

  const add = async () => {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      const lib = await programmes.listExercises();
      const byName = new Map(lib.map((e) => [`${e.nameEn.toLowerCase()}|${e.equipment}|${e.setup}`, e.id]));
      const idOf = new Map<string, string>();
      for (const d of preview.days) {
        for (const e of d.exercises) {
          const key = `${e.name.toLowerCase()}|${e.equipment}|${e.setup}`;
          if (idOf.has(key)) continue;
          const existing = byName.get(key);
          idOf.set(key, existing ?? (await programmes.createExercise(shareExerciseMeta(e))));
        }
      }
      const draft = draftFromShare(preview);
      draft.days = draft.days.map((day, i) => ({
        ...day,
        exercises: day.exercises.map((ex, j) => {
          const src = preview.days[i]!.exercises[j]!;
          return { ...ex, exerciseId: idOf.get(`${src.name.toLowerCase()}|${src.equipment}|${src.setup}`)! };
        }),
      }));
      await programmes.createProgramme(draft, { activate: false });
      setDone(true);
      setPreview(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const summary = preview ? programmeShareSummary(preview) : null;

  return (
    <Screen>
      <AppText style={{ color: p.muted }}>{t("prog.share.note")}</AppText>
      {json ? (
        <Card>
          <BigButton label={t("prog.share.send")} onPress={() => void Share.share({ message: json })} />
          <BigButton variant="secondary" label={t("prog.share.text")} onPress={() => void Share.share({ message: formatProgrammeShareText(parseProgrammeShare(json)) })} />
        </Card>
      ) : null}
      <Card>
        <AppText style={{ fontWeight: "600" }}>{t("prog.share.receive")}</AppText>
        <Field label={t("prog.share.paste")} value={incoming} onChangeText={setIncoming} multiline />
        <View style={{ gap: space.sm }}>
          <BigButton variant="secondary" label={t("prog.share.preview")} onPress={() => show(incoming)} />
          <BigButton
            variant="secondary"
            label={t("prog.share.file")}
            onPress={() =>
              void File.pickFileAsync({ mimeTypes: ["application/json", "text/plain", "*/*"] }).then(async (picked) => {
                if (picked.canceled) return;
                const text = await picked.result.text();
                setIncoming(text);
                show(text);
              })
            }
          />
        </View>
      </Card>
      {error ? <Notice kind="error">{error}</Notice> : null}
      {done ? <InlineStatus kind="success" text={t("prog.share.added")} /> : null}
      {summary ? (
        <Card>
          <AppText style={{ fontWeight: "600" }}>{t("prog.share.previewTitle", { days: summary.days, n: summary.exercises })}</AppText>
          {summary.lines.map((line, i) => (
            <AppText key={i} style={{ color: i === 0 ? p.text : p.muted }}>{line}</AppText>
          ))}
          <BigButton label={t("prog.share.add")} onPress={() => void add()} loading={busy} />
        </Card>
      ) : null}
    </Screen>
  );
}
