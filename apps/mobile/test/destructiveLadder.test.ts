import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const src = (f: string) => readFileSync(join(__dirname, "../src", f), "utf8");

describe("destructive actions: one style ladder (plan 1.6)", () => {
  it("BigButton has a solid danger variant with the onDanger label", () => {
    const ui = src("ui.tsx");
    expect(ui).toContain('"danger" | "dangerSolid"');
    expect(ui).toContain('variant === "dangerSolid" ? p.onDanger');
    expect(ui).toContain('variant === "dangerSolid" ? (disabled && !props.loading ? p.disabled : p.danger)');
  });
  it("Data: first taps stay outlined, final confirms are solid with Cancel ≥16 dp before them", () => {
    const data = src("screens/DataScreen.tsx");
    expect(data).toContain('<BigButton variant="dangerSolid" label={t("data.restore.confirm")}');
    expect(data).toContain('<BigButton variant="dangerSolid" label={t("data.delete.ask")}');
    expect(data).toContain('<BigButton label={t("data.delete.first")} variant="danger"');
    expect(data.indexOf('t("data.restore.cancel")')).toBeLessThan(data.indexOf('t("data.restore.confirm")'));
    expect(data.indexOf('t("data.delete.cancel")')).toBeLessThan(data.indexOf('t("data.delete.ask")'));
    expect(data.match(/<View style=\{\{ gap: space\.lg \}\}>/g)?.length).toBe(2);
  });
  it("Session detail: no quiet delete; the per-set confirm is solid", () => {
    const sd = src("screens/SessionDetailScreen.tsx");
    expect(sd).not.toMatch(/variant="quiet" label=\{t\("history\.delete"\)\}/);
    expect(sd).toContain('<BigButton variant="danger" icon="trash" label={t("history.delete")}');
    expect(sd).toMatch(/variant="dangerSolid"\s+label=\{t\("history\.deleteYes"\)\}/);
  });
  it("Sync: 'turn off and delete' confirm is solid, with Cancel ≥16 dp before it; the first tap stays outlined", () => {
    const sync = src("screens/SyncScreen.tsx");
    expect(sync).toContain('<BigButton variant="dangerSolid" label={t("sync.offDelete.confirm")}');
    expect(sync).toContain('<BigButton label={t("sync.offDelete")} variant="danger"');
    const cancel = sync.indexOf('t("sync.offDelete.cancel")');
    const confirm = sync.indexOf('t("sync.offDelete.confirm")');
    expect(cancel).toBeLessThan(confirm);
    expect(sync.slice(sync.lastIndexOf("<View style={{ gap: space.lg }}>", cancel), confirm)).toContain('t("sync.offDelete.cancel")');
  });
  it("Programme editor: no danger Chip for removing a day", () => {
    const ed = src("components/ProgrammeEditorView.tsx");
    expect(ed).not.toContain('tone="danger" onPress={() => confirmRemoveDay');
    expect(ed).not.toMatch(/<Chip[^>]*prog\.day\.remove/);
    expect(ed).toContain('<QuietAction tone="danger" icon="trash" label={t("prog.day.remove")} onPress={() => confirmRemoveDay(di)} />');
  });
});
