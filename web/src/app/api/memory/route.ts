import { NextRequest, NextResponse } from "next/server";
import { readMemoryLevel } from "@/lib/memory";
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
