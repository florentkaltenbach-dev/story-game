import { NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import { join } from "path";
import { authenticateRequest, requireRole } from "@/lib/auth";
import type { AuthContext } from "@/lib/auth";
import { loadPreset, initializeStore } from "@/lib/store";
import { clearMemory, seedMemoryFromPreset, copyPresetConfig, clearSessionFiles } from "@/lib/memory";
import { invalidateMessageCaches } from "@/app/api/messages/route";
import { invalidateSessionTriggerCache } from "@/app/api/session/route";

interface PresetEntry {
  id: string;
  name: string;
  description: string;
  sessionCount: number;
  playerCount: string;
  scene?: { title: string; description: string; location: string };
  welcomeMessages?: Array<{ sender: { role: string; name: string }; content: string }>;
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

/**
 * POST /api/presets — Load a preset (MC-only).
 * Copies config, seeds memory, resets session with preset defaults.
 */
export async function POST(request: Request) {
  try {
    await initializeStore();

    // MC-only
    const auth = authenticateRequest(request);
    if (auth instanceof Response) return auth;
    if (!requireRole(auth as AuthContext, "mc")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const presetId = body.presetId as string;
    if (!presetId) {
      return NextResponse.json({ error: "presetId required" }, { status: 400 });
    }

    // Validate preset exists in registry
    const presetsPath = join(process.cwd(), "..", "presets", "index.json");
    const raw = await readFile(presetsPath, "utf-8");
    const registry = JSON.parse(raw);
    const preset = (registry.presets as PresetEntry[]).find((p) => p.id === presetId);
    if (!preset) {
      return NextResponse.json({ error: "Preset not found" }, { status: 404 });
    }

    // Verify preset directory exists
    const presetDir = join(process.cwd(), "..", "presets", presetId);
    try {
      await stat(presetDir);
    } catch {
      return NextResponse.json({ error: "Preset directory not found" }, { status: 404 });
    }

    // 1. Copy config files from preset
    const configCount = await copyPresetConfig(presetId);

    // 2. Clear memory and seed from preset
    await clearMemory();
    const memoryCount = await seedMemoryFromPreset(presetId);

    // 3. Clear session files (messages, snapshot)
    await clearSessionFiles();

    // 4. Reset in-memory state with preset metadata
    const scene = preset.scene ?? { title: "Untitled", description: "", location: "Unknown" };
    const welcomeMessages = preset.welcomeMessages ?? [];
    await loadPreset(presetId, { name: preset.name, scene, welcomeMessages });

    // 5. Invalidate web-side config caches
    invalidateMessageCaches();
    invalidateSessionTriggerCache();

    // 6. Invalidate keeper-service cache (best-effort)
    const keeperUrl = process.env.KEEPER_URL ?? "http://localhost:3005";
    const keeperHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (process.env.KEEPER_SHARED_SECRET) {
      keeperHeaders["X-Ceremony-Secret"] = process.env.KEEPER_SHARED_SECRET;
    }
    fetch(`${keeperUrl}/invalidate-cache`, {
      method: "POST",
      headers: keeperHeaders,
    }).catch(() => {
      console.warn("[presets/POST] Could not reach keeper-service for cache invalidation");
    });

    console.log(`[presets/POST] Loaded preset "${presetId}": ${configCount} config files, ${memoryCount} memory files`);

    return NextResponse.json({
      ok: true,
      preset: presetId,
      name: preset.name,
      configFiles: configCount,
      memoryFiles: memoryCount,
    });
  } catch (err) {
    console.error("[presets/POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
