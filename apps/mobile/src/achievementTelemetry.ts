import { File, Paths } from "expo-file-system";
import { createTelemetry, type TelemetryStore } from "./logic/achievementTelemetry";

/** Local achievement notes: one JSON file in the app's private document folder. Never uploaded. */
export const TELEMETRY_FILE_NAME = "gain-achievement-telemetry.json";

function fileStore(): TelemetryStore {
  const file = () => new File(Paths.document, TELEMETRY_FILE_NAME);
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

/** The one on-device achievement telemetry store. Off until the lifter opts in. */
export const telemetry = createTelemetry(fileStore());
