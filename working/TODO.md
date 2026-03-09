# The Ceremony — TODO

*Single source of truth for task tracking. Updated March 7, 2026.*

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
- **P7 History + stateUpdates** — recent history in context, filesystem writes from Keeper responses
- **Player State in Context** — players field on KeeperInput, P3 includes NPCs + runtime players
- **Token Optimization** — mode-aware tiers (MODE_TIERS), NPC field extraction, output caps (MODE_MAX_TOKENS), MAX_HISTORY 10→6. mc_query: ~2,950→~2,551 tokens (14% reduction)
- **Grading Audit** — 6 parallel agents, full report in working/grading-report.md

---

## In Progress

### Preset v0 Revision
Rewriting `mountains_of_madness_preset_v0.md` with 9 improvements:
- The Empathy Turn, murals as mechanic, penguins, Danforth's vision
- Decision points, Lake's Camp investigation, "Previously on..." recaps
- Expanded sensory palette, tone calibration (dread not nihilism)
- Updated to 5-session structure, patron Option B integrated

---

## Next Up

### 1. Security (audit grade: D)
No auth. Anyone can pass `role=mc`. No session tokens.
- Session token generation on join (signed, short-lived)
- Role enforcement on SSE channels and API routes
- Invite token validation on all protected endpoints

### 2. Character Creation Flow
No way to create player characters yet. Session 0 depends on this.
- Keeper-guided conversation (questions shaped by preset)
- Quality generation from conversation (no numerical stats)
- Starting journal template written by Keeper
- MC approval step before session starts

### 3. Tests (audit grade: F)
Zero test files. No test runner configured.
- vitest setup with tsconfig paths
- Route handler tests (messages, keeper, session)
- Keeper context assembly tests (verify MODE_TIERS, NPC extraction)
- Store/memory round-trip tests

### 4. Keeper Intelligence
The Keeper responds but doesn't fully close the loop yet.
- **Journal write-back** — `journalUpdate` field returned by Keeper is not persisted to player's journal. CharacterPanel shows static text.
- **Internal notes visibility** — `internalNotes` returned but discarded. Should appear in MC dashboard sidebar.
- **Keeper memory validation** — verify stateUpdates round-trip: Keeper writes → filesystem → appears in next call's context.

---

## Future

### Keeper Intelligence (continued)
- **Scene-end compression** — when MC advances act, compress recent history into state updates via Opus call. Raw messages archived. Keeper works from summaries.
- **"Previously on..." recaps** — auto-generate session recap from last session's state for session-start broadcast.
- **Thread evaluation automation** — periodic Keeper call (every N messages) to evaluate narrative thread status changes. Currently threads only advance via stateUpdates from regular calls.
- **Knowledge fog** — per-player tracking of what they've seen/heard. Filter Keeper context to player's actual knowledge. Currently all players share the same world view.

### MC Tools
- **MC-Keeper interaction patterns** — define backstage vocabulary: specific commands the MC can use live (ceremony_state.md #12)
- **NPC system** — NPC generation, evolution, voice boundary between MC-voiced and Keeper-voiced NPCs (#14)
- **Scene transition controls** — automated scene state updates when MC declares a new scene
- **Memory level browser** — MC dashboard sidebar shows actual memory file contents (currently placeholder)
- **MC override/inject** — plant clues, change NPC behavior, trigger events directly from dashboard

### Token Economy v2
- **Dynamic tier budgets** — if mc_query saves tokens by skipping tiers, reallocate to P3 or P7
- **Promote stable content to cache** — P5/P6 content that changes per-session (not per-turn) could move into cached system prompt
- **Model routing** — Opus for journal_write and compression (quality), Haiku for player_response and mc_query (speed)
- **Streaming responses** — stream Keeper output for faster perceived latency on MC dashboard
- **Compression pipeline** — scene-end and session-end compression to manage memory file growth

### Player Experience
- **Onboarding flow** — first-time player journey from invitation to playing (#15)
- **Mobile responsive** — /play and /mc pages for phones and tablets
- **Group channels** — player-created subsets for scheming and alliances

### Platform
- **Multiple presets** — ingestion pipeline as a general tool, not MoM-specific
- **Story archive** — completed ceremonies preserved and presentable (#16)
- **PvP mechanics** — competing player interests, secret actions, resolution systems (#13)

### Infrastructure
- **Deployment** — Docker compose, domain, SSL, Caddy routing for keeper-service (#18)
- **Voice** — Jitsi Meet self-hosted integration
- **Embeddings** — HuggingFace semantic search for memory engine (#17)
- **API cost modeling** — estimate per-session costs with current token usage (#20)

### Content (MoM Preset)
- **Reality document** — Lovecraft vs real Antarctic science reference for the Keeper
- **Character creation material** — preset-shaped prompts, atmospheric intro, quality vocabulary

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

## Open Design Questions

1. **Keeper's voice vs system's voice** — journal_write mode exists, but is the Keeper's journal voice distinct from its narrative voice? Different prompt frame?
2. **Memory write frequency** — currently writes after every Keeper call. Should some writes be batched per-scene instead?
3. **MC's filesystem access** — can MC read/write memory levels directly from dashboard? Or only through Keeper queries?
4. **Keeper autonomy** — can the Keeper create new narrative threads unprompted? Change world state without MC approval?
