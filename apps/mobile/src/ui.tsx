import React, { useEffect, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View, type KeyboardTypeOptions, type StyleProp, type TextProps, type TextStyle, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "./components/Icon";
import { familyFor, hasArabic, scaleFor, textOf } from "./fonts";
import { useI18n } from "./i18n";
import { INPUT_HEIGHT, MIN_TOUCH, PRIMARY_HEIGHT, radius, space, type as ty, usePalette } from "./theme";

/**
 * The shared GAIN components. Every screen is built from these and from theme.ts tokens; screens do not carry their own colours,
 * fonts or control styles. Sizes follow the kit: inputs 8, actions 12, cards 16, sheets 24; touch targets 48+, primary action 52+.
 */

/**
 * Text that follows the active writing direction and the bundled typefaces: IBM Plex Sans for Latin and numerals, IBM Plex Sans Arabic
 * for Arabic (chosen by the app language, or by the characters in the text for an Arabic name inside English). Pass `ltr` for numbers /
 * Latin names that must keep their order. Numbers use tabular figures. Font scaling is never disabled; long text wraps.
 */
export function AppText({ ltr, style, children, ...rest }: TextProps & { ltr?: boolean }) {
  const { direction, lang } = useI18n();
  const p = usePalette();
  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  const arabic = hasArabic(textOf(children)) || (lang === "ar" && !ltr);
  const { fontWeight, fontSize, lineHeight, ...others } = flat;
  const scaled = scaleFor(typeof fontSize === "number" ? fontSize : ty.body, arabic);
  return (
    <Text
      {...rest}
      style={[
        { color: p.text, writingDirection: ltr ? "ltr" : direction, fontFamily: familyFor({ weight: fontWeight, arabic }), fontSize: scaled.fontSize, lineHeight: typeof lineHeight === "number" ? lineHeight : scaled.lineHeight },
        ltr ? { fontVariant: ["tabular-nums"] } : null,
        others,
      ]}
    >
      {children}
    </Text>
  );
}

/** Font family for a TextInput (inputs are not AppText). */
export function useInputFont(weight: "400" | "600" = "400"): { fontFamily: string } {
  const { lang } = useI18n();
  return { fontFamily: familyFor({ weight, arabic: lang === "ar" }) };
}

/** True when the system asks for less motion; animations then switch off. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setReduced(v)).catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

/**
 * The page: a scrolling column with 16 px gutters, 24 px between sections, the bottom safe area, and taps that keep working while the
 * keyboard is open. `footer` is pinned above the safe area (a sticky primary action) and never covers the content.
 */
export function Screen({ children, footer, scroll = true, contentStyle }: { children: React.ReactNode; footer?: React.ReactNode; scroll?: boolean; contentStyle?: StyleProp<ViewStyle> }) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const body = [{ padding: space.lg, gap: space.xl, paddingBottom: space.xl + (footer ? 0 : insets.bottom) }, contentStyle];
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      {scroll ? (
        <ScrollView contentContainerStyle={body} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets>
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, ...body]}>{children}</View>
      )}
      {footer ? (
        <View style={{ paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.md + insets.bottom, gap: space.sm, backgroundColor: p.bg, borderTopWidth: 1, borderColor: p.border }}>{footer}</View>
      ) : null}
    </View>
  );
}

type Tone = "default" | "raised" | "tint" | "success" | "warn" | "danger";
export function Card({ children, style, tone = "default" }: { children: React.ReactNode; style?: ViewStyle; tone?: Tone }) {
  const p = usePalette();
  const bg = tone === "raised" ? p.raised : tone === "tint" ? p.tint : tone === "success" ? p.successBg : tone === "warn" ? p.warnBg : tone === "danger" ? p.dangerBg : p.card;
  const border = tone === "tint" ? p.tint : tone === "success" ? p.success : tone === "warn" ? p.warn : tone === "danger" ? p.danger : p.border;
  return <View style={[{ backgroundColor: bg, borderColor: border, borderWidth: 1, borderRadius: radius.card, padding: space.lg, gap: space.sm }, style]}>{children}</View>;
}

