import React, { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Animated, LayoutAnimation, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View, type KeyboardTypeOptions, type StyleProp, type TextProps, type TextStyle, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "./components/Icon";
import { familyFor, hasArabic, ltrAllowed, scaleFor, textOf } from "./fonts";
import { useI18n } from "./i18n";
import { adjustKeyboardInsets, numberPadAccessory } from "./numberPad";
import { choiceListMaxHeight, hasCollapsibleContent, sheetMaxHeight, sheetRelease } from "./logic/sheetLayout";
import { clampStep, parseTyped, REPEAT_DELAY_MS, REPEAT_EVERY_MS } from "./logic/stepper";
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
  // `ltr` is honoured only for text with no Arabic letters; a mixed run would be laid out backwards ("كجم × 9 40"), so it keeps the
  // language's direction (the numbers inside are isolated by the caller). Tabular figures stay either way.
  const forceLtr = !!ltr && ltrAllowed(children);
  if (ltr && !forceLtr && __DEV__) console.warn("AppText ltr ignored: the text contains Arabic", textOf(children));
  const arabic = hasArabic(textOf(children)) || (lang === "ar" && !forceLtr);
  const { fontWeight, fontSize, lineHeight, ...others } = flat;
  const scaled = scaleFor(typeof fontSize === "number" ? fontSize : ty.body, arabic);
  return (
    <Text
      {...rest}
      style={[
        { color: p.text, writingDirection: forceLtr ? "ltr" : direction, fontFamily: familyFor({ weight: fontWeight, arabic }), fontSize: scaled.fontSize, lineHeight: typeof lineHeight === "number" ? lineHeight : scaled.lineHeight },
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
export function Screen({ children, footer, scroll = true, scrollEnabled = true, contentStyle, title, tab, footerInline, scrollRef }: { children: React.ReactNode; footer?: React.ReactNode; scroll?: boolean; /** Lock the scroll without remounting (Today locks it while the day pager owns a drag). */ scrollEnabled?: boolean; contentStyle?: StyleProp<ViewStyle>; /** Screen title, 28/34 semibold, announced as a heading. */ title?: string; /** A tab root: no native header above it, so the top safe area is added here. */ tab?: boolean; /** Render the footer at the end of the scrolling content instead of pinned (very large text: it would cover the content). */ footerInline?: boolean; scrollRef?: React.Ref<ScrollView> }) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const pinned = footer && !(footerInline && scroll) ? footer : null;
  const body = [{ padding: space.lg, gap: space.xl, paddingTop: space.lg + (tab ? insets.top : 0), paddingBottom: space.xl + (pinned || tab ? 0 : insets.bottom) }, contentStyle];
  const heading = title ? <AppText accessibilityRole="header" style={{ fontSize: ty.title, fontWeight: "600" }}>{title}</AppText> : null;
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      {scroll ? (
        <ScrollView ref={scrollRef} scrollEnabled={scrollEnabled} contentContainerStyle={body} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets>
          {heading}
          {children}
          {footer && !pinned ? <View style={{ gap: space.sm }}>{footer}</View> : null}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, ...body]}>{heading}{children}</View>
      )}
      {pinned ? (
        <View style={{ paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.md + insets.bottom, gap: space.sm, backgroundColor: p.bg, borderTopWidth: 1, borderColor: p.border }}>{pinned}</View>
      ) : null}
    </View>
  );
}

type Tone = "default" | "raised" | "tint" | "success" | "warn" | "danger";
/** Inside a CollapsibleCard a Card becomes a section of it (a divider, no second border or surface): no card-in-card. */
const InsetCards = React.createContext(false);

