import { randomUUID } from "crypto";
import type { Message, Player, Session, SessionSnapshot, Invite, CharacterSheet, GameWidget, GroupChannel } from "./types";
import { stateEmitter } from "./events";
import { appendMessage, writeSessionSnapshot, readSessionSnapshot, readAllMessages, archiveSessionMessages } from "./memory";

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
  keeperAutoRespond: false,
  number: 0,
  act: 1,
};

export const messages: Message[] = [];
export const widgets: GameWidget[] = [];
export const groupChannels: GroupChannel[] = [];

// === Invite management ===

const MAX_INVITES = 10;
export const invites: Invite[] = [];

export function createInvite(): Invite {
  const invite: Invite = {
    token: randomUUID(),
    status: "new",
    createdAt: Date.now(),
  };
  invites.unshift(invite);
  if (invites.length > MAX_INVITES) invites.pop();
  persistSnapshot();
  return invite;
}

export function validateInvite(token: string): boolean {
  return invites.some((i) => i.token === token && i.status === "new");
}

/** Atomic validate + consume in one step (single-threaded JS guarantees no race) */
export function claimInvite(token: string, playerName: string): boolean {
  const invite = invites.find((i) => i.token === token && i.status === "new");
  if (!invite) return false;
  invite.status = "used";
  invite.usedBy = playerName;
  persistSnapshot();
  return true;
}

// === Initialize from filesystem (called on startup) ===

let initPromise: Promise<void> | null = null;

export function initializeStore(): Promise<void> {
  if (!initPromise) {
    initPromise = doInitialize();
  }
  return initPromise;
}

