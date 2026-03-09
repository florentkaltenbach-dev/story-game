"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Channel, Message, Player, Session, Scene } from "@/lib/types";
import { apiUrl } from "@/lib/api";
import { useEventStream } from "@/lib/useEventStream";
import SceneDisplay from "@/components/SceneDisplay";
import StoryLog from "@/components/StoryLog";
import MessageInput from "@/components/MessageInput";
import ChannelTabs from "@/components/ChannelTabs";
import CharacterPanel from "@/components/CharacterPanel";

function JoinForm({
  onJoin,
  session,
}: {
  onJoin: (name: string) => void;
  session: Session | null;
}) {
  const [name, setName] = useState("");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-surface/30 to-background" />

      <div className="relative z-10 bg-surface border border-border rounded-lg p-8 max-w-md w-full mx-4">
        {session && (
          <div className="text-center mb-6">
            <p className="text-[10px] tracking-[0.3em] uppercase text-muted/60 mb-1">
              Now gathering
            </p>
            <h2 className="narrative-text text-xl text-accent">
              {session.name}
            </h2>
            {session.players.length > 0 && (
              <p className="text-xs text-muted mt-2">
                {session.players.map((p) => p.name).join(", ")}{" "}
                {session.players.length === 1 ? "is" : "are"} here
              </p>
            )}
          </div>
        )}

        <div className="h-px bg-border mb-6" />

        <h3 className="narrative-text text-lg text-foreground/80 text-center mb-1">
          Take your place
        </h3>
        <p className="text-xs text-muted/60 text-center mb-5">
          Enter your name to join the ceremony
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) onJoin(name.trim());
          }}
        >
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoFocus
            className="w-full bg-surface-light border border-border rounded px-4 py-2.5 text-sm text-foreground placeholder:text-muted/40 focus:outline-none focus:border-accent/50 mb-4"
          />
          <button
            type="submit"
            disabled={!name.trim()}
            className="w-full py-2.5 bg-accent/20 text-accent border border-accent/30 rounded text-sm tracking-wide hover:bg-accent/30 transition-colors disabled:opacity-30"
          >
            Enter
          </button>
        </form>
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "active"
      ? "bg-keeper"
      : status === "paused"
        ? "bg-accent"
        : "bg-muted/50";
  return (
    <span className="relative flex h-2 w-2">
      {status === "active" && (
        <span className="absolute inline-flex h-full w-full rounded-full bg-keeper opacity-40 animate-ping" />
      )}
      <span className={`relative inline-flex rounded-full h-2 w-2 ${color}`} />
    </span>
  );
}

function NoInvite() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-surface/30 to-background" />
      <div className="relative z-10 bg-surface border border-border rounded-lg p-8 max-w-md w-full mx-4 text-center">
        <h2 className="narrative-text text-xl text-accent mb-3">
          The Ceremony
        </h2>
        <div className="h-px bg-border mb-4" />
        <p className="text-sm text-foreground/70 mb-1">
          This gathering is by invitation only.
        </p>
        <p className="text-xs text-muted/50">
          Ask your MC for a link to join.
        </p>
      </div>
    </div>
  );
}

function PlayPageInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("invite");

  const [reconnecting, setReconnecting] = useState(true);
  const [inviteValid, setInviteValid] = useState<boolean | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [channel, setChannel] = useState<Channel>("all");
  const [showPanel, setShowPanel] = useState(true);

  // Reconnect from localStorage on mount
  useEffect(() => {
    async function tryReconnect() {
      try {
        const saved = localStorage.getItem("ceremony_player");
        if (!saved) return;

        const { name, sessionId } = JSON.parse(saved);
        if (!name || !sessionId) return;

        const sessionRes = await fetch(apiUrl("/api/session"));
        const currentSession = await sessionRes.json();
        if (currentSession.id !== sessionId) {
          localStorage.removeItem("ceremony_player");
          return;
        }

        const res = await fetch(apiUrl("/api/session"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "reconnect", name }),
        });

        if (res.ok) {
          setPlayer(await res.json());
          setSession(currentSession);
        } else {
          localStorage.removeItem("ceremony_player");
        }
      } catch {
        localStorage.removeItem("ceremony_player");
      } finally {
        setReconnecting(false);
      }
    }
    tryReconnect();
  }, []);

  // Validate invite token after reconnect attempt
  useEffect(() => {
    if (reconnecting || player) return;
    if (!token) {
      setInviteValid(false);
      return;
    }
    fetch(apiUrl(`/api/invites?validate=${encodeURIComponent(token)}`))
      .then((res) => res.json())
      .then((data) => setInviteValid(data.valid))
      .catch(() => setInviteValid(false));
  }, [token, reconnecting, player]);

  const fetchSession = useCallback(async () => {
    const res = await fetch(apiUrl("/api/session"));
    setSession(await res.json());
  }, []);

  const fetchMessages = useCallback(async () => {
    if (!player) return;
    const params = new URLSearchParams({ channel });
    if (channel === "keeper-private") {
      params.set("playerId", player.id);
    }
    const res = await fetch(apiUrl(`/api/messages?${params}`));
    const data = await res.json();
    setMessages(data);
  }, [channel, player]);

  // Poll session only before joining (for join form display)
  useEffect(() => {
    fetchSession();
    if (player) return;
    const interval = setInterval(fetchSession, 3000);
    return () => clearInterval(interval);
  }, [fetchSession, player]);

  // Fetch messages on join and channel change (no polling — SSE handles updates)
  useEffect(() => {
    if (!player) return;
    fetchMessages();
  }, [player, fetchMessages]);

  // SSE for real-time updates after joining
  useEventStream({
    url: player ? apiUrl(`/api/events?role=player&playerId=${player.id}`) : apiUrl("/api/events"),
    enabled: !!player,
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
      const d = data as { status: Session["status"]; act?: number; number?: number };
      setSession((prev) => {
        if (!prev) return prev;
        if (typeof d.number === "number" && d.number !== prev.number) {
          setMessages([]);
        }
        return {
          ...prev,
          status: d.status,
          ...(typeof d.act === "number" ? { act: d.act } : {}),
          ...(typeof d.number === "number" ? { number: d.number } : {}),
        };
      });
    },
    onPlayerJoined: (data) => {
      const { player: p } = data as { player: Player };
      setSession((prev) => {
        if (!prev || prev.players.some((x) => x.id === p.id)) return prev;
        return { ...prev, players: [...prev.players, p] };
      });
    },
  });

  async function handleJoin(name: string) {
    const res = await fetch(apiUrl("/api/session"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "join", name, token }),
    });
    if (!res.ok) {
      setInviteValid(false);
      return;
    }
    const p = await res.json();
    setPlayer(p);
    localStorage.setItem(
      "ceremony_player",
      JSON.stringify({ name: p.name, playerId: p.id, sessionId: session?.id })
    );
  }

  async function handleSend(content: string) {
    if (!player) return;
    await fetch(apiUrl("/api/messages"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel,
        sender: { role: "player", name: player.name },
        content,
        playerId: player.id,
      }),
    });
  }

  if (reconnecting) return null; // attempting reconnect
  if (inviteValid === null && !player) return null; // validating invite
  if (!inviteValid && !player) return <NoInvite />;
  if (!player) return <JoinForm onJoin={handleJoin} session={session} />;

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface">
        <div className="flex items-center gap-3">
          <h1 className="narrative-text text-lg text-accent">The Ceremony</h1>
          <span className="text-xs text-muted/50">|</span>
          {session && (
            <span className="text-xs text-muted">{session.name}</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {/* Players online */}
          {session && session.players.length > 0 && (
            <div className="flex items-center gap-2">
              <StatusDot status={session.status} />
              <span className="text-[10px] text-muted/60">
                {session.players.map((p) => p.name).join(", ")}
              </span>
            </div>
          )}
          <span className="text-xs text-ice font-medium">{player.name}</span>
          <button
            onClick={() => setShowPanel(!showPanel)}
            className="text-xs text-muted hover:text-foreground transition-colors px-2 py-1 border border-border rounded"
          >
            {showPanel ? "Hide" : "Show"} Journal
          </button>
        </div>
      </div>

      {/* Scene */}
      {session?.scene && <SceneDisplay scene={session.scene} />}

      {/* Channel tabs */}
      <ChannelTabs
        channels={["all", "keeper-private"]}
        active={channel}
        onChange={setChannel}
      />

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Story log + input */}
        <div className="flex-1 flex flex-col min-w-0">
          <StoryLog messages={messages} />
          <MessageInput
            onSend={handleSend}
            placeholder={
              channel === "keeper-private"
                ? "Whisper to the Keeper..."
                : "What do you do?"
            }
          />
        </div>

        {/* Character panel */}
        {showPanel && (
          <div className="w-72 flex-shrink-0 hidden md:flex">
            <CharacterPanel player={player} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function PlayPage() {
  return (
    <Suspense>
      <PlayPageInner />
    </Suspense>
  );
}
