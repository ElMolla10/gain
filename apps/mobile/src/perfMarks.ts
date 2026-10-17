import { createPerfMarks } from "./logic/perfMarks";

/** The app's one timings buffer (logic/perfMarks.ts). DeveloperModeProvider turns it on/off; App.tsx attaches the file store. */
export const perfMarks = createPerfMarks();
export const perfMark = (name: string, ms: number) => perfMarks.mark(name, ms);
export const perfNow = (): number => (typeof performance !== "undefined" ? performance.now() : Date.now());
