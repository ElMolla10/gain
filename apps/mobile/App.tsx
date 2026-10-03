import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { DarkTheme, DefaultTheme, NavigationContainer, useNavigation } from "@react-navigation/native";
import * as Crypto from "expo-crypto";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Pressable, Text, useColorScheme, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ServicesProvider, type AppServices } from "./src/AppContext";
import { openExpoDb } from "./src/db/expoDriver";
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
import { createRestAlerts } from "./src/notifications/restAlerts";
import { createDataRepo } from "./src/db/dataRepo";
import { ErrorBoundary } from "./src/components/ErrorBoundary";
import { diagnostics } from "./src/diagnostics";
import { installCrashHandler } from "./src/logic/diagnostics";
import { PlansScreen } from "./src/screens/PlansScreen";
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
import { SessionDetailScreen } from "./src/screens/SessionDetailScreen";
import { ProgrammeEditScreen } from "./src/screens/ProgrammeEditScreen";
import { ProgrammeSwitchScreen } from "./src/screens/ProgrammeSwitchScreen";
import { ProgrammeScreen } from "./src/screens/ProgrammeScreen";
import { StoppedSuggestionsScreen } from "./src/screens/StoppedSuggestionsScreen";
import { ShortWeekScreen } from "./src/screens/ShortWeekScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { TodayScreen } from "./src/screens/TodayScreen";
import { SyncScreen } from "./src/screens/SyncScreen";
import { createAutoSync } from "./src/sync/auto";
import { createCoachLinks } from "./src/sync/coachLinks";
import { createSyncEngine } from "./src/sync/engine";
import { createFetchTransport } from "./src/sync/transport";

// Uncaught JavaScript errors go to the crash log on this phone (never uploaded), then on to the normal handler.
installCrashHandler(diagnostics, (globalThis as { ErrorUtils?: Parameters<typeof installCrashHandler>[1] }).ErrorUtils);

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function Tabs() {
  const { t } = useI18n();
  return (
    <Tab.Navigator screenOptions={{ tabBarLabelStyle: { fontSize: 14 }, tabBarStyle: { minHeight: 64 } }}>
      <Tab.Screen name="Today" component={TodayScreen} options={{ title: t("today.title"), tabBarLabel: t("tab.today") }} />
      <Tab.Screen name="Programme" component={ProgrammeScreen} options={{ title: t("prog.title"), tabBarLabel: t("tab.programme") }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ title: t("history.title"), tabBarLabel: t("tab.history") }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: t("settings.title"), tabBarLabel: t("tab.settings") }} />
    </Tab.Navigator>
  );
}

function SetupRoute() {
  const nav = useNavigation<{ goBack: () => void }>();
  return <OnboardingScreen rerun onDone={() => nav.goBack()} />;
}

function Shell(props: { needsOnboarding: boolean; onOnboarded: () => void }) {
  const { t, direction } = useI18n();
  const scheme = useColorScheme();
  if (props.needsOnboarding) {
    return (
      <View style={{ flex: 1, direction }}>
        <OnboardingScreen onDone={props.onOnboarded} />
        <StatusBar style="auto" />
      </View>
    );
  }
  return (
    // `direction` on the root flips every flex row and the navigation chrome at once, without restarting the app.
    <View style={{ flex: 1, direction }}>
      <NavigationContainer theme={scheme === "dark" ? DarkTheme : DefaultTheme} direction={direction}>
        <Stack.Navigator>
          <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
          <Stack.Screen name="Workout" component={WorkoutScreen} options={{ title: t("workout.title"), headerShown: false }} />
          <Stack.Screen name="Finish" component={FinishScreen} options={{ title: t("finish.title"), headerBackVisible: false }} />
          <Stack.Screen name="ProgrammeEdit" component={ProgrammeEditScreen} options={{ title: t("prog.edit.title") }} />
          <Stack.Screen name="ProgrammeSwitch" component={ProgrammeSwitchScreen} options={{ title: t("prog.switch.title") }} />
          <Stack.Screen name="Setup" component={SetupRoute} options={{ title: t("ob.welcome") }} />
          <Stack.Screen name="Import" component={ImportScreen} options={{ title: t("import.title") }} />
          <Stack.Screen name="Goals" component={GoalsScreen} options={{ title: t("goals.title") }} />
          <Stack.Screen name="Data" component={DataScreen} options={{ title: t("data.title") }} />
          <Stack.Screen name="Sync" component={SyncScreen} options={{ title: t("sync.title") }} />
          <Stack.Screen name="Plans" component={PlansScreen} options={{ title: t("plans.title") }} />
          <Stack.Screen name="Privacy" component={PrivacyScreen} options={{ title: t("privacy.title") }} />
          <Stack.Screen name="Diagnostics" component={DiagnosticsScreen} options={{ title: t("diag.title") }} />
          <Stack.Screen name="DecisionLog" component={DecisionLogScreen} options={{ title: t("dec.title") }} />
          <Stack.Screen name="SessionDetail" component={SessionDetailScreen} options={{ title: t("history.session.title") }} />
          <Stack.Screen name="LiftTrend" component={LiftTrendScreen} options={{ title: t("trend.title") }} />
          <Stack.Screen name="StoppedSuggestions" component={StoppedSuggestionsScreen} options={{ title: t("stop.title") }} />
          <Stack.Screen name="ShortWeek" component={ShortWeekScreen} options={{ title: t("short.title") }} />
          <Stack.Screen name="Why" component={WhyScreen} options={{ title: t("why.title") }} />
        </Stack.Navigator>
      </NavigationContainer>
      <StatusBar style="auto" />
    </View>
  );
}

