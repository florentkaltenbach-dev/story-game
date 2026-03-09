# Claude API Features Audit — Keeper Calibration Reference

*Every API feature, categorized by relevance to The Ceremony. Use this to calibrate the Keeper.*

---

## Feature Map

| Feature | Current Use | Should Use | Priority |
|---------|-------------|------------|----------|
| Prompt Caching | Not used | YES — system prompt + preset DNA | **P0** |
| Structured Outputs | Not used (manual JSON parse) | YES — guaranteed schema | **P0** |
| Effort Parameter | Not used | YES — vary by Keeper mode | **P1** |
| Extended Thinking | Not used | SELECTIVE — journals, compression | **P2** |
| Streaming | Not used | YES — MC dashboard, player responses | **P2** |
| Citations | Not used | MAYBE — source text grounding | **P3** |
| Built-in Web Search | Not used | NO — not relevant | — |
| Code Execution | Not used | NO — not relevant | — |
| Memory Tool | Not used | NO — we have filesystem memory | — |
| Tool Use (custom) | Not used | FUTURE — dice, state queries | **P3** |

---

## P0: Prompt Caching

### What It Does
Caches the KV representation of static prompt content. Subsequent requests with identical prefixes hit cache at 0.1x cost. System checks tools → system → messages in order.

### Why The Ceremony Needs It
Our system prompt + preset DNA (P0+P1) is ~2,000 tokens and identical every turn. Without caching, we pay full price every request. With caching, 60% cost reduction on the stable portion.

### Configuration

```typescript
// In ClaudeKeeper.query()
const response = await this.client.messages.create({
  model: this.model,
  max_tokens: this.maxTokens,
  cache_control: { type: "ephemeral" },  // Auto-cache last cacheable block
  system: [
    {
      type: "text",
      text: context.systemPrompt,
      cache_control: { type: "ephemeral" }  // Explicit: cache system prompt
    }
  ],
  messages,
});
```

### Key Details
- **Minimum tokens for Haiku 4.5**: 4,096 tokens (our system prompt is ~2,000 — need to include preset DNA to meet threshold)
- **Minimum tokens for Sonnet 4.6**: 2,048 tokens (we meet this)
- **TTL**: 5 minutes default (auto-refreshes on each hit — live sessions sustain cache)
- **1-hour TTL option**: 2x base write cost, useful for less frequent requests
- **Up to 4 breakpoints** per request
- **Cache invalidation**: Changing tools, images, or thinking parameters breaks cache

### Cost Impact (Haiku 4.5)

| Scenario | Cost/Turn |
|----------|-----------|
| No caching | ~$0.003 |
| With caching (cache hit) | ~$0.0018 (40% cheaper) |
| Per session (60 turns) | $0.11 vs $0.18 |

### Ceremony-Specific Notes
- System prompt + preset DNA should be ONE cached block (P0+P1 combined)
- Dynamic context (P2-P8) goes in messages — never cached
- Cache hierarchy: tools (if any) → system → messages
- **Blocker**: We need P1 (preset DNA) in the system prompt first to meet Haiku's 4,096 minimum

---

## P0: Structured Outputs

### What It Does
Guarantees Claude's response conforms to a JSON schema via constrained decoding. Zero parsing errors. No retries needed.

### Why The Ceremony Needs It
The Keeper currently asks for JSON in the system prompt and does `JSON.parse()` with a fallback. This fails silently when the model returns prose instead of JSON. Structured outputs guarantee the schema every time.

### Configuration

