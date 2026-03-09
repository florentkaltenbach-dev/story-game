import { NextResponse } from "next/server";
import {
  session,
  addPlayer,
  initializeStore,
  updateSessionStatus,
  updateScene,
  toggleKeeperAutoRespond,
  claimInvite,
  updatePlayerNotes,
  advanceAct,
  endSession,
  nextSession,
} from "@/lib/store";
import { authenticateRequest, requireRole, createToken } from "@/lib/auth";
import type { AuthContext } from "@/lib/auth";

export async function GET() {
  try {
    await initializeStore();
    // Public but limited: return non-sensitive session info
    return NextResponse.json({
      id: session.id,
      name: session.name,
      preset: session.preset,
      scene: session.scene,
      players: session.players.map((p) => ({ id: p.id, name: p.name, characterName: p.characterName })),
      status: session.status,
      number: session.number,
      act: session.act,
    });
  } catch (err) {
    console.error("[session/GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await initializeStore();
    const body = await request.json();
    const { action, name, token } = body;

    // Join uses invite token (no auth needed, returns auth token)
    if (action === "join" && name) {
      if (!token || !claimInvite(token, name)) {
        return NextResponse.json(
          { error: "Invalid or expired invitation" },
          { status: 403 }
        );
      }
      const player = addPlayer(name);
      const authToken = createToken({ role: "player", playerId: player.id });
      return NextResponse.json({ ...player, token: authToken });
    }

    // Reconnect requires auth — playerId must match token
    if (action === "reconnect" && name) {
      const auth = authenticateRequest(request);
      if (auth instanceof Response) return auth;
      const existing = session.players.find((p) => p.name === name);
      if (!existing) {
        return NextResponse.json({ error: "Player not found" }, { status: 404 });
      }
      if (auth.role === "player" && auth.playerId !== existing.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      // Re-issue token in case the old one is close to expiry
      const authToken = createToken({ role: "player", playerId: existing.id });
      return NextResponse.json({ ...existing, token: authToken });
    }

    // MC-only actions
    const mcActions = ["start", "pause", "toggle_keeper", "advance_act", "end_session", "next_session"];
    if (mcActions.includes(action)) {
      const auth = authenticateRequest(request);
      if (auth instanceof Response) return auth;
      if (!requireRole(auth as AuthContext, "mc")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      if (action === "start") {
        await updateSessionStatus("active");
        return NextResponse.json(session);
      }
      if (action === "pause") {
        await updateSessionStatus(session.status === "paused" ? "active" : "paused");
        return NextResponse.json(session);
      }
      if (action === "toggle_keeper") {
        await toggleKeeperAutoRespond();
        return NextResponse.json(session);
      }
      if (action === "advance_act") {
        const act = await advanceAct();
        return NextResponse.json({ act });
      }
      if (action === "end_session") {
        await endSession();
        return NextResponse.json(session);
      }
      if (action === "next_session") {
        await nextSession();
        return NextResponse.json(session);
      }
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("[session/POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await initializeStore();
    const auth = authenticateRequest(request);
    if (auth instanceof Response) return auth;

    const body = await request.json();

    // Scene updates are MC-only
    if (body.scene) {
      if (!requireRole(auth as AuthContext, "mc")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      await updateScene(body.scene);
    }

    // Notes: player can only update own notes (playerId from token)
    if (typeof body.notes === "string") {
      const playerId = (auth as AuthContext).playerId;
      if (playerId) {
        await updatePlayerNotes(playerId, body.notes);
      }
    }

    return NextResponse.json(session);
  } catch (err) {
    console.error("[session/PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