/** A screen that throws while drawing no longer blanks the app: it is logged locally and the lifter gets a way back. */
function Guarded({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <ErrorBoundary
      onError={(e) => diagnostics.record("crash", "render", e)}
      fallback={(reset) => (
        <View style={{ flex: 1, padding: 24, justifyContent: "center", gap: 12 }}>
          <Text style={{ fontSize: 20, fontWeight: "700" }}>{t("diag.crashed.title")}</Text>
          <Text style={{ fontSize: 16 }}>{t("diag.crashed.body")}</Text>
          <Pressable accessibilityRole="button" onPress={reset} style={{ minHeight: 52, borderRadius: 12, backgroundColor: "#1f6feb", alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "#ffffff", fontWeight: "700", fontSize: 17 }}>{t("diag.crashed.retry")}</Text>
          </Pressable>
        </View>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}

export default function App() {
  const [boot, setBoot] = useState<{ services: AppServices; lang: Lang; override: RtlOverride; unit: Unit; needsOnboarding: boolean } | "error" | null>(null);

  const [epoch, setEpoch] = useState(0);
  const dbRef = useRef<Db | null>(null);
  const restart = useCallback(() => {
    setBoot(null);
    setEpoch((e) => e + 1);
  }, []);

  useEffect(() => {
    (async () => {
      const db = dbRef.current ?? (dbRef.current = await openExpoDb());
      const deps = { newId: () => Crypto.randomUUID(), now: () => Date.now() };
      // Before an update changes the database layout, keep a full private copy of the data (Step 15 safety rule).
      const safety = await backupBeforeMigrate(db, deps, (name, text) => {
        const f = new File(Paths.document, name);
        if (!f.exists) f.create({ overwrite: true });
        f.write(text);
      });
      if (safety.error) diagnostics.record("warn", "pre-migration backup", safety.error);
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
      const rejections = createRejectionRepo(db, deps);
      const history = createHistoryRepo(db, deps, repos, finish);
      const decisions = createDecisionRepo(db);
      const data = createDataRepo(db, deps);
      const sync = createSyncEngine(db, deps, createFetchTransport());
      const auto = createAutoSync(sync);
      const autoSync = (force?: boolean) => void auto.run(force);
      autoSync(true); // does one local read and nothing else unless the lifter turned Back up and sync on
      setBoot({ services: { db, repos, workout, finish, gyms, programmes, onboarding, imports, goals, weekly, shortWeek, rejections, history, decisions, data, restAlerts: createRestAlerts(), sync, coachLinks: createCoachLinks(sync), autoSync, restart }, lang: await repos.getLanguage(), override: await repos.getRtlOverride(), unit: await repos.getUnits(), needsOnboarding: (await onboarding.getState()) === null });
    })().catch((e) => {
      diagnostics.record("error", "boot", e);
      setBoot("error");
    });
  }, [epoch]);

  // Back on screen after being away: sync quietly if (and only if) Back up and sync is on. Throttled to once per 5 minutes.
  useEffect(() => {
    if (!boot || boot === "error") return;
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") boot.services.autoSync();
    });
    return () => sub.remove();
  }, [boot]);

  const onChange = useMemo(
    () => (key: "language" | "rtl_override" | "units", value: string) => {
      if (boot && boot !== "error") void boot.services.repos.setSetting(key, value);
    },
    [boot],
  );

  if (boot === null) return <View style={{ flex: 1, padding: 24, justifyContent: "center" }}><Text>Loading...</Text></View>;
  if (boot === "error") return <View style={{ flex: 1, padding: 24, justifyContent: "center" }}><Text>Something went wrong opening your data on this phone.</Text></View>;

  return (
    <SafeAreaProvider>
      <ServicesProvider value={boot.services}>
        <I18nProvider initialLang={boot.lang} initialOverride={boot.override} initialUnit={boot.unit} onChange={onChange}>
          <Guarded>
            <Shell needsOnboarding={boot.needsOnboarding} onOnboarded={() => setBoot((b) => (b && b !== "error" ? { ...b, needsOnboarding: false } : b))} />
          </Guarded>
        </I18nProvider>
      </ServicesProvider>
    </SafeAreaProvider>
  );
}
