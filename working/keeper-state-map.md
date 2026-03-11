# System Map — The Ceremony

*What exists, where it lives, how it connects. Updated March 11, 2026.*
*For tasks, see `working/TODO.md`. For design spec, see `ceremony_state.md`.*

---

## Architecture

```
[Browser]  ←SSE→  [Next.js :3004]  ──HTTP──→  [Keeper :3005]  ──HTTPS──→  [Claude API]
  /play              store.ts                    server.ts                   Haiku 4.5
  /mc                events.ts                   context assembly
                     memory.ts                   prompt cache
                     keeper.ts (proxy)            rate limiter
                     compression.ts              cost tracker
                     scripts/pipeline.ts         model routing
                     scripts/knowledge.ts        streaming
```

**Two-process split.** Next.js handles UI/routes/state; Keeper runs as standalone Express service.

**PM2 config:** `ecosystem.config.cjs` — ceremony :3004, keeper :3005, rigging :3006.
**Docker:** `docker-compose.yml` — web, keeper, caddy containers.

---

## Web App (`web/`, port 3004)

### Pages

| Route | Purpose |
|-------|---------|
| `/` | Landing — theatrical intro, Enter as Player / MC Dashboard |
| `/play` | Player: invite gate → onboarding wizard → game (scene + channels + story log) |
| `/mc` | MC dashboard: scene editor, story log, narrate/query modes, right panel shelf |

### Components

| Component | Purpose |
|-----------|---------|
| SceneDisplay | Current scene with inline MC editing |
| StoryLog | Message feed with streaming indicator, role-styled |
| CharacterPanel | Journal + Notes tabs, debounced auto-save |
| ChannelTabs | All, keeper-private, MC↔Keeper, group channels |
| MessageInput | Text input with mobile keyboard handling |
| OnboardingWizard | welcome → briefing → character → waiting state machine |
| mc/panels/MemoryPanel | 5-level memory browser with expandable file content |
| mc/panels/NpcPanel | NPC CRUD (voicedBy, status, preset vs memory) |
| mc/panels/SessionPanel | Session controls + cost tracking display |

### Libraries

| Module | Purpose |
|--------|---------|
| types.ts | All shared types (Channel, Message, Player, Session, Widget, etc.) |
| store.ts | In-memory state, session persistence, group channels, invites |
| keeper.ts | RemoteKeeper (query, streamQuery, compress, getCost) + MockKeeper |
| memory.ts | Filesystem engine: atomic writes, JSONL, archive |
| events.ts | SSE emitter + per-player/channel/widget filtering |
| auth.ts | HMAC token creation/verification, role enforcement |
| compression.ts | Act compression orchestrator, recap builder |
| mc-commands.ts | MC backstage command parser (/generate, /reveal, /hint, /npc) |
| scripts/pipeline.ts | Deterministic extraction: journal, NPC, location, environment |
| scripts/knowledge.ts | Knowledge fog ledger (per-player, derive from events) |
| scripts/triggers.ts | Event matching, cooldowns, Keeper invocation |

### API Routes

| Endpoint | Purpose |
|----------|---------|
| GET/POST `/api/session` | Session state, join/start/pause/advance/end, scene PATCH, characters |
| GET/POST `/api/messages` | Messages + pipeline + triggers + streaming + knowledge fog + PvP |
| POST `/api/keeper` | MC → Keeper query with backstage commands |
| GET `/api/events` | SSE stream with per-player/channel filtering |
| POST `/api/invites` | Create/validate invite tokens |
| GET/POST `/api/channels` | Group channel CRUD |
| GET/POST `/api/archive` | Story archive (create snapshot, list, read) |
| GET `/api/presets` | Preset registry |
| POST `/api/triggers` | Manual trigger fire (MC-only) |
| POST `/api/auth` | MC authentication, token refresh |
| GET `/api/keeper/cost` | Cost tracking proxy |
| GET `/api/memory` | Memory level browser |

---

## Keeper Service (`keeper-service/`, port 3005)

### Endpoints

| Endpoint | Purpose |
|----------|---------|
| POST /query | Single Keeper call with context assembly |
| POST /query/stream | SSE streaming for player_response (no json_schema) |
| POST /compress | Act compression with structured output |
| POST /evaluate-threads | Thread status evaluation |
| GET /cost | Cost tracking summary by mode |
| GET /health | Status check |

### Context Assembly (8 tiers, mode-aware)

| Tier | Budget | Source |
|------|--------|--------|
| P0+P1 | ~2,000 | System prompt (cached) — identity + preset DNA |
| P2 | 300 | Level 1: current scene |
| P3 | 600 | Level 2: NPCs + runtime players (key fields extracted) |
| P4 | 300 | Level 3: active narrative threads |
| P5 | 200 | Level 4: thematic register (cached in system prompt) |
| P6 | 200 | Level 5: world state (cached in system prompt) |
| P7 | 500 | Recent 6 messages |
| P8 | 200 | Input (player action or MC query) |

Dynamic budgets: skipped tiers redistribute 60/40 to P3 + P7.
Model routing: Haiku for speed modes, KEEPER_QUALITY_MODEL for compression/journal.

---

## Memory Filesystem (`memory/`)

```
1-plot-state/         9 files — scene, location, expedition, patrons, vessel, equipment, environment, session
2-character-state/    2 files — NPC Starkweather, NPC Moore (+ runtime knowledge ledgers)
3-narrative-threads/  10 files — dogs, journal, wind, mirage, equipment, radio, scent, tekeli-li, carvings, mountains
4-thematic-layer/     3 files — session register, recurring symbols, tone calibration
5-world-state/        5 files — expedition status, offscreen events, wider world, Antarctic conditions, Ross Sea Party
```

---

## Auth

- HMAC-SHA256 tokens: `base64url(payload).base64url(hmac)`, 24h expiry
- MC: MC_SECRET → POST /api/auth → token
- Players: invite → join → token
- SSE: `?token=` query param
- Inter-process: X-Ceremony-Secret header
- Session gate: Session 0 RW, Sessions 1+ RO (override with audit log)

---

## Config & Presets

| File | Purpose |
|------|---------|
| config/story.json | Genre, tone, atmosphere, 5-session structure |
| config/world.json | Geography, environment, technology |
| config/characters.json | Archetypes + NPCs |
| config/mechanics.json | Quality-based resolution, journal system |
| config/techniques.json | Narrative techniques, sensory palette, Keeper rules |
| config/triggers.json | Event triggers (location, NPC, keywords) |
| presets/index.json | Preset registry metadata |
| presets/mountains-of-madness/ | Full preset with all config files |

---

## Tests (109 passing)

| File | Tests | Coverage |
|------|-------|----------|
| keeper-service/__tests__/lib.test.ts | 19 | Token estimation, rate limiter, cost tracker |
| web/lib/__tests__/auth.test.ts | 19 | HMAC tokens, verification, request auth |
| web/lib/__tests__/store.test.ts | 15 | Session state, players, characters, invites |
| web/lib/__tests__/events.test.ts | 7 | SSE filtering, event routing |
| web/lib/__tests__/mc-commands.test.ts | 12 | Command parsing |
| web/lib/scripts/__tests__/pipeline.test.ts | 20 | Extraction pipeline |
| web/lib/scripts/__tests__/triggers.test.ts | 7 | Event matching, cooldowns |
| web/lib/scripts/__tests__/widget-deriver.test.ts | 7 | Widget derivation |
| web/lib/scripts/__tests__/roundtrip.test.ts | 3 | Pipeline round-trip |
