import { SAMPLE_GYM } from "../db/seedData";

/** Display-only alias for the original sample label; saved and custom names stay intact. */
export function gymDisplayName(name: string, sampleName: string): string {
  return name === SAMPLE_GYM.name ? sampleName : name;
}
