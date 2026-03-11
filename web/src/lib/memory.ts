import { readFile, writeFile, rename, readdir, mkdir } from "fs/promises";
import { join, extname } from "path";
import type {
  MemoryLevelNumber,
  NarrativeThread,
  NarrativeThreadStatus,
  MEMORY_LEVEL_DIRS,
  Message,
} from "./types";

// === Paths ===

const PROJECT_ROOT = join(process.cwd(), "..");
const MEMORY_ROOT = join(PROJECT_ROOT, "memory");
const SESSION_ROOT = join(PROJECT_ROOT, "session");

export function memoryLevelDir(level: MemoryLevelNumber): string {
  const dirs: Record<MemoryLevelNumber, string> = {
    1: "1-plot-state",
    2: "2-character-state",
    3: "3-narrative-threads",
    4: "4-thematic-layer",
    5: "5-world-state",
  };
  return join(MEMORY_ROOT, dirs[level]);
}

// === Atomic file writes ===

async function atomicWrite(filepath: string, data: string): Promise<void> {
  const tmp = filepath + ".tmp." + Date.now();
  await writeFile(tmp, data, "utf-8");
  await rename(tmp, filepath);
}

// === Read a memory level ===

export async function readMemoryLevel(
  level: MemoryLevelNumber,
  filter?: string
): Promise<Record<string, string>> {
  const dir = memoryLevelDir(level);
  const result: Record<string, string> = {};

  try {
    const files = await readdir(dir);
    for (const file of files) {
      if (file.startsWith(".") || file.endsWith(".tmp")) continue;
      if (filter && !file.includes(filter)) continue;

      const content = await readFile(join(dir, file), "utf-8");
      const key = file.replace(extname(file), "");
      result[key] = content;
    }
  } catch {
    // Directory may not exist yet — return empty
  }

  return result;
}

// === Write to a memory level (atomic) ===

export async function writeMemoryLevel(
  level: MemoryLevelNumber,
  key: string,
  value: string
): Promise<void> {
  const dir = memoryLevelDir(level);
  await mkdir(dir, { recursive: true });

  const ext = value.trim().startsWith("{") || value.trim().startsWith("[")
    ? ".json"
    : ".md";
  const filepath = join(dir, key + ext);
  await atomicWrite(filepath, value);
}

// === Narrative threads (Level 3 specialization) ===

export async function listThreads(
  status?: NarrativeThreadStatus
): Promise<NarrativeThread[]> {
  const files = await readMemoryLevel(3);
  const threads: NarrativeThread[] = [];

  for (const [_key, content] of Object.entries(files)) {
    try {
      const thread: NarrativeThread = JSON.parse(content);
      if (!status || thread.status === status) {
        threads.push(thread);
      }
    } catch {
      // Skip non-JSON files in threads directory
    }
  }

  return threads;
}

export async function updateThread(
  threadId: string,
  updates: Partial<NarrativeThread>
): Promise<void> {
  const files = await readMemoryLevel(3);
  const existing = files[threadId];

  if (existing) {
    try {
      const thread: NarrativeThread = JSON.parse(existing);
      const updated = { ...thread, ...updates };
      await writeMemoryLevel(3, threadId, JSON.stringify(updated, null, 2));
    } catch {
      // File exists but isn't valid JSON — overwrite
      await writeMemoryLevel(3, threadId, JSON.stringify(updates, null, 2));
    }
  }
}

// === Archive session messages (move to archive before session transition) ===

export async function archiveSessionMessages(sessionNumber: number): Promise<void> {
  const messagesDir = join(SESSION_ROOT, "messages");
  const archiveDir = join(SESSION_ROOT, "archive", `session-${sessionNumber}`);

  try {
    await readdir(messagesDir);
    await mkdir(join(SESSION_ROOT, "archive"), { recursive: true });
    await rename(messagesDir, archiveDir);
  } catch {
    // messages dir may not exist — nothing to archive
  }
}

// === Story archive (full snapshot on ceremony end) ===

