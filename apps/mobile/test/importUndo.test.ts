import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { translate } from "../src/i18n/format";
import { runUndo, undoConfirmText } from "../src/logic/importUndo";
import { parseImport } from "@gain/engine";
import type { MappingChoice } from "../src/db/importRepo";
import { freshDb } from "./helpers";

const LRI = "\u2066", PDI = "\u2069";
const src = (f: string) => readFileSync(join(__dirname, "../src", f), "utf8");

describe("Undo import: confirm, busy guard, errors (batch item 26)", () => {
  it("confirm text in EN and AR with numbers isolated", () => {
    const en = undoConfirmText({ workouts: 12, sets: 140 }, (k, p) => translate("en", k, p));
    expect(en.title).toBe("Remove this import?");
    expect(en.body).toBe(`This removes ${LRI}12${PDI} imported workouts and ${LRI}140${PDI} sets from your history. Your own logged workouts are not touched.`);
    const ar = undoConfirmText({ workouts: 12, sets: 140 }, (k, p) => translate("ar", k, p));
    expect(ar.title).toBe("تشيل الاستيراد ده؟");
    expect(ar.body).toContain(`${LRI}12${PDI} تمرين مستورد`);
    expect(ar.body).toContain(`${LRI}140${PDI} مجموعة`);
  });

  it("undoing the same batch twice throws in the repo; the screen helper catches it", async () => {
    const c = await freshDb();
    await c.repos.seedIfNeeded();
    const gymId = (await c.repos.getActiveGymId())!;
    const parse = parseImport(readFileSync(join(__dirname, "../../../fixtures/hevy-export.csv"), "utf8"));
    const prev = await c.imports.preview(parse);
    const mappings: Record<string, MappingChoice> = {};
    for (const t of prev.titles) {
      const g = t.suggestion;
      mappings[t.title] = g.kind === "new" ? { kind: "new", nameEn: g.nameEn, pattern: g.pattern, equipment: g.equipment ?? "cable", setup: g.setup ?? "free" } : { kind: "existing", exerciseId: g.exerciseId };
    }
    const done = await c.imports.importHistory({ parse, gymId, mappings });
    const first = await c.imports.undoBatch(done.batchId!);
    expect(first.workouts).toBe(done.workouts);
    await expect(c.imports.undoBatch(done.batchId!)).rejects.toThrow("Unknown import");
    const onError = vi.fn();
    await expect(runUndo(() => c.imports.undoBatch("missing"), onError)).resolves.toBeNull();
    expect(onError).toHaveBeenCalledOnce();
    await expect(runUndo(() => Promise.reject(new Error("x")), () => { throw new Error("y"); })).resolves.toBeNull();
    await expect(runUndo(() => Promise.resolve({ workouts: 1, sets: 2 }), onError)).resolves.toEqual({ workouts: 1, sets: 2 });
  });

  it("buttons are disabled while busy, undo is confirmed and guarded, dead block gone", () => {
    const hero = src("components/vault/ImportBatchHero.tsx");
    expect(hero).toContain("disabled={busy}");
    expect(hero).toContain("formatDay(b.createdAt, lang)");
    expect(hero).toContain("isolateLtr(b.fileName)");
    expect(hero).not.toContain("toISOString");
    const screen = src("screens/ImportScreen.tsx");
    expect(screen).not.toContain("false &&");
    expect(screen).toContain('style: "destructive", onPress: () => void undo(batchId)');
    expect(screen).toContain("if (undoing.current) return;");
    expect(screen).toContain('disabled={!!busy} onPress={() => confirmUndo(result.batchId!, result)}');
    expect(screen).not.toMatch(/onPress=\{\(\) => void undo\(/);
  });
});
