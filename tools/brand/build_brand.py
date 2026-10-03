#!/usr/bin/env python3
"""Rebuild every GAIN brand asset from one geometry definition.

Geometry was measured from assets/brand/gain-logo-original.jpg (disc fit,
tab fit, groove radii/taper, arrow chevron). All coordinates below are in
"logo units" == pixels of the original 1280x720 JPEG, origin at disc centre.

Usage: python3 tools/brand/build_brand.py   (needs: cairosvg, pillow)
"""
import math, os, sys
import cairosvg
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BRAND = os.path.join(ROOT, "assets", "brand")
MOBILE_ASSETS = os.path.join(ROOT, "apps", "mobile", "assets")

# ---- measured geometry (origin = disc centre) -------------------------------
R = 166.9                # disc radius
TAB_C = -4.6             # tab circle centre y (circle is concentric-ish, slightly higher)
TAB_R = 173.2            # tab circle radius  -> tab top at y = -177.8
TAB_ANG = 46.5           # tab half-angle (deg from 12 o'clock, seen from disc centre)
STEM = 16.0              # stem half-width
APEX = -61.7             # arrow apex y
BASE = 15.3              # chevron flat bottom y
OUT_HW = BASE - APEX     # 77.0 half-width at base (45deg sides)
IN_APEX = -28.2          # inner apex y (chevron stroke ~33 thick vertically)
GROOVES = [  # (radius, [(phi_deg_from_bottom, width px), ...]) mirrored left/right; ends taper to 0
    (116.85, [(12, 0.0), (22, 2.9), (30, 2.8), (40, 2.8), (50, 2.6), (60, 2.35), (70, 2.05),
              (80, 1.8), (90, 1.6), (100, 1.2), (110, 0.65), (121, 0.0)]),
    (137.7,  [(12, 0.0), (20, 1.8), (30, 2.3), (40, 2.4), (50, 2.55), (60, 3.05), (70, 3.2),
              (80, 3.3), (90, 3.2), (100, 2.8), (110, 2.2), (120, 1.6), (130, 1.3), (141, 0.0)]),
]
TOP = (255, 255, 255)
# lime gradient stops (y in logo units, colour) measured from the JPEG; kept for gain-logo-original comparisons (compare.py)
LIME = [(-178.0, "#A8F60A"), (-6.0, "#94D60C"), (167.0, "#6EAE0A")]
# GAIN identity v1 (docs/DESIGN.md): the geometry above is unchanged; the colours are the brand tokens: flat electric lime on ink.
BRAND_LIME = "#B7F51B"
BG = "#10120E"
BBOX_TOP, BBOX_BOT = -TAB_R + TAB_C, math.sqrt(R * R - STEM * STEM)  # ~ -177.8 .. 166.1
BBOX_MID = (BBOX_TOP + BBOX_BOT) / 2

def f(v):
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s

def tab_points():
    a = math.radians(TAB_ANG)
    dx, dy = math.sin(a), -math.cos(a)
    # ray t*(dx,dy) meets tab circle centred (0,TAB_C)
    b = dx * 0 + dy * (-TAB_C)  # d . (p0 - c) with p0=0 -> dy*(0-TAB_C)
    c = TAB_C ** 2 - TAB_R ** 2
    t = -b + math.sqrt(b * b - c)
    return (R * dx, R * dy), (t * dx, t * dy)

def groove_path(radius, prof, side, T):
    """tapered arc band as closed polygon; T maps logo->output coords."""
    (p_in, p_out) = [], []
    (phi0, _), (phi1, _) = prof[0], prof[-1]
    n = 90
    for i in range(n + 1):
        phi = phi0 + (phi1 - phi0) * i / n
        # piecewise-linear width, smoothed by cosine ease at the two ends
        w = 0
        for (pa, wa), (pb, wb) in zip(prof, prof[1:]):
            if pa <= phi <= pb:
                u = (phi - pa) / (pb - pa)
                w = wa + (wb - wa) * u
                break
        th = math.radians(180 - phi) * side   # angle from 12 o'clock, clockwise positive
        ux, uy = math.sin(th), -math.cos(th)
        p_in.append((ux * (radius - w / 2), uy * (radius - w / 2)))
        p_out.append((ux * (radius + w / 2), uy * (radius + w / 2)))
    pts = p_out + p_in[::-1]
    return "M" + " L".join(f"{f(T(x, y)[0])} {f(T(x, y)[1])}" for x, y in pts) + "Z"

def mark_path(T, s, grooves=True):
    """Single evenodd path: disc+tab outline with the arrow cut out, grooves as holes."""
    (dr, tr) = tab_points()
    sy = math.sqrt(R * R - STEM * STEM)
    P = lambda x, y: f"{f(T(x, y)[0])} {f(T(x, y)[1])}"
    d = f"M{P(STEM, sy)} "
    d += f"A{f(R*s)} {f(R*s)} 0 0 0 {P(dr[0], dr[1])} "          # up the right side to tab
    d += f"L{P(tr[0], tr[1])} "
    d += f"A{f(TAB_R*s)} {f(TAB_R*s)} 0 0 0 {P(-tr[0], tr[1])} "   # over the top
    d += f"L{P(-dr[0], dr[1])} "
    d += f"A{f(R*s)} {f(R*s)} 0 0 0 {P(-STEM, sy)} "               # down the left side
    ih = STEM  # where inner chevron edge meets stem
    iy = IN_APEX + ih
    inner_base = BASE - IN_APEX
    for pt in [(-STEM, iy), (-inner_base, BASE), (-OUT_HW, BASE), (0, APEX),
               (OUT_HW, BASE), (inner_base, BASE), (STEM, iy)]:
        d += f"L{P(*pt)} "
    d += "Z"
    for r, prof in (GROOVES if grooves else []):
        for side in (-1, 1):
            d += " " + groove_path(r, prof, side, T)
    return d

