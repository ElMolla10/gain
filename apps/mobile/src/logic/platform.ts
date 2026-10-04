import type { StringKey } from "../i18n/strings";

/**
 * Text that names the phone's own system (share sheet, backups) has an iOS twin, stored under the same key plus ".ios". Android keeps the
 * original key, so Android text is unchanged. Pure: the caller passes `Platform.OS`.
 */
export type OsTextKey = "privacy.leaves.share" | "privacy.leaves.backup" | "privacy.control.body" | "data.delete.warn";

export const OS_TEXT_KEYS: readonly OsTextKey[] = ["privacy.leaves.share", "privacy.leaves.backup", "privacy.control.body", "data.delete.warn"];

export const osTextKey = (key: OsTextKey, os: string): StringKey => (os === "ios" ? (`${key}.ios` as StringKey) : key);
