# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"The Ceremony" — an AI-powered interactive adventure story platform. Live sessions (ceremonies) are run with voice + text companion. Three roles: MC (human narrator), Keeper (Claude API agent managing game state), and up to 5 Players (text companion). Think tabletop RPG meets theater.

First preset: "At the Mountains of Madness" (Lovecraft, 1933 second expedition).

**Status:** All code complete. Remaining work is narrative design (preset content, lore gaps).

## Architecture

Two-process system communicating over HTTP:

- **`web/`** — Next.js 16 (React 19, Tailwind 4) text companion app on port 3004. Handles auth, SSE events, session state, the script pipeline, and all player/MC UI. Base path: `/the-ceremony`.
- **`keeper-service/`** — Express 5 + Claude API on port 3005. Receives structured `KeeperInput`, assembles context from memory filesystem, calls Claude, returns `KeeperResponse`. Handles model routing, token budgets, compression, and thread evaluation.
- **`rigging/`** — Zero-dependency Node.js infrastructure dashboard on port 3006.

Communication: web → HTTP POST → keeper-service → Claude API. Auth between services via `KEEPER_SHARED_SECRET`.

### Memory System (Filesystem)

The `memory/` directory is the game's persistent brain — 5 numbered levels:
1. `1-plot-state/` — current scene, act summaries, session progress
2. `2-character-state/` — player journals, knowledge ledgers, character data
3. `3-narrative-threads/` — thread JSON files (dormant→planted→growing→ripe→resolved)
4. `4-thematic-layer/` — atmosphere, motifs, tone guidance
5. `5-world-state/` — geography, NPCs, environment

The Keeper reads these levels for context assembly. Scripts write to them deterministically (no LLM state writes).

### Script Pipeline

`web/src/lib/scripts/` contains deterministic extractors that run on every message:
- `pipeline.ts` — orchestrator, runs all extractors in sequence
- `journal.ts`, `npc-extractor.ts`, `location.ts`, `environment.ts` — data extractors
- `knowledge.ts` — per-player knowledge fog ledger
- `triggers.ts` — event trigger matching against preset config
- `widget-deriver.ts` — derives UI widgets from memory state

### Key Modules

- `web/src/lib/types.ts` — all shared TypeScript types (also partially duplicated in `keeper-service/types.ts`)
- `web/src/lib/store.ts` — in-memory session state, persistence, invites, group channels
- `web/src/lib/events.ts` — SSE emitter with per-player/widget/channel filtering
- `web/src/lib/auth.ts` — HMAC token authentication (24h expiry)
- `web/src/lib/keeper.ts` — `RemoteKeeper` (HTTP to keeper-service) + `MockKeeper` (filesystem-backed)
- `web/src/lib/compression.ts` — act compression + recap building
- `web/src/lib/mc-commands.ts` — MC backstage command parser (`/generate`, `/reveal`, `/hint`, `/npc`)
- `keeper-service/lib.ts` — pure functions: token estimation, tier budgets, model routing, rate limiting, cost tracking
- `keeper-service/server.ts` — `ClaudeKeeper` class, context assembly from all 5 memory levels, streaming

### Preset System

`presets/` holds story configurations. `config/` holds the active preset's runtime config (story.json, world.json, characters.json, mechanics.json, techniques.json, triggers.json). Presets define archetypes, NPCs, trigger conditions, and narrative techniques.

## Commands

### Development

```bash
# Web app (Next.js)
cd web && npm run dev          # Dev server on :3004
cd web && npm run build        # Production build
cd web && npm run lint         # ESLint
cd web && npm run typecheck    # tsc --noEmit

# Keeper service
cd keeper-service && npm run dev    # Dev with tsx watch on :3005
cd keeper-service && npm run typecheck

# Both together (production)
pm2 start ecosystem.config.cjs     # Starts ceremony, keeper, rigging
pm2 restart ceremony keeper         # Restart after changes
```

### Tests

```bash
cd web && npm test                          # Run all web tests (vitest)
cd web && npx vitest run src/lib/__tests__/auth.test.ts   # Single test file
cd web && npm run test:watch                # Watch mode

cd keeper-service && npm test               # Run keeper tests
cd keeper-service && npx vitest run __tests__/lib.test.ts  # Single test
```

109 tests across 9 files. Test locations:
- `web/src/lib/__tests__/` — auth, events, mc-commands, store
- `web/src/lib/scripts/__tests__/` — pipeline, roundtrip, triggers, widget-deriver
- `keeper-service/__tests__/` — lib (token estimation, rate limiter, cost tracker)

### Docker

```bash
docker compose up --build       # Full stack (web + keeper + caddy)
```

## Environment

Copy `.env.example` to `.env`. Required vars:
- `CEREMONY_TOKEN_SECRET` — HMAC signing key (32 bytes hex)
- `MC_SECRET` — MC login password (16 bytes hex)
- `KEEPER_SHARED_SECRET` — inter-service auth (32 bytes hex)
- `KEEPER_BACKEND` — `mock` (default, no API calls) or `remote` (real Claude API)

`setup.sh` generates secrets and installs dependencies.

## Deployment

Hetzner VPS (Helsinki, ARM64, 8GB RAM). PM2 manages processes. Caddy reverse-proxies `/the-ceremony/*` to :3004. Public URL: `https://www.kaltenbach.dev/the-ceremony/`.

## Key Design Decisions

- **No dice** — quality-based mechanics, journal format
- **Keeper = storytelling voice** (LLM). **Scripts = bookkeeping** (deterministic). No LLM state writes.
- **Token economy** — mode-aware tiers (MODE_TIERS), ~1,500 tokens/turn, Haiku for speed, quality model configurable
- **Memory writes** — full script pipeline extracts state; the Keeper never writes to memory directly
- **Session structure** — Session 0 is co-creation (MC has filesystem RW), Sessions 1-4 are play (MC has RO)
- **Knowledge fog** — players only see NPCs/locations they've encountered (per-player ledger in Level 2)
