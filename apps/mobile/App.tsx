import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import * as Crypto from "expo-crypto";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useState } from "react";
import { Text, useColorScheme, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ServicesProvider, type AppServices } from "./src/AppContext";
import { openExpoDb } from "./src/db/expoDriver";
import { migrate } from "./src/db/migrations";
import { createFinishRepo } from "./src/db/finishRepo";
import { createGymRepo } from "./src/db/gymRepo";
import { createProgrammeRepo } from "./src/db/programmeRepo";
import { createRepos } from "./src/db/repos";
import { createWorkoutRepo } from "./src/db/workoutRepo";
import { FinishScreen } from "./src/screens/FinishScreen";
import { WhyScreen } from "./src/screens/WhyScreen";
import { WorkoutScreen } from "./src/screens/WorkoutScreen";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { I18nProvider, useI18n } from "./src/i18n";
import type { Lang, RtlOverride } from "./src/i18n/format";
import { GymEditScreen } from "./src/screens/GymEditScreen";
import { GymScreen } from "./src/screens/GymScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { TodayScreen } from "./src/screens/TodayScreen";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function Tabs() {
  const { t } = useI18n();
  return (
    <Tab.Navigator screenOptions={{ tabBarLabelStyle: { fontSize: 14 }, tabBarStyle: { minHeight: 64 } }}>
      <Tab.Screen name="Today" component={TodayScreen} options={{ title: t("today.title"), tabBarLabel: t("tab.today") }} />
      <Tab.Screen name="Gym" component={GymScreen} options={{ title: t("gym.title"), tabBarLabel: t("tab.gym") }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: t("settings.title"), tabBarLabel: t("tab.settings") }} />
    </Tab.Navigator>
  );
}

function Shell() {
  const { t, direction } = useI18n();
  const scheme = useColorScheme();
  return (
    // `direction` on the root flips every flex row and the navigation chrome at once, without restarting the app.
    <View style={{ flex: 1, direction }}>
      <NavigationContainer theme={scheme === "dark" ? DarkTheme : DefaultTheme} direction={direction}>
        <Stack.Navigator>
          <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
          <Stack.Screen name="Workout" component={WorkoutScreen} options={{ title: t("workout.title") }} />
          <Stack.Screen name="Finish" component={FinishScreen} options={{ title: t("finish.title"), headerBackVisible: false }} />
          <Stack.Screen name="GymEdit" component={GymEditScreen} options={{ title: t("gym.edit.title") }} />
          <Stack.Screen name="Why" component={WhyScreen} options={{ title: t("why.title") }} />
        </Stack.Navigator>
      </NavigationContainer>
      <StatusBar style="auto" />
    </View>
  );
}

export default function App() {
  const [boot, setBoot] = useState<{ services: AppServices; lang: Lang; override: RtlOverride } | "error" | null>(null);

  useEffect(() => {
    (async () => {
      const db = await openExpoDb();
      await migrate(db);
      const deps = { newId: () => Crypto.randomUUID(), now: () => Date.now() };
      const repos = createRepos(db, deps);
      await repos.seedIfNeeded();
      const workout = createWorkoutRepo(db, deps);
      const finish = createFinishRepo(db, deps, repos, workout);
      setBoot({ services: { db, repos, workout, finish, gyms: createGymRepo(db, deps, repos, finish), programmes: createProgrammeRepo(db, deps, repos, finish) }, lang: await repos.getLanguage(), override: await repos.getRtlOverride() });
    })().catch(() => setBoot("error"));
  }, []);

  const onChange = useMemo(
    () => (key: "language" | "rtl_override", value: string) => {
      if (boot && boot !== "error") void boot.services.repos.setSetting(key, value);
    },
    [boot],
  );

  if (boot === null) return <View style={{ flex: 1, padding: 24, justifyContent: "center" }}><Text>Loading...</Text></View>;
  if (boot === "error") return <View style={{ flex: 1, padding: 24, justifyContent: "center" }}><Text>Something went wrong opening your data on this phone.</Text></View>;

  return (
    <SafeAreaProvider>
      <ServicesProvider value={boot.services}>
        <I18nProvider initialLang={boot.lang} initialOverride={boot.override} onChange={onChange}>
          <Shell />
        </I18nProvider>
      </ServicesProvider>
    </SafeAreaProvider>
  );
}
