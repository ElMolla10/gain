/**
 * GAIN visual identity v1: the brand tokens, copied verbatim from the identity kit (gain-tokens.ts / gain-tokens.json).
 * Nothing here imports React Native, so tests can check contrast. App code never uses these values directly:
 * it reads palettes.ts (colours per theme) and theme.ts (spacing, radius, type). See docs/DESIGN.md.
 */
export const gainTokens = {
  version: "1.0.0",
  brand: { name: "GAIN", tagline: "Your next weight. Ready.", primaryAccent: "#B7F51B" },
  colors: {
    lime: "#B7F51B",
    ink: "#10120E",
    surface: "#1B1F17",
    raised: "#242A1F",
    border: "#414A36",
    text: "#F5F6EF",
    muted: "#B2B9A6",
    darkAccentText: "#10120E",
    success: "#8ED7AE",
    warning: "#F1C56B",
    error: "#FF9C94",
    lightBackground: "#F5F6EF",
    lightSurface: "#FFFFFF",
    lightText: "#171C12",
    lightMuted: "#526047",
    lightBorder: "#7A876E",
    lightAccentText: "#3C5700",
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, section: 48 },
  radius: { input: 8, button: 12, card: 16, sheet: 24, pill: 999 },
  type: {
    display: { size: 48, lineHeight: 52, weight: "600" },
    screen: { size: 28, lineHeight: 34, weight: "600" },
    section: { size: 20, lineHeight: 26, weight: "600" },
    body: { size: 16, lineHeight: 24, weight: "400" },
    label: { size: 14, lineHeight: 20, weight: "600" },
    caption: { size: 13, lineHeight: 18, weight: "400" },
    load: { size: 36, lineHeight: 42, weight: "600" },
  },
  fonts: { latin: "IBM Plex Sans", arabic: "IBM Plex Sans Arabic", numbers: "IBM Plex Sans" },
  interaction: { minTouchTarget: 48, inputHeight: 48, primaryButtonHeight: 52, motionMs: { press: 100, transition: 180, sheet: 240 }, reducedMotion: true },
} as const;
