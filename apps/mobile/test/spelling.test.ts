import { describe, expect, it } from "vitest";
import { TEMPLATES } from "../src/logic/templates";
import { ar, en } from "../src/i18n/strings";

/** v0.19.0: the product spells it "program" (US), everywhere a lifter reads English. Internal names (DB tables, ids, route names, sync tables) keep the old spelling on purpose. */
/** `{programmes}` is a placeholder name filled from the data counts (an internal key), not text. */
const visible = (v: unknown) => String(v).replace(/\{[A-Za-z]+\}/g, "");

describe("spelling: program, not programme, in everything a lifter reads", () => {
  it("no English UI string says programme / programmes", () => {
    const bad = Object.entries(en).filter(([, v]) => /programme/i.test(visible(v))).map(([k]) => k);
    expect(bad).toEqual([]);
  });
  it("the English strings really use 'program' (not removed), and Arabic strings never contain a Latin 'programme'", () => {
    expect(en["tab.programme"]).toBe("Plan");
    expect(en["prog.title"]).toBe("Program");
    expect(Object.values(ar).some((v) => /programme/i.test(visible(v)))).toBe(false);
  });
  it("template names and day names carry no 'programme'", () => {
    for (const t of TEMPLATES) {
      expect(/programme/i.test(t.en), t.id).toBe(false);
      for (const d of t.schedule) expect(/programme/i.test(d.en), `${t.id}/${d.en}`).toBe(false);
    }
  });
});
