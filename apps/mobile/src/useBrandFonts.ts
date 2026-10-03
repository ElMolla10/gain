import { useFonts } from "expo-font";

/** Registers the bundled TTFs (offline, from the app bundle). Returns true when they are ready; an error also returns true so the app opens with the system font rather than blocking. */
export function useBrandFonts(): boolean {
  const [loaded, error] = useFonts({
    IBMPlexSans_400Regular: require("../assets/fonts/IBMPlexSans_400Regular.ttf"),
    IBMPlexSans_600SemiBold: require("../assets/fonts/IBMPlexSans_600SemiBold.ttf"),
    IBMPlexSans_700Bold: require("../assets/fonts/IBMPlexSans_700Bold.ttf"),
    IBMPlexSansArabic_400Regular: require("../assets/fonts/IBMPlexSansArabic_400Regular.ttf"),
    IBMPlexSansArabic_600SemiBold: require("../assets/fonts/IBMPlexSansArabic_600SemiBold.ttf"),
    IBMPlexSansArabic_700Bold: require("../assets/fonts/IBMPlexSansArabic_700Bold.ttf"),
  });
  return loaded || !!error;
}
