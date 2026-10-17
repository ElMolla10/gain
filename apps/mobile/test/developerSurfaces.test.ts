import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

function source(file: string) {
  return ts.createSourceFile(file, readFileSync(join(__dirname, "..", file), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

/** Inspect the real JSX: a label or route must live in the enabled branch, never just beside a guard. */
function expectDeveloperOnly(file: string, labels: string[]) {
  const root = source(file);
  for (const label of labels) {
    const matches: ts.StringLiteral[] = [];
    function visit(node: ts.Node) {
      if (ts.isStringLiteral(node) && node.text === label) matches.push(node);
      ts.forEachChild(node, visit);
    }
    visit(root);
    expect(matches.length, `${file}: ${label} exists`).toBeGreaterThan(0);
    for (const match of matches) {
      let child: ts.Node = match, guarded = false;
      for (let parent = child.parent; parent; child = parent, parent = parent.parent) {
        if (ts.isConditionalExpression(parent) && child === parent.whenTrue && parent.condition.getText(root) === "developerMode") guarded = true;
        if (ts.isBinaryExpression(parent) && child === parent.right && parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && parent.left.getText(root) === "developerMode") guarded = true;
      }
      expect(guarded, `${file}: ${label} requires Developer Mode`).toBe(true);
    }
  }
}

describe("diagnostic surfaces require Developer Mode", () => {
  it("unregisters every internal route when Developer Mode is off", () => {
    expectDeveloperOnly("App.tsx", ["Diagnostics", "DecisionLog", "StoppedSuggestions"]);
  });
  it("keeps the stopped-suggestions entry exclusively in Developer Tools", () => {
    expect(readFileSync(join(__dirname, "../src/screens/SettingsScreen.tsx"), "utf8")).not.toContain('t("stop.entry")');
  });
  it("hides diagnostic controls and telemetry prompts from ordinary privacy and progress screens", () => {
    expectDeveloperOnly("src/screens/PrivacyScreen.tsx", ["privacy.crash.title", "privacy.crash.enabled", "diag.clear", "privacy.telemetry.title", "telemetry.enabled", "diag.entry"]);
    expectDeveloperOnly("src/screens/HistoryScreen.tsx", ["telemetry.optin.title", "telemetry.optin.allow", "telemetry.optin.deny", "dec.entry"]);
  });
  it("keeps ML evaluation off Today", () => {
    expect(readFileSync(join(__dirname, "../src/screens/TodayScreen.tsx"), "utf8")).not.toMatch(/MlAccuracyCard|mlEvaluation/);
  });
  it("does not send ordinary users to a hidden restore screen", async () => {
    const { en, ar } = await import("../src/i18n/strings");
    expect(en["stop.notice.stopped"]).not.toMatch(/Settings|Things I've stopped/);
    expect(ar["stop.notice.stopped"]).not.toMatch(/الإعدادات|حاجات وقفت/);
  });
});
