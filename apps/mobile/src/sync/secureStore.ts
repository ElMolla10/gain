import * as SecureStore from "expo-secure-store";
import type { SecretStore } from "./secretStore";

/** The phone's secure storage (Android Keystore-backed). Keys are namespaced; values never go into the database, backups or diagnostics. */
export function createSecureStoreSecrets(): SecretStore {
  const k = (key: string) => `gain.sync.${key}`;
  return {
    get: (key) => SecureStore.getItemAsync(k(key)),
    set: (key, value) => SecureStore.setItemAsync(k(key), value),
    delete: (key) => SecureStore.deleteItemAsync(k(key)),
  };
}
