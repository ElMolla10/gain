import Constants from "expo-constants";
import { ACHIEVEMENT_RULE_VERSION } from "@gain/engine";
import React, { useCallback, useState } from "react";
import { Share, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useServices } from "../AppContext";
import { telemetry } from "../achievementTelemetry";
import { formatChecklistExport, type ChecklistAnswers } from "../logic/achievementTelemetry";
import { useI18n } from "../i18n";
import { space, usePalette } from "../theme";
import { AppText, BigButton, Card, Chip, Field, InlineStatus, Screen } from "../ui";

/** Pilot checklist: answers stay on this phone until the lifter shares them through the system share sheet. */
export function PilotChecklistScreen() {
  const { history } = useServices();
  const { t } = useI18n();
  const p = usePalette();
  const [answers, setAnswers] = useState<ChecklistAnswers>({
    explainBadge: "",
    nextUp: "",
    feltPenalized: null,
    unexpectedRevoke: null,
    unexpectedNote: "",
  });
  const [msg, setMsg] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      const c = telemetry.snapshot().checklist;
      setAnswers({
        explainBadge: c.explainBadge,
        nextUp: c.nextUp,
        feltPenalized: c.feltPenalized,
        unexpectedRevoke: c.unexpectedRevoke,
        unexpectedNote: c.unexpectedNote,
      });
    }, []),
  );

  return (
    <Screen>
      <Card>
        <AppText style={{ fontWeight: "600" }}>{t("pilot.title")}</AppText>
        <AppText style={{ color: p.muted }}>{t("pilot.intro")}</AppText>
      </Card>
      <Card>
        <Field label={t("pilot.q.explain")} value={answers.explainBadge} onChangeText={(explainBadge) => setAnswers({ ...answers, explainBadge })} multiline />
        <Field label={t("pilot.q.nextup")} value={answers.nextUp} onChangeText={(nextUp) => setAnswers({ ...answers, nextUp })} multiline />
        <AppText style={{ fontWeight: "600" }}>{t("pilot.q.penalized")}</AppText>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Chip label={t("pilot.yes")} selected={answers.feltPenalized === true} onPress={() => setAnswers({ ...answers, feltPenalized: true })} />
          <Chip label={t("pilot.no")} selected={answers.feltPenalized === false} onPress={() => setAnswers({ ...answers, feltPenalized: false })} />
        </View>
        <AppText style={{ fontWeight: "600" }}>{t("pilot.q.revoke")}</AppText>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Chip label={t("pilot.yes")} selected={answers.unexpectedRevoke === true} onPress={() => setAnswers({ ...answers, unexpectedRevoke: true })} />
          <Chip label={t("pilot.no")} selected={answers.unexpectedRevoke === false} onPress={() => setAnswers({ ...answers, unexpectedRevoke: false })} />
        </View>
        <Field label={t("pilot.q.revoke.note")} value={answers.unexpectedNote} onChangeText={(unexpectedNote) => setAnswers({ ...answers, unexpectedNote })} multiline />
        <BigButton
          label={t("pilot.save")}
          variant="secondary"
          onPress={() => {
            telemetry.saveChecklist(answers);
            setMsg(t("pilot.saved"));
          }}
        />
        <BigButton
          label={t("pilot.share")}
          variant="secondary"
          onPress={() => {
            void (async () => {
              setMsg(null);
              try {
                telemetry.saveChecklist(answers);
                const sessionCount = await history.countSessions();
                const body = formatChecklistExport(
                  telemetry.exportChecklist({
                    appVersion: Constants.expoConfig?.version ?? "?",
                    achievementRuleVersion: ACHIEVEMENT_RULE_VERSION,
                    sessionCount,
                  }),
                );
                await Share.share({ message: body, title: t("pilot.title") });
              } catch (e) {
                setMsg(t("data.shareFailed", { detail: e instanceof Error ? e.message : String(e) }));
              }
            })();
          }}
        />
        <AppText style={{ color: p.muted, fontSize: 13 }}>{t("pilot.share.note")}</AppText>
        {msg ? <InlineStatus kind="info" text={msg} /> : null}
      </Card>
    </Screen>
  );
}
