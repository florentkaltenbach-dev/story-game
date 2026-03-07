# Competitive Analysis — 7 Real Platforms

*What exists. What they got right. What they got wrong. What we steal.*

---

## 1. AI Dungeon (Latitude)

**What they built:** AI-powered text adventure. Single-player and multiplayer modes. Multiple AI models (GPT-4, Claude, custom). Web + mobile.

**Architecture:**
- Client-server with REST API
- Real-time multiplayer via shared story state
- Context window managed by priority-based assembly system

**Context Assembly (the most relevant pattern):**
AI Dungeon divides context into Required Elements and Dynamic Elements.

Required (always included, priority-ordered):
1. Front Memory + Last Action (always full)
2. Author's Note
3. Plot Essentials
4. AI Instructions
5. Story Summary

If required elements exceed 70% of context, lower-priority items are trimmed from the bottom.

Dynamic (fill remaining space):
- Story Cards: ~25% of remaining tokens (triggered by keyword matching against recent actions)
- History: ~50% of remaining tokens (most recent first, backwards until full)
- Memory Bank: ~25% (relevance-ranked against most recent action)

Story Cards are triggered by scanning a minimum of 4 recent actions, expanding the scan window based on available tokens (tokens / 100 = actions scanned).

**What they got right:**
- Priority-based context assembly is the correct pattern. Not everything goes in — you curate per turn.
- Story Cards as trigger-based context injection. A card fires when its keywords match recent actions. This is exactly the narrative thread pattern The Ceremony needs.
- Separating "always present" from "relevance-ranked" context.
- Memory Bank with relevance ranking (proto-RAG).

**What they got wrong:**
- Single-player focus makes multiplayer feel bolted on
- No role differentiation — everyone sees the same view
- No persistent world state beyond the conversation history
- Token management is visible to users (subscription tiers = context length), breaking immersion
- The AI has no "character" — it's a generation engine, not an agent with identity

**What we steal:**
- The priority tier system for context assembly
- Story Cards = our Narrative Threads with trigger conditions
- The idea of Front Memory (always-present identity/tone) + dynamic context selection

---

## 2. NovelAI

**What they built:** AI writing assistant with deep customization. Lorebook system for world-building context. Image generation. Single-player focus.

**Architecture:**
- Custom AI models (fine-tuned on fiction)
- Lorebook system: structured entries with trigger keys, insertion order, and token budgets
- Context window assembly with configurable insertion points

**Context System (Lorebook):**
Each Lorebook entry has:
- Trigger keys (words/phrases that activate it)
- Insertion position (where in the context it appears)
- Token budget (max tokens this entry can consume)
- Search range (how far back in history to scan for triggers)
- Force-activation option (always present regardless of triggers)

Entries are assembled bottom-up: the system scans recent text for trigger keys, activates matching entries, and inserts them at their configured positions within the context. Token budgets prevent any single entry from dominating.

**What they got right:**
- Lorebook is the most sophisticated context injection system in consumer AI fiction. Each piece of world knowledge has its own trigger condition, budget, and priority.
- Configurable insertion points — some context works better near the top (tone), some near the bottom (immediate situation).
- Per-entry token budgets prevent context pollution.
- The writing interface is beautiful — clean, focused, narrative-first.

**What they got wrong:**
- Single-player only. No multiplayer concept.
- No agent identity — the AI is a text completer, not a character.
- Complex configuration overwhelms non-technical users.
- No separation between "what the AI knows" and "what the player sees."

**What we steal:**
- Per-entry trigger keys and token budgets for our memory levels
- Insertion position control — Keeper identity at top, immediate scene at bottom, thematic layer in middle
- The principle that world knowledge entries should be independently configurable

---

## 3. Foundry VTT

**What they built:** Self-hosted virtual tabletop. Full-featured: maps, tokens, character sheets, chat, dice, audio, modules. The most technically sophisticated VTT.

**Architecture:**
- Node.js server (self-hosted)
- Socket.io v4 for real-time communication
- NeDB (embedded database) for persistence
- Module system via manifest.json + JS/CSS injection
- REST API for external integrations

**Real-time pattern:**
- WebSocket via socket.io, exposed at `game.socket`
- Modules register socket namespaces: `module.{module-name}`
- Query system for inter-client communication: functions registered in `CONFIG.queries`
- All state changes broadcast via socket events
- GM (Game Master) has elevated permissions — can see and modify all data

