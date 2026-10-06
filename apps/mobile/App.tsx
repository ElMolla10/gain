import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { DarkTheme, DefaultTheme, NavigationContainer, useNavigation } from "@react-navigation/native";
import * as Crypto from "expo-crypto";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { navColors } from "./src/palettes";
import { parseAppearance, setAppearance, space, useIsDark, usePalette } from "./src/theme";
import { ServicesProvider, type AppServices } from "./src/AppContext";
import { openExpoDb, openExpoMaintenanceDb } from "./src/db/expoDriver";
import { migrate } from "./src/db/migrations";
import { backupBeforeMigrate } from "./src/db/preMigrate";
import { File, Paths } from "expo-file-system";
import { createFinishRepo } from "./src/db/finishRepo";
import { createGoalRepo } from "./src/db/goalRepo";
import { createGymRepo } from "./src/db/gymRepo";
import { createOnboardingRepo } from "./src/db/onboardingRepo";
import { createImportRepo } from "./src/db/importRepo";
import { createProgrammeRepo } from "./src/db/programmeRepo";
import { createRepos } from "./src/db/repos";
import { loadReminderSettings, reminderText, syncReminders } from "./src/logic/reminders";
import { createReminders } from "./src/notifications/reminders";
import { createRestAlerts } from "./src/notifications/restAlerts";
import { createDataRepo } from "./src/db/dataRepo";
import { Icon, type IconName } from "./src/components/Icon";
import { BootError, BootLoading, MigrationBlocked } from "./src/components/BootScreens";
import { useBrandFonts } from "./src/useBrandFonts";
import { familyFor } from "./src/fonts";
import { AppText, BigButton } from "./src/ui";
import { ErrorBoundary } from "./src/components/ErrorBoundary";
import { NumberPadDone } from "./src/components/NumberPadDone";
import { diagnostics } from "./src/diagnostics";
import { installCrashHandler } from "./src/logic/diagnostics";
import { PrivacyScreen } from "./src/screens/PrivacyScreen";
import { DiagnosticsScreen } from "./src/screens/DiagnosticsScreen";
import { DataScreen } from "./src/screens/DataScreen";
import type { Db } from "./src/db/driver";
import { createDecisionRepo } from "./src/db/decisionRepo";
import { DecisionLogScreen } from "./src/screens/DecisionLogScreen";
import { createHistoryRepo } from "./src/db/historyRepo";
import { createRejectionRepo } from "./src/db/rejectionRepo";
import { createShortWeekRepo } from "./src/db/shortWeekRepo";
import { createWeeklyRepo } from "./src/db/weeklyRepo";
import { createWorkoutRepo } from "./src/db/workoutRepo";
import { FinishScreen } from "./src/screens/FinishScreen";
import { WhyScreen } from "./src/screens/WhyScreen";
import { WorkoutScreen } from "./src/screens/WorkoutScreen";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { I18nProvider, useI18n } from "./src/i18n";
import type { Lang, RtlOverride } from "./src/i18n/format";
import type { Unit } from "./src/logic/units";
import { ImportScreen } from "./src/screens/ImportScreen";
import { OnboardingScreen } from "./src/screens/OnboardingScreen";
import { GoalsScreen } from "./src/screens/GoalsScreen";
import { HistoryScreen } from "./src/screens/HistoryScreen";
import { LiftTrendScreen } from "./src/screens/LiftTrendScreen";
import { ExerciseLoadsScreen } from "./src/screens/ExerciseLoadsScreen";
import { SaveWorkoutDayScreen } from "./src/screens/SaveWorkoutDayScreen";
import { SessionDetailScreen } from "./src/screens/SessionDetailScreen";
import { ProgrammeEditScreen } from "./src/screens/ProgrammeEditScreen";
import { ProgrammeSwitchScreen } from "./src/screens/ProgrammeSwitchScreen";
import { ProgrammeScreen } from "./src/screens/ProgrammeScreen";
import { ProgrammeExposureScreen, ProgrammeVersionsScreen } from "./src/screens/ProgrammeMoreScreens";
import { StoppedSuggestionsScreen } from "./src/screens/StoppedSuggestionsScreen";
import { ShortWeekScreen } from "./src/screens/ShortWeekScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { TodayScreen } from "./src/screens/TodayScreen";
import { SyncScreen } from "./src/screens/SyncScreen";
import { createAutoSync } from "./src/sync/auto";
import { createCoachLinks } from "./src/sync/coachLinks";
import { createSyncEngine } from "./src/sync/engine";
import { createSecureStoreSecrets } from "./src/sync/secureStore";
import { createFetchTransport } from "./src/sync/transport";

