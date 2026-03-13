"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Channel, Message, Player, Session, Scene, CharacterSheet, GameWidget, GroupChannel, PresetCharacter } from "@/lib/types";
import { apiUrl, authHeaders, authQueryParam, getStoredToken, setStoredToken, clearStoredToken, authFetch } from "@/lib/api";
import { useEventStream } from "@/lib/useEventStream";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import SceneDisplay from "@/components/SceneDisplay";
import StoryLog from "@/components/StoryLog";
import MessageInput from "@/components/MessageInput";
import ChannelTabs from "@/components/ChannelTabs";
import PlayerPanelShelf from "@/components/PlayerPanelShelf";
import OnboardingWizard from "@/components/OnboardingWizard";
import { CornerFrame, Flourish, MeanderStrip } from "@/components/Ornaments";

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

      <CornerFrame className="relative z-10 bg-surface border border-border rounded-lg p-8 max-w-md w-full mx-4">
        {session && (
          <div className="text-center mb-6">
            <p className="text-xs tracking-[0.3em] uppercase text-muted/80 mb-1">
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

        <Flourish size="sm" className="mb-6" />

        <h3 className="narrative-text text-lg text-foreground/90 text-center mb-1">
          Take your place
        </h3>
        <p className="text-xs text-muted/80 text-center mb-5">
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
            className="w-full bg-surface-light border border-border rounded px-4 py-2.5 text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:border-accent/50 mb-4"
          />
          <button
            type="submit"
            disabled={!name.trim()}
            className="w-full py-2.5 bg-accent/20 text-accent border border-accent/30 rounded text-sm tracking-wide hover:bg-accent/30 transition-colors disabled:opacity-50"
          >
            Enter
          </button>
        </form>
      </CornerFrame>
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
      <CornerFrame className="relative z-10 bg-surface border border-border rounded-lg p-8 max-w-md w-full mx-4 text-center">
        <h2 className="narrative-text text-xl text-accent mb-3">
          The Ceremony
        </h2>
        <Flourish size="sm" className="mb-4" />
        <p className="text-sm text-foreground/85 mb-1">
          This gathering is by invitation only.
        </p>
        <p className="text-xs text-muted/70">
          Ask your MC for a link to join.
        </p>
      </CornerFrame>
    </div>
  );
}

