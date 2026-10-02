import React, { createContext, useContext } from "react";
import type { Repos } from "./db/repos";
import type { Db } from "./db/driver";

export interface AppServices {
  db: Db;
  repos: Repos;
}
const Ctx = createContext<AppServices | null>(null);
export const ServicesProvider = Ctx.Provider;
export function useServices(): AppServices {
  const v = useContext(Ctx);
  if (!v) throw new Error("useServices outside provider");
  return v;
}
