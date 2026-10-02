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
import { createRepos } from "./src/db/repos";
import { I18nProvider, useI18n } from "./src/i18n";
import type { Lang, RtlOverride } from "./src/i18n/format";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { TodayScreen } from "./src/screens/TodayScreen";

const Tab = createBottomTabNavigator();

function Shell() {
  const { t, direction } = useI18n();
  const scheme = useColorScheme();
  return (
    // `direction` on the root flips every flex row and the navigation chrome at once, without restarting the app.
    <View style={{ flex: 1, direction }}>
      <NavigationContainer theme={scheme === "dark" ? DarkTheme : DefaultTheme} direction={direction}>
        <Tab.Navigator screenOptions={{ tabBarLabelStyle: { fontSize: 14 }, tabBarStyle: { minHeight: 64 } }}>
          <Tab.Screen name="Today" component={TodayScreen} options={{ title: t("today.title"), tabBarLabel: t("tab.today") }} />
          <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: t("settings.title"), tabBarLabel: t("tab.settings") }} />
        </Tab.Navigator>
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
      const repos = createRepos(db, { newId: () => Crypto.randomUUID(), now: () => Date.now() });
      await repos.seedIfNeeded();
      setBoot({ services: { db, repos }, lang: await repos.getLanguage(), override: await repos.getRtlOverride() });
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
