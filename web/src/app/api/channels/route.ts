import { NextResponse } from "next/server";
import { initializeStore, createGroupChannel, groupChannels, getPlayerGroupChannels, session } from "@/lib/store";
import { authenticateRequest } from "@/lib/auth";
import type { AuthContext } from "@/lib/auth";

/**
 * GET /api/channels — List group channels visible to the caller.
 * MC sees all, players see channels they belong to.
 */
export async function GET(request: Request) {
  try {
    await initializeStore();

    const auth = authenticateRequest(request);
    if (auth instanceof Response) return auth;
    const ctx = auth as AuthContext;

    if (ctx.role === "mc") {
      return NextResponse.json(groupChannels);
    }

    if (ctx.playerId) {
      return NextResponse.json(getPlayerGroupChannels(ctx.playerId));
    }

    return NextResponse.json([]);
  } catch (err) {
    console.error("[channels/GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/channels — Create a group channel.
 * Players can create channels; members must be valid player IDs.
 */
export async function POST(request: Request) {
  try {
    await initializeStore();

    const auth = authenticateRequest(request);
    if (auth instanceof Response) return auth;
    const ctx = auth as AuthContext;

    if (ctx.role !== "player" && ctx.role !== "mc") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, memberIds } = body as { name: string; memberIds?: string[] };

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Channel name required" }, { status: 400 });
    }

    // Validate member IDs are actual players
    const validPlayerIds = session.players.map((p) => p.id);
    const creatorId = ctx.playerId ?? "mc";
    const members = (memberIds ?? []).filter((id) => validPlayerIds.includes(id));

    const channel = await createGroupChannel(name.trim(), creatorId, members);
    return NextResponse.json(channel);
  } catch (err) {
    console.error("[channels/POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
