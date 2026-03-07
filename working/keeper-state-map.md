# Keeper State Map — The Ceremony

*Project state mapped to goals. March 7, 2026.*
*For refinement before the Keeper is sent to oversee construction.*

---

## The Idea

An engagement platform for stories. Live ceremonies where an MC narrates by voice, players interact by text, and an AI agent — the Keeper — holds the full picture in a filesystem that IS its mind. The data is the pattern. The coarse-grained files carry the spirits of characters, threads, world state. The Keeper develops cognition through what it reads and writes.

---

## What Exists Now

### Layer 1: Design (ground truth documents)

| Document | Path | Status | What it establishes |
|----------|------|--------|-------------------|
| Project state | `ceremony_state.md` | Complete (v1) | Architecture, roles, memory system, interfaces, ingestion pipeline, session flow, token economy |
| Preset v0 | `mountains_of_madness_preset_v0.md` | Complete, needs v1 revision | Storytelling DNA, world, characters, NPCs, narrative threads, episode structure, Keeper behavior rules, sensory palette |
| Session structure v2 | `sources/session-structure-v2.md` | Complete | 5-session compressed structure (Session 0-4), decision points, timing, cosmological register per session |
| Cosmological architecture v2.1 | `sources/cosmological-architecture-v2.1.md` | Complete (~62KB) | Keeper's philosophical operating system. Ontological hierarchy, mythological grammar, entity taxonomy, phenomena layer, per-session strata table. Memory Level 4+5 enrichment. |
| Starkweather-Moore patrons | `working/starkweather-moore.md` | Complete | Patron profiles (Option B chosen: True Believer + Skeptic), briefing curation design, Dyer's role |
| Briefing document | `working/briefing-document.md` | Complete (v1) | Player-facing prop. Cover letter, expedition summary, Lake bulletins (annotated by HS/JM), route plan, design notes for MC/Keeper |
| Evidence inventory | `working/evidence-inventory.md` | Complete | Every piece of evidence categorized: FROM TEXT / DEDUCIBLE / INVENTED. Line-number references to Lovecraft source. |
| Session structure v1 | `working/session-structure-v1.md` | Superseded by v2 | Original 8-session structure. Kept for reference. |
| Source text | `sources/at_the_mountains_of_madness.txt` | Raw source | Full Lovecraft text (Project Gutenberg) |
| TODO | `working/TODO.md` | Active | Task tracking with priorities and decisions log |

### Layer 2: Web Interface (running code)

**Stack:** Next.js (App Router), Tailwind CSS, TypeScript
**Running at:** `http://46.62.231.96:3004` (PM2 process `ceremony`, port 3004)
**Source:** `web/`

| Component | Path | What it does | State |
|-----------|------|-------------|-------|
| Landing page | `web/src/app/page.tsx` | Title screen. Links to /play and /mc | Working |
| Player view | `web/src/app/play/page.tsx` | Join form -> story log + message input + character panel. Channels: all, keeper-private | Working (mock) |
| MC Dashboard | `web/src/app/mc/page.tsx` | Scene display (editable), story log, narrate/query-keeper mode toggle, session sidebar with memory levels placeholder, session controls (start/pause) | Working (mock) |
| Scene display | `web/src/components/SceneDisplay.tsx` | Shows current scene (location, title, description). MC can edit inline. | Working |
| Story log | `web/src/components/StoryLog.tsx` | Scrolling message feed. Styled per role: system (divider), MC (accent border), Keeper (green italic), player (ice blue) | Working |
| Character panel | `web/src/components/CharacterPanel.tsx` | Journal + Notes tabs. Journal is Keeper-written prose. Notes are player-editable. | Working (static) |
| Channel tabs | `web/src/components/ChannelTabs.tsx` | Switch between message channels | Working |
| Message input | `web/src/components/MessageInput.tsx` | Text input with context-aware placeholder | Working |
| Types | `web/src/lib/types.ts` | Role, Channel, Message, Player, Scene, Session types | Defined |
| State | `web/src/lib/state.ts` | In-memory session state. Mock Keeper responses (6 pre-written atmospheric responses, cycled). Player join. | Mock only |
| Session API | `web/src/app/api/session/route.ts` | GET session, POST join/start/pause, PATCH scene | Working (in-memory) |
| Messages API | `web/src/app/api/messages/route.ts` | GET messages (filtered by channel/player), POST message. Auto-responds from Keeper on keeper-private channel. | Working (mock) |
| Keeper API | `web/src/app/api/keeper/route.ts` | POST query -> mock response. Stores exchange in mc-keeper channel. | Mock only |

**Design system (globals.css):**
- Dark palette: background #0a0e17, surface #131a2b, accent gold #c4a35a, ice blue #7ba4c7, keeper green #6b9e7a
- Narrative text: Crimson font family, 1.8 line-height
- Custom scrollbars, role-based message styling

### Layer 3: Infrastructure

