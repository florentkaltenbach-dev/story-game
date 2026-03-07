import { NextResponse } from "next/server";
import { nextMessageId, addMessage, initializeStore } from "@/lib/store";
import { queryKeeper } from "@/lib/keeper";
import type { Message } from "@/lib/types";

export async function POST(request: Request) {
  await initializeStore();

  const { query } = await request.json();

  const keeperResponse = await queryKeeper({
    mode: "mc_query",
    trigger: {
      type: "mc_query",
      channel: "mc-keeper",
      content: query,
    },
    session: { number: 0, act: 1, status: "active" },
  });

  // Store the MC query and Keeper response in mc-keeper channel
  const mcMsg: Message = {
    id: nextMessageId(),
    channel: "mc-keeper",
    sender: { role: "mc", name: "MC" },
    content: query,
    timestamp: Date.now(),
  };

  const keeperMsg: Message = {
    id: nextMessageId(),
    channel: "mc-keeper",
    sender: { role: "keeper", name: "The Keeper" },
    content: keeperResponse.narrative,
    timestamp: Date.now() + 1,
  };

  await addMessage(mcMsg);
  await addMessage(keeperMsg);

  return NextResponse.json({ response: keeperResponse.narrative });
}
