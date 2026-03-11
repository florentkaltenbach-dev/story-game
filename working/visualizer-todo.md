# Visualizer TODO — Ecosystem-Wide Visual Upgrades

*Applying code visualization techniques (graphs, state machines, swimlanes, heatmaps) to game state and infrastructure. Same layout algorithms, narrative aesthetic. Not limited to the MC dashboard — spans the full web ecosystem.*

---

## The Ecosystem

Six surfaces that host or could host visualizations:

| Surface | URL | Source | Audience |
|---------|-----|--------|----------|
| **Hub** | `/sandbox/projects/` | `/home/claude/projects/hub/server.js` | Developer — project discovery |
| **Rigging Dashboard** | `/sandbox/rigging/` | `/home/claude/projects/story-game/rigging/server.js` | Developer — infrastructure ops |
| **Rigging Viz Gallery** | `/sandbox/rigging/viz` | Rigging serves `web/public/*.html` | Developer/MC — architecture understanding |
| **Ceremony Landing** | `/the-ceremony/` | `web/src/app/page.tsx` | Everyone — entry point |
| **Player Companion** | `/the-ceremony/play` | `web/src/app/play/page.tsx` | Players — in-session |
| **MC Dashboard** | `/the-ceremony/mc` | `web/src/app/mc/page.tsx` + `web/src/components/mc/` | MC — in-session control |

### Existing D3 Visualizations (the foundation)

Already built, already using D3 v7, same palette (navy/gold/green), same fonts (Crimson Text + JetBrains Mono):

| Page | URL(s) | File | What it is |
|------|--------|------|------------|
| Codebase Map | `/the-ceremony/codebase-map.html`, `/sandbox/rigging/viz/codebase-map` | `web/public/codebase-map.html` | Force-directed dependency graph — **this IS a class/dependency diagram** |
| Runtime Architecture | `/the-ceremony/engine-skeleton.html`, `/sandbox/rigging/viz/engine-skeleton` | `web/public/engine-skeleton.html` | Two-process data flow — **this IS a data flow diagram** |
| Narrative Architecture | `/the-ceremony/story-skeleton.html`, `/sandbox/rigging/viz/story-skeleton` | `web/public/story-skeleton.html` | Session/act/arc structure — **this IS an activity diagram** |

New visualizations follow the same pattern. Standalone D3 pages in `web/public/` for full-screen exploration, embedded/compact versions in MC dashboard panels for live sessions, registered in Rigging's viz gallery for discovery.

---

## Core Insight

UML and code visualization techniques map directly onto game state:

| Technique | Game Equivalent | Target |
|---|---|---|
| Class diagram | Character/NPC relationships | Relationship Map |
| State machine | Entity condition transitions | State Transition Badges |
| Sequence diagram | Session narrative flow | Swimlane Timeline |
| Dependency graph | Memory file relationships | Memory Constellation |
| Activity diagram | Act/scene branching | Session Map |
| Access matrix / heatmap | Knowledge fog | Fog Matrix |
| Flame graph | Token economy per turn | Budget Flame |
| Data flow diagram | Message pipeline | Pipeline Debug View |

The layout algorithms are the same. The aesthetic is dark navy / gold / green, not enterprise UML.

---

## V1 — Relationship Map

**What:** Force-directed graph of characters, NPCs, locations, narrative threads. Nodes are entities, edges are connections (bonds, tensions, secrets, presence-at-location). Conspiracy board.

**Why first:** The MC currently holds all relationship context in their head. Highest-value visibility gap.

**Data source:** Memory levels 2 (Character State) and 3 (Narrative Threads), NPC registry, location state.

**Technique:** Force-directed layout (d3-force). Nodes clustered by type (character=gold, NPC=green, location=ice, thread=muted). Edge thickness = relationship intensity. Edge labels = relationship type. Draggable. Clickable → opens detail panel.

### Files touched

**New files:**
- `web/public/relationship-map.html` — Full-screen standalone D3 page (same pattern as codebase-map.html)

