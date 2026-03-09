# System Map — The Ceremony

*What exists, where it lives, how it connects. Updated March 7, 2026.*
*For tasks and priorities, see `working/TODO.md`. For design spec, see `ceremony_state.md`.*

---

## The Idea

An engagement platform for stories. Live ceremonies where an MC narrates by voice, players interact by text, and an AI agent — the Keeper — holds the full picture in a filesystem that IS its mind. The data is the pattern. The coarse-grained files carry the spirits of characters, threads, world state. The Keeper develops cognition through what it reads and writes.

---

## Architecture

```
[Browser]  ←SSE→  [Next.js :3004]  ──HTTP──→  [Keeper :3005]  ──HTTPS──→  [Claude API]
  /play              store.ts                    server.ts                   Haiku 4.5
  /mc                events.ts                   context assembly
                     memory.ts                   prompt cache
                     keeper.ts (proxy)            rate limiter
```

**Two-process split.** Next.js handles UI/routes/state; Keeper runs as standalone Express service. Keeper state (rate limiter, prompt cache, Anthropic client) survives web app restarts.

**PM2 config:** `ecosystem.config.cjs` manages both processes.

---

## Web App (`web/`, PM2 `ceremony`, port 3004)

### Pages

| Route | File | Purpose |
|-------|------|---------|
| `/` | `app/page.tsx` | Landing — links to /play and /mc |
| `/play` | `app/play/page.tsx` | Player view: join → story log + messages + character panel |
| `/mc` | `app/mc/page.tsx` | MC dashboard: scene editor, story log, narrate/query modes, session controls |

### Components

| Component | File | Purpose |
|-----------|------|---------|
| SceneDisplay | `components/SceneDisplay.tsx` | Current scene (location, title, description). MC edits inline. |
| StoryLog | `components/StoryLog.tsx` | Scrolling message feed. Role-styled: MC (gold border), Keeper (green italic), player (ice blue) |
| CharacterPanel | `components/CharacterPanel.tsx` | Journal + Notes tabs. Notes auto-save via debounced PATCH. |
| ChannelTabs | `components/ChannelTabs.tsx` | Switch between message channels |
| MessageInput | `components/MessageInput.tsx` | Text input with context-aware placeholder |

### Libraries

| Module | File | Purpose |
|--------|------|---------|
| Types | `lib/types.ts` | Role, Channel, Message, Player, Session, KeeperInput/Response, SSE types |
| Store | `lib/store.ts` | In-memory state cache, session persistence (atomic JSON), player/invite management |
| Keeper | `lib/keeper.ts` | RemoteKeeper (HTTP proxy to :3005) + MockKeeper (KEEPER_BACKEND=mock) |
| Memory | `lib/memory.ts` | Filesystem engine: atomic writes, JSONL append, level dirs, thread management |
| Events | `lib/events.ts` | SSE emitter singleton + stream factory. Per-player filtering. |
| useEventStream | `lib/useEventStream.ts` | Client SSE hook (ref-based handlers) |

### API Routes

| Endpoint | File | What it does |
|----------|------|-------------|
| GET/POST `/api/session` | `api/session/route.ts` | Session state, join/start/pause/reconnect, scene PATCH, player notes |
| GET/POST `/api/messages` | `api/messages/route.ts` | Messages (filtered by channel/player). Auto-triggers Keeper on keeper-private + all. Writes stateUpdates. MAX_HISTORY=6. |
| POST `/api/keeper` | `api/keeper/route.ts` | MC → Keeper query proxy. Stores exchange in mc-keeper channel. Writes stateUpdates. MAX_HISTORY=6. |
| GET `/api/events` | `api/events/route.ts` | SSE stream. Per-player filtering (mc-keeper → MC only, keeper-private → target player + MC). |
| POST `/api/invites` | `api/invites/route.ts` | Create/validate invite tokens |

---

## Keeper Service (`keeper-service/`, PM2 `keeper`, port 3005)

| Component | File | Purpose |
|-----------|------|---------|
| Server | `server.ts` | Express. POST /query, GET /health. ClaudeKeeper, RateLimiter, context assembly. |
| Config | `.env` | ANTHROPIC_API_KEY, KEEPER_MODEL, rate limits, port |

### Context Assembly (server.ts)

**Mode-aware tier loading** — `MODE_TIERS` maps each KeeperMode to the context tiers it loads:

| Mode | Tiers loaded | Max output tokens |
|------|-------------|-------------------|
| `player_response` | P2 P3 P4 P7 P8 | 768 |
| `mc_query` | P2 P3 P7 P8 | 512 |
| `mc_generate` | P2 P3 P4 P5 P6 P7 P8 | 1024 |
| `journal_write` | P3 P7 P8 | 512 |
| `compression` | P7 P8 | 512 |
| `thread_evaluation` | P4 P7 P8 | 256 |

**Tier definitions:**

