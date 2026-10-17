import { HStack, Image, ProgressView, Text, VStack } from "@expo/ui/swift-ui";
import { environment, font, foregroundStyle, monospacedDigit, padding } from "@expo/ui/swift-ui/modifiers";
import { createLiveActivity, type LiveActivityEnvironment } from "expo-widgets";
import type { RestActivityProps } from "../logic/restLiveActivityController";

const RestActivity = (props: RestActivityProps, context: LiveActivityEnvironment) => {
  "widget";
  // The isolated widget runtime cannot import the app palette. Match native light/dark and Always-On contrast.
  const accent = context.isLuminanceReduced ? "#FFFFFF" : context.colorScheme === "dark" ? "#B7F51B" : "#3F5700"; // a11y-ok: adaptive native widget colors
  // Keep each native countdown in its own numeric Text with stable Western digits.
  // Do not change the locale/direction of the Arabic labels around it.
  const timerLocale = environment("locale", "en_US_POSIX");
  const interval = { lower: new Date(props.startedAt), upper: new Date(props.endsAt) };
  return {
    banner: (
      <VStack modifiers={[padding({ all: 16 })]}>
        <HStack>
          <VStack>
            <Text modifiers={[font({ size: 12, weight: "semibold" }), foregroundStyle(accent)]}>GAIN · {props.restLabel}</Text>
            <Text modifiers={[font({ size: 16, weight: "semibold" })]}>{props.label}</Text>
          </VStack>
          <Text timerInterval={interval} countsDown modifiers={[timerLocale, font({ size: 30, weight: "bold" }), monospacedDigit(), foregroundStyle(accent)]} />
        </HStack>
        <ProgressView timerInterval={interval} countsDown />
      </VStack>
    ),
    compactLeading: <Image systemName="timer" color={accent} />,
    compactTrailing: <Text timerInterval={interval} countsDown modifiers={[timerLocale, monospacedDigit(), foregroundStyle(accent)]} />,
    minimal: <Image systemName="timer" color={accent} />,
    expandedLeading: <Text modifiers={[foregroundStyle(accent)]}>{props.restLabel}</Text>,
    expandedTrailing: <Text timerInterval={interval} countsDown modifiers={[timerLocale, font({ size: 24, weight: "bold" }), monospacedDigit(), foregroundStyle(accent)]} />,
    expandedBottom: <VStack><Text>{props.label}</Text><ProgressView timerInterval={interval} countsDown /></VStack>,
  };
};

export default createLiveActivity("GainRestActivity", RestActivity);
