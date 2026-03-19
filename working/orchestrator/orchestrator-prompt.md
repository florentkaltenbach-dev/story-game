# Orchestrator Prompt — Autodiscovery + Story Matrix

## Context

The Ceremony is an AI-powered tabletop RPG platform. It has 12 characters, 5 sessions (S0–S4), ~16 acts, 10 narrative threads. Visualizations are standalone D3 HTML pages in `web/public/`. Currently every new viz requires manual registration in 3 places: `rigging/server.js` VIZ_FILES map, `rigging/server.js` viz index HTML, and `hub.json` interfaces array. We are replacing that with convention-based autodiscovery, then building a story matrix visualization that uses it.

Data format decision: **JSON for all data, TypeScript only for type definitions.** This follows the existing pattern — preset config, memory levels, and narrative threads are all JSON files organized by domain. The story matrix is the same.

## Architecture Decisions (do not re-decide these)

- Data lives in JSON files, spread across directories by domain
- Types live in `web/src/lib/types.ts` as interfaces
- Standalone viz pages are self-contained D3 HTML in `web/public/`
- Viz pages declare their own metadata via an embedded JSON block
- Discovery is filesystem-based — no manual registration
- The hub at `kaltenbach.dev/sandbox/projects/` surfaces everything automatically

---

## STEP 1 — Viz Metadata Convention (single agent, blocking)

**Goal:** Define and document the convention by which a viz HTML file declares its metadata so it can be autodiscovered. This is a design step — write a spec, not code.

**Output:** A markdown spec file defining:
- Where viz files live (currently `web/public/*.html`, confirm or expand)
- How a viz file declares metadata (recommend: HTML comment block at top of file with embedded JSON — title, description, category, data sources, audience)
- What fields are required vs optional
- Example metadata block

**Files touched:**
- CREATE `docs/viz-convention.md`

**Reads (do not modify):**
- `web/public/codebase-map.html` — study existing page structure
- `web/public/fog-matrix.html` — study existing page structure
- `working/visualizer-todo.md` — context on planned vizualizations

**Why blocking:** Every subsequent step depends on this convention existing.

---

## STEP 2 — Two parallel agents

### STEP 2A — Autodiscovery Scanner (Agent A)

**Goal:** Replace the hardcoded `VIZ_FILES` map and static viz index in `rigging/server.js` with a directory scanner that reads `web/public/`, parses each HTML file's metadata block (per the convention from Step 1), builds a route table, and generates the viz index page dynamically.

**Also:** Replace the static `interfaces` array in `hub.json` with a mechanism the hub can query at runtime. Options: (a) rigging exposes a `/api/viz-manifest` endpoint that returns the discovered viz list, or (b) a script regenerates `hub.json` interfaces from the scan. Prefer (a) — the hub server at `/home/claude/projects/hub/server.js` already scans PM2 and ports, it can fetch the manifest.

**Files touched:**
- MODIFY `rigging/server.js` — remove `VIZ_FILES` map, remove hardcoded viz index HTML, add `scanVizPages()` function, add `/api/viz-manifest` endpoint, generate viz index from scan results
- MODIFY `hub.json` — remove static `interfaces` entries for visualizations (keep app entries like Play, MC Dashboard)
- MODIFY `/home/claude/projects/hub/server.js` — fetch viz manifest from rigging and merge into project card rendering

**Reads (do not modify):**
- `docs/viz-convention.md` (from Step 1)
- `web/public/*.html` — to verify scanner finds existing pages

**Acceptance:** After this, adding a new viz is: drop an HTML file with the metadata block into `web/public/`, restart rigging (or wait for next scan), it appears in both the rigging viz gallery and the hub.

### STEP 2B — Retrofit Existing Viz Pages (Agent B)

**Goal:** Add the metadata comment block (per convention from Step 1) to every existing viz HTML file so they are discoverable by the new scanner.

