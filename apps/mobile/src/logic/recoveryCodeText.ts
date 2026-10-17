/**
 * The sync recovery code as the lifter reads and types it (Plate ST-4). Display: groups of 4 separated by U+2009 (thin space).
 * Entry: every space, thin space, no-break space and bidi isolate mark is dropped before the code goes to the server, which also
 * ignores case and dashes (server normaliseRecoveryCode), so a code copied from the grouped display or typed with dashes both work.
 */
const THIN = "\u2009";
// Whitespace (incl. U+2009, U+00A0, U+202F) and the isolate / embedding marks a copy from an RTL screen can carry.
const INVISIBLE = /[\s\u00A0\u2009\u202F\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;

export function normalizeCode(input: string): string {
  return input.replace(INVISIBLE, "");
}

/** "ABCD-EFGH-JKMN" or "ABCDEFGHJKMN" → "ABCD EFGH JKMN" with thin spaces; no trailing space. */
export function groupCode(code: string): string {
  const chars = normalizeCode(code).replace(/-/g, "");
  return (chars.match(/.{1,4}/g) ?? []).join(THIN);
}
