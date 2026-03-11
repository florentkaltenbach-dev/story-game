"use client";

import { useState, useEffect, useCallback } from "react";
import { Channel, Message, Session, Player, Invite, GameWidget } from "@/lib/types";
import { apiUrl, authHeaders, authQueryParam, getStoredToken, setStoredToken, clearStoredToken, authFetch } from "@/lib/api";
import { useEventStream } from "@/lib/useEventStream";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import SceneDisplay from "@/components/SceneDisplay";
import StoryLog from "@/components/StoryLog";
import MessageInput from "@/components/MessageInput";
import ChannelTabs from "@/components/ChannelTabs";
import MCHeader from "@/components/mc/MCHeader";
import KeeperPanel from "@/components/mc/KeeperPanel";
import PanelShelf from "@/components/mc/PanelShelf";
import ConfirmModal from "@/components/mc/ConfirmModal";
import type { Scene } from "@/lib/types";
import { parseCommand } from "@/lib/mc-commands";
import type { NpcEntry } from "@/components/mc/panels/NpcPanel";

type MCMode = "narrate" | "keeper";

interface MemoryLevelSummary {
  fileCount: number;
  files: string[];
}

function MCLogin({ onAuth }: { onAuth: () => void }) {
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/auth"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mc_auth", secret }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Authentication failed");
        return;
      }
      const { token } = await res.json();
      setStoredToken(token);
      onAuth();
    } catch {
      setError("Failed to authenticate. Check your MC secret and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-surface/30 to-background" />
      <div className="relative z-10 bg-surface border border-border rounded-lg p-8 max-w-md w-full mx-4">
        <h2 className="narrative-text text-xl text-accent text-center mb-1">
          The Ceremony
        </h2>
        <p className="text-xs text-muted/80 text-center mb-6">
          Master of Ceremonies login
        </p>
        <div className="h-px bg-border mb-6" />
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="MC Secret"
            autoFocus
            className="w-full bg-surface-light border border-border rounded px-4 py-2.5 text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:border-accent/50 mb-4"
          />
          {error && (
            <p className="text-xs text-[var(--danger)] mb-3">{error}</p>
          )}
          <button
            type="submit"
            disabled={!secret || loading}
            className="w-full py-2.5 bg-accent/20 text-accent border border-accent/30 rounded text-sm tracking-wide hover:bg-accent/30 transition-colors disabled:opacity-50"
          >
            {loading ? "Authenticating..." : "Enter"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function MCDashboard() {
  const breakpoint = useBreakpoint();
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [channel, setChannel] = useState<Channel>("all");
  const [mode, setMode] = useState<MCMode>("narrate");
  const [keeperResponse, setKeeperResponse] = useState<{
    narrative: string;
    journalUpdate: string | null;
    internalNotes: string | null;
    degraded: boolean;
  } | null>(null);
  const [memoryLevels, setMemoryLevels] = useState<Record<number, MemoryLevelSummary> | null>(null);
  const [inviteList, setInviteList] = useState<Invite[]>([]);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [expandedCharacter, setExpandedCharacter] = useState<string | null>(null);
  const [mcWidgets, setMcWidgets] = useState<GameWidget[]>([]);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmLoadPreset, setConfirmLoadPreset] = useState(false);
  const [kickTarget, setKickTarget] = useState<{ id: string; name: string } | null>(null);
  const [memoryFileContents, setMemoryFileContents] = useState<Record<number, Record<string, string>>>({});
  const [cost, setCost] = useState<{ totalCalls: number; totalInput: number; totalOutput: number; totalCacheRead: number; totalCostUsd: number } | null>(null);
  const [npcs, setNpcs] = useState<NpcEntry[]>([]);

  // Check existing token on mount
  useEffect(() => {
    const token = getStoredToken();
    if (token) {
      fetch(apiUrl("/api/invites"), { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => {
          if (res.ok) setAuthenticated(true);
          else clearStoredToken();
        })
        .catch(() => clearStoredToken())
        .finally(() => setChecking(false));
    } else {
      setChecking(false);
    }
  }, []);

  const fetchInvites = useCallback(async () => {
    try {
      const res = await authFetch("/api/invites");
      if (res.ok) setInviteList(await res.json());
    } catch { /* non-critical */ }
  }, []);

  async function handleGenerateInvite() {
    const res = await authFetch("/api/invites", { method: "POST" });
    if (res.ok) fetchInvites();
  }

  function fallbackCopy(text: string) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }

  function copyInviteUrl(token: string) {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    const url = `${window.location.origin}${basePath}/play?invite=${token}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).catch(() => fallbackCopy(url));
    } else {
      fallbackCopy(url);
    }
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  }

  const fetchSession = useCallback(async () => {
    const res = await authFetch("/api/session");
    const data = await res.json();
    setSession(data);
    if (Array.isArray(data.widgets)) {
      setMcWidgets(data.widgets);
    }
  }, []);

  const fetchMessages = useCallback(async () => {
    const params = new URLSearchParams({ channel });
    const res = await authFetch(`/api/messages?${params}`);
    if (res.ok) setMessages(await res.json());
  }, [channel]);

  useEffect(() => {
    if (!authenticated) return;
    fetchSession();
    fetchInvites();
  }, [fetchSession, fetchInvites, authenticated]);

  useEffect(() => {
    if (!authenticated) return;
    fetchMessages();
  }, [fetchMessages, authenticated]);

  // SSE for real-time updates
  const sseTokenParam = authQueryParam();
  useEventStream({
    url: apiUrl(`/api/events?${sseTokenParam}`),
    enabled: authenticated && !!sseTokenParam,
    onMessage: (data) => {
      const msg = data as Message;
      if (channel !== "all" && msg.channel !== channel) return;
      setMessages((prev) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
      );
    },
    onScene: (data) => {
      setSession((prev) =>
        prev ? { ...prev, scene: data as Scene } : prev
      );
    },
    onSession: (data) => {
      const d = data as { status: Session["status"]; keeperAutoRespond?: boolean; act?: number; number?: number };
      setSession((prev) => {
        if (!prev) return prev;
        const updates: Partial<Session> = { status: d.status };
        if (typeof d.keeperAutoRespond === "boolean") updates.keeperAutoRespond = d.keeperAutoRespond;
        if (typeof d.act === "number") updates.act = d.act;
        if (typeof d.number === "number") {
          updates.number = d.number;
          if (d.number !== prev.number) setMessages([]);
        }
        return { ...prev, ...updates };
      });
    },
    onPlayerJoined: (data) => {
      const { player: p } = data as { player: Player };
      setSession((prev) => {
        if (!prev || prev.players.some((x) => x.id === p.id)) return prev;
        return { ...prev, players: [...prev.players, p] };
      });
      fetchInvites();
    },
    onCharacterUpdate: (data) => {
      const { playerId, character: charData } = data as { playerId: string; status: string; character: Player["character"] };
      setSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          players: prev.players.map((p) =>
            p.id === playerId ? { ...p, character: charData } : p
          ),
        };
      });
    },
    onPlayerKicked: (data) => {
      const { playerId } = data as { playerId: string; name: string };
      setSession((prev) => {
        if (!prev) return prev;
        return { ...prev, players: prev.players.filter((p) => p.id !== playerId) };
      });
    },
    onWidgetUpdate: (data) => {
      const widget = data as GameWidget;
      setMcWidgets((prev) => {
        const idx = prev.findIndex((w) => w.id === widget.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = widget;
          return next;
        }
        return [...prev, widget];
      });
    },
    onWidgetRemove: (data) => {
      const { widgetId } = data as { widgetId: string };
      setMcWidgets((prev) => prev.filter((w) => w.id !== widgetId));
    },
    onKeeperResponse: (data) => {
      const resp = data as { narrative: string; internalNotes?: string; playerId?: string; channel?: string };
      if (resp.internalNotes) {
        setKeeperResponse({
          narrative: resp.narrative,
          journalUpdate: null,
          internalNotes: resp.internalNotes,
          degraded: false,
        });
      }
    },
  });

  const fetchMemory = useCallback(async () => {
    try {
      const res = await authFetch("/api/memory");
      if (res.ok) setMemoryLevels(await res.json());
    } catch { /* non-critical */ }
  }, []);

  const fetchMemoryLevel = useCallback(async (level: number) => {
    try {
      const res = await authFetch(`/api/memory?level=${level}`);
      if (res.ok) {
        const data = await res.json();
        setMemoryFileContents((prev) => ({ ...prev, [level]: data.files }));
      }
    } catch { /* non-critical */ }
  }, []);

  const fetchCost = useCallback(async () => {
    try {
      const res = await authFetch("/api/keeper/cost");
      if (res.ok) setCost(await res.json());
    } catch { /* non-critical */ }
  }, []);

  const fetchNpcs = useCallback(async () => {
    try {
      // Merge NPCs from config (characters.json npcs) and Level 2 memory
      const memRes = await authFetch("/api/memory?level=2");
      if (!memRes.ok) return;
      const memData = await memRes.json() as { files: Record<string, string> };

      const npcEntries: NpcEntry[] = [];
      const seenKeys = new Set<string>();

      // Parse NPC files from Level 2 memory (keys that look like NPC slugs, not journal/knowledge)
      for (const [key, raw] of Object.entries(memData.files)) {
        if (key.startsWith("journal-") || key.startsWith("knowledge-")) continue;
        try {
          const data = JSON.parse(raw);
          if (!data.name) continue;
          seenKeys.add(key);
          npcEntries.push({
            key,
            name: data.name,
            role: data.role || "Unknown",
            description: data.description || "",
            agenda: data.agenda,
            voicedBy: data.voicedBy || "keeper",
            status: data.status || "mentioned",
            source: "memory",
          });
        } catch { /* skip non-JSON files */ }
      }

      setNpcs(npcEntries);
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    fetchMemory();
    fetchCost();
    fetchNpcs();
    const memInterval = setInterval(fetchMemory, 10000);
    const costInterval = setInterval(fetchCost, 15000);
    return () => { clearInterval(memInterval); clearInterval(costInterval); };
  }, [fetchMemory, fetchCost, fetchNpcs, authenticated]);

  async function handleSend(content: string) {
    if (mode === "narrate") {
      await authFetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          channel: "all",
          sender: { name: "The Narrator" },
          content,
        }),
      });
    } else {
      // Parse for backstage commands (/generate, /reveal, /hint, /npc)
      const cmd = parseCommand(content);
      const body = cmd
        ? { query: cmd.content, mode: cmd.mode, npcName: cmd.npcName }
        : { query: content };

      const res = await authFetch("/api/keeper", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setKeeperResponse({
        narrative: data.narrative,
        journalUpdate: data.journalUpdate ?? null,
        internalNotes: data.internalNotes ?? null,
        degraded: data.degraded ?? false,
      });
      // Refresh cost after keeper call
      fetchCost();
    }
  }

  async function handleCharacterAction(playerId: string, action: "approve" | "revise", comment?: string) {
    await authFetch("/api/session", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ playerId, characterAction: action, revisionComment: comment }),
    });
    fetchSession();
  }

  async function handleSessionAction(action: string) {
    await authFetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ action }),
    });
    fetchSession();
  }

  async function handleReset() {
    await authFetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ action: "reset" }),
    });
    setConfirmReset(false);
    setMessages([]);
    fetchSession();
    fetchMessages();
    fetchInvites();
  }

  async function handleLoadPreset() {
    const res = await authFetch("/api/presets");
    if (!res.ok) return;
    const data = await res.json();
    const defaultPreset = data.default ?? data.presets?.[0]?.id;
    if (!defaultPreset) return;

    await authFetch("/api/presets", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ presetId: defaultPreset }),
    });
    setConfirmLoadPreset(false);
    setMessages([]);
    fetchSession();
    fetchMessages();
    fetchInvites();
    fetchMemory();
  }

  async function handleKick(playerId: string) {
    await authFetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ action: "kick", playerId }),
    });
    setKickTarget(null);
    fetchSession();
  }

  async function handleSaveNpc(npc: NpcEntry) {
    const npcData = {
      name: npc.name,
      role: npc.role,
      description: npc.description,
      agenda: npc.agenda,
      voicedBy: npc.voicedBy,
      status: npc.status,
    };
    await authFetch("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ level: 2, key: npc.key, value: JSON.stringify(npcData, null, 2), override: true }),
    });
    fetchNpcs();
  }

  async function handleCreateNpc(npc: Omit<NpcEntry, "source">) {
    const npcData = {
      name: npc.name,
      role: npc.role,
      description: npc.description,
      agenda: npc.agenda,
      voicedBy: npc.voicedBy,
      status: npc.status,
      firstMentionedIn: "mc-created",
    };
    await authFetch("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ level: 2, key: npc.key, value: JSON.stringify(npcData, null, 2), override: true }),
    });
    fetchNpcs();
  }

  async function handlePushWidget(widget: GameWidget) {
    await authFetch("/api/session", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ widget }),
    });
  }

  async function handleRemoveWidget(widgetId: string) {
    await authFetch("/api/session", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ removeWidget: widgetId }),
    });
  }

  async function handleSceneUpdate(scene: Partial<Scene>) {
    await authFetch("/api/session", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ scene }),
    });
    fetchSession();
  }

  function handleLogout() {
    clearStoredToken();
    setAuthenticated(false);
  }

  if (checking) return null;
  if (!authenticated) return <MCLogin onAuth={() => setAuthenticated(true)} />;

  const isNarrow = breakpoint === "narrow";
  const isWide = breakpoint === "wide";

  return (
    <div className={`h-screen flex flex-col ${isNarrow ? "pb-12" : ""}`}>
      {/* Confirmation modals */}
      {confirmReset && (
        <ConfirmModal
          title="Reset Game"
          message={
            <p>
              This will clear all players, messages, and invitations.
              The session returns to lobby. This cannot be undone.
            </p>
          }
          confirmLabel="Reset Everything"
          onConfirm={handleReset}
          onCancel={() => setConfirmReset(false)}
          danger
        />
      )}

      {confirmLoadPreset && (
        <ConfirmModal
          title="Load Preset"
          message={
            <p>
              This will reload all config, memory, and session data from the preset.
              All current players, messages, and game state will be cleared.
            </p>
          }
          confirmLabel="Load Preset"
          onConfirm={handleLoadPreset}
          onCancel={() => setConfirmLoadPreset(false)}
          danger
        />
      )}

      {kickTarget && (
        <ConfirmModal
          title="Remove Player"
          message={
            <p>
              Remove <span className="text-foreground">{kickTarget.name}</span> from the session?
              They will need a new invitation to rejoin.
            </p>
          }
          confirmLabel="Remove"
          onConfirm={() => handleKick(kickTarget.id)}
          onCancel={() => setKickTarget(null)}
          danger
        />
      )}

      {/* Header */}
      <MCHeader
        session={session}
        breakpoint={breakpoint}
        onSessionAction={handleSessionAction}
        onReset={() => setConfirmReset(true)}
        onLoadPreset={() => setConfirmLoadPreset(true)}
        onLogout={handleLogout}
      />

      {/* Scene */}
      {session?.scene && (
        <SceneDisplay
          scene={session.scene}
          editable
          onUpdate={handleSceneUpdate}
        />
      )}

      {/* Channel tabs */}
      <ChannelTabs
        channels={["all", "keeper-private", "mc-keeper"]}
        active={channel}
        onChange={setChannel}
      />

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Story log + keeper + input */}
        <div className="flex-1 flex flex-col min-w-0">
          <StoryLog messages={messages} />

          <KeeperPanel
            response={keeperResponse}
            onDismiss={() => setKeeperResponse(null)}
          />

          {/* Mode toggle + input */}
          <div className="border-t border-border bg-surface">
            <div className="flex gap-1 px-3 pt-2">
              <button
                onClick={() => setMode("narrate")}
                className={`px-3 py-1 text-xs rounded-t transition-colors ${
                  mode === "narrate"
                    ? "bg-accent/15 text-accent border border-b-0 border-accent/30"
                    : "text-muted hover:text-foreground"
                }`}
              >
                Narrate
              </button>
              <button
                onClick={() => setMode("keeper")}
                className={`px-3 py-1 text-xs rounded-t transition-colors ${
                  mode === "keeper"
                    ? "bg-keeper/15 text-keeper border border-b-0 border-keeper/30"
                    : "text-muted hover:text-foreground"
                }`}
              >
                Query Keeper
              </button>
            </div>
          </div>
          <MessageInput
            onSend={handleSend}
            placeholder={
              mode === "narrate"
                ? "Narrate to all players..."
                : "Ask the Keeper..."
            }
          />

          {/* Drawer mode: panels below input */}
          {breakpoint === "medium" && (
            <PanelShelf
              mode={breakpoint}
              session={session}
              invites={inviteList}
              copiedToken={copiedToken}
              memoryLevels={memoryLevels}
              npcs={npcs}
              onSaveNpc={handleSaveNpc}
              onCreateNpc={handleCreateNpc}
              expandedCharacter={expandedCharacter}
              onExpandCharacter={setExpandedCharacter}
              onCharacterAction={handleCharacterAction}
              onKick={setKickTarget}
              onGenerateInvite={handleGenerateInvite}
              onCopyInvite={copyInviteUrl}
              widgets={mcWidgets}
              onPushWidget={handlePushWidget}
              onRemoveWidget={handleRemoveWidget}
            />
          )}
        </div>

        {/* Wide: sidebar panels */}
        {isWide && (
          <PanelShelf
            mode={breakpoint}
            session={session}
            invites={inviteList}
            copiedToken={copiedToken}
            memoryLevels={memoryLevels}
            memoryFileContents={memoryFileContents}
            onFetchMemoryLevel={fetchMemoryLevel}
            cost={cost}
            npcs={npcs}
            onSaveNpc={handleSaveNpc}
            onCreateNpc={handleCreateNpc}
            expandedCharacter={expandedCharacter}
            onExpandCharacter={setExpandedCharacter}
            onCharacterAction={handleCharacterAction}
            onKick={setKickTarget}
            onGenerateInvite={handleGenerateInvite}
            onCopyInvite={copyInviteUrl}
            widgets={mcWidgets}
            onPushWidget={handlePushWidget}
            onRemoveWidget={handleRemoveWidget}
          />
        )}
      </div>

      {/* Narrow: fixed bottom toolbar */}
      {isNarrow && (
        <PanelShelf
          mode={breakpoint}
          session={session}
          invites={inviteList}
          copiedToken={copiedToken}
          memoryLevels={memoryLevels}
          npcs={npcs}
          onSaveNpc={handleSaveNpc}
          onCreateNpc={handleCreateNpc}
          expandedCharacter={expandedCharacter}
          onExpandCharacter={setExpandedCharacter}
          onCharacterAction={handleCharacterAction}
          onKick={setKickTarget}
          onGenerateInvite={handleGenerateInvite}
          onCopyInvite={copyInviteUrl}
          widgets={mcWidgets}
          onPushWidget={handlePushWidget}
          onRemoveWidget={handleRemoveWidget}
        />
      )}
    </div>
  );
}