**Files touched:**
- MODIFY `web/public/codebase-map.html` — add metadata block
- MODIFY `web/public/engine-skeleton.html` — add metadata block
- MODIFY `web/public/story-skeleton.html` — add metadata block, audit for stale content (the 8-session structure reference vs current 5-session config)
- MODIFY `web/public/relationship-map.html` — add metadata block
- MODIFY `web/public/fog-matrix.html` — add metadata block

**Reads (do not modify):**
- `docs/viz-convention.md` (from Step 1)

**No conflicts with Agent A** — Agent A modifies `rigging/server.js` and `hub.json`. Agent B only modifies files inside `web/public/`. Clean separation.

---

## STEP 3 — Verify autodiscovery (single agent, blocking)

**Goal:** Integration test. Start rigging, confirm all 5 existing viz pages appear in the auto-generated viz index at `/viz`. Confirm `/api/viz-manifest` returns valid JSON. Confirm the hub renders the viz entries on the project card.

**Files touched:**
- None (read-only verification)

**Reads:**
- `rigging/server.js` — run it
- `web/public/*.html` — verify scan results
- `/home/claude/projects/hub/server.js` — verify manifest consumption

**Why blocking:** The story matrix viz (Step 4) relies on autodiscovery working. Don't build content on broken plumbing.

---

## STEP 4 — Three parallel agents

### STEP 4A — Story Matrix JSON Schema + Data (Agent C)

**Goal:** Design the story matrix data schema and populate it for the Mountains of Madness campaign. 12 characters × 5 sessions × ~16 acts. Each cell describes a character's status, location, knowledge state, emotional arc, and narrative function at that story beat.

**Schema considerations:**
- One file per session (`story-matrix/s0.json` through `story-matrix/s4.json`) or one unified file — agent decides based on data volume
- Place files under `config/story-matrix/` alongside existing config files (`config/story.json`, `config/characters.json`, etc.)
- Include character ID (matching existing `characters.json` archetypes), session number, act number, fields for: location, status, emotional state, knowledge gained, narrative role, relationships active, threads touched
- Reference existing character IDs and thread IDs from `config/characters.json` and `memory/3-narrative-threads/`

**Files touched:**
- CREATE `config/story-matrix/` directory
- CREATE `config/story-matrix/*.json` — matrix data files

**Reads (do not modify):**
- `config/characters.json` — character archetypes and IDs
- `config/story.json` — session/act structure
- `memory/3-narrative-threads/*.json` — thread IDs and lifecycle
- `working/story-skeleton.html` — narrative architecture (the SESSIONS data embedded in the script has detailed act/beat structure)
- `docs/viz-convention.md` — not directly needed but useful for understanding the metadata the viz will need

### STEP 4B — Story Matrix TypeScript Types (Agent D)

**Goal:** Add TypeScript interfaces for the story matrix data to the shared types file.

**Files touched:**
- MODIFY `web/src/lib/types.ts` — add `StoryMatrixEntry`, `StoryMatrixSession`, `CharacterBeat` interfaces (or whatever the schema from 4A defines)

**Reads (do not modify):**
- `config/story-matrix/*.json` (from Step 4A — coordinate on schema, or agent 4A writes a schema.md first)
- `web/src/lib/types.ts` — existing types for naming conventions and style

**Dependency note:** Agents 4A and 4B should coordinate on field names. Option: Agent 4A writes the JSON schema first, Agent 4B reads it and writes the interfaces. Or they share a 5-line schema contract defined in this prompt:

```
CharacterBeat {
  characterId: string     // matches characters.json archetype name
  session: number         // 0-4
  act: number             // 1-4
  location: string
  status: string          // alive, injured, missing, dead, unknown
  emotional: string       // free text, one line
  knowledge: string[]     // list of thread IDs or secret IDs character knows
  narrativeRole: string   // protagonist, antagonist, witness, absent, etc.
  threadsActive: string[] // thread IDs from narrative-threads
  notes: string           // MC-facing notes
}
```

### STEP 4C — Story Matrix D3 Visualization (Agent E)

