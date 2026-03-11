import type { MemoryWrite, DetectedEvent } from "./types";

export interface NpcConfig {
  name: string;
  role: string;
  description?: string;
  agenda?: string;
}

/**
 * Extract NPC mentions from narrative text by matching against known NPC names.
 * Uses whole-word, case-insensitive matching. Also checks for last-name-only matches.
 */
export function extractNpcMentions(
  narrative: string,
  knownNpcs: NpcConfig[],
  existingNpcKeys: string[]
): { memoryWrites: MemoryWrite[]; events: DetectedEvent[] } {
  const memoryWrites: MemoryWrite[] = [];
  const events: DetectedEvent[] = [];
  const mentionedNames: string[] = [];

  for (const npc of knownNpcs) {
    // Build patterns: full name + last name
    const patterns: RegExp[] = [
      new RegExp(`\\b${escapeRegex(npc.name)}\\b`, "i"),
    ];
    const nameParts = npc.name.split(/\s+/);
    if (nameParts.length > 1) {
      const lastName = nameParts[nameParts.length - 1];
      // Only match last name if it's long enough to be unambiguous
      if (lastName.length >= 4) {
        patterns.push(new RegExp(`\\b${escapeRegex(lastName)}\\b`, "i"));
      }
    }

    const mentioned = patterns.some((p) => p.test(narrative));
    if (!mentioned) continue;

    mentionedNames.push(npc.name);
    const slug = slugify(npc.name);
    const isFirstMention = !existingNpcKeys.includes(slug);

    events.push({
      type: "npc_mention",
      data: {
        name: npc.name,
        slug,
        firstMention: isFirstMention,
      },
    });

    // Create stub for new NPCs (not already in memory)
    if (isFirstMention) {
      const npcData = {
        name: npc.name,
        role: npc.role,
        description: npc.description || "",
        status: "mentioned",
        firstMentionedIn: "narrative",
      };
      memoryWrites.push({
        level: 2,
        key: slug,
        value: JSON.stringify(npcData, null, 2),
      });
    }
  }

  return { memoryWrites, events };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
