import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

interface PresetEntry {
  id: string;
  name: string;
  description: string;
  sessionCount: number;
  playerCount: string;
}

/**
 * GET /api/presets — List available story presets.
 * No auth required (public info for session creation).
 */
export async function GET() {
  try {
    const presetsPath = join(process.cwd(), "..", "presets", "index.json");
    const raw = await readFile(presetsPath, "utf-8");
    const data = JSON.parse(raw);
    return NextResponse.json({
      presets: data.presets as PresetEntry[],
      default: data.default as string,
    });
  } catch {
    return NextResponse.json({
      presets: [],
      default: "mountains-of-madness",
    });
  }
}
