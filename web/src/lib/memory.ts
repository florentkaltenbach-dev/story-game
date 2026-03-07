import { readFile, writeFile, rename, readdir, mkdir } from "fs/promises";
import { join, extname } from "path";
import type {
  MemoryLevelNumber,
  NarrativeThread,
  NarrativeThreadStatus,
  MEMORY_LEVEL_DIRS,
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
