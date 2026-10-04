import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import React, { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useServices } from "../AppContext";
import { diagnostics } from "../diagnostics";
import { PRE_MIGRATION_FILE, PRE_RESTORE_FILE } from "../db/preMigrate";
import { RestoreFailed, type DataCounts } from "../db/dataRepo";
import { useI18n } from "../i18n";
import type { StringKey } from "../i18n/strings";
import { Platform } from "react-native";
import { BackupInvalid, type BackupFile } from "../logic/backup";
import { osTextKey } from "../logic/platform";
import { localDateText } from "../logic/trendChart";
import { space, usePalette } from "../theme";
import { AppText, BigButton, Card, InlineStatus, Notice, Screen } from "../ui";

/** Your data: export (JSON backup, CSV of sets), restore a backup, delete everything. Local only: nothing is uploaded. */
export function DataScreen() {
  const { data, restart, sync } = useServices();
  const { t } = useI18n();
  const p = usePalette();
  const [counts, setCounts] = useState<DataCounts | null>(null);
  const [busy, setBusy] = useState<StringKey | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [found, setFound] = useState<{ text: string; file: BackupFile; sessions: number; sets: number } | null>(null);
  const [askDelete, setAskDelete] = useState(false);
  const [safetyCopy, setSafetyCopy] = useState(false);
  const [restoreCopy, setRestoreCopy] = useState(false);
  const [hasOnline, setHasOnline] = useState(false);
  const [onlineFailed, setOnlineFailed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      data.counts().then(setCounts);
      sync.token().then((tok) => setHasOnline(tok !== null));
      try {
        setSafetyCopy(new File(Paths.document, PRE_MIGRATION_FILE).exists);
        setRestoreCopy(new File(Paths.document, PRE_RESTORE_FILE).exists);
      } catch {
        setSafetyCopy(false);
        setRestoreCopy(false);
      }
    }, [data, sync]),
  );

  async function share(name: string, mime: string, make: () => Promise<string>) {
    setErr(null);
    setMsg(null);
    setBusy("data.exporting");
    let uri: string;
    try {
      const body = await make();
      const f = new File(Paths.cache, name);
      f.create({ overwrite: true });
      f.write(body);
      // The export only counts as made when the file reads back exactly as written.
      if (f.textSync() !== body) throw new Error("the saved file does not match the data");
      uri = f.uri;
    } catch (e) {
      setBusy(null);
      return setErr(t("data.exportFailed", { detail: e instanceof Error ? e.message : String(e) }));
    }
    try {
      if (!(await Sharing.isAvailableAsync())) setErr(t("data.noSharing"));
      else {
        setMsg(t("data.exported", { name }));
        await Sharing.shareAsync(uri, { mimeType: mime, dialogTitle: name });
      }
    } catch (e) {
      setErr(t("data.shareFailed", { detail: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy(null);
    }
  }

  const stamp = () => localDateText(Date.now());

  async function pick() {
    setErr(null);
    setMsg(null);
    setFound(null);
    try {
      const picked = await File.pickFileAsync({ mimeTypes: ["application/json", "text/plain", "*/*"] });
      if (picked.canceled) return;
      const text = await picked.result.text();
      const i = await data.inspectBackup(text);
      setFound({ text, file: i.file, sessions: i.counts.sessions, sets: i.counts.sets });
    } catch (e) {
      setErr(e instanceof BackupInvalid ? t(`data.restore.err.${e.code}` as StringKey) : t("data.restore.err.failed", { detail: e instanceof Error ? e.message : String(e) }));
    }
  }

  /** The copy GAIN keeps from just before the last update: shown through the same checked restore as any backup. */
  async function useSafetyCopy(name: string = PRE_MIGRATION_FILE) {
    setErr(null);
    setMsg(null);
    try {
      const text = await new File(Paths.document, name).text();
      const i = await data.inspectBackup(text);
      setFound({ text, file: i.file, sessions: i.counts.sessions, sets: i.counts.sets });
    } catch (e) {
      setErr(e instanceof BackupInvalid ? t(`data.restore.err.${e.code}` as StringKey) : t("data.restore.err.failed", { detail: e instanceof Error ? e.message : String(e) }));
    }
  }

  async function restore() {
    if (!found) return;
    setErr(null);
    try {
      const r = await data.restoreJson(found.text, {
        // An automatic copy of what is on the phone now, kept (and read back) before anything is replaced.
        keepCurrent: (json) => {
          const f = new File(Paths.document, PRE_RESTORE_FILE);
          if (!f.exists) f.create({ overwrite: true });
          f.write(json);
          if (f.textSync() !== json) throw new Error("the saved copy does not match");
        },
      });
      setFound(null);
      setMsg(t("data.restored", r));
      restart();
    } catch (e) {
      setErr(e instanceof BackupInvalid ? t(`data.restore.err.${e.code}` as StringKey) : t("data.restore.err.failed", { detail: e instanceof RestoreFailed ? e.message : String(e) }));
    }
  }

  async function wipe(localOnly = false) {
    setErr(null);
    try {
      // If this phone has an online backup or coach links, delete those FIRST: once the local data (and the key to the account) is gone
      // there would be no way to delete them. If the server cannot be reached the lifter chooses: try again, or delete only here.
      if (hasOnline && !localOnly) {
        const r = await sync.disconnect({ deleteServerData: true });
        if (!r.ok) return setOnlineFailed(true);
      }
      await data.deleteAll();
      // "Delete everything" also removes the copy kept before the last update and the crash log: no data of yours stays behind in GAIN.
      try {
        const f = new File(Paths.document, PRE_MIGRATION_FILE);
        if (f.exists) f.delete();
        const r = new File(Paths.document, PRE_RESTORE_FILE);
        if (r.exists) r.delete();
      } catch {
        /* nothing to remove */
      }
      diagnostics.clear();
      setSafetyCopy(false);
      setRestoreCopy(false);
      setAskDelete(false);
      setOnlineFailed(false);
      restart();
    } catch (e) {
      setErr(t("data.exportFailed", { detail: e instanceof Error ? e.message : String(e) }));
    }
  }

  return (
    <Screen>
      <AppText style={{ color: p.muted }}>{t("data.intro")}</AppText>
      {counts ? <AppText>{t("data.counts", counts as unknown as Record<string, number>)}</AppText> : null}
      {busy ? <InlineStatus kind="info" text={t(busy)} /> : null}
      {msg ? <InlineStatus kind="success" text={msg} /> : null}
      {err ? <Notice kind="error">{err}</Notice> : null}

      <Card>
        <BigButton label={t("data.exportJson")} disabled={!!busy} onPress={() => share(`gain-backup-${stamp()}.json`, "application/json", () => data.exportJson())} />
        <AppText style={{ color: p.muted, fontSize: 13 }}>{t("data.exportJsonNote")}</AppText>
        <BigButton label={t("data.exportCsv")} variant="secondary" disabled={!!busy} onPress={() => share(`gain-sets-${stamp()}.csv`, "text/csv", () => data.exportCsv())} />
        <AppText style={{ color: p.muted, fontSize: 13 }}>{t("data.exportCsvNote")}</AppText>
      </Card>

      <Card>
        <BigButton label={t("data.restore")} variant="secondary" disabled={!!busy} onPress={pick} />
        <AppText style={{ color: p.muted, fontSize: 13 }}>{t("data.restoreNote")}</AppText>
        {found ? (
          <>
            <AppText style={{ fontWeight: "600" }}>{t("data.restore.found", { date: found.file.exportedAt.slice(0, 10), sessions: found.sessions, sets: found.sets })}</AppText>
            <AppText>{t("data.restore.warn")}</AppText>
            <BigButton variant="danger" label={t("data.restore.confirm")} onPress={restore} />
            <BigButton label={t("data.restore.cancel")} variant="secondary" onPress={() => setFound(null)} />
          </>
        ) : null}
      </Card>

      {restoreCopy ? (
        <Card>
          <AppText style={{ fontWeight: "600" }}>{t("data.beforeRestore.title")}</AppText>
          <AppText style={{ color: p.muted, fontSize: 13 }}>{t("data.beforeRestore.note")}</AppText>
          <BigButton label={t("data.safety.use")} variant="secondary" disabled={!!busy} onPress={() => void useSafetyCopy(PRE_RESTORE_FILE)} />
        </Card>
      ) : null}

      {safetyCopy ? (
        <Card>
          <AppText style={{ fontWeight: "600" }}>{t("data.safety.title")}</AppText>
          <AppText style={{ color: p.muted, fontSize: 13 }}>{t("data.safety.note")}</AppText>
          <BigButton label={t("data.safety.use")} variant="secondary" disabled={!!busy} onPress={() => void useSafetyCopy()} />
        </Card>
      ) : null}

      <Card>
        {askDelete ? (
          <>
            <AppText style={{ fontWeight: "600" }}>{t("data.delete")}</AppText>
            <AppText>{t(osTextKey("data.delete.warn", Platform.OS))}</AppText>
            {hasOnline ? <AppText>{t("data.delete.online")}</AppText> : null}
            {onlineFailed ? <InlineStatus kind="error" text={t("data.delete.onlineFailed")} /> : null}
            <BigButton variant="danger" label={t("data.delete.ask")} onPress={() => wipe()} />
            {onlineFailed ? <BigButton label={t("data.delete.localOnly")} variant="secondary" onPress={() => wipe(true)} /> : null}
            <BigButton label={t("data.delete.cancel")} variant="secondary" onPress={() => setAskDelete(false)} />
          </>
        ) : (
          <BigButton label={t("data.delete.first")} variant="danger" onPress={() => setAskDelete(true)} />
        )}
      </Card>
    </Screen>
  );
}
