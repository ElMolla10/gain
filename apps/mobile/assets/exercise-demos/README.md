# Exercise illustrations

The bundled still illustrations are sourced from [Open Exercise Illustrations](https://github.com/MarvinNazari/exercise-images), release 1.0.0. The source project and images are dedicated to the public domain under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).

GAIN ships only the starting-position WebP images it uses, with stable GAIN exercise seed keys mapped explicitly in `src/logic/exerciseDemos.ts`. Images are stored locally and available offline. Unmatched exercise variants intentionally have no demo action.

The source project describes the illustrations as AI-generated and not reviewed by a qualified coach or medical professional. They are visual references, not form or medical advice; exercise matches should remain specific to the pictured equipment and movement.

GAIN adds static, individually positioned motion arrows in `src/logic/exerciseDemoMotion.ts`. These local SVG overlays use the original image's dimensions and the same contain fitting as the still; they do not animate, download media, or mirror when the interface is RTL. The original WebPs and CC0 attribution remain unchanged. See [MOTION-REVIEW.md](MOTION-REVIEW.md) for the per-exercise review and the illustrations intentionally left without arrows.