| Resource | State | Notes |
|----------|-------|-------|
| Hetzner VPS (ubuntu-8gb-hel1-1, Helsinki) | Running | 8GB RAM, ARM64, Ubuntu 24.04 |
| PM2 process manager | Running | `ceremony` on port 3004 |
| Caddy web server | Running | Currently serves port 80 only (gamedev, not ceremony) |
| Node.js v22 | Installed | Via nvm |
| Claude API credits | Available | console.anthropic.com |
| Chrome DevTools MCP | Configured | `.mcp.json` — browser automation for testing |

### Layer 4: Source Materials (not yet processed)

| Source | Path | Status |
|--------|------|--------|
| Lovecraft full text | `sources/at_the_mountains_of_madness.txt` | Raw, referenced by evidence-inventory.md |
| Orkhon inscriptions | `sources/orkhon.html` | Unprocessed. Turkic/Tengrist source? |
| Cosmological architecture | `sources/cosmological-architecture-v2.1.md` | Processed into Keeper reference doc |

---

## What's Built vs Designed vs Unresolved

### BUILT (functional, running)

- Web interface skeleton — landing, player view, MC dashboard
- Real-time polling (session state every 3s, messages every 2s)
- Session lifecycle (lobby -> active -> paused)
- Player join flow with name entry
- Multi-channel messaging (all, keeper-private, mc-keeper)
- MC narration broadcast to all channel
- MC scene editing (inline, PATCH to API)
- Character panel with journal/notes tabs
- Visual design system with role-differentiated message rendering
- Mock Keeper that returns pre-written atmospheric responses

### DESIGNED (documented, not yet coded)

- **Memory engine (5 levels):** Plot State, Character State, Narrative Threads, Thematic Layer, World State — filesystem-based. Paths defined in TODO: `memory/1-plot-state/` through `memory/5-world-state/`
- **Ingestion pipeline:** Source text -> extract DNA -> generate config -> human review -> initialize memory. Steps defined in ceremony_state.md.
- **Config files:** `config/story.json`, `config/world.json`, `config/characters.json`, `config/mechanics.json`, `config/techniques.json`
- **Character creation workflow:** Keeper-guided conversation, quality-based (no numerical stats), journal format
- **Session flow:** Pre-session prep, opening ritual, play loop, closing ritual, between-session state
- **Token economy:** ~1,500 tokens per Keeper turn via smart context assembly
- **Permission layers:** MC sees structure, players see their slice, Keeper sees everything
- **Keeper behavior rules:** 9 rules defined in preset v0 (no jumpscares, clinical precision, honor agency, etc.)
- **Narrative thread tracking:** Pre-planted foreshadowing with plant/payoff scheduling
- **Rescue pivots:** No permanent death by default, environmental interventions at cost
- **Cosmological register system:** Per-session strata, phenomena levels, archetypal keys
- **Briefing document:** Complete player-facing prop with patron annotations

### UNRESOLVED (items 11-20 from ceremony_state.md)

| # | Item | Dependency | Notes |
|---|------|-----------|-------|
| 10 | Dice & mechanics system | MC delivers separately | Quality-based, no numerical stats decided for MoM preset |
| 11 | **Keeper prompt architecture** | Blocks everything AI | How the Keeper assembles context from filesystem per turn. The prompt engineering core. |
| 12 | MC-Keeper interaction patterns | Needs #11 | Backstage vocabulary. What commands the MC uses live. |
| 13 | PvP mechanics | Low priority for first ceremony | Competing player interests, secret actions |
| 14 | NPC system | Needs #11 | How NPCs are generated, remembered, evolved. MC voice vs Keeper voice boundary. |
| 15 | Onboarding flow | Needs running app | First-time player journey |
| 16 | Story archive / showcase | Future | Completed ceremonies preserved |
| 17 | Hugging Face integration | Deferred | Semantic search for memory engine. Free tier evaluated. |
| 18 | Deployment plan | Needs app maturity | Docker compose, domain, SSL, Jitsi |
| 19 | **MoM first preset build** | Needs #11, config files | Actually run the ingestion pipeline on Lovecraft |
| 20 | API cost modeling | Needs #11 | Estimate Claude API usage per session |

**The critical blocker is #11: Keeper prompt architecture.** Everything downstream depends on how the Keeper reads and writes the filesystem.

---

## The Keeper's Mind

The filesystem IS the Keeper's cognition. Not a database — a mind structured in five layers of increasingly abstract pattern:

```
memory/
  1-plot-state/       <- what just happened (immediate context)
  2-character-state/  <- who everyone is right now (identity)
  3-narrative-threads/ <- what's been planted, what's ripening (intention)
  4-thematic-layer/   <- what the story is actually about (meaning)
  5-world-state/      <- everything beyond the players (the living world)
```