**Permission model:**
- 4 permission levels: None, Limited, Observer, Owner
- GM bypasses all permissions
- Per-document permission grants (a player can own their character sheet but only observe the map)
- Permission enforcement on both client and server

**What they got right:**
- Socket.io is the correct choice for this type of real-time app. Polling (what The Ceremony currently uses) should be replaced.
- The module/plugin architecture allows community extensions without core changes.
- Per-document permissions with role-based defaults.
- Self-hosted by design — the GM controls their data.
- The WebSocket relay pattern (foundryvtt-rest-api) allows external tools to read/modify world data.

**What they got wrong:**
- Complexity. The learning curve is severe.
- No native AI integration (requires community modules).
- The chat system is primitive — no channels, no private messaging built-in.
- Performance degrades with large worlds (NeDB limitations).

**What we steal:**
- Socket.io namespace pattern for channel isolation
- Permission model: role-based defaults + per-document overrides
- The principle that the GM's view and the player's view are the same data, filtered differently
- Self-hosted, GM-controlled data

---

## 4. Owlbear Rodeo

**What they built:** Minimalist virtual tabletop. Maps + tokens only. No character sheets, no rules engine. "Just the table."

**Architecture:**
- WebRTC for peer-to-peer real-time sync (v1) / WebSocket via PeerJS (v2)
- IndexedDB for local persistence
- React + TypeScript frontend
- Extremely small codebase compared to Foundry

**What they got right:**
- Radical simplicity. They do one thing (shared maps) and do it perfectly.
- Peer-to-peer architecture eliminates server costs.
- The UI is genuinely beautiful — clean, dark, focused. No chrome. No clutter.
- Fast. No loading screens. No configuration. Drop in and play.
- Open source with a clear, readable codebase.

**What they got wrong:**
- Too simple for complex games. No character state. No narrative tools.
- No AI integration.
- No text/chat system at all (relies on Discord/voice).

**What we steal:**
- The aesthetic principle: remove everything that isn't essential. The interface should feel like a surface, not a control panel.
- Speed. The app should load instantly and feel instant.
- The dark palette execution — they use depth through subtle elevation, not borders.

---

## 5. Ink (by Inkle Studios)

**What they built:** A narrative scripting language and runtime for interactive fiction. Used in 80 Days, Heaven's Vault, Sorcery! Open source.