**Existing files to modify:**
- `web/src/components/mc/PanelShelf.tsx` — Add "Relationships" panel entry to shelf
- `web/src/components/mc/` — New `RelationshipPanel.tsx` component (compact embedded version or modal trigger)
- `web/src/app/mc/page.tsx` — Wire new panel into MC layout
- `web/src/lib/store.ts` — Add getter/API for relationship graph data (extract from memory + NPC state)
- `web/src/app/api/memory/route.ts` — Possibly extend to return cross-reference data
- `rigging/server.js` — Register `/viz/relationship-map` route in VIZ_FILES map
- `hub.json` — Add Relationship Map to interfaces array
- `web/src/lib/types.ts` — Add node/edge types for relationship graph

**Scope:**
- [ ] Define node/edge schema from existing memory + NPC data
- [ ] Build standalone D3 page (`web/public/relationship-map.html`)
- [ ] Build compact MC panel version (embedded SVG or modal launch)
- [ ] Wire to SSE for live updates as memory writes occur
- [ ] Register in Rigging viz gallery and Hub interfaces
- [ ] Style to match existing D3 pages (same header, controls, color tokens)

---

## V2 — Knowledge Fog Matrix

**What:** Players as columns, knowledge items (NPCs, locations, secrets, plot points) as rows. Cells colored by revelation state: dark (unknown), amber (rumored/partial), gold (confirmed). MC clicks a cell to manually reveal.

**Why second:** Knowledge fog is already implemented (`scripts/knowledge.ts`, per-player ledger, `deriveKnowledge`). But invisible to the MC. This surfaces dramatic irony.

**Data source:** Knowledge fog ledger (per-player), NPC registry, location/plot state.

**Technique:** Heatmap / access matrix. Rows sortable by category. Columns = players. Cell interaction: click to reveal, right-click for partial.

### Files touched

**New files:**
- `web/public/fog-matrix.html` — Full-screen standalone D3 heatmap (post-session review, archive comparison)
- `web/src/components/mc/FogMatrixPanel.tsx` — Live MC panel version

**Existing files to modify:**
- `web/src/components/mc/PanelShelf.tsx` — Add "Knowledge Fog" panel entry
- `web/src/app/mc/page.tsx` — Wire fog panel into MC layout
- `web/src/lib/scripts/knowledge.ts` — Possibly add `getFullMatrix()` export for rendering
- `web/src/app/api/messages/route.ts` — Possibly extend to expose fog state for MC
- `web/src/lib/store.ts` — Add fog matrix accessor
- `web/src/lib/types.ts` — Add FogCell / FogMatrix types
- `web/src/lib/events.ts` — Add `fogUpdate` SSE event type for live matrix refresh
- `rigging/server.js` — Register `/viz/fog-matrix` route
- `hub.json` — Add to interfaces

**Scope:**
- [ ] Extract current fog ledger into renderable matrix format
- [ ] Build standalone D3 heatmap page
- [ ] Build live MC panel component with click-to-reveal
- [ ] Add `fogUpdate` SSE event for live refresh
- [ ] Badge on panel shelf icon showing unrevealed count
- [ ] Register in Rigging viz gallery

---

## V3 — Session Timeline (Swimlane)

**What:** Horizontal timeline of the current session. Swimlanes: MC narration, Keeper responses, each player's actions, system events (triggers, compressions, act transitions). Bird's-eye view of the session's shape.

**Why:** The story log is linear and scrolling — the MC loses the forest for the trees. A timeline shows pacing, clustering, gaps, trigger points.

**Data source:** Message history (already in store), trigger log, compression events, act/scene transitions.

**Technique:** Sequence diagram layout (swimlanes + time axis). Events as dots or bars. Hoverable → message preview. Clickable → scrolls story log. Zoomable.

### Files touched

