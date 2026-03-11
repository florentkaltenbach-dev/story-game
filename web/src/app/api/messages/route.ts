import { NextRequest, NextResponse } from "next/server";
import { messages, nextMessageId, addMessage, initializeStore, session, widgets, updateWidget } from "@/lib/store";
import { queryKeeper, RemoteKeeper } from "@/lib/keeper";
import { writeMemoryLevel, readMemoryLevel, listThreads, updateThread } from "@/lib/memory";
import { authenticateRequest } from "@/lib/auth";
import type { AuthContext } from "@/lib/auth";
import type { Channel, Message, MemoryLevelNumber, EventTrigger, TriggerState } from "@/lib/types";
import { runPipeline, type PipelineContext } from "@/lib/scripts/pipeline";
import type { NpcConfig } from "@/lib/scripts/npc-extractor";
import type { LocationConfig } from "@/lib/scripts/location";
import { matchTriggers, type TriggeredAction } from "@/lib/scripts/triggers";
import { deriveKnowledge, addKnowledge, readKnowledgeLedger } from "@/lib/scripts/knowledge";
import { isGroupChannelMember } from "@/lib/store";
import { stateEmitter } from "@/lib/events";
import { readFile } from "fs/promises";
import { join } from "path";

// Streaming keeper helper — streams text via SSE, falls back to non-streaming
const streamKeeper = new RemoteKeeper();

async function streamKeeperResponse(
  input: Parameters<typeof queryKeeper>[0],
  playerId?: string
) {
  try {
    return await streamKeeper.streamQuery(input, (text) => {
      // Emit partial text to SSE clients
      stateEmitter.emit("keeper_typing", { text, playerId });
    });
  } catch {
    // Fallback to non-streaming
    return queryKeeper(input);
  }
}

const MAX_HISTORY = 6;
const THREAD_EVAL_INTERVAL = 10; // Evaluate threads every N player messages

// Session-scoped trigger state (resets on session transition)
const triggerState: TriggerState = { lastFired: {} };
let messagesSinceLastEval = 0;

// Cached config files (loaded once, invalidated on preset load)
let cachedNpcs: NpcConfig[] | null = null;
let cachedLocations: LocationConfig[] | null = null;
let cachedTriggers: EventTrigger[] | null = null;

export function invalidateMessageCaches(): void {
  cachedNpcs = null;
  cachedLocations = null;
  cachedTriggers = null;
}

async function loadNpcs(): Promise<NpcConfig[]> {
  if (cachedNpcs) return cachedNpcs;
  try {
    const raw = await readFile(join(process.cwd(), "..", "config", "characters.json"), "utf-8");
    const data = JSON.parse(raw);
    cachedNpcs = (data.npcs || []).map((n: { name: string; role: string; description?: string; agenda?: string }) => ({
      name: n.name,
      role: n.role,
      description: n.description,
      agenda: n.agenda,
    }));
    return cachedNpcs!;
  } catch {
    return [];
  }
}

async function loadLocations(): Promise<LocationConfig[]> {
  if (cachedLocations) return cachedLocations;
  try {
    const raw = await readFile(join(process.cwd(), "..", "config", "world.json"), "utf-8");
    const data = JSON.parse(raw);
    cachedLocations = Object.entries(data.geography || {}).map(([name, desc]) => ({
      name,
      description: String(desc),
    }));
    return cachedLocations!;
  } catch {
    return [];
  }
}

async function loadTriggers(): Promise<EventTrigger[]> {
  if (cachedTriggers) return cachedTriggers;
  try {
    const raw = await readFile(join(process.cwd(), "..", "config", "triggers.json"), "utf-8");
    const data = JSON.parse(raw);
    cachedTriggers = data.triggers || [];
    return cachedTriggers!;
  } catch {
    return [];
  }
}

async function buildPipelineContext(): Promise<PipelineContext> {
  const [knownNpcs, knownLocations, existingNpcFiles] = await Promise.all([
    loadNpcs(),
    loadLocations(),
    readMemoryLevel(2),
  ]);

  return {
    knownNpcs,
    existingNpcKeys: Object.keys(existingNpcFiles),
    knownLocations,
    currentLocation: session.scene.location,
    existingWidgets: [...widgets],
  };
}