**Goal:** Build the standalone D3 heatmap/matrix page. Characters as rows, acts as columns (grouped by session). Cells colored by status. Click a cell to see full detail. Follows the existing D3 page pattern (dark navy/gold/green palette, Crimson Text + JetBrains Mono fonts, zoom/pan, tooltip). Includes the metadata comment block per the convention from Step 1 so autodiscovery picks it up.

**Files touched:**
- CREATE `web/public/story-matrix.html` — self-contained D3 page with metadata block

**Reads (do not modify):**
- `docs/viz-convention.md` — metadata block format
- `config/story-matrix/*.json` (from Step 4A) — the data it renders
- `web/public/fog-matrix.html` — closest existing pattern (heatmap), copy structure
- `web/public/story-skeleton.html` — session/act layout reference

**No file conflicts with 4A or 4B.** Agent E writes only to `web/public/story-matrix.html`. Agent C writes only under `config/story-matrix/`. Agent D writes only to `types.ts`.

**Data loading:** The viz page should `fetch('/config/story-matrix/...')` or embed the data. Since this is a standalone page served by rigging/Next.js, decide based on how existing pages load data (codebase-map.html embeds data inline; if matrix data is large, fetch from a static path instead).

---

## STEP 5 — Final integration (single agent, blocking)

**Goal:** Verify the complete loop closes.

1. Restart rigging
2. Confirm `story-matrix.html` appears in the auto-generated viz index at `/viz`
3. Confirm it appears in the hub at `kaltenbach.dev/sandbox/projects/`
4. Confirm the visualization renders with real data from `config/story-matrix/`
5. Confirm the TypeScript types in `types.ts` match the actual JSON shape

**Files touched:**
- None ideally. Fix anything that's broken.

---

## File Ownership Summary (for concurrency safety)

| File / Directory | Step 1 | 2A | 2B | 3 | 4A | 4B | 4C | 5 |
|---|---|---|---|---|---|---|---|---|
| `docs/viz-convention.md` | **W** | R | R | — | — | — | R | — |
| `rigging/server.js` | — | **W** | — | R | — | — | — | R |
| `hub.json` | — | **W** | — | R | — | — | — | R |
| `/home/claude/projects/hub/server.js` | — | **W** | — | R | — | — | — | R |
| `web/public/codebase-map.html` | R | — | **W** | R | — | — | — | — |
| `web/public/engine-skeleton.html` | R | — | **W** | R | — | — | — | — |
| `web/public/story-skeleton.html` | R | — | **W** | R | — | — | R | — |
| `web/public/relationship-map.html` | — | — | **W** | R | — | — | — | — |
| `web/public/fog-matrix.html` | — | — | **W** | R | — | — | R | — |
| `web/public/story-matrix.html` | — | — | — | — | — | — | **W** | R |
| `config/story-matrix/*.json` | — | — | — | — | **W** | R | R | R |
| `web/src/lib/types.ts` | — | — | — | — | — | **W** | — | R |
| `config/characters.json` | — | — | — | — | R | — | — | — |
| `config/story.json` | — | — | — | — | R | — | — | — |
| `memory/3-narrative-threads/` | — | — | — | — | R | — | — | — |
| `working/visualizer-todo.md` | R | — | — | — | — | — | — | — |

**W** = writes/creates, **R** = reads only, **—** = does not touch

No two agents in the same parallel step write to the same file.

---

## Execution Flow

```
Step 1 (sequential)
  └─ Convention spec
       │
       ├─── Step 2A (parallel) ── Autodiscovery scanner
       └─── Step 2B (parallel) ── Retrofit metadata blocks
              │
        Step 3 (sequential)
          └─ Integration verify
               │
               ├─── Step 4A (parallel) ── Matrix JSON data
               ├─── Step 4B (parallel) ── Matrix TS types
               └─── Step 4C (parallel) ── Matrix D3 viz page
                       │
                 Step 5 (sequential)
                   └─ Final integration verify
```
