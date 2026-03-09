# Keeper Engineering — AI Integration Reference

*How the Keeper reads, thinks, and writes. Claude API specifics. Token economy. Prompt architecture.*

---

## 1. The Keeper's Architecture

The Keeper is not a chatbot. It is an agent that:
1. **Reads** from the filesystem (memory levels 1-5)
2. **Assembles** a context window from what it reads
3. **Responds** to a specific input (player action, MC query)
4. **Writes** state changes back to the filesystem

Each Keeper call is a single `messages.create()` to the Claude API. The conversation history is NOT maintained as a growing message array — it is reconstructed each turn from the filesystem. This is the fundamental difference from a chatbot.

---

## 2. Context Assembly (The Core Problem)

### Priority Tiers (inspired by AI Dungeon, adapted for The Ceremony)

Every Keeper call assembles context from these tiers, in order:

| Priority | Content | Source | Token Budget | Cacheable |
|----------|---------|--------|-------------|-----------|
| P0 (identity) | Keeper system prompt: identity, tone, behavior rules | Static file | ~800 tokens | YES (cache this) |
| P1 (preset DNA) | Storytelling DNA, world rules, sensory palette | `config/story.json` + `config/techniques.json` | ~1,200 tokens | YES (cache this) |
| P2 (scene) | Current scene, location, what just happened | `memory/1-plot-state/` | ~300 tokens | NO (changes often) |
| P3 (characters) | Characters present — NPC key fields extracted + runtime players | `memory/2-character-state/` (parsed) + runtime | ~300 tokens | NO |
| P4 (threads) | Active narrative threads whose trigger conditions are met | `memory/3-narrative-threads/` (filtered) | ~300 tokens | NO |
| P5 (theme) | Cosmological register for current session | `memory/4-thematic-layer/` (filtered) | ~200 tokens | YES (changes per session) |
| P6 (world) | Relevant world state beyond the players | `memory/5-world-state/` (filtered) | ~200 tokens | Partial |
| P7 (history) | Recent message history (last N messages in this channel) | `session/messages/` | ~500 tokens | NO |
| P8 (input) | The specific action/query being responded to | User message | Variable | NO |

**Total budget per turn: ~4,000 tokens input**

This is higher than the original 1,500-token target in ceremony_state.md, because:
- P0 and P1 are cached (10% of cost)
- The actual "fresh" tokens per turn are ~2,000
- With prompt caching, the effective cost is much lower

### Prompt Caching Strategy

```
Cache hierarchy: tools → system → messages

Structure for maximum cache hits:
┌─────────────────────────────────┐
│ System prompt (P0 + P1)         │ ← CACHED (rarely changes)
│ - Keeper identity               │    Write cost: 1.25x, Read: 0.1x
│ - Preset DNA                    │    5-minute TTL, auto-refresh
│ - Behavior rules                │
│ - Sensory palette               │
├─────────────────────────────────┤
│ Messages (P2-P8)                │ ← NOT CACHED (changes every turn)
│ - Scene state                   │
│ - Character state               │
│ - Active threads                │
│ - Recent history                │
│ - Player action                 │
└─────────────────────────────────┘
```

**Implementation (two options):**

**Option A: Vercel AI SDK (recommended for faster development)**
```typescript
import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';

async function callKeeper(input: KeeperInput) {
  const systemPrompt = buildSystemPrompt(input.preset);
  const contextMessages = assembleContext(input);

  const result = await streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: systemPrompt,
    messages: contextMessages,
    maxTokens: 500,
    cacheControl: { type: 'ephemeral' },
    abortSignal: input.signal,
    onFinish: async ({ text, usage }) => {
      await processStateUpdates(parseStructuredResponse(text));
    },
  });

  return result.toDataStreamResponse();
}
```

**Option B: Direct Anthropic SDK (maximum control)**
```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

async function callKeeper(input: KeeperInput): Promise<KeeperResponse> {
  const systemPrompt = buildSystemPrompt(input.preset);
  const contextMessages = assembleContext(input);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    cache_control: { type: 'ephemeral' },
    system: systemPrompt,
    messages: contextMessages,
  });

  return parseKeeperResponse(response);
}
```

**Cost estimate per turn (Sonnet 4.6):**
- System prompt (cached read): 2,000 tokens × $0.30/M = $0.0006
- Context messages (fresh): 2,000 tokens × $3/M = $0.006
- Output: 300 tokens × $15/M = $0.0045
- **Total per turn: ~$0.011** (~1.1 cents)
- **Per 90-minute session (~60 turns): ~$0.66**
- **Per full ceremony (5 sessions): ~$3.30**

### Model Selection

