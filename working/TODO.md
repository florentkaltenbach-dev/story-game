# The Ceremony — TODO

*Single source of truth for task tracking. Updated March 10, 2026.*

---

## Done

- **Patron Option** — Option B locked. Starkweather aboard, Moore on radio. `working/starkweather-moore.md`
- **Briefing Document** — Six-section folio in `working/briefing-document.md`
- **Episode Structure** — 5-session v2 in `sources/session-structure-v2.md` (supersedes v1's 8 sessions)
- **Config Files** — story.json, world.json, characters.json, mechanics.json, techniques.json in `config/`
- **Memory Levels Seeded** — 23 files across 5 levels in `memory/`
- **Infrastructure** — Keeper :3005 (Express + Claude API), web app :3004 (Next.js + SSE), PM2, session persistence
- **Hardening** — try/catch on all routes, per-player SSE filtering, notes persistence, JSONL rebuild
- **Session Lifecycle** — reconnection, act advancement, session transitions, MC controls
- **P7 History + stateUpdates** — recent history in context, filesystem writes from Keeper responses (stateUpdates superseded by script pipeline — see Decisions D2)
- **Player State in Context** — players field on KeeperInput, P3 includes NPCs + runtime players
- **Token Optimization** — mode-aware tiers (MODE_TIERS), NPC field extraction, output caps (MODE_MAX_TOKENS), MAX_HISTORY 10→6. mc_query: ~2,950→~2,551 tokens (14% reduction)
- **Grading Audit** — 6 parallel agents, full report in working/grading-report.md
- **Security** — HMAC token auth, role enforcement, invite validation (grade D→B)
- **Tests** — vitest suite: 56 tests covering routes, context assembly, store/memory (grade F→C)
- **Character Creation** — form-based creation with validation, MC approve/revise flow, revision comments (D5)
- **Script Pipeline** — deterministic extraction: journal write-back (D1), NPC extraction, location detection, environment parsing (D2, D6)
- **Event Trigger System** — preset-config triggers (location, NPC, keywords), event matcher, Keeper invocation (D4)
- **Session-Gated MC Access** — Session 0 read/write, Sessions 1+ read-only, gated on session.number (D3)
- **Script-Derived Widgets** — memory writes auto-generate widgets: NPC→dossier, environment→environment (D6)
- **Keeper Intelligence (D1-D6)** — internal notes visibility, memory validation, pipeline round-trip verified. 78 vitest tests passing

### Phase 1: Foundations (Complete)
- **Memory Browser** — MC panel shows file contents (lazy-loaded, JSON rendered as key-value, text as preformatted)
- **API Cost Tracking** — CostTracker class in keeper-service/lib.ts, GET /cost endpoint, MC dashboard polling
- **MC Backstage Commands** — `/generate`, `/reveal`, `/hint`, `/npc` commands parsed client-side (`mc-commands.ts`, 12 tests)
- **Scene Transitions** — scene updates write Level 1 memory, fire location_change events through trigger system

### Phase 2: Token Economy v2 (Complete)
- **Scene-End Compression** — POST /compress endpoint, compression on act advance/session end, recap broadcast
- **Model Routing** — MODE_MODELS table: Haiku for speed modes, quality model for compression/journal
- **Dynamic Tier Budgets** — skipped tiers redistribute 60/40 to P3 (characters) and P7 (history)
- **Cache Promotion** — P5/P6 moved to cached system prompt (change per-session, not per-turn)

### Phase 3: MC Power Tools + Knowledge Fog (Complete)
- **NPC Management Panel** — NpcPanel with CRUD, voicedBy (MC vs Keeper), status tracking, preset vs memory NPCs
- **MC Override/Inject** — memory POST accepts `override: true` (bypasses session gate with audit log), manual trigger endpoint
- **Knowledge Fog** — per-player ledger (`knowledge-{playerId}`), keeper context filtered to known NPCs, `deriveKnowledge` from pipeline events
- **Thread Evaluation** — POST /evaluate-threads endpoint, auto-triggered every 10 player messages

### Phase 4: Player Experience (Complete)
- **Streaming Responses** — POST /query/stream with prompt-based JSON (no json_schema), SSE keeper_typing events, StoryLog typing indicator
- **Onboarding Wizard** — welcome → briefing → character creation → waiting → playing state machine
- **Group Channels** — player-created channels, membership validation, SSE filtering, create dialog, dynamic channel tabs
- **Mobile Polish** — viewport meta, theme-color, safe-area handling, input-safe-area, visualViewport resize handling

### Phase 5: Platform + Infrastructure (Complete)
- **Docker/Caddy Deployment** — Dockerfile.web, Dockerfile.keeper, docker-compose.yml, Caddyfile
- **Multiple Presets** — presets/ directory, presets/index.json registry, GET /api/presets endpoint
- **Story Archive** — createStoryArchive (session + all memory), listStoryArchives, GET/POST /api/archive
- **PvP Mechanics** — secret-action channel (player + MC only), Keeper evaluates observability, public observation if noticed
- **Presets Registry** — presets/mountains-of-madness/ with all config files, index.json metadata

---

## In Progress

### Preset v0 Revision
Rewriting `mountains_of_madness_preset_v0.md` with 9 improvements:
- The Empathy Turn, murals as mechanic, penguins, Danforth's vision
- Decision points, Lake's Camp investigation, "Previously on..." recaps
- Expanded sensory palette, tone calibration (dread not nihilism)
- Updated to 5-session structure, patron Option B integrated

---

## Lore & Content

New source material added. Gap tracking from `working/lore-expansion-brief.md`.

### Source Texts Added
- `sources/byrd-little-america.txt` — Byrd's first expedition, full text
- `sources/fungi_from_yuggoth.txt`, `sources/the_haunter_of_the_dark.txt`, `sources/the_whisperer_in_darkness.txt`, `sources/through_the_gates_of_the_silver_key.txt` — Lovecraft Mythos texts
- `sources/historical-notes-1930s.md` — period research (expeditions, psychology, funding, fringe science)
- `sources/ross_sea_party_supplement.md` — location catalog, NPC archetypes, discoverable objects
- `working/lore-expansion-brief.md` — gap tracking and research prompts

### Design Gaps

- D1 Other 1933 expeditions — ✅ Filled (historical-notes, byrd-little-america)
- D2 Depression-era funding — ✅ Filled (historical-notes §Academic/Funding)
- D3 Real Antarctic logistics — 🔶 Partial (Byrd text has detail; needs extraction into usable notes)
- D4 1933 communication tech — ❌ Open
- D5 Dornier seaplane specs — ❌ Open
- D6 Lovecraft's own context — 🔶 Partial (Mythos texts added; biographical context still open)
- D7 1930s academic culture — ✅ Filled (historical-notes §Academic)
- D8 Period media/public knowledge — ❌ Open

### In-Game Gaps

- G1 Gedney's fate — ❌ Open (design decision needed)
- G2 Dyer's private account — ❌ Open
- G3 Lake's final hours — ❌ Open
- G4 Miskatonic's response to Dyer — ❌ Open
- G5 Danforth's condition — ❌ Open
- G6 Dog handler and breeder — ❌ Open (design decision needed)
- G7 Starkweather-Moore partnership origin — ❌ Open
- G8 Public story of first expedition — ❌ Open
- G9 Geographic error — ❌ Open (design decision needed)
- G10 Dyer's 1933 daily life — ❌ Open
- G11 Dogs from same breeder — ❌ Open (design decision needed)

### Integration Tasks

- [x] Update `config/world.json` with Ross Sea Party locations and discoverable objects
- [x] Update `config/characters.json` with NPC archetypes from Ross Sea Party supplement
- [x] Seed memory level 5 (World State) with historical/lore material
- [x] Update `mountains_of_madness_preset_v0.md` with new lore references

---

## Future

### Remaining Items
- **Jitsi voice** — self-hosted voice integration (Docker container + iframe embed)
- **Embeddings** — HuggingFace semantic search for memory engine (defer until memory outgrows token budgets)
- **Preset builder UI** — MC-facing tool to create new presets from the dashboard
- **Active preset switching** — config/ symlink management, session creation picks preset
- **Archive viewer** — read-only story viewer page at /archive

---

## Decisions (ground truth)

- Patron: Option B — Starkweather (True Believer, aboard) + Moore (Skeptic, radio)
- Sessions: 5 total (0=co-creation, 1-4=play, ~90min each)
- Mechanics: No dice, quality-based, journal format
- Death: No permanent death by default; rescue pivots (MC can override)
- Knowledge: All players start with same base briefing
- Starkweather and Moore names canon from Lovecraft; details are our invention
- Dyer alive but deliberately excluded
- v1 (8 sessions) superseded by v2 (5 sessions)
- MoM-first, then generalize to platform
- **Journal voice: Hybrid** — player voice for observations ("I saw..."), narrator voice for world details. `voice` field (`"player"` | `"narrator"`) on journal updates for UI styling
- **Memory writes: Full script pipeline** — Keeper returns only `narrative` + `journalUpdate`. All memory writes handled by deterministic scripts (regex/parsing, not LLM). No `stateUpdates[]` from Keeper
- **MC filesystem access: Per-session phase** — Session 0 (co-creation): full read/write. Sessions 1-4 (live play): read-only. Gated on `session.number` field
- **Keeper autonomy: Event-triggered** — specific narrative events (location change, NPC mention, keywords) trigger Keeper evaluation. No timer/polling. Events defined in preset config. Each trigger = one Keeper call
- **Character creation: Form-based** — keep existing CharacterCreation form (archetype, background, motivation, fear, qualities, relationships). MC approval flow exists, needs polish. No Keeper involvement
- **Widget-Keeper coupling: Script-derived** — deterministic scripts watch memory writes. New NPC file → `npc_dossier` widget. Environment update → `environment` widget. Inventory change → `inventory` widget. No LLM needed

## Resolved Design Questions

*Previously open, now answered (March 10, 2026):*

1. ~~**Keeper's voice vs system's voice**~~ → **Hybrid voice** (D1 above)
2. ~~**Memory write frequency**~~ → **Full script pipeline** (D2 above)
3. ~~**MC's filesystem access**~~ → **Per-session phase** (D3 above)
4. ~~**Keeper autonomy**~~ → **Event-triggered** (D4 above)
