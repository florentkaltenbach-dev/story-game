"use client";

import { useState, useEffect, useCallback } from "react";
import { Channel, Message, Session, Player, Invite } from "@/lib/types";
import { apiUrl } from "@/lib/api";
import { useEventStream } from "@/lib/useEventStream";
import SceneDisplay from "@/components/SceneDisplay";
import StoryLog from "@/components/StoryLog";
import MessageInput from "@/components/MessageInput";
import ChannelTabs from "@/components/ChannelTabs";
import type { Scene } from "@/lib/types";

type MCMode = "narrate" | "keeper";

interface MemoryLevelSummary {
  fileCount: number;
  files: string[];
}

export default function MCDashboard() {
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

  const fetchInvites = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/invites"));
      setInviteList(await res.json());
    } catch { /* non-critical */ }
  }, []);

  async function handleGenerateInvite() {
    const res = await fetch(apiUrl("/api/invites"), { method: "POST" });
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
    const res = await fetch(apiUrl("/api/session"));
    setSession(await res.json());
  }, []);

  const fetchMessages = useCallback(async () => {
    const params = new URLSearchParams({ channel });
    const res = await fetch(apiUrl(`/api/messages?${params}`));
    setMessages(await res.json());
  }, [channel]);

  // Initial fetch (no polling — SSE handles real-time updates)
  useEffect(() => {
    fetchSession();
    fetchInvites();
  }, [fetchSession, fetchInvites]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // SSE for real-time updates
  useEventStream({
    url: apiUrl("/api/events?role=mc"),
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
  });

  const fetchMemory = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/memory"));
      setMemoryLevels(await res.json());
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => {
    fetchMemory();
    const interval = setInterval(fetchMemory, 10000);
    return () => clearInterval(interval);
  }, [fetchMemory]);

  async function handleSend(content: string) {
    if (mode === "narrate") {
      await fetch(apiUrl("/api/messages"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "all",
          sender: { role: "mc", name: "The Narrator" },
          content,
        }),
      });
    } else {
      const res = await fetch(apiUrl("/api/keeper"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: content }),
      });
      const data = await res.json();
      setKeeperResponse({
        narrative: data.narrative,
        journalUpdate: data.journalUpdate ?? null,
        internalNotes: data.internalNotes ?? null,
        degraded: data.degraded ?? false,
      });
    }
  }

  async function handleSessionAction(action: string) {
    await fetch(apiUrl("/api/session"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    fetchSession();
  }

  async function handleSceneUpdate(scene: Partial<Scene>) {
    await fetch(apiUrl("/api/session"), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scene }),
    });
    fetchSession();
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface">
        <div className="flex items-center gap-3">
          <h1 className="narrative-text text-lg text-accent">The Ceremony</h1>
          <span className="text-[10px] tracking-widest uppercase text-muted bg-surface-light px-2 py-0.5 rounded border border-border">
            MC
          </span>
        </div>
        <div className="flex items-center gap-3">
          {session && (
            <div className="flex items-center gap-2 mr-2">
              <span className="text-[10px] font-mono text-accent/70 bg-accent/10 px-1.5 py-0.5 rounded border border-accent/20">
                S{session.number} Act {session.act}/4
              </span>
              <span className="text-xs text-muted/40">|</span>
              <span className="relative flex h-2 w-2">
                {session.status === "active" && (
                  <span className="absolute inline-flex h-full w-full rounded-full bg-keeper opacity-40 animate-ping" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    session.status === "active"
                      ? "bg-keeper"
                      : session.status === "paused"
                        ? "bg-accent"
                        : "bg-muted/50"
                  }`}
                />
              </span>
              <span className="text-xs text-muted">{session.status}</span>
              <span className="text-xs text-muted/40">|</span>
              <span className="text-xs text-muted">
                {session.players.length} player
                {session.players.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
          <button
            onClick={() => handleSessionAction("start")}
            disabled={session?.status === "active"}
            className="text-xs px-3 py-1 bg-keeper/20 text-keeper border border-keeper/30 rounded hover:bg-keeper/30 transition-colors disabled:opacity-30"
          >
            Start
          </button>
          <button
            onClick={() => handleSessionAction("pause")}
            className="text-xs px-3 py-1 bg-surface-light text-muted border border-border rounded hover:text-foreground transition-colors"
          >
            {session?.status === "paused" ? "Resume" : "Pause"}
          </button>
          <button
            onClick={() => handleSessionAction("toggle_keeper")}
            className={`text-xs px-3 py-1 rounded border transition-colors ${
              session?.keeperAutoRespond
                ? "bg-keeper/20 text-keeper border-keeper/30 shadow-[0_0_6px_rgba(var(--keeper-rgb),0.3)]"
                : "bg-surface-light text-muted/50 border-border hover:text-muted"
            }`}
          >
            {session?.keeperAutoRespond ? "Keeper Active" : "Keeper Silent"}
          </button>
          {(session?.status === "active" || session?.status === "paused") && (
            <>
              <span className="text-xs text-muted/20">|</span>
              <button
                onClick={() => handleSessionAction("advance_act")}
                disabled={session.act >= 4}
                className="text-xs px-3 py-1 bg-accent/15 text-accent border border-accent/30 rounded hover:bg-accent/25 transition-colors disabled:opacity-30"
              >
                Next Act
              </button>
              <button
                onClick={() => handleSessionAction("end_session")}
                className="text-xs px-3 py-1 bg-red-500/15 text-red-400 border border-red-500/30 rounded hover:bg-red-500/25 transition-colors"
              >
                End Session
              </button>
            </>
          )}
          {session?.status === "ended" && session.number < 4 && (
            <>
              <span className="text-xs text-muted/20">|</span>
              <button
                onClick={() => handleSessionAction("next_session")}
                className="text-xs px-3 py-1 bg-keeper/20 text-keeper border border-keeper/30 rounded hover:bg-keeper/30 transition-colors"
              >
                Next Session
              </button>
            </>
          )}
        </div>
      </div>

      {/* Scene — editable for MC */}
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
        {/* Story log + input */}
        <div className="flex-1 flex flex-col min-w-0">
          <StoryLog messages={messages} />

          {/* Keeper response panel */}
          {keeperResponse && (
            <div className="mx-3 mb-2 p-3 bg-keeper/[0.06] border border-keeper/20 rounded">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] tracking-widest uppercase text-keeper/80">
                  Keeper Response
                  {keeperResponse.degraded && (
                    <span className="ml-2 text-accent/60">(degraded)</span>
                  )}
                </span>
                <button
                  onClick={() => setKeeperResponse(null)}
                  className="text-[10px] text-muted/50 hover:text-foreground transition-colors"
                >
                  dismiss
                </button>
              </div>
              <p className="narrative-text text-sm text-foreground/80 italic leading-relaxed">
                {keeperResponse.narrative}
              </p>
              {keeperResponse.journalUpdate && (
                <div className="mt-2 pt-2 border-t border-keeper/10">
                  <span className="text-[10px] tracking-widest uppercase text-accent/60">
                    Journal Update
                  </span>
                  <p className="narrative-text text-xs text-accent/80 italic mt-0.5">
                    {keeperResponse.journalUpdate}
                  </p>
                </div>
              )}
              {keeperResponse.internalNotes && (
                <div className="mt-2 pt-2 border-t border-keeper/10">
                  <span className="text-[10px] tracking-widest uppercase text-muted/40">
                    Internal Notes
                  </span>
                  <p className="text-xs text-muted/50 italic mt-0.5">
                    {keeperResponse.internalNotes}
                  </p>
                </div>
              )}
            </div>
          )}

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
        </div>

        {/* Sidebar: session state */}
        <div className="w-72 flex-shrink-0 hidden lg:flex flex-col border-l border-border bg-surface overflow-y-auto">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-xs font-semibold text-muted tracking-wide uppercase mb-2">
              Session
            </h3>
            {session && (
              <div className="space-y-1">
                <p className="text-xs text-foreground/70">{session.name}</p>
                <p className="text-[10px] text-muted/50">
                  Preset: {session.preset}
                </p>
              </div>
            )}
          </div>

          <div className="px-4 py-3 border-b border-border">
            <h4 className="text-xs font-semibold text-muted tracking-wide uppercase mb-3">
              Players
            </h4>
            {session?.players.length === 0 ? (
              <p className="text-xs text-muted/40 italic">
                Waiting for players to join...
              </p>
            ) : (
              <ul className="space-y-2">
                {session?.players.map((p) => (
                  <li key={p.id} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-keeper flex-shrink-0" />
                    <span className="text-xs text-foreground/80">{p.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-muted tracking-wide uppercase">
                Invitations
              </h4>
              <button
                onClick={handleGenerateInvite}
                className="text-[10px] px-2 py-0.5 bg-accent/15 text-accent border border-accent/30 rounded hover:bg-accent/25 transition-colors"
              >
                Generate
              </button>
            </div>
            {inviteList.length === 0 ? (
              <p className="text-xs text-muted/40 italic">
                No invitations yet
              </p>
            ) : (
              <ul className="space-y-1.5">
                {inviteList.map((inv) => (
                  <li key={inv.token} className="flex items-center gap-2">
                    <span
                      className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                        inv.status === "new"
                          ? "bg-accent"
                          : inv.status === "used"
                            ? "bg-keeper"
                            : "bg-red-400"
                      }`}
                    />
                    <span className="text-[10px] text-muted/60 font-mono truncate flex-1">
                      {inv.token.slice(0, 8)}
                    </span>
                    {inv.status === "new" ? (
                      <button
                        onClick={() => copyInviteUrl(inv.token)}
                        className="text-[10px] text-accent/70 hover:text-accent transition-colors flex-shrink-0"
                      >
                        {copiedToken === inv.token ? "copied" : "copy"}
                      </button>
                    ) : (
                      <span className="text-[10px] text-muted/40 flex-shrink-0">
                        {inv.status === "used" ? inv.usedBy ?? "used" : inv.status}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="px-4 py-3">
            <h4 className="text-xs font-semibold text-muted tracking-wide uppercase mb-3">
              Memory Levels
            </h4>
            <ul className="space-y-2.5 text-xs">
              {[
                "Plot State",
                "Character State",
                "Narrative Threads",
                "Thematic Layer",
                "World State",
              ].map((level, i) => {
                const levelNum = i + 1;
                const data = memoryLevels?.[levelNum];
                const hasFiles = data && data.fileCount > 0;
                return (
                  <li key={i}>
                    <div className="flex items-center gap-2.5">
                      <span className="text-accent/60 font-mono text-[10px] w-3 text-right">
                        {levelNum}
                      </span>
                      <span className={hasFiles ? "text-foreground/70" : "text-muted/50"}>
                        {level}
                      </span>
                      {hasFiles && (
                        <span className="text-[10px] text-keeper/60 ml-auto">
                          {data.fileCount} file{data.fileCount !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    {hasFiles && (
                      <div className="ml-[22px] mt-1 space-y-0.5">
                        {data.files.map((f) => (
                          <p key={f} className="text-[10px] text-muted/40 truncate">
                            {f}
                          </p>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {!memoryLevels && (
              <p className="text-[10px] text-muted/30 italic mt-3">
                Loading...
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
