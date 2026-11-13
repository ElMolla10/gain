import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { useServices } from "../AppContext";
import { BrandLogo } from "../BrandLogo";
import { GeneratedProgrammeHero } from "../components/coach/GeneratedProgrammeHero";
import { SwitchRow } from "../components/SettingsRows";
import { useI18n } from "../i18n";
import { isolateLtr } from "../i18n/format";
import { createFirstProgramSetup } from "../logic/firstProgramSetup";
import { DAYS_OPTIONS, MINUTES_OPTIONS } from "../logic/onboarding";
import { footerMode } from "../logic/onboardingLayout";
import { radius, space, type as ty, usePalette } from "../theme";
import { AppText, BigButton, Chip, Field, Notice, QuietAction, RadioGroup, RadioRow, Screen, SectionTitle } from "../ui";
import { OnboardingScreen } from "./OnboardingScreen";

/** Only first installs enter here. Returning users and the explicit setup-again route retain their existing paths. */
export function FirstInstallScreen(props: { onDone: (openImport?: boolean) => void }) {
  const services = useServices();
  const { t, lang, unit, setLang, setUnit } = useI18n();
  const p = usePalette();
  const { fontScale } = useWindowDimensions();
  const [, render] = useState(0);
  const [options, setOptions] = useState(false);
  const [custom, setCustom] = useState(false);
  const [alternativeError, setAlternativeError] = useState(false);
  const importing = useRef(false);
  const prefs = useRef({ lang, unit });
  prefs.current = { lang, unit };
  const done = useRef(props.onDone);
  done.current = props.onDone;
  const flow = useRef<ReturnType<typeof createFirstProgramSetup> | null>(null);
  if (!flow.current) flow.current = createFirstProgramSetup(services, () => prefs.current, () => render((n) => n + 1), () => done.current());
  const setup = flow.current;
  useEffect(() => {
    void setup.load();
  }, [setup]);
  const state = setup.state,
    a = state.answers;
  const update = setup.update;
  const error = alternativeError
    ? t("ob.saveFailed")
    : state.error
      ? t(
          (
            {
              answers: "first.answers",
              build: "first.buildError",
              save: "ob.saveFailed",
              restore: "first.restoreError",
              persist: "first.persistError",
            } as const
          )[state.error],
        )
      : null;
  const rows = { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: space.sm };

  if (custom) return <OnboardingScreen rerun onDone={props.onDone} onCancel={() => setCustom(false)} />;

  if (!state.started) {
    return (
      <Screen
        footerInline={footerMode(fontScale) === "inline"}
        footer={
          <BigButton
            hero
            label={t("first.build")}
            disabled={state.loading}
            onPress={() => void (state.error === "restore" ? setup.load() : setup.start())}
          />
        }
      >
        <BrandLogo size={64} />
        <AppText accessibilityRole="header" style={{ fontSize: ty.load, fontWeight: "600" }}>
          {t("ob.welcome")}
        </AppText>
        <AppText style={{ color: p.muted }}>{t("first.welcomeBody")}</AppText>
        {error ? <Notice kind="error">{error}</Notice> : null}
      </Screen>
    );
  }

  if (state.preview) {
    const badges = [
      `${isolateLtr(String(a.days))} ${t("coach.days")}`,
      t(a.environment === "dumbbell" ? "first.env.dumbbell" : "first.env.gym"),
      `${t(`coach.experience.${a.experience}`)} · ${t(`coach.goal.${a.goal}`)}`,
      t("ob.minutesValue", { n: a.minutes }),
      ...(a.skipLegs ? [t("coach.skipLegs")] : []),
    ];

    return (
      <Screen>
        <AppText accessibilityRole="header" style={{ fontSize: ty.title, fontWeight: "600" }}>
          {t("first.review")}
        </AppText>
        {error ? <Notice kind="error">{error}</Notice> : null}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginVertical: space.sm }}>
          {badges.map((badge, idx) => (
            <View
              key={idx}
              style={{
                paddingHorizontal: space.sm,
                paddingVertical: space.xs,
                borderRadius: radius.pill,
                backgroundColor: p.card,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: p.border,
              }}
            >
              <AppText style={{ fontSize: ty.caption, color: p.text }}>{badge}</AppText>
            </View>
          ))}
        </View>
        <GeneratedProgrammeHero
          preview={state.preview}
          library={state.library}
          minutes={a.minutes}
          busy={state.busy}
          onSave={setup.activate}
          saveLabel={t("first.use")}
        />
        <BigButton variant="secondary" label={t("first.edit")} disabled={state.busy} onPress={() => void update({})} />
      </Screen>
    );
  }

  return (
    <Screen
      footerInline={footerMode(fontScale) === "inline"}
      footer={
        <BigButton
          hero
          label={t("first.preview")}
          loading={state.busy}
          disabled={state.loading}
          onPress={() => void setup.build()}
        />
      }
    >
      <AppText accessibilityRole="header" style={{ fontSize: ty.title, fontWeight: "600" }}>
        {t("ob.basics")}
      </AppText>
      {error ? <Notice kind="error">{error}</Notice> : null}

      <SectionTitle>{t("coach.days")}</SectionTitle>
      <View style={rows}>
        {DAYS_OPTIONS.map((days) => (
          <Chip
            radio
            key={days}
            label={isolateLtr(String(days))}
            selected={a.days === days}
            onPress={() => void update({ days })}
          />
        ))}
      </View>

      <SectionTitle>{t("first.environment")}</SectionTitle>
      <View style={rows}>
        <Chip
          radio
          label={t("first.env.gym")}
          selected={a.environment === "gym"}
          onPress={() => void update({ environment: "gym" })}
        />
        <Chip
          radio
          label={t("first.env.dumbbell")}
          selected={a.environment === "dumbbell"}
          onPress={() => void update({ environment: "dumbbell" })}
        />
      </View>

      <View style={{ marginTop: space.md }}>
        <QuietAction
          label={options ? t("first.preferences.hide") : t("first.preferences")}
          onPress={() => setOptions((v) => !v)}
        />
        {!options ? (
          <AppText style={{ color: p.muted, fontSize: ty.caption, marginTop: space.xs }}>
            {t("first.preferences.defaults")}
          </AppText>
        ) : null}
      </View>

      {options ? (
        <>
          <SectionTitle>{t("coach.experience")}</SectionTitle>
          <View style={rows}>
            {(["beginner", "intermediate"] as const).map((experience) => (
              <Chip
                radio
                key={experience}
                label={t(`coach.experience.${experience}`)}
                selected={a.experience === experience}
                onPress={() => void update({ experience })}
              />
            ))}
          </View>

          <SectionTitle>{t("coach.goal")}</SectionTitle>
          <View style={rows}>
            {(["general", "hypertrophy", "strength"] as const).map((goal) => (
              <Chip
                radio
                key={goal}
                label={t(`coach.goal.${goal}`)}
                selected={a.goal === goal}
                onPress={() => void update({ goal })}
              />
            ))}
          </View>

          <SectionTitle>{t("coach.minutes")}</SectionTitle>
          <View style={rows}>
            {MINUTES_OPTIONS.map((minutes) => (
              <Chip
                radio
                key={minutes}
                label={t("ob.minutesValue", { n: minutes })}
                selected={a.minutes === minutes}
                onPress={() => void update({ minutes })}
              />
            ))}
          </View>

          <SwitchRow
            label={t("coach.skipLegs")}
            note={t("coach.skipLegs.note")}
            value={a.skipLegs}
            onChange={(skipLegs) => void update({ skipLegs })}
          />

          <Field
            label={t("first.avoid")}
            hint={t("coach.avoid.hint")}
            value={a.avoidText}
            onChangeText={(avoidText) => void update({ avoidText })}
          />

          <SectionTitle>{t("ob.language")}</SectionTitle>
          <RadioGroup label={t("ob.language")}>
            {(["en", "ar"] as const).map((language) => (
              <RadioRow
                key={language}
                label={t(`settings.language.${language}`)}
                selected={lang === language}
                onPress={() => {
                  setLang(language);
                  void update({});
                }}
              />
            ))}
          </RadioGroup>

          <SectionTitle>{t("ob.units")}</SectionTitle>
          <RadioGroup label={t("ob.units")}>
            {(["kg", "lb"] as const).map((weightUnit) => (
              <RadioRow
                key={weightUnit}
                label={t(`ob.units.${weightUnit}`)}
                selected={unit === weightUnit}
                onPress={() => setUnit(weightUnit)}
              />
            ))}
          </RadioGroup>

          <QuietAction
            label={t("ob.importFirst")}
            onPress={() => {
              if (importing.current) return;
              importing.current = true;
              setAlternativeError(false);
              void services.onboarding
                .skip()
                .then(() => props.onDone(true))
                .catch(() => setAlternativeError(true))
                .finally(() => {
                  importing.current = false;
                });
            }}
          />
          <QuietAction label={t("ob.programme.own")} onPress={() => setCustom(true)} />
          <AppText style={{ color: p.muted, marginTop: space.xs }}>{t("first.optionsNote")}</AppText>
        </>
      ) : null}
    </Screen>
  );
}
