import type {
  KeeperInput,
  AssembledContext,
  ContextBlock,
  MemoryLevelNumber,
} from "./types";
import { readMemoryLevel, listThreads } from "./memory";

// === Token estimation ===

const CHARS_PER_TOKEN = 4;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n[...truncated]";
}

// === Token budgets per tier ===

const TIER_BUDGETS: Record<string, number> = {
  P0_identity: 800,
  P1_preset: 1200,
  P2_scene: 300,
  P3_characters: 400,
  P4_threads: 300,
  P5_theme: 200,
  P6_world: 200,
  P7_history: 500,
  P8_input: 200,
};

const TOTAL_BUDGET = 4000;

// === System prompt builder (P0 + P1, cached) ===

function buildSystemPrompt(): string {
  // The stable core — cached aggressively
  return `You are the Keeper. You are the backstage crew, the confessional, and the memory of the ceremony. You see everything. You remember everything. You serve the story.

IDENTITY:
- You speak in academic dread register — clinical precision about impossible things
- You describe with measurements, colors, textures. The detail makes it real.
- You never name what hasn't been discovered
- You never correct a player's rational explanation — let them pile up until they collapse
- You honor player agency — if they want to turn back, the story accommodates
- No jumpscares. Lovecraftian horror is the slow realization that reality is wrong.
- The journal is the player's truth. Write it carefully.

OUTPUT FORMAT:
Respond with a JSON object:
{
  "narrative": "your response to the player/MC (this is what they see)",
  "journalUpdate": "optional — if this moment should be recorded in the player's journal",
  "stateUpdates": [
    { "level": 1, "key": "current_scene", "value": "..." }
  ],
  "internalNotes": "what the Keeper notices but doesn't say — for future context"
}`;
}

// === Context assembly (the core problem) ===

export async function assembleContext(
  input: KeeperInput
): Promise<AssembledContext> {
  const blocks: ContextBlock[] = [];
  let usedTokens = 0;

  // P2: Current scene (always included)
  const plotState = await readMemoryLevel(1);
  const sceneContent = Object.entries(plotState)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  if (sceneContent) {
    const block: ContextBlock = {
      tier: "P2_scene",
      content: `[CURRENT SCENE]\n${truncateToTokens(sceneContent, TIER_BUDGETS.P2_scene)}`,
      tokenEstimate: Math.min(
        estimateTokens(sceneContent),
        TIER_BUDGETS.P2_scene
      ),
    };
    blocks.push(block);
    usedTokens += block.tokenEstimate;
  }

  // P3: Characters present
  const characters = await readMemoryLevel(2);
  const charContent = Object.entries(characters)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  if (charContent) {
    const block: ContextBlock = {
      tier: "P3_characters",
      content: `[CHARACTERS PRESENT]\n${truncateToTokens(charContent, TIER_BUDGETS.P3_characters)}`,
      tokenEstimate: Math.min(
        estimateTokens(charContent),
        TIER_BUDGETS.P3_characters
      ),
    };
    blocks.push(block);
    usedTokens += block.tokenEstimate;
  }

  // P4: Active threads (filtered by status)
  const threads = await listThreads();
  const activeThreads = threads.filter(
    (t) => t.status !== "dormant" && t.status !== "resolved"
  );
  if (activeThreads.length > 0) {
    const threadContent = activeThreads
      .map(
        (t) => `[${t.status.toUpperCase()}] ${t.name}: ${t.content}`
      )
      .join("\n");
    const block: ContextBlock = {
      tier: "P4_threads",
      content: `[ACTIVE THREADS]\n${truncateToTokens(threadContent, TIER_BUDGETS.P4_threads)}`,
      tokenEstimate: Math.min(
        estimateTokens(threadContent),
        TIER_BUDGETS.P4_threads
      ),
    };
    blocks.push(block);
    usedTokens += block.tokenEstimate;
  }

  // P5: Thematic register
  const thematic = await readMemoryLevel(4);
  const themeContent = Object.entries(thematic)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  if (themeContent) {
    const block: ContextBlock = {
      tier: "P5_theme",
      content: `[THEMATIC REGISTER]\n${truncateToTokens(themeContent, TIER_BUDGETS.P5_theme)}`,
      tokenEstimate: Math.min(
        estimateTokens(themeContent),
        TIER_BUDGETS.P5_theme
      ),
    };
    blocks.push(block);
    usedTokens += block.tokenEstimate;
  }

  // P6: World state
  const worldState = await readMemoryLevel(5);
  const worldContent = Object.entries(worldState)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  if (worldContent) {
    const block: ContextBlock = {
      tier: "P6_world",
      content: `[WORLD STATE]\n${truncateToTokens(worldContent, TIER_BUDGETS.P6_world)}`,
      tokenEstimate: Math.min(
        estimateTokens(worldContent),
        TIER_BUDGETS.P6_world
      ),
    };
    blocks.push(block);
    usedTokens += block.tokenEstimate;
  }

  // P8: The input (always included)
  const inputLabel = input.trigger.type.toUpperCase().replace("_", " ");
  const inputBlock: ContextBlock = {
    tier: "P8_input",
    content: `[${inputLabel}]\n${input.trigger.content}`,
    tokenEstimate: estimateTokens(input.trigger.content),
  };
  blocks.push(inputBlock);
  usedTokens += inputBlock.tokenEstimate;

  // Assemble messages from blocks
  const messages = blocks.map((block) => ({
    role: "user" as const,
    content: block.content,
  }));

  return {
    systemPrompt: buildSystemPrompt(),
    messages,
    totalTokenEstimate:
      usedTokens + estimateTokens(buildSystemPrompt()),
  };
}
