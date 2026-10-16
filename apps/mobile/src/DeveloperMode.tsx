import React, { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { useServices } from "./AppContext";
import { diagnostics } from "./diagnostics";
import { createDeveloperMode } from "./logic/developerMode";

const Context = createContext<ReturnType<typeof createDeveloperMode> | null>(null);
export function DeveloperModeProvider({ children }: { children: React.ReactNode }) {
  const { repos } = useServices();
  const store = useMemo(() => createDeveloperMode(repos), [repos]);
  useEffect(() => { void store.load().catch(error => diagnostics.record("warn", "load developer mode", error)); }, [store]);
  return <Context.Provider value={store}>{children}</Context.Provider>;
}
export function useDeveloperMode() {
  const store = useContext(Context);
  if (!store) throw new Error("useDeveloperMode outside provider");
  return { ...useSyncExternalStore(store.subscribe, store.getSnapshot), setEnabled: store.setEnabled };
}
