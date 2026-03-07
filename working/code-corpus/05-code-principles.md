# Code Principles — Grading Every File

*Actionable checklist for writing and reviewing code in The Ceremony.*

---

## Tier 1: Non-Negotiable

These are hard rules. Code that violates them is rejected.

### 1.1 The Story Never Breaks

No code change should be capable of crashing a live session. Every external call (API, filesystem, network) must have a graceful degradation path.

```typescript
// WRONG
const response = await anthropic.messages.create({ ... });
return response.content[0].text;

// RIGHT
try {
  const response = await anthropic.messages.create({ ... });
  return response.content[0].text;
} catch {
  return "[The Keeper is momentarily silent.]";
}
```

### 1.2 No Data Loss

Messages are append-only. State files are written atomically (write to temp, rename). The filesystem is the source of truth — in-memory state is a cache that can be rebuilt.

```typescript
// WRONG: write directly (can corrupt on crash)
await writeFile(path, data);

// RIGHT: atomic write
const tmp = path + '.tmp.' + Date.now();
await writeFile(tmp, data);
await rename(tmp, path);
```

### 1.3 Secrets Stay Secret

Player-to-Keeper private messages are never visible in the `all` channel, never visible to other players, never visible in the MC's message feed. The permission model is enforced at the API level, not just the UI level.

```typescript
// WRONG: filter on the client
const visibleMessages = messages.filter(m => m.channel !== 'keeper-private');

// RIGHT: filter on the server, never send what shouldn't be seen
if (channel === 'keeper-private' && role !== 'keeper') {
  filtered = filtered.filter(m => m.playerId === requestingPlayerId);
}
```

### 1.4 Type Safety

All data structures are typed. No `any`. No type assertions unless truly unavoidable (and then commented with why).

```typescript
// WRONG
const data: any = await response.json();

// RIGHT
const data: SessionSnapshot = await response.json() as SessionSnapshot;

// ACCEPTABLE (with justification)
// Claude API response structure varies by model, assertion needed
const text = (response.content[0] as { text: string }).text;
```

---

## Tier 2: Structural Quality

These are strong guidelines. Deviations need justification.

### 2.1 Separation of Concerns

| Concern | Where it lives | What it does NOT do |
|---------|---------------|-------------------|
| State management | `lib/state.ts` → `lib/store.ts` | Does not render UI |
| Keeper logic | `lib/keeper.ts` | Does not manage sessions |
| Memory engine | `lib/memory.ts` | Does not call the Claude API |
| API routes | `app/api/*/route.ts` | Does not contain business logic (delegates to lib/) |
| Components | `components/*.tsx` | Does not fetch data (receives via props or hooks) |
| Pages | `app/*/page.tsx` | Orchestrates components, manages page-level state |

### 2.2 The Filesystem Is Not a Database

Files in `memory/` and `session/` are human-readable by design. A developer (or the MC) should be able to open any file and understand the current state.

```
# WRONG: binary or opaque formats
session/state.db
memory/level2.pickle
session/messages.sqlite

# RIGHT: plain text, readable
memory/2-character-state/player-anna.md
memory/3-narrative-threads/wind-piping.json
session/messages/all.jsonl
```

Markdown for prose (journals, summaries, thematic notes).
JSON for structured data (character stats, thread conditions, scene state).
JSONL for append-only logs (messages).

### 2.3 Functions Are Small and Named for What They Do

```typescript
// WRONG
async function handleMessage(msg) {
  // 50 lines of mixed concerns
}

// RIGHT
async function handlePlayerMessage(message: Message): Promise<void> {
  await storeMessage(message);
  await emitToChannel(message);

  if (message.channel === 'keeper-private') {
    const response = await getKeeperResponse(message);
    await storeMessage(response);
    await emitToChannel(response);
    await processStateUpdates(response);
  }
}
```

### 2.4 No Magic Numbers, No Hardcoded Strings

```typescript
// WRONG
if (messages.length > 50) compress();
setTimeout(poll, 2000);
const response = await fetch('/api/messages?channel=all');

// RIGHT
const MAX_MESSAGES_BEFORE_COMPRESSION = 50;
const POLL_INTERVAL_MS = 2000;
const response = await fetch(`/api/messages?channel=${Channel.All}`);
```

### 2.5 Error Messages Are Helpful

