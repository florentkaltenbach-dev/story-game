import "dotenv/config";
import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import { readFile, readdir } from "fs/promises";
import { join, extname } from "path";
import type {
  MemoryLevelNumber,
  KeeperMode,
  SessionStatus,
  Channel,
  KeeperInput,
  KeeperResponse,
  NarrativeThreadStatus,
  NarrativeThread,
} from "./types";
import {
  MODE_TIERS,
  MODE_MAX_TOKENS,
  MODE_MODELS,
  TIER_BUDGETS,
  estimateTokens,
  truncateToTokens,
  RateLimiter,
  CostTracker,
} from "./lib";

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
let cachedStableContent: string | null = null;

async function buildStableContent(): Promise<string> {
  if (cachedStableContent) return cachedStableContent;

  const parts: string[] = [];

  // P5: Thematic register (changes per-session, not per-turn)
  const thematic = await readMemoryLevel(4);
  const themeContent = Object.entries(thematic)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  if (themeContent) {
    parts.push(`[THEMATIC REGISTER]\n${truncateToTokens(themeContent, TIER_BUDGETS.P5_theme)}`);
  }

  // P6: World state (changes per-session, not per-turn)
  const worldState = await readMemoryLevel(5);
  const worldContent = Object.entries(worldState)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  if (worldContent) {
    parts.push(`[WORLD STATE]\n${truncateToTokens(worldContent, TIER_BUDGETS.P6_world)}`);
  }

  cachedStableContent = parts.length > 0 ? "\n\n" + parts.join("\n\n") : "";
  return cachedStableContent;
}

/** Invalidate caches when act/session changes */
export function invalidatePromptCache(): void {
  cachedSystemPrompt = null;
  cachedStableContent = null;
}

