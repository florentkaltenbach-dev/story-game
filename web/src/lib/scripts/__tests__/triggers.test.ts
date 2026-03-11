import { describe, it, expect } from "vitest";
import { matchTriggers } from "../triggers";
import type { DetectedEvent } from "../types";
import type { EventTrigger, TriggerState } from "../../types";

const DEFAULT_CONFIG: EventTrigger[] = [
  {
    id: "location-arrival",
    event: "location_change",
    mode: "mc_generate",
    cooldownMinutes: 5,
    description: "Atmosphere on location change",
  },
  {
    id: "npc-encounter",
    event: "npc_mention",
    mode: "player_response",
    cooldownMinutes: 10,
    conditions: { firstMention: true },
    description: "Keeper acknowledges NPC on first mention",
  },
];

function emptyState(): TriggerState {
  return { lastFired: {} };
}

describe("trigger matching", () => {
  it("matches event to trigger", () => {
    const events: DetectedEvent[] = [
      { type: "location_change", data: { from: "Arkham", to: "McMurdo Sound" } },
    ];
    const actions = matchTriggers(events, DEFAULT_CONFIG, emptyState());
    expect(actions).toHaveLength(1);
    expect(actions[0].triggerId).toBe("location-arrival");
    expect(actions[0].mode).toBe("mc_generate");
  });

  it("respects cooldown", () => {
    const events: DetectedEvent[] = [
      { type: "location_change", data: { from: "A", to: "B" } },
    ];
    const state: TriggerState = {
      lastFired: { "location-arrival": Date.now() - 60_000 }, // 1 min ago (< 5 min cooldown)
    };
    const actions = matchTriggers(events, DEFAULT_CONFIG, state);
    expect(actions).toHaveLength(0);
  });

  it("fires after cooldown expires", () => {
    const events: DetectedEvent[] = [
      { type: "location_change", data: { from: "A", to: "B" } },
    ];
    const state: TriggerState = {
      lastFired: { "location-arrival": Date.now() - 6 * 60_000 }, // 6 min ago (> 5 min cooldown)
    };
    const actions = matchTriggers(events, DEFAULT_CONFIG, state);
    expect(actions).toHaveLength(1);
  });

  it("checks conditions (firstMention)", () => {
    const events: DetectedEvent[] = [
      { type: "npc_mention", data: { name: "Starkweather", firstMention: true } },
    ];
    const actions = matchTriggers(events, DEFAULT_CONFIG, emptyState());
    expect(actions).toHaveLength(1);
    expect(actions[0].triggerId).toBe("npc-encounter");
  });

  it("rejects events that don't match conditions", () => {
    const events: DetectedEvent[] = [
      { type: "npc_mention", data: { name: "Starkweather", firstMention: false } },
    ];
    const actions = matchTriggers(events, DEFAULT_CONFIG, emptyState());
    expect(actions).toHaveLength(0);
  });

  it("returns empty for no matching events", () => {
    const events: DetectedEvent[] = [
      { type: "keyword", data: { keyword: "shoggoth" } },
    ];
    const actions = matchTriggers(events, DEFAULT_CONFIG, emptyState());
    expect(actions).toHaveLength(0);
  });

  it("matches multiple events to multiple triggers", () => {
    const events: DetectedEvent[] = [
      { type: "location_change", data: { from: "A", to: "B" } },
      { type: "npc_mention", data: { name: "Moore", firstMention: true } },
    ];
    const actions = matchTriggers(events, DEFAULT_CONFIG, emptyState());
    expect(actions).toHaveLength(2);
  });
});
