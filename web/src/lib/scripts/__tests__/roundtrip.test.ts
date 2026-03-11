import { describe, it, expect } from "vitest";
import { runPipeline, type PipelineContext } from "../pipeline";
import type { PipelineInput } from "../types";

/**
 * Roundtrip integration test: simulates a full Keeper → pipeline → state cycle.
 * Mock Keeper → narrative mentioning NPC → pipeline extracts → memory write → widget created
 */

function fullContext(): PipelineContext {
  return {
    knownNpcs: [
      {
        name: "Dr. Harold Starkweather",
        role: "Co-patron (True Believer)",
        description: "A former colleague of Dyer's who read the private account.",
        agenda: "Vindication — for Dyer, for science, for the truth.",
      },
      {
        name: "Professor James Moore",
        role: "Co-patron (Skeptic, remote)",
        description: "A hard-nosed empiricist brought on to keep the expedition credible.",
        agenda: "Debunking — or claiming the discovery for rigorous science.",
      },
      {
        name: "The Ship Captain",
        role: "Veteran Antarctic whaler",
        description: "Practical, skeptical, loyal to crew over mission.",
      },
    ],
    existingNpcKeys: [],
    knownLocations: [
      { name: "McMurdo Sound", description: "Base of operations" },
      { name: "Ross Ice Barrier", description: "The wall of ice marking the edge of the navigable south" },
      { name: "The Mountains", description: "Lovecraft's unnamed range exceeding 35,000 feet" },
      { name: "The Plateau", description: "High Antarctic interior, 8500+ feet" },
    ],
    currentLocation: "Arkham, Massachusetts",
    existingWidgets: [],
  };
}

describe("roundtrip integration", () => {
  it("processes a rich Keeper response through the full pipeline", () => {
    const keeperNarrative =
      "Dr. Harold Starkweather stood at the bow, his coat whipping in winds of 50 knots. " +
      "'We make for McMurdo Sound,' he announced. The temperature dropped to -15°C as the ship " +
      "lurched through mounting swells. The Ship Captain watched from the bridge, saying nothing.";

    const keeperJournal =
      "I gripped the railing and watched Starkweather's face. Whatever he saw in Dyer's account, " +
      "it has consumed him. My hands shook — from the cold, I told myself.";

    const input: PipelineInput = {
      narrative: keeperNarrative,
      journalUpdate: keeperJournal,
      playerId: "player-test-1",
      session: { number: 1, act: 1 },
    };

    const result = runPipeline(input, fullContext());

    // --- Journal ---
    expect(result.journalEntries).toHaveLength(1);
    expect(result.journalEntries[0].voice).toBe("player"); // "I gripped", "My hands"
    expect(result.journalEntries[0].playerId).toBe("player-test-1");

    // --- NPC extraction ---
    const npcEvents = result.detectedEvents.filter((e) => e.type === "npc_mention");
    expect(npcEvents.length).toBeGreaterThanOrEqual(2); // Starkweather + Ship Captain

    const starkweatherEvent = npcEvents.find((e) => e.data.name === "Dr. Harold Starkweather");
    expect(starkweatherEvent).toBeDefined();
    expect(starkweatherEvent!.data.firstMention).toBe(true);

    // NPC memory writes (new NPCs get stubs)
    const npcWrites = result.memoryWrites.filter((w) => w.level === 2);
    expect(npcWrites.length).toBeGreaterThanOrEqual(2);

    // --- Location change ---
    const locEvents = result.detectedEvents.filter((e) => e.type === "location_change");
    expect(locEvents).toHaveLength(1);
    expect(locEvents[0].data.to).toBe("McMurdo Sound");

    const locWrites = result.memoryWrites.filter((w) => w.level === 1);
    expect(locWrites).toHaveLength(1);

    // --- Environment ---
    const envEvents = result.detectedEvents.filter((e) => e.type === "environment_change");
    expect(envEvents).toHaveLength(1);

    const envWrites = result.memoryWrites.filter((w) => w.level === 5);
    expect(envWrites).toHaveLength(1);

    // --- Widget derivation ---
    const npcWidgets = result.widgetOps.filter((op) => op.widget.kind === "npc_dossier");
    expect(npcWidgets.length).toBeGreaterThanOrEqual(2);
    // All NPC widgets should have deterministic IDs
    expect(npcWidgets.every((w) => w.widget.id.startsWith("auto-npc-"))).toBe(true);

    const envWidgets = result.widgetOps.filter((op) => op.widget.kind === "environment");
    expect(envWidgets).toHaveLength(1);
    expect(envWidgets[0].widget.id).toBe("auto-env");
  });

  it("does not duplicate NPC data on second mention", () => {
    const context = fullContext();
    // Simulate first run already created the NPC file
    context.existingNpcKeys = ["dr-harold-starkweather"];

    const input: PipelineInput = {
      narrative: "Starkweather called everyone to the meeting room.",
      session: { number: 1, act: 2 },
    };

    const result = runPipeline(input, context);

    // Still fires NPC mention event
    const npcEvents = result.detectedEvents.filter((e) => e.type === "npc_mention");
    expect(npcEvents).toHaveLength(1);
    expect(npcEvents[0].data.firstMention).toBe(false);

    // But NO new memory write (already exists)
    const npcWrites = result.memoryWrites.filter((w) => w.level === 2);
    expect(npcWrites).toHaveLength(0);

    // And no NPC widget (no memory write to derive from)
    const npcWidgets = result.widgetOps.filter((op) => op.widget.kind === "npc_dossier");
    expect(npcWidgets).toHaveLength(0);
  });

  it("handles empty narrative gracefully", () => {
    const result = runPipeline(
      { narrative: "", session: { number: 0, act: 1 } },
      fullContext()
    );

    expect(result.journalEntries).toHaveLength(0);
    expect(result.memoryWrites).toHaveLength(0);
    expect(result.widgetOps).toHaveLength(0);
    expect(result.detectedEvents).toHaveLength(0);
  });
});
