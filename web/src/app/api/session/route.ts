import { NextResponse } from "next/server";
import {
  session,
  addPlayer,
  initializeStore,
  updateSessionStatus,
  updateScene,
} from "@/lib/store";

export async function GET() {
  await initializeStore();
  return NextResponse.json(session);
}

export async function POST(request: Request) {
  await initializeStore();
  const { action, name } = await request.json();

  if (action === "join" && name) {
    const player = addPlayer(name);
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

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function PATCH(request: Request) {
  await initializeStore();
  const body = await request.json();

  if (body.scene) {
    await updateScene(body.scene);
  }

  return NextResponse.json(session);
}
