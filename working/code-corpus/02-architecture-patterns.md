# Architecture Patterns — Actionable Reference

*Concrete patterns for The Ceremony's code. Each section includes the pattern, when to use it, and implementation guidance.*

---

## 1. Real-Time Communication

### Current: Polling (every 2-3 seconds)
The app polls `/api/session` every 3s and `/api/messages` every 2s. This works for prototyping but fails at scale and creates unnecessary latency.

### Target: Server-Sent Events (SSE)

**Why SSE over WebSocket:**
- Unidirectional (server -> client) covers 90% of the real-time need (new messages, state changes, Keeper responses)
- Works over HTTP/2 — no special server configuration, works behind Caddy without changes
- Automatic reconnection built into the browser API
- Simpler than socket.io for this use case
- Player actions (sending messages) are low-frequency — regular POST is fine for client -> server

**Why NOT WebSocket (yet):**
- WebSocket is bidirectional, which we don't need — players send messages infrequently
- Socket.io adds a dependency and complexity
- SSE is sufficient until we need features like typing indicators or sub-second latency
- If we later need WebSocket (e.g., for real-time collaborative editing of scenes), upgrade then

**Implementation pattern:**
```typescript
// Route Handler: /api/events/route.ts
export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      // Subscribe to state changes
      const unsub = stateEmitter.on('change', (change) => {
        send(change.type, change.data);
      });

      request.signal.addEventListener('abort', () => {
        unsub();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

```typescript
// Client hook: useEventStream.ts
function useEventStream(url: string) {
  useEffect(() => {
    const source = new EventSource(url);
    source.addEventListener('message', handleMessage);
    source.addEventListener('scene', handleScene);
    source.addEventListener('session', handleSession);
    return () => source.close();
  }, [url]);
}
```

**When to upgrade to WebSocket:** If we add typing indicators, real-time cursor/presence, or need sub-100ms latency for player actions.

### Validation from Research

The filesystem-as-memory approach is strongly validated:
- **Manus** (acquired by Meta for $2B, Dec 2025) used a three-file pattern: `task_plan.md`, `notes.md`, output file
- **OpenClaw** (145K+ GitHub stars) stores everything as markdown in `~/clawd/`
- **Letta benchmark:** filesystem scored **74.0% on LoCoMo**, beating Mem0's graph-based memory at 68.5%
- Key insight from Letta: "Agents today are highly effective at using tools in their training data (such as filesystem operations)"

Anti-patterns validated by failures:
- **Owlbear Rodeo** abandoned WebRTC as "never reliable" — VPNs, antivirus, and ISPs block it
- **Roll20** chose Firebase Realtime Database — suffered 600ms RTT vs 40ms baseline, a 15x latency penalty
- **React contexts for state** (Owlbear v1) — acknowledged as problematic, recommend Zustand instead

---

## 2. State Management

### The Dual State Problem

The Ceremony has two state systems that must eventually merge:

1. **Session state** (web app): players online, current scene, messages, session status → currently in-memory JS objects
2. **Keeper state** (AI mind): 5 memory levels, character state, narrative threads → designed as filesystem

**Pattern: Filesystem as source of truth, in-memory as cache**

```
filesystem (source of truth)
  ├── session/current.json     ← session metadata, scene, status
  ├── session/messages/        ← message history (append-only)
  ├── memory/1-plot-state/     ← Keeper's mind, level 1
  ├── memory/2-character-state/
  ├── memory/3-narrative-threads/
  ├── memory/4-thematic-layer/
  └── memory/5-world-state/

in-memory (fast access)
  ├── session object           ← loaded from filesystem on startup
  ├── message buffer           ← recent messages, periodically flushed
  └── state emitter            ← broadcasts changes to SSE clients
```

**Atomic file writes:**
```typescript
import { writeFile, rename } from 'fs/promises';
import { join } from 'path';

async function atomicWrite(filepath: string, data: string) {
  const tmp = filepath + '.tmp.' + Date.now();
  await writeFile(tmp, data, 'utf-8');
  await rename(tmp, filepath); // atomic on POSIX
}
```

**State change flow:**
1. Action occurs (player message, MC command, Keeper response)
2. In-memory state updated immediately
3. SSE event emitted to all connected clients
4. Filesystem write queued (debounced for rapid changes, immediate for critical state)
5. On server restart, state rebuilt from filesystem

### Message Persistence

Messages are append-only. This is the raw event log — never modified, never compressed.

```
session/messages/
  ├── all.jsonl           ← one JSON object per line, append-only
  ├── mc-keeper.jsonl
  └── keeper-private/
      ├── player-1.jsonl
      └── player-2.jsonl
```

JSONL format (one message per line, never rewritten):
```json
{"id":"msg-1","channel":"all","sender":{"role":"mc","name":"The Narrator"},"content":"...","ts":1709812345}
```

### Session Snapshot (periodic, for fast startup)

```typescript
// Written every 30 seconds and on session state changes
interface SessionSnapshot {
  id: string;
  name: string;
  preset: string;
  scene: Scene;
  players: Player[];
  status: SessionStatus;
  lastMessageId: string;  // for resuming from snapshot
  timestamp: number;
}
```

---

## 3. Permission Filtering

**Pattern: Same data store, role-based projection**

All data lives in one place. Each API response filters based on the requester's role.

```typescript
type Role = 'mc' | 'player' | 'keeper';

