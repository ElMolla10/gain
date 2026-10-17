import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import { View } from "react-native";
import { useServices } from "../AppContext";
import { useI18n } from "../i18n";
import { isolateLtr } from "../i18n/format";
import type { StringKey } from "../i18n/strings";
import { groupCode, normalizeCode } from "../logic/recoveryCodeText";
import { formatDay } from "../logic/dateText";
import type { SyncInfo } from "../sync/engine";
import { radius, space, usePalette } from "../theme";
import { AppText, BigButton, Card, Field, InlineStatus, Notice, Screen } from "../ui";

type Step = "idle" | "code" | "choice";

/**
 * Settings > Back up and sync. OFF by default. Nothing is sent until "Turn on". The screen explains what is sent, shows the recovery code
 * once (and again on request), and says plainly when something could not be merged or reached.
 */
export function SyncScreen() {
  const { sync, restart } = useServices();
  const { t, lang } = useI18n();
  const p = usePalette();
  const [info, setInfo] = useState<SyncInfo | null>(null);
  const [busy, setBusy] = useState<StringKey | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [code, setCode] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [email, setEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
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
      const r = await sync.connect({ recoveryCode: (recoveryCode && normalizeCode(recoveryCode)) || undefined });
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

  async function sendEmailCode() {
    clear();
    setBusy("sync.connecting");
    try {
      const r = await sync.startEmail(email);
      if (!r.ok) return fail(r.error);
      setMsg(t("sync.email.sent"));
    } finally {
      setBusy(null);
    }
  }

  async function verifyEmail() {
    clear();
    setBusy("sync.connecting");
    try {
      const r = await sync.verifyEmail({ email, code: emailCode.trim() });
      if (!r.ok) return fail(r.error);
      if (r.needsChoice) {
        setStep("choice");
        return;
      }
      setBusy("sync.syncing");
      const s = await sync.syncNow();
      if (!s.ok) fail(s.error);
      else setMsg(t("sync.synced"));
      if (r.recoveryCode) {
        setCode(r.recoveryCode);
        setStep("code");
      }
    } finally {
      setBusy(null);
      void reload();
    }
  }

  const status = info?.status ?? "off";
  return (
    <Screen>
      <Notice kind="warn">{t("sync.draft")}</Notice>
      <Card>
        <AppText style={{ fontWeight: "600" }} accessibilityRole="header">{t("sync.privacy.title")}</AppText>
        <AppText>{t("sync.privacy.body")}</AppText>
        <AppText>{t("sync.privacy.body2")}</AppText>
      </Card>

      <InlineStatus kind={status === "on" && info && info.pendingOut === 0 && !info.lastError ? "success" : "info"} text={t(`sync.status.${status}` as StringKey)} />
      {status === "on" && !busy && !err && !(info?.lastError) ? <InlineStatus kind="info" text={t("sync.status.idle")} /> : null}
      {busy ? <InlineStatus kind="info" text={t(busy)} /> : null}
      {msg ? <InlineStatus kind="success" text={msg} /> : null}
      {err ? <Notice kind="error">{err}</Notice> : null}

      {step === "code" && code ? (
        <Card>
          <AppText style={{ fontWeight: "600" }} accessibilityRole="header">{t("sync.code.title")}</AppText>
          <View style={{ backgroundColor: p.raised, borderRadius: radius.input, padding: space.lg }}>
            <AppText ltr selectable style={{ fontSize: 28, lineHeight: 34, fontWeight: "600", fontVariant: ["tabular-nums"] }}>{isolateLtr(groupCode(code))}</AppText>
          </View>
          <AppText style={{ color: p.muted, fontSize: 14, lineHeight: 20 }}>{t("sync.code.copyHint")}</AppText>
          <AppText>{t("sync.code.body")}</AppText>
          <BigButton label={t("sync.code.saved")} onPress={() => setStep("idle")} />
        </Card>
      ) : null}

      {step === "choice" ? (
        <Card>
          <AppText style={{ fontWeight: "600" }} accessibilityRole="header">{t("sync.choice.title")}</AppText>
          <AppText>{t("sync.choice.body")}</AppText>
          <BigButton label={t("sync.choice.use")} disabled={!!busy} onPress={useBackup} />
          <BigButton label={t("sync.choice.cancel")} variant="secondary" disabled={!!busy} onPress={cancelChoice} />
          <AppText style={{ color: p.muted, fontSize: 13 }}>{t("sync.choice.replaceNote")}</AppText>
        </Card>
      ) : null}

      {status === "off" && step === "idle" ? (
        <>
          <Card>
            <BigButton hero label={t("sync.on")} disabled={!!busy} onPress={() => turnOn()} />
          </Card>
          <Card>
            <AppText style={{ fontWeight: "600" }} accessibilityRole="header">{t("sync.restoreTitle")}</AppText>
            <AppText style={{ color: p.muted }}>{t("sync.restoreNote")}</AppText>
            <Field label={t("sync.codeField")} hint={t("sync.codeHint")} value={typed} onChangeText={setTyped} />
            <BigButton label={t("sync.restore")} variant="secondary" disabled={!!busy || normalizeCode(typed).length < 10} onPress={() => turnOn(typed)} />
          </Card>
          <Card>
            <AppText style={{ fontWeight: "600" }} accessibilityRole="header">{t("sync.email.title")}</AppText>
            <AppText style={{ color: p.muted }}>{t("sync.email.body")}</AppText>
            <Field label={t("sync.email.field")} hint={t("sync.email.hint")} value={email} onChangeText={setEmail} keyboardType="email-address" />
            <BigButton label={t("sync.email.send")} variant="secondary" disabled={!!busy || !email.includes("@")} onPress={sendEmailCode} />
            <Field label={t("sync.email.code")} hint={t("sync.email.codeHint")} value={emailCode} onChangeText={setEmailCode} keyboardType="number-pad" />
            <BigButton label={t("sync.email.verify")} disabled={!!busy || emailCode.trim().length !== 8} onPress={verifyEmail} />
          </Card>
        </>
      ) : null}

      {status === "pending" && step === "idle" ? (
        <Card>
          <BigButton label={t("sync.finish")} disabled={!!busy} onPress={() => turnOn()} />
          <BigButton label={t("sync.choice.cancel")} variant="secondary" disabled={!!busy} onPress={cancelChoice} />
        </Card>
      ) : null}

      {status === "on" ? (
        <>
          <Card>
            <AppText>{info?.lastSyncAt ? t("sync.last", { when: `${formatDay(info.lastSyncAt, lang)} ${new Date(info.lastSyncAt).toTimeString().slice(0, 5)}` }) : t("sync.never")}</AppText>
            <AppText>{info && info.pendingOut > 0 ? t("sync.pending", { n: info.pendingOut }) : t("sync.nothingPending")}</AppText>
            {info && info.parked.conflict > 0 ? <InlineStatus kind="error" text={t("sync.parked.conflict", { n: info.parked.conflict })} /> : null}
            {info && info.parked.waiting_parent > 0 ? <AppText>{t("sync.parked.waiting", { n: info.parked.waiting_parent })}</AppText> : null}
            {info && info.parked.newer_app > 0 ? <InlineStatus kind="error" text={t("sync.parked.newer", { n: info.parked.newer_app })} /> : null}
            {info && info.rejectedTotal > 0 ? <AppText>{t("sync.rejected", { n: info.rejectedTotal })}</AppText> : null}
            {info?.lastError ? <Notice kind="error" actionLabel={t("sync.syncNow")} onAction={syncNow}>{t(`sync.err.${info.lastError.split(":")[0]}` as StringKey)}</Notice> : null}
            <BigButton icon="cloud" label={t("sync.syncNow")} disabled={!!busy} onPress={syncNow} />
          </Card>
          <Card>
            {info?.email ? <AppText>{t("sync.email.linked", { email: info.email })}</AppText> : <AppText>{t("sync.email.none")}</AppText>}
            {!info?.email ? (
              <>
                <Field label={t("sync.email.field")} hint={t("sync.email.hint")} value={email} onChangeText={setEmail} keyboardType="email-address" />
                <BigButton label={t("sync.email.send")} variant="secondary" disabled={!!busy || !email.includes("@")} onPress={sendEmailCode} />
                <Field label={t("sync.email.code")} hint={t("sync.email.codeHint")} value={emailCode} onChangeText={setEmailCode} keyboardType="number-pad" />
                <BigButton label={t("sync.email.link")} disabled={!!busy || emailCode.trim().length !== 8} onPress={verifyEmail} />
              </>
            ) : null}
          </Card>
          <Card>
            {step === "code" ? (
              <BigButton label={t("sync.code.hide")} variant="secondary" onPress={() => setStep("idle")} />
            ) : (
              <BigButton label={t("sync.code.show")} variant="secondary" onPress={showCode} />
            )}
          </Card>
          <Card>
            <BigButton label={t("sync.off")} variant="secondary" disabled={!!busy} onPress={() => turnOff(false)} />
            {askDelete ? (
              <>
                <AppText>{t("sync.offDelete.warn")}</AppText>
                <BigButton variant="danger" label={t("sync.offDelete.confirm")} disabled={!!busy} onPress={() => turnOff(true)} />
                <BigButton label={t("sync.offDelete.cancel")} variant="secondary" onPress={() => setAskDelete(false)} />
              </>
            ) : (
              <BigButton label={t("sync.offDelete")} variant="danger" disabled={!!busy} onPress={() => setAskDelete(true)} />
            )}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
