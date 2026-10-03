import React from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { BrandLogo } from "../BrandLogo";
import { familyFor } from "../fonts";
import { darkPalette as p } from "../palettes";
import { PRIMARY_HEIGHT, radius, space } from "../theme";

/**
 * Screens shown before the app's services (language, settings) exist, so they cannot use AppText or the i18n context. Always dark (ink),
 * always bilingual where a message matters, with the same tokens as everything else. Primary action = lime fill with ink text.
 */
/** Fixed bilingual copy: these screens render before the language setting can be read. */
const BOOT = {
  brand: "GAIN",
  retry: "Try again · جرّب تاني",
  skip: "Update without a safety copy · حدّث من غير نسخة أمان",
  T0: 'Could not open your data',
  T1: 'Something went wrong opening your data on this phone. Nothing has been changed or deleted. Try again; if it keeps failing, restart the app.',
  T2: 'حصلت مشكلة وإحنا بنفتح بياناتك على الموبايل. ما اتغيرش ولا اتمسح حاجة. جرّب تاني، ولو لسه بتفشل اقفل التطبيق وافتحه.',
  T3: 'Update paused to protect your data',
  T4: "GAIN could not save a safety copy of your workouts before updating its storage (is the phone's storage full?). Nothing has been changed. Free some space and try again.",
  T5: "تم إيقاف التحديث لحماية بياناتك. التطبيق ماقدرش يحفظ نسخة أمان من تمارينك قبل ما يحدّث التخزين، ومفيش حاجة اتغيرت. فضّي مساحة وجرّب تاني.",
};
const latin = (w: string = "400") => familyFor({ weight: w, arabic: false });
const arabic = (w: string = "400") => familyFor({ weight: w, arabic: true });

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: space.xl, gap: space.lg, justifyContent: "center" }}>{children}</ScrollView>
    </View>
  );
}

function Btn({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ minHeight: PRIMARY_HEIGHT, borderRadius: radius.button, paddingHorizontal: space.lg, paddingVertical: space.sm, alignItems: "center", justifyContent: "center", backgroundColor: primary ? (pressed ? p.fillPressed : p.fill) : pressed ? p.tint : p.raised, borderWidth: primary ? 0 : 1.5, borderColor: p.edge })}
    >
      <Text style={{ color: primary ? p.onFill : p.text, fontFamily: latin("600"), fontSize: 16, lineHeight: 24, textAlign: "center" }}>{label}</Text>
    </Pressable>
  );
}

export function BootLoading() {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={BOOT.brand} style={{ flex: 1, backgroundColor: p.bg, alignItems: "center", justifyContent: "center", gap: space.lg }}>
      <BrandLogo size={72} />
      <ActivityIndicator color={p.accent} />
    </View>
  );
}

export function BootError({ onRetry }: { onRetry: () => void }) {
  return (
    <Shell>
      <BrandLogo size={48} />
      <Text accessibilityRole="header" style={{ color: p.text, fontFamily: latin("600"), fontSize: 28, lineHeight: 34 }}>{BOOT.T0}</Text>
      <Text style={{ color: p.text, fontFamily: latin(), fontSize: 16, lineHeight: 24 }}>{BOOT.T1}</Text>
      <Text style={{ color: p.text, fontFamily: arabic(), fontSize: 17, lineHeight: 27, writingDirection: "rtl" }}>{BOOT.T2}</Text>
      <Btn primary label={BOOT.retry} onPress={onRetry} />
    </Shell>
  );
}

export function MigrationBlocked({ onRetry, onSkip }: { onRetry: () => void; onSkip: () => void }) {
  return (
    <Shell>
      <BrandLogo size={48} />
      <Text accessibilityRole="header" style={{ color: p.text, fontFamily: latin("600"), fontSize: 28, lineHeight: 34 }}>{BOOT.T3}</Text>
      <Text style={{ color: p.text, fontFamily: latin(), fontSize: 16, lineHeight: 24 }}>{BOOT.T4}</Text>
      <Text style={{ color: p.text, fontFamily: arabic(), fontSize: 17, lineHeight: 27, writingDirection: "rtl" }}>{BOOT.T5}</Text>
      <Btn primary label={BOOT.retry} onPress={onRetry} />
      <Btn label={BOOT.skip} onPress={onSkip} />
    </Shell>
  );
}
