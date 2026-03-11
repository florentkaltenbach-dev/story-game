# The Ceremony — TODO

*Single source of truth for task tracking. Updated March 11, 2026.*

---

## Done

### Foundation (D1-D6, pre-phases)
- **Patron Option** — Option B locked. Starkweather aboard, Moore on radio
- **Briefing Document** — Six-section folio in `working/briefing-document.md`
- **Episode Structure** — 5-session v2 in `sources/session-structure-v2.md`
- **Config Files** — story, world, characters, mechanics, techniques in `config/`
- **Memory Levels Seeded** — 29 files across 5 levels in `memory/`
- **Infrastructure** — Two-process architecture (web :3004, keeper :3005), PM2, session persistence
- **Hardening** — try/catch on all routes, per-player SSE filtering, JSONL rebuild
- **Session Lifecycle** — reconnection, act advancement, session transitions, MC controls
- **Token Optimization** — mode-aware tiers, NPC field extraction, output caps, MAX_HISTORY 6
- **Security** — HMAC token auth, role enforcement, invite validation, inter-process auth
- **Tests** — 109 vitest tests across 9 files
- **Character Creation** — form-based with MC approve/revise flow
- **Script Pipeline** — deterministic extraction: journal, NPC, location, environment, widgets
- **Event Trigger System** — preset-config triggers, event matcher, Keeper invocation
- **Session-Gated MC Access** — Session 0 read/write, Sessions 1+ read-only

### Phase 1: Foundations
- **Memory Browser** — MC panel with expandable file contents, JSON/markdown rendering
- **API Cost Tracking** — CostTracker class, GET /cost endpoint, MC dashboard display
- **MC Backstage Commands** — `/generate`, `/reveal`, `/hint`, `/npc` (12 tests)
- **Scene Transitions** — scene updates write Level 1 memory, fire location_change triggers

### Phase 2: Token Economy v2
- **Scene-End Compression** — POST /compress, compression on act advance/session end, recap broadcast
- **Model Routing** — MODE_MODELS table (Haiku for speed, quality model configurable)
- **Dynamic Tier Budgets** — skipped tiers redistribute 60/40 to P3/P7
- **Cache Promotion** — P5/P6 in cached system prompt

### Phase 3: MC Power Tools + Knowledge Fog
- **NPC Management Panel** — CRUD, voicedBy (MC vs Keeper), status, preset vs memory NPCs
- **MC Override/Inject** — memory POST override flag, audit log, manual trigger endpoint
- **Knowledge Fog** — per-player ledger, Keeper context filtered to known NPCs, deriveKnowledge
- **Thread Evaluation** — POST /evaluate-threads, auto-triggered every 10 messages

### Phase 4: Player Experience
- **Streaming Responses** — POST /query/stream, SSE keeper_typing, StoryLog typing indicator
- **Onboarding Wizard** — welcome → briefing → character creation → waiting → playing
- **Group Channels** — player-created, membership validation, SSE filtering, dynamic tabs
- **Mobile Polish** — viewport meta, theme-color, safe-area, visualViewport handling

### Phase 5: Platform + Infrastructure
- **Docker/Caddy** — Dockerfile.web, Dockerfile.keeper, docker-compose.yml, Caddyfile
- **Multiple Presets** — presets/ directory, index.json registry, GET /api/presets
- **Story Archive** — createStoryArchive, listStoryArchives, GET/POST /api/archive
- **PvP Mechanics** — secret-action channel, observability evaluation
- **Presets Registry** — presets/mountains-of-madness/ with full config

### Lore Integration
- Source texts added (Byrd, Lovecraft Mythos, historical notes, Ross Sea Party)
- Config updated with Ross Sea Party locations, NPC archetypes, Level 5 world state
- Preset v0 updated with lore references

---

## Lore & Content (narrative design, not code)

### Preset v0 Revision (in progress)
Rewriting `mountains_of_madness_preset_v0.md` with 9 improvements:
empathy turn, murals as mechanic, penguins, Danforth's vision, decision points,
Lake's Camp investigation, recaps, expanded sensory palette, tone calibration.

### Research Gaps
- D3 Real Antarctic logistics — **filled** (fuel, dogs, drill, whaling, medical, navigation in `sources/period-tech-culture-1933.md`)
- D4 1933 communication tech — **filled** (full radio arc: spark gap → shortwave voice, Antarctic degradation mechanics in `sources/period-tech-culture-1933.md` §6)
- D5 Dornier seaplane specs — **partial** (narrative texture filled; exact model numbers, range, fuel arithmetic still open)
- D6 Lovecraft biographical context — **substantially filled** (Pym, Roerich, rare book culture added in `sources/period-tech-culture-1933.md` §8–10)
- D8 Period media/public knowledge — **filled** (newspapers, telegrams, doubted photography in `sources/period-tech-culture-1933.md` §2, §7, §15)

### In-Game Gaps (design decisions needed)
- G1 Gedney's fate
- G2 Dyer's private account
- G3 Lake's final hours
- G5 Danforth's condition
- G6 Dog handler significance
- G9 Geographic error handling
- G4, G7, G8, G10, G11 — secondary narrative gaps

---

## Visualizer — Ecosystem-Wide Visual Upgrades

Code visualization techniques (graphs, state machines, swimlanes, heatmaps) applied to game state and infrastructure.
Spans all surfaces: MC dashboard, player companion, Rigging, Hub, standalone D3 pages.
Full plan with file mapping in `working/visualizer-todo.md`.

| Priority | Visualizer | Surfaces | Backend Changes |
|----------|-----------|----------|-----------------|
| V1 | Relationship Map (force-directed entity graph) | MC panel + D3 page + Rigging viz | None |
| V2 | Knowledge Fog Matrix (player × secrets heatmap) | MC panel + D3 page | None (fog API exists) |
| V4 | State Transition Badges (inline state machines) | MC + Player + Rigging + Hub | None |
| V3 | Session Timeline (swimlane sequence diagram) | MC panel + D3 page | None |
| V10 | Player Journey Arc (personal narrative path) | Player companion | None |
| V5 | Memory Constellation (memory file graph) | MC modal + D3 page | Cross-ref index |
| V8 | Enhanced Hub Project Cards (mini topology) | Hub | None |
| V6 | Budget Flame (token tier stacked bars) | MC panel + D3 page | Keeper-service logging |
| V9 | Rigging Network Topology (interactive graph) | Rigging + D3 page | None |
| V7 | Pipeline Debug View (data flow diagram) | MC debug + D3 page | Pipeline instrumentation |

---

## Future (not blocking playtests)

- **Jitsi voice** — self-hosted voice (Docker + iframe)
- **Embeddings** — semantic search (defer until memory outgrows tokens)
- **Preset builder UI** — MC tool to create presets
- **Archive viewer** — read-only story page at /archive (API exists)
- **Domain + HTTPS** — Caddyfile needs domain for auto-HTTPS

---

## Decisions (ground truth)

- Patron: Option B — Starkweather (aboard) + Moore (radio)
- Sessions: 5 total (0=co-creation, 1-4=play, ~90min each)
- Mechanics: No dice, quality-based, journal format
- Death: No permanent death; rescue pivots (MC override)
- Journal voice: Hybrid (player + narrator), `voice` field
- Memory writes: Full script pipeline (no LLM state writes)
- MC filesystem: Session-gated (Session 0 RW, 1+ RO)
- Keeper autonomy: Event-triggered (no polling)
- Character creation: Form-based + MC approval
- Widgets: Script-derived from memory writes