// Uncaught JavaScript errors go to the crash log on this phone (never uploaded), then on to the normal handler.
installCrashHandler(diagnostics, (globalThis as { ErrorUtils?: Parameters<typeof installCrashHandler>[1] }).ErrorUtils);

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

/** Tab icon: the kit's 24 px line icon, with a pill behind it when selected so the selected tab is identifiable beyond colour. */
function TabBarIcon({ name, color, focused }: { name: IconName; color: string; focused: boolean }) {
  const p = usePalette();
  return (
    <View style={{ width: 56, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: focused ? p.tint : "transparent" }}>
      <Icon name={name} color={color} size={24} />
    </View>
  );
}

function Tabs() {
  const { t, lang } = useI18n();
  const p = usePalette();
  const icon = (name: IconName) => ({ color, focused }: { color: string; focused: boolean }) => <TabBarIcon name={name} color={color} focused={focused} />;
  // Labels wrap to two lines instead of truncating; they scale with the system font up to 1.4x (the bar itself grows with them).
  const label = (text: string) => ({ color, focused }: { color: string; focused: boolean }) => (
    <AppText maxFontSizeMultiplier={1.4} style={{ fontSize: 13, fontWeight: focused ? "600" : "400", color, textAlign: "center" }}>{text}</AppText>
  );
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: p.card, borderTopColor: p.border, paddingTop: space.xs },
        tabBarItemStyle: { minHeight: 56 },
        tabBarActiveTintColor: p.accent,
        tabBarInactiveTintColor: p.muted,
        tabBarLabelStyle: { fontFamily: familyFor({ weight: "600", arabic: lang === "ar" }) },
      }}
    >
      <Tab.Screen name="Today" component={TodayScreen} options={{ title: t("today.title"), tabBarLabel: label(t("tab.today")), tabBarAccessibilityLabel: t("tab.today"), tabBarIcon: icon("today") }} />
      <Tab.Screen name="Programme" component={ProgrammeScreen} options={{ title: t("prog.title"), tabBarLabel: label(t("tab.programme")), tabBarAccessibilityLabel: t("tab.programme"), tabBarIcon: icon("plan") }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ title: t("history.title"), tabBarLabel: label(t("tab.history")), tabBarAccessibilityLabel: t("tab.history"), tabBarIcon: icon("progress") }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: t("settings.title"), tabBarLabel: label(t("tab.settings")), tabBarAccessibilityLabel: t("tab.settings"), tabBarIcon: icon("settings") }} />
    </Tab.Navigator>
  );
}

function SetupRoute() {
  const nav = useNavigation<{ goBack: () => void }>();
  return <OnboardingScreen rerun onDone={() => nav.goBack()} />;
}