def make_T(scale, cx, cy, bbox_centered=True):
    """logo units -> output px. (cx,cy) is where the *bbox centre* lands."""
    oy = BBOX_MID if bbox_centered else 0
    return (lambda x, y: (cx + x * scale, cy + (y - oy) * scale))

def gradient(id_, T, s):
    y0, y1 = T(0, LIME[0][0])[1], T(0, LIME[-1][0])[1]
    stops = "".join(f'<stop offset="{(y - LIME[0][0]) / (LIME[-1][0] - LIME[0][0]):.3f}" stop-color="{c}"/>' for y, c in LIME)
    return f'<linearGradient id="{id_}" gradientUnits="userSpaceOnUse" x1="0" y1="{f(y0)}" x2="0" y2="{f(y1)}">{stops}</linearGradient>'

def svg(size, scale, bg=BG, fill=BRAND_LIME, grooves=True, cx=None, cy=None, title="GAIN", viewbox=None, bbox_centered=True):
    cx = size / 2 if cx is None else cx
    cy = size / 2 if cy is None else cy
    T = make_T(scale, cx, cy, bbox_centered)
    d = mark_path(T, scale, grooves)
    defs = ""
    if fill == "gradient":
        defs = "<defs>" + gradient("lime", T, scale) + "</defs>"
        fl = "url(#lime)"
    else:
        fl = fill
    rect = f'<rect width="{size}" height="{size}" fill="{bg}"/>' if bg else ""
    vb = viewbox or f"0 0 {size} {size}"
    w = size
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" width="{w}" height="{w}" role="img" aria-label="{title}">'
            f'<title>{title}</title>{defs}{rect}<path fill-rule="evenodd" fill="{fl}" d="{d}"/></svg>\n')

def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, "w").write(text)

def png(path, svg_text, px):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    cairosvg.svg2png(bytestring=svg_text.encode(), write_to=path, output_width=px, output_height=px)

def flatten_ink(path):
    im = Image.open(path).convert("RGBA")
    bg = Image.new("RGBA", im.size, (0x10, 0x12, 0x0E, 255))
    bg.alpha_composite(im)
    bg.convert("RGB").save(path, optimize=True)

def main():
    # 1. master logo (ink square, full colour)
    master = svg(1024, 2.2)
    write(f"{BRAND}/gain-logo.svg", master)
    # transparent mark, tight box with 4% padding (in-app / favicon)
    pad = 0.04
    span = (BBOX_BOT - BBOX_TOP)
    mscale = 512 / ((BBOX_BOT - BBOX_TOP) * (1 + 2 * pad))
    mark = svg(512, mscale, bg=None, title="GAIN mark")
    write(f"{BRAND}/gain-mark.svg", mark)

    # 2. iOS 1024, no transparency (flat ink)
    png(f"{BRAND}/ios-icon-1024.png", master, 1024); flatten_ink(f"{BRAND}/ios-icon-1024.png")
    Image.open(f"{BRAND}/ios-icon-1024.png").convert("RGB").save(f"{BRAND}/ios-icon-1024.png")

    A = MOBILE_ASSETS
    # 3. legacy/Expo icon.png (opaque)
    png(f"{A}/icon.png", master, 1024); flatten_ink(f"{A}/icon.png")
    # 4. Android adaptive foreground: transparent, mark inside 66% safe zone (circle d=676 of 1024)
    #    bounding radius of the mark around the bbox centre ~ 181 logo units -> scale 1.9 keeps <= 338px
    fg = svg(1024, 1.9, bg=None, title="GAIN adaptive foreground")
    png(f"{A}/adaptive-icon-foreground.png", fg, 1024)
    # background layer solid ink (also referenced as backgroundColor in app.json)
    Image.new("RGB", (1024, 1024), (0x10, 0x12, 0x0E)).save(f"{A}/adaptive-icon-background.png")
    # monochrome (themed icons): flat white silhouette, transparent
    # no groove rings: at themed-icon size (~48 dp) the 2-3 px rings close up (identity spec: small monochrome variants drop the ring strokes)
    mono = svg(1024, 1.9, bg=None, fill="#ffffff", grooves=False, title="GAIN monochrome")
    png(f"{A}/adaptive-icon-monochrome.png", mono, 1024)
    # 5. splash image (centred mark on ink; app.json sets backgroundColor #10120E (ink))
    splash = svg(1024, 1.5)
    png(f"{A}/splash-icon.png", splash, 1024); flatten_ink(f"{A}/splash-icon.png")
    # 6. notification icon: 96px white-on-transparent, mark fills ~88px
    note = svg(96, 96 * 0.92 / (BBOX_BOT - BBOX_TOP), bg=None, fill="#ffffff", grooves=False, title="GAIN notification")
    png(f"{A}/notification-icon.png", note, 96)
    # 7. in-app logo PNG @1x/2x/3x (transparent) + favicon
    base = svg(512, mscale, bg=None, title="GAIN mark")
    for suffix, px in (("", 48), ("@2x", 96), ("@3x", 144)):
        png(f"{A}/gain-logo{suffix}.png", base, px)
    png(f"{A}/favicon.png", master, 48); flatten_ink(f"{A}/favicon.png")
    # brand copies
    for n in ("icon.png", "adaptive-icon-foreground.png", "adaptive-icon-monochrome.png", "splash-icon.png", "notification-icon.png"):
        Image.open(f"{A}/{n}").save(f"{BRAND}/{n}")
    print("brand assets written")

if __name__ == "__main__":
    main()
