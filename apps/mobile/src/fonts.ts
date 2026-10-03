// Bundled typefaces (IBM Plex Sans + IBM Plex Sans Arabic, SIL OFL 1.1; licence in assets/fonts/OFL-LICENSE.txt).
// Pure data and functions with no React Native import, so tests can check the mapping. Nothing is fetched at runtime:
// the TTFs ship inside the app (expo-font config plugin embeds them natively; src/useBrandFonts.ts also registers them from the bundle).

export type FontFace = "regular" | "semibold" | "bold";

export const FONT_FAMILIES = {
  latin: { regular: "IBMPlexSans_400Regular", semibold: "IBMPlexSans_600SemiBold", bold: "IBMPlexSans_700Bold" },
  arabic: { regular: "IBMPlexSansArabic_400Regular", semibold: "IBMPlexSansArabic_600SemiBold", bold: "IBMPlexSansArabic_700Bold" },
} as const;

/** The CSS-style weights the code base writes ("400", "600", "700", "bold"...) mapped onto the three bundled faces. */
export function faceFor(weight: string | number | undefined): FontFace {
  if (weight === undefined || weight === "normal") return "regular";
  if (weight === "bold") return "bold";
  const n = typeof weight === "number" ? weight : Number(weight);
  if (!Number.isFinite(n) || n < 600) return "regular";
  if (n >= 800) return "bold";
  return "semibold";
}

const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
export const hasArabic = (s: string): boolean => ARABIC_RE.test(s);

/** Concatenated text of simple children (strings and numbers), used to pick the Arabic face for Arabic names inside English UI. */
export function textOf(children: unknown): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(textOf).join("");
  return "";
}

export function familyFor(opts: { weight?: string | number; arabic: boolean }): string {
  return FONT_FAMILIES[opts.arabic ? "arabic" : "latin"][faceFor(opts.weight)];
}

/**
 * Line heights from the type scale (kit: 13/18, 14/20, 16/24, 20/26, 28/34, 36/42, 48/52). Arabic starts at body 17/27 and headings
 * 28/40, so Arabic runs get a larger size for body text and taller lines. Returns what to render.
 */
export function scaleFor(fontSize: number, arabic: boolean): { fontSize: number; lineHeight: number } {
  if (arabic) {
    const ar: Record<number, [number, number]> = { 13: [13, 21], 14: [14, 22], 16: [17, 27], 17: [17, 27], 20: [20, 30], 28: [28, 40], 36: [36, 48], 48: [48, 60] };
    const hit = ar[fontSize];
    if (hit) return { fontSize: hit[0], lineHeight: hit[1] };
    return { fontSize, lineHeight: Math.round(fontSize * 1.55) };
  }
  const la: Record<number, number> = { 13: 18, 14: 20, 16: 24, 20: 26, 28: 34, 36: 42, 48: 52 };
  return { fontSize, lineHeight: la[fontSize] ?? Math.round(fontSize * 1.4) };
}