async function buildSystemPrompt(): Promise<string> {
  if (cachedSystemPrompt) return cachedSystemPrompt;

  const presetDNA = await loadPresetDNA();
  const stableContent = await buildStableContent();

  cachedSystemPrompt = `You are the Keeper. You are the backstage crew, the confessional, and the memory of the ceremony. You see everything. You remember everything. You serve the story.

IDENTITY:
- You speak in academic dread register — clinical precision about impossible things
- You describe with measurements, colors, textures. The detail makes it real.
- You never name what hasn't been discovered
- You never correct a player's rational explanation — let them pile up until they collapse
- You honor player agency — if they want to turn back, the story accommodates
- No jumpscares. Lovecraftian horror is the slow realization that reality is wrong.
- The journal is the player's truth. Write it carefully.
${presetDNA}${stableContent}

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

  // Dynamic tier budgets: calculate unused budget from skipped tiers
  const skippedBudget = Object.entries(TIER_BUDGETS)
    .filter(([key]) => {
      const tierKey = key.split("_")[0]; // "P2_scene" → "P2"
      return !tiers.has(tierKey);
    })
    .reduce((sum, [, budget]) => sum + budget, 0);

  // Redistribute skipped budget proportionally to P3 (characters) and P7 (history)
  const p3Bonus = tiers.has("P3") ? Math.floor(skippedBudget * 0.6) : 0;
  const p7Bonus = tiers.has("P7") ? Math.floor(skippedBudget * 0.4) : 0;

  function tierBudget(key: string): number {
    const base = TIER_BUDGETS[key] ?? 0;
    if (key === "P3_characters") return base + p3Bonus;
    if (key === "P7_history") return base + p7Bonus;
    return base;
  }

  // P2: Current scene
  if (tiers.has("P2")) {
    const plotState = await readMemoryLevel(1);
    const sceneContent = Object.entries(plotState)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
    if (sceneContent) {
      const truncated = truncateToTokens(sceneContent, tierBudget("P2_scene"));
      parts.push(`[CURRENT SCENE]\n${truncated}`);
      usedTokens += Math.min(estimateTokens(sceneContent), tierBudget("P2_scene"));
    }
  }

  // P3: Characters present (NPCs from filesystem + players from runtime)
  if (tiers.has("P3")) {
    const characters = await readMemoryLevel(2);

    // Knowledge fog: filter NPCs based on player knowledge when in player_response mode
    const knownNpcs = input.playerKnowledge
      ? new Set(Object.entries(input.playerKnowledge)
          .filter(([k, v]) => k.startsWith("npc-") && (v === "rumored" || v === "confirmed"))
          .map(([k]) => k.slice(4))) // strip "npc-" prefix to get slug
      : null;

    let charContent = Object.entries(characters)
      .filter(([key]) => !key.startsWith("knowledge-") && !key.startsWith("journal-"))
      .map(([key, v]) => {
        try {
          const npc = JSON.parse(v);

          // Knowledge fog: skip NPCs the player hasn't met (player_response mode only)
          if (knownNpcs && input.mode === "player_response") {
            const npcSlug = (npc.name || key).toLowerCase().replace(/\s+/g, "-");
            if (!knownNpcs.has(npcSlug)) return "";
          }

          return [
            `NPC: ${npc.name} (${npc.role})${npc.voicedBy === "mc" ? " [MC-voiced]" : ""}`,
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
      .filter(Boolean)
      .join("\n\n");

    if (input.players && input.players.length > 0) {
      const playerBlock = input.players
        .map(p => `PLAYER: ${p.name} (${p.characterName})\nJournal: ${p.journal}\nNotes: ${p.notes || "none"}`)
        .join("\n\n");
      charContent = charContent ? charContent + "\n\n" + playerBlock : playerBlock;
    }

    if (charContent) {
      const truncated = truncateToTokens(charContent, tierBudget("P3_characters"));
      parts.push(`[CHARACTERS PRESENT]\n${truncated}`);
      usedTokens += Math.min(estimateTokens(charContent), tierBudget("P3_characters"));
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
      const truncated = truncateToTokens(threadContent, tierBudget("P4_threads"));
      parts.push(`[ACTIVE THREADS]\n${truncated}`);
      usedTokens += Math.min(estimateTokens(threadContent), tierBudget("P4_threads"));
    }
  }

  // P5/P6: Skip in dynamic context — already promoted to cached system prompt
  // (thematic register and world state change per-session, not per-turn)

  // P7: Recent history (conversation context)
  if (tiers.has("P7") && input.recentHistory && input.recentHistory.length > 0) {
    const historyLines = input.recentHistory.map(
      (h) => `${h.name} (${h.role}): ${h.content}`
    );
    const historyContent = historyLines.join("\n");
    const truncated = truncateToTokens(historyContent, tierBudget("P7_history"));
    parts.push(`[RECENT CONVERSATION]\n${truncated}`);
    usedTokens += Math.min(estimateTokens(historyContent), tierBudget("P7_history"));
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

// === Compression output schema ===

const COMPRESSION_OUTPUT_SCHEMA = {
  type: "object" as const,
  properties: {
    summary: { type: "string" as const, description: "Compressed narrative summary of what happened" },
    keyEvents: { type: "array" as const, items: { type: "string" as const }, description: "List of key events" },
    threadUpdates: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const },
          status: { type: "string" as const },
          reason: { type: "string" as const },
        },
        required: ["id", "status"] as const,
      },
      description: "Narrative thread status changes",
    },
  },
  required: ["summary", "keyEvents"] as const,
  additionalProperties: false,
};

// === Thread evaluation output schema ===

const THREAD_EVAL_OUTPUT_SCHEMA = {
  type: "object" as const,
  properties: {
    threadUpdates: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const, description: "Thread ID" },
          newStatus: { type: "string" as const, description: "New status: dormant, planted, growing, ripe, resolved" },
          reason: { type: "string" as const, description: "Brief reason for status change" },
        },
        required: ["id", "newStatus", "reason"] as const,
      },
      description: "Thread status changes",
    },
  },
  required: ["threadUpdates"] as const,
  additionalProperties: false,
};

// === Keeper output schema ===

const KEEPER_OUTPUT_SCHEMA = {
  type: "object" as const,
  properties: {
    narrative: { type: "string" as const, description: "Response to the player/MC — this is what they see" },
    journalUpdate: { type: ["string", "null"] as const, description: "If this moment should be recorded in the player's journal" },
    internalNotes: { type: ["string", "null"] as const, description: "What the Keeper notices but doesn't say — for future context" },
  },
  required: ["narrative"] as const,
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
    // Model routing: use mode-specific model, fallback to default
    const model = mode ? (MODE_MODELS[mode] ?? this.model) : this.model;

    const response = await this.client.messages.create({
      model,
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

    // Return response with raw usage for cost tracking
    const parsed = this.parseResponse(text);
    (parsed as KeeperResponse & { _usage?: unknown; _model?: string })._usage = response.usage;
    (parsed as KeeperResponse & { _model?: string })._model = model;
    return parsed;
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
        internalNotes: parsed.internalNotes ?? undefined,
        degraded: false,
      };
    } catch {
      return {
        narrative: text,
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
const costTracker = new CostTracker();

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

    // Track cost
    const rawResponse = response as KeeperResponse & { _usage?: Record<string, number>; _model?: string };
    if (rawResponse._usage) {
      costTracker.record(input.mode, rawResponse._model ?? "claude-haiku-4-5-20251001", rawResponse._usage);
      delete rawResponse._usage;
      delete rawResponse._model;
    }

    res.json(response);
  } catch (err) {
    console.error("[Keeper] Error:", err);
    res.json({
      narrative: "[The Keeper is momentarily silent. The wind fills the pause.]",
      degraded: true,
    });
  }
});

// Streaming endpoint for player_response mode
// Uses prompt-based JSON instruction instead of output_config.format.json_schema
// (json_schema forces non-streaming)
app.post("/query/stream", async (req, res) => {
  if (!keeper) {
    res.status(503).json({
      narrative: "[The Keeper has no voice. Set ANTHROPIC_API_KEY.]",
      degraded: true,
    });
    return;
  }

  const { input } = req.body as { input: KeeperInput };
  if (!input) {
    res.status(400).json({ error: "Missing 'input' in request body" });
    return;
  }

  const check = limiter.check();
  if (!check.allowed) {
    res.json({ narrative: check.reason!, degraded: true });
    return;
  }

  try {
    const context = await assembleContext(input);
    limiter.record();

    // Augment system prompt with JSON format instruction
    const streamSystemPrompt = context.systemPrompt +
      "\n\nIMPORTANT: You MUST respond in valid JSON with this exact structure: " +
      '{"narrative": "your response text", "journalUpdate": "optional journal entry or null", "internalNotes": "optional internal notes or null"}' +
      "\nDo NOT include markdown code fences. Output raw JSON only.";

    const model = MODE_MODELS[input.mode] ?? keeper["model"];
    const maxTokens = MODE_MAX_TOKENS[input.mode] ?? 1024;

    // Set up SSE response
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const stream = keeper["client"].messages.stream({
      model,
      max_tokens: maxTokens,
      system: [{ type: "text", text: streamSystemPrompt, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: context.contextBlock }],
    });

    let fullText = "";
    // Track whether we're inside the narrative value for partial streaming
    let narrativeStarted = false;

    stream.on("text", (text) => {
      fullText += text;

      // Simple heuristic: stream text once we're past the opening {"narrative":"
      if (!narrativeStarted) {
        const narrativeMatch = fullText.match(/"narrative"\s*:\s*"/);
        if (narrativeMatch) {
          narrativeStarted = true;
          // Send everything after the opening quote
          const start = narrativeMatch.index! + narrativeMatch[0].length;
          const partial = fullText.slice(start);
          if (partial) {
            res.write(`data: ${JSON.stringify({ type: "text", content: partial })}\n\n`);
          }
        }
      } else {
        // Send new text chunks as they arrive
        res.write(`data: ${JSON.stringify({ type: "text", content: text })}\n\n`);
      }
    });

    const finalMessage = await stream.finalMessage();

    // Track cost
    const usage = finalMessage.usage as unknown as Record<string, number>;
    costTracker.record(input.mode, model, usage);

    // Parse the full response
    let parsed: KeeperResponse;
    try {
      let clean = fullText.trim();
      if (clean.startsWith("```")) {
        clean = clean.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
      }
      const json = JSON.parse(clean);
      parsed = {
        narrative: json.narrative,
        journalUpdate: json.journalUpdate ?? undefined,
        internalNotes: json.internalNotes ?? undefined,
        degraded: false,
      };
    } catch {
      parsed = { narrative: fullText, degraded: false };
    }

    const { session: sUsage, limit } = limiter.usage;
    console.log(`[Keeper] Stream ${sUsage}/${limit} | ~${context.totalTokenEstimate} input tokens`);

    // Send final parsed response
    res.write(`data: ${JSON.stringify({ type: "done", response: parsed })}\n\n`);
    res.end();
  } catch (err) {
    console.error("[Keeper] Stream error:", err);
    res.write(`data: ${JSON.stringify({ type: "error", message: "The Keeper is momentarily silent." })}\n\n`);
    res.end();
  }
});