async function doInitialize(): Promise<void> {
  const snapshot = await readSessionSnapshot();
  if (snapshot) {
    const s = snapshot as unknown as SessionSnapshot;
    session.id = s.id ?? session.id;
    session.name = s.name ?? session.name;
    session.preset = s.preset ?? session.preset;
    session.scene = s.scene ?? session.scene;
    session.players = (s.players ?? session.players).map((p) => ({
      ...p,
      character: p.character ?? {
        status: "pending" as const,
        archetype: "",
        background: "",
        motivation: "",
        fear: "",
        qualities: [],
        relationships: [],
      },
    }));
    session.status = s.status ?? session.status;
    session.number = s.number ?? session.number;
    session.act = s.act ?? session.act;
    const rawSnap = snapshot as Record<string, unknown>;
    if (typeof rawSnap.keeperAutoRespond === "boolean") {
      session.keeperAutoRespond = rawSnap.keeperAutoRespond;
    }
    if (s.lastMessageId) {
      messageIdCounter = parseInt(s.lastMessageId) || messageIdCounter;
    }
    const raw = snapshot as Record<string, unknown>;
    if (Array.isArray(raw.invites)) {
      invites.length = 0;
      invites.push(...(raw.invites as Invite[]));
    }
    if (Array.isArray(raw.widgets)) {
      widgets.length = 0;
      widgets.push(...(raw.widgets as GameWidget[]));
    }
    if (Array.isArray(raw.groupChannels)) {
      groupChannels.length = 0;
      groupChannels.push(...(raw.groupChannels as GroupChannel[]));
    }
  }

  // Rebuild messages from JSONL (survives PM2 restart)
  const restored = await readAllMessages();
  if (restored.length > 0) {
    messages.push(...restored);
    const maxRestoredId = Math.max(...messages.map((m) => parseInt(m.id) || 0));
    messageIdCounter = Math.max(messageIdCounter, maxRestoredId);
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

}

// === Player management ===

export function addPlayer(name: string): Player {
  const existing = session.players.find((p) => p.name === name);
  if (existing) return existing;

  const player: Player = {
    id: `player-${randomUUID().slice(0, 8)}`,
    name,
    characterName: name,
    journal:
      "You received a letter three weeks ago. Typed on heavy cream paper, Miskatonic University crest embossed at the top. An expedition to the Antarctic \u2014 departure imminent \u2014 your particular skills required. The compensation is generous. The details are sparse. You said yes before you finished reading.",
    notes: "",
    character: {
      status: "pending",
      archetype: "",
      background: "",
      motivation: "",
      fear: "",
      qualities: [],
      relationships: [],
    },
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
    number: session.number,
    act: session.act,
    lastMessageId: String(messageIdCounter),
    keeperAutoRespond: session.keeperAutoRespond,
    invites,
    widgets,
    groupChannels,
    timestamp: Date.now(),
  } as SessionSnapshot & { invites: Invite[]; keeperAutoRespond: boolean; widgets: GameWidget[]; groupChannels: GroupChannel[] };

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

export async function updatePlayerNotes(playerId: string, notes: string): Promise<void> {
  const player = session.players.find((p) => p.id === playerId);
  if (!player) return;
  player.notes = notes;
  await persistSnapshot();
}

export async function advanceAct(): Promise<number> {
  if (session.act < 4) session.act++;
  stateEmitter.emit("session", { status: session.status, act: session.act });
  await persistSnapshot();
  return session.act;
}

export async function endSession(): Promise<void> {
  session.status = "ended";
  stateEmitter.emit("session", { status: "ended" });
  await persistSnapshot();
}

export async function nextSession(): Promise<void> {
  await archiveSessionMessages(session.number);
  session.number = Math.min(session.number + 1, 4);
  session.act = 1;
  session.status = "lobby";
  messages.length = 0;
  messageIdCounter = 100;
  stateEmitter.emit("session", {
    status: session.status,
    number: session.number,
    act: session.act,
  });
  await persistSnapshot();
}

export async function resetSession(): Promise<void> {
  session.players = [];
  session.status = "lobby";
  session.keeperAutoRespond = false;
  session.number = 0;
  session.act = 1;
  messages.length = 0;
  invites.length = 0;
  widgets.length = 0;
  groupChannels.length = 0;
  messageIdCounter = 100;

  // Re-seed with welcome messages
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
        "The harbour smells of salt and engine oil. Gulls wheel overhead, their cries sharpened by the wind coming off the Atlantic. You have each received a letter — typed on Miskatonic University stationery, signed by two names you do not recognise — inviting you to join an expedition of singular importance. The letter promised answers. It did not say to what questions.",
      timestamp: Date.now() - 30000,
    }
  );

  stateEmitter.emit("session", {
    status: session.status,
    number: session.number,
    act: session.act,
  });
  await persistSnapshot();
}

export async function kickPlayer(playerId: string): Promise<boolean> {
  const idx = session.players.findIndex((p) => p.id === playerId);
  if (idx === -1) return false;

  const [removed] = session.players.splice(idx, 1);
  stateEmitter.emit("player_kicked", { playerId: removed.id, name: removed.name });
  await persistSnapshot();
  return true;
}

export async function toggleKeeperAutoRespond(): Promise<boolean> {
  session.keeperAutoRespond = !session.keeperAutoRespond;
  stateEmitter.emit("session", { status: session.status, keeperAutoRespond: session.keeperAutoRespond });
  await persistSnapshot();
  return session.keeperAutoRespond;
}

// === Character management ===

export async function updateCharacter(
  playerId: string,
  fields: Partial<CharacterSheet>
): Promise<Player | null> {
  const player = session.players.find((p) => p.id === playerId);
  if (!player) return null;

  // Merge fields
  if (fields.archetype !== undefined) player.character.archetype = fields.archetype;
  if (fields.background !== undefined) player.character.background = fields.background;
  if (fields.motivation !== undefined) player.character.motivation = fields.motivation;
  if (fields.fear !== undefined) player.character.fear = fields.fear;
  if (fields.qualities !== undefined) player.character.qualities = fields.qualities;
  if (fields.relationships !== undefined) player.character.relationships = fields.relationships;

  // Auto-promote pending → draft on first edit
  if (player.character.status === "pending") {
    player.character.status = "draft";
  }

  // Update characterName from archetype if set
  if (fields.archetype) {
    player.characterName = player.name;
  }

  stateEmitter.emit("character_update", {
    playerId,
    status: player.character.status,
    character: player.character,
  });
  await persistSnapshot();
  return player;
}

