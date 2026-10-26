import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkImportFile, IMPORT_MIME_TYPES, parseImport } from "./index";

const fx = (n: string) => readFileSync(new URL(`../../../fixtures/${n}`, import.meta.url), "utf8");

describe("import file guard", () => {
  it("accepts every supported export layout", () => {
    expect(checkImportFile("export.csv", fx("hevy-export.csv"))).toEqual({ ok: true, known: true });
    expect(checkImportFile("x.csv", fx("strong-synthetic.csv"))).toEqual({ ok: true, known: true });
    expect(checkImportFile("x.csv", fx("strong-synthetic-v6.csv"))).toEqual({ ok: true, known: true });
    expect(checkImportFile("log.CSV", "Date,Exercise,Category,Weight (kg),Reps\n2026-01-02,Bench,Chest,60,8\n")).toEqual({ ok: true, known: true });
    expect(checkImportFile("sheet.txt", "exercise;date;weight;reps\nBench;2026-01-02;60;8\n")).toEqual({ ok: true, known: true });
  });
  it("sends an unknown CSV layout to column matching, not a rejection", () => {
    expect(checkImportFile("odd.csv", "Lift,When,Kilos,Count\nBench,2026-01-02,60,8\n")).toEqual({ ok: true, known: false });
    expect(checkImportFile("noext", "Lift,When,Kilos,Count\nBench,2026-01-02,60,8\n")).toEqual({ ok: true, known: false });
  });
  it("rejects files that are not CSV by extension", () => {
    for (const n of ["log.xlsx", "log.xls", "backup.json", "a.pdf", "a.png", "a.zip", "a.fit"]) expect(checkImportFile(n, "exercise,date,weight,reps\n")).toEqual({ ok: false, problem: "extension" });
  });
  it("rejects binary, JSON, empty and single-column content", () => {
    expect(checkImportFile("a.csv", "PK\u0003\u0004rest")).toEqual({ ok: false, problem: "binary" });
    expect(checkImportFile("a.csv", "abc\u0000def")).toEqual({ ok: false, problem: "binary" });
    expect(checkImportFile("a.txt", '{"workouts":[]}')).toEqual({ ok: false, problem: "json" });
    expect(checkImportFile("a.txt", "  [1,2]")).toEqual({ ok: false, problem: "json" });
    expect(checkImportFile("a.csv", "\uFEFF  \n")).toEqual({ ok: false, problem: "empty" });
    expect(checkImportFile("a.txt", "just some notes\nbench 60x8\n")).toEqual({ ok: false, problem: "notCsv" });
  });
  it("offers no wildcard type to the picker", () => {
    expect(IMPORT_MIME_TYPES as readonly string[]).not.toContain("*/*");
  });
  it("parse error for an unknown layout names no other app", () => {
    expect(() => parseImport("Lift,When\nBench,2026\n")).toThrow(/supported workout export/);
    try { parseImport("Lift,When\nBench,2026\n"); } catch (e) { expect((e as Error).message).not.toMatch(/hevy|strong|fitnotes/i); }
  });
});
