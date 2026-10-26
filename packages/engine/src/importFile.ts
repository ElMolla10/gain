/**
 * Which files the history import accepts, checked before parsing.
 *
 * The importer reads one thing: a comma- or semicolon-separated text file (CSV) whose header row is either a recognised
 * workout-app set export or has exercise, date, weight and reps columns (any other layout goes to the column-matching step,
 * which still needs a CSV header). Everything else (spreadsheets, JSON, PDFs, images, archives) is refused up front.
 */
import { detectSource, csvHeaders } from "./importer";

/** File extensions the import picker accepts (lower case, with the dot). */
export const IMPORT_FILE_EXTENSIONS = [".csv", ".txt"] as const;

/**
 * MIME types offered to the system file picker. No wildcard: only CSV/plain text.
 * application/vnd.ms-excel is included because Android and Windows often label .csv files with it; the extension and
 * content checks below still reject a real .xls.
 */
export const IMPORT_MIME_TYPES = ["text/csv", "text/comma-separated-values", "application/csv", "text/plain", "application/vnd.ms-excel"] as const;

export type ImportFileProblem = "extension" | "binary" | "json" | "empty" | "notCsv";

export type ImportFileCheck = { ok: true; known: boolean } | { ok: false; problem: ImportFileProblem };

function extensionOf(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? name;
  const dot = base.lastIndexOf(".");
  return dot <= 0 ? "" : base.slice(dot).toLowerCase();
}

/**
 * Is this file something the importer can work with? `known` is true when the header matches a supported layout outright,
 * false when the lifter will need to match columns by hand (still a CSV with at least two named columns).
 */
export function checkImportFile(name: string, text: string): ImportFileCheck {
  const ext = extensionOf(name);
  // A name with no extension is allowed (some Android providers drop it); the content checks decide.
  if (ext !== "" && !(IMPORT_FILE_EXTENSIONS as readonly string[]).includes(ext)) return { ok: false, problem: "extension" };
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  if (src.trim() === "") return { ok: false, problem: "empty" };
  if (src.startsWith("PK") || src.includes("\u0000") || src.startsWith("%PDF")) return { ok: false, problem: "binary" };
  const head = src.trimStart()[0];
  if (head === "{" || head === "[") return { ok: false, problem: "json" };
  if (detectSource(src) !== null) return { ok: true, known: true };
  const headers = csvHeaders(src).filter((h) => h !== "");
  if (headers.length < 2) return { ok: false, problem: "notCsv" };
  return { ok: true, known: false };
}