/** A section heading. `action` (a small link-style control) sits at the end of the row. */
export function SectionTitle({ children, action }: { children: string; action?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md }}>
      <AppText accessibilityRole="header" style={{ fontSize: ty.section, fontWeight: "600", flexShrink: 1 }}>{children}</AppText>
      {action}
    </View>
  );
}

export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";
/**
 * Buttons. `primary` = lime fill, ink label (one per screen). `secondary` = neutral surface with an edge. `quiet` = text (+ icon) only.
 * `danger` = destructive, separated and outlined in the danger colour. `selected={false}` is the older spelling of `secondary`.
 * While `loading` the label is replaced by a labelled spinner and presses are ignored (no duplicates). Labels wrap; they never truncate.
 */
export function BigButton(props: { label: string; onPress?: () => void; disabled?: boolean; selected?: boolean; variant?: ButtonVariant; loading?: boolean; icon?: IconName; accessibilityHint?: string; /** The one primary action on a screen: taller, larger label. */ hero?: boolean }) {
  const p = usePalette();
  const { t } = useI18n();
  const variant: ButtonVariant = props.variant ?? (props.selected === false ? "secondary" : "primary");
  const disabled = !!props.disabled || !!props.loading;
  const fg = disabled && !props.loading ? p.onDisabled : variant === "primary" ? p.onFill : variant === "danger" ? p.danger : variant === "quiet" ? p.accent : p.text;
  const height = props.hero ? 60 : variant === "primary" ? PRIMARY_HEIGHT : MIN_TOUCH;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.loading ? `${props.label}, ${t("common.loading")}` : props.label}
      accessibilityState={{ disabled, busy: !!props.loading }}
      accessibilityHint={props.accessibilityHint}
      disabled={disabled}
      onPress={props.onPress}
      style={({ pressed }) => ({
        minHeight: height,
        borderRadius: radius.button,
        paddingHorizontal: space.lg,
        paddingVertical: space.sm,
        flexDirection: "row",
        gap: space.sm,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: variant === "primary" ? (props.disabled && !props.loading ? p.disabled : pressed ? p.fillPressed : p.fill) : variant === "secondary" ? (pressed ? p.tint : p.raised) : pressed ? p.raised : "transparent",
        borderWidth: variant === "secondary" || variant === "danger" ? 1.5 : 0,
        borderColor: variant === "danger" ? p.danger : p.edge,
      })}
    >
      {props.loading ? <ActivityIndicator color={fg} /> : props.icon ? <Icon name={props.icon} color={fg} size={20} mirror={props.icon === "chevron"} /> : null}
      <AppText style={{ fontSize: props.hero ? ty.section : ty.body, fontWeight: "600", color: fg, textAlign: "center", flexShrink: 1 }}>{props.loading ? t("common.loading") : props.label}</AppText>
    </Pressable>
  );
}

/** A 48 x 48 icon-only control. The label is spoken by TalkBack. */
export function IconButton(props: { icon: IconName; label: string; onPress: () => void; disabled?: boolean; color?: string; mirror?: boolean }) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => ({ width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: radius.button, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? p.raised : "transparent", opacity: props.disabled ? 0.4 : 1 })}
    >
      <Icon name={props.icon} color={props.color ?? p.text} size={24} mirror={props.mirror} />
    </Pressable>
  );
}

/** Labelled text field. Numbers stay left-to-right inside right-to-left layouts; the text itself follows the language. */
export function Field(props: {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  numeric?: boolean;
  multiline?: boolean;
  hint?: string;
  /** A concrete problem with the value; shown under the field in the danger colour with an icon. */
  error?: string;
}) {
  const p = usePalette();
  const { direction } = useI18n();
  const font = useInputFont();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: space.xs }}>
      <AppText style={{ fontWeight: "600", fontSize: ty.label }}>{props.label}</AppText>
      {props.hint ? <AppText style={{ color: p.muted, fontSize: ty.caption }}>{props.hint}</AppText> : null}
      <TextInput
        accessibilityLabel={props.label}
        value={props.value}
        onChangeText={props.onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={props.placeholder}
        placeholderTextColor={p.muted}
        keyboardType={props.keyboardType ?? (props.numeric ? "decimal-pad" : "default")}
        multiline={props.multiline}
        style={{
          ...font,
          minHeight: INPUT_HEIGHT,
          borderWidth: focused ? 2 : 1.5,
          borderColor: props.error ? p.danger : focused ? p.accent : p.edge,
          borderRadius: radius.input,
          paddingHorizontal: space.md,
          fontSize: ty.body,
          color: p.text,
          backgroundColor: p.card,
          textAlign: props.numeric ? "left" : direction === "rtl" ? "right" : "left",
          writingDirection: props.numeric ? "ltr" : direction,
        }}
      />
      {props.error ? <InlineStatus kind="error" text={props.error} /> : null}
    </View>
  );
}

