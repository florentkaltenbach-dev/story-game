import { NextResponse } from "next/server";
import { nextMessageId, addMessage, initializeStore, messages, session } from "@/lib/store";
import { queryKeeper } from "@/lib/keeper";
import { authenticateRequest, requireRole } from "@/lib/auth";
import type { AuthContext } from "@/lib/auth";
import type { Message } from "@/lib/types";

const MAX_HISTORY = 6;

function getRecentHistory(channel: string) {
  return messages
    .filter((m) => m.channel === channel && m.sender.role !== "system")
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.sender.role, name: m.sender.name, content: m.content }));
}

export async function POST(request: Request) {
  try {
    await initializeStore();

    // MC-only endpoint
    const auth = authenticateRequest(request);
    if (auth instanceof Response) return auth;
    if (!requireRole(auth as AuthContext, "mc")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { query, mode: modeOverride } = body as { query: string; mode?: string; npcName?: string };

    // Validate mode override — only allow mc_query and mc_generate
    const allowedModes = ["mc_query", "mc_generate"];
    const mode = (modeOverride && allowedModes.includes(modeOverride)) ? modeOverride : "mc_query";

    const keeperResponse = await queryKeeper({
      mode: mode as "mc_query" | "mc_generate",
      trigger: {
        type: "mc_query",
        channel: "mc-keeper",
        content: query,
      },
      session: { number: session.number, act: session.act, status: session.status },
      recentHistory: getRecentHistory("mc-keeper"),
      players: session.players.map(p => ({ name: p.name, characterName: p.characterName, journal: p.journal, notes: p.notes })),
    });

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

    return NextResponse.json({
      narrative: keeperResponse.narrative,
      journalUpdate: keeperResponse.journalUpdate ?? null,
      internalNotes: keeperResponse.internalNotes ?? null,
      degraded: keeperResponse.degraded ?? false,
    });
  } catch (err) {
    console.error("[keeper/POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
