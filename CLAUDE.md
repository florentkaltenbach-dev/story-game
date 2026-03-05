# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"The Ceremony" — an AI-powered interactive adventure story platform where live sessions (ceremonies) are run with voice + text companion. Think tabletop RPG meets theater, with an AI agent ("The Keeper") managing game state.

**Current status:** Design phase. No code written yet. Two design documents define the architecture.

## Key Documents

- `ceremony_state.md` — Master project state document covering architecture, roles, memory system, interfaces, session flow, and remaining design tasks
- `mountains_of_madness_preset_v0.md` — First story preset: a Lovecraft-inspired campaign config demonstrating the ingestion pipeline output format

## Architecture (Planned)

**Three roles:**
- **MC (human storyteller)** — narrates via voice, sees structured data, queries the Keeper
- **The Keeper (AI agent, Claude API)** — manages all game state, responds to players and MC, only entity with full picture
- **Players (up to 5)** — interact via text companion app

**Tech stack:** Next.js (text companion), Jitsi Meet (voice), Claude API (AI brain), Node.js file system (memory engine), Hetzner/Docker/Caddy (infrastructure)

**Memory system — 5 levels:** Plot State, Character State, Narrative Threads, Thematic Layer, World State. Each level has permission layers (MC sees most, players see their own slice, Keeper sees everything).

**Token economy target:** ~1,500 tokens per Keeper turn via smart context assembly and compression.

## Design Tasks Remaining

Items 11-20 in `ceremony_state.md` are unresolved: Keeper prompt architecture, MC-Keeper interaction patterns, PvP mechanics, NPC system, onboarding, story archive, embeddings integration, deployment, first preset build, API cost modeling.

## Deployment Context

This project lives on a Hetzner VPS (ubuntu-8gb-hel1-1). See the root `~/CLAUDE.md` for server details, PM2 setup, and Caddy configuration. When code is written, it will likely run as a PM2-managed SvelteKit or Next.js app behind Caddy.