**New files:**
- `web/public/session-timeline.html` — Full-screen standalone D3 timeline (post-session review, archive playback)
- `web/src/components/mc/TimelinePanel.tsx` — Compact live MC panel version (sparkline-style)

**Existing files to modify:**
- `web/src/components/mc/PanelShelf.tsx` — Add "Timeline" panel entry
- `web/src/app/mc/page.tsx` — Wire timeline panel
- `web/src/lib/store.ts` — Expose message history with timestamps in timeline-friendly format
- `web/src/lib/types.ts` — Add TimelineEvent type
- `web/src/components/mc/StoryLog.tsx` — Add scroll-to-message anchor support (for timeline click → log sync)
- `web/src/lib/events.ts` — Timeline subscribes to existing SSE events
- `web/src/app/api/archive/route.ts` — Extend archive export to include timeline data
- `rigging/server.js` — Register `/viz/session-timeline` route
- `hub.json` — Add to interfaces

**Also interesting for:**
- `web/src/app/play/page.tsx` — Simplified player-facing timeline (their own journey arc, no MC/Keeper swimlanes)

**Scope:**
- [ ] Define event schema (timestamp, source, type, preview)
- [ ] Build standalone D3 timeline page
- [ ] Build compact MC panel version
- [ ] Add swimlane separation per participant
- [ ] Hover/click interaction with story log sync
- [ ] Player-facing simplified version (stretch)
- [ ] Register in Rigging viz gallery

---

## V4 — State Transition Badges

**What:** Replace static status text with mini state-machine visualizations. Not just "hostile" — show the arc: neutral → suspicious → hostile, with current state highlighted. Works for NPC disposition, radio condition, injury severity, fuel level.

**Why:** Small effort, big atmospheric payoff. Shows escalation trajectories. Works across multiple surfaces.

**Data source:** NPC status field, character state, environment widgets (radio, fuel, weather).

**Technique:** Small horizontal node chain (3–5 states), current state highlighted, past states dimmed. Animated transition on state change.

### Files touched

**New files:**
- `web/src/components/widgets/StateBadge.tsx` — Reusable inline state-machine component

**Existing files to modify:**
- `web/src/components/mc/PanelShelf.tsx` — NPC panel uses StateBadge for disposition
- `web/src/components/widgets/NpcDossierWidget.tsx` — Replace attitude badge with StateBadge
- `web/src/components/widgets/EnvironmentWidget.tsx` — StateBadge for radio/fuel/weather conditions
- `web/src/components/widgets/StatusWidget.tsx` — StateBadge where applicable
- `web/src/lib/types.ts` — Add state chain definitions per entity type
- `web/src/app/globals.css` — StateBadge animation keyframes
- `presets/mountains-of-madness/mechanics.json` — Define canonical state chains (NPC dispositions, radio states, injury scale)

**Also interesting for:**
- `web/src/app/play/page.tsx` — Players see their own character condition as a state chain
- `rigging/server.js` — PM2 process status could use the same pattern (stopped → starting → online → errored)
- `/home/claude/projects/hub/server.js` — Project health status as state badges in Hub cards

**Scope:**
- [ ] Define state chains per entity type (NPC disposition, radio condition, injury severity, fuel level)
- [ ] Build StateBadge component (SVG inline, animated)
- [ ] Integrate into NPC panel and widget renderers
- [ ] Animate transitions on SSE updates
- [ ] Add to player companion for character state
- [ ] Consider for Rigging PM2 status and Hub project health (stretch)

---

## V5 — Memory Constellation

**What:** The 5-level memory system as a force-directed constellation. Each memory file is a node, positioned by level. Edges = cross-references. Shows the Keeper's "mind."

**Why:** The memory browser is a flat file list. The constellation shows structure — density, connections, orphans. Useful for MC planning between sessions and for understanding the Keeper's context.

**Data source:** Memory filesystem (5 levels, ~29+ files), cross-references extracted by scanning file contents.

**Technique:** Force-directed with level-based grouping. Node size = file size or reference count. Color = memory level. Hover = preview. Click = open in memory panel.

