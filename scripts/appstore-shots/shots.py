#!/usr/bin/env python3
"""GAIN App Store screenshot composer (from the GAIN designer, /workspace/plate/appstore). Needs Pillow and Google Chrome (or CHROME=path).
Never upload output made with --placeholder; real simulator captures only.
Usage:  python3 shots.py RAW.png "Headline" "Subline" --lang en|ar --out OUTPREFIX [--placeholder] [--theme dark|light]
Writes OUTPREFIX-6.9.png (1320x2868) and OUTPREFIX-6.5.png (1284x2778). RAW should be a real iPhone/simulator capture
(ideally 1320x2868 from a 6.9" device); any portrait capture is scaled to the screenshot width and cropped at the bottom.
"""
import argparse, os, subprocess, tempfile, html
from PIL import Image
A=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..','apps','mobile','assets','fonts')+'/'
import shutil, sys
CHROME=os.environ.get('CHROME') or ('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' if sys.platform=='darwin' else shutil.which('google-chrome') or 'chromium')
TOK=dict(ink='#10120E', surface='#1B1F17', raised='#242A1F', border='#414A36', text='#F5F6EF', muted='#B2B9A6', lime='#B7F51B',
         lbg='#F5F6EF', lsurface='#FFFFFF', ltext='#171C12', lmuted='#526047', lborder='#7A876E', lacc='#3C5700')
# Layout in px at the 6.9" canvas (1320 wide). 6.5" = every value x 1284/1320 (0.9727), height 2778.
L69=dict(W=1320, H=2868, margin=96, cap_top=150, bar_w=96, bar_h=12, head=96, head_lh=108, sub=50, sub_lh=68, gap=28,
         shot_top=700, shot_w=1104, radius=150, stroke=4)
AR_ADJ=dict(head=92, head_lh=132, sub=48, sub_lh=80)   # Plex Sans Arabic needs taller line height
SIZES={'6.9':(1320,2868),'6.5':(1284,2778)}
def css_px(v,k): return f'{v*k:.1f}px'
def build(raw, head, sub, lang, theme, placeholder, size):
    W,H=SIZES[size]; k=W/1320; L=dict(L69); 
    if lang=='ar': L.update(AR_ADJ)
    dark=theme=='dark'
    bg=TOK['ink'] if dark else TOK['lbg']; fg=TOK['text'] if dark else TOK['ltext']; mu=TOK['muted'] if dark else TOK['lmuted']
    acc=TOK['lime'] if dark else TOK['lacc']; edge=TOK['border'] if dark else TOK['lborder']
    rtl=lang=='ar'; fam="'PlexAr','Plex'" if rtl else "'Plex'"
    im=Image.open(raw); sw=L['shot_w']*k; sh=sw*im.height/im.width
    ph=(f'<div style="position:absolute;left:0;right:0;top:{css_px(L["shot_top"]+40,k)};text-align:center;z-index:5"><span style="background:#FF2E88;color:#fff;font:700 {css_px(40,k)} Plex;padding:{css_px(10,k)} {css_px(24,k)};border-radius:{css_px(12,k)};direction:ltr">PLACEHOLDER · design mockup, not an app capture</span></div>' if placeholder else '')
    return f'''<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{{font-family:Plex;src:url(file://{A}IBMPlexSans_400Regular.ttf);font-weight:400}}
@font-face{{font-family:Plex;src:url(file://{A}IBMPlexSans_600SemiBold.ttf);font-weight:600}}
@font-face{{font-family:PlexAr;src:url(file://{A}IBMPlexSansArabic_400Regular.ttf);font-weight:400}}
@font-face{{font-family:PlexAr;src:url(file://{A}IBMPlexSansArabic_700Bold.ttf);font-weight:700}}
html,body{{margin:0;width:{W}px;height:{H}px;overflow:hidden;background:{bg}}}
.c{{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 38%, {TOK["surface"] if dark else "#FFFFFF"} 0%, {bg} 62%)}}
.cap{{position:absolute;top:{css_px(L["cap_top"],k)};left:{css_px(L["margin"],k)};right:{css_px(L["margin"],k)};direction:{"rtl" if rtl else "ltr"};text-align:start;font-family:{fam}}}
.bar{{width:{css_px(L["bar_w"],k)};height:{css_px(L["bar_h"],k)};border-radius:99px;background:{acc};margin-bottom:{css_px(40,k)}}}
.h{{color:{fg};font-size:{css_px(L["head"],k)};line-height:{css_px(L["head_lh"],k)};font-weight:{700 if rtl else 600};letter-spacing:{"0" if rtl else "-0.01em"};text-wrap:balance}}
.s{{color:{mu};font-size:{css_px(L["sub"],k)};line-height:{css_px(L["sub_lh"],k)};font-weight:400;margin-top:{css_px(L["gap"],k)};text-wrap:pretty}}
.shot{{position:absolute;left:{(W-sw)/2:.1f}px;top:{css_px(L["shot_top"],k)};width:{sw:.1f}px;height:{sh:.1f}px;border-radius:{css_px(L["radius"],k)};overflow:hidden;
      box-shadow:0 0 0 {css_px(L["stroke"],k)} {edge}, 0 {css_px(30,k)} {css_px(90,k)} rgba(0,0,0,{.55 if dark else .18})}}
.shot img{{width:100%;display:block}}
</style></head><body><div class="c"></div>
<div class="cap"><div class="bar"></div><div class="h">{html.escape(head)}</div>{f'<div class="s">{html.escape(sub)}</div>' if sub else ''}</div>
<div class="shot"><img src="file://{os.path.abspath(raw)}"></div>{ph}</body></html>'''
def render(raw, head, sub, lang, out, theme='dark', placeholder=False):
    outs=[]
    for size,(W,H) in SIZES.items():
        h=build(raw,head,sub,lang,theme,placeholder,size)
        with tempfile.NamedTemporaryFile('w',suffix='.html',delete=False) as f: f.write(h); p=f.name
        png=f'{out}-{size}.png'
        subprocess.run([CHROME,'--headless=new','--no-sandbox','--hide-scrollbars','--disable-gpu','--force-device-scale-factor=1',
                        '--allow-file-access-from-files',f'--window-size={W},{H}',f'--screenshot={png}',f'file://{p}'],check=True,capture_output=True)
        os.remove(p); im=Image.open(png).convert('RGB'); assert im.size==(W,H),(im.size,W,H); im.save(png)  # opaque RGB, exact size
        outs.append(png)
    return outs
if __name__=='__main__':
    ap=argparse.ArgumentParser(); ap.add_argument('raw'); ap.add_argument('head'); ap.add_argument('sub',nargs='?',default='')
    ap.add_argument('--lang',default='en'); ap.add_argument('--out',required=True); ap.add_argument('--theme',default='dark'); ap.add_argument('--placeholder',action='store_true')
    a=ap.parse_args(); print(render(a.raw,a.head,a.sub,a.lang,a.out,a.theme,a.placeholder))