```typescript
// Option A: output_config.format (direct JSON output)
const response = await this.client.messages.create({
  model: this.model,
  max_tokens: this.maxTokens,
  system: context.systemPrompt,
  messages,
  output_config: {
    format: {
      type: "json_schema",
      schema: {
        type: "object",
        properties: {
          narrative: { type: "string", description: "Response to player/MC" },
          journalUpdate: { type: ["string", "null"], description: "Journal entry if significant" },
          stateUpdates: {
            type: "array",
            items: {
              type: "object",
              properties: {
                level: { type: "integer", description: "Memory level 1-5" },
                key: { type: "string" },
                value: { type: "string" },
              },
              required: ["level", "key", "value"],
              additionalProperties: false,
            }
          },
          internalNotes: { type: ["string", "null"], description: "Keeper-only observations" },
        },
        required: ["narrative", "stateUpdates"],
        additionalProperties: false,
      }
    }
  }
});
```

```typescript
// Option B: strict tool use (force tool call with validated input)
const response = await this.client.messages.create({
  model: this.model,
  max_tokens: this.maxTokens,
  system: context.systemPrompt,
  messages,
  tools: [{
    name: "keeper_response",
    description: "Structured Keeper response",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        narrative: { type: "string" },
        journalUpdate: { type: ["string", "null"] },
        stateUpdates: { type: "array", items: { /* ... */ } },
        internalNotes: { type: ["string", "null"] },
      },
      required: ["narrative", "stateUpdates"],
      additionalProperties: false,
    }
  }],
  tool_choice: { type: "tool", name: "keeper_response" },
});
```

### Key Details
- **GA on**: Opus 4.6, Sonnet 4.6, Sonnet 4.5, Opus 4.5, Haiku 4.5
- **No beta header** needed anymore
- **Incompatible with citations** — can't use both together
- **SDK helpers**: `client.messages.parse()` with Pydantic/Zod for typed responses
- **Unsupported schema features**: minimum, maximum, minLength, maxLength, $ref, if/then/else (moved to description by SDK)

### Recommendation for The Ceremony
Use **Option A (output_config.format)** — simpler, and the Keeper's response IS the output (not a tool call). This replaces the current `parseResponse()` try/catch fallback entirely.

### What This Fixes
- Eliminates `keeper.ts:147-166` parseResponse fallback
- Guarantees `stateUpdates` is always an array (currently can be undefined)
- No more "model didn't return JSON" edge case
- `narrative` guaranteed to exist — no `?? text` fallback needed

---

## P1: Effort Parameter

### What It Does
Controls how many tokens Claude spends responding. Four levels: `low`, `medium`, `high` (default), `max`. Affects text, tool calls, AND thinking tokens.

### Why The Ceremony Needs It
Different Keeper modes have different quality/speed needs. MC queries need speed. Journal entries need depth. Compression needs thoroughness.

### Configuration

```typescript
const response = await this.client.messages.create({
  model: this.model,
  max_tokens: this.maxTokens,
  system: context.systemPrompt,
  messages,
  output_config: {
    effort: getEffortForMode(input.mode),
    format: { /* structured output schema */ }
  }
});

function getEffortForMode(mode: KeeperMode): "low" | "medium" | "high" | "max" {
  switch (mode) {
    case "player_response": return "medium";    // Speed matters in live play
    case "mc_query":        return "medium";    // MC needs fast answers
    case "mc_generate":     return "high";      // Quality narrative generation
    case "journal_write":   return "high";      // Journals persist, quality matters
    case "compression":     return "high";      // Accuracy matters for memory
    case "thread_evaluation": return "low";     // Quick check, high volume
  }
}
```

### Key Details
- **Supported on**: Opus 4.6, Sonnet 4.6, Opus 4.5
- **Not supported on**: Haiku 4.5 (our current model!)
- **`max` only on Opus 4.6** — other models return error
- **Replaces budget_tokens** on Opus 4.6 as the recommended thinking control
- **Affects tool calls too** — lower effort = fewer, terser tool calls
- **No beta header** required

### Ceremony-Specific Impact
- **If staying on Haiku 4.5**: Can't use effort. Control verbosity via prompt instead.
- **If upgrading to Sonnet 4.6**: Use `medium` as default, `high` for journals/compression.
- **Cost impact**: `low` effort on Sonnet ~40-60% cheaper than `high` per turn.

---

## P2: Extended Thinking