### Files touched

**New files:**
- `web/public/memory-constellation.html` — Full-screen standalone D3 page
- `web/src/app/api/memory/graph/route.ts` — API endpoint returning node/edge data (scans memory files for cross-references)

**Existing files to modify:**
- `web/src/components/mc/PanelShelf.tsx` — Add constellation launch button to Memory panel header
- `web/src/components/mc/MemoryPanel.tsx` — Add "View as graph" toggle or modal trigger
- `web/src/lib/memory.ts` — Add `buildCrossReferenceIndex()` function (scan files for entity mentions)
- `web/src/lib/types.ts` — Add MemoryNode / MemoryEdge types
- `rigging/server.js` — Register `/viz/memory-constellation` route
- `hub.json` — Add to interfaces

**Also interesting for:**
- `web/public/codebase-map.html` — Same force-directed technique, could share layout utilities
- `web/public/story-skeleton.html` — Memory nodes could overlay on narrative arc (which memories are active at which story beat)

**Scope:**
- [ ] Build cross-reference index (scan memory files for entity mentions)
- [ ] Build standalone D3 page
- [ ] Add API endpoint for graph data
- [ ] Layout algorithm with level clustering (concentric rings or force groups)
- [ ] Sync with memory panel (click node → expand file)
- [ ] Register in Rigging viz gallery

---

## V6 — Budget Flame

**What:** Stacked bar chart showing token consumption per Keeper call. Each bar segmented by context tier (P1–P8). Shows which tiers eat the budget and how spend trends over the session.

**Why:** Current cost panel shows totals. The flame shows *where* tokens go — essential for tuning context assembly.

**Data source:** CostTracker (keeper-service), per-call tier breakdown (needs server enhancement).

**Technique:** Stacked horizontal bars, segments colored by tier. Compact sparkline for sidebar, full version as overlay.

### Files touched

**New files:**
- `web/public/budget-flame.html` — Full-screen standalone D3 page (post-session analysis)
- `web/src/components/mc/BudgetFlamePanel.tsx` — Compact sparkline in MC session panel

**Existing files to modify:**
- `keeper-service/server.ts` — Extend CostTracker to log per-tier token counts per call
- `keeper-service/lib.ts` — Add TierBreakdown type and logging
- `web/src/lib/keeper.ts` — Extend getCost() to return per-call tier breakdowns
- `web/src/app/api/keeper/cost/route.ts` — Extend response with tier history
- `web/src/components/mc/PanelShelf.tsx` — Enhance session panel with flame sparkline
- `web/src/lib/types.ts` — Add TierBreakdown / BudgetEntry types
- `rigging/server.js` — Register `/viz/budget-flame` route
- `hub.json` — Add to interfaces

**Also interesting for:**
- `rigging/server.js` — Rigging dashboard could show live token burn rate alongside PM2 memory usage
- `web/public/engine-skeleton.html` — Could overlay real token data on the architecture diagram's tier boxes

**Scope:**
- [ ] Extend CostTracker to log per-tier token counts per call
- [ ] Build standalone D3 flame chart page
- [ ] Build compact sparkline panel component
- [ ] Sidebar sparkline + click-to-expand full view
- [ ] Threshold markers (budget warning zones)
- [ ] Register in Rigging viz gallery

---

## V7 — Pipeline Debug View

**What:** When a message fires, show the pipeline: input → script extraction → memory writes → Keeper query → response → widget updates. Animated data flow diagram per message.

**Why:** Debugging and education. When something unexpected happens, trace what the system did.

**Data source:** Pipeline execution log (needs instrumentation).

**Technique:** Horizontal flow diagram with labeled stages. Each stage shows what was produced. Animated flow.

### Files touched

**New files:**
- `web/public/pipeline-debug.html` — Full-screen standalone D3 data flow page (replay mode)
- `web/src/components/mc/PipelinePanel.tsx` — Live MC panel (hidden by default, debug mode toggle)

