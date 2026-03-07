import { NextRequest, NextResponse } from "next/server";
import { messages, nextMessageId, addMessage, initializeStore } from "@/lib/store";
import { queryKeeper } from "@/lib/keeper";
import type { Channel, Message } from "@/lib/types";

export async function GET(request: NextRequest) {
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
}

export async function POST(request: Request) {
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
      session: { number: 0, act: 1, status: "active" },
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
  }

  return NextResponse.json(message);
}
