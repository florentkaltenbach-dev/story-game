import "dotenv/config";
import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import { readFile, readdir } from "fs/promises";
import { join, extname } from "path";
import {
  MODE_TIERS,
  MODE_MAX_TOKENS,
  TIER_BUDGETS,
  estimateTokens,
  truncateToTokens,
  RateLimiter,
} from "./lib";

// === Types (duplicated from web — minimal subset) ===

type MemoryLevelNumber = 1 | 2 | 3 | 4 | 5;

type KeeperMode =
  | "player_response"
  | "mc_query"
  | "mc_generate"
  | "journal_write"
  | "compression"
  | "thread_evaluation";

type SessionStatus = "lobby" | "active" | "paused" | "ended";
type Channel = "all" | "keeper-private" | "mc-keeper";

interface KeeperInput {
  mode: KeeperMode;
  trigger: {
    type: "player_action" | "mc_query" | "mc_narration" | "session_event";
    channel: Channel;
    content: string;
    playerId?: string;
  };
  session: {
    number: number;
    act: number;
    status: SessionStatus;
  };
  recentHistory?: Array<{ role: string; name: string; content: string }>;
  players?: Array<{ name: string; characterName: string; journal: string; notes: string }>;
}

interface KeeperResponse {
  narrative: string;
  journalUpdate?: string;
  stateUpdates: Array<{
    level: MemoryLevelNumber;
    key: string;
    value: string;
    threadId?: string;
    status?: string;
  }>;
  internalNotes?: string;
  degraded?: boolean;
}

type NarrativeThreadStatus = "dormant" | "planted" | "growing" | "ripe" | "resolved";

interface NarrativeThread {
  id: string;
  name: string;
  status: NarrativeThreadStatus;
  content: string;
}

// === Paths ===

const PROJECT_ROOT = join(__dirname, "..");
const MEMORY_ROOT = join(PROJECT_ROOT, "memory");
const CONFIG_ROOT = join(PROJECT_ROOT, "config");

// === Memory reading (read-only) ===

function memoryLevelDir(level: MemoryLevelNumber): string {
  const dirs: Record<MemoryLevelNumber, string> = {
    1: "1-plot-state",
    2: "2-character-state",
    3: "3-narrative-threads",
    4: "4-thematic-layer",
    5: "5-world-state",
  };
  return join(MEMORY_ROOT, dirs[level]);
}

async function readMemoryLevel(
  level: MemoryLevelNumber,
  filter?: string
): Promise<Record<string, string>> {
  const dir = memoryLevelDir(level);
  const result: Record<string, string> = {};

  try {
    const files = await readdir(dir);
    for (const file of files) {
      if (file.startsWith(".") || file.endsWith(".tmp")) continue;
      if (filter && !file.includes(filter)) continue;

      const content = await readFile(join(dir, file), "utf-8");
      const key = file.replace(extname(file), "");
      result[key] = content;
    }
  } catch {
    // Directory may not exist yet
  }

  return result;
}

async function listThreads(status?: NarrativeThreadStatus): Promise<NarrativeThread[]> {
  const files = await readMemoryLevel(3);
  const threads: NarrativeThread[] = [];

  for (const [, content] of Object.entries(files)) {
    try {
      const thread: NarrativeThread = JSON.parse(content);
      if (!status || thread.status === status) {
        threads.push(thread);
      }
    } catch {
      // Skip non-JSON files
    }
  }

  return threads;
}

// === Preset DNA loader (P1, cached alongside P0) ===

