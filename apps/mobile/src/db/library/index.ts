import { ARMS } from "./arms";
import { CORE } from "./core";
import { LOWER } from "./lower";
import type { CatalogEntry } from "./types";
import { UPPER } from "./upper";

export * from "./types";
export const HEVY_STYLE_LIBRARY: CatalogEntry[] = [...UPPER, ...ARMS, ...LOWER, ...CORE];
