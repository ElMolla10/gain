import type { SeedExercise } from "../db/seedData";

/** The sheet a native Egyptian lifter or trainer fills in. Generated from the library, so it can never drift from the app. */
export function reviewSheetMarkdown(list: SeedExercise[]): string {
  const rows = list
    .map((e, i) => `| ${i + 1} | ${e.key} | ${e.en} | ${e.ar} | ${e.aliasesAr.join("، ")} | | | |`)
    .join("\n");
  return `# Arabic names and aliases: review sheet (DRAFT)

**Status: no sign-off is recorded on this sheet.** Every Arabic name and alias below began as my draft (literal or transliterated). Reported OK by Mohamed 2026-10-03 (on his word): he reviewed the Arabic and it looks good; reviewer identity and scope not recorded, and no per-row verdicts are in this file. Two native Egyptian lifters or trainers must still sign off before any "draft" label is removed (MASTER-PLAN Step 8). This file is generated from \`apps/mobile/src/db/seedData.ts\` and \`libraryDraft.ts\` (\`npm run review-sheet -w apps/mobile\`); a test fails if it is out of date.

## How to review
For each row, write one of: **OK**, **change to: ...**, **remove**. Add the words you really use in your gym that are missing from "Aliases". Say which city you train in: slang differs. Do not copy names from a book or site you cannot share.

| # | Key | English | Arabic name (draft) | Aliases (draft) | Verdict | Your wording | City / notes |
|---|-----|---------|---------------------|-----------------|---------|--------------|--------------|
${rows}

## Sign-off
| Reviewer | City / gym | Date | Verdict on the whole sheet |
|----------|------------|------|----------------------------|
| | | | |
| | | | |
`;
}