async function applyPipelineResult(
  result: Awaited<ReturnType<typeof runPipeline>>,
  playerId?: string
): Promise<void> {
  // Apply memory writes
  for (const write of result.memoryWrites) {
    await writeMemoryLevel(write.level as MemoryLevelNumber, write.key, write.value);
  }

  // Apply widget ops
  for (const op of result.widgetOps) {
    if (op.action === "upsert") {
      await updateWidget(op.widget);
    }
  }

  // Apply journal entries (write to player's journal in memory Level 2)
  for (const entry of result.journalEntries) {
    const journalKey = `journal-${entry.playerId}`;
    const voiceTag = entry.voice === "player" ? "[player]" : "[narrator]";
    const journalLine = `${voiceTag} ${entry.text}`;

    // Read existing journal, append
    const existing = await readMemoryLevel(2, journalKey);
    const current = existing[journalKey] || "";
    const updated = current ? `${current}\n\n${journalLine}` : journalLine;
    await writeMemoryLevel(2, journalKey, updated);
  }
}

function getRecentHistory(channel: string, playerId?: string) {
  let filtered = messages.filter((m) => m.channel === channel && m.sender.role !== "system");
  if (playerId && channel === "keeper-private") {
    filtered = filtered.filter((m) => m.playerId === playerId);
  }
  return filtered
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.sender.role, name: m.sender.name, content: m.content }));
}

async function handleKeeperResponse(
  keeperResponse: { narrative: string; journalUpdate?: string; internalNotes?: string; stateUpdates?: Array<{ level: number; key: string; value: string }>; degraded?: boolean },
  channel: Channel,
  playerId?: string
): Promise<void> {
  // Save keeper message
  const keeperMsg: Message = {
    id: nextMessageId(),
    channel,
    sender: { role: "keeper", name: "The Keeper" },
    content: keeperResponse.narrative,
    timestamp: Date.now() + 1,
    playerId: channel === "keeper-private" ? playerId : undefined,
  };
  await addMessage(keeperMsg);

  // Emit internalNotes to MC via SSE (if present)
  if (keeperResponse.internalNotes) {
    stateEmitter.emit("keeper_response", {
      narrative: keeperResponse.narrative,
      internalNotes: keeperResponse.internalNotes,
      playerId,
      channel,
    });
  }

  // Run deterministic pipeline
  const context = await buildPipelineContext();
  const pipelineResult = runPipeline(
    {
      narrative: keeperResponse.narrative,
      journalUpdate: keeperResponse.journalUpdate,
      playerId,
      session: { number: session.number, act: session.act },
    },
    context
  );

  await applyPipelineResult(pipelineResult, playerId);

  // Track knowledge for the player who triggered this response
  if (playerId && pipelineResult.detectedEvents.length > 0) {
    const knowledgeEntries = deriveKnowledge(pipelineResult.detectedEvents, session.scene.location);
    addKnowledge(playerId, knowledgeEntries).catch((err) =>
      console.error("[knowledge] Failed to update ledger:", err)
    );
  }

  // Check triggers
  if (pipelineResult.detectedEvents.length > 0) {
    const triggerConfig = await loadTriggers();
    const triggered = matchTriggers(pipelineResult.detectedEvents, triggerConfig, triggerState);

    for (const action of triggered) {
      // Update cooldown
      triggerState.lastFired[action.triggerId] = Date.now();

      // Queue triggered Keeper call (fire-and-forget for now)
      handleTriggeredAction(action, channel, playerId).catch((err) =>
        console.error("[triggers] Error handling triggered action:", err)
      );
    }
  }

  // Maybe trigger thread evaluation (fire-and-forget)
  maybeEvaluateThreads().catch((err) =>
    console.error("[ThreadEval] Error:", err)
  );
}