### What It Does
Claude reasons step-by-step internally before responding. Returns `thinking` content blocks (summarized on Claude 4+ models) followed by `text` blocks.

### Why The Ceremony Might Need It
- **Journal writing**: Deeper reflection produces better prose
- **Compression**: Better reasoning about what to keep/discard
- **Thread evaluation**: Complex condition matching across multiple threads
- **NOT for player responses**: Too slow for live play

### Configuration

```typescript
// For journal writing or compression
const response = await this.client.messages.create({
  model: "claude-sonnet-4-6",  // Not Haiku — thinking is expensive
  max_tokens: 4000,
  thinking: { type: "enabled", budget_tokens: 2000 },
  system: context.systemPrompt,
  messages,
});

// Read thinking + response
for (const block of response.content) {
  if (block.type === "thinking") {
    console.log("[Keeper thinking]:", block.thinking);
  }
  if (block.type === "text") {
    return parseResponse(block.text);
  }
}
```

### Key Details
- **Supported on**: All Claude 4+ models including Haiku 4.5
- **budget_tokens**: Minimum 1,024, must be < max_tokens
- **Summarized thinking**: Claude 4+ returns summaries (charged for full thinking tokens)
- **Opus 4.6**: Use adaptive thinking (`type: "adaptive"`) + effort parameter instead
- **Sonnet 4.6**: Supports interleaved thinking (think between tool calls)
- **Tool choice constraint**: Only `auto` or `none` when thinking is enabled
- **Cache impact**: Changing budget_tokens breaks message cache (system cache preserved)

### Ceremony-Specific Notes
- Use thinking for **offline tasks only** (post-scene compression, journal generation)
- Never use for live player responses — latency is unacceptable
- Thinking tokens are expensive — budget carefully
- Consider Sonnet for thinking tasks, Haiku for live responses (model switching per mode)

---

## P2: Streaming

### What It Does
Returns response incrementally via SSE. Events include `content_block_start`, `content_block_delta`, `content_block_stop`, `message_start`, `message_stop`.

### Why The Ceremony Needs It
- MC "Query Keeper" mode should stream — the Keeper's response emerges word by word
- Player keeper-private responses feel more alive when streamed
- Matches our existing SSE architecture

### Configuration

```typescript
// TypeScript SDK streaming
const stream = await this.client.messages.stream({
  model: this.model,
  max_tokens: this.maxTokens,
  system: context.systemPrompt,
  messages,
});

// Forward to SSE clients
stream.on("text", (text) => {
  stateEmitter.emit("keeper_response", { delta: text, done: false });
});

stream.on("finalMessage", async (message) => {
  const fullText = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const parsed = parseResponse(fullText);
  await processStateUpdates(parsed.stateUpdates);
  stateEmitter.emit("keeper_response", { narrative: parsed.narrative, done: true });
});
```

### Key Details
- **Event types**: `message_start`, `content_block_start`, `content_block_delta` (with `text_delta` or `thinking_delta`), `content_block_stop`, `message_stop`
- **Usage info** in `message_start` and `message_delta` events
- **Thinking streams** via `thinking_delta` events
- **Tool use streams** via `input_json_delta` events

### Ceremony-Specific Notes
- Stream for MC queries and player-to-Keeper interactions
- Don't stream for background tasks (compression, thread evaluation)
- Use `stream.finalMessage` to get complete response for state processing
- **Incompatibility**: Streaming + structured outputs may need careful handling

---

## P3: Citations

### What It Does
Claude automatically cites exact passages from provided documents. Returns interleaved text and citation blocks with character/page/block indices.

### Potential Ceremony Use
- Could ground Keeper responses in source material (Lovecraft text, preset docs)
- `cited_text` doesn't count toward output tokens — cost savings
- More reliable than prompt-based "quote the source" approaches

### Why NOT Priority
- **Incompatible with structured outputs** — can't use both together
- We need structured outputs more than citations
- The Keeper's voice should be its own, not quoting source text
- Source grounding can be done via system prompt context instead

