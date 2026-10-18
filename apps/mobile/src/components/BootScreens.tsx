import React from "react";
import { ActivityIndicator, Pressable, ScrollView, Share, Text, View } from "react-native";
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
  N0: "This data was saved by a newer GAIN",
  N1: "Your workouts are safe on this phone, but they were saved by a newer version of GAIN than this one. Install the latest GAIN to open them. Nothing has been changed or deleted.",
  N2: "بياناتك محفوظة على الموبايل، بس اتحفظت بنسخة أحدث من GAIN. نزّل آخر نسخة من GAIN عشان تفتحها. ما اتغيرش ولا اتمسح حاجة.",
  details: "Details · التفاصيل",
  copy: "Copy details · انسخ التفاصيل",
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

/** Copyable error text: selectable (long-press to copy) and a button that opens the share sheet (Copy is in it). No new native library. */
function Details({ text }: { text: string }) {
  return (
    <View style={{ gap: space.sm }}>
      <Text style={{ color: p.muted, fontFamily: latin("600"), fontSize: 13, lineHeight: 18 }}>{BOOT.details}</Text>
      <View style={{ borderRadius: radius.button, borderWidth: 1.5, borderColor: p.edge, backgroundColor: p.raised, padding: space.md }}>
        <Text selectable testID="boot-error-details" style={{ color: p.text, fontFamily: latin(), fontSize: 13, lineHeight: 18, writingDirection: "ltr" }}>
          {text}
        </Text>
      </View>
      <Btn label={BOOT.copy} onPress={() => void Share.share({ message: text }).catch(() => undefined)} />
    </View>
  );
}

export function BootError({ onRetry, newer, details }: { onRetry: () => void; newer?: boolean; details?: string }) {
  return (
    <Shell>
      <BrandLogo size={48} />
      <Text accessibilityRole="header" style={{ color: p.text, fontFamily: latin("600"), fontSize: 28, lineHeight: 34 }}>{newer ? BOOT.N0 : BOOT.T0}</Text>
      <Text style={{ color: p.text, fontFamily: latin(), fontSize: 16, lineHeight: 24 }}>{newer ? BOOT.N1 : BOOT.T1}</Text>
      <Text style={{ color: p.text, fontFamily: arabic(), fontSize: 17, lineHeight: 27, writingDirection: "rtl" }}>{newer ? BOOT.N2 : BOOT.T2}</Text>
      <Btn primary label={BOOT.retry} onPress={onRetry} />
      {details ? <Details text={details} /> : null}
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