async function loadPresetDNA(): Promise<string> {
  try {
    const [story, techniques, world] = await Promise.all([
      readFile(join(CONFIG_ROOT, "story.json"), "utf-8"),
      readFile(join(CONFIG_ROOT, "techniques.json"), "utf-8"),
      readFile(join(CONFIG_ROOT, "world.json"), "utf-8"),
    ]);

    const s = JSON.parse(story);
    const t = JSON.parse(techniques);
    const w = JSON.parse(world);

    return `
STORY DNA:
Genre: ${s.genre}
Tone: ${s.tone.join(". ")}
Atmosphere: ${s.atmosphere}

WORLD:
Era: ${w.era}
Environment rules:
${w.environmentRules.map((r: string) => `- ${r}`).join("\n")}

NARRATIVE TECHNIQUES:
${t.narrativeTechniques.map((n: string) => `- ${n}`).join("\n")}

SENSORY PALETTE:
Sight: ${Object.entries(t.sensoryPalette.sight).map(([k, v]) => `${k}: ${v}`).join("; ")}
Sound: ${Object.entries(t.sensoryPalette.sound).map(([k, v]) => `${k}: ${v}`).join("; ")}
Touch: ${Object.entries(t.sensoryPalette.touch).map(([k, v]) => `${k}: ${v}`).join("; ")}
Smell: ${Object.entries(t.sensoryPalette.smell).map(([k, v]) => `${k}: ${v}`).join("; ")}

KEEPER BEHAVIOR RULES:
${t.keeperBehaviorRules.map((r: string) => `- ${r}`).join("\n")}`;
  } catch {
    return "\n[Preset DNA not loaded — using generic Keeper identity]";
  }
}

// === System prompt builder (P0 + P1, cached) ===

let cachedSystemPrompt: string | null = null;

async function buildSystemPrompt(): Promise<string> {
  if (cachedSystemPrompt) return cachedSystemPrompt;

  const presetDNA = await loadPresetDNA();

  cachedSystemPrompt = `You are the Keeper. You are the backstage crew, the confessional, and the memory of the ceremony. You see everything. You remember everything. You serve the story.

IDENTITY:
- You speak in academic dread register — clinical precision about impossible things
- You describe with measurements, colors, textures. The detail makes it real.
- You never name what hasn't been discovered
- You never correct a player's rational explanation — let them pile up until they collapse
- You honor player agency — if they want to turn back, the story accommodates
- No jumpscares. Lovecraftian horror is the slow realization that reality is wrong.
- The journal is the player's truth. Write it carefully.
${presetDNA}

Your responses are structured. The "narrative" field is what players see. Use "journalUpdate" for moments worth recording. Use "internalNotes" for what you observe but don't say aloud.`;

  return cachedSystemPrompt;
}

// === Context assembly ===

