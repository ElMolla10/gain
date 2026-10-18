// Rack glyphs (design pack svg/glyphs): 24 dp, 1.7 stroke, round caps, at most 6 paths each. Art: never mirrors.
export const RACK_GLYPHS = {
  assisted: ["M7 7h10v15H7z", "M7 11h10", "M7 15h10", "M12 2v5", "m4 4 3-2 3 2"],
  barbell: ["M2 12h20", "M5 7v10", "M8 5v14", "M16 5v14", "M19 7v10"],
  body: ["M12 5.5a2 2 0 1 0 0-.1", "M12 8v7", "m8 21 4-6 4 6", "M7 11h10"],
  cable: ["M12 2v5", "M7 7h10v15H7z", "M7 11h10", "M7 15h10", "M17 13h3"],
  dumbbell: ["M8 12h8", "M4 8.5v7", "M6.5 6.5v11", "M17.5 6.5v11", "M20 8.5v7"],
  machine: ["M4 21V4h7v17", "M4 9h7", "M4 13h7", "M14 15h6", "M17 15v6", "M14 9v6"],
  plate: ["M4 3v18", "M4 12h16", "M9 6v12", "M12 8v8"],
} as const;
export type RackGlyphName = keyof typeof RACK_GLYPHS;
