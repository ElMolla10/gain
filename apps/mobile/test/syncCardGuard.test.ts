import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { onceAtATime } from "../src/logic/onceAtATime";

const src = (f: string) => readFileSync(join(__dirname, "../src", f), "utf8");

describe("Cloud Sync card: busy guard, no recovery code (batch item 27)", () => {
  it("onceAtATime: a second call while the first is pending returns the same promise and does not run", async () => {
    const gate = onceAtATime();
    let runs = 0;
    let release!: () => void;
    const job = () => { runs++; return new Promise<string>((r) => { release = () => r("account"); }); };
    const a = gate(job);
    const b = gate(job);
    expect(b).toBe(a);
    expect(runs).toBe(1);
    release();
    await expect(a).resolves.toBe("account");
    // After it settles, the next call runs again; a failure frees the gate too.
    await expect(gate(() => Promise.reject(new Error("x")))).rejects.toThrow("x");
    await expect(gate(async () => 2)).resolves.toBe(2);
  });

  it("the card has no code prop and disables all three buttons while busy", () => {
    const card = src("components/vault/CloudSyncCard.tsx");
    expect(card).not.toMatch(/\bcode\b\s*[:,]/);
    expect(card).not.toContain("groupCode");
    expect(card.match(/disabled=\{busy\}/g)?.length).toBe(3);
    expect(card).toContain("formatDay(info.lastSyncAt, lang)");
    expect(card).not.toContain("toISOString");
  });

  it("SyncScreen passes busy, gates turnOn / syncNow / verifyEmail, and forgets the code when leaving the code step", () => {
    const s = src("screens/SyncScreen.tsx");
    expect(s).toContain("busy={!!busy}");
    expect(s).toContain("const turnOn = (recoveryCode?: string) => gate(() => turnOnNow(recoveryCode));");
    expect(s).toContain("const syncNow = () => gate(syncNowNow);");
    expect(s).toContain("const verifyEmail = () => gate(verifyEmailNow);");
    expect(s).toContain('label={t("sync.code.saved")} onPress={leaveCode}');
    expect(s).toMatch(/function leaveCode\(\) \{\s*setCode\(null\);\s*setStep\("idle"\);/);
    expect(s).not.toContain('onPress={() => setStep("idle")}');
  });
});
