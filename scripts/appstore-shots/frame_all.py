#!/usr/bin/env python3
"""Frame every raw capture from scripts/ios-screenshots.sh with the DRAFT captions in captions.py.
Reads screenshots/<lang>/6.9/<id>.png, writes screenshots/framed/<id>-<lang>-6.9.png and -6.5.png (exact App Store sizes).
Refuses anything that looks like a design placeholder: only real captures may be uploaded."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from shots import render
from captions import SHOTS
root = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'screenshots')
out = os.path.join(root, 'framed'); os.makedirs(out, exist_ok=True)
missing = []
for sid, _scene, en_h, en_s, ar_h, ar_s in SHOTS:
    for lang, head, sub in (('en', en_h, en_s), ('ar', ar_h, ar_s)):
        raw = os.path.join(root, lang, '6.9', sid + '.png')
        if 'placeholder' in raw.lower(): sys.exit('refusing a placeholder image: ' + raw)
        if not os.path.exists(raw): missing.append(raw); continue
        print(render(raw, head, sub, lang, os.path.join(out, f'{sid}-{lang}')))
if missing: print('missing captures (not framed):', *missing, sep='\n  ')
