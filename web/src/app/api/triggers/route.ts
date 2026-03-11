import { NextResponse } from "next/server";
import { session, nextMessageId, addMessage, initializeStore } from "@/lib/store";
import { queryKeeper } from "@/lib/keeper";
import { authenticateRequest, requireRole } from "@/lib/auth";
import type { AuthContext } from "@/lib/auth";
import type { Message, KeeperMode } from "@/lib/types";

/**
 * POST /api/triggers — MC manually fires a trigger.
 * Bypasses cooldowns. Sends a Keeper call with the specified mode and content.
 */
export async function POST(request: Request) {
  try {
    await initializeStore();

    const auth = authenticateRequest(request);
    if (auth instanceof Response) return auth;
    if (!requireRole(auth as AuthContext, "mc")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { mode, content, channel = "all" } = body as {
      mode: KeeperMode;
      content: string;
      channel?: "all" | "keeper-private" | "mc-keeper";
    };

    if (!mode || !content) {
      return NextResponse.json({ error: "mode and content required" }, { status: 400 });
    }

    const allowedModes: KeeperMode[] = ["mc_generate", "mc_query", "player_response"];
    if (!allowedModes.includes(mode)) {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    }

    console.log(`[triggers/POST] MC manual trigger: mode=${mode} channel=${channel}`);

    const keeperResponse = await queryKeeper({
      mode,
      trigger: {
        type: "session_event",
        channel,
        content: `[MC Trigger] ${content}`,
      },
      session: { number: session.number, act: session.act, status: session.status },
      players: session.players.map((p) => ({
        name: p.name,
        characterName: p.characterName,
        journal: p.journal,
        notes: p.notes,
      })),
    });

    const msg: Message = {
      id: nextMessageId(),
      channel,
      sender: { role: "keeper", name: "The Keeper" },
      content: keeperResponse.narrative,
      timestamp: Date.now(),
    };
    await addMessage(msg);

    return NextResponse.json({
      narrative: keeperResponse.narrative,
      internalNotes: keeperResponse.internalNotes ?? null,
    });
  } catch (err) {
    console.error("[triggers/POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
