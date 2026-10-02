import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { ALL_LIBRARY } from "../src/db/libraryDraft";
import { reviewSheetMarkdown } from "../src/logic/reviewSheet";

writeFileSync(join(__dirname, "../../../docs/ARABIC-REVIEW-SHEET.md"), reviewSheetMarkdown(ALL_LIBRARY));
console.log("wrote docs/ARABIC-REVIEW-SHEET.md");