/** Compact neutral outline; lime fill only for the selected choice, and a check mark so selection is not colour alone. */
export function Chip(props: { label: string; selected?: boolean; disabled?: boolean; onPress?: () => void }) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!props.selected, disabled: !!props.disabled }}
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => ({
        opacity: props.disabled ? 0.45 : 1,
        minHeight: MIN_TOUCH,
        borderRadius: radius.pill,
        paddingHorizontal: space.lg,
        paddingVertical: space.sm,
        flexDirection: "row",
        alignItems: "center",
        gap: space.xs,
        borderWidth: props.selected ? 0 : 1.5,
        borderColor: p.edge,
        backgroundColor: props.selected ? p.fill : pressed ? p.raised : "transparent",
      })}
    >
      {props.selected ? <Icon name="check" color={p.onFill} size={18} /> : null}
      <AppText style={{ fontWeight: "600", fontSize: ty.label, color: props.selected ? p.onFill : p.text, flexShrink: 1 }}>{props.label}</AppText>
    </Pressable>
  );
}

/** Shown in Arabic only: the screen's Arabic text is a draft translation. */
export function ArDraftNote() {
  const { lang, t } = useI18n();
  const p = usePalette();
  if (lang !== "ar") return null;
  return <AppText style={{ color: p.muted, fontSize: ty.caption }}>{t("common.draftAr")}</AppText>;
}

