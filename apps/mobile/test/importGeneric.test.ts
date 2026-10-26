import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { arImport, enImport } from "../src/i18n/strings.import";

const APPS = /hevy|strong\b|fitnotes/i;

describe("import screen is app-neutral and CSV-only", () => {
  it("no import string (EN or AR) names another app", () => {
    for (const v of [...Object.values(enImport), ...Object.values(arImport)]) expect(v).not.toMatch(APPS);
  });
  it("entry reads 'Import from any app you previously used'", () => {
    expect(enImport["import.entry"]).toBe("Import from any app you previously used");
  });
  it("the rejection message says which formats work", () => {
    expect(enImport["import.unsupported"]).toMatch(/CSV/);
    expect(enImport["import.unsupported"]).toMatch(/exercise, date, weight and reps/);
    expect(arImport["import.unsupported"]).toMatch(/CSV/);
  });
  it("the picker has no wildcard and the screen checks the file before parsing", () => {
    const src = readFileSync(join(__dirname, "../src/screens/ImportScreen.tsx"), "utf8");
    expect(src).not.toContain('"*/*"');
    expect(src).toContain("IMPORT_MIME_TYPES");
    expect(src.indexOf("checkImportFile(")).toBeLessThan(src.indexOf("parseImport(text)"));
  });
});
