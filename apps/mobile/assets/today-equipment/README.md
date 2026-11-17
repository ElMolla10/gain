# Today equipment assets

Two reusable, unnumbered transparent WebP cutouts, generated with OpenAI image generation for this feature. The supplied Today mockups were visual references for equipment only.

- `dumbbell.webp`: 1024 x 426, 77,804 bytes. One rubber hex dumbbell, reused for a separated pair or a single object.
- `stack-plate.webp`: 1024 x 103, 26,398 bytes. One beveled iron plate, repeated with native SVG rods, holes, selector and tether.

Art direction / generation prompts:

- Dumbbell: realistic isolated premium matte black rubber hex dumbbell in a slight three-quarter view; thick beveled hex heads, chrome collars and visibly knurled steel grip; front right face blank for a dynamic weight stamp; transparent background, no text, logo, numerals, floor or shadow halo.
- Stack plate: one long thin dark cast-iron selectorized weight plate, slight three-quarter view with visible right-hand depth, beveled edges and restrained highlights; no holes, rods, pin, text or numbers; transparent background, no floor.

The generated cutouts were alpha-trimmed, resized and encoded locally using Sharp. No per-weight bitmap, network dependency or reference screenshot ships in the UI. The pin and tether use SVG rather than the unused generated pin explorations.

`EquipmentArt.tsx` overlays the exact Today formatter output. `equipmentSources.ts` statically imports both assets and preloads them during boot. The app retains its 132 dp / large-text 96 dp art slot. RTL changes surrounding text direction, never the object or stamp.
