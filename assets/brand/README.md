# GAIN brand assets

The official GAIN logo is the lime weight-plate disc (12 o'clock tab, two concentric grooves each side) with a bold up-arrow cut out of it whose stem starts at the plate's bottom edge.

**Identity v1 (redesign PR):** the geometry below is unchanged; the colours are now the brand tokens: flat electric lime `#B7F51B` on ink `#10120E` (docs/DESIGN.md). `gain-logo-original.jpg` stays the untouched reference.

| File | What |
|---|---|
| `gain-logo-original.jpg` | The original artwork supplied by Mohamed (1280x720). Source of truth; never edited. |
| `gain-logo.svg` | Crisp vector master, 1024x1024, ink square, flat lime. |
| `gain-mark.svg` | Same mark, transparent background, tight box (in-app, web). |
| `ios-icon-1024.png` | iOS App Store icon: 1024x1024 RGB, **no alpha**. |
| `icon.png`, `adaptive-icon-foreground.png`, `adaptive-icon-monochrome.png`, `splash-icon.png`, `notification-icon.png` | Copies of what `apps/mobile/assets/` ships (see `apps/mobile/app.json`). |
| `compare-original-vs-svg.png` | Original / recreation / abs-diff, 2x. |
| `before-original.png`, `after-recreated.png` | Before/after squares for the PR. |
| `preview-icons.png` | Mask previews (circle, rounded), small sizes, mono, notification, in-app. |

Everything except the original is generated: `python3 tools/brand/build_brand.py` (needs `cairosvg`, `pillow`), and `python3 tools/brand/compare.py <out.png>` re-measures the match. The geometry (disc r=166.9, tab arc r=173.2 over +/-46.5 degrees, grooves at r=116.9 and r=137.7 with tapered ends, 45-degree chevron arrow with 32px stem) was measured from the JPEG.

Colour (historic, the measurement the geometry came from): the JPEG's lime is a top-to-bottom gradient of about `#A8F60A` -> `#94D60C` -> `#6EAE0A` (mean about `#96E10B`), a little deeper than the nominal `#ADFF2F`; the SVG follows the pixels. Background is pure `#000000` (the JPEG has a faint vignette that is JPEG noise/halo, not reproduced).

Android adaptive icon: foreground keeps the mark inside the 66% safe zone (max radius 328 px of the 338 px allowed on the 1024 canvas); background is solid black; the monochrome layer is the plate silhouette with the arrow cut out (no groove rings: they close up at themed-icon size); the notification icon is the same groove-less white silhouette.
