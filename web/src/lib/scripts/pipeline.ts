import type { PipelineInput, PipelineResult, MemoryWrite, DetectedEvent, JournalEntry, WidgetOp } from "./types";
import type { GameWidget } from "../types";
import { processJournal } from "./journal";
import { extractNpcMentions, type NpcConfig } from "./npc-extractor";
import { detectLocation, type LocationConfig } from "./location";
import { extractEnvironment } from "./environment";
import { deriveWidgets } from "./widget-deriver";

export interface PipelineContext {
  knownNpcs: NpcConfig[];
  existingNpcKeys: string[];
  knownLocations: LocationConfig[];
  currentLocation: string;
  existingWidgets: GameWidget[];
}

/**
 * Run the full deterministic pipeline on a Keeper response.
 * Extracts journal entries, NPC mentions, location changes,
 * environment data, and derives widgets from memory writes.
 *
 * Pure function — does not write to filesystem or emit events.
 */
export function runPipeline(
  input: PipelineInput,
  context: PipelineContext
): PipelineResult {
  const journalEntries: JournalEntry[] = [];
  const memoryWrites: MemoryWrite[] = [];
  const detectedEvents: DetectedEvent[] = [];

  // 1. Journal processing
  if (input.journalUpdate && input.playerId) {
    journalEntries.push(processJournal(input.journalUpdate, input.playerId));
  }

  // 2. NPC extraction
  const npcResult = extractNpcMentions(
    input.narrative,
    context.knownNpcs,
    context.existingNpcKeys
  );
  memoryWrites.push(...npcResult.memoryWrites);
  detectedEvents.push(...npcResult.events);

  // 3. Location detection
  const locationResult = detectLocation(
    input.narrative,
    context.knownLocations,
    context.currentLocation
  );
  memoryWrites.push(...locationResult.memoryWrites);
  detectedEvents.push(...locationResult.events);

  // 4. Environment extraction
  const envResult = extractEnvironment(input.narrative);
  memoryWrites.push(...envResult.memoryWrites);
  detectedEvents.push(...envResult.events);

  // 5. Derive widgets from memory writes
  const widgetOps: WidgetOp[] = deriveWidgets(
    memoryWrites,
    context.existingWidgets
  );

  return {
    journalEntries,
    memoryWrites,
    widgetOps,
    detectedEvents,
  };
}