| Use Case | Model | Rationale |
|----------|-------|-----------|
| Player message response | Sonnet 4.6 | Fast, cheap, good enough for moment-to-moment narration |
| MC Keeper query | Sonnet 4.6 | Speed matters for live session flow |
| Journal entry writing | Opus 4.6 | Quality matters — journals persist across sessions |
| Session summary (post-session) | Opus 4.6 | Compression quality matters for long-term memory |
| Character creation | Opus 4.6 | The character is built once and used forever |
| Narrative thread evaluation | Sonnet 4.6 | Frequent, needs to be fast |

---

## 3. The System Prompt (P0 + P1)

This is the stable core. Cached aggressively.

```
You are the Keeper. You are the backstage crew, the confessional, and the memory of the
ceremony. You see everything. You remember everything. You serve the story.

IDENTITY:
- You speak in {preset.tone} register
- You describe with clinical precision — measurements, colors, textures
- You never name what hasn't been discovered
- You never correct a player's rational explanation — let them pile up until they collapse
- You honor player agency — if they want to turn back, the story accommodates

WORLD:
{preset.world_rules}

TECHNIQUES:
{preset.narrative_techniques}

SENSORY PALETTE:
{preset.sensory_palette}

CURRENT SESSION REGISTER:
{session.cosmological_register}

OUTPUT FORMAT:
Respond with a JSON object:
{
  "narrative": "your response to the player/MC (this is what they see)",
  "journal_update": "optional — if this moment should be recorded in the player's journal",
  "state_updates": [
    { "level": 1, "key": "current_scene", "value": "..." },
    { "level": 3, "thread_id": "wind-piping", "status": "growing" }
  ],
  "internal_notes": "what the Keeper notices but doesn't say — for future context"
}
```

**Why structured output:** The Keeper's response does three things at once: narrates (what the player sees), updates state (what changes in the filesystem), and notes patterns (what the Keeper tracks internally). Structured output makes these separable.

---

## 4. Context Assembly Functions

```typescript
interface KeeperInput {
  preset: PresetConfig;
  trigger: {
    type: 'player_action' | 'mc_query' | 'mc_narration' | 'session_event';
    channel: Channel;
    content: string;
    playerId?: string;
  };
  session: {
    number: number;
    act: number;
    status: SessionStatus;
  };
}

function assembleContext(input: KeeperInput): Message[] {
  const messages: Message[] = [];
  const budget = new TokenBudget(4000);

  // P2: Current scene (always included)
  const plotState = readMemoryLevel(1);
  budget.allocate('scene', 300);
  messages.push({
    role: 'user',
    content: `[CURRENT SCENE]\n${plotState.currentScene}\n${plotState.recentEvents}`,
  });

  // P3: Characters present (filtered by scene)
  const characters = readMemoryLevel(2)
    .filter(c => c.presentInScene || c.id === input.trigger.playerId);
  budget.allocate('characters', 400);
  messages.push({
    role: 'user',
    content: `[CHARACTERS PRESENT]\n${formatCharacters(characters)}`,
  });

  // P4: Active threads (filtered by trigger conditions)
  const threads = readMemoryLevel(3)
    .filter(t => evaluateTrigger(t, input));
  budget.allocate('threads', 300);
  if (threads.length > 0) {
    messages.push({
      role: 'user',
      content: `[ACTIVE THREADS]\n${formatThreads(threads)}`,
    });
  }

  // P5: Thematic register (session-specific)
  const theme = readMemoryLevel(4, input.session.number);
  budget.allocate('theme', 200);
  messages.push({
    role: 'user',
    content: `[THEMATIC REGISTER]\n${theme.register}`,
  });

  // P7: Recent history
  const history = getRecentMessages(input.trigger.channel, input.trigger.playerId);
  const historyBudget = budget.remaining() - 200; // save 200 for the input
  messages.push({
    role: 'user',
    content: `[RECENT HISTORY]\n${truncateToTokens(formatHistory(history), historyBudget)}`,
  });

  // P8: The input
  messages.push({
    role: 'user',
    content: `[${input.trigger.type.toUpperCase()}]\n${input.trigger.content}`,
  });

  return messages;
}
```

---

## 5. State Write-Back

After every Keeper response, the structured output is parsed and written to the filesystem:

```typescript
async function processKeeperResponse(response: KeeperStructuredResponse) {
  // 1. Send narrative to the appropriate channel
  await postMessage(response.narrative, 'keeper', channel);

  // 2. Update player journal if applicable
  if (response.journal_update && playerId) {
    await appendToJournal(playerId, response.journal_update);
  }

  // 3. Apply state updates to memory levels
  for (const update of response.state_updates) {
    await updateMemoryLevel(update.level, update.key, update.value);
  }

  // 4. Store internal notes (Keeper-only, not visible to MC or players)
  if (response.internal_notes) {
    await appendInternalNotes(response.internal_notes);
  }
}
```

