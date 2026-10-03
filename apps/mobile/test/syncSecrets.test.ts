import { describe, expect, it } from "vitest";
import { createSyncEngine } from "../src/sync/engine";
import { memorySecretStore, type SecretStore } from "../src/sync/secretStore";
import type { Transport } from "../src/sync/transport";
import { freshDb } from "./helpers";

const account: Transport = {
  request: async (method, path) => (method === "POST" && path === "/v1/account" ? { status: 200, json: { accountId: "acc1", deviceToken: "tok-secret", recoveryCode: "rec-secret" } } : { status: 404, json: null }),
};
const rows = async (db: Awaited<ReturnType<typeof freshDb>>["db"]) => (await db.all<{ id: string; value: string }>("SELECT id, value FROM sync_state")).map((r) => `${r.id}=${r.value}`).join("|");

describe("sync secrets live in secure storage, not SQLite", () => {
  it("a new account's token and recovery code go to the secret store and never into the database", async () => {
    const c = await freshDb();
    const secrets = memorySecretStore();
    const sync = createSyncEngine(c.db, c.deps, account, secrets);
    expect((await sync.ensureAccount()).ok).toBe(true);
    expect(await sync.token()).toBe("tok-secret");
    expect(await sync.getRecoveryCode()).toBe("rec-secret");
    expect(Object.values(secrets.dump())).toEqual(expect.arrayContaining(["tok-secret", "rec-secret"]));
    const stored = await rows(c.db);
    expect(stored).not.toContain("tok-secret");
    expect(stored).not.toContain("rec-secret");
    expect(stored).toContain("account_id=acc1"); // the non-secret account id stays
    // and they are not in a backup file either
    const backup = await c.data.exportJson();
    expect(backup).not.toContain("tok-secret");
    expect(backup).not.toContain("rec-secret");
  });

  it("values an older version left in the database are moved (verified) on first use", async () => {
    const c = await freshDb();
    await c.db.run("INSERT INTO sync_state (id, value) VALUES ('device_token', 'old-tok'), ('recovery_code', 'old-rec'), ('status', 'on')");
    const secrets = memorySecretStore();
    const sync = createSyncEngine(c.db, c.deps, account, secrets);
    expect(await sync.token()).toBe("old-tok");
    expect(secrets.dump()).toMatchObject({ device_token: "old-tok", recovery_code: "old-rec" });
    expect(await rows(c.db)).not.toMatch(/old-tok|old-rec/);
    expect(await sync.getRecoveryCode()).toBe("old-rec");
  });

  it("if the secure store fails, nothing is lost: the value stays in the database and still works", async () => {
    const c = await freshDb();
    const broken: SecretStore = {
      get: async () => {
        throw new Error("keystore unavailable");
      },
      set: async () => {
        throw new Error("keystore unavailable");
      },
      delete: async () => undefined,
    };
    const sync = createSyncEngine(c.db, c.deps, account, broken);
    expect((await sync.ensureAccount()).ok).toBe(true);
    expect(await sync.token()).toBe("tok-secret");
  });

  it("clearing sync on this phone removes the secrets too", async () => {
    const c = await freshDb();
    const secrets = memorySecretStore();
    const sync = createSyncEngine(c.db, c.deps, account, secrets);
    await sync.ensureAccount();
    await sync.clearLocal();
    expect(secrets.dump()).toEqual({});
    expect(await sync.token()).toBeNull();
  });
});