/** Whole-number stepper with large − / + buttons. `value` stays readable left-to-right in RTL. */
export function Stepper(props: { label: string; value: number; onChange: (n: number) => void; min: number; max: number; /** Size of one tap (default 1). */ step?: number }) {
  const step = props.step ?? 1;
  const p = usePalette();
  const btn = (icon: "plus" | "minus", delta: number, disabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${props.label} ${icon === "plus" ? "+" : "−"}`}
      disabled={disabled}
      onPress={() => props.onChange(Math.min(props.max, Math.max(props.min, props.value + delta * step)))}
      style={({ pressed }) => ({ width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: radius.button, borderWidth: 1.5, borderColor: disabled ? p.border : p.edge, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? p.tint : p.raised })}
    >
      <Icon name={icon} color={disabled ? p.onDisabled : p.text} size={22} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm }}>
      <AppText style={{ fontWeight: "600", flexShrink: 1 }}>{props.label}</AppText>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        {btn("minus", -1, props.value <= props.min)}
        <AppText ltr style={{ minWidth: 40, textAlign: "center", fontSize: ty.section, fontWeight: "600" }}>{String(props.value)}</AppText>
        {btn("plus", 1, props.value >= props.max)}
      </View>
    </View>
  );
}

/** One line of status: icon + words, coloured by kind. Status is never colour alone. */
export function InlineStatus({ kind, text }: { kind: "info" | "success" | "warn" | "error"; text: string }) {
  const p = usePalette();
  const color = kind === "error" ? p.danger : kind === "warn" ? p.warn : kind === "success" ? p.success : p.muted;
  const icon: IconName = kind === "error" || kind === "warn" ? "alert" : kind === "success" ? "check" : "why";
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.xs }}>
      <View style={{ paddingTop: 2 }}><Icon name={icon} color={color} size={16} /></View>
      <AppText style={{ color, fontSize: ty.label, flexShrink: 1 }}>{text}</AppText>
    </View>
  );
}

/** A boxed message (error, warning, note) with optional action, e.g. Retry. Text is always ink-on-tint readable, with an icon and a heading. */
export function Notice({ kind, title, children, actionLabel, onAction }: { kind: "info" | "success" | "warn" | "error"; title?: string; children?: React.ReactNode; actionLabel?: string; onAction?: () => void }) {
  const p = usePalette();
  const tone: Tone = kind === "error" ? "danger" : kind === "warn" ? "warn" : kind === "success" ? "success" : "raised";
  const color = kind === "error" ? p.danger : kind === "warn" ? p.warn : kind === "success" ? p.success : p.accent;
  const icon: IconName = kind === "error" || kind === "warn" ? "alert" : kind === "success" ? "check" : "why";
  return (
    <Card tone={tone} style={{ gap: space.sm }}>
      <View accessibilityRole="alert" style={{ flexDirection: "row", gap: space.sm, alignItems: "flex-start" }}>
        <View style={{ paddingTop: 2 }}><Icon name={icon} color={color} size={20} /></View>
        <View style={{ flex: 1, gap: space.xs }}>
          {title ? <AppText style={{ fontWeight: "600", fontSize: ty.body }}>{title}</AppText> : null}
          {typeof children === "string" ? <AppText style={{ fontSize: ty.label }}>{children}</AppText> : children}
        </View>
      </View>
      {actionLabel && onAction ? <BigButton variant="secondary" label={actionLabel} onPress={onAction} /> : null}
    </Card>
  );
}

/** A meaningful empty state: what is missing and what to do about it (never a blank page). */
export function EmptyState({ icon, title, body, actionLabel, onAction }: { icon: IconName; title: string; body?: string; actionLabel?: string; onAction?: () => void }) {
  const p = usePalette();
  return (
    <View style={{ alignItems: "center", gap: space.md, paddingVertical: space.xxl, paddingHorizontal: space.lg }}>
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: p.raised, alignItems: "center", justifyContent: "center" }}>
        <Icon name={icon} color={p.accent} size={28} />
      </View>
      <AppText accessibilityRole="header" style={{ fontSize: ty.section, fontWeight: "600", textAlign: "center" }}>{title}</AppText>
      {body ? <AppText style={{ color: p.muted, textAlign: "center" }}>{body}</AppText> : null}
      {actionLabel && onAction ? <BigButton label={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

export function LoadingState({ label }: { label?: string }) {
  const p = usePalette();
  const { t } = useI18n();
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label ?? t("common.loading")} style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: space.md, padding: space.xl }}>
      <ActivityIndicator color={p.accent} size="large" />
      <AppText style={{ color: p.muted }}>{label ?? t("common.loading")}</AppText>
    </View>
  );
}

/** A concrete failure with a retry. */
export function ErrorState({ title, body, retryLabel, onRetry }: { title: string; body?: string; retryLabel: string; onRetry: () => void }) {
  return (
    <View style={{ padding: space.lg }}>
      <Notice kind="error" title={title} actionLabel={retryLabel} onAction={onRetry}>
        {body}
      </Notice>
    </View>
  );
}

/**
 * Bottom sheet: labelled heading, an explicit close button, Android back dismisses, content scrolls inside the safe area.
 * Destructive actions belong in `footer`, separated from the content, and are confirmed by the caller.
 */
export function Sheet({ visible, title, onClose, children, footer }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  const p = usePalette();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduced = useReducedMotion();
  return (
    <Modal visible={visible} transparent animationType={reduced ? "none" : "slide"} onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("common.close")} onPress={onClose} style={{ flex: 1 }} />
        <View accessibilityViewIsModal style={{ maxHeight: height * 0.9, backgroundColor: p.card, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, borderWidth: 1, borderBottomWidth: 0, borderColor: p.border, paddingBottom: insets.bottom + space.md }}>
          <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: p.edge, marginTop: space.sm }} />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingStart: space.lg, paddingEnd: space.xs, paddingVertical: space.xs, gap: space.sm }}>
            <AppText accessibilityRole="header" style={{ fontSize: ty.section, fontWeight: "600", flex: 1 }}>{title}</AppText>
            <IconButton icon="close" label={t("common.close")} onPress={onClose} />
          </View>
          <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: space.sm, gap: space.md }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm, gap: space.sm }}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

/**
 * Where the data lives, in words: "Saved on this phone" is always true (SQLite is the source of truth); "Backup synced" is shown only
 * when Back up and sync is on and the last sync succeeded. The two are never merged into one tick.
 */
export function SaveStatus({ synced }: { synced?: "synced" | "pending" | "failed" | null }) {
  const p = usePalette();
  const { t } = useI18n();
  const parts: { icon: IconName; text: string; color: string }[] = [{ icon: "phone", text: t("status.savedLocal"), color: p.muted }];
  if (synced === "synced") parts.push({ icon: "cloud", text: t("status.synced"), color: p.success });
  if (synced === "pending") parts.push({ icon: "cloud", text: t("status.syncPending"), color: p.muted });
  if (synced === "failed") parts.push({ icon: "alert", text: t("status.syncFailed"), color: p.warn });
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: space.md, rowGap: space.xs }}>
      {parts.map((x) => (
        <View key={x.text} style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
          <Icon name={x.icon} color={x.color} size={16} />
          <AppText style={{ color: x.color, fontSize: ty.caption }}>{x.text}</AppText>
        </View>
      ))}
    </View>
  );
}

/**
 * The target strip: a quiet olive surface with a small label, the load and reps in large figures (they wrap, never truncate) and an
 * optional "Why" action. When there is no target it becomes a helpful sentence.
 */
export function TargetStrip(props: { label: string; value?: string | null; unavailable?: string; whyLabel?: string; onWhy?: () => void; reason?: string }) {
  const p = usePalette();
  return (
    <View style={{ backgroundColor: p.tint, borderRadius: radius.card, padding: space.lg, gap: space.xs, borderStartWidth: 4, borderStartColor: p.accent }}>
      <AppText style={{ fontSize: ty.caption, fontWeight: "600", color: p.accent, letterSpacing: 0.4 }}>{props.label}</AppText>
      {props.value ? (
        <AppText ltr style={{ fontSize: ty.load, fontWeight: "600" }}>{props.value}</AppText>
      ) : (
        <AppText style={{ color: p.muted }}>{props.unavailable ?? ""}</AppText>
      )}
      {props.reason ? <AppText style={{ fontSize: ty.label, color: p.muted }}>{props.reason}</AppText> : null}
      {props.whyLabel && props.onWhy ? (
        <Pressable accessibilityRole="button" onPress={props.onWhy} style={{ minHeight: MIN_TOUCH, flexDirection: "row", alignItems: "center", gap: space.xs, alignSelf: "flex-start" }}>
          <Icon name="why" color={p.accent} size={20} />
          <AppText style={{ color: p.accent, fontWeight: "600", fontSize: ty.label }}>{props.whyLabel}</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

/** A tappable list row with title, note, optional trailing text and a chevron that mirrors in RTL. */
export function ListRow(props: { title: string; note?: string; trailing?: string; onPress?: () => void; last?: boolean; accessibilityLabel?: string }) {
  const p = usePalette();
  const inner = (
    <>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText style={{ fontWeight: "600" }}>{props.title}</AppText>
        {props.note ? <AppText style={{ fontSize: ty.label, color: p.muted }}>{props.note}</AppText> : null}
      </View>
      {props.trailing ? <AppText ltr style={{ fontSize: ty.label, color: p.muted, maxWidth: "45%" }}>{props.trailing}</AppText> : null}
      {props.onPress ? <Icon name="chevron" color={p.muted} size={20} mirror /> : null}
    </>
  );
  const style = { minHeight: 56, flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm, borderBottomWidth: props.last ? 0 : 1, borderColor: p.border } as const;
  return props.onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={props.accessibilityLabel} onPress={props.onPress} style={({ pressed }) => [style, pressed ? { backgroundColor: p.raised } : null]}>{inner}</Pressable>
  ) : (
    <View style={style}>{inner}</View>
  );
}
