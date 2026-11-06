import { describe, expect, it } from "vitest";
import { SAMPLE_GYM } from "../src/db/seedData";
import { gymDisplayName } from "../src/logic/gymDisplayName";

describe("gym name presentation", () => {
  it.each(["Sample gym", "جيم تجريبي"])("shortens only the original placeholder label to %s", (label) => {
    expect(gymDisplayName(SAMPLE_GYM.name, label)).toBe(label);
    expect(gymDisplayName("My custom gym (upstairs)", label)).toBe("My custom gym (upstairs)");
    expect(SAMPLE_GYM.name).toContain("placeholder");
  });
});
