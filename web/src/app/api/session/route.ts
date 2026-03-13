import { NextResponse } from "next/server";
import {
  session,
  messages,
  widgets,
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
  resetSession,
  kickPlayer,
  updateCharacter,
  submitCharacter,
  approveCharacter,
  reviseCharacter,
  updateWidget,
  removeWidget,
  getWidgetsForPlayer,
  claimCharacter,
  claimCharacterAsMC,
  getClaimedCharacterIds,
  mcCharacterId,
  mcCharacterData,
} from "@/lib/store";
import { writeMemoryLevel } from "@/lib/memory";
import { matchTriggers } from "@/lib/scripts/triggers";
import { queryKeeper } from "@/lib/keeper";
import { compressAct, buildRecap } from "@/lib/compression";
import { authenticateRequest, requireRole, createToken } from "@/lib/auth";
import type { AuthContext } from "@/lib/auth";
import type { EventTrigger, TriggerState, Message, PresetCharacter } from "@/lib/types";
import type { DetectedEvent } from "@/lib/scripts/types";
import { readFile } from "fs/promises";
import { join } from "path";
import { nextMessageId, addMessage } from "@/lib/store";

// === Character pool loader (cached) ===
let cachedPool: PresetCharacter[] | null = null;

export function invalidatePoolCache(): void {
  cachedPool = null;
}

async function loadCharacterPool(): Promise<PresetCharacter[]> {
  if (cachedPool) return cachedPool;
  try {
    const raw = await readFile(join(process.cwd(), "..", "config", "characters.json"), "utf-8");
    const data = JSON.parse(raw);
    cachedPool = data.pool || [];
    return cachedPool!;
  } catch {
    return [];
  }
}

// Session-scoped trigger state for scene transitions
const sceneTriggerState: TriggerState = { lastFired: {} };

let cachedTriggers: EventTrigger[] | null = null;