async function assembleContext(input: KeeperInput): Promise<{
  systemPrompt: string;
  contextBlock: string;
  totalTokenEstimate: number;
}> {
  const parts: string[] = [];
  let usedTokens = 0;
  const tiers = MODE_TIERS[input.mode];

  // P2: Current scene
  if (tiers.has("P2")) {
    const plotState = await readMemoryLevel(1);
    const sceneContent = Object.entries(plotState)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
    if (sceneContent) {
      const truncated = truncateToTokens(sceneContent, TIER_BUDGETS.P2_scene);
      parts.push(`[CURRENT SCENE]\n${truncated}`);
      usedTokens += Math.min(estimateTokens(sceneContent), TIER_BUDGETS.P2_scene);
    }
  }

  // P3: Characters present (NPCs from filesystem + players from runtime)
  if (tiers.has("P3")) {
    const characters = await readMemoryLevel(2);
    let charContent = Object.entries(characters)
      .map(([, v]) => {
        try {
          const npc = JSON.parse(v);
          return [
            `NPC: ${npc.name} (${npc.role})`,
            `Location: ${npc.location}`,
            `Motive: ${npc.motive}`,
            `Personality: ${npc.personality}`,
            npc.hiddenKnowledge ? `Knows: ${npc.hiddenKnowledge.join("; ")}` : "",
            npc.vulnerabilities ? `Vulnerabilities: ${npc.vulnerabilities.join("; ")}` : "",
          ].filter(Boolean).join("\n");
        } catch {
          return v;  // non-JSON files pass through unchanged
        }
      })
      .join("\n\n");

    if (input.players && input.players.length > 0) {
      const playerBlock = input.players
        .map(p => `PLAYER: ${p.name} (${p.characterName})\nJournal: ${p.journal}\nNotes: ${p.notes || "none"}`)
        .join("\n\n");
      charContent = charContent ? charContent + "\n\n" + playerBlock : playerBlock;
    }

    if (charContent) {
      const truncated = truncateToTokens(charContent, TIER_BUDGETS.P3_characters);
      parts.push(`[CHARACTERS PRESENT]\n${truncated}`);
      usedTokens += Math.min(estimateTokens(charContent), TIER_BUDGETS.P3_characters);
    }
  }

  // P4: Active threads
  if (tiers.has("P4")) {
    const threads = await listThreads();
    const activeThreads = threads.filter(
      (t) => t.status !== "dormant" && t.status !== "resolved"
    );
    if (activeThreads.length > 0) {
      const threadContent = activeThreads
        .map((t) => `[${t.status.toUpperCase()}] ${t.name}: ${t.content}`)
        .join("\n");
      const truncated = truncateToTokens(threadContent, TIER_BUDGETS.P4_threads);
      parts.push(`[ACTIVE THREADS]\n${truncated}`);
      usedTokens += Math.min(estimateTokens(threadContent), TIER_BUDGETS.P4_threads);
    }
  }

  // P5: Thematic register
  if (tiers.has("P5")) {
    const thematic = await readMemoryLevel(4);
    const themeContent = Object.entries(thematic)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
    if (themeContent) {
      const truncated = truncateToTokens(themeContent, TIER_BUDGETS.P5_theme);
      parts.push(`[THEMATIC REGISTER]\n${truncated}`);
      usedTokens += Math.min(estimateTokens(themeContent), TIER_BUDGETS.P5_theme);
    }
  }

  // P6: World state
  if (tiers.has("P6")) {
    const worldState = await readMemoryLevel(5);
    const worldContent = Object.entries(worldState)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
    if (worldContent) {
      const truncated = truncateToTokens(worldContent, TIER_BUDGETS.P6_world);
      parts.push(`[WORLD STATE]\n${truncated}`);
      usedTokens += Math.min(estimateTokens(worldContent), TIER_BUDGETS.P6_world);
    }
  }

  // P7: Recent history (conversation context)
  if (tiers.has("P7") && input.recentHistory && input.recentHistory.length > 0) {
    const historyLines = input.recentHistory.map(
      (h) => `${h.name} (${h.role}): ${h.content}`
    );
    const historyContent = historyLines.join("\n");
    const truncated = truncateToTokens(historyContent, TIER_BUDGETS.P7_history);
    parts.push(`[RECENT CONVERSATION]\n${truncated}`);
    usedTokens += Math.min(estimateTokens(historyContent), TIER_BUDGETS.P7_history);
  }

  // P8: The input (always included)
  const inputLabel = input.trigger.type.toUpperCase().replace("_", " ");
  parts.push(`[${inputLabel}]\n${input.trigger.content}`);
  usedTokens += estimateTokens(input.trigger.content);

  // Merge all context into a single user message (saves ~50 tokens vs separate messages)
  const contextBlock = parts.join("\n\n---\n\n");

  const systemPrompt = await buildSystemPrompt();

  return {
    systemPrompt,
    contextBlock,
    totalTokenEstimate: usedTokens + estimateTokens(systemPrompt),
  };
}

// === Keeper output schema ===

const KEEPER_OUTPUT_SCHEMA = {
  type: "object" as const,
  properties: {
    narrative: { type: "string" as const, description: "Response to the player/MC — this is what they see" },
    journalUpdate: { type: ["string", "null"] as const, description: "If this moment should be recorded in the player's journal" },
    stateUpdates: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          level: { type: "integer" as const, description: "Memory level 1-5" },
          key: { type: "string" as const },
          value: { type: "string" as const },
        },
        required: ["level", "key", "value"] as const,
        additionalProperties: false,
      },
    },
    internalNotes: { type: ["string", "null"] as const, description: "What the Keeper notices but doesn't say — for future context" },
  },
  required: ["narrative", "stateUpdates"] as const,
  additionalProperties: false,
};

// === ClaudeKeeper ===

class ClaudeKeeper {
  private client: Anthropic;
  private model: string;
  private maxTokens: number;

  constructor() {
    this.client = new Anthropic();
    this.model = process.env.KEEPER_MODEL ?? "claude-haiku-4-5-20251001";
    this.maxTokens = parseInt(process.env.KEEPER_MAX_TOKENS_PER_RESPONSE ?? "1024");
  }

