import { Image } from "react-native";
import dumbbell from "../../../assets/today-equipment/dumbbell.webp";
import plate from "../../../assets/today-equipment/stack-plate.webp";
export const EQUIPMENT_SOURCES = { dumbbell, plate };
/** Populate bundled-image caches during the existing boot screen before Today switches objects. */
export async function preloadEquipmentArt(): Promise<void> {
  await Promise.all(Object.values(EQUIPMENT_SOURCES).map(source => {
    const uri = typeof source === "number" ? Image.resolveAssetSource(source)?.uri : typeof source === "string" ? source : (source as {uri?:string}).uri;
    return uri ? Image.prefetch(uri) : Promise.resolve(false);
  }));
}
