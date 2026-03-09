import { NextRequest, NextResponse } from "next/server";
import { messages, nextMessageId, addMessage, initializeStore, session } from "@/lib/store";
import { queryKeeper } from "@/lib/keeper";
import { writeMemoryLevel } from "@/lib/memory";
import type { Channel, Message, MemoryLevelNumber } from "@/lib/types";

const MAX_HISTORY = 6;

function getRecentHistory(channel: string, playerId?: string) {
  let filtered = messages.filter((m) => m.channel === channel && m.sender.role !== "system");
  if (playerId && channel === "keeper-private") {
    filtered = filtered.filter((m) => m.playerId === playerId);
  }
  return filtered
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.sender.role, name: m.sender.name, content: m.content }));
}

export async function GET(request: NextRequest) {
  try {
    await initializeStore();

    const channel = request.nextUrl.searchParams.get("channel") as Channel | null;
    const after = request.nextUrl.searchParams.get("after");
    const playerId = request.nextUrl.searchParams.get("playerId");

    let filtered = messages;

    if (channel) {
      filtered = filtered.filter((m) => m.channel === channel);
    }

    // Permission filtering at API level: keeper-private only shows own messages
    if (playerId && channel === "keeper-private") {
      filtered = filtered.filter((m) => m.playerId === playerId);
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

    const body = await request.json();
    const { channel, sender, content, playerId } = body as {
      channel: Channel;
      sender: { role: string; name: string };
      content: string;
      playerId?: string;
    };

    const message: Message = {
      id: nextMessageId(),
      channel,
      sender: { role: sender.role as Message["sender"]["role"], name: sender.name },
      content,
      timestamp: Date.now(),
      playerId,
    };

    await addMessage(message);

    // Keeper auto-response for player messages on keeper-private channel
    if (sender.role === "player" && channel === "keeper-private") {
      const keeperResponse = await queryKeeper({
        mode: "player_response",
        trigger: {
          type: "player_action",
          channel,
          content,
          playerId,
        },
        session: { number: session.number, act: session.act, status: session.status },
        recentHistory: getRecentHistory("keeper-private", playerId),
        players: session.players.map(p => ({ name: p.name, characterName: p.characterName, journal: p.journal, notes: p.notes })),
      });

      const keeperMsg: Message = {
        id: nextMessageId(),
        channel: "keeper-private",
        sender: { role: "keeper", name: "The Keeper" },
        content: keeperResponse.narrative,
        timestamp: Date.now() + 1,
        playerId,
      };

      await addMessage(keeperMsg);

      // Write state updates from Keeper to filesystem memory
      for (const update of keeperResponse.stateUpdates) {
        await writeMemoryLevel(update.level as MemoryLevelNumber, update.key, update.value);
      }
    }

    // Keeper auto-response for player messages on "all" channel (when toggled on)
    if (sender.role === "player" && channel === "all" && session.keeperAutoRespond) {
      const keeperResponse = await queryKeeper({
        mode: "player_response",
        trigger: {
          type: "player_action",
          channel,
          content,
          playerId,
        },
        session: { number: session.number, act: session.act, status: session.status },
        recentHistory: getRecentHistory("all"),
        players: session.players.map(p => ({ name: p.name, characterName: p.characterName, journal: p.journal, notes: p.notes })),
      });

      const keeperMsg: Message = {
        id: nextMessageId(),
        channel: "all",
        sender: { role: "keeper", name: "The Keeper" },
        content: keeperResponse.narrative,
        timestamp: Date.now() + 1,
      };

      await addMessage(keeperMsg);

      for (const update of keeperResponse.stateUpdates) {
        await writeMemoryLevel(update.level as MemoryLevelNumber, update.key, update.value);
      }
    }

    return NextResponse.json(message);
  } catch (err) {
    console.error("[messages/POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
