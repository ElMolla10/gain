import React from "react";
import { describe, expect, it, vi } from "vitest";
import { VaultStatsHero } from "../src/components/vault/VaultStatsHero";
import { CloudSyncCard } from "../src/components/vault/CloudSyncCard";
import { ImportBatchHero } from "../src/components/vault/ImportBatchHero";
import type { DataCounts } from "../src/db/dataRepo";
import type { SyncInfo } from "../src/sync/engine";
import type { ImportPreview, BatchInfo } from "../src/db/importRepo";
import { expand, nodes, texts } from "./achievementRender";

vi.mock("react", async (orig) => (await import("./achievementRender")).mockReactHooks(await orig()));
vi.mock("react-native", () => ({
  View: "View",
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  StyleSheet: {
    create: (styles: any) => styles,
    hairlineWidth: 1,
  },
}));
vi.mock("../src/theme", () => ({
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  usePalette: () => ({
    card: "#FFFFFF",
    border: "#E0E0E0",
    text: "#111111",
    muted: "#666666",
  }),
}));
vi.mock("../src/ui", () => ({
  AppText: "AppText",
  Card: "Card",
  BigButton: (props: any) =>
    React.createElement("Pressable", { accessibilityRole: "button", onPress: props.onPress }, React.createElement("AppText", null, props.label)),
  InlineStatus: (props: any) => React.createElement("AppText", null, props.text),
  Chip: (props: any) =>
    React.createElement("Pressable", { accessibilityRole: "button", onPress: props.onPress }, React.createElement("AppText", null, props.label)),
}));
vi.mock("../src/i18n", () => ({
  useI18n: () => ({
    lang: "en",
    unit: "kg",
    unitText: "kg",
    direction: "ltr",
    fmt: (n: number) => String(n),
    t: (k: string, p?: Record<string, string | number>) => {
      if (k === "vault.hero.title") return "LOCAL DATA VAULT";
      if (k === "vault.sync.active") return "ENCRYPTED SYNC ACTIVE";
      if (k === "vault.sync.offline") return "LOCAL-ONLY VAULT";
      if (k === "vault.import.staged") return "STAGED IMPORT FILE";
      if (k === "vault.label.workouts") return "Workouts";
      if (k === "vault.label.sets") return "Sets";
      if (k === "vault.label.programmes") return "Programmes";
      if (k === "vault.label.gyms") return "Gyms";
      if (k === "data.exportJson") return "Export JSON";
      if (k === "data.exportCsv") return "Export CSV";
      if (k === "data.restore") return "Restore Backup";
      if (k === "data.safetyCopy") return "Local safety backup exists";
      if (k === "sync.turnOn") return "Turn on Sync";
      if (k === "sync.now") return "Sync Now";
      if (k === "sync.details") return "Sync Details";
      if (k === "sync.lastAt") return `Last synced: ${p?.time}`;
      if (k === "sync.never") return "Never synced";
      if (k === "sync.code.title") return "Recovery Code";
      if (k === "sync.code.saveNote") return "Save this code safely.";
      if (k === "import.history.title") return "Import History";
      if (k === "import.history.row") return `${p?.source}: ${p?.workouts} workouts, ${p?.sets} sets`;
      if (k === "import.undo") return "Undo";
      if (k === "import.preview.range") return `Range: ${p?.range}`;
      if (k === "import.preview.heaviest") return `Heaviest: ${p?.load} kg`;
      if (k === "import.source.hevy") return "Hevy";
      return k;
    },
  }),
}));

const strip = (s: string) => s.replace(/[\u2066-\u2069]/g, "");

