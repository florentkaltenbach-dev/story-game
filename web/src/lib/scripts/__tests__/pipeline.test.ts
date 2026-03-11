import { describe, it, expect } from "vitest";
import { runPipeline, type PipelineContext } from "../pipeline";
import type { PipelineInput } from "../types";

function makeContext(overrides?: Partial<PipelineContext>): PipelineContext {
  return {
    knownNpcs: [
      { name: "Dr. Harold Starkweather", role: "Co-patron" },
      { name: "Professor James Moore", role: "Co-patron (remote)" },
      { name: "The Ship Captain", role: "Veteran whaler" },
    ],
    existingNpcKeys: [],
    knownLocations: [
      { name: "McMurdo Sound", description: "Base of operations" },
      { name: "Ross Ice Barrier", description: "The wall of ice" },
      { name: "The Mountains", description: "Lovecraft's unnamed range" },
    ],
    currentLocation: "Arkham, Massachusetts",
    existingWidgets: [],
    ...overrides,
  };
}

function makeInput(overrides?: Partial<PipelineInput>): PipelineInput {
  return {
    narrative: "The wind howled across the deck.",
    session: { number: 1, act: 1 },
    ...overrides,
  };
}

describe("pipeline", () => {
  describe("journal processing", () => {
    it("creates journal entry with player voice for first-person text", () => {
      const result = runPipeline(
        makeInput({
          journalUpdate: "I saw something in the water. My hands trembled as I wrote this.",
          playerId: "player-abc",
        }),
        makeContext()
      );
      expect(result.journalEntries).toHaveLength(1);
      expect(result.journalEntries[0].voice).toBe("player");
      expect(result.journalEntries[0].playerId).toBe("player-abc");
    });

    it("creates journal entry with narrator voice for third-person text", () => {
      const result = runPipeline(
        makeInput({
          journalUpdate: "The expedition pressed forward. The dogs grew restless.",
          playerId: "player-abc",
        }),
        makeContext()
      );
      expect(result.journalEntries).toHaveLength(1);
      expect(result.journalEntries[0].voice).toBe("narrator");
    });

    it("skips journal when no journalUpdate provided", () => {
      const result = runPipeline(makeInput(), makeContext());
      expect(result.journalEntries).toHaveLength(0);
    });

    it("skips journal when no playerId provided", () => {
      const result = runPipeline(
        makeInput({ journalUpdate: "Something happened." }),
        makeContext()
      );
      expect(result.journalEntries).toHaveLength(0);
    });
  });

  describe("NPC extraction", () => {
    it("detects NPC by full name", () => {
      const result = runPipeline(
        makeInput({ narrative: "Dr. Harold Starkweather called everyone to the deck." }),
        makeContext()
      );
      const npcEvents = result.detectedEvents.filter((e) => e.type === "npc_mention");
      expect(npcEvents).toHaveLength(1);
      expect(npcEvents[0].data.name).toBe("Dr. Harold Starkweather");
    });

    it("detects NPC by last name only", () => {
      const result = runPipeline(
        makeInput({ narrative: "Starkweather paced the bridge nervously." }),
        makeContext()
      );
      const npcEvents = result.detectedEvents.filter((e) => e.type === "npc_mention");
      expect(npcEvents).toHaveLength(1);
    });

    it("creates memory write for new NPC (first mention)", () => {
      const result = runPipeline(
        makeInput({ narrative: "Moore's voice crackled over the radio." }),
        makeContext()
      );
      expect(result.memoryWrites.some((w) => w.level === 2)).toBe(true);
    });

    it("skips memory write for already-known NPC", () => {
      const result = runPipeline(
        makeInput({ narrative: "Starkweather shouted." }),
        makeContext({ existingNpcKeys: ["dr-harold-starkweather"] })
      );
      const npcWrites = result.memoryWrites.filter((w) => w.level === 2);
      expect(npcWrites).toHaveLength(0);
    });

    it("does whole-word matching (no partial matches)", () => {
      const result = runPipeline(
        makeInput({ narrative: "The stark weather made progress impossible." }),
        makeContext()
      );
      // "stark" alone should not match "Starkweather"
      const npcEvents = result.detectedEvents.filter((e) => e.type === "npc_mention");
      expect(npcEvents).toHaveLength(0);
    });

    it("is case-insensitive", () => {
      const result = runPipeline(
        makeInput({ narrative: "STARKWEATHER was furious." }),
        makeContext()
      );
      const npcEvents = result.detectedEvents.filter((e) => e.type === "npc_mention");
      expect(npcEvents).toHaveLength(1);
    });
  });

  describe("location detection", () => {
    it("detects location change", () => {
      const result = runPipeline(
        makeInput({ narrative: "The ship reached McMurdo Sound at last." }),
        makeContext()
      );
      const locEvents = result.detectedEvents.filter((e) => e.type === "location_change");
      expect(locEvents).toHaveLength(1);
      expect(locEvents[0].data.to).toBe("McMurdo Sound");
    });

    it("does not trigger if location unchanged", () => {
      const result = runPipeline(
        makeInput({ narrative: "The party settled into McMurdo Sound camp." }),
        makeContext({ currentLocation: "McMurdo Sound" })
      );
      const locEvents = result.detectedEvents.filter((e) => e.type === "location_change");
      expect(locEvents).toHaveLength(0);
    });

    it("writes to Level 1 on location change", () => {
      const result = runPipeline(
        makeInput({ narrative: "They crossed onto the Ross Ice Barrier." }),
        makeContext()
      );
      const l1Writes = result.memoryWrites.filter((w) => w.level === 1);
      expect(l1Writes).toHaveLength(1);
    });
  });

  describe("environment extraction", () => {
    it("extracts temperature with degrees", () => {
      const result = runPipeline(
        makeInput({ narrative: "The temperature dropped to -30°C." }),
        makeContext()
      );
      const envEvents = result.detectedEvents.filter((e) => e.type === "environment_change");
      expect(envEvents).toHaveLength(1);
    });

    it("extracts blizzard weather", () => {
      const result = runPipeline(
        makeInput({ narrative: "A blizzard struck without warning." }),
        makeContext()
      );
      const envEvents = result.detectedEvents.filter((e) => e.type === "environment_change");
      expect(envEvents).toHaveLength(1);
    });

    it("does not extract from mundane text", () => {
      const result = runPipeline(
        makeInput({ narrative: "They unpacked their equipment and began organizing." }),
        makeContext()
      );
      const envEvents = result.detectedEvents.filter((e) => e.type === "environment_change");
      expect(envEvents).toHaveLength(0);
    });

    it("writes to Level 5 on environment detection", () => {
      const result = runPipeline(
        makeInput({ narrative: "Winds of 60 knots hammered the camp." }),
        makeContext()
      );
      const l5Writes = result.memoryWrites.filter((w) => w.level === 5);
      expect(l5Writes).toHaveLength(1);
    });
  });

  describe("widget derivation", () => {
    it("creates npc_dossier widget from NPC memory write", () => {
      const result = runPipeline(
        makeInput({ narrative: "Starkweather emerged from below." }),
        makeContext()
      );
      const npcWidgets = result.widgetOps.filter(
        (op) => op.widget.kind === "npc_dossier"
      );
      expect(npcWidgets).toHaveLength(1);
      expect(npcWidgets[0].widget.id).toBe("auto-npc-dr-harold-starkweather");
      expect(npcWidgets[0].action).toBe("upsert");
    });

    it("creates environment widget from environment write", () => {
      const result = runPipeline(
        makeInput({ narrative: "The temperature dropped to -40°C and a blizzard struck." }),
        makeContext()
      );
      const envWidgets = result.widgetOps.filter(
        (op) => op.widget.kind === "environment"
      );
      expect(envWidgets).toHaveLength(1);
      expect(envWidgets[0].widget.id).toBe("auto-env");
    });
  });

  describe("full pipeline aggregation", () => {
    it("processes multiple extractions from rich narrative", () => {
      const result = runPipeline(
        makeInput({
          narrative:
            "Starkweather ordered the ship toward McMurdo Sound. The temperature dropped to -20°C as winds of 40 knots battered the hull.",
          journalUpdate: "I could barely hold my pen. We're heading into the ice.",
          playerId: "player-1",
        }),
        makeContext()
      );

      expect(result.journalEntries).toHaveLength(1);
      expect(result.journalEntries[0].voice).toBe("player");
      expect(result.detectedEvents.length).toBeGreaterThanOrEqual(3); // NPC + location + env
      expect(result.memoryWrites.length).toBeGreaterThanOrEqual(3);
      expect(result.widgetOps.length).toBeGreaterThanOrEqual(2); // NPC + env widgets
    });
  });
});
