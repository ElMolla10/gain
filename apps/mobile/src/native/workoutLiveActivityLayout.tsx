import { HStack, Image, ProgressView, Spacer, Text, VStack } from "@expo/ui/swift-ui";
import { background, cornerRadius, environment, font, foregroundStyle, frame, lineLimit, monospacedDigit, padding } from "@expo/ui/swift-ui/modifiers";
import { createLiveActivity, type LiveActivityEnvironment } from "expo-widgets";
import type { WorkoutActivityProps } from "../logic/workoutActivityModel";

const WorkoutActivity = (p: WorkoutActivityProps, context: LiveActivityEnvironment) => {
  "widget";
  // The isolated widget runtime cannot import the app palette or i18n: colours live here and every string arrives localised in props.
  const accent = context.isLuminanceReduced ? "#FFFFFF" : context.colorScheme === "dark" ? "#B7F51B" : "#3F5700"; // a11y-ok: adaptive native widget colors
  // Each native timer is its own numeric Text with stable Western digits; the labels around it keep the system locale.
  const timerLocale = environment("locale", "en_US_POSIX");
  const elapsed = { lower: new Date(p.timerStart), upper: new Date(p.timerStart + 86_400_000) };
  const pause = p.pausedAt ? new Date(p.pausedAt) : undefined;
  const restI = p.rest ? { lower: new Date(p.rest.startedAt), upper: new Date(p.rest.endsAt) } : null;
  const second = p.exercise ? (p.detail ? `${p.setLine} · ${p.detail}` : p.setLine) : null;
  const badge = <Image systemName="dumbbell.fill" size={14} color="#000000" modifiers={[frame({ width: 20, height: 20 }), background(accent), cornerRadius(5)]} />; // a11y-ok: black glyph on the adaptive accent badge
  const elapsedText = (size: number) => <Text timerInterval={elapsed} countsDown={false} pauseTime={pause} modifiers={[timerLocale, monospacedDigit(), font({ size, weight: "bold" })]} />;
  const restRow = restI && p.rest ? (
    <VStack spacing={4}>
      <HStack>
        <Text modifiers={[font({ size: 15 })]}>{p.rest.label}</Text>
        <Spacer />
        <Text timerInterval={restI} countsDown modifiers={[timerLocale, monospacedDigit(), font({ size: 17, weight: "bold" }), foregroundStyle(accent)]} />
      </HStack>
      <ProgressView timerInterval={restI} countsDown />
    </VStack>
  ) : null;
  return {
    banner: (
      <VStack alignment="leading" spacing={6} modifiers={[padding({ all: 16 })]}>
        <HStack spacing={6}>
          {badge}
          <Text modifiers={[font({ size: 13, weight: "semibold" }), foregroundStyle(accent)]}>{p.title}</Text>
          <Spacer />
          {p.pausedLabel ? <Text modifiers={[font({ size: 12 }), foregroundStyle({ type: "hierarchical", style: "secondary" })]}>{p.pausedLabel}</Text> : null}
          {elapsedText(22)}
        </HStack>
        <Text modifiers={[font({ size: 17, weight: "semibold" }), lineLimit(1)]}>{p.exercise ?? p.setLine}</Text>
        {second ? <Text modifiers={[font({ size: 15 }), foregroundStyle({ type: "hierarchical", style: "secondary" }), lineLimit(1)]}>{second}</Text> : null}
        {restRow}
      </VStack>
    ),
    compactLeading: <Image systemName="dumbbell.fill" color={accent} />,
    compactTrailing: restI
      ? <Text timerInterval={restI} countsDown modifiers={[timerLocale, monospacedDigit(), foregroundStyle(accent)]} />
      : <Text timerInterval={elapsed} countsDown={false} pauseTime={pause} modifiers={[timerLocale, monospacedDigit()]} />,
    minimal: <Image systemName={restI ? "timer" : "dumbbell.fill"} color={accent} />,
    expandedLeading: <HStack spacing={6}>{badge}<Text modifiers={[foregroundStyle(accent)]}>{p.title}</Text></HStack>,
    expandedTrailing: (
      <VStack alignment="trailing">
        {elapsedText(20)}
        {p.pausedLabel ? <Text modifiers={[font({ size: 12 }), foregroundStyle({ type: "hierarchical", style: "secondary" })]}>{p.pausedLabel}</Text> : null}
      </VStack>
    ),
    expandedBottom: (
      <VStack alignment="leading" spacing={4}>
        <Text modifiers={[font({ weight: "semibold" }), lineLimit(1)]}>{p.exercise ?? p.setLine}</Text>
        {second ? <Text modifiers={[foregroundStyle({ type: "hierarchical", style: "secondary" }), lineLimit(1)]}>{second}</Text> : null}
        {restRow}
      </VStack>
    ),
  };
};

export default createLiveActivity("GainWorkoutActivity", WorkoutActivity);

/** The older rest-only card. Kept only so leftover cards from earlier builds can be ended; never started. */
export const legacyRestActivity = createLiveActivity("GainRestActivity", () => {
  "widget";
  return { banner: <Text>{"GAIN"}</Text> }; // brand name; never shown (legacy cards are only ended)
});