### If We Want It Later
```typescript
// Include source text as a citable document
messages: [{
  role: "user",
  content: [
    {
      type: "document",
      source: { type: "text", media_type: "text/plain", data: lovecraftText },
      title: "At the Mountains of Madness",
      citations: { enabled: true },
      cache_control: { type: "ephemeral" }  // Cache the source text
    },
    { type: "text", text: playerAction }
  ]
}]
```

---

## P3: Custom Tool Use

### What It Does
Define tools Claude can call. The model returns `tool_use` blocks with validated inputs. You execute the tool and return `tool_result`.

### Potential Ceremony Use
- **Dice/mechanics tool**: `roll_check(skill, difficulty)` — if we add mechanics
- **State query tool**: `read_memory(level, key)` — let Keeper pull specific state
- **Scene transition tool**: `transition_scene(location, description)` — structured scene changes
- **Thread advancement tool**: `advance_thread(id, new_status)` — explicit thread control

### Why NOT Priority Now
- MockKeeper doesn't need tools
- State updates work via structured output `stateUpdates` array
- Tool use adds complexity (multi-turn conversation, tool_result messages)
- Better to get structured outputs working first

### With Strict Mode (When Ready)
```typescript
tools: [{
  name: "advance_thread",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      threadId: { type: "string" },
      newStatus: { type: "string", enum: ["dormant", "planted", "growing", "ripe", "resolved"] },
      reason: { type: "string" }
    },
    required: ["threadId", "newStatus", "reason"],
    additionalProperties: false
  }
}]
```

---

## NOT Relevant

### Built-in Web Search
The Keeper doesn't need internet access. Its world is the filesystem memory + preset config. Web search would break the fiction.

### Code Execution
No computational needs in the Keeper's response loop. If we need data analysis later (session analytics), it would be a separate tool.

### Memory Tool (Anthropic's)
We built our own filesystem memory — 5 levels, human-readable, atomic writes. Anthropic's memory tool is for their hosted environment, not self-hosted apps.

---

## Implementation Priority

### Phase 1: Structured Outputs + Prompt Caching (do together)
1. Add P1 (preset DNA) to system prompt → meets Haiku 4,096 token cache minimum
2. Add `cache_control: { type: "ephemeral" }` to system prompt block
3. Replace `parseResponse()` with `output_config.format` JSON schema
4. Remove try/catch JSON fallback in ClaudeKeeper

### Phase 2: Effort + Streaming
1. Upgrade to Sonnet 4.6 for effort support (or stay on Haiku and skip effort)
2. Add `output_config.effort` per Keeper mode
3. Implement streaming for MC queries and player responses
4. Wire stream events to SSE emitter

### Phase 3: Extended Thinking (selective)
1. Add thinking for journal_write and compression modes only
2. Use Sonnet/Opus for these modes, Haiku for live responses
3. Model selection per mode in createKeeper()

### Phase 4: Tool Use (when mechanics exist)
1. Define game mechanic tools if/when needed
2. Use strict mode for guaranteed input validation

---

## Sources

- [Claude Messages API Reference](https://platform.claude.com/docs/en/api/messages)
- [Prompt Caching Documentation](https://platform.claude.com/docs/en/docs/build-with-claude/prompt-caching)
- [Extended Thinking Documentation](https://platform.claude.com/docs/en/docs/build-with-claude/extended-thinking)
- [Streaming Documentation](https://platform.claude.com/docs/en/build-with-claude/streaming)
- [Structured Outputs Documentation](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- [Citations Documentation](https://platform.claude.com/docs/en/build-with-claude/citations)
- [Effort Parameter Documentation](https://platform.claude.com/docs/en/build-with-claude/effort)
- [Claude API Guide 2026](https://calmops.com/ai/claude-api-complete-guide-2026/)
- [Anthropic Structured Outputs Announcement](https://techbytes.app/posts/claude-structured-outputs-json-schema-api/)