**Architecture:**
- Ink language compiles to JSON
- Runtime engine (C# or JavaScript via inkjs) loads and executes the JSON
- State machine model: story position + variable state
- "Knots" and "stitches" as narrative units (functions/sections)
- Tunnels for reusable narrative passages
- Parallel story flows (v1.0): shared-state simultaneous narratives

**State model:**
- Current story position (which knot/stitch)
- Variable state (global and local)
- Visit counts (how many times each knot has been visited)
- Turn count
- Choice history
- All serializable to JSON for save/load

**What they got right:**
- The language reads like prose with markup. Writers can use it without being programmers.
- State is minimal and serializable. The entire game state is a small JSON blob.
- Parallel flows (v1.0) allow switching between simultaneous conversations/threads while sharing state. This is directly relevant to multiplayer.
- Visit counts as a first-class concept. "Has the player been here before?" is answered by the engine, not by manual bookkeeping.
- The inkjs runtime is zero-dependency, runs in any browser.

**What they got wrong:**
- Designed for authored content, not generated content. Every path must be pre-written.
- No AI integration (it's a traditional branching system).
- No multiplayer concept.
- No persistence beyond session save/load.

**What we steal:**
- Visit counts / interaction tracking as first-class state. The Keeper should know "how many times has this player encountered this thread?" without manual tracking.
- Minimal serializable state. The Keeper's per-turn context should be derivable from a small state snapshot, not from replaying all history.
- The principle that narrative units (scenes, threads, encounters) are addressable entities with their own state.
- Parallel flows for managing simultaneous player channels.

---

## 6. Ollama-Dungeon (open source)

**What they built:** Open-source multiplayer AI dungeon master using local LLMs (Ollama). Multi-agent architecture with persistent memory.

**Architecture:**
- Python backend with Ollama for local LLM inference
- Multi-agent system: each NPC/entity is an independent agent with its own context
- Dual memory strategy: CSV (append-only event log) + Pickle (session state)
- Context Manager for cross-agent information sharing
- Token management with progressive limits and automatic compression

**Token management (highly relevant):**
- Progressive token limits: start low, grow on demand (90% utilization triggers +1000 expansion)
- Compression threshold: 35,000 tokens triggers automatic compression
- Compression pipeline: preserve recent messages (~5,000 tokens), summarize older messages, replace with summary
- Emergency compression: if regular compression fails, keep only last 10 messages
- Compression ratio: ~80-85% reduction

**Memory architecture:**
- Per-agent: JSON (persona, goals, relationships), CSV (memory log), Pickle (session state)
- Shared context manager: location-specific shared information, max 800 tokens per retrieval
- Cross-agent sharing via `/share` command

**What they got right:**
- Multi-agent architecture where each entity has independent state and context. This is the correct model for The Ceremony's NPC system.
- Dual memory (event log + session state) is a good pattern. The event log is append-only truth; the session state is the working set.
- Progressive token limits avoid wasting resources on simple interactions.
- Automatic compression with fallback strategies.
- Per-agent context assembly — each agent reads from its own state + shared context.

**What they got wrong:**
- No web interface (terminal-based).
- Pickle for persistence is fragile and not human-readable.
- No role differentiation (no GM/player distinction).
- Compression uses the LLM itself, which is slow and can lose critical details.

**What we steal:**
- Dual memory: event log (append-only, raw) + working state (compressed, current). Our memory levels 1-5 are the working state; the raw message history is the event log.
- Per-agent context assembly with independent token budgets.
- Progressive token management rather than fixed limits.
- Automatic compression triggered by threshold, not by time.

---

## 7. Storyboard (lazerwalker/storyboard)

**What they built:** A general-purpose narrative engine in TypeScript. Hybrid architecture combining state machines and trigger-based storytelling.

**Architecture:**
- Finite State Machine (FSM): node-graph traversal (like Twine)
- Trigger-based system: dynamic content selection based on game state prerequisites (like StoryNexus)
- Deep interoperability between both systems
- Designed for embedding within larger applications

**What they got right:**
- Hybrid FSM + trigger system is exactly right for interactive storytelling. Some content is linear (scene progression), some is emergent (triggered by state conditions). You need both.
- Decoupled from UI — the engine accepts arbitrary input and produces arbitrary output. The presentation layer is separate.
- State-driven content selection: narrative content has prerequisites (conditions that must be true for it to appear).

**What they got wrong:**
- Abandoned (not actively maintained).
- No AI integration.
- Limited documentation.

**What we steal:**
- The hybrid model: FSM for session structure (Act I -> Act II -> Act III) + trigger system for narrative threads (if player has seen X and is in location Y, fire thread Z).
- Decoupling narrative engine from presentation. The Keeper's narrative logic should be separable from the web interface.
- Prerequisites on narrative content. Every thread, every NPC behavior, every atmospheric detail should have conditions for activation.

---

## 8. Friends & Fables (fables.gg)

**What they built:** AI Game Master for D&D 5e with world-building tools and virtual tabletop. The AI ("Franz") narrates, adjudicates rules, reacts in real time. The closest existing product to The Ceremony's vision.

**Architecture:**
- Multi-agent system called "ACE-1" (Agentic Campaign Engine)
- Not one chatbot — "a bunch of different modules that come together to create the final outcome"
- One module reasons about state changes ("is something new introduced? do we need to save that?")
- Multiple LLMs collaborate: one for narration, one for rule-checking, one for state-tracking
- Structured database (not filesystem) for game state — prevents hallucination of stats

**What they got right:**
- Multi-agent with specialized modules is the most mature implementation of what we call "The Keeper"
- Using a structured database for mechanical state prevents AI from hallucinating numbers
- Training models to recognize state-change moments

**What they got wrong:**
- Single-player only — the AI replaces the human GM entirely rather than augmenting one
- No voice integration. No multiplayer party. No permission-based views.
- Multiple LLM calls per turn = higher latency

**What we steal:**
- The multi-module approach: separate concerns (narration, state-tracking, rule-checking) into distinct Keeper modes
- Database for mechanical state, filesystem for narrative state — don't mix them

---

## 9. Talemate (open source, github.com/vegu-ai/talemate)

**What they built:** AI roleplay system with consistent world/game state tracking. Multi-agent architecture. Delta-compressed state history.

**Architecture:**
- Separate agents for: dialogue, narration, summarization, direction, editing, world state, character creation, TTS, visual generation
- **Delta compression:** Tracks all scene changes over time using incremental diffs stored in segmented changelog files. Scenes can be reconstructed to any point in history. Enables scene forking.
- **Cross-scene sync:** Characters, world entries, and static history entries marked as "shared" sync across multiple scenes via dedicated context files
- ChromaDB for long-term memory/embeddings
- Jinja2 for prompt templates

**What they got right:**
- Delta compression gives you full history replay and branching for free
- ChromaDB for semantic retrieval is more sophisticated than keyword matching
- Cross-scene shared context solves the "state persists across sessions" problem

**What we steal:**
- Delta compression pattern for state history — git diffs are our version of this
- Cross-scene shared context files for persistent character/world state
- Separate specialized agents for different concerns

---

## 10. Waidrin (open source, github.com/p-e-w/waidrin)

**What they built:** LLM-powered RPG engine using constrained generation and JSON schemas. Headless engine that can power any frontend.

**Architecture:**
- Asynchronous, fully typed, fully validating state machine at the core
- **Constrained generation via JSON schemas:** Forces LLM output into structured data. Game state updates are always valid by construction.
- Zustand + Immer for immutable state management
- Plugin architecture for game mechanics
- Token budget management in `lib/context.ts`, prompt generation in `lib/prompts.ts`
- Handles "potentially thousands of characters and locations"

**What they got right:**
- Constrained JSON schema output is the most reliable way to keep game state consistent — this validates our structured Keeper output format
- Zustand + Immer is the modern best practice for React state
- Headless engine design — build any frontend you want
- Plugin architecture separates game-system logic from engine

**What we steal:**
- Constrained JSON output for Keeper responses (we already designed this in 04-keeper-engineering.md)
- Zustand for client-side state management (replace React useState chains)

---

## The Gap: What No One Has Built

From the agent's research across 10+ platforms:

> "None of the platforms combine all three of: (a) real-time multiplayer with role-based state views, (b) AI-driven narrative with sophisticated memory/context management, and (c) a human MC/GM augmented by AI rather than replaced by it. This is exactly The Ceremony's niche."

This is the differentiator. Every existing platform is missing at least one of these three pillars.

---

## Synthesis: Patterns That Recur

| Pattern | Seen In | Relevance to The Ceremony |
|---------|---------|--------------------------|
| Priority-based context assembly | AI Dungeon, NovelAI, Ollama-Dungeon | Critical. The Keeper must assemble context from 5 memory levels with priority and budget per level. |
| Trigger-based content injection | AI Dungeon (Story Cards), NovelAI (Lorebook), Ink (visit counts), Storyboard (triggers) | Critical. Narrative threads fire when conditions are met. |
| Per-entity independent state | Ollama-Dungeon (per-agent), Foundry VTT (per-document) | Critical. Each player, NPC, and thread has independent state. |
| Dual memory (raw log + working state) | Ollama-Dungeon (CSV + Pickle), AI Dungeon (History + Memory Bank) | Critical. Raw message history + compressed memory levels. |
| Socket-based real-time | Foundry VTT (socket.io), Owlbear Rodeo (WebRTC/PeerJS) | Important. Replace polling with SSE or socket.io. |
| Role-based permission filtering | Foundry VTT (GM/player), AI Dungeon (author/player) | Critical. Same data, different views based on role. |
| Minimal serializable state | Ink (JSON blob), Storyboard (state object) | Important. The Keeper's state should be a snapshot, not a replay. |
| Radical simplicity in UI | Owlbear Rodeo | Aspirational. Remove everything that isn't the story. |
| Constrained JSON output | Waidrin | Forces valid state updates from AI. Validates our structured Keeper output. |
| Delta compression | Talemate | Incremental state diffs with full history reconstruction. Git gives us this. |
| Multi-module AI | Friends & Fables (ACE-1) | Separate narration, state-tracking, rule-checking into distinct modes. |
| WebRTC is unreliable | Owlbear Rodeo (abandoned it) | Don't attempt P2P. Server-authoritative architecture only. |
| Firebase causes latency | Roll20 (600ms RTT vs 40ms baseline) | Don't use general-purpose real-time DBs for game state. |