**Existing files to modify:**
- `web/src/app/api/messages/route.ts` — Instrument pipeline stages to emit structured log
- `web/src/lib/scripts/pipeline.ts` — Add stage-level event emissions (if not already structured)
- `web/src/lib/events.ts` — Add `pipelineStage` SSE event type
- `web/src/lib/store.ts` — Store pipeline trace per message
- `web/src/lib/types.ts` — Add PipelineStage / PipelineTrace types
- `web/src/components/mc/PanelShelf.tsx` — Add Pipeline panel (debug mode only)
- `web/src/app/mc/page.tsx` — Wire pipeline panel with debug toggle
- `rigging/server.js` — Register `/viz/pipeline-debug` route
- `hub.json` — Add to interfaces

**Related to:**
- `web/public/engine-skeleton.html` — The pipeline debug is a *live* version of what engine-skeleton shows statically. They should share visual language.

**Scope:**
- [ ] Instrument pipeline to emit stage events via SSE
- [ ] Build standalone D3 flow diagram page (with replay)
- [ ] Build live MC debug panel
- [ ] Log view with message-by-message trace
- [ ] Replay capability for post-session review
- [ ] Register in Rigging viz gallery

---

## V8 — Enhanced Hub Project Cards (bonus)

**What:** Upgrade Hub's project cards with richer status visualization. Instead of flat "online" badges, show mini topology diagrams per project (which services are running, how they connect). The Hub already auto-discovers PM2 processes — visualize the relationships.

**Technique:** Tiny inline SVG graphs per project card. Reuse StateBadge (V4) for process health.

### Files touched

**Existing files to modify:**
- `/home/claude/projects/hub/server.js` — Enhance `renderDashboard()` card rendering
- `/home/claude/projects/story-game/hub.json` — Possibly add topology metadata to manifest

**Scope:**
- [ ] Design inline mini-topology SVG for multi-service projects
- [ ] Add StateBadge-style health indicators
- [ ] Enhance route table with visual flow

---

## V9 — Rigging Network Topology Graph (bonus)

**What:** Upgrade the Rigging dashboard's text-based network topology section into an interactive D3 force graph. Nodes = servers/services/ports, edges = connections. Clickable. Live health status colors.

**Technique:** Force-directed (same as codebase-map). Nodes sized by importance. Color-coded by health status.

### Files touched

**New files:**
- `web/public/network-topology.html` — Full-screen standalone D3 network graph

**Existing files to modify:**
- `rigging/server.js` — Replace inline HTML topology section with SVG renderer, register `/viz/network-topology` route
- `hub.json` — Add to interfaces

**Scope:**
- [ ] Build standalone D3 network topology page
- [ ] Interactive version of the existing text topology
- [ ] Live health status via Rigging's `/api/scan` data
- [ ] Register in viz gallery

---

## V10 — Player Journey Arc (bonus)

**What:** A personal narrative arc visualization for each player in the companion app. Shows their character's journey: scenes visited, NPCs met, knowledge gained, journal entries, decision points. A softer, story-focused timeline (not the MC's operational swimlane).

**Technique:** Curved path/arc with nodes at key moments. Branching where choices diverged from other players.

### Files touched

**New files:**
- `web/src/components/player/JourneyArc.tsx` — Player-facing arc component

**Existing files to modify:**
- `web/src/app/play/page.tsx` — Add journey arc view (toggle or tab)
- `web/src/lib/store.ts` — Expose player-specific journey data
- `web/src/lib/types.ts` — Add JourneyNode type
- `web/src/app/globals.css` — Journey arc styling

**Scope:**
- [ ] Define journey node schema (scene, NPC encounter, knowledge, decision, journal)
- [ ] Build arc renderer (curved SVG path with nodes)
- [ ] Filter to player's own perspective (respects fog)
- [ ] Post-session comparison mode (compare arcs)

---

## Priority & Dependencies

