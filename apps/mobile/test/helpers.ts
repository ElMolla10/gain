import { randomUUID } from "node:crypto";
import type { Deps } from "../src/db/driver";
import { migrate } from "../src/db/migrations";
import { createRepos } from "../src/db/repos";
import { openNodeDb } from "./nodeDriver";

export function testDeps(start = 1_700_000_000_000): Deps & { tick: (ms?: number) => void } {
  let t = start;
  return { newId: () => randomUUID(), now: () => t, tick: (ms = 1000) => void (t += ms) };
}

export async function freshDb() {
  const db = openNodeDb();
  await migrate(db);
  const deps = testDeps();
  const repos = createRepos(db, deps);
  return { db, deps, repos };
}
