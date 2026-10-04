# Play listing assets (DRAFT)

| File | What | State |
| --- | --- | --- |
| `icon-512.png` | App icon at 512 x 512 (resized from `apps/mobile/assets/icon.png`, 1024 px RGB) | Ready to upload as a draft; **check Play's current icon rules** (32-bit PNG, size limit) at upload; the file is RGB without alpha |
| `feature-graphic-en-draft.png`, `feature-graphic-ar-draft.png` | 1024 x 500 feature graphic drafts: brand tagline "Your next weight. Ready." (Arabic draft: "وزنك الجاي. جاهز.") on the charcoal/lime identity, logo, "Free lifting log". No phone mock-up and no claim beyond the in-app tagline | Draft; the Arabic line is a builder's draft nobody native has read |
| `feature-graphic.html` | Template for the two PNGs: replace `LANG` (`ltr` / `rtl`), `TAG` and `SUB`, then `google-chrome --headless=new --no-sandbox --allow-file-access-from-files --window-size=1024,500 --screenshot=out.png file://$PWD/that.html` | |
| screenshots | **None.** Real phone screenshots are required (G4) and need a phone: see [../PLAY-ASSETS.md](../PLAY-ASSETS.md) for the shot list | Mohamed's phone |

The design-system web renders in `docs/design-screens/` are **not** phone screenshots and must not be uploaded as such.