function CreateGroupDialog({
  players,
  onCreate,
  onCancel,
}: {
  players: Player[];
  onCreate: (name: string, memberIds: string[]) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 bg-surface border border-border rounded-lg p-5 max-w-sm mx-auto">
        <h3 className="text-sm text-foreground font-medium mb-3">Create Group Channel</h3>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Channel name"
          autoFocus
          className="w-full bg-surface-light border border-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:outline-none focus:border-accent/50 mb-3"
        />
        {players.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-muted/70 mb-1.5">Invite players:</p>
            <div className="space-y-1">
              {players.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-xs text-foreground/80 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.has(p.id)}
                    onChange={() => toggle(p.id)}
                    className="rounded"
                  />
                  {p.name}
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => onCreate(name.trim(), Array.from(selected))}
            disabled={!name.trim()}
            className="flex-1 py-2 bg-accent/20 text-accent border border-accent/30 rounded text-xs hover:bg-accent/30 transition-colors disabled:opacity-50"
          >
            Create
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs text-muted hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}

function PlayPageInner() {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const breakpoint = useBreakpoint();

  const [reconnecting, setReconnecting] = useState(true);
  const [inviteValid, setInviteValid] = useState<boolean | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [channel, setChannel] = useState<Channel>("all");
  const [widgets, setWidgets] = useState<GameWidget[]>([]);
  const [myGroupChannels, setMyGroupChannels] = useState<GroupChannel[]>([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const [characterPool, setCharacterPool] = useState<PresetCharacter[]>([]);
  const [claimedCharacterIds, setClaimedCharacterIds] = useState<string[]>([]);

  // Reconnect from localStorage on mount
  useEffect(() => {
    async function tryReconnect() {
      try {
        const saved = localStorage.getItem("ceremony_player");
        const storedToken = getStoredToken();
        if (!saved || !storedToken) return;

        const { name, sessionId } = JSON.parse(saved);
        if (!name || !sessionId) return;

        const sessionRes = await authFetch("/api/session");
        const currentSession = await sessionRes.json();
        if (currentSession.id !== sessionId) {
          localStorage.removeItem("ceremony_player");
          clearStoredToken();
          return;
        }

        const res = await authFetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ action: "reconnect", name }),
        });

        if (res.ok) {
          const data = await res.json();
          // Server re-issues token on reconnect
          if (data.token) setStoredToken(data.token);
          setPlayer(data);
          setSession(currentSession);
          if (Array.isArray(currentSession.widgets)) {
            setWidgets(currentSession.widgets);
          }
          if (Array.isArray(currentSession.characterPool)) {
            setCharacterPool(currentSession.characterPool);
          }
          if (Array.isArray(currentSession.characterClaims)) {
            setClaimedCharacterIds(currentSession.characterClaims);
          }
        } else {
          localStorage.removeItem("ceremony_player");
          clearStoredToken();
        }
      } catch {
        localStorage.removeItem("ceremony_player");
        clearStoredToken();
      } finally {
        setReconnecting(false);
      }
    }
    tryReconnect();
  }, []);

  // Validate invite token after reconnect attempt
  useEffect(() => {
    if (reconnecting || player) return;
    if (!inviteToken) {
      setInviteValid(false);
      return;
    }
    fetch(apiUrl(`/api/invites?validate=${encodeURIComponent(inviteToken)}`))
      .then((res) => res.json())
      .then((data) => setInviteValid(data.valid))
      .catch(() => setInviteValid(false));
  }, [inviteToken, reconnecting, player]);

  const fetchSession = useCallback(async () => {
    const res = await authFetch("/api/session");
    const data = await res.json();
    setSession(data);
    if (Array.isArray(data.widgets)) {
      setWidgets(data.widgets);
    }
    if (Array.isArray(data.characterPool)) {
      setCharacterPool(data.characterPool);
    }
    if (Array.isArray(data.characterClaims)) {
      setClaimedCharacterIds(data.characterClaims);
    }
  }, []);

  const fetchMessages = useCallback(async () => {
    if (!player) return;
    const params = new URLSearchParams({ channel });
    const res = await authFetch(`/api/messages?${params}`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data);
    }
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

  // SSE for real-time updates after joining (uses token query param)
  const sseTokenParam = authQueryParam();
  useEventStream({
    url: apiUrl(`/api/events?${sseTokenParam}`),
    enabled: !!player && !!sseTokenParam,
    onMessage: (data) => {
      const msg = data as Message;
      // Clear streaming when keeper message arrives
      if (msg.sender.role === "keeper") setStreamingText(null);
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
    onCharacterUpdate: (data) => {
      const { playerId, character: charData } = data as { playerId: string; status: string; character: Player["character"] };
      // Update own player state
      if (player && playerId === player.id) {
        setPlayer((prev) => prev ? { ...prev, character: charData } : prev);
      }
      // Update session players list
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
    onWidgetUpdate: (data) => {
      const widget = data as GameWidget;
      setWidgets((prev) => {
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
      setWidgets((prev) => prev.filter((w) => w.id !== widgetId));
    },
    onPoolUpdate: (data) => {
      const { characterId, released } = data as { characterId: string; claimedBy?: string; released?: boolean };
      if (released) {
        setClaimedCharacterIds((prev) => prev.filter((id) => id !== characterId));
      } else {
        setClaimedCharacterIds((prev) => prev.includes(characterId) ? prev : [...prev, characterId]);
      }
    },
    onKeeperTyping: (data) => {
      const { text } = data as { text: string; playerId?: string };
      setStreamingText((prev) => (prev ?? "") + text);
    },
  });

  const fetchGroupChannels = useCallback(async () => {
    try {
      const res = await authFetch("/api/channels");
      if (res.ok) setMyGroupChannels(await res.json());
    } catch { /* non-critical */ }
  }, []);

  // Fetch group channels after joining
  useEffect(() => {
    if (!player) return;
    fetchGroupChannels();
  }, [player, fetchGroupChannels]);

  async function handleCreateGroupChannel(name: string, memberIds: string[]) {
    const res = await authFetch("/api/channels", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ name, memberIds }),
    });
    if (res.ok) {
      setShowCreateGroup(false);
      fetchGroupChannels();
    }
  }

  async function handleJoin(name: string) {
    const res = await fetch(apiUrl("/api/session"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "join", name, token: inviteToken }),
    });
    if (!res.ok) {
      setInviteValid(false);
      return;
    }
    const data = await res.json();
    // Store auth token returned from join
    if (data.token) {
      setStoredToken(data.token);
    }
    setPlayer(data);
    localStorage.setItem(
      "ceremony_player",
      JSON.stringify({ name: data.name, playerId: data.id, sessionId: session?.id })
    );
  }

  async function handleCharacterClaim(characterId: string) {
    if (!player) return;
    const res = await authFetch("/api/session", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ characterClaim: characterId }),
    });
    if (res.status === 409) {
      // Already claimed — refresh pool
      await fetchSession();
      return;
    }
    if (res.ok) {
      const updated = await res.json();
      setPlayer((prev) => prev ? { ...prev, ...updated } : prev);
      setClaimedCharacterIds((prev) => [...prev, characterId]);
    }
  }

  async function handleCharacterUpdate(fields: Partial<CharacterSheet>) {
    if (!player) return;
    const res = await authFetch("/api/session", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ character: fields }),
    });
    if (res.ok) {
      const updated = await res.json();
      setPlayer((prev) => prev ? { ...prev, character: updated.character } : prev);
    }
  }

  async function handleCharacterSubmit() {
    if (!player) return;
    const res = await authFetch("/api/session", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ characterAction: "submit" }),
    });
    if (res.ok) {
      const updated = await res.json();
      setPlayer((prev) => prev ? { ...prev, character: updated.character } : prev);
    }
  }

  async function handleSend(content: string) {
    if (!player) return;
    await authFetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        channel,
        sender: { name: player.name },
        content,
      }),
    });
  }

  if (reconnecting) return null; // attempting reconnect
  if (inviteValid === null && !player) return null; // validating invite
  if (!inviteValid && !player) return <NoInvite />;
  if (!player) return <JoinForm onJoin={handleJoin} session={session} />;

  // Onboarding: show wizard until character is approved
  if (player.character.status !== "approved") {
    return (
      <OnboardingWizard
        player={player}
        session={session!}
        availableCharacters={characterPool}
        claimedCharacterIds={claimedCharacterIds}
        onCharacterClaim={handleCharacterClaim}
      />
    );
  }

  const isNarrow = breakpoint === "narrow";
  const isWide = breakpoint === "wide";

  return (
    <div className={`h-screen flex flex-col ${isNarrow ? "pb-12" : ""}`}>
      {/* Create group channel dialog */}
      {showCreateGroup && (
        <CreateGroupDialog
          players={session?.players.filter((p) => p.id !== player.id) ?? []}
          onCreate={handleCreateGroupChannel}
          onCancel={() => setShowCreateGroup(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface">
        <div className="flex items-center gap-3">
          <h1 className="narrative-text text-lg text-accent">The Ceremony</h1>
          <span className="text-xs text-muted/70">|</span>
          {session && (
            <span className="text-xs text-muted">{session.name}</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {session && session.players.length > 0 && (
            <div className="flex items-center gap-2">
              <StatusDot status={session.status} />
              <span className="text-xs text-muted/80">
                {session.players.map((p) => p.name).join(", ")}
              </span>
            </div>
          )}
          <span className="text-xs text-ice font-medium">{player.name}</span>
        </div>
      </div>
      <MeanderStrip className="opacity-50" />

      {/* Scene */}
      {session?.scene && <SceneDisplay scene={session.scene} />}

      {/* Channel tabs */}
      <ChannelTabs
        channels={["all", "keeper-private", ...myGroupChannels.map((g) => g.id as Channel)]}
        active={channel}
        onChange={setChannel}
        groupChannels={myGroupChannels}
        onCreateGroup={() => setShowCreateGroup(true)}
      />

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Story log + input */}
        <div className="flex-1 flex flex-col min-w-0">
          <StoryLog messages={messages} streamingText={streamingText} />
          <MessageInput
            onSend={handleSend}
            placeholder={
              channel === "keeper-private"
                ? "Whisper to the Keeper..."
                : "What do you do?"
            }
          />

          {/* Drawer mode: panels below input */}
          {breakpoint === "medium" && (
            <PlayerPanelShelf
              mode={breakpoint}
              player={player}
              session={session!}
              widgets={widgets}
              onCharacterUpdate={handleCharacterUpdate}
              onCharacterSubmit={handleCharacterSubmit}
            />
          )}
        </div>

        {/* Wide: sidebar panels */}
        {isWide && (
          <PlayerPanelShelf
            mode={breakpoint}
            player={player}
            session={session!}
            widgets={widgets}
            onCharacterUpdate={handleCharacterUpdate}
            onCharacterSubmit={handleCharacterSubmit}
          />
        )}
      </div>

      {/* Narrow: fixed bottom toolbar */}
      {isNarrow && (
        <PlayerPanelShelf
          mode={breakpoint}
          player={player}
          session={session!}
          widgets={widgets}
          onCharacterUpdate={handleCharacterUpdate}
          onCharacterSubmit={handleCharacterSubmit}
        />
      )}
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
