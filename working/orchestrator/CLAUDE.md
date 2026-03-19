# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Directory Is

`working/orchestrator/` is a **task orchestration workspace** within the "The Ceremony" story-game project. It contains structured multi-step execution plans designed for multi-agent workflows — sequential and parallel steps with explicit file ownership to prevent conflicts.

This is **not a standalone codebase.** All source code lives in the parent project at `/home/claude/projects/story-game/`. See the parent `CLAUDE.md` there for full project architecture, commands, and design decisions.

## Orchestrator Prompt Format

`orchestrator-prompt.md` defines a DAG of steps:

- **Sequential steps** (blocking) must complete before dependents start
- **Parallel steps** can run concurrently — file ownership table at the bottom guarantees no two parallel agents write the same file
- Each step specifies: goal, files touched (CREATE/MODIFY), read-only files, and acceptance criteria
- **W** = writes/creates, **R** = reads only — this is the concurrency safety contract

## Current Plan: Autodiscovery + Story Matrix

Five steps total. The plan replaces hardcoded viz registration with filesystem-based autodiscovery, then builds a story matrix visualization.

**Execution flow:**
```
Step 1 (seq)  → Viz metadata convention spec
Step 2A/2B (par) → Autodiscovery scanner + Retrofit existing viz pages
Step 3 (seq)  → Integration verify
Step 4A/4B/4C (par) → Story matrix JSON + TS types + D3 viz page
Step 5 (seq)  → Final integration verify
```

## Key Project Paths (relative to `/home/claude/projects/story-game/`)

| Path | Role |
|---|---|
| `web/` | Next.js 16 app (port 3004) |
| `keeper-service/` | Express 5 + Claude API (port 3005) |
| `rigging/server.js` | Infrastructure dashboard (port 3006), hosts viz gallery at `/viz` |
| `web/public/*.html` | Standalone D3 visualization pages |
| `config/` | Active preset runtime config (JSON) |
| `memory/` | 5-level filesystem memory system |
| `/home/claude/projects/hub/server.js` | Project discovery hub (port 3080) |
| `hub.json` | Project metadata consumed by the hub |

## Commands for This Work

```bash
# Run services (from project root)
pm2 start ecosystem.config.cjs     # Starts ceremony, keeper, rigging
pm2 restart rigging                 # After modifying rigging/server.js

# Verify viz autodiscovery
curl http://localhost:3006/api/viz-manifest  # Should return discovered viz pages
curl http://localhost:3006/viz               # Should render viz gallery

# Web app
cd web && npm run dev               # Dev server on :3004
cd web && npm run typecheck         # Verify types.ts changes

# Tests
cd web && npm test                  # All web tests (vitest)
cd keeper-service && npm test       # Keeper tests
```

## D3 Viz Page Pattern

Existing viz pages follow a consistent pattern:
- Self-contained HTML with D3 v7 from CDN
- Fonts: Crimson Text + JetBrains Mono (Google Fonts)
- Palette: dark navy background, gold/green accents
- Full-viewport SVG with zoom/pan
- Data either embedded inline or fetched from `/config/`

Currently 5 viz pages: `codebase-map.html`, `engine-skeleton.html`, `story-skeleton.html`, `relationship-map.html`, `fog-matrix.html`

## Architecture Decision: Data Format

**JSON for all data, TypeScript only for type definitions.** Preset config, memory levels, narrative threads, and story matrix data are all JSON files organized by domain. Types live in `web/src/lib/types.ts`.