export async function submitCharacter(playerId: string): Promise<Player | null> {
  const player = session.players.find((p) => p.id === playerId);
  if (!player) return null;

  player.character.status = "submitted";
  player.character.revisionComment = undefined;
  stateEmitter.emit("character_update", {
    playerId,
    status: player.character.status,
    character: player.character,
  });
  await persistSnapshot();
  return player;
}

export async function approveCharacter(playerId: string): Promise<Player | null> {
  const player = session.players.find((p) => p.id === playerId);
  if (!player) return null;

  player.character.status = "approved";
  player.character.revisionComment = undefined;
  stateEmitter.emit("character_update", {
    playerId,
    status: player.character.status,
    character: player.character,
  });
  await persistSnapshot();
  return player;
}

export async function reviseCharacter(playerId: string, comment?: string): Promise<Player | null> {
  const player = session.players.find((p) => p.id === playerId);
  if (!player) return null;

  player.character.status = "draft";
  player.character.revisionComment = comment || undefined;
  stateEmitter.emit("character_update", {
    playerId,
    status: player.character.status,
    character: player.character,
  });
  await persistSnapshot();
  return player;
}

// === Widget management ===

export async function updateWidget(widget: GameWidget): Promise<void> {
  const idx = widgets.findIndex((w) => w.id === widget.id);
  if (idx >= 0) {
    widgets[idx] = widget;
  } else {
    widgets.push(widget);
  }
  stateEmitter.emit("widget_update", widget);
  await persistSnapshot();
}

export async function removeWidget(widgetId: string): Promise<boolean> {
  const idx = widgets.findIndex((w) => w.id === widgetId);
  if (idx === -1) return false;
  widgets.splice(idx, 1);
  stateEmitter.emit("widget_remove", { widgetId });
  await persistSnapshot();
  return true;
}

export function getWidgetsForPlayer(playerId: string): GameWidget[] {
  return widgets.filter((w) => w.target === "all" || w.target === playerId);
}

// === Group channel management ===

export async function createGroupChannel(name: string, creatorId: string, memberIds: string[]): Promise<GroupChannel> {
  const id = `group-${randomUUID().slice(0, 8)}` as const;
  // Ensure creator is in members
  const members = Array.from(new Set([creatorId, ...memberIds]));
  const channel: GroupChannel = { id, name, members, createdBy: creatorId, createdAt: Date.now() };
  groupChannels.push(channel);
  await persistSnapshot();
  return channel;
}

export function getGroupChannel(channelId: string): GroupChannel | undefined {
  return groupChannels.find((c) => c.id === channelId);
}

export function isGroupChannelMember(channelId: string, playerId: string): boolean {
  const channel = groupChannels.find((c) => c.id === channelId);
  if (!channel) return false;
  return channel.members.includes(playerId);
}

export function getPlayerGroupChannels(playerId: string): GroupChannel[] {
  return groupChannels.filter((c) => c.members.includes(playerId));
}

// === Test helpers ===

export function _resetForTesting(): void {
  session.id = "session-test";
  session.name = "Test Session";
  session.preset = "test";
  session.scene = { title: "", description: "", location: "" };
  session.players = [];
  session.status = "lobby";
  session.keeperAutoRespond = false;
  session.number = 0;
  session.act = 1;
  messages.length = 0;
  invites.length = 0;
  widgets.length = 0;
  groupChannels.length = 0;
  messageIdCounter = 100;
  initPromise = null;
}
