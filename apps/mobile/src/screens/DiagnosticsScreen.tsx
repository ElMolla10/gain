import Constants from "expo-constants";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import React, { useCallback, useState } from "react";
import { Platform, Share, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useServices } from "../AppContext";
import { diagnostics } from "../diagnostics";
import { buildFeedbackMessage } from "../logic/diagnostics";
import { useI18n } from "../i18n";
import { localDateText } from "../logic/trendChart";
import { space, usePalette } from "../theme";
import { AppText, BigButton, Card, Chip, InlineStatus, Screen } from "../ui";

/**
 * Diagnostics (Step 18, draft): a crash log kept ON THIS PHONE (on by default, can be switched off and cleared) and a report the lifter can
 * read first and then share by hand. Nothing is sent anywhere by the app; there is no account, no server and no third-party service.
 */
export function DiagnosticsScreen() {
  const { db } = useServices();
  const { t, lang } = useI18n();
  const p = usePalette();
  const [on, setOn] = useState(true);
  const [report, setReport] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);

  const context = useCallback(async () => {
    let schema: number | null = null;
    try {
      schema = Number((await db.get<{ user_version: number }>("PRAGMA user_version"))?.user_version ?? null);
    } catch {
      schema = null;
    }
    return { appVersion: Constants.expoConfig?.version ?? "?", platform: Platform.OS, osVersion: Platform.Version, language: lang, schemaVersion: schema };
  }, [db, lang]);
  const build = useCallback(async () => diagnostics.report(await context()), [context]);

  /** Text-only share sheet: the lifter edits the message and picks where it goes; the app sends nothing. */
  async function sendFeedback() {
    setMsg(null);
    try {
      const message = buildFeedbackMessage(diagnostics.entries(), await context(), {
        title: t("diag.fb.title"),
        did: t("diag.fb.did"),
        expected: t("diag.fb.expected"),
        lost: t("diag.fb.lost"),
        tech: t("diag.fb.tech"),
        crashNotes: t("diag.fb.crashNotes"),
        latest: t("diag.fb.latest"),
      });
      await Share.share({ message, title: t("diag.fb.title") });
    } catch (e) {
      setMsg(t("data.shareFailed", { detail: e instanceof Error ? e.message : String(e) }));
    }
  }

  useFocusEffect(
    useCallback(() => {
      setOn(diagnostics.isEnabled());
      setCount(diagnostics.entries().length);
    }, []),
  );

  async function share() {
    setMsg(null);
    try {
      const body = report ?? (await build());
      const name = `gain-diagnostics-${localDateText(Date.now())}.txt`;
      const f = new File(Paths.cache, name);
      f.create({ overwrite: true });
      f.write(body);
      if (!(await Sharing.isAvailableAsync())) return setMsg(t("data.noSharing"));
      await Sharing.shareAsync(f.uri, { mimeType: "text/plain", dialogTitle: name });
    } catch (e) {
      setMsg(t("data.shareFailed", { detail: e instanceof Error ? e.message : String(e) }));
    }
  }

  return (
    <Screen>
      <Card>
        <AppText style={{ fontWeight: "600" }}>{t("diag.title")}</AppText>
        <AppText style={{ color: p.muted }}>{t("diag.intro")}</AppText>
        <AppText style={{ color: p.muted }}>{t("diag.draft")}</AppText>
      </Card>
      <Card>
        <AppText style={{ fontWeight: "600" }}>{t("diag.log")}</AppText>
        <AppText style={{ color: p.muted }}>{t("diag.logNote")}</AppText>
        <AppText>{t("diag.count", { n: count })}</AppText>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Chip label={t("diag.on")} selected={on} onPress={() => (diagnostics.setEnabled(true), setOn(true))} />
          <Chip label={t("diag.off")} selected={!on} onPress={() => (diagnostics.setEnabled(false), setOn(false))} />
        </View>
      </Card>
      <Card>
        <BigButton label={t("diag.preview")} variant="secondary" onPress={() => void build().then(setReport)} />
        {report ? (
          <AppText ltr selectable style={{ fontSize: 13, color: p.text }}>
            {report}
          </AppText>
        ) : null}
        <BigButton label={t("diag.share")} variant="secondary" onPress={() => void share()} />
        <AppText style={{ color: p.muted, fontSize: 13 }}>{t("diag.shareNote")}</AppText>
        <BigButton label={t("diag.feedback")} variant="secondary" onPress={() => void sendFeedback()} />
        <AppText style={{ color: p.muted, fontSize: 13 }}>{t("diag.feedbackNote")}</AppText>
        <BigButton
          label={t("diag.clear")}
          variant="danger"
          onPress={() => {
            diagnostics.clear();
            setCount(0);
            setReport(null);
            setMsg(t("diag.cleared"));
          }}
        />
        {msg ? <InlineStatus kind="info" text={msg} /> : null}
      </Card>
    </Screen>
  );
}