```typescript
// WRONG
throw new Error('Invalid input');

// RIGHT
throw new Error(`Cannot join session: player name "${name}" is already taken`);
```

---

## Tier 3: Craft

These separate good code from beautiful code.

### 3.1 Code Reads Like Prose

The best code tells you what it does without comments. Variable names, function names, and structure communicate intent.

```typescript
// WRONG
const r = await kpr(ctx, msg);
if (r.su) { for (const u of r.su) await wu(u); }

// RIGHT
const keeperResponse = await queryKeeper(context, playerMessage);
if (keeperResponse.stateUpdates) {
  for (const update of keeperResponse.stateUpdates) {
    await writeStateUpdate(update);
  }
}
```

### 3.2 Consistent Patterns

Once a pattern is established, follow it everywhere. If messages are sent via `postMessage()`, every part of the code sends messages via `postMessage()`. If state is read via `readMemoryLevel()`, every part of the code reads state via `readMemoryLevel()`.

### 3.3 The Right Abstraction Level

Don't abstract prematurely. Don't repeat yourself past three occurrences. The right level of abstraction is the one where the code is clear without requiring you to read the abstraction's implementation.

```typescript
// TOO ABSTRACT (what does this even do?)
const result = await pipeline.execute(new NarrativeEvent(input, context));

// TOO CONCRETE (this detail is repeated everywhere)
const messages = JSON.parse(await readFile(join(MESSAGES_DIR, channel + '.jsonl'), 'utf-8').split('\n').filter(Boolean).map(JSON.parse));

// RIGHT
const messages = await readChannelMessages(channel);
```

### 3.4 Tests Are Documentation

Tests should read as specifications. Someone unfamiliar with the code should be able to read the tests and understand what the system does.

```typescript
describe('Keeper context assembly', () => {
  it('always includes the current scene at P2 priority', async () => { ... });
  it('filters characters to those present in the current scene', async () => { ... });
  it('includes narrative threads whose trigger conditions are met', async () => { ... });
  it('never exceeds the token budget', async () => { ... });
  it('prioritizes recent history over older history', async () => { ... });
});
```

### 3.5 Imports Are Organized

```typescript
// External dependencies
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

// Internal modules
import { assembleContext, parseResponse } from '@/lib/keeper';
import { readMemoryLevel, writeStateUpdate } from '@/lib/memory';
import type { KeeperInput, KeeperResponse } from '@/lib/types';
```

---

## Tier 4: Project-Specific

### 4.1 The Ceremony's Voice in Code

Variable names and function names should reflect the project's language where natural:

```typescript
// Generic (acceptable)
function getAIResponse(input: string): Promise<string>

// Ceremony-native (preferred)
function queryKeeper(context: KeeperContext): Promise<KeeperResponse>
```

Use `keeper`, `ceremony`, `session`, `scene`, `journal`, `thread`, `memory level` — not `ai`, `game`, `round`, `log`, `quest`.

### 4.2 The Filesystem Paths Are Stable

Once a path is established in the memory system, it does not change. Code may move, functions may be renamed, but `memory/3-narrative-threads/` is forever `memory/3-narrative-threads/`.

### 4.3 Mock Before Real

Every external dependency (Claude API, filesystem, clock) should be mockable. The app ran with mock Keeper responses from day one — this pattern should continue. Any new integration should work in mock mode first.

```typescript
// lib/keeper.ts
export interface KeeperBackend {
  query(context: KeeperContext): Promise<KeeperResponse>;
}

export class MockKeeper implements KeeperBackend { ... }
export class ClaudeKeeper implements KeeperBackend { ... }

// Selected by environment variable
const keeper = process.env.KEEPER_BACKEND === 'claude'
  ? new ClaudeKeeper()
  : new MockKeeper();
```

---

## Grading Rubric

When reviewing code for The Ceremony:

| Grade | Meaning | Criteria |
|-------|---------|----------|
| **A** | Ship it | All Tier 1 rules pass. Tier 2 followed. Tier 3 qualities present. Reads well. |
| **B** | Minor revisions | Tier 1 passes. Tier 2 mostly followed. Tier 3 has gaps. Functional and clear. |
| **C** | Needs work | Tier 1 passes but barely. Tier 2 violations. Works but not well-structured. |
| **D** | Reject | Tier 1 violations. Data loss risk. Security issues. Breaks the ceremony. |
