import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { groupCode, normalizeCode } from "../src/logic/recoveryCodeText";

describe("recovery code text (1.8)", () => {
  it("groups in fours with thin spaces and no trailing space", () => {
    expect(groupCode("ABCDEFGHIJ")).toBe("ABCD\u2009EFGH\u2009IJ");
    expect(groupCode("ABCDEFGH")).toBe("ABCD\u2009EFGH");
  });
  it("regroups the server's dashed code", () => {
    expect(groupCode("ABCD-EFGH-JKMN-PQRS-TUVW")).toBe("ABCD\u2009EFGH\u2009JKMN\u2009PQRS\u2009TUVW");
  });
  it("strips spaces, thin spaces, NBSP and isolates on entry", () => {
    expect(normalizeCode(" AB CD\u2009EF\u00A0GH\u2066IJ\u2069\n")).toBe("ABCDEFGHIJ");
  });
  it("round-trips", () => {
    for (const x of ["ABCDEFGHIJ", "ABCDEFGHJKMNPQRSTUVW", "A"]) expect(normalizeCode(groupCode(x))).toBe(x);
  });
  it("SyncScreen shows the grouped code in a well and sends the normalised entry", () => {
    const src = readFileSync(join(__dirname, "../src/screens/SyncScreen.tsx"), "utf8");
    expect(src).toContain("groupCode(code)");
    expect(src).toContain("normalizeCode(recoveryCode)");
    expect(src).toContain('t("sync.code.copyHint")');
    expect(src).not.toContain("recoveryCode?.trim()");
  });
});
