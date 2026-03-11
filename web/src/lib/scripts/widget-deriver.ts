import type { MemoryWrite, WidgetOp } from "./types";
import type { GameWidget, NpcDossierData, EnvironmentData } from "../types";

/**
 * Derive widget operations from memory writes.
 * Rules:
 *   - Level 2 NPC file → upsert npc_dossier widget
 *   - Level 5 environment write → upsert environment widget
 *   - Deterministic IDs prevent duplicates
 */
export function deriveWidgets(
  memoryWrites: MemoryWrite[],
  existingWidgets: GameWidget[]
): WidgetOp[] {
  const ops: WidgetOp[] = [];

  for (const write of memoryWrites) {
    // Level 2: NPC files → npc_dossier widgets
    if (write.level === 2) {
      const npcWidget = deriveNpcWidget(write, existingWidgets);
      if (npcWidget) ops.push(npcWidget);
    }

    // Level 5: environment → environment widget
    if (write.level === 5 && write.key === "current-environment") {
      const envWidget = deriveEnvironmentWidget(write, existingWidgets);
      if (envWidget) ops.push(envWidget);
    }
  }

  return ops;
}

function deriveNpcWidget(
  write: MemoryWrite,
  _existing: GameWidget[]
): WidgetOp | null {
  try {
    const data = JSON.parse(write.value);
    if (!data.name) return null;

    const npcData: NpcDossierData = {
      name: data.name,
      role: data.role || "Unknown",
      description: data.description || undefined,
      knownFacts: buildKnownFacts(data),
      attitude: data.personality || undefined,
    };

    const widget: GameWidget = {
      id: `auto-npc-${write.key}`,
      kind: "npc_dossier",
      label: data.name,
      target: "all",
      data: npcData,
      updatedAt: Date.now(),
      priority: 50,
    };

    return { action: "upsert", widget };
  } catch {
    return null;
  }
}

function deriveEnvironmentWidget(
  write: MemoryWrite,
  _existing: GameWidget[]
): WidgetOp | null {
  try {
    const data = JSON.parse(write.value);
    if (!data.conditions || !Array.isArray(data.conditions)) return null;

    const envData: EnvironmentData = {
      conditions: data.conditions.map((c: { label: string; value: string; unit?: string }) => ({
        label: c.label,
        value: c.value,
        unit: c.unit,
      })),
    };

    const widget: GameWidget = {
      id: "auto-env",
      kind: "environment",
      label: "Environment",
      icon: "thermometer",
      target: "all",
      data: envData,
      updatedAt: Date.now(),
      priority: 10,
    };

    return { action: "upsert", widget };
  } catch {
    return null;
  }
}

function buildKnownFacts(npcData: Record<string, unknown>): string[] {
  const facts: string[] = [];
  if (npcData.description) facts.push(String(npcData.description));
  if (npcData.agenda) facts.push(`Agenda: ${npcData.agenda}`);
  if (Array.isArray(npcData.hiddenKnowledge)) {
    facts.push(...npcData.hiddenKnowledge.map(String));
  }
  return facts;
}