export async function createStoryArchive(
  sessionData: Record<string, unknown>
): Promise<string> {
  const archiveDir = join(SESSION_ROOT, "archive");
  await mkdir(archiveDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const archiveId = `story-${timestamp}`;
  const archivePath = join(archiveDir, `${archiveId}.json`);

  // Collect all memory levels
  const memory: Record<string, Record<string, string>> = {};
  for (let i = 1; i <= 5; i++) {
    memory[`level-${i}`] = await readMemoryLevel(i as MemoryLevelNumber);
  }

  const archive = {
    id: archiveId,
    createdAt: Date.now(),
    session: sessionData,
    memory,
  };

  await atomicWrite(archivePath, JSON.stringify(archive, null, 2));
  return archiveId;
}

export async function listStoryArchives(): Promise<Array<{ id: string; createdAt: number; name: string }>> {
  const archiveDir = join(SESSION_ROOT, "archive");
  try {
    const files = await readdir(archiveDir);
    const archives: Array<{ id: string; createdAt: number; name: string }> = [];
    for (const file of files) {
      if (!file.startsWith("story-") || !file.endsWith(".json")) continue;
      try {
        const raw = await readFile(join(archiveDir, file), "utf-8");
        const data = JSON.parse(raw);
        archives.push({
          id: data.id,
          createdAt: data.createdAt,
          name: (data.session as Record<string, string>)?.name || "Unknown",
        });
      } catch { /* skip corrupt files */ }
    }
    return archives.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export async function readStoryArchive(archiveId: string): Promise<Record<string, unknown> | null> {
  const archivePath = join(SESSION_ROOT, "archive", `${archiveId}.json`);
  try {
    const raw = await readFile(archivePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// === Session message persistence (JSONL) ===

export async function appendMessage(
  channel: string,
  message: Record<string, unknown>
): Promise<void> {
  const messagesDir = join(SESSION_ROOT, "messages");
  await mkdir(messagesDir, { recursive: true });

  let filepath: string;
  if (channel === "keeper-private" && message.playerId) {
    const privateDir = join(messagesDir, "keeper-private");
    await mkdir(privateDir, { recursive: true });
    filepath = join(privateDir, `${message.playerId}.jsonl`);
  } else {
    filepath = join(messagesDir, `${channel}.jsonl`);
  }

  const line = JSON.stringify(message) + "\n";
  await writeFile(filepath, line, { flag: "a" });
}

// === Session snapshot (atomic) ===

export async function writeSessionSnapshot(
  snapshot: Record<string, unknown>
): Promise<void> {
  await mkdir(SESSION_ROOT, { recursive: true });
  const filepath = join(SESSION_ROOT, "current.json");
  await atomicWrite(filepath, JSON.stringify(snapshot, null, 2));
}

export async function readSessionSnapshot(): Promise<Record<
  string,
  unknown
> | null> {
  try {
    const filepath = join(SESSION_ROOT, "current.json");
    const content = await readFile(filepath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// === Rebuild messages from JSONL files ===

export async function readAllMessages(): Promise<Message[]> {
  const messagesDir = join(SESSION_ROOT, "messages");
  const raw: Record<string, unknown>[] = [];

  try {
    // Read top-level JSONL files (all.jsonl, mc-keeper.jsonl, etc.)
    const topFiles = await readdir(messagesDir);
    for (const file of topFiles) {
      if (!file.endsWith(".jsonl")) continue;
      const content = await readFile(join(messagesDir, file), "utf-8");
      for (const line of content.split("\n")) {
        if (!line.trim()) continue;
        try {
          raw.push(JSON.parse(line));
        } catch {
          // Skip malformed lines
        }
      }
    }

    // Read keeper-private subdirectory
    const privateDir = join(messagesDir, "keeper-private");
    try {
      const privateFiles = await readdir(privateDir);
      for (const file of privateFiles) {
        if (!file.endsWith(".jsonl")) continue;
        const content = await readFile(join(privateDir, file), "utf-8");
        for (const line of content.split("\n")) {
          if (!line.trim()) continue;
          try {
            raw.push(JSON.parse(line));
          } catch {
            // Skip malformed lines
          }
        }
      }
    } catch {
      // keeper-private dir may not exist
    }
  } catch {
    // messages dir may not exist
    return [];
  }

  // Deduplicate by composite key (IDs can reset across restarts)
  const seen = new Set<string>();
  const deduped: Message[] = [];
  for (const msg of raw) {
    const sender = msg.sender as { role?: string } | undefined;
    const key = `${msg.timestamp}:${msg.channel}:${sender?.role}:${String(msg.content ?? "").slice(0, 50)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push({
      id: String(msg.id ?? ""),
      channel: (msg.channel as Message["channel"]) ?? "all",
      sender: msg.sender as Message["sender"],
      content: String(msg.content ?? ""),
      timestamp: (msg.timestamp as number) ?? 0,
      playerId: msg.playerId as string | undefined,
    });
  }

  // Sort by timestamp
  deduped.sort((a, b) => a.timestamp - b.timestamp);
  return deduped;
}