```
V1 Relationship Map ─────── highest MC value, no backend changes
V2 Fog Matrix ──────────── backend exists, UI only
V4 State Badges ─────────── small, enhances many surfaces
V3 Session Timeline ──────── medium effort, existing data
V10 Player Journey Arc ───── enriches player experience
V5 Memory Constellation ──── needs cross-reference index
V8 Enhanced Hub Cards ────── small, bonus
V6 Budget Flame ──────────── needs keeper-service enhancement
V9 Rigging Topology ──────── bonus, existing data
V7 Pipeline Debug ─────────── needs instrumentation (stretch)
```

---

## Shared Infrastructure

### Existing D3 page pattern (copy from any existing page)
- D3 v7 from CDN (`https://d3js.org/d3.v7.min.js`)
- Fonts: Crimson Text (serif headings) + JetBrains Mono (body/data)
- Background: `#0a0e17`, header: `#0d1220`, borders: `#1e2d44`
- Accent: `#c4a35a` (gold), Keeper: `#6b9e7a` (green), Ice: `#7ba4c7` (blue)
- Header bar with title + toggle/filter buttons
- Full viewport SVG canvas with zoom/pan

### Registration pattern (for each new viz page)
1. Create `web/public/<name>.html`
2. Add to `rigging/server.js` VIZ_FILES map
3. Add to `rigging/server.js` viz index HTML
4. Add to `hub.json` interfaces array
5. If MC-relevant: add compact panel version in `web/src/components/mc/`

### Canvas vs SVG decision
- SVG: V1, V2, V4, V5, V8, V9, V10 (interactivity matters, node count < 200)
- Canvas: V3, V6 (potentially large datasets — many messages, many Keeper calls)
- V7: SVG for structure, Canvas overlay for animation

### SSE integration
- All live MC panels subscribe to existing SSE stream (`/api/events`)
- New event types needed: `fogUpdate` (V2), `pipelineStage` (V7)
- V1/V3/V4/V5/V6 can react to existing events (`message`, `widgetUpdate`, `session`, etc.)

### File summary — all files that could be touched

```
NEW FILES (up to 13):
  web/public/relationship-map.html
  web/public/fog-matrix.html
  web/public/session-timeline.html
  web/public/memory-constellation.html
  web/public/budget-flame.html
  web/public/pipeline-debug.html
  web/public/network-topology.html
  web/src/components/mc/RelationshipPanel.tsx
  web/src/components/mc/FogMatrixPanel.tsx
  web/src/components/mc/TimelinePanel.tsx
  web/src/components/mc/BudgetFlamePanel.tsx
  web/src/components/mc/PipelinePanel.tsx
  web/src/components/widgets/StateBadge.tsx
  web/src/components/player/JourneyArc.tsx
  web/src/app/api/memory/graph/route.ts

EXISTING FILES (up to 22):
  web/src/app/mc/page.tsx
  web/src/app/play/page.tsx
  web/src/app/globals.css
  web/src/app/api/messages/route.ts
  web/src/app/api/memory/route.ts
  web/src/app/api/keeper/cost/route.ts
  web/src/app/api/archive/route.ts
  web/src/components/mc/PanelShelf.tsx
  web/src/components/mc/MemoryPanel.tsx
  web/src/components/mc/StoryLog.tsx
  web/src/components/widgets/NpcDossierWidget.tsx
  web/src/components/widgets/EnvironmentWidget.tsx
  web/src/components/widgets/StatusWidget.tsx
  web/src/lib/store.ts
  web/src/lib/keeper.ts
  web/src/lib/memory.ts
  web/src/lib/events.ts
  web/src/lib/types.ts
  web/src/lib/scripts/knowledge.ts
  web/src/lib/scripts/pipeline.ts
  keeper-service/server.ts
  keeper-service/lib.ts
  rigging/server.js
  hub.json
  presets/mountains-of-madness/mechanics.json
  /home/claude/projects/hub/server.js
```