export function invalidateSessionTriggerCache(): void {
  cachedTriggers = null;
}
async function loadTriggerConfig(): Promise<EventTrigger[]> {
  if (cachedTriggers) return cachedTriggers;
  try {
    const raw = await readFile(join(process.cwd(), "..", "config", "triggers.json"), "utf-8");
    const data = JSON.parse(raw);
    cachedTriggers = data.triggers || [];
    return cachedTriggers!;
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  try {
    await initializeStore();

    // Try to authenticate to determine role-based widget filtering
    const auth = authenticateRequest(request);
    let filteredWidgets = widgets;
    if (auth instanceof Response) {
      // Unauthenticated — no widgets
      filteredWidgets = [];
    } else {
      const ctx = auth as AuthContext;
      if (ctx.role === "mc") {
        filteredWidgets = widgets;
      } else if (ctx.playerId) {
        filteredWidgets = getWidgetsForPlayer(ctx.playerId);
      } else {
        filteredWidgets = [];
      }
    }

    // Load character pool for the response
    const pool = await loadCharacterPool();
    const claimedIds = getClaimedCharacterIds();

    return NextResponse.json({
      id: session.id,
      name: session.name,
      preset: session.preset,
      scene: session.scene,
      players: session.players.map((p) => ({ id: p.id, name: p.name, characterName: p.characterName, character: p.character })),
      status: session.status,
      number: session.number,
      act: session.act,
      widgets: filteredWidgets,
      characterPool: pool,
      characterClaims: claimedIds,
      mcCharacterId,
      mcCharacterData,
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
    const mcActions = ["start", "pause", "toggle_keeper", "advance_act", "end_session", "next_session", "reset", "kick"];
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
        // Compress current act's messages before advancing (fire-and-forget)
        const currentAct = session.act;
        const currentMessages = [...messages];
        compressAct(currentMessages, session.number, currentAct).catch((err) =>
          console.error("[session/advance_act] Compression error:", err)
        );

        const act = await advanceAct();
        return NextResponse.json({ act });
      }
      if (action === "end_session") {
        // Compress final act before ending
        const currentAct = session.act;
        const currentMessages = [...messages];
        compressAct(currentMessages, session.number, currentAct).catch((err) =>
          console.error("[session/end_session] Compression error:", err)
        );

        await endSession();
        return NextResponse.json(session);
      }
      if (action === "next_session") {
        // Build recap from previous session's compression summaries
        const recap = await buildRecap(session.number + 1);

        await nextSession();

        // Broadcast recap as system message
        if (recap) {
          const recapMsg: Message = {
            id: nextMessageId(),
            channel: "all",
            sender: { role: "system", name: "The Ceremony" },
            content: recap,
            timestamp: Date.now(),
          };
          await addMessage(recapMsg);
        }

        return NextResponse.json(session);
      }
      if (action === "reset") {
        await resetSession();
        return NextResponse.json(session);
      }
      if (action === "kick") {
        const { playerId } = body;
        if (!playerId) {
          return NextResponse.json({ error: "playerId required" }, { status: 400 });
        }
        const success = await kickPlayer(playerId);
        if (!success) {
          return NextResponse.json({ error: "Player not found" }, { status: 404 });
        }
        return NextResponse.json({ ok: true });
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

      const oldLocation = session.scene.location;
      await updateScene(body.scene);

      // Write current scene to Level 1 memory
      const sceneContent = [
        `Location: ${session.scene.location}`,
        `Scene: ${session.scene.title}`,
        session.scene.description,
      ].filter(Boolean).join("\n");
      writeMemoryLevel(1, "current-scene", sceneContent).catch((err) =>
        console.error("[session/PATCH] Failed to write scene to memory:", err)
      );

      // If location changed, fire location_change event through trigger system
      const newLocation = body.scene.location ?? session.scene.location;
      if (newLocation && newLocation.toLowerCase() !== oldLocation.toLowerCase()) {
        const locationEvent: DetectedEvent = {
          type: "location_change",
          data: { from: oldLocation, to: newLocation },
        };

        const triggerConfig = await loadTriggerConfig();
        const triggered = matchTriggers([locationEvent], triggerConfig, sceneTriggerState);

        for (const action of triggered) {
          sceneTriggerState.lastFired[action.triggerId] = Date.now();

          // Fire-and-forget Keeper call for triggered actions
          (async () => {
            try {
              const keeperResponse = await queryKeeper({
                mode: action.mode,
                trigger: {
                  type: "session_event",
                  channel: "all",
                  content: `[Scene transition: ${oldLocation} → ${newLocation}] ${action.description || ""}`,
                },
                session: { number: session.number, act: session.act, status: session.status },
                players: session.players.map((p) => ({
                  name: p.name, characterName: p.characterName, journal: p.journal, notes: p.notes,
                })),
              });

              const msg: Message = {
                id: nextMessageId(),
                channel: "all",
                sender: { role: "keeper", name: "The Keeper" },
                content: keeperResponse.narrative,
                timestamp: Date.now(),
              };
              await addMessage(msg);
            } catch (err) {
              console.error("[session/PATCH] Scene trigger error:", err);
            }
          })();
        }
      }
    }

    // Notes: player can only update own notes (playerId from token)
    if (typeof body.notes === "string") {
      const playerId = (auth as AuthContext).playerId;
      if (playerId) {
        await updatePlayerNotes(playerId, body.notes);
      }
    }

    // Character pool claim (player picks a pre-written character)
    if (typeof body.characterClaim === "string") {
      const playerId = (auth as AuthContext).playerId;
      if (!playerId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const pool = await loadCharacterPool();
      const preset = pool.find((c) => c.id === body.characterClaim);
      if (!preset) {
        return NextResponse.json({ error: "Character not found in pool" }, { status: 404 });
      }
      const claimed = await claimCharacter(playerId, body.characterClaim, preset);
      if (!claimed) {
        return NextResponse.json({ error: "Character already claimed" }, { status: 409 });
      }
      return NextResponse.json(claimed);
    }

    // MC character pool claim
    if (typeof body.mcCharacterClaim === "string") {
      if (!requireRole(auth as AuthContext, "mc")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const pool = await loadCharacterPool();
      const preset = pool.find((c) => c.id === body.mcCharacterClaim);
      if (!preset) {
        return NextResponse.json({ error: "Character not found in pool" }, { status: 404 });
      }
      const success = await claimCharacterAsMC(body.mcCharacterClaim, preset);
      if (!success) {
        return NextResponse.json({ error: "Character already claimed" }, { status: 409 });
      }
      return NextResponse.json({ mcCharacterId: body.mcCharacterClaim, mcCharacterData: preset });
    }

    // Character updates (player saves their own fields)
    if (body.character && typeof body.character === "object") {
      const playerId = (auth as AuthContext).playerId;
      if (!playerId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const updated = await updateCharacter(playerId, body.character);
      if (!updated) {
        return NextResponse.json({ error: "Player not found" }, { status: 404 });
      }
      return NextResponse.json(updated);
    }

    // Character actions: submit (player), approve/revise (MC)
    if (body.characterAction) {
      if (body.characterAction === "submit") {
        const playerId = (auth as AuthContext).playerId;
        if (!playerId) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const updated = await submitCharacter(playerId);
        if (!updated) {
          return NextResponse.json({ error: "Player not found" }, { status: 404 });
        }
        return NextResponse.json(updated);
      }

      if (body.characterAction === "approve" || body.characterAction === "revise") {
        if (!requireRole(auth as AuthContext, "mc")) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        if (!body.playerId) {
          return NextResponse.json({ error: "playerId required" }, { status: 400 });
        }
        if (body.characterAction === "approve") {
          const updated = await approveCharacter(body.playerId);
          if (!updated) return NextResponse.json({ error: "Player not found" }, { status: 404 });
          return NextResponse.json(updated);
        }
        const updated = await reviseCharacter(body.playerId, body.revisionComment);
        if (!updated) return NextResponse.json({ error: "Player not found" }, { status: 404 });
        return NextResponse.json(updated);
      }
    }

    // Widget upsert (MC-only)
    if (body.widget && typeof body.widget === "object") {
      if (!requireRole(auth as AuthContext, "mc")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const w = body.widget;
      if (!w.id || !w.kind || !w.label || !w.target || !w.data) {
        return NextResponse.json({ error: "Widget requires id, kind, label, target, data" }, { status: 400 });
      }
      w.updatedAt = Date.now();
      await updateWidget(w);
      return NextResponse.json({ ok: true, widget: w });
    }

    // Widget remove (MC-only)
    if (typeof body.removeWidget === "string") {
      if (!requireRole(auth as AuthContext, "mc")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const removed = await removeWidget(body.removeWidget);
      if (!removed) {
        return NextResponse.json({ error: "Widget not found" }, { status: 404 });
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(session);
  } catch (err) {
    console.error("[session/PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