interface PermissionFilter {
  role: Role;
  playerId?: string;
}

function filterSession(session: FullSession, filter: PermissionFilter): VisibleSession {
  const base = {
    id: session.id,
    name: session.name,
    scene: session.scene,
    status: session.status,
    players: session.players.map(p => filterPlayer(p, filter)),
  };

  if (filter.role === 'mc') {
    return { ...base, memoryLevels: session.memoryLevels, threads: session.threads };
  }

  return base; // players see only the base
}

function filterPlayer(player: Player, filter: PermissionFilter): VisiblePlayer {
  if (filter.role === 'mc' || filter.role === 'keeper') {
    return player; // MC and Keeper see everything
  }
  if (filter.playerId === player.id) {
    return player; // player sees their own full state
  }
  return { id: player.id, name: player.name, characterName: player.characterName };
  // other players see only name
}
```

---

## 4. Hybrid Narrative Engine

**Pattern: FSM for structure + triggers for emergence**

Session structure is a state machine (Act I -> Act II -> Act III). Within each state, narrative threads are trigger-based.

```typescript
interface NarrativeThread {
  id: string;
  name: string;
  status: 'dormant' | 'planted' | 'growing' | 'ripe' | 'resolved';
  triggerConditions: TriggerCondition[];
  plantedInSession?: number;
  payoffInSession?: number;
  content: string;  // what the Keeper knows about this thread
}

interface TriggerCondition {
  type: 'keyword' | 'location' | 'session' | 'player_action' | 'visit_count';
  value: string | number;
  comparator?: 'equals' | 'contains' | 'gte' | 'lte';
}

function evaluateThreads(
  threads: NarrativeThread[],
  context: { recentActions: string[]; location: string; session: number; visitCounts: Record<string, number> }
): NarrativeThread[] {
  return threads.filter(thread => {
    if (thread.status === 'resolved') return false;
    return thread.triggerConditions.every(cond => evaluateCondition(cond, context));
  });
}
```

---

## 5. Error Handling and Resilience

**Principle: The ceremony must not break.**

A crashed server, a failed API call, or a dropped connection should never destroy a live session. The filesystem is the safety net.

```
Resilience hierarchy:
1. In-memory state (fast, volatile)
2. Filesystem state (durable, recoverable)
3. Git history (versioned, rollback-capable)

If 1 fails → rebuild from 2
If 2 fails → rebuild from 3
If 3 fails → the ceremony is truly lost (but this requires disk failure)
```

**API call resilience:**
```typescript
async function callKeeper(context: KeeperContext, retries = 2): Promise<KeeperResponse> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await anthropic.messages.create({ ... });
    } catch (error) {
      if (i === retries) {
        // Return a graceful degradation response
        return {
          response: "[The Keeper is momentarily silent. The wind fills the pause.]",
          fromCache: false,
          degraded: true,
        };
      }
      await new Promise(r => setTimeout(r, 1000 * (i + 1))); // linear backoff
    }
  }
}
```

---

## 6. File Organization

**Current web structure is sound. Extend, don't reorganize.**

```
web/src/
  app/
    page.tsx              ← landing
    play/page.tsx         ← player view
    mc/page.tsx           ← MC dashboard
    api/
      session/route.ts    ← session CRUD
      messages/route.ts   ← message CRUD
      keeper/route.ts     ← Keeper queries
      events/route.ts     ← SSE stream (new)
  components/
    SceneDisplay.tsx
    StoryLog.tsx
    MessageInput.tsx
    ChannelTabs.tsx
    CharacterPanel.tsx
  lib/
    types.ts              ← shared types
    state.ts              ← state management (refactor: split into store + keeper)
    keeper.ts             ← Keeper API client (new)
    memory.ts             ← filesystem memory engine (new)
    events.ts             ← SSE event emitter (new)
```

**New directories at project root:**
```
memory/                   ← Keeper's mind (created at session init)
config/                   ← preset configuration files
session/                  ← session persistence (messages, snapshots)
```

---

## 7. Recommended Libraries

From research validation across production systems:

| Library | Purpose | Why |
|---------|---------|-----|
| `write-file-atomic` | Atomic file writes | Used by npm itself. Write-then-rename prevents corruption during concurrent updates. |
| `chokidar` | File watching | ~30M repos. Native OS events (inotify on Linux). `awaitWriteFinish` for atomic write compat. |
| `gray-matter` | YAML frontmatter parsing | Parse metadata from markdown state files (character traits, thread conditions). |
| `@ai-sdk/anthropic` + `ai` | Claude API + streaming | Vercel AI SDK handles SSE, React state, abort signals. Switch models with one line. |
| `zustand` | Client state management | Replace React useState chains. Recommended over contexts by Owlbear Rodeo team. |

**Do NOT adopt (yet):**
- `lowdb` — raw JSON files with `write-file-atomic` are sufficient at our scale (<200 files)
- `socket.io` — SSE + POST is sufficient until we need bidirectional real-time
- `chromadb` / vector DBs — grep is sufficient until file count demands semantic search
- `liveblocks` / `yjs` — CRDT is overkill when the Keeper is the single source of truth
