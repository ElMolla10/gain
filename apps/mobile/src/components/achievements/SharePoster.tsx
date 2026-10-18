import React, { useRef, useState } from "react";
import { Share, View } from "react-native";
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";
import { diagnostics } from "../../diagnostics";
import { useI18n } from "../../i18n";
import { PLATE_COLOURS } from "../../palettes";
import { POSTER_H, POSTER_PX, POSTER_W, type PosterCopy } from "../../logic/sharePoster";
import { radius, space, type as ty, useIsDark, usePalette } from "../../theme";
import { AppText } from "../../ui";
import { LifetimePlate } from "./LifetimePlate";
import { Medal, materialFor } from "./Medal";
import { PrStaircase } from "./PrStaircase";

const PAD = 24;

/** The background: the app's surface with a soft glow in the medal's material or the plate's colour (no lattice, spec §12). */
function Glow({ h, colour, cy, linear = false }: { h: number; colour: string; cy: number; linear?: boolean }) {
  const p = usePalette();
  return (
    <Svg width={POSTER_W} height={h} style={{ position: "absolute", top: 0, start: 0 }}>
      <Defs>
        {linear ? (
          <LinearGradient id="posterGlow" x1="0.3" y1="0" x2="0.5" y2="0.6">
            <Stop offset="0" stopColor={colour} stopOpacity={1} />
            <Stop offset="1" stopColor={p.bg} stopOpacity={1} />
          </LinearGradient>
        ) : (
          <RadialGradient id="posterGlow" cx="50%" cy={`${cy}%`} rx="70%" ry="55%">
            <Stop offset="0" stopColor={colour} stopOpacity={0.35} />
            <Stop offset="0.65" stopColor={p.bg} stopOpacity={1} />
          </RadialGradient>
        )}
      </Defs>
      <Rect width={POSTER_W} height={h} fill={p.bg} />
      <Rect width={POSTER_W} height={h} fill="url(#posterGlow)" />
    </Svg>
  );
}

