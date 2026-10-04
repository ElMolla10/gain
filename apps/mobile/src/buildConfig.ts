import Constants from "expo-constants";
import { readBuildFlags, type BuildFlags } from "./logic/buildFlags";
import { templatePool, type Template } from "./logic/templates";

/** Read once from the app's own config (written at build time by app.config.js). */
export const buildFlags: BuildFlags = readBuildFlags(Constants.expoConfig?.extra);

/** The templates the pickers may offer: all of them, or the six pilot programs in a pilot build. */
export const activeTemplates = (): Template[] => templatePool(buildFlags.pilotTemplateIds);
