import type { DecisionListItem } from "../db/decisionRepo";
import type { StringKey } from "../i18n/strings";
import { targetQuantity } from "./quantity";

/** What the lifter did about a suggestion, as a string key (+ the load for an edit). */
export function actionOf(d: Pick<DecisionListItem, "status" | "sessionStatus" | "editedLoad" | "currency">): { key: StringKey; editedLoad: number | null } {
  switch (d.status) {
    case "accepted":
      return { key: "dec.action.accepted", editedLoad: null };
    case "edited":
      return { key: "dec.action.edited", editedLoad: d.editedLoad };
    case "rejected":
      return { key: "dec.action.rejected", editedLoad: null };
    default:
      return { key: d.sessionStatus === "finished" || d.sessionStatus === "in_progress" ? "dec.action.proposedDone" : "dec.action.proposed", editedLoad: null };
  }
}

export const hasNumber = (d: Pick<DecisionListItem, "load" | "reps" | "currency"> & Partial<Pick<DecisionListItem, "measure" | "durationS" | "distanceM">>): boolean =>
  d.currency !== "none" && d.load !== null && targetQuantity(d, d.measure ?? "reps") !== null;