/** The wordmark and "From my training log" along the bottom edge; the row follows the language (GAIN sits at the start). */
function Footer({ text }: { text: string }) {
  const { t } = useI18n();
  const p = usePalette();
  return (
    <View style={{ position: "absolute", start: PAD, end: PAD, bottom: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
      <AppText ltr style={{ fontSize: ty.body, fontWeight: "700", letterSpacing: 3, color: p.accent }}>{t("app.name")}</AppText>
      <AppText style={{ fontSize: ty.caption, color: p.muted }}>{text}</AppText>
    </View>
  );
}

/**
 * One 1080-px share poster (spec PR G): medal 4:5, PR 4:5 (weights hidden by default: the qualitative line and the staircase's shape
 * without values) or the Lifetime Plate 9:16. Follows the app language and appearance; art and the staircase never mirror. No username,
 * gym or QR. Rendered offscreen only while sharing.
 */
export function SharePoster({ copy }: { copy: PosterCopy }) {
  const { lang } = useI18n();
  const p = usePalette();
  // Tracking breaks Arabic joining: Latin eyebrows only.
  const track = lang === "ar" ? 0 : 1;
  const dark = useIsDark();
  const h = POSTER_H[copy.kind];
  const eyebrow = (text: string, colour = p.muted) => (
    <AppText style={{ fontSize: ty.caption, fontWeight: "600", letterSpacing: track, color: colour, textAlign: "center" }}>{text.toLocaleUpperCase("en")}</AppText>
  );
  let body: React.ReactNode;
  if (copy.kind === "medal") {
    body = (
      <>
        <Glow h={h} colour={materialFor(copy.badgeId).base} cy={40} />
        <View style={{ position: "absolute", top: 44, start: 0, end: 0, alignItems: "center", gap: space.lg }}>
          {eyebrow(copy.eyebrow)}
          <Medal badgeId={copy.badgeId} state="earned" size={200} spec={0.55} />
        </View>
        <View style={{ position: "absolute", top: 300, start: PAD, end: PAD, alignItems: "center", gap: space.xs }}>
          <AppText style={{ fontSize: ty.section, fontWeight: "600", textAlign: "center" }}>{copy.title}</AppText>
          {copy.line ? <AppText style={{ fontSize: ty.label, color: p.muted, textAlign: "center" }}>{copy.line}</AppText> : null}
          {copy.date ? <AppText style={{ fontSize: ty.caption, color: p.muted, textAlign: "center" }}>{copy.date}</AppText> : null}
        </View>
      </>
    );
  } else if (copy.kind === "pr") {
    body = (
      <>
        <Glow h={h} colour={p.tint} cy={0} linear />
        <View style={{ position: "absolute", top: 40, start: PAD, end: PAD, flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <Medal badgeId={copy.badgeId} state="earned" size={44} />
          <View style={{ alignItems: "flex-start" }}>
            <AppText style={{ fontSize: ty.caption, fontWeight: "600", letterSpacing: track, color: p.accent }}>{copy.eyebrow.toLocaleUpperCase("en")}</AppText>
            {copy.date ? <AppText style={{ fontSize: ty.caption, color: p.muted }}>{copy.date}</AppText> : null}
          </View>
        </View>
        <AppText style={{ position: "absolute", top: 108, start: PAD, end: PAD, fontSize: ty.section, fontWeight: "600" }}>{copy.exercise}</AppText>
        <View style={{ position: "absolute", top: 160, start: PAD, end: PAD, alignItems: "center", gap: space.xs }}>
          {copy.before ? <AppText style={{ fontSize: ty.caption, color: p.muted }}>{copy.before}</AppText> : null}
          <AppText style={{ fontSize: copy.chip ? ty.display : ty.title, fontWeight: "600", textAlign: "center" }}>{copy.headline}</AppText>
          {copy.chip ? (
            <View style={{ backgroundColor: p.tint, borderRadius: radius.button, paddingHorizontal: space.md, paddingVertical: space.xs }}>
              <AppText style={{ fontWeight: "600", color: p.accent }}>{copy.chip}</AppText>
            </View>
          ) : null}
          {copy.sub ? <AppText style={{ fontSize: ty.caption, color: p.muted }}>{copy.sub}</AppText> : null}
        </View>
        <View style={{ position: "absolute", top: 310, start: 0, end: 0, alignItems: "center" }}>
          <PrStaircase steps={copy.steps} baseline={copy.baseline} assisted={copy.assisted} label="" scale={1.2} />
        </View>
      </>
    );
  } else {
    const colour = PLATE_COLOURS[copy.tier];
    body = (
      <>
        <Glow h={h} colour={dark ? colour.lo : colour.hi} cy={38} />
        <View style={{ position: "absolute", top: 70, start: 0, end: 0, alignItems: "center", gap: space.lg }}>
          {eyebrow(copy.eyebrow)}
          <LifetimePlate days={copy.days} daysIsFloor={copy.floor} bare />
        </View>
        <View style={{ position: "absolute", top: 420, start: PAD, end: PAD, alignItems: "center", gap: space.xs }}>
          <AppText style={{ fontSize: ty.section, fontWeight: "600", textAlign: "center" }}>{copy.tierName}</AppText>
          {copy.since ? <AppText style={{ fontSize: ty.label, color: p.muted, textAlign: "center" }}>{copy.since}</AppText> : null}
          {copy.weeks ? <AppText style={{ fontSize: ty.label, color: p.muted, textAlign: "center" }}>{copy.weeks}</AppText> : null}
        </View>
      </>
    );
  }
  return (
    <View collapsable={false} style={{ width: POSTER_W, height: h, overflow: "hidden", backgroundColor: p.bg }}>
      {body}
      <Footer text={copy.footer} />
    </View>
  );
}

/**
 * Sharing through a poster: mounts the poster offscreen, captures it at 1080 px with react-native-view-shot (loaded only when sharing,
 * as AchievementCard does), opens the share sheet, then releases the file. If the image can't be made, the text share runs instead,
 * so Share always does something. Nothing leaves the device except through the lifter's own share sheet.
 */
export function useSharePoster(): { host: React.ReactNode; share: (copy: PosterCopy, fallbackText: string) => Promise<void> } {
  const { t } = useI18n();
  const [copy, setCopy] = useState<PosterCopy | null>(null);
  const ref = useRef<View>(null);
  const laidOut = useRef<(() => void) | null>(null);
  const share = async (next: PosterCopy, fallbackText: string) => {
    let uri: string | null = null;
    let release: ((u: string) => void) | undefined;
    try {
      // Native modules load only when sharing is requested (as in AchievementCard).
      const Sharing = await import("expo-sharing");
      if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing unavailable");
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("poster layout timeout")), 2000);
        laidOut.current = () => {
          clearTimeout(timer);
          resolve();
        };
        setCopy(next);
      });
      // One more frame so the SVG has painted before the capture.
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const { captureRef, releaseCapture } = await import("react-native-view-shot");
      release = releaseCapture;
      uri = await captureRef(ref, { format: "png", result: "tmpfile", width: POSTER_PX, height: Math.round((POSTER_PX * POSTER_H[next.kind]) / POSTER_W) });
      await Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png", dialogTitle: t("achv.r2.detail.share") });
    } catch (e) {
      diagnostics.record("warn", "share poster", e);
      try {
        await Share.share({ message: fallbackText });
      } catch (e2) {
        diagnostics.record("warn", "share badge", e2);
      }
    } finally {
      if (uri) release?.(uri);
      laidOut.current = null;
      setCopy(null);
    }
  };
  const host = copy ? (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: "absolute", top: 0, start: 0, transform: [{ translateX: -10000 }] }}
    >
      <View
        ref={ref}
        collapsable={false}
        onLayout={() => {
          laidOut.current?.();
          laidOut.current = null;
        }}
      >
        <SharePoster copy={copy} />
      </View>
    </View>
  ) : null;
  return { host, share };
}