describe("Page 11: The Vault Importer & Cloud Sync", () => {
  it("renders VaultStatsHero with counts and triggers exports", () => {
    const onExportJson = vi.fn();
    const onExportCsv = vi.fn();
    const onRestore = vi.fn();

    const counts: DataCounts = {
      sessions: 42,
      sets: 312,
      programmes: 2,
      gyms: 3,
    };

    const tree = expand(
      React.createElement(VaultStatsHero, {
        counts,
        safetyCopy: true,
        restoreCopy: false,
        onExportJson,
        onExportCsv,
        onRestore,
      })
    );
    const allTexts = strip(texts(tree).join(" "));

    expect(allTexts).toContain("LOCAL DATA VAULT");
    expect(allTexts).toContain("42");
    expect(allTexts).toContain("Workouts");
    expect(allTexts).toContain("312");
    expect(allTexts).toContain("Sets");
    expect(allTexts).toContain("Local safety backup exists");
    expect(allTexts).toContain("Export JSON");
    expect(allTexts).toContain("Export CSV");
    expect(allTexts).toContain("Restore Backup");

    const buttons = nodes(tree).filter((n) => n.props?.accessibilityRole === "button");
    expect(buttons.length).toBeGreaterThanOrEqual(3);
    buttons[0]!.props.onPress();
    expect(onExportJson).toHaveBeenCalled();
    buttons[1]!.props.onPress();
    expect(onExportCsv).toHaveBeenCalled();
    buttons[2]!.props.onPress();
    expect(onRestore).toHaveBeenCalled();
  });

  it("renders CloudSyncCard offline and active states (the recovery code never shows on the card)", () => {
    const onTurnOn = vi.fn();
    const onSyncNow = vi.fn();
    const onShowDetails = vi.fn();

    // Offline state
    const offTree = expand(
      React.createElement(CloudSyncCard, {
        info: { status: "off", accountId: null, email: null, lastSyncAt: null, lastError: null, pendingOut: 0, parked: { waiting_parent: 0, conflict: 0, newer_app: 0 }, rejectedTotal: 0 },
        busy: false,
        onTurnOn,
        onSyncNow,
        onShowDetails,
      })
    );
    expect(strip(texts(offTree).join(" "))).toContain("LOCAL-ONLY VAULT");
    expect(strip(texts(offTree).join(" "))).toContain("Turn on Sync");

    // Active state
    const onTree = expand(
      React.createElement(CloudSyncCard, {
        info: { status: "on", accountId: "acc_1", email: null, lastSyncAt: 1729330000000, lastError: null, pendingOut: 2, parked: { waiting_parent: 0, conflict: 0, newer_app: 0 }, rejectedTotal: 0 },
        busy: false,
        onTurnOn,
        onSyncNow,
        onShowDetails,
      })
    );
    const onTexts = strip(texts(onTree).join(" "));
    expect(onTexts).toContain("ENCRYPTED SYNC ACTIVE");
    expect(onTexts).not.toContain("Recovery Code");
    expect(onTexts).toContain("Sync Now");
    expect(onTexts).toContain("Sync Details");

    const buttons = nodes(onTree).filter((n) => n.props?.accessibilityRole === "button");
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    buttons[0]!.props.onPress();
    expect(onSyncNow).toHaveBeenCalled();
  });

  it("renders ImportBatchHero with parsed metrics and batch history", () => {
    const onUndoBatch = vi.fn();
    const onPickFile = vi.fn();

    const parsed = {
      name: "hevy-export-oct2026.csv",
      parse: {
        source: "hevy" as const,
        unit: "kg" as const,
        workouts: [],
        warnings: [],
        rowCount: 0,
      },
    };

    const preview: ImportPreview = {
      source: "hevy",
      fileWorkouts: 25,
      newWorkouts: 25,
      duplicateWorkouts: 0,
      emptyWorkouts: 0,
      newSets: 180,
      firstDate: "2026-09-01",
      lastDate: "2026-10-15",
      titles: [],
      warnings: [],
    };

    const batches: BatchInfo[] = [
      {
        id: "b1",
        source: "hevy",
        fileName: "hevy-export-oct2026.csv",
        gymId: "gym_1",
        gymName: "Downtown Barbell Club",
        workouts: 25,
        sets: 180,
        createdAt: 1729330000000,
      },
    ];

    const tree = expand(
      React.createElement(ImportBatchHero, {
        parsed,
        preview,
        heaviestKg: 140,
        batches,
        onPickFile,
        onUndoBatch,
        busy: false,
      })
    );
    const allTexts = strip(texts(tree).join(" "));

    expect(allTexts).toContain("STAGED IMPORT FILE");
    expect(allTexts).toContain("hevy-export-oct2026.csv");
    expect(allTexts).toContain("Hevy");
    expect(allTexts).toContain("25");
    expect(allTexts).toContain("Workouts");
    expect(allTexts).toContain("180");
    expect(allTexts).toContain("Sets");
    expect(allTexts).toContain("Heaviest: 140 kg");
    expect(allTexts).toContain("Import History");
    expect(allTexts).toContain("Undo");

    const buttons = nodes(tree).filter((n) => n.props?.accessibilityRole === "button");
    expect(buttons.length).toBeGreaterThan(0);
    buttons[0]!.props.onPress();
    expect(onUndoBatch).toHaveBeenCalledWith(expect.objectContaining({ id: "b1" }));
  });
});
