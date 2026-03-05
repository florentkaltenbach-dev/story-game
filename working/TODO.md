# story-game TODO

*Tracked tasks. Ordered roughly by priority/dependency.*

---

## Next Up (from this session's work)

### 1. Lock Patron Option
MC needs to choose which Starkweather-Moore configuration to use (Academic & Opportunist / Believer & Skeptic / Institution). See `starkweather-moore.md` for the three options. This unblocks the briefing document and episode rework.

### 2. Briefing Document
Design the actual player-facing briefing prop for Session 1 — the curated Dyer excerpts, selected Lake bulletins, maps, and the patron's framing. This is the first thing players see and shapes every expectation that gets broken later. Blocked by: patron option.

### 3. Revise Preset v0
Update `mountains_of_madness_preset_v0.md` with the nine improvements identified this session:
- The Empathy Turn (Elder Things as sympathetic beings — the moral core)
- Murals as playable mechanic (room-by-room discovery system, not just lore)
- Penguins (underground ecosystem, early warning, climax role)
- Danforth's Final Vision (the open ending, the deeper layers)
- Decision points per session (genuine player choices that reshape outcomes)
- Lake's Camp as a designed investigation scene
- "Previously on..." format (period-appropriate recap style)
- Expanded sensory palette (dark-green ichor, five-pointed motif, temperature gradient, dot-group writing)
- Tone calibration (cosmic dread vs cosmic nihilism — empathy is the difference)

### 4. Rework Episode Structure
Finalize the 8-session structure in `session-structure-v1.md`. Integrate:
- Rescue pivots (specific interventions per session)
- Decision points (the choice table)
- Political subplot beats (patron revelations per session)
- Self-contained arcs (each session has its own dramatic question and answer)

### 5. Build Config Files
Run the ingestion pipeline Step 3: extract structured data from the source text into:
- `config/story.json` — genre, tone, atmosphere, pacing, act structure
- `config/world.json` — lore, locations, environmental rules, discovery triggers
- `config/characters.json` — NPC templates, archetypes, relationship patterns
- `config/mechanics.json` — quality-based resolution, journal system, knowledge fog
- `config/techniques.json` — narrative techniques, foreshadowing rules, pacing curves

### 6. Seed Memory Levels
Initialize the 5-level memory system with starting state for Session 1:
- `memory/1-plot-state/` — opening scene, expedition status
- `memory/2-character-state/` — NPC states, empty player slots
- `memory/3-narrative-threads/` — pre-planted foreshadowing from the threads table
- `memory/4-thematic-layer/` — tonal markers, recurring symbols
- `memory/5-world-state/` — world beyond the players, offscreen events

### 7. Sample Keeper Prompt
Prototype how the Keeper assembles context per turn and responds. Test against the token economy target (~1,500 tokens per turn). Even before the app exists, we can validate the prompt architecture.

---

## Future (identified this session, not yet scoped)

### Reality Document
Create an AI reference document that maps Lovecraft's Antarctic claims against established academic sources. Structure:
- What is current scientific consensus (geology, paleontology, Antarctic geography)
- What does Lovecraft suggest is actually the case in his fiction
- What is real physical evidence vs conflicting knowledge vs theory (regardless of scientific or Lovecraftian origin)
- What is Lovecraftian manufactured evidence — things Lovecraft presents as "real" that the Keeper needs to weave into a world where both science and the mythos are true
- Purpose: the Keeper needs to know where consensus reality ends and Lovecraft begins, so it can blend them convincingly

### Keeper as NPC Integration
Design how the Keeper functions seamlessly as an NPC during play — not just a backend engine but a character the players interact with naturally. Define the boundary between Keeper-as-system and Keeper-as-voice.

### Character Creation Material
- Keeper conversation prompts shaped by the preset
- Atmospheric intro players see before creating characters (no spoilers)
- Starting journal template
- Quality descriptions vocabulary (replacing numerical stats)

### Remaining Items from ceremony_state.md (items 11-20)
- Keeper prompt architecture (overlaps with #7 above)
- MC-Keeper interaction patterns / backstage vocabulary
- PvP mechanics
- NPC system
- Onboarding flow
- Story archive / showcase
- Hugging Face integration (semantic search)
- Deployment plan (Docker compose)
- API cost modeling

---

## Decided (not yet written into ground truth)
- Expedition IS Starkweather-Moore (see `starkweather-moore.md`)
- Players receive curated Dyer excerpts, edited by patron
- Dyer alive but deliberately excluded from expedition
- No permanent player death by default; rescue pivots instead (MC can override live)
- All players start with same base knowledge (no asymmetric Danforth-style visions by default)
- 8 sessions, each with self-contained dramatic arc
- Starkweather and Moore are the patrons (name is canon from Lovecraft, details are our invention)