async function handleTriggeredAction(
  action: TriggeredAction,
  channel: Channel,
  playerId?: string
): Promise<void> {
  const triggerContent = action.description || `Event: ${action.event.type}`;
  const eventContext = JSON.stringify(action.event.data);

  const keeperResponse = await queryKeeper({
    mode: action.mode,
    trigger: {
      type: "session_event",
      channel,
      content: `[Triggered: ${triggerContent}] Context: ${eventContext}`,
      playerId,
    },
    session: { number: session.number, act: session.act, status: session.status },
    recentHistory: getRecentHistory(channel, playerId),
    players: session.players.map((p) => ({
      name: p.name,
      characterName: p.characterName,
      journal: p.journal,
      notes: p.notes,
    })),
  });

  const triggerMsg: Message = {
    id: nextMessageId(),
    channel,
    sender: { role: "keeper", name: "The Keeper" },
    content: keeperResponse.narrative,
    timestamp: Date.now() + 2,
    playerId: channel === "keeper-private" ? playerId : undefined,
  };
  await addMessage(triggerMsg);
}

async function maybeEvaluateThreads(): Promise<void> {
  messagesSinceLastEval++;
  if (messagesSinceLastEval < THREAD_EVAL_INTERVAL) return;

  messagesSinceLastEval = 0;

  // Get current threads and recent messages
  const threads = await listThreads();
  const activeThreads = threads.filter((t) => t.status !== "dormant" && t.status !== "resolved");
  if (activeThreads.length === 0) return;

  const recentMessages = messages
    .filter((m) => m.sender.role !== "system")
    .slice(-20)
    .map((m) => ({ role: m.sender.role, name: m.sender.name, content: m.content }));

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const sharedSecret = process.env.KEEPER_SHARED_SECRET;
    if (sharedSecret) headers["X-Ceremony-Secret"] = sharedSecret;

    const res = await fetch(`${process.env.KEEPER_URL ?? "http://localhost:3005"}/evaluate-threads`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        threads: activeThreads.map((t) => ({ id: t.id, name: t.name, status: t.status, content: t.content })),
        recentMessages,
      }),
    });

    if (!res.ok) return;

    const result = await res.json() as { threadUpdates: Array<{ id: string; newStatus: string; reason: string }> };

    for (const update of result.threadUpdates || []) {
      const validStatuses = ["dormant", "planted", "growing", "ripe", "resolved"];
      if (!validStatuses.includes(update.newStatus)) continue;

      await updateThread(update.id, {
        status: update.newStatus as "dormant" | "planted" | "growing" | "ripe" | "resolved",
      });
      console.log(`[ThreadEval] ${update.id}: → ${update.newStatus} (${update.reason})`);
    }
  } catch (err) {
    console.error("[ThreadEval] Error:", err);
  }
}

