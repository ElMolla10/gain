import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { ScrollView } from "react-native";
import { useServices } from "../AppContext";
import { useI18n } from "../i18n";
import type { StringKey } from "../i18n/strings";
import { localDateText } from "../logic/trendChart";
import type { SyncInfo } from "../sync/engine";
import { space, usePalette } from "../theme";
import { AppText, BigButton, Card, Field } from "../ui";

type Step = "idle" | "code" | "choice";

/**
 * Settings > Back up and sync. OFF by default. Nothing is sent until "Turn on". The screen explains what is sent, shows the recovery code
 * once (and again on request), and says plainly when something could not be merged or reached.
 */
export function SyncScreen() {
  const { sync, restart } = useServices();
  const { t } = useI18n();
  const p = usePalette();
  const [info, setInfo] = useState<SyncInfo | null>(null);
  const [busy, setBusy] = useState<StringKey | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [code, setCode] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [askDelete, setAskDelete] = useState(false);

  const reload = useCallback(async () => {
    setInfo(await sync.getInfo());
  }, [sync]);
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const fail = (e: string) => setErr(t(`sync.err.${e}` as StringKey));
  const clear = () => {
    setErr(null);
    setMsg(null);
  };

  async function turnOn(recoveryCode?: string) {
    clear();
    setBusy("sync.connecting");
    try {
      const r = await sync.connect({ recoveryCode: recoveryCode?.trim() || undefined });
      if (!r.ok) return fail(r.error);
      if (r.needsChoice) {
        setStep("choice");
        return;
      }
      setBusy("sync.syncing");
      const s = await sync.syncNow();
      if (!s.ok) fail(s.error);
      else setMsg(t("sync.synced"));
      if (recoveryCode) restart(); // a restored backup replaced this phone's data: reload everything
      else if (r.recoveryCode) {
        setCode(r.recoveryCode);
        setStep("code");
      }
    } finally {
      setBusy(null);
      void reload();
    }
  }

  async function useBackup() {
    clear();
    setBusy("sync.connecting");
    try {
      const r = await sync.useBackup();
      if (!r.ok) return fail(r.error);
      setStep("idle");
      restart();
    } finally {
      setBusy(null);
    }
  }

  async function cancelChoice() {
    clear();
    await sync.disconnect({ deleteServerData: false });
    setStep("idle");
    await reload();
  }

  async function syncNow() {
    clear();
    setBusy("sync.syncing");
    try {
      const s = await sync.syncNow();
      if (!s.ok) fail(s.error);
      else setMsg(t("sync.synced"));
    } finally {
      setBusy(null);
      void reload();
    }
  }

  async function turnOff(del: boolean) {
    clear();
    setBusy("sync.connecting");
    try {
      const r = await sync.disconnect({ deleteServerData: del });
      if (!r.ok) return fail(r.error);
      setAskDelete(false);
      setCode(null);
      setStep("idle");
      setMsg(t(del ? "sync.deleted" : "sync.turnedOff"));
    } finally {
      setBusy(null);
      void reload();
    }
  }

  async function showCode() {
    setCode(await sync.getRecoveryCode());
    setStep("code");
  }

  const status = info?.status ?? "off";
  return (
    <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space.xl * 2 }}>
      <AppText style={{ color: p.danger, fontWeight: "600" }}>{t("sync.draft")}</AppText>
      <Card>
        <AppText style={{ fontWeight: "600" }} accessibilityRole="header">{t("sync.privacy.title")}</AppText>
        <AppText>{t("sync.privacy.body")}</AppText>
        <AppText>{t("sync.privacy.body2")}</AppText>
      </Card>

      <AppText style={{ fontWeight: "600" }}>{t(`sync.status.${status}` as StringKey)}</AppText>
      {busy ? <AppText>{t(busy)}</AppText> : null}
      {msg ? <AppText style={{ fontWeight: "600" }}>✓ {msg}</AppText> : null}
      {err ? <AppText style={{ color: p.danger }}>{err}</AppText> : null}

      {step === "code" && code ? (
        <Card>
          <AppText style={{ fontWeight: "600" }} accessibilityRole="header">{t("sync.code.title")}</AppText>
          <AppText ltr selectable style={{ fontSize: 20, fontWeight: "600", letterSpacing: 1 }}>{code}</AppText>
          <AppText>{t("sync.code.body")}</AppText>
          <BigButton label={t("sync.code.saved")} onPress={() => setStep("idle")} />
        </Card>
      ) : null}

      {step === "choice" ? (
        <Card>
          <AppText style={{ fontWeight: "600" }} accessibilityRole="header">{t("sync.choice.title")}</AppText>
          <AppText>{t("sync.choice.body")}</AppText>
          <BigButton label={t("sync.choice.use")} disabled={!!busy} onPress={useBackup} />
          <BigButton label={t("sync.choice.cancel")} selected={false} disabled={!!busy} onPress={cancelChoice} />
          <AppText style={{ color: p.muted, fontSize: 13 }}>{t("sync.choice.replaceNote")}</AppText>
        </Card>
      ) : null}

      {status === "off" && step === "idle" ? (
        <>
          <Card>
            <BigButton label={t("sync.on")} disabled={!!busy} onPress={() => turnOn()} />
          </Card>
          <Card>
            <AppText style={{ fontWeight: "600" }} accessibilityRole="header">{t("sync.restoreTitle")}</AppText>
            <AppText style={{ color: p.muted }}>{t("sync.restoreNote")}</AppText>
            <Field label={t("sync.codeField")} hint={t("sync.codeHint")} value={typed} onChangeText={setTyped} />
            <BigButton label={t("sync.restore")} selected={false} disabled={!!busy || typed.trim().length < 10} onPress={() => turnOn(typed)} />
          </Card>
        </>
      ) : null}

      {status === "pending" && step === "idle" ? (
        <Card>
          <BigButton label={t("sync.finish")} disabled={!!busy} onPress={() => turnOn()} />
          <BigButton label={t("sync.choice.cancel")} selected={false} disabled={!!busy} onPress={cancelChoice} />
        </Card>
      ) : null}

      {status === "on" ? (
        <>
          <Card>
            <AppText>{info?.lastSyncAt ? t("sync.last", { when: `${localDateText(info.lastSyncAt)} ${new Date(info.lastSyncAt).toTimeString().slice(0, 5)}` }) : t("sync.never")}</AppText>
            <AppText>{info && info.pendingOut > 0 ? t("sync.pending", { n: info.pendingOut }) : t("sync.nothingPending")}</AppText>
            {info && info.parked.conflict > 0 ? <AppText style={{ color: p.danger }}>{t("sync.parked.conflict", { n: info.parked.conflict })}</AppText> : null}
            {info && info.parked.waiting_parent > 0 ? <AppText>{t("sync.parked.waiting", { n: info.parked.waiting_parent })}</AppText> : null}
            {info && info.parked.newer_app > 0 ? <AppText style={{ color: p.danger }}>{t("sync.parked.newer", { n: info.parked.newer_app })}</AppText> : null}
            {info && info.rejectedTotal > 0 ? <AppText>{t("sync.rejected", { n: info.rejectedTotal })}</AppText> : null}
            {info?.lastError ? <AppText style={{ color: p.danger }}>{t(`sync.err.${info.lastError.split(":")[0]}` as StringKey)}</AppText> : null}
            <BigButton label={t("sync.syncNow")} disabled={!!busy} onPress={syncNow} />
          </Card>
          <Card>
            {step === "code" ? (
              <BigButton label={t("sync.code.hide")} selected={false} onPress={() => setStep("idle")} />
            ) : (
              <BigButton label={t("sync.code.show")} selected={false} onPress={showCode} />
            )}
          </Card>
          <Card>
            <BigButton label={t("sync.off")} selected={false} disabled={!!busy} onPress={() => turnOff(false)} />
            {askDelete ? (
              <>
                <AppText>{t("sync.offDelete.warn")}</AppText>
                <BigButton label={t("sync.offDelete.confirm")} disabled={!!busy} onPress={() => turnOff(true)} />
                <BigButton label={t("sync.offDelete.cancel")} selected={false} onPress={() => setAskDelete(false)} />
              </>
            ) : (
              <BigButton label={t("sync.offDelete")} selected={false} disabled={!!busy} onPress={() => setAskDelete(true)} />
            )}
          </Card>
        </>
      ) : null}
    </ScrollView>
  );
}