function Shell(props: { needsOnboarding: boolean; onOnboarded: () => void }) {
  // "Import my workout history" on the first screen opens Import straight after setup is skipped.
  const [openImport, setOpenImport] = useState(false);
  const { t, direction, lang } = useI18n();
  const isDark = useIsDark();
  const palette = usePalette();
  // One primary accent for the tab bar, headers and the logger (the colours come from the same palette).
  const navTheme = useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return { ...base, colors: { ...base.colors, ...navColors(palette) } };
  }, [isDark, palette]);
  if (props.needsOnboarding) {
    return (
      <View style={{ flex: 1, direction }}>
        <OnboardingScreen
          onDone={(imp) => {
            setOpenImport(imp === true);
            props.onOnboarded();
          }}
        />
        <StatusBar style={isDark ? "light" : "dark"} />
      </View>
    );
  }
  return (
    // `direction` on the root flips every flex row and the navigation chrome at once, without restarting the app.
    <View style={{ flex: 1, direction }}>
      <NavigationContainer theme={navTheme} direction={direction} initialState={openImport ? { routes: [{ name: "Tabs" }, { name: "Import" }] } : undefined}>
        <Stack.Navigator
          screenOptions={{
            headerTitleStyle: { fontSize: 20, fontFamily: familyFor({ weight: "600", arabic: lang === "ar" }), color: palette.text },
            headerStyle: { backgroundColor: palette.bg },
            headerTintColor: palette.text,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: palette.bg },
            navigationBarColor: palette.bg,
          }}
        >
          <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
          <Stack.Screen name="Workout" component={WorkoutScreen} options={{ title: t("workout.title"), headerShown: false }} />
          <Stack.Screen name="Finish" component={FinishScreen} options={{ title: t("finish.title"), headerBackVisible: false }} />
          <Stack.Screen name="ProgrammeEdit" component={ProgrammeEditScreen} options={{ title: t("prog.edit.title") }} />
          <Stack.Screen name="ProgrammeExposure" component={ProgrammeExposureScreen} options={{ title: t("prog.exposure.title") }} />
          <Stack.Screen name="ProgrammeVersions" component={ProgrammeVersionsScreen} options={{ title: t("prog.versions") }} />
          <Stack.Screen name="ProgrammeSwitch" component={ProgrammeSwitchScreen} options={{ title: t("prog.switch.title") }} />
          <Stack.Screen name="Setup" component={SetupRoute} options={{ title: t("ob.welcome") }} />
          <Stack.Screen name="Import" component={ImportScreen} options={{ title: t("import.title") }} />
          <Stack.Screen name="Goals" component={GoalsScreen} options={{ title: t("goals.title") }} />
          <Stack.Screen name="Data" component={DataScreen} options={{ title: t("data.title") }} />
          <Stack.Screen name="Sync" component={SyncScreen} options={{ title: t("sync.title") }} />
          <Stack.Screen name="Privacy" component={PrivacyScreen} options={{ title: t("privacy.title") }} />
          <Stack.Screen name="Diagnostics" component={DiagnosticsScreen} options={{ title: t("diag.title") }} />
          <Stack.Screen name="DecisionLog" component={DecisionLogScreen} options={{ title: t("dec.title") }} />
          <Stack.Screen name="SessionDetail" component={SessionDetailScreen} options={{ title: t("history.session.title") }} />
          <Stack.Screen name="SaveWorkoutDay" component={SaveWorkoutDayScreen} options={{ title: t("history.saveAsDay.title") }} />
          <Stack.Screen name="LiftTrend" component={LiftTrendScreen} options={{ title: t("trend.title") }} />
          <Stack.Screen name="ExerciseLoads" component={ExerciseLoadsScreen} options={{ title: t("loads.title") }} />
          <Stack.Screen name="StoppedSuggestions" component={StoppedSuggestionsScreen} options={{ title: t("stop.title") }} />
          <Stack.Screen name="ShortWeek" component={ShortWeekScreen} options={{ title: t("short.title") }} />
          <Stack.Screen name="Why" component={WhyScreen} options={{ title: t("why.title") }} />
        </Stack.Navigator>
      </NavigationContainer>
      <StatusBar style={isDark ? "light" : "dark"} />
    </View>
  );
}

