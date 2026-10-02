#!/usr/bin/env python3
"""Render the SVG geometry at the original JPEG's pixel grid and diff against it."""
import os, sys, io
import numpy as np, cairosvg
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(__file__))
import build_brand as B

ORIG = os.path.join(B.BRAND, "gain-logo-original.jpg")
DX, DY = 640.2, 356.7   # disc centre in the original (SVG coords: pixel-index fit + 0.5)

def render_like_original():
    T = lambda x, y: (DX + x, DY + y)
    d = B.mark_path(T, 1.0)
    grad = (f'<linearGradient id="l" gradientUnits="userSpaceOnUse" x1="0" y1="{DY+B.LIME[0][0]}" x2="0" y2="{DY+B.LIME[-1][0]}">'
            + "".join(f'<stop offset="{(y-B.LIME[0][0])/(B.LIME[-1][0]-B.LIME[0][0]):.3f}" stop-color="{c}"/>' for y, c in B.LIME) + '</linearGradient>')
    s = f'<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><defs>{grad}</defs><rect width="1280" height="720" fill="#000"/><path fill-rule="evenodd" fill="url(#l)" d="{d}"/></svg>'
    png = cairosvg.svg2png(bytestring=s.encode())
    return Image.open(io.BytesIO(png)).convert("RGB")

def main(out):
    o = Image.open(ORIG).convert("RGB")
    r = render_like_original()
    box = (440, 160, 840, 540)
    oc, rc = o.crop(box), r.crop(box)
    oa, ra = np.array(oc).astype(int), np.array(rc).astype(int)
    om, rm = oa[:, :, 1] > 100, ra[:, :, 1] > 100
    iou = (om & rm).sum() / (om | rm).sum()
    mad = np.abs(oa - ra).mean()
    print(f"green-mask IoU {iou:.4f}  mean abs RGB diff {mad:.2f}  mismatched px {(om ^ rm).sum()} of {om.sum()}")
    diff = Image.fromarray((np.abs(oa - ra).sum(2).clip(0, 255) ).astype("uint8")).convert("RGB")
    k = 2
    tiles = [im.resize((im.width * k, im.height * k), Image.LANCZOS) for im in (oc, rc, diff)]
    W = sum(t.width for t in tiles) + 40 * 4
    H = tiles[0].height + 110
    canvas = Image.new("RGB", (W, H), (24, 24, 24))
    dr = ImageDraw.Draw(canvas)
    x = 40
    for t, lab in zip(tiles, ("ORIGINAL (gain-avatar.jpg)", "RECREATION (gain-logo.svg)", "ABS DIFF (white = mismatch)")):
        canvas.paste(t, (x, 70)); dr.text((x, 30), lab, fill=(240, 240, 240)); x += t.width + 40
    dr.text((40, H - 25), f"green-mask IoU {iou:.4f} | mean |dRGB| {mad:.2f}", fill=(173, 255, 47))
    canvas.save(out)
    return iou, mad

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "/workspace/next-set/logo-compare.png")