  async query(
    systemPrompt: string,
    contextBlock: string,
    mode?: KeeperMode
  ): Promise<KeeperResponse> {
    // Single user message with all context merged (no "Understood." filler)
    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: contextBlock },
    ];

    const maxTokens = mode ? (MODE_MAX_TOKENS[mode] ?? this.maxTokens) : this.maxTokens;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      system: [{
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" },
      }],
      messages,
      output_config: {
        format: {
          type: "json_schema",
          schema: KEEPER_OUTPUT_SCHEMA,
        },
      },
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    // Log cache performance
    const usage = response.usage as unknown as Record<string, number>;
    if (usage.cache_read_input_tokens || usage.cache_creation_input_tokens) {
      console.log(`[Keeper] Cache: ${usage.cache_read_input_tokens ?? 0} read, ${usage.cache_creation_input_tokens ?? 0} created`);
    }

    return this.parseResponse(text);
  }

  private parseResponse(text: string): KeeperResponse {
    try {
      let clean = text.trim();
      if (clean.startsWith("```")) {
        clean = clean.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
      }
      const parsed = JSON.parse(clean);
      return {
        narrative: parsed.narrative,
        journalUpdate: parsed.journalUpdate ?? undefined,
        stateUpdates: parsed.stateUpdates,
        internalNotes: parsed.internalNotes ?? undefined,
        degraded: false,
      };
    } catch {
      return {
        narrative: text,
        stateUpdates: [],
        degraded: false,
      };
    }
  }
}

// === Express server ===

const app = express();
app.use(express.json());

// Inter-process auth: validate shared secret from web process
const KEEPER_SHARED_SECRET = process.env.KEEPER_SHARED_SECRET;
if (KEEPER_SHARED_SECRET) {
  app.use((req, res, next) => {
    // Health endpoint is unauthenticated
    if (req.path === "/health") return next();
    if (req.headers["x-ceremony-secret"] !== KEEPER_SHARED_SECRET) {
      res.status(401).json({ error: "Invalid inter-process secret" });
      return;
    }
    next();
  });
}

const PORT = parseInt(process.env.KEEPER_PORT ?? "3005");
const limiter = new RateLimiter(
  parseInt(process.env.KEEPER_MAX_REQUESTS_PER_MINUTE ?? "10"),
  parseInt(process.env.KEEPER_MAX_REQUESTS_PER_SESSION ?? "100"),
);
let keeper: ClaudeKeeper | null = null;

if (process.env.ANTHROPIC_API_KEY) {
  keeper = new ClaudeKeeper();
  console.log(`[Keeper] Waking up with model: ${process.env.KEEPER_MODEL ?? "claude-haiku-4-5-20251001"}`);
} else {
  console.log("[Keeper] No API key — will return errors on /query");
}

app.post("/query", async (req, res) => {
  if (!keeper) {
    res.status(503).json({
      narrative: "[The Keeper has no voice. Set ANTHROPIC_API_KEY.]",
      stateUpdates: [],
      degraded: true,
    });
    return;
  }

  const { input } = req.body as { input: KeeperInput };
  if (!input) {
    res.status(400).json({ error: "Missing 'input' in request body" });
    return;
  }

  // Rate limit
  const check = limiter.check();
  if (!check.allowed) {
    res.json({
      narrative: check.reason!,
      stateUpdates: [],
      degraded: true,
    });
    return;
  }

  try {
    const context = await assembleContext(input);
    limiter.record();
    const response = await keeper.query(context.systemPrompt, context.contextBlock, input.mode);
    const { session: usage, limit } = limiter.usage;
    console.log(`[Keeper] Request ${usage}/${limit} | ~${context.totalTokenEstimate} input tokens`);
    res.json(response);
  } catch (err) {
    console.error("[Keeper] Error:", err);
    res.json({
      narrative: "[The Keeper is momentarily silent. The wind fills the pause.]",
      stateUpdates: [],
      degraded: true,
    });
  }
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    hasApiKey: !!process.env.ANTHROPIC_API_KEY,
    model: process.env.KEEPER_MODEL ?? "claude-haiku-4-5-20251001",
    usage: limiter.usage,
  });
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`[Keeper] Listening on http://127.0.0.1:${PORT}`);
});