export function Card({ children, style, tone = "default" }: { children: React.ReactNode; style?: ViewStyle; tone?: Tone }) {
  const p = usePalette();
  const inset = React.useContext(InsetCards);
  if (inset && tone === "default") return <View style={[{ borderTopWidth: 1, borderColor: p.border, paddingTop: space.md, gap: space.sm }, style]}>{children}</View>;
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

/** danger = outlined (a first tap on a destructive action); dangerSolid = the final confirm of one (solid danger, onDanger label). */
export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger" | "dangerSolid";
/**
 * Buttons. `primary` = lime fill, ink label (one per screen). `secondary` = neutral surface with an edge. `quiet` = text (+ icon) only.
 * `danger` = destructive, separated and outlined in the danger colour. `selected={false}` is the older spelling of `secondary`.
 * While `loading` the label is replaced by a labelled spinner and presses are ignored (no duplicates). Labels wrap; they never truncate.
 */
export function BigButton(props: { label: string; onPress?: () => void; disabled?: boolean; selected?: boolean; variant?: ButtonVariant; loading?: boolean; icon?: IconName; accessibilityHint?: string; /** The one primary action on a screen: taller, larger label. */ hero?: boolean }) {
  const p = usePalette();
  const { t } = useI18n();
  // Inside a collapsible card (This week) a primary would compete with the screen's one primary action: draw it secondary (B-R2).
  const inset = React.useContext(InsetCards);
  const asked: ButtonVariant = props.variant ?? (props.selected === false ? "secondary" : "primary");
  const variant: ButtonVariant = inset && asked === "primary" && !props.hero ? "secondary" : asked;
  const disabled = !!props.disabled || !!props.loading;
  const fg = disabled && !props.loading ? p.onDisabled : variant === "primary" ? p.onFill : variant === "dangerSolid" ? p.onDanger : variant === "danger" ? p.danger : variant === "quiet" ? p.accent : p.text;
  const height = props.hero ? 60 : variant === "primary" || variant === "dangerSolid" ? PRIMARY_HEIGHT : MIN_TOUCH;
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
        backgroundColor: variant === "primary" ? (props.disabled && !props.loading ? p.disabled : pressed ? p.fillPressed : p.fill) : variant === "dangerSolid" ? (disabled && !props.loading ? p.disabled : p.danger) : variant === "secondary" ? (pressed ? p.tint : p.raised) : pressed ? p.raised : "transparent",
        opacity: variant === "dangerSolid" && pressed ? 0.85 : 1,
        borderWidth: variant === "secondary" || variant === "danger" ? 1.5 : variant === "primary" ? 1 : 0,
        borderColor: variant === "danger" ? p.danger : variant === "primary" ? (props.disabled && !props.loading ? "transparent" : p.fillEdge) : p.edge,
      })}
    >
      {props.loading ? <ActivityIndicator color={fg} /> : props.icon ? <Icon name={props.icon} color={fg} size={20} mirror={props.icon === "chevron"} /> : null}
      <AppText style={{ fontSize: props.hero ? ty.section : ty.body, fontWeight: "600", color: fg, textAlign: "center", flexShrink: 1 }}>{props.loading ? t("common.loading") : props.label}</AppText>
    </Pressable>
  );
}

/** A 48 x 48 icon-only control. The label is spoken by TalkBack. */
export function IconButton(props: { icon: IconName; label: string; onPress: () => void; disabled?: boolean; color?: string; mirror?: boolean; /** Arrow pointing to the start edge (back): flipped in left-to-right, as drawn in right-to-left. */ back?: boolean }) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => ({ width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: radius.button, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? p.raised : "transparent", opacity: props.disabled ? 0.4 : 1 })}
    >
      <Icon name={props.icon} color={props.color ?? p.text} size={24} mirror={props.mirror} back={props.back} />
    </Pressable>
  );
}

/**
 * A quiet text action ("Why", "Change workout"): accent label with an optional icon, no fill and no outline, so it never competes with the
 * primary button. The touch area is always at least 48 x 48 dp whatever the text size; a long label wraps and is never cut off.
 */
