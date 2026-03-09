import { NextResponse } from "next/server";
import {
  session,
  addPlayer,
  initializeStore,
  updateSessionStatus,
  updateScene,
  toggleKeeperAutoRespond,
  validateInvite,
  consumeInvite,
  updatePlayerNotes,
  advanceAct,
  endSession,
  nextSession,
} from "@/lib/store";

export async function GET() {
  try {
    await initializeStore();
    return NextResponse.json(session);
  } catch (err) {
    console.error("[session/GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await initializeStore();
    const { action, name, token } = await request.json();

    if (action === "join" && name) {
      if (!token || !validateInvite(token)) {
        return NextResponse.json(
          { error: "Invalid or expired invitation" },
          { status: 403 }
        );
      }
      const player = addPlayer(name);
      consumeInvite(token, name);
      return NextResponse.json(player);
    }

    if (action === "start") {
      await updateSessionStatus("active");
      return NextResponse.json(session);
    }

    if (action === "pause") {
      await updateSessionStatus(
        session.status === "paused" ? "active" : "paused"
      );
      return NextResponse.json(session);
    }

    if (action === "toggle_keeper") {
      await toggleKeeperAutoRespond();
      return NextResponse.json(session);
    }

    if (action === "reconnect" && name) {
      const existing = session.players.find((p) => p.name === name);
      if (!existing) {
        return NextResponse.json({ error: "Player not found" }, { status: 404 });
      }
      return NextResponse.json(existing);
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

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("[session/POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await initializeStore();
    const body = await request.json();

    if (body.scene) {
      await updateScene(body.scene);
    }

    if (body.playerId && typeof body.notes === "string") {
      await updatePlayerNotes(body.playerId, body.notes);
    }

    return NextResponse.json(session);
  } catch (err) {
    console.error("[session/PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