app.post("/evaluate-threads", async (req, res) => {
  if (!keeper) {
    res.status(503).json({ error: "Keeper not available" });
    return;
  }

  const { threads, recentMessages } = req.body as {
    threads: Array<{ id: string; name: string; status: string; content: string }>;
    recentMessages: Array<{ role: string; name: string; content: string }>;
  };

  if (!threads || !recentMessages) {
    res.status(400).json({ error: "threads and recentMessages required" });
    return;
  }

  try {
    const systemPrompt = await buildSystemPrompt();
    const threadBlock = threads
      .map((t) => `[${t.status.toUpperCase()}] ${t.name} (${t.id}): ${t.content}`)
      .join("\n");
    const historyBlock = recentMessages
      .map((m) => `${m.name} (${m.role}): ${m.content}`)
      .join("\n");

    const contextBlock = `[THREAD EVALUATION]
Review these narrative threads against recent events. Report any status changes.

[CURRENT THREADS]
${threadBlock}

[RECENT MESSAGES]
${historyBlock}`;

    const model = MODE_MODELS["thread_evaluation"] ?? keeper["model"];
    const maxTokens = MODE_MAX_TOKENS["thread_evaluation"] ?? 256;

    const response = await keeper["client"].messages.create({
      model,
      max_tokens: maxTokens,
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: contextBlock }],
      output_config: { format: { type: "json_schema", schema: THREAD_EVAL_OUTPUT_SCHEMA } },
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    const usage = response.usage as unknown as Record<string, number>;
    costTracker.record("thread_evaluation", model, usage);
    limiter.record();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { threadUpdates: [] };
    }

    console.log(`[Keeper] Thread evaluation: ${parsed.threadUpdates?.length ?? 0} updates`);
    res.json(parsed);
  } catch (err) {
    console.error("[Keeper] Thread evaluation error:", err);
    res.status(500).json({ error: "Thread evaluation failed" });
  }
});

