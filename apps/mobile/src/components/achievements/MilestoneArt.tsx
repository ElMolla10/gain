import React, { useId } from "react";
import { SvgXml } from "react-native-svg";
import { collectionSvg } from "./collectionArt";
export function MilestoneArt({ badgeId, size, state = "earned" }: { badgeId: string; size: number; state?: "earned" | "locked" | "in_progress" }) {
  const uid = useId().replace(/[^a-z0-9]/gi, "");
  const xml = collectionSvg(badgeId, state, `c${uid}`);
  return xml ? <SvgXml xml={xml} width={size} height={size} accessible={false} /> : null;
}
