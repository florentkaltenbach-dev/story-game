# Story Data Deduplication — Migration Guide

## The problem

Every visualization has its own copy of story data hardcoded into the HTML:

| File | Hardcoded data | Lines of duplicated data |
|------|---------------|--------------------------|
| `relationship-map.html` | NPCs, locations, threads, edges | ~200 lines |
| `story-skeleton.html` | Sessions, acts, locations, NPCs, decisions | ~150 lines |
| `fog-matrix.html` | Players, secrets, knowledge states | ~80 lines |

When the story evolves — new NPC, changed location, added thread — you update N files.
Miss one and the visualizations disagree about what the world looks like.

## The solution

**One source of truth → one API → one client module → N visualizations.**

```
config/ + memory/        ← filesystem (source of truth)
        ↓
/api/story-data          ← reads, merges, returns unified graph
        ↓
ceremony-data.js         ← shared client module (fetch + SSE subscribe)
        ↓
  ┌─────┼─────┐
  ↓     ↓     ↓
rel-map fog   skeleton   ← zero hardcoded data
```

## New files

| File | Location | Purpose |
|------|----------|---------|
| `api-story-data-route.ts` | `web/src/app/api/story-data/route.ts` | API that reads config/ + memory/ |
| `ceremony-data.js` | `web/public/js/ceremony-data.js` | Shared client module |
| `story-watcher.js` | `rigging/story-watcher.js` | File watcher for auto-updates |

## Migration per page

### Step 1: Add the script tag

Every viz page adds one line in `<head>`:

```html
<script src="/the-ceremony/js/ceremony-data.js"></script>
```

### Step 2: Remove hardcoded data

Delete the `var graphNodes = [...]` and `var graphEdges = [...]` arrays
(or equivalent: `SESSIONS`, `LOCATIONS`, `SECRETS`, etc.)

### Step 3: Load via CeremonyData

Replace the hardcoded arrays with a fetch call:

```javascript
// BEFORE (relationship-map.html)
var graphNodes = [
  { id: 'starkweather', name: 'Starkweather', type: 'npc', ... },
  { id: 'harrow', name: 'Dr. Harrow', type: 'npc', ... },
  // ... 80 more entries ...
];
var graphEdges = [
  { source: 'starkweather', target: 'harrow', type: 'bond', ... },
  // ... 120 more entries ...
];
renderGraph();

// AFTER
CeremonyData.load({ slice: 'relationships' }).then(function(graph) {
  graphNodes = graph.nodes.map(function(n) { /* transform */ });
  graphEdges = graph.edges.map(function(e) { /* transform */ });
  renderGraph();
});
```

### Step 4: Subscribe to changes

Add live-update support:

```javascript
CeremonyData.subscribe(function(graph) {
  // Preserve D3 positions during update
  var positions = {};
  graphNodes.forEach(function(n) {
    positions[n.id] = { x: n.x, y: n.y };
  });

  // Rebuild arrays from new data
  graphNodes = graph.nodes.map(function(n) {
    var pos = positions[n.id] || {};
    return { ...n, x: pos.x, y: pos.y };
  });
  graphEdges = graph.edges;

  // Re-render with smooth transition
  simulation.nodes(graphNodes);
  simulation.force('link').links(graphEdges);
  simulation.alpha(0.3).restart();
});
```

## Page-specific migration notes

### relationship-map.html

**Slice:** `relationships` (nodes + edges)

**What to remove:**
- The entire `var graphNodes = [...]` array (~80 entries)
- The entire `var graphEdges = [...]` array (~120 entries)

**What stays:**
- `NODE_TYPES` config (color, radius, label) — this is rendering config, not data
- `EDGE_TYPES` config (color, dash pattern) — rendering config
- All D3 rendering code — unchanged

**Transform needed:**
```javascript
// API returns: { id, name, type, desc, role, status }
// D3 expects:  { id, name, type, desc, role, status, radius }
graphNodes = graph.nodes.map(function(n) {
  var cfg = NODE_TYPES[n.type] || NODE_TYPES.npc;
  return Object.assign({}, n, { radius: cfg.radius });
});
```

### story-skeleton.html

**Slice:** `narrative` (sessions + locations + threads)

**What to remove:**
- `SESSIONS` array (5 session objects with color/subtitle)
- `LOCATIONS` array (~15 location entries with x-position, session assignment)
- `ACTS` arrays (per-session act structures)
- `NPCS` and `DECISIONS` arrays

**What stays:**
- Session colors can stay as rendering config or be derived from `graph.sessions[].color`
- All D3 rendering for the timeline, geo-track, etc.

**Transform needed:**
```javascript
CeremonyData.load({ slice: 'narrative' }).then(function(graph) {
  SESSIONS = graph.sessions.map(function(s) {
    return { id: s.id, name: s.name, subtitle: s.subtitle, color: s.color };
  });

  LOCATIONS = graph.nodes
    .filter(function(n) { return n.type === 'location'; })
    .map(function(n) { /* add x-position from session assignment */ });

  // NPC nodes for the character panel
  NPCS = graph.nodes.filter(function(n) { return n.type === 'npc'; });

  renderAll();
});
```

### fog-matrix.html

**Slice:** `fog` (player knowledge states)

**What to remove:**
- `PLAYERS` array
- `SECRETS` / `KNOWLEDGE_ITEMS` arrays
- `FOG_STATE` matrix

**Transform needed:**
```javascript
CeremonyData.load({ slice: 'fog' }).then(function(graph) {
  PLAYERS = graph.fog.map(function(f) {
    return { id: f.playerId, name: f.playerName };
  });

  // Build rows from all knowledge-trackable nodes
  SECRETS = graph.nodes
    .filter(function(n) { return n.type === 'npc' || n.type === 'location' || n.type === 'thread'; })
    .map(function(n) { return { id: n.id, name: n.name, category: n.type }; });

  // Build fog matrix
  FOG_STATE = {};
  graph.fog.forEach(function(f) {
    FOG_STATE[f.playerId] = f.knowledge;
  });

  renderMatrix();
});
```

## Extending the data

When you add a new entity to the story (new NPC, new location, new thread):

1. Add it to the appropriate config/ or memory/ file (the source of truth)
2. The file watcher detects the change
3. SSE broadcasts `story-data-changed`
4. All connected viz pages refetch and re-render
5. **No HTML files need to be edited**

When you add a new visualization:

1. Create the D3 page in `web/public/`
2. Import `ceremony-data.js`
3. Call `CeremonyData.load({ slice: '...' })`
4. Subscribe to updates
5. Register in rigging's viz gallery
6. **The data is already there — just render it**

## Enriching the graph

The `/api/story-data` route is designed to be extended. New data sources plug in
at the `buildStoryGraph()` function:

```typescript
// In api-story-data-route.ts, add new node/edge sources:

// Example: add trigger conditions as nodes
const triggers = await readJsonSafe(join(CONFIG_ROOT, 'triggers.json'), []);
for (const trigger of triggers) {
  addNode({
    id: 't-' + slugify(trigger.name),
    name: trigger.name,
    type: 'trigger', // new type
    desc: trigger.condition,
  });
}
```

## Testing the watcher

```bash
# Terminal 1: Start the web app + rigging
cd projects/story-game && npm run dev

# Terminal 2: Edit a memory file and watch the viz update
echo '{"status":"hostile"}' > memory/2-character-state/npc-starkweather.json

# The relationship map should show Starkweather's status change within ~300ms
```
