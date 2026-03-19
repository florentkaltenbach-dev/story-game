import { readMemoryLevel, writeMemoryLevel } from "../memory";

export type KnowledgeStatus = "unknown" | "rumored" | "confirmed";

/**
 * Knowledge ledger — tracks what a player has discovered.
 *
 * Keys use category prefixes that the fog-matrix viz relies on:
 *   npc-{slug}   → NPCs Met
 *   loc-{slug}   → Locations Visited
 *   clue-{slug}  → Clues & Secrets
 *
 * Status escalation: rumored → confirmed (never downgrades).
 */
export interface KnowledgeLedger {
  playerId: string;
  playerName: string;
  knowledge: Record<string, KnowledgeStatus>;
}

export interface KnowledgeEntry {
  key: string;          // e.g., "npc-starkweather", "loc-arkham-wharf"
  status: KnowledgeStatus;
}

/**
 * Read a player's knowledge ledger from Level 2 memory.
 */
export async function readKnowledgeLedger(playerId: string): Promise<KnowledgeLedger> {
  const files = await readMemoryLevel(2, `knowledge-${playerId}`);
  const fileKey = `knowledge-${playerId}`;
  const raw = files[fileKey];

  if (!raw) {
    return { playerId, playerName: playerId, knowledge: {} };
  }

  try {
    const parsed = JSON.parse(raw);

    // Migration: convert old entries[] format to knowledge record
    if (Array.isArray(parsed.entries)) {
      const knowledge: Record<string, KnowledgeStatus> = {};
      for (const entry of parsed.entries as string[]) {
        const migrated = migrateEntry(entry);
        if (migrated) knowledge[migrated.key] = migrated.status;
      }
      return {
        playerId: parsed.playerId || playerId,
        playerName: parsed.playerName || parsed.playerId || playerId,
        knowledge,
      };
    }

    return {
      playerId: parsed.playerId || playerId,
      playerName: parsed.playerName || playerId,
      knowledge: parsed.knowledge || {},
    };
  } catch {
    return { playerId, playerName: playerId, knowledge: {} };
  }
}

/** Convert old "npc-met:slug" string format to new { key, status } */
function migrateEntry(entry: string): KnowledgeEntry | null {
  if (entry.startsWith("npc-met:")) {
    return { key: `npc-${entry.slice(8)}`, status: "confirmed" };
  }
  if (entry.startsWith("location-visited:")) {
    return { key: `loc-${entry.slice(17)}`, status: "confirmed" };
  }
  if (entry.startsWith("environment-observed:")) {
    return { key: `loc-${entry.slice(20)}`, status: "confirmed" };
  }
  if (entry.startsWith("clue:")) {
    return { key: `clue-${entry.slice(5)}`, status: "rumored" };
  }
  return null;
}

/**
 * Add knowledge entries to a player's ledger.
 * Escalates status: rumored → confirmed. Never downgrades.
 */
export async function addKnowledge(
  playerId: string,
  playerName: string,
  newEntries: KnowledgeEntry[]
): Promise<void> {
  if (newEntries.length === 0) return;

  const ledger = await readKnowledgeLedger(playerId);
  ledger.playerName = playerName;
  let changed = false;

  for (const entry of newEntries) {
    const current = ledger.knowledge[entry.key];
    if (!current) {
      // New knowledge
      ledger.knowledge[entry.key] = entry.status;
      changed = true;
    } else if (current === "rumored" && entry.status === "confirmed") {
      // Escalate
      ledger.knowledge[entry.key] = "confirmed";
      changed = true;
    }
    // "confirmed" never downgrades; "unknown" is the absence of a key
  }

  if (!changed) return;

  await writeMemoryLevel(
    2,
    `knowledge-${playerId}`,
    JSON.stringify(ledger, null, 2)
  );
}

/**
 * Derive knowledge entries from pipeline events.
 * Called after the pipeline runs for a player's message.
 *
 * NPC mentions start as "rumored"; locations are "confirmed" (you're there).
 * Repeated NPC encounters escalate to "confirmed" via addKnowledge.
 */
export function deriveKnowledge(
  events: Array<{ type: string; data: Record<string, unknown> }>,
  currentLocation: string
): KnowledgeEntry[] {
  const entries: KnowledgeEntry[] = [];

  for (const event of events) {
    switch (event.type) {
      case "npc_mention": {
        const slug = event.data.slug as string;
        if (slug) entries.push({ key: `npc-${slug}`, status: "rumored" });
        break;
      }
      case "location_change": {
        const to = event.data.to as string;
        if (to) {
          entries.push({
            key: `loc-${to.toLowerCase().replace(/\s+/g, "-")}`,
            status: "confirmed",
          });
        }
        break;
      }
      case "environment_change": {
        entries.push({
          key: `loc-${currentLocation.toLowerCase().replace(/\s+/g, "-")}`,
          status: "confirmed",
        });
        break;
      }
    }
  }

  // Always record current location as confirmed (player is there)
  if (currentLocation) {
    entries.push({
      key: `loc-${currentLocation.toLowerCase().replace(/\s+/g, "-")}`,
      status: "confirmed",
    });
  }

  return entries;
}