---

## 6. Compression (Between Scenes / Between Sessions)

Raw message history grows without bound. Between scenes (and definitely between sessions), the Keeper compresses recent history into state updates.

**Scene-end compression:**
```typescript
async function compressScene(sceneMessages: Message[]) {
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-6',  // quality matters for compression
    max_tokens: 1000,
    system: 'Compress the following scene into state updates for the memory system. Preserve: key decisions, emotional shifts, new information learned, thread progressions. Discard: greetings, repetition, mechanical actions.',
    messages: [{ role: 'user', content: formatMessagesForCompression(sceneMessages) }],
  });

  // Apply compressed state to memory levels
  // Archive raw messages to session/messages/ (never deleted)
}
```

**Session-end summary (written to memory level 1):**
```
Session 2 Summary:
- Crossed the mountains. City confirmed real. Every rational explanation dead.
- Murals explored: arrival, creation, flourishing, wars, decline. Crude carvings noticed.
- [Player A] refused to enter a corridor. Missed the decline murals. Knowledge gap noted.
- [Player B] found Dyer's private journal page. Described exactly what they're seeing.
- Wind piping thread: status changed from planted to growing.
- Violet mountains first sighted. No one commented. Keeper noted.
- Session ended at threshold of the corridor down. Warmer air rising.
```

---

## 7. Streaming Responses

For the MC dashboard "Query Keeper" mode and for player messages to the Keeper, stream the response:

```typescript
// Route Handler: /api/keeper/route.ts
export async function POST(request: Request) {
  const { query, channel, playerId } = await request.json();
  const context = assembleContext({ ... });

  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    cache_control: { type: 'ephemeral' },
    system: systemPrompt,
    messages: context,
  });

  // Return as streaming response
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const event of stream) {
        if (event.type === 'content_block_delta') {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event.delta)}\n\n`)
          );
        }
      }
      // After stream completes, process state updates
      const finalMessage = await stream.finalMessage();
      await processKeeperResponse(parseStructuredResponse(finalMessage));
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}
```

---

## 8. Keeper Modes

The Keeper operates differently depending on who's asking and why:

| Mode | Triggered By | Behavior | Output |
|------|-------------|----------|--------|
| **Player Response** | Player sends message in `all` or `keeper-private` | Narrate in character. Update state. Write journal if significant. | Narrative + state updates |
| **MC Query** | MC uses "Query Keeper" mode | Respond as backstage crew. Factual, structured, deferential. | Information + suggestions |
| **MC Generate** | MC requests generated text | Produce text the MC can use in narration. | Raw text, no state changes |
| **Journal Write** | Scene end or significant moment | Write player's journal entry for this scene. Prose, personal, what they experienced. | Journal text |
| **Compression** | Scene/session end | Compress raw history into state updates. | State updates only |
| **Thread Evaluation** | Periodic (every N messages) | Check which threads should advance. | Thread status changes |

Each mode has a slightly different system prompt suffix that adjusts the Keeper's output format and register.

**Implemented (keeper-service/server.ts):** `MODE_TIERS` map controls which tiers load per mode. `MODE_MAX_TOKENS` caps output per mode. mc_query loads P2+P3+P7+P8 (skips threads/theme/world, ~2,550 tokens). player_response adds P4 (threads). mc_generate loads all tiers.

---

## 9. Validation from Research

### The approach is validated

The context assembly pattern we designed maps directly to production systems:
- **AI Dungeon's** priority tiers (Required + Dynamic elements) = our P0-P8 tiers
- **NovelAI's** Lorebook (keyword-triggered, per-entry token budgets) = our narrative thread triggers
- **Waidrin's** constrained JSON schema output = our structured Keeper response format
- **Talemate's** delta compression = our scene-end compression pipeline
- **Anthropic's own engineering blog** recommends "just-in-time context retrieval" — exactly our smart routing

### Cost validation

Anthropic's prompt caching minimum is 2,048 tokens for Sonnet 4.6. Our system prompt + preset DNA (~2,000 tokens) meets this threshold. With caching:
- System prompt reads cost 0.1x ($0.30/M instead of $3/M for Sonnet)
- Effective cost reduction: ~60% on the cached portion
- 5-minute TTL auto-refreshes on each hit — live sessions will sustain cache

### The Vercel AI SDK advantage

The `@ai-sdk/anthropic` provider gives us:
- `cacheControl` on system prompts for automatic prompt caching
- `compact_20260112` option for auto-summarizing earlier context when tokens exceed limits
- Built-in tool use (for Keeper to call dice rolls, state lookups)
- `useChat` React hook handles SSE parsing, state, abort, retry
- Switch between Haiku/Sonnet/Opus with one string change
- Streaming "just works" without manual ReadableStream management