export function QuietAction(props: { label: string; onPress: () => void; onLongPress?: () => void; icon?: IconName; /** danger = a destructive text action (e.g. "Remove this day"); it still asks before it deletes. */ tone?: "danger"; /** Spoken label when it must say more than the visible one (e.g. "Why: Bench Press"). */ accessibilityLabel?: string; /** For a control that opens or closes something in place. */ expanded?: boolean }) {
  const p = usePalette();
  const color = props.tone === "danger" ? p.danger : p.accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel ?? props.label}
      accessibilityState={props.expanded === undefined ? undefined : { expanded: props.expanded }}
      onPress={props.onPress}
      onLongPress={props.onLongPress}
      style={({ pressed }) => ({ minHeight: MIN_TOUCH, minWidth: MIN_TOUCH, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.xs, paddingHorizontal: space.sm, borderRadius: radius.button, backgroundColor: pressed ? p.raised : "transparent" })}
    >
      {props.icon ? <Icon name={props.icon} color={color} size={props.tone === "danger" ? 20 : 18} /> : null}
      <AppText style={{ fontSize: ty.label, fontWeight: "600", color, flexShrink: 1 }}>{props.label}</AppText>
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
  /** Search field (P-8): a search glyph at the start and, while there is text, a 48 dp clear button at the end that keeps focus. */
  search?: { clearLabel: string };
}) {
  const p = usePalette();
  const { direction, t } = useI18n();
  const font = useInputFont();
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<null | TextInput>(null);
  return (
    <View style={{ gap: space.xs }}>
      <AppText style={{ fontWeight: "600", fontSize: ty.label }}>{props.label}</AppText>
      {props.hint ? <AppText style={{ color: p.muted, fontSize: ty.caption }}>{props.hint}</AppText> : null}
      <View style={{ justifyContent: "center" }}>
      {props.search ? (
        <View pointerEvents="none" style={{ position: "absolute", start: space.md, zIndex: 1 }}>
          <Icon name="search" color={p.muted} size={20} />
        </View>
      ) : null}
      <TextInput
        ref={inputRef}
        accessibilityLabel={props.label}
        value={props.value}
        onChangeText={props.onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={props.placeholder}
        placeholderTextColor={p.muted}
        keyboardType={props.keyboardType ?? (props.numeric ? "decimal-pad" : "default")}
        {...(props.numeric || props.keyboardType === "number-pad" || props.keyboardType === "decimal-pad" || props.keyboardType === "numeric" ? numberPadAccessory(t) : {})}
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
          ...(props.search ? { paddingStart: space.md + 20 + space.sm, paddingEnd: props.value ? MIN_TOUCH : space.md } : {}),
        }}
      />
      {props.search && props.value ? (
        <View style={{ position: "absolute", end: 0 }}>
          <IconButton icon="close" label={props.search.clearLabel} onPress={() => { props.onChangeText(""); inputRef.current?.focus(); }} />
        </View>
      ) : null}
      </View>
      {props.error ? <InlineStatus kind="error" text={props.error} /> : null}
    </View>
  );
}

