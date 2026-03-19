/**
 * GET /api/story-data — Unified story data graph for all visualizations.
 *
 * Reads config/ and memory/ and returns a single canonical object:
 *   { nodes, edges, sessions, locations, threads, fog, meta }
 *
 * Every visualization (relationship-map, story-skeleton, fog-matrix, etc.)
 * fetches from this endpoint instead of hardcoding data.
 *
 * Query params:
 *   ?slice=relationships   — only nodes + edges (relationship-map)
 *   ?slice=narrative        — sessions + acts + locations (story-skeleton)
 *   ?slice=fog              — fog matrix data
 *   ?slice=all              — everything (default)
 *   ?version=<etag>         — returns 304 if unchanged (cache-friendly)
 */

import { NextResponse } from "next/server";
import { readFile, readdir } from "fs/promises";
import { join } from "path";
import { createHash } from "crypto";
import type { StoryNode, StoryEdge, SessionDef, FogEntry, StoryDataGraph } from "@/lib/types";

const PROJECT_ROOT = join(process.cwd(), "..");
const CONFIG_ROOT = join(PROJECT_ROOT, "config");
const MEMORY_ROOT = join(PROJECT_ROOT, "memory");

// ── Helpers ────────────────────────────────────────────

async function readJsonSafe<T>(filepath: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(filepath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function readMemoryDir(level: string): Promise<Record<string, unknown>[]> {
  const dir = join(MEMORY_ROOT, level);
  const results: Record<string, unknown>[] = [];
  try {
    const files = await readdir(dir);
    for (const file of files) {
      if (file.startsWith(".")) continue;
      const filepath = join(dir, file);
      try {
        const raw = await readFile(filepath, "utf-8");
        // Try JSON first, fall back to wrapping raw text
        try {
          const parsed = JSON.parse(raw);
          results.push({ _file: file, ...parsed });
        } catch {
          results.push({ _file: file, _raw: raw });
        }
      } catch {
        // Skip unreadable files
      }
    }
  } catch {
    // Directory may not exist
  }
  return results;
}

// ── Graph Assembly ─────────────────────────────────────

/** Infer edge type from relationship description text */
function inferEdgeType(desc: string): StoryEdge["type"] {
  const d = desc.toLowerCase();
  if (/distrust|resent|disagree|tension|hostile|conflict|suspects|rival/.test(d)) return "tension";
  if (/secret|hidden|covert|coded|doesn't know|private/.test(d)) return "secret";
  return "bond";
}

/** Build a name→id lookup from all known nodes for fuzzy text matching */
function buildNameIndex(nodes: StoryNode[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const n of nodes) {
    // Index by full name
    index.set(n.name.toLowerCase(), n.id);
    // Index by last word (surname) for NPC matching in prose
    const words = n.name.split(/\s+/);
    if (words.length > 1 && n.type === "npc") {
      const surname = words[words.length - 1].toLowerCase();
      // Only index surnames that are distinctive (>3 chars, not generic)
      if (surname.length > 3 && !["first", "agent", "second"].includes(surname)) {
        index.set(surname, n.id);
      }
    }
    // Index by id for pool characters (e.g., "pabodie" → "scientist-pabodie")
    if (n.type === "player") {
      const idParts = n.id.split("-");
      if (idParts.length > 1) {
        index.set(idParts[idParts.length - 1], n.id);
      }
    }
  }
  return index;
}

/** Scan text for known entity names and return matched node IDs */
function findMentionedEntities(text: string, nameIndex: Map<string, string>, excludeId?: string): string[] {
  const found = new Set<string>();
  const lower = text.toLowerCase();
  for (const [name, id] of nameIndex) {
    if (id === excludeId) continue;
    // Match as whole word (avoid partial matches like "ice" in "Price")
    const pattern = new RegExp("\\b" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b");
    if (pattern.test(lower)) {
      found.add(id);
    }
  }
  return Array.from(found);
}

async function buildStoryGraph(): Promise<StoryDataGraph> {
  // 1. Read config files
  const story = await readJsonSafe<Record<string, unknown>>(
    join(CONFIG_ROOT, "story.json"), {}
  );
  const world = await readJsonSafe<Record<string, unknown>>(
    join(CONFIG_ROOT, "world.json"), {}
  );
  const characters = await readJsonSafe<{
    archetypes?: Array<Record<string, string>>;
    npcs?: Array<Record<string, string>>;
    pool?: Array<Record<string, unknown>>;
  }>(join(CONFIG_ROOT, "characters.json"), {});
  const sessionsDef = await readJsonSafe<Array<Record<string, unknown>>>(
    join(CONFIG_ROOT, "sessions.json"), []
  );
  const fatesConfig = await readJsonSafe<{
    fates?: Array<Record<string, unknown>>;
    deathSlots?: Array<Record<string, unknown>>;
  }>(join(CONFIG_ROOT, "fates.json"), {});

  // 2. Read memory levels
  const plotState = await readMemoryDir("1-plot-state");
  const charState = await readMemoryDir("2-character-state");
  const threads = await readMemoryDir("3-narrative-threads");
  const worldState = await readMemoryDir("5-world-state");

  // 3. Build nodes
  const nodes: StoryNode[] = [];
  const edges: StoryEdge[] = [];
  const seenIds = new Set<string>();
  const seenEdges = new Set<string>(); // dedup edges by "source→target"

  function addNode(node: StoryNode) {
    if (seenIds.has(node.id)) return;
    seenIds.add(node.id);
    nodes.push(node);
  }

  function addEdge(edge: StoryEdge) {
    const key = `${edge.source}→${edge.target}`;
    const reverseKey = `${edge.target}→${edge.source}`;
    // Skip self-loops and duplicates (including reverse for undirected relationships)
    if (edge.source === edge.target) return;
    if (seenEdges.has(key)) return;
    // For bond/tension, treat as undirected — skip if reverse exists
    if ((edge.type === "bond" || edge.type === "tension") && seenEdges.has(reverseKey)) return;
    seenEdges.add(key);
    edges.push(edge);
  }

  // NPCs from config
  if (characters.npcs) {
    for (const npc of characters.npcs) {
      const id = slugify(npc.name);
      addNode({
        id,
        name: npc.name,
        type: "npc",
        desc: npc.description || "",
        role: npc.role || "",
        status: "active",
      });
    }
  }

  // Player archetypes from config (only if no pool)
  if (characters.archetypes) {
    for (const arch of characters.archetypes) {
      const id = slugify(arch.name);
      addNode({
        id,
        name: arch.name,
        type: "player",
        desc: arch.motivation || "",
        role: arch.skills || "",
      });
    }
  }

  // Pool characters from config (detailed dossiers)
  if (characters.pool) {
    for (const char of characters.pool) {
      const id = (char.id as string) || slugify(char.name as string);
      addNode({
        id,
        name: char.name as string,
        type: "player",
        desc: (char.motivation as string) || (char.tagline as string) || "",
        role: (char.archetype as string) || "",
        meta: {
          tagline: char.tagline,
          background: char.background,
          fear: char.fear,
        },
      });
    }
  }

  // NPC state from memory level 2 (runtime overrides)
  for (const entry of charState) {
    const file = entry._file as string;
    if (!file.startsWith("npc-")) continue;
    const npcId = file.replace("npc-", "").replace(/\.json$/, "");
    const existing = nodes.find((n) => n.id === npcId);
    if (existing) {
      // Merge runtime state
      if (entry.status) existing.status = String(entry.status);
      if (entry.disposition) existing.meta = { ...existing.meta, disposition: entry.disposition };
    }
  }

  // Locations from world config
  const geography = (world.geography || {}) as Record<string, string>;
  for (const [locName, locDesc] of Object.entries(geography)) {
    const id = slugify(locName);
    addNode({
      id,
      name: locName,
      type: "location",
      desc: String(locDesc),
    });
  }

  // Locations from memory level 5 (runtime additions)
  for (const entry of worldState) {
    const file = entry._file as string;
    if (!file.includes("location")) continue;
    if (entry.locations && Array.isArray(entry.locations)) {
      for (const loc of entry.locations as Array<Record<string, string>>) {
        const id = slugify(loc.name);
        addNode({
          id,
          name: loc.name,
          type: "location",
          desc: loc.description || "",
          session: loc.session ? Number(loc.session) : undefined,
        });
      }
    }
  }

  // Threads from memory level 3
  for (const entry of threads) {
    const file = entry._file as string;
    const threadId = "t-" + file.replace(/\.json$/, "");
    const name = (entry.name as string) || file.replace(/\.json$/, "").replace(/-/g, " ");
    addNode({
      id: threadId,
      name,
      type: "thread",
      desc: (entry.content as string) || (entry.description as string) || "",
      status: (entry.status as string) || "dormant",
      meta: {
        plantedAt: entry.plantedAt,
        payoff: entry.payoff,
        plantWindow: entry.plantWindow,
        payoffWindow: entry.payoffWindow,
      },
    });
  }

  // ── Build name index for text-based edge extraction ──
  const nameIndex = buildNameIndex(nodes);

  // 4. Build edges from relationships
  // Sources:
  //   a) NPC memory files — relationship: { key: "desc" } object format
  //   b) NPC memory files — relationships: [{ target, type, desc }] array format
  //   c) Config NPC agenda text — references to other NPCs
  //   d) Pool character relationships — string arrays mentioning names
  //   e) Thread files — explicit connections field
  //   f) Thread files — triggerConditions referencing locations
  //   g) Thread content — mentions of known entities
  //   h) NPC location presence

  // (a+b+h) NPC edges from memory state
  for (const entry of charState) {
    const file = entry._file as string;
    if (!file.startsWith("npc-")) continue;
    const npcId = file.replace("npc-", "").replace(/\.json$/, "");

    // (b) Array format: relationships: [{ target, type, desc }]
    if (Array.isArray(entry.relationships)) {
      for (const rel of entry.relationships as Array<{ target: string; type: string; desc: string }>) {
        addEdge({
          source: npcId,
          target: slugify(rel.target),
          type: (rel.type as StoryEdge["type"]) || "bond",
          desc: rel.desc || "",
        });
      }
    }

    // (a) Object format: relationship: { targetKey: "description text" }
    if (entry.relationship && typeof entry.relationship === "object" && !Array.isArray(entry.relationship)) {
      for (const [targetKey, desc] of Object.entries(entry.relationship as Record<string, string>)) {
        if (targetKey === "players") continue; // Generic player reference, not a specific edge
        const targetId = slugify(targetKey);
        // Only add if target exists as a node
        if (seenIds.has(targetId)) {
          addEdge({
            source: npcId,
            target: targetId,
            type: inferEdgeType(String(desc)),
            desc: String(desc),
          });
        }
      }
    }

    // (h) Location presence
    if (entry.location) {
      addEdge({
        source: npcId,
        target: slugify(String(entry.location)),
        type: "presence",
        desc: `Located at: ${entry.location}`,
      });
    }
  }

  // (c) Config NPC edges from agenda text
  if (characters.npcs) {
    for (const npc of characters.npcs) {
      const npcId = slugify(npc.name);
      const text = [npc.agenda || "", npc.role || ""].join(" ");
      const mentions = findMentionedEntities(text, nameIndex, npcId);
      for (const targetId of mentions) {
        const targetNode = nodes.find((n) => n.id === targetId);
        if (targetNode && targetNode.type === "npc") {
          addEdge({
            source: npcId,
            target: targetId,
            type: inferEdgeType(text),
            desc: npc.agenda || "",
          });
        }
      }
    }
  }

  // (d) Pool character relationship edges from string arrays
  if (characters.pool) {
    for (const char of characters.pool) {
      const charId = (char.id as string) || slugify(char.name as string);
      const rels = (char.relationships || []) as string[];
      for (const relText of rels) {
        const mentions = findMentionedEntities(relText, nameIndex, charId);
        for (const targetId of mentions) {
          addEdge({
            source: charId,
            target: targetId,
            type: inferEdgeType(relText),
            desc: relText,
          });
        }
      }
    }
  }

  // (e+f+g) Thread edges
  for (const entry of threads) {
    const file = entry._file as string;
    const threadId = "t-" + file.replace(/\.json$/, "");

    // (e) Explicit connections field
    const connections = (entry.connections || []) as Array<{
      target: string;
      type?: string;
      desc?: string;
    }>;
    for (const conn of connections) {
      addEdge({
        source: threadId,
        target: slugify(conn.target),
        type: (conn.type as StoryEdge["type"]) || "thread-link",
        desc: conn.desc || "",
      });
    }

    // (f) Derive connections from triggerConditions
    const triggers = (entry.triggerConditions || []) as Array<Record<string, unknown>>;
    for (const cond of triggers) {
      if (cond.type === "location" && cond.value) {
        // Find location nodes that match the trigger value
        const val = String(cond.value).toLowerCase();
        for (const n of nodes) {
          if (n.type === "location" && n.name.toLowerCase().includes(val)) {
            addEdge({
              source: threadId,
              target: n.id,
              type: "thread-link",
              desc: `Triggered at ${n.name}`,
            });
          }
        }
      }
    }

    // (g) Derive connections from content/notes text
    const threadText = [
      entry.content as string || "",
      entry.notes as string || "",
      entry.plantWindow as string || "",
      entry.payoffWindow as string || "",
    ].join(" ");
    const mentions = findMentionedEntities(threadText, nameIndex, threadId);
    for (const targetId of mentions) {
      addEdge({
        source: threadId,
        target: targetId,
        type: "thread-link",
        desc: `Referenced in thread: ${entry.name || file}`,
      });
    }
  }

  // (i) Fate edges — connect pool characters to their death threads and locations
  if (fatesConfig.fates) {
    for (const fate of fatesConfig.fates) {
      const charId = fate.characterId as string;
      if (!charId || !seenIds.has(charId)) continue;

      // Enrich the character node with fate metadata
      const charNode = nodes.find((n) => n.id === charId);
      if (charNode) {
        charNode.meta = {
          ...charNode.meta,
          fate: {
            slot: fate.slot,
            session: fate.session,
            act: fate.act,
            manner: fate.manner,
            capabilityLost: fate.capabilityLost,
            discoverable: fate.discoverable,
          },
        };
      }

      // Create edges from character to the threads their death advances
      const advancedThreads = (fate.threadsAdvanced || []) as string[];
      for (const threadName of advancedThreads) {
        const threadId = "t-" + threadName;
        if (seenIds.has(threadId)) {
          addEdge({
            source: charId,
            target: threadId,
            type: "thread-link",
            desc: `Fate advances thread: ${threadName}`,
          });
        }
      }
    }
  }

  // 5. Build sessions
  const sessions: SessionDef[] = [];
  const sessionColors = ["#c4a35a", "#6b9e7a", "#7ba4c7", "#d47b6f", "#a78bba"];

  // Primary source: config/sessions.json (structured session/act data)
  if (sessionsDef.length > 0) {
    for (const s of sessionsDef) {
      sessions.push({
        id: Number(s.id),
        name: String(s.name || `Session ${s.id}`),
        subtitle: String(s.subtitle || ""),
        color: String(s.color || sessionColors[(Number(s.id) - 1) % sessionColors.length]),
        acts: (s.acts || []) as SessionDef["acts"],
      });
    }
  } else {
    // Fallback: generate from sessionCount
    const sessionCount = (story.sessionCount as number) || 5;
    for (let i = 1; i <= sessionCount; i++) {
      sessions.push({
        id: i,
        name: `Session ${i}`,
        subtitle: "",
        color: sessionColors[(i - 1) % sessionColors.length],
        acts: [],
      });
    }
  }

  // Enrich sessions from plot state (act summaries, session progress)
  for (const entry of plotState) {
    const file = entry._file as string;
    if (file.includes("session") && entry.sessions && Array.isArray(entry.sessions)) {
      for (const s of entry.sessions as Array<Record<string, unknown>>) {
        const idx = sessions.findIndex((ss) => ss.id === Number(s.id));
        if (idx >= 0) {
          if (s.name) sessions[idx].name = String(s.name);
          if (s.subtitle) sessions[idx].subtitle = String(s.subtitle);
          if (s.acts) sessions[idx].acts = s.acts as SessionDef["acts"];
        }
      }
    }
  }

  // 6. Build fog data
  const fog: FogEntry[] = [];
  // Read knowledge ledgers from memory level 2
  for (const entry of charState) {
    const file = entry._file as string;
    if (!file.startsWith("knowledge-")) continue;
    const playerId = file.replace("knowledge-", "").replace(/\.json$/, "");
    fog.push({
      playerId,
      playerName: (entry.playerName as string) || playerId,
      knowledge: (entry.knowledge as FogEntry["knowledge"]) || {},
    });
  }

  // 7. Build fates summary for viz consumers
  // Map slot numbers to session/act from deathSlots definitions
  const slotMap = new Map<number, { session: number; act: string; escalation: string }>();
  for (const slot of (fatesConfig.deathSlots || []) as Array<Record<string, unknown>>) {
    slotMap.set(Number(slot.slot), {
      session: Number(slot.session),
      act: String(slot.act),
      escalation: String(slot.escalation || ""),
    });
  }

  const fates = (fatesConfig.fates || []).map((f) => {
    const slotInfo = slotMap.get(Number(f.slot));
    return {
      characterId: f.characterId as string,
      name: f.name as string,
      slot: f.slot as number,
      session: slotInfo?.session ?? (f.session as number) ?? 0,
      act: slotInfo?.act ?? (f.act as string) ?? "",
      escalation: slotInfo?.escalation ?? "",
      manner: f.manner as string,
      capabilityLost: f.capabilityLost as string,
      threadsAdvanced: (f.threadsAdvanced || []) as string[],
    };
  });

  // 8. Compute content hash for cache validation
  const content = JSON.stringify({ nodes, edges, sessions, fog, fates });
  const hash = createHash("md5").update(content).digest("hex").slice(0, 12);

  return {
    nodes,
    edges,
    sessions,
    fog,
    fates,
    meta: {
      presetId: (story.presetId as string) || "unknown",
      genre: (story.genre as string) || "",
      tone: (story.tone as string[]) || [],
      era: (world.era as string) || "",
      updatedAt: new Date().toISOString(),
      hash,
    },
  };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ── Cached graph (invalidated by file watcher via module-level signal) ──

let cachedGraph: StoryDataGraph | null = null;
let cacheVersion = 0;

/** Called by the file watcher when config/ or memory/ changes */
export function invalidateStoryDataCache() {
  cachedGraph = null;
  cacheVersion++;
}

export function getStoryDataCacheVersion(): number {
  return cacheVersion;
}

// ── Route handler ──────────────────────────────────────

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slice = url.searchParams.get("slice") || "all";
  const clientVersion = url.searchParams.get("version");

  // Build or use cached graph
  if (!cachedGraph) {
    cachedGraph = await buildStoryGraph();
  }

  // 304 if client already has this version
  if (clientVersion && clientVersion === cachedGraph.meta.hash) {
    return new Response(null, { status: 304 });
  }

  // Slice the response
  let responseData: Partial<StoryDataGraph>;
  switch (slice) {
    case "relationships":
      responseData = {
        nodes: cachedGraph.nodes,
        edges: cachedGraph.edges,
        meta: cachedGraph.meta,
      };
      break;
    case "narrative":
      responseData = {
        sessions: cachedGraph.sessions,
        nodes: cachedGraph.nodes.filter(
          (n) => n.type === "location" || n.type === "thread"
        ),
        meta: cachedGraph.meta,
      };
      break;
    case "fog":
      responseData = {
        fog: cachedGraph.fog,
        nodes: cachedGraph.nodes,
        meta: cachedGraph.meta,
      };
      break;
    default:
      responseData = cachedGraph;
  }

  return NextResponse.json(responseData, {
    headers: {
      "Cache-Control": "no-cache",
      ETag: `"${cachedGraph.meta.hash}"`,
    },
  });
}

/** POST handler — invalidate cache when rigging's story-watcher detects changes */
export async function POST() {
  invalidateStoryDataCache();
  return NextResponse.json({ ok: true, version: cacheVersion });
}
