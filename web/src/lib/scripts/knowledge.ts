import { readMemoryLevel, writeMemoryLevel } from "../memory";

export interface KnowledgeLedger {
  playerId: string;
  entries: string[];  // e.g., "npc-met:starkweather", "location-visited:arkham-wharf", "clue:symbol"
}

/**
 * Read a player's knowledge ledger from Level 2 memory.
 */
export async function readKnowledgeLedger(playerId: string): Promise<KnowledgeLedger> {
  const files = await readMemoryLevel(2, `knowledge-${playerId}`);
  const key = `knowledge-${playerId}`;
  const raw = files[key];

  if (!raw) {
    return { playerId, entries: [] };
  }

  try {
    return JSON.parse(raw);
  } catch {
    return { playerId, entries: [] };
  }
}

/**
 * Add knowledge entries to a player's ledger.
 * Deduplicates automatically.
 */
export async function addKnowledge(playerId: string, newEntries: string[]): Promise<void> {
  if (newEntries.length === 0) return;

  const ledger = await readKnowledgeLedger(playerId);
  const existing = new Set(ledger.entries);
  let changed = false;

  for (const entry of newEntries) {
    if (!existing.has(entry)) {
      existing.add(entry);
      changed = true;
    }
  }

  if (!changed) return;

  const updated: KnowledgeLedger = {
    playerId,
    entries: Array.from(existing),
  };

  await writeMemoryLevel(2, `knowledge-${playerId}`, JSON.stringify(updated, null, 2));
}

/**
 * Derive knowledge entries from pipeline events.
 * Called after the pipeline runs for a player's message.
 */
export function deriveKnowledge(
  events: Array<{ type: string; data: Record<string, unknown> }>,
  currentLocation: string
): string[] {
  const entries: string[] = [];

  for (const event of events) {
    switch (event.type) {
      case "npc_mention": {
        const slug = event.data.slug as string;
        if (slug) entries.push(`npc-met:${slug}`);
        break;
      }
      case "location_change": {
        const to = event.data.to as string;
        if (to) entries.push(`location-visited:${to.toLowerCase().replace(/\s+/g, "-")}`);
        break;
      }
      case "environment_change": {
        entries.push(`environment-observed:${currentLocation.toLowerCase().replace(/\s+/g, "-")}`);
        break;
      }
    }
  }

  // Always record current location
  if (currentLocation) {
    entries.push(`location-visited:${currentLocation.toLowerCase().replace(/\s+/g, "-")}`);
  }

  return entries;
}