Each layer is a different grain of attention. The Keeper assembles context per turn by asking: *what does the Keeper need to know right now?* and pulling from the relevant layers. This is the smart routing problem (#11).

The cosmological architecture document (`sources/cosmological-architecture-v2.1.md`) is the most developed piece of the Keeper's mind — 62KB of ontological structure, mythological grammar, entity taxonomy, and decision logic. It operates at Level 4 (Thematic) and Level 5 (World State). The Keeper doesn't quote it; it operates from it.

The vision: the Keeper develops its own patterns through what it reads and writes. Each session's state updates change the filesystem, which changes what the Keeper reads next turn, which changes how it responds. The data is the pattern. The observer shapes the observed. The filesystem accretes meaning like geological strata — which is literally the metaphor of the first preset.

---

## Tools & Interfaces

### For the MC (human)
- **MC Dashboard** (`/mc`) — narrate, query Keeper, edit scenes, manage session
- **Voice** — Jitsi Meet (not yet deployed)
- **Design docs** — the working/ directory is the MC's prep space

### For Players
- **Player Board** (`/play`) — join, read story, send messages, private Keeper channel, journal + notes
- **Briefing document** — the player-facing prop (can be delivered digitally or printed)

### For the Keeper (AI)
- **Claude API** — the Keeper's processing (not yet connected)
- **Filesystem** — the Keeper's mind (memory/ directory, not yet initialized)
- **Keeper API** (`/api/keeper`) — currently mock, needs Claude API integration
- **Messages API** (`/api/messages`) — auto-responds on keeper-private channel (currently mock)
- **Cosmological architecture** — the Keeper's operating system for thematic depth

### For Construction (this conversation)
- **Claude Code** — the builder/observer. Has filesystem access, Chrome DevTools MCP, can read/write/run.
- **Chrome DevTools** — can navigate to `http://46.62.231.96:3004`, take screenshots, interact with the running app
- **PM2** — process management for the running app
- **Git** — version control (main branch, initial commit exists)

---

## The Gap: What Needs to Happen

### Phase 1: The Keeper's Core (unblocks everything)
1. **Design the prompt architecture** (#11) — how the Keeper assembles context from filesystem per turn
2. **Connect Claude API** — replace mock `getKeeperResponse()` in `web/src/lib/state.ts` with real API calls
3. **Initialize memory filesystem** — seed the 5 levels with MoM starting state
4. **Build config files** — run ingestion pipeline Step 3 on Lovecraft source

### Phase 2: The Living App
5. **Character creation flow** — Keeper-guided conversation, journal generation
6. **Memory read/write per turn** — the Keeper reads relevant context, responds, writes state updates
7. **MC-Keeper interaction** (#12) — backstage commands, live query, generate-on-demand
8. **NPC system** (#14) — Keeper-managed NPCs with independent state

### Phase 3: The Full Ceremony
9. **Session lifecycle** — pre-session prep, opening ritual, play loop, closing ritual
10. **Group channels** — player-created subsets for scheming
11. **Knowledge fog** — per-player visibility, what each player knows vs doesn't
12. **Session persistence** — state survives server restarts (currently in-memory only)

### Phase 4: The Platform
13. **Voice integration** (Jitsi)
14. **Multiple presets** — the ingestion pipeline as a general tool, not MoM-specific
15. **Onboarding flow** (#15)
16. **Story archive** (#16)
17. **Domain + SSL + deployment** (#18)

---

## Decisions Already Made

- Patron: Option B (Starkweather = True Believer aboard, Moore = Skeptic on radio)
- Sessions: 5 total (Session 0 co-creation + Sessions 1-4 play, ~90 min each)
- Mechanics: No dice, no numerical stats. Quality-based, journal format. AI resolves through judgment.
- Death: No permanent player death by default. Rescue pivots at cost. MC can override live.
- Knowledge: Symmetric base knowledge. Private channels for secret actions, not asymmetric revelation.
- Players start with: The briefing document (annotated by HS/JM)
- Dyer: Alive, deliberately excluded from expedition
- Session structure superseded: v1 (8 sessions) replaced by v2 (5 sessions)

---

## Open Questions for Refinement

1. **The Keeper's voice vs the system's voice.** When the Keeper writes to a player's journal, is that the same API call as when it responds to an MC query? Or are these different modes with different prompt frames?

2. **Memory write frequency.** Does the Keeper update the filesystem after every message? After every scene? After every session? The token economy says "after each scene, raw exchange compressed into state update" — but the granularity matters.

3. **The MC's relationship to the filesystem.** Can the MC read/write memory levels directly? Or only through the Keeper? The design says MC can "live query the file system" — but the permission layer says the MC doesn't see player-to-Keeper private channels. How is this enforced?

4. **Persistence.** Currently all state is in Node.js memory. Dies on restart. The filesystem-as-mind design implies file-based persistence — but the web app's session/message state is separate. When do these merge?

5. **The platform question.** Is the first goal a single working ceremony (MoM)? Or is the first goal the platform that can host any preset? The ingestion pipeline design suggests platform-first, but the TODO suggests MoM-first.

6. **Scope of the Keeper's autonomy.** The Keeper "develops his own mind" — but how much autonomy does it have to modify the filesystem? Can it create new narrative threads unprompted? Can it change world state without MC approval? Where is the boundary?

---

*This document is for the MC to review and refine. When the goals are clear, the Keeper begins construction.*