app.post("/compress", async (req, res) => {
  if (!keeper) {
    res.status(503).json({ error: "Keeper not available" });
    return;
  }

  const { messages: rawMessages, sessionNumber, act } = req.body as {
    messages: Array<{ role: string; name: string; content: string }>;
    sessionNumber: number;
    act: number;
  };

  if (!rawMessages || !Array.isArray(rawMessages)) {
    res.status(400).json({ error: "messages array required" });
    return;
  }

  try {
    const systemPrompt = await buildSystemPrompt();
    const historyBlock = rawMessages
      .map((m) => `${m.name} (${m.role}): ${m.content}`)
      .join("\n\n");

    const contextBlock = `[COMPRESSION REQUEST]
Session ${sessionNumber}, Act ${act}

Compress the following exchange into a concise narrative summary. Capture key events, decisions, and character moments. This summary will replace the raw messages in future context.

[MESSAGES TO COMPRESS]
${historyBlock}`;

    const model = MODE_MODELS["compression"] ?? keeper["model"];
    const maxTokens = MODE_MAX_TOKENS["compression"] ?? 1024;

    const response = await keeper["client"].messages.create({
      model,
      max_tokens: maxTokens,
      system: [{
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" },
      }],
      messages: [{ role: "user", content: contextBlock }],
      output_config: {
        format: {
          type: "json_schema",
          schema: COMPRESSION_OUTPUT_SCHEMA,
        },
      },
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    // Track cost
    const usage = response.usage as unknown as Record<string, number>;
    costTracker.record("compression", model, usage);

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { summary: text, keyEvents: [] };
    }

    limiter.record();
    console.log(`[Keeper] Compression complete | ~${estimateTokens(contextBlock)} input tokens`);

    res.json(parsed);
  } catch (err) {
    console.error("[Keeper] Compression error:", err);
    res.status(500).json({ error: "Compression failed" });
  }
});

app.get("/cost", (_req, res) => {
  const model = process.env.KEEPER_MODEL ?? "claude-haiku-4-5-20251001";
  res.json(costTracker.summary(model));
});

app.post("/invalidate-cache", (_req, res) => {
  invalidatePromptCache();
  console.log("[Keeper] Cache invalidated (preset reload)");
  res.json({ ok: true });
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