/** A screen that throws while drawing no longer blanks the app: it is logged locally and the lifter gets a way back. */
function Guarded({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const p = usePalette();
  return (
    <ErrorBoundary
      onError={(e) => diagnostics.record("crash", "render", e)}
      fallback={(reset) => (
        <View style={{ flex: 1, padding: space.xl, justifyContent: "center", gap: space.md, backgroundColor: p.bg }}>
          <AppText accessibilityRole="header" style={{ fontSize: 28, fontWeight: "600" }}>{t("diag.crashed.title")}</AppText>
          <AppText>{t("diag.crashed.body")}</AppText>
          <BigButton label={t("diag.crashed.retry")} onPress={reset} />
        </View>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}

export default function App() {
  const fontsReady = useBrandFonts();
  const [boot, setBoot] = useState<{ services: AppServices; lang: Lang; override: RtlOverride; unit: Unit; showSecond: boolean; needsOnboarding: boolean } | "error" | "migration_blocked" | null>(null);

  const [epoch, setEpoch] = useState(0);
  const dbRef = useRef<Db | null>(null);
  const maintRef = useRef<Db | null>(null);
  const skipBackupRef = useRef(false);
  const restart = useCallback(() => {
    setBoot(null);
    setEpoch((e) => e + 1);
  }, []);

  useEffect(() => {
    (async () => {
      const db = dbRef.current ?? (dbRef.current = await openExpoDb());
      const deps = { newId: () => Crypto.randomUUID(), now: () => Date.now() };
      // Before an update changes the database layout, keep a full private copy of the data (Step 15 safety rule).
      const safety = await backupBeforeMigrate(
        db,
        deps,
        (name, text) => {
          const f = new File(Paths.document, name);
          if (!f.exists) f.create({ overwrite: true });
          f.write(text);
        },
        (name) => new File(Paths.document, name).textSync(),
      );
      if (safety.error) diagnostics.record("warn", "pre-migration backup", safety.error);
      // No verified copy of the lifter's data: do NOT change the database layout. Stop here with a way out (try again, or knowingly go on).
      if (safety.blocked && !skipBackupRef.current) {
        setBoot("migration_blocked");
        return;
      }
      await migrate(db);
      const repos = createRepos(db, deps);
      await repos.seedIfNeeded();
      await repos.topUpLibrary();
      const workout = createWorkoutRepo(db, deps);
      const finish = createFinishRepo(db, deps, repos, workout);
      const gyms = createGymRepo(db, deps, repos, finish);
      const programmes = createProgrammeRepo(db, deps, repos, finish);
      const onboarding = createOnboardingRepo(db, deps, repos, gyms, programmes);
      const imports = createImportRepo(db, deps, repos, workout, programmes, finish);
      const goals = createGoalRepo(db, deps, repos);
      const weekly = createWeeklyRepo(db, deps, repos, goals);
      const shortWeek = createShortWeekRepo(db, deps, repos, programmes, goals);
      await onboarding.markExistingInstall();
      setAppearance(parseAppearance(await repos.getSetting("appearance")));
      const rejections = createRejectionRepo(db, deps);
      const history = createHistoryRepo(db, deps, repos, finish);
      const decisions = createDecisionRepo(db);
      const maint = maintRef.current ?? (maintRef.current = await openExpoMaintenanceDb());
      const data = createDataRepo(db, deps, maint);
      const sync = createSyncEngine(maint, deps, createFetchTransport(), createSecureStoreSecrets());
      const auto = createAutoSync(sync);
      const autoSync = (force?: boolean) => void auto.run(force);
      const reminders = createReminders();
      // Put the scheduled reminders back in step with the settings (and the language). Does nothing when they are off.
      void (async () => {
        const rs = await loadReminderSettings(repos);
        if (rs.on) await syncReminders(reminders, rs, reminderText(await repos.getLanguage()));
      })().catch(() => undefined);
      autoSync(true); // does one local read and nothing else unless the lifter turned Back up and sync on
      setBoot({ services: { db, repos, workout, finish, gyms, programmes, onboarding, imports, goals, weekly, shortWeek, rejections, history, decisions, data, restAlerts: createRestAlerts(), reminders, sync, coachLinks: createCoachLinks(sync), autoSync, restart }, lang: await repos.getLanguage(), override: await repos.getRtlOverride(), unit: await repos.getUnits(), showSecond: (await repos.getSetting("second_name")) === "1", needsOnboarding: (await onboarding.getState()) === null });
    })().catch((e) => {
      diagnostics.record("error", "boot", e);
      setBoot("error");
    });
  }, [epoch]);

  // Back on screen after being away: sync quietly if (and only if) Back up and sync is on. Throttled to once per 5 minutes.
  useEffect(() => {
    if (!boot || boot === "error" || boot === "migration_blocked") return;
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") boot.services.autoSync();
    });
    return () => sub.remove();
  }, [boot]);

  const onChange = useMemo(
    () => (key: "language" | "rtl_override" | "units" | "second_name", value: string) => {
      if (boot && boot !== "error" && boot !== "migration_blocked") void boot.services.repos.setSetting(key, value);
    },
    [boot],
  );

  if (boot === null || !fontsReady) return <BootLoading />;
  if (boot === "migration_blocked") {
    return (
      <MigrationBlocked
        onRetry={restart}
        onSkip={() => {
          skipBackupRef.current = true;
          restart();
        }}
      />
    );
  }
  if (boot === "error") return <BootError onRetry={restart} />;

  return (
    <SafeAreaProvider>
      <ServicesProvider value={boot.services}>
        <I18nProvider initialLang={boot.lang} initialOverride={boot.override} initialUnit={boot.unit} initialShowSecond={boot.showSecond} onChange={onChange}>
          <Guarded>
            <Shell needsOnboarding={boot.needsOnboarding} onOnboarded={() => setBoot((b) => (b && b !== "error" && b !== "migration_blocked" ? { ...b, needsOnboarding: false } : b))} />
          </Guarded>
          <NumberPadDone />
        </I18nProvider>
      </ServicesProvider>
    </SafeAreaProvider>
  );
}
