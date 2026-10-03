import { File, Paths } from "expo-file-system";
import { createDiagnostics, type DiagStore } from "../logic/diagnostics";

/** The crash log is one small JSON file in the app's private document folder (not shared, not backed up by us, never uploaded). */
export const DIAG_FILE_NAME = "gain-diagnostics.json";

function fileStore(): DiagStore {
  const file = () => new File(Paths.document, DIAG_FILE_NAME);
  return {
    read() {
      const f = file();
      return f.exists ? f.textSync() : null;
    },
    write(text) {
      const f = file();
      if (!f.exists) f.create({ overwrite: true });
      f.write(text);
    },
    remove() {
      const f = file();
      if (f.exists) f.delete();
    },
  };
}

/** The one logger of the app. */
export const diagnostics = createDiagnostics(fileStore());
