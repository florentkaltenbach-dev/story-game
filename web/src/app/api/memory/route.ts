import { NextRequest, NextResponse } from "next/server";
import { readMemoryLevel, writeMemoryLevel } from "@/lib/memory";
import { session } from "@/lib/store";
import { authenticateRequest, requireRole } from "@/lib/auth";
import type { AuthContext } from "@/lib/auth";
import type { MemoryLevelNumber } from "@/lib/types";

export async function GET(request: NextRequest) {
  // MC-only endpoint
  const auth = authenticateRequest(request);
  if (auth instanceof Response) return auth;
  if (!requireRole(auth as AuthContext, "mc")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const levelParam = request.nextUrl.searchParams.get("level");

  if (levelParam) {
    const level = parseInt(levelParam) as MemoryLevelNumber;
    if (level < 1 || level > 5) {
      return NextResponse.json({ error: "Level must be 1-5" }, { status: 400 });
    }
    const data = await readMemoryLevel(level);
    return NextResponse.json({ level, files: data });
  }

  // Return summary of all levels
  const summary: Record<number, { fileCount: number; files: string[] }> = {};
  for (let i = 1; i <= 5; i++) {
    const level = i as MemoryLevelNumber;
    const data = await readMemoryLevel(level);
    const fileNames = Object.keys(data);
    summary[level] = { fileCount: fileNames.length, files: fileNames };
  }

  return NextResponse.json(summary);
}

export async function POST(request: NextRequest) {
  const auth = authenticateRequest(request);
  if (auth instanceof Response) return auth;
  if (!requireRole(auth as AuthContext, "mc")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { level, key, value, override } = body as { level: number; key: string; value: string; override?: boolean };

  // Session gate: only allow writes during Session 0, unless MC uses override
  if (session.number !== 0 && !override) {
    return NextResponse.json(
      { error: "Read-only during live play (Session 0 only). Use override:true for MC inject." },
      { status: 403 }
    );
  }

  // Log overrides for audit trail
  if (override && session.number !== 0) {
    console.log(`[memory/POST] MC OVERRIDE: level=${level} key=${key} session=${session.number} act=${session.act}`);
  }

  if (!level || !key || value === undefined) {
    return NextResponse.json({ error: "level, key, and value required" }, { status: 400 });
  }
  if (level < 1 || level > 5) {
    return NextResponse.json({ error: "Level must be 1-5" }, { status: 400 });
  }

  await writeMemoryLevel(level as MemoryLevelNumber, key, value);
  return NextResponse.json({ ok: true });
}
