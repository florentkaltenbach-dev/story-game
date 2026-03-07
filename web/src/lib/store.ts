import type { Message, Player, Session, SessionSnapshot } from "./types";
import { stateEmitter } from "./events";
import { appendMessage, writeSessionSnapshot, readSessionSnapshot } from "./memory";

// === In-memory state (cache — rebuilt from filesystem on startup) ===

let messageIdCounter = 100;

export function nextMessageId(): string {
  return String(++messageIdCounter);
}

export const session: Session = {
  id: "session-1",
  name: "At the Mountains of Madness",
  preset: "mountains-of-madness",
  scene: {
    title: "The Arkham Wharf",
    description:
      "September 2nd, 1931. The cargo steamer Doris Wilkinson sits low in the harbour, her hold already heavy with crates of geological equipment and provisions for eighteen months. A cold drizzle falls on the Arkham wharf. The expedition party has been summoned for final briefing before departure at dawn.",
    location: "Arkham, Massachusetts",
  },
  players: [],
  status: "lobby",
};

export const messages: Message[] = [];

// === Initialize from filesystem (called on startup) ===

let initialized = false;

export async function initializeStore(): Promise<void> {
  if (initialized) return;

  const snapshot = await readSessionSnapshot();
  if (snapshot) {
    const s = snapshot as unknown as SessionSnapshot;
    session.id = s.id ?? session.id;
    session.name = s.name ?? session.name;
    session.preset = s.preset ?? session.preset;
    session.scene = s.scene ?? session.scene;
    session.players = s.players ?? session.players;
    session.status = s.status ?? session.status;
    if (s.lastMessageId) {
      messageIdCounter = parseInt(s.lastMessageId) || messageIdCounter;
    }
  }

  // Seed initial messages if empty
  if (messages.length === 0) {
    messages.push(
      {
        id: "1",
        channel: "all",
        sender: { role: "system", name: "System" },
        content: "The Ceremony is preparing. A new story begins.",
        timestamp: Date.now() - 60000,
      },
      {
        id: "2",
        channel: "all",
        sender: { role: "mc", name: "The Narrator" },
        content:
          "The harbour smells of salt and engine oil. Gulls wheel overhead, their cries sharpened by the wind coming off the Atlantic. You have each received a letter \u2014 typed on Miskatonic University stationery, signed by two names you do not recognise \u2014 inviting you to join an expedition of singular importance. The letter promised answers. It did not say to what questions.",
        timestamp: Date.now() - 30000,
      }
    );
  }

  initialized = true;
}

// === Player management ===

export function addPlayer(name: string): Player {
  const existing = session.players.find((p) => p.name === name);
  if (existing) return existing;

  const player: Player = {
    id: `player-${Date.now()}`,
    name,
    characterName: name,
    journal:
      "You received a letter three weeks ago. Typed on heavy cream paper, Miskatonic University crest embossed at the top. An expedition to the Antarctic \u2014 departure imminent \u2014 your particular skills required. The compensation is generous. The details are sparse. You said yes before you finished reading.",
    notes: "",
  };
  session.players.push(player);

  stateEmitter.emit("player_joined", { player });
  persistSnapshot();

  return player;
}

// === Message management ===

export async function addMessage(message: Message): Promise<void> {
  messages.push(message);
  stateEmitter.emit("message", message);

  // Persist to JSONL
  await appendMessage(message.channel, {
    id: message.id,
    channel: message.channel,
    sender: message.sender,
    content: message.content,
    timestamp: message.timestamp,
    playerId: message.playerId,
  });
}

// === Session persistence ===

async function persistSnapshot(): Promise<void> {
  const snapshot: SessionSnapshot = {
    id: session.id,
    name: session.name,
    preset: session.preset,
    scene: session.scene,
    players: session.players,
    status: session.status,
    lastMessageId: String(messageIdCounter),
    timestamp: Date.now(),
  };

  try {
    await writeSessionSnapshot(snapshot as unknown as Record<string, unknown>);
  } catch {
    // Non-critical — in-memory state is still valid
  }
}

// Persist on state changes
export async function updateSessionStatus(
  status: Session["status"]
): Promise<void> {
  session.status = status;
  stateEmitter.emit("session", { status });
  await persistSnapshot();
}

export async function updateScene(
  scene: Partial<Session["scene"]>
): Promise<void> {
  if (scene.title) session.scene.title = scene.title;
  if (scene.description) session.scene.description = scene.description;
  if (scene.location) session.scene.location = scene.location;
  stateEmitter.emit("scene", session.scene);
  await persistSnapshot();
}