/** Compact neutral outline; lime fill only for the selected choice, and a check mark so selection is not colour alone. */
export function Chip(props: { label: string; selected?: boolean; disabled?: boolean; onPress?: () => void; /** danger = outlined in the danger colour (remove actions). */ tone?: "danger"; /** One of a single-select group: radio + checked semantics, and the selected chip is drawn like a RadioRow (tint, accent border, check), not lime. */ radio?: boolean }) {
  const p = usePalette();
  const radioOn = !!props.radio && !!props.selected;
  return (
    <Pressable
      accessibilityRole={props.radio ? "radio" : "button"}
      accessibilityState={props.radio ? { checked: !!props.selected, disabled: !!props.disabled } : { selected: !!props.selected, disabled: !!props.disabled }}
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => ({
        opacity: props.disabled ? 0.45 : 1,
        minHeight: MIN_TOUCH,
        minWidth: MIN_TOUCH,
        borderRadius: radius.pill,
        paddingHorizontal: space.lg,
        paddingVertical: space.sm,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: space.xs,
        borderWidth: radioOn ? 2 : props.selected ? 0 : 1.5,
        borderColor: radioOn ? p.accent : props.tone === "danger" ? p.danger : p.edge,
        backgroundColor: radioOn ? p.tint : props.selected ? p.fill : pressed ? p.raised : "transparent",
      })}
    >
      {props.selected ? <Icon name="check" color={radioOn ? p.accent : p.onFill} size={18} /> : null}
      <AppText style={{ fontWeight: "600", fontSize: ty.label, color: radioOn ? p.text : props.selected ? p.onFill : props.tone === "danger" ? p.danger : p.text, flexShrink: 1 }}>{props.label}</AppText>
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
  // Long-press auto-repeat (P-9): first repeat after 400 ms, then every 120 ms; stops at min/max, on release and on unmount.
  const live = useRef(props);
  live.current = props;
  const timers = useRef<{ delay?: ReturnType<typeof setTimeout>; every?: ReturnType<typeof setInterval>; repeated: boolean }>({ repeated: false });
  const stop = () => {
    if (timers.current.delay) clearTimeout(timers.current.delay);
    if (timers.current.every) clearInterval(timers.current.every);
    timers.current.delay = undefined;
    timers.current.every = undefined;
  };
  useEffect(() => stop, []);
  const apply = (delta: number) => {
    const cur = live.current;
    const next = clampStep(cur.value + delta * step, cur.min, cur.max);
    if (next === cur.value) return stop();
    cur.onChange(next);
  };
  const [typing, setTyping] = useState<string | null>(null);
  const commit = () => {
    if (typing !== null) props.onChange(parseTyped(typing, props.value, props.min, props.max, step));
    setTyping(null);
  };
  const btn = (icon: "plus" | "minus", delta: number, disabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${props.label} ${icon === "plus" ? "+" : "−"}`}
      disabled={disabled}
      onPressIn={() => {
        stop();
        timers.current.repeated = false;
        timers.current.delay = setTimeout(() => {
          timers.current.repeated = true;
          apply(delta);
          timers.current.every = setInterval(() => apply(delta), REPEAT_EVERY_MS);
        }, REPEAT_DELAY_MS);
      }}
      onPressOut={stop}
      onPress={() => {
        if (!timers.current.repeated) apply(delta);
        timers.current.repeated = false;
      }}
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
        {typing !== null ? (
          <TextInput
            accessibilityLabel={props.label}
            autoFocus
            value={typing}
            onChangeText={setTyping}
            onBlur={commit}
            onSubmitEditing={commit}
            keyboardType={step >= 1 ? "number-pad" : "decimal-pad"}
            selectTextOnFocus
            style={{ minWidth: 40, minHeight: MIN_TOUCH, textAlign: "center", fontSize: ty.section, fontWeight: "600", color: p.text, fontVariant: ["tabular-nums"], borderBottomWidth: 2, borderColor: p.accent, writingDirection: "ltr" }}
          />
        ) : (
          // Tap the number to type it (clamped on blur/submit).
          <Pressable accessibilityRole="button" accessibilityLabel={`${props.label}: ${props.value}`} accessibilityHint={props.label} onPress={() => setTyping(String(props.value))} style={{ minWidth: 40, minHeight: MIN_TOUCH, justifyContent: "center" }}>
            <AppText ltr style={{ textAlign: "center", fontSize: ty.section, fontWeight: "600", fontVariant: ["tabular-nums"] }}>{String(props.value)}</AppText>
          </Pressable>
        )}
        {btn("plus", 1, props.value >= props.max)}
      </View>
    </View>
  );
}

/** One line of status: icon + words, coloured by kind. Status is never colour alone. `compact` = caption size (a status that sits in a header). */
export function InlineStatus({ kind, text, icon: iconOverride, compact }: { kind: "info" | "success" | "warn" | "error"; text: string; icon?: IconName; compact?: boolean }) {
  const p = usePalette();
  const color = kind === "error" ? p.danger : kind === "warn" ? p.warn : kind === "success" ? p.success : p.muted;
  const icon: IconName = iconOverride ?? (kind === "error" || kind === "warn" ? "alert" : kind === "success" ? "check" : "why");
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.xs }}>
      <View style={{ paddingTop: 2 }}><Icon name={icon} color={color} size={compact ? 14 : 16} /></View>
      <AppText style={{ color, fontSize: compact ? ty.caption : ty.label, flexShrink: 1 }}>{text}</AppText>
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
      {/* 24 dp above the action (H-9): heading + body read as one block, the button as the next step. */}
      {actionLabel && onAction ? <View style={{ marginTop: space.xl - space.md }}><BigButton label={actionLabel} onPress={onAction} /></View> : null}
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
/** Drag-to-dismiss threshold for a sheet: past 30% of the card's height, or a fast downward flick. */
export const sheetShouldDismiss = (dy: number, vy: number, cardHeight: number): boolean => dy > cardHeight * 0.3 || vy > 1.0;

export function Sheet({ visible, title, onClose, children, footer }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  const p = usePalette();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduced = useReducedMotion();
  // Only the backdrop fades (Modal "fade"); the card slides on its own and follows a downward drag on the grabber + header.
  const translateY = useRef(new Animated.Value(height)).current;
  const cardHeight = useRef(height);
  const closing = useRef(false);
  const latest = useRef({ onClose, reduced, visible });
  latest.current = { onClose, reduced, visible };
  // N-3: content height up to 60%; dragging the handle up grows it to 90%, down from there returns to 60%.
  const [expanded, setExpanded] = useState(false);
  const expandedRef = useRef(false);
  expandedRef.current = expanded;
  const resize = (next: boolean) => {
    if (!latest.current.reduced) LayoutAnimation.configureNext(LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.scaleY));
    setExpanded(next);
  };
  useEffect(() => {
    closing.current = false;
    setExpanded(false);
    if (!visible) return;
    if (reduced) { translateY.setValue(0); return; }
    translateY.setValue(cardHeight.current);
    Animated.timing(translateY, { toValue: 0, duration: 250, useNativeDriver: true }).start();
  }, [visible, reduced, translateY]);
  const close = useMemo(() => () => {
    if (closing.current) return;
    if (latest.current.reduced) return latest.current.onClose();
    closing.current = true;
    Animated.timing(translateY, { toValue: cardHeight.current, duration: 200, useNativeDriver: true }).start(() => {
      latest.current.onClose();
      // If the caller kept the sheet open (e.g. a guarded close), bring the card back instead of leaving it off-screen.
      setTimeout(() => {
        if (!closing.current || !latest.current.visible) return;
        closing.current = false;
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      }, 50);
    });
  }, [translateY]);
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 4 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove: (_e, g) => translateY.setValue(Math.max(0, g.dy)),
    onPanResponderRelease: (_e, g) => {
      const action = sheetRelease(g.dy, g.vy, expandedRef.current, sheetShouldDismiss(g.dy, g.vy, cardHeight.current));
      if (action === "dismiss") return close();
      if (action === "expand" || action === "collapse") resize(action === "expand");
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
    },
    onPanResponderTerminate: () => Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start(),
  }), [translateY, close]);
  return (
    <Modal visible={visible} transparent animationType={reduced ? "none" : "fade"} onRequestClose={close} statusBarTranslucent navigationBarTranslucent>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("common.close")} onPress={close} style={{ flex: 1 }} />
        <Animated.View accessibilityViewIsModal onLayout={(e) => { cardHeight.current = e.nativeEvent.layout.height; }} style={{ transform: [{ translateY }], maxHeight: sheetMaxHeight(height, expanded), backgroundColor: p.card, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, borderWidth: 1, borderBottomWidth: 0, borderColor: p.border, paddingBottom: insets.bottom + space.md }}>
          <View {...pan.panHandlers}>
            <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: p.edge, marginTop: space.sm }} />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingStart: space.lg, paddingEnd: space.xs, paddingVertical: space.xs, gap: space.sm }}>
              <AppText accessibilityRole="header" style={{ fontSize: ty.section, fontWeight: "600", flex: 1 }}>{title}</AppText>
              <IconButton icon="close" label={t("common.close")} onPress={close} />
            </View>
          </View>
          <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: space.sm, gap: space.md }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={adjustKeyboardInsets}>
            {children}
          </ScrollView>
          {footer ? <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm, gap: space.sm }}>{footer}</View> : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

/**
 * A one-of-many picker in a Sheet (e.g. which workout day). Rows are radio buttons: the chosen one carries a check mark AND a different
 * surface (never colour alone), each row speaks "name, badge, detail", picking closes the sheet. 56 dp rows; long names wrap.
 */
/**
 * One option of a single-select list (language, units, programme mode, ChoiceSheet). Unselected: transparent with a 1.5 dp edge.
 * Selected: tint fill, 2 dp accent border and a check at the END edge, so it reads in grayscale and isn't mistaken for the lime CTA.
 * Screen readers hear "radio, checked". Put a group of them inside RadioGroup.
 */
export function RadioRow(props: { label: string; detail?: string; /** A short status word such as "Suggested today". */ badge?: string; selected: boolean; onPress: () => void; disabled?: boolean }) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={[props.label, props.badge, props.detail].filter(Boolean).join(", ")}
      accessibilityState={{ checked: props.selected, selected: props.selected, disabled: !!props.disabled }}
      disabled={props.disabled}
      onPress={props.onPress}
      style={({ pressed }) => ({ minHeight: 56, flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.md, paddingHorizontal: space.lg, borderRadius: radius.card, borderWidth: props.selected ? 2 : 1.5, borderColor: props.selected ? p.accent : p.edge, backgroundColor: props.selected ? p.tint : pressed ? p.raised : "transparent", opacity: props.disabled ? 0.45 : 1 })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <AppText style={{ fontWeight: "600" }}>{props.label}</AppText>
        {props.badge ? <AppText style={{ fontSize: ty.caption, fontWeight: "600", color: p.accent }}>{props.badge}</AppText> : null}
        {props.detail ? <AppText style={{ fontSize: ty.label, color: p.muted }}>{props.detail}</AppText> : null}
      </View>
      {props.selected ? <Icon name="check" color={p.accent} size={22} /> : null}
    </Pressable>
  );
}

/** A labelled radiogroup of RadioRows (or radio Chips when `row`). */
export function RadioGroup(props: { label?: string; children: React.ReactNode; row?: boolean }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={props.label} style={props.row ? { flexDirection: "row", flexWrap: "wrap", gap: space.sm } : { gap: space.sm }}>
      {props.children}
    </View>
  );
}

export function ChoiceSheet(props: { visible: boolean; title: string; note?: string; onClose: () => void; onSelect: (id: string) => void; options: { id: string; label: string; detail?: string; /** A short status word such as "Suggested today". */ badge?: string; selected: boolean }[] }) {
  const p = usePalette();
  const { height } = useWindowDimensions();
  return (
    <Sheet visible={props.visible} title={props.title} onClose={props.onClose}>
      {/* The option list is capped so the last rows stay within thumb reach; the note is never cut off (keep its copy to one line). */}
      {props.note ? <AppText style={{ color: p.muted, fontSize: ty.label }}>{props.note}</AppText> : null}
      <ScrollView style={{ maxHeight: choiceListMaxHeight(height) }} contentContainerStyle={{ gap: space.sm }} nestedScrollEnabled>
      <RadioGroup>
        {props.options.map((o) => (
          <RadioRow
            key={o.id}
            label={o.label}
            detail={o.detail}
            badge={o.badge}
            selected={o.selected}
            onPress={() => {
              props.onSelect(o.id);
              props.onClose();
            }}
          />
        ))}
      </RadioGroup>
      </ScrollView>
    </Sheet>
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
export function TargetStrip(props: { label: string; value?: string | null; /** Tabular figures for the value. It never forces LTR: the value is built in the language's order with isolated numbers. */ isNumeric?: boolean; unavailable?: string; whyLabel?: string; onWhy?: () => void; reason?: string }) {
  const p = usePalette();
  return (
    <View style={{ backgroundColor: p.tint, borderRadius: radius.card, padding: space.lg, gap: space.xs, borderStartWidth: 4, borderStartColor: p.accent }}>
      <AppText style={{ fontSize: ty.caption, fontWeight: "600", color: p.accent, letterSpacing: 0.4 }}>{props.label}</AppText>
      {props.value ? (
        <AppText style={[{ fontSize: ty.load, fontWeight: "600" }, props.isNumeric ? { fontVariant: ["tabular-nums"] } : null]}>{props.value}</AppText>
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
/**
 * Two or three tabs that switch content in place (History's Sessions / Exercises, H-7): a full-width segmented control,
 * 48 dp, first segment on the start edge. Exposed as a tablist with selected tabs, not as chips.
 */
export function SegmentedTabs<T extends string>(props: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const p = usePalette();
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: "row", borderWidth: 1.5, borderColor: p.edge, borderRadius: radius.button, overflow: "hidden" }}>
      {props.options.map((o, i) => {
        const on = o.value === props.value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => props.onChange(o.value)}
            style={{ flex: 1, minHeight: MIN_TOUCH, alignItems: "center", justifyContent: "center", paddingHorizontal: space.sm, backgroundColor: on ? p.fill : "transparent", borderStartWidth: i === 0 ? 0 : 1.5, borderColor: p.edge }}
          >
            <AppText style={{ fontSize: ty.bodySmall, fontWeight: "600", textAlign: "center", color: on ? p.onFill : p.text }}>{o.label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ListRow(props: { title: string; note?: string; trailing?: string; /** Extra trailing content (a pill, a value with a glyph); kept within 45% of the row. */ trailingIcon?: React.ReactNode; onPress?: () => void; last?: boolean; accessibilityLabel?: string; /** Where the row leads, when the title does not say (screen readers, S-12). */ accessibilityHint?: string }) {
  const p = usePalette();
  const inner = (
    <>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText style={{ fontWeight: "600" }}>{props.title}</AppText>
        {props.note ? <AppText style={{ fontSize: ty.label, color: p.muted }}>{props.note}</AppText> : null}
      </View>
      {props.trailing ? <AppText ltr style={{ fontSize: ty.label, color: p.muted, maxWidth: "45%" }}>{props.trailing}</AppText> : null}
      {props.trailingIcon ? <View style={{ maxWidth: "45%", flexDirection: "row", alignItems: "center", gap: space.xs }}>{props.trailingIcon}</View> : null}
      {props.onPress ? <Icon name="chevron" color={p.muted} size={20} mirror /> : null}
    </>
  );
  const style = { minHeight: 56, flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm, borderBottomWidth: props.last ? 0 : 1, borderColor: p.border } as const;
  return props.onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={props.accessibilityLabel} accessibilityHint={props.accessibilityHint} onPress={props.onPress} style={({ pressed }) => [style, pressed ? { backgroundColor: p.raised } : null]}>{inner}</Pressable>
  ) : (
    <View style={style}>{inner}</View>
  );
}

/**
 * One collapsed card that holds several secondary cards (Today's "This week"): a 56 dp header row (title, note, chevron that turns
 * when open, mirrored in RTL) and, when open, its children as sections of the same card. The children stay mounted while collapsed
 * (they load their own data), clipped to zero height and hidden from screen readers; when none of them renders anything the whole
 * card is hidden.
 */
export function CollapsibleCard({ title, note, children, defaultOpen = false }: { title: string; note?: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const p = usePalette();
  const { direction } = useI18n();
  const [open, setOpen] = useState(defaultOpen);
  const [hasContent, setHasContent] = useState(false);
  const shown = open && hasContent;
  const clip = { height: 0, overflow: "hidden" } as const;
  return (
    <View style={hasContent ? { borderRadius: radius.card, borderWidth: 1, borderColor: p.border, backgroundColor: p.card, overflow: "hidden" } : clip}>
      {hasContent ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={note ? `${title}, ${note}` : title}
          onPress={() => setOpen((o) => !o)}
          style={({ pressed }) => ({ minHeight: 56, flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg, backgroundColor: pressed ? p.raised : "transparent" })}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <AppText style={{ fontWeight: "600" }}>{title}</AppText>
            {note ? <AppText style={{ fontSize: ty.label, color: p.muted }}>{note}</AppText> : null}
          </View>
          {/* Collapsed: points to the end edge (mirrored in RTL). Open: turned a quarter so it points down in both directions. */}
          <View style={{ transform: [{ rotate: open ? (direction === "rtl" ? "-90deg" : "90deg") : "0deg" }] }}>
            <Icon name="chevron" color={p.muted} size={20} mirror />
          </View>
        </Pressable>
      ) : null}
      <View
        style={shown ? { paddingHorizontal: space.lg, paddingBottom: space.lg } : clip}
        accessibilityElementsHidden={!shown}
        importantForAccessibility={shown ? "auto" : "no-hide-descendants"}
        aria-hidden={!shown}
      >
        <View onLayout={(e) => setHasContent(hasCollapsibleContent(e.nativeEvent.layout.height))} style={{ gap: space.md }}>
          <InsetCards.Provider value>{children}</InsetCards.Provider>
        </View>
      </View>
    </View>
  );
}

/** A whole-card link: title, a muted note and a chevron (e.g. the goal pace on Today). */
export function ListCard({ title, note, onPress, accessibilityHint }: { title: string; note?: string; onPress: () => void; /** Where the card leads, when the title does not say (S-12). */ accessibilityHint?: string }) {
  const p = usePalette();
  return (
    <Pressable accessibilityRole="button" accessibilityHint={accessibilityHint} onPress={onPress} style={({ pressed }) => ({ minHeight: 56, flexDirection: "row", alignItems: "center", gap: space.md, borderRadius: radius.card, borderWidth: 1, borderColor: p.border, backgroundColor: pressed ? p.raised : p.card, padding: space.lg })}>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText style={{ fontWeight: "600" }}>{title}</AppText>
        {note ? <AppText style={{ fontSize: ty.label, color: p.muted }}>{note}</AppText> : null}
      </View>
      <Icon name="chevron" color={p.muted} size={20} mirror />
    </Pressable>
  );
}

/**
 * A collapsible filter group: one 48 px header row (title, a count of active filters, chevron), content only when open, and a clear
 * action. Collapsed by default so a long list of choices does not push the results off the screen.
 */
export function FilterPanel({ title, activeCount, clearLabel, onClear, children, defaultOpen = false }: { title: string; activeCount: number; clearLabel: string; onClear: () => void; children: React.ReactNode; defaultOpen?: boolean }) {
  const p = usePalette();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={{ borderRadius: radius.card, borderWidth: 1, borderColor: p.border, backgroundColor: p.card, overflow: "hidden" }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={activeCount > 0 ? `${title}, ${activeCount}` : title}
        onPress={() => setOpen((o) => !o)}
        style={({ pressed }) => ({ minHeight: 56, flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.lg, backgroundColor: pressed ? p.raised : "transparent" })}
      >
        <AppText style={{ fontWeight: "600", flex: 1 }}>{title}</AppText>
        {activeCount > 0 ? (
          <View style={{ minWidth: 28, height: 28, borderRadius: 14, paddingHorizontal: 8, backgroundColor: p.fill, alignItems: "center", justifyContent: "center" }}>
            <AppText ltr style={{ color: p.onFill, fontSize: ty.label, fontWeight: "600" }}>{activeCount}</AppText>
          </View>
        ) : null}
        <View style={{ transform: [{ rotate: open ? "-90deg" : "90deg" }] }}>
          <Icon name="chevron" color={p.muted} size={22} />
        </View>
      </Pressable>
      {open ? (
        <View style={{ padding: space.lg, paddingTop: space.xs, gap: space.md }}>
          {children}
          {activeCount > 0 ? <BigButton variant="quiet" label={clearLabel} onPress={onClear} /> : null}
        </View>
      ) : null}
    </View>
  );
}