| Tier | Budget | Source | Notes |
|------|--------|--------|-------|
| P0+P1 | ~2,000 | System prompt (cached) | Keeper identity + preset DNA. `cache_control: ephemeral`. |
| P2 | 300 | `memory/1-plot-state/` | Current scene |
| P3 | 600 | `memory/2-character-state/` + runtime players | NPC key fields extracted (name, role, location, motive, personality, hiddenKnowledge, vulnerabilities). No raw JSON dump. |
| P4 | 300 | `memory/3-narrative-threads/` | Active threads only (not dormant/resolved) |
| P5 | 200 | `memory/4-thematic-layer/` | Thematic register |
| P6 | 200 | `memory/5-world-state/` | World beyond the players |
| P7 | 500 | Recent 6 messages | Conversation context |
| P8 | 200 | Trigger content | Player action or MC query |

**Measured token usage:** mc_query ~2,551 tokens (was ~2,950 before optimization).

---

## Memory Filesystem (`memory/`)

```
memory/
  1-plot-state/         9 files — current scene, session status, location, expedition, patrons, vessel, equipment, environment
  2-character-state/    2 files — NPC Starkweather (JSON), NPC Moore (JSON)
  3-narrative-threads/  10 files — dogs, journal, wind, mirage, equipment, radio, scent, tekeli-li, crude-carvings, violet-mountains
  4-thematic-layer/     3 files — session-0 register, recurring symbols, tone calibration
  5-world-state/        4 files — expedition status, offscreen events, wider world 1933, Antarctic conditions
```

Each level is a different grain of attention. The Keeper reads all levels; route handlers write stateUpdates from Keeper responses.

---

## Config Files (`config/`)

| File | Purpose |
|------|---------|
| `story.json` | Genre, tone, atmosphere, pacing, 5-session act structure |
| `world.json` | Era, geography, environment rules, technology |
| `characters.json` | 7 archetypes + 7 NPCs (incl. Starkweather/Moore) |
| `mechanics.json` | Quality-based resolution, journal system, knowledge fog, decision points, rescue pivots |
| `techniques.json` | 10 narrative techniques, sensory palette, 12 Keeper behavior rules |

---

## Design Documents

| Document | Path | Purpose |
|----------|------|---------|
| Project state | `ceremony_state.md` | Architecture, roles, memory, interfaces, token economy — the design contract |
| Preset v0 | `mountains_of_madness_preset_v0.md` | MoM storytelling DNA, world, characters, threads, Keeper behavior |
| Session structure v2 | `sources/session-structure-v2.md` | 5-session structure, decision points, timing, cosmological registers |
| Cosmological architecture | `sources/cosmological-architecture-v2.1.md` | 62KB Keeper philosophical operating system (Level 4+5 enrichment) |
| Patron design | `working/starkweather-moore.md` | Option B: True Believer + Skeptic profiles |
| Briefing document | `working/briefing-document.md` | Player-facing prop with HS/JM annotations |
| Evidence inventory | `working/evidence-inventory.md` | Every evidence piece, line-numbered from Lovecraft source |
| Code corpus | `working/code-corpus/` | 6 reference files for code quality grading |
| Source text | `sources/at_the_mountains_of_madness.txt` | Full Lovecraft (Project Gutenberg) |

---

## Infrastructure

| Resource | Details |
|----------|---------|
| Server | Hetzner VPS, Helsinki, 8GB RAM, ARM64, Ubuntu 24.04. IP: 46.62.231.96 |
| Runtime | Node.js v22 (nvm), npm 10.9.4 |
| Process manager | PM2 — `ceremony` :3004, `keeper` :3005. Config: `ecosystem.config.cjs` |
| Web server | Caddy — port 80 (gamedev only, not yet routing ceremony) |
| AI | Claude API via Haiku 4.5. Prompt caching, structured JSON output, rate-limited 10/min 100/session |
| Dev tools | Chrome DevTools MCP (`.mcp.json`), Git (main branch) |

### Design System (globals.css)

- Dark palette: background `#0a0e17`, surface `#131a2b`, accent gold `#c4a35a`, ice blue `#7ba4c7`, keeper green `#6b9e7a`
- Narrative text: Crimson font family, 1.8 line-height
- Custom scrollbars, role-based message styling

---

## The Keeper's Mind

The filesystem IS the Keeper's cognition. Not a database — a mind structured in five layers of increasingly abstract pattern. Each layer is a different grain of attention. The Keeper assembles context per turn by asking: *what does the Keeper need to know right now?* Mode-aware tier loading (`MODE_TIERS`) answers this question differently for each type of call.

The cosmological architecture (`sources/cosmological-architecture-v2.1.md`) is the most developed piece — 62KB of ontological structure, mythological grammar, entity taxonomy. It operates at Level 4 (Thematic) and Level 5 (World State). The Keeper doesn't quote it; it operates from it.

The vision: the Keeper develops its own patterns through what it reads and writes. Each session's state updates change the filesystem, which changes what the Keeper reads next turn, which changes how it responds. The data is the pattern. The observer shapes the observed.
