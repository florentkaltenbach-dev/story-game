import type { DetectedEvent } from "./types";
import type { EventTrigger, TriggerState, KeeperMode } from "../types";

export interface TriggeredAction {
  triggerId: string;
  mode: KeeperMode;
  event: DetectedEvent;
  description?: string;
}

/**
 * Match detected events against trigger config.
 * Checks cooldowns and optional conditions.
 * Pure function — caller decides what to do with results.
 */
export function matchTriggers(
  events: DetectedEvent[],
  config: EventTrigger[],
  state: TriggerState
): TriggeredAction[] {
  const now = Date.now();
  const actions: TriggeredAction[] = [];

  for (const event of events) {
    for (const trigger of config) {
      if (trigger.event !== event.type) continue;

      // Check cooldown
      const lastFired = state.lastFired[trigger.id] || 0;
      const cooldownMs = trigger.cooldownMinutes * 60 * 1000;
      if (now - lastFired < cooldownMs) continue;

      // Check conditions
      if (trigger.conditions && !checkConditions(trigger.conditions, event)) {
        continue;
      }

      actions.push({
        triggerId: trigger.id,
        mode: trigger.mode,
        event,
        description: trigger.description,
      });
    }
  }

  return actions;
}

function checkConditions(
  conditions: Record<string, unknown>,
  event: DetectedEvent
): boolean {
  for (const [key, expected] of Object.entries(conditions)) {
    const actual = event.data[key];
    if (actual !== expected) return false;
  }
  return true;
}