export async function GET(request: NextRequest) {
  try {
    await initializeStore();

    const auth = authenticateRequest(request);
    if (auth instanceof Response) return auth;
    const ctx = auth as AuthContext;

    const channel = request.nextUrl.searchParams.get("channel") as Channel | null;
    const after = request.nextUrl.searchParams.get("after");

    let filtered = messages;

    if (channel) {
      filtered = filtered.filter((m) => m.channel === channel);
    }

    // mc-keeper channel is MC-only
    if (channel === "mc-keeper" && ctx.role !== "mc") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Group channels: members + MC only
    if (channel?.startsWith("group-") && ctx.role !== "mc") {
      if (!ctx.playerId || !isGroupChannelMember(channel, ctx.playerId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Permission filtering: keeper-private and secret-action show own messages for players
    if ((channel === "keeper-private" || channel === "secret-action") && ctx.role === "player") {
      filtered = filtered.filter((m) => m.playerId === ctx.playerId);
    }

    if (after) {
      const afterTime = parseInt(after);
      filtered = filtered.filter((m) => m.timestamp > afterTime);
    }

    return NextResponse.json(filtered);
  } catch (err) {
    console.error("[messages/GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await initializeStore();

    const auth = authenticateRequest(request);
    if (auth instanceof Response) return auth;
    const ctx = auth as AuthContext;

    const body = await request.json();
    const { channel, sender, content } = body as {
      channel: Channel;
      sender?: { name: string };
      content: string;
    };

    // Group channel access check
    if (channel.startsWith("group-") && ctx.role !== "mc") {
      if (!ctx.playerId || !isGroupChannelMember(channel, ctx.playerId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Resolve sender name: explicit > player record > role fallback
    let senderName = sender?.name ?? "";
    if (!senderName && ctx.role === "player" && ctx.playerId) {
      const player = session.players.find((p) => p.id === ctx.playerId);
      senderName = player?.name ?? "Unknown Player";
    }
    if (!senderName) senderName = ctx.role === "mc" ? "The Narrator" : "Unknown";

    // Sender role comes from token, not body (prevents impersonation)
    const message: Message = {
      id: nextMessageId(),
      channel,
      sender: { role: ctx.role as Message["sender"]["role"], name: senderName },
      content,
      timestamp: Date.now(),
      playerId: ctx.playerId,
    };

    await addMessage(message);

    // Keeper auto-response for player messages on keeper-private channel
    if (ctx.role === "player" && channel === "keeper-private") {
      const ledger = ctx.playerId ? await readKnowledgeLedger(ctx.playerId) : null;

      const keeperInput = {
        mode: "player_response" as const,
        trigger: {
          type: "player_action" as const,
          channel,
          content,
          playerId: ctx.playerId,
        },
        session: { number: session.number, act: session.act, status: session.status },
        recentHistory: getRecentHistory("keeper-private", ctx.playerId),
        players: session.players.map(p => ({ name: p.name, characterName: p.characterName, journal: p.journal, notes: p.notes })),
        playerKnowledge: ledger?.entries,
      };

      // Try streaming; fall back to non-streaming on error
      const keeperResponse = await streamKeeperResponse(keeperInput, ctx.playerId);
      await handleKeeperResponse(keeperResponse, "keeper-private", ctx.playerId);
    }

    // Keeper auto-response for player messages on "all" channel (when toggled on)
    if (ctx.role === "player" && channel === "all" && session.keeperAutoRespond) {
      const ledgerAll = ctx.playerId ? await readKnowledgeLedger(ctx.playerId) : null;

      const keeperInput = {
        mode: "player_response" as const,
        trigger: {
          type: "player_action" as const,
          channel,
          content,
          playerId: ctx.playerId,
        },
        session: { number: session.number, act: session.act, status: session.status },
        recentHistory: getRecentHistory("all"),
        players: session.players.map(p => ({ name: p.name, characterName: p.characterName, journal: p.journal, notes: p.notes })),
        playerKnowledge: ledgerAll?.entries,
      };

      const keeperResponse = await streamKeeperResponse(keeperInput, ctx.playerId);
      await handleKeeperResponse(keeperResponse, "all", ctx.playerId);
    }

    // Secret action: player + MC only, Keeper evaluates what others notice
    if (ctx.role === "player" && channel === "secret-action") {
      const ledgerSecret = ctx.playerId ? await readKnowledgeLedger(ctx.playerId) : null;

      const keeperResponse = await queryKeeper({
        mode: "player_response",
        trigger: {
          type: "player_action",
          channel: "secret-action",
          content: `[SECRET ACTION by ${message.sender.name}] ${content}\n\nEvaluate this secret action. Respond privately to the player with the result. Then, if other players might notice anything, add an internalNotes field describing what they would observe (without revealing the action itself).`,
          playerId: ctx.playerId,
        },
        session: { number: session.number, act: session.act, status: session.status },
        recentHistory: getRecentHistory("all"),
        players: session.players.map(p => ({ name: p.name, characterName: p.characterName, journal: p.journal, notes: p.notes })),
        playerKnowledge: ledgerSecret?.entries,
      });

      // Private result to the acting player
      await handleKeeperResponse(keeperResponse, "keeper-private", ctx.playerId);

      // If Keeper flagged something observable, post a subtle public observation
      if (keeperResponse.internalNotes) {
        const publicMsg: Message = {
          id: nextMessageId(),
          channel: "all",
          sender: { role: "keeper", name: "The Keeper" },
          content: keeperResponse.internalNotes,
          timestamp: Date.now() + 3,
        };
        await addMessage(publicMsg);
      }
    }

    return NextResponse.json(message);
  } catch (err) {
    console.error("[messages/POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
