import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import { File, Paths } from "expo-file-system";
import { getContentUriAsync } from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import React, { useState } from "react";
import { Platform } from "react-native";
import { useI18n } from "../i18n";
import type { StringKey } from "../i18n/strings";
import { checkForUpdate, shaMatches, toHex, type FetchLike, type UpdateResult } from "../logic/updateCheck";
import { usePalette } from "../theme";
import { AppText, BigButton, Card } from "../ui";

type Phase = "idle" | "checking" | "downloading" | "verifying" | "launched";
const PACKAGE = "app.gain.mobile";

/**
 * Settings > Updates. Asks GitHub's public releases (no token) for the newest release, shows version and notes, and on a tap downloads
 * the APK, checks its SHA-256 against the release (when the release lists one) and opens Android's installer. The new APK is signed with
 * the same key, so Android installs it over this one and keeps your data. Android may first ask you to allow installs from GAIN.
 */
export function UpdateCard() {
  const { t, fmt } = useI18n();
  const p = usePalette();
  const installed = Constants.expoConfig?.version ?? "0.0.0";
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<UpdateResult | null>(null);
  const [problem, setProblem] = useState<StringKey | null>(null);

  async function check() {
    setPhase("checking");
    setProblem(null);
    setResult(null);
    const r = await checkForUpdate(installed, fetch as unknown as FetchLike);
    setResult(r);
    setPhase("idle");
  }

  async function install(r: Extract<UpdateResult, { kind: "available" }>) {
    setProblem(null);
    try {
      const file = new File(Paths.cache, r.assetName);
      if (file.exists) file.delete();
      setPhase("downloading");
      await File.downloadFileAsync(r.url, file, { idempotent: true });
      if (r.sha256) {
        setPhase("verifying");
        const actual = toHex(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, await file.bytes()));
        if (!shaMatches(actual, r.sha256)) {
          file.delete();
          setPhase("idle");
          return setProblem("update.err.hash");
        }
      }
      const uri = await getContentUriAsync(file.uri);
      await IntentLauncher.startActivityAsync("android.intent.action.VIEW", { data: uri, flags: 1, type: "application/vnd.android.package-archive" });
      setPhase("launched");
    } catch {
      setPhase("idle");
      setProblem("update.err.install");
    }
  }

  async function allowInstalls() {
    try {
      await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.MANAGE_UNKNOWN_APP_SOURCES, { data: `package:${PACKAGE}` });
    } catch {
      setProblem("update.err.settings");
    }
  }

  const busy = phase === "checking" || phase === "downloading" || phase === "verifying";
  return (
    <Card>
      <AppText style={{ fontWeight: "600" }}>{t("update.title")}</AppText>
      <AppText style={{ color: p.muted }}>{t("update.current", { v: installed })}</AppText>
      {Platform.OS !== "android" ? <AppText style={{ color: p.muted }}>{t("update.androidOnly")}</AppText> : null}
      <BigButton label={phase === "checking" ? t("update.checking") : t("update.check")} selected={false} disabled={busy || Platform.OS !== "android"} onPress={() => void check()} />
      {result?.kind === "up_to_date" ? <AppText>✓ {t("update.upToDate", { v: result.installed })}</AppText> : null}
      {result?.kind === "error" ? <AppText style={{ fontWeight: "600" }}>⚠ {t(`update.err.${result.reason}` as StringKey)}</AppText> : null}
      {result?.kind === "available" ? (
        <>
          <AppText style={{ fontSize: 16, fontWeight: "600" }}>{t("update.available", { v: result.version })}</AppText>
          {result.prerelease ? <AppText style={{ color: p.muted }}>{t("update.pre")}</AppText> : null}
          {result.size ? <AppText style={{ color: p.muted }}>{t("update.size", { mb: fmt(Math.round(result.size / 1_000_000)) })}</AppText> : null}
          {result.notes ? <AppText style={{ color: p.muted, fontSize: 14 }}>{result.notes}</AppText> : null}
          <AppText style={{ color: p.muted, fontSize: 13 }}>{result.sha256 ? t("update.hash.yes") : t("update.hash.no")}</AppText>
          <BigButton
            label={phase === "downloading" ? t("update.downloading") : phase === "verifying" ? t("update.verifying") : t("update.install", { v: result.version })}
            disabled={busy}
            onPress={() => void install(result)}
          />
          {phase === "launched" ? <AppText>{t("update.launched")}</AppText> : null}
          <BigButton label={t("update.allow")} selected={false} onPress={() => void allowInstalls()} />
          <AppText style={{ color: p.muted, fontSize: 13 }}>{t("update.keepData")}</AppText>
        </>
      ) : null}
      {problem ? <AppText style={{ fontWeight: "600" }}>⚠ {t(problem)}</AppText> : null}
    </Card>
  );
}
