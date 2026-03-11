import { NextRequest, NextResponse } from "next/server";
import { listStoryArchives, readStoryArchive, createStoryArchive } from "@/lib/memory";
import { initializeStore, session, messages } from "@/lib/store";
import { authenticateRequest, requireRole } from "@/lib/auth";
import type { AuthContext } from "@/lib/auth";

/**
 * GET /api/archive — List story archives, or get a specific one.
 * MC-only.
 */
export async function GET(request: NextRequest) {
  try {
    await initializeStore();

    const auth = authenticateRequest(request);
    if (auth instanceof Response) return auth;
    if (!requireRole(auth as AuthContext, "mc")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const archiveId = request.nextUrl.searchParams.get("id");

    if (archiveId) {
      const archive = await readStoryArchive(archiveId);
      if (!archive) {
        return NextResponse.json({ error: "Archive not found" }, { status: 404 });
      }
      return NextResponse.json(archive);
    }

    const archives = await listStoryArchives();
    return NextResponse.json(archives);
  } catch (err) {
    console.error("[archive/GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/archive — Create a story archive snapshot.
 * MC-only. Captures current session + all memory levels.
 */
export async function POST(request: Request) {
  try {
    await initializeStore();

    const auth = authenticateRequest(request);
    if (auth instanceof Response) return auth;
    if (!requireRole(auth as AuthContext, "mc")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const sessionData = {
      id: session.id,
      name: session.name,
      preset: session.preset,
      scene: session.scene,
      players: session.players,
      status: session.status,
      number: session.number,
      act: session.act,
      messageCount: messages.length,
    };

    const archiveId = await createStoryArchive(sessionData);
    console.log(`[archive/POST] Created archive: ${archiveId}`);

    return NextResponse.json({ id: archiveId });
  } catch (err) {
    console.error("[archive/POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
