"use client";

import { useState, type ReactNode } from "react";
import type { Breakpoint } from "@/hooks/useBreakpoint";
import type { Session, Invite, GameWidget } from "@/lib/types";
import Panel from "@/components/ui/Panel";
import SessionPanel from "./panels/SessionPanel";
import PlayersPanel from "./panels/PlayersPanel";
import CharactersPanel from "./panels/CharactersPanel";
import InvitationsPanel from "./panels/InvitationsPanel";
import MemoryPanel from "./panels/MemoryPanel";
import NpcPanel from "./panels/NpcPanel";
import type { NpcEntry } from "./panels/NpcPanel";
import WidgetsPanel from "./panels/WidgetsPanel";

interface MemoryLevelSummary {
  fileCount: number;
  files: string[];
}

interface CostSummary {
  totalCalls: number;
  totalInput: number;
  totalOutput: number;
  totalCacheRead: number;
  totalCostUsd: number;
}

interface PanelShelfProps {
  mode: Breakpoint;
  session: Session | null;
  invites: Invite[];
  copiedToken: string | null;
  memoryLevels: Record<number, MemoryLevelSummary> | null;
  memoryFileContents?: Record<number, Record<string, string>>;
  onFetchMemoryLevel?: (level: number) => void;
  cost?: CostSummary | null;
  npcs?: NpcEntry[];
  onSaveNpc?: (npc: NpcEntry) => void;
  onCreateNpc?: (npc: Omit<NpcEntry, "source">) => void;
  expandedCharacter: string | null;
  onExpandCharacter: (id: string | null) => void;
  onCharacterAction: (playerId: string, action: "approve" | "revise", comment?: string) => void;
  onKick: (player: { id: string; name: string }) => void;
  onGenerateInvite: () => void;
  onCopyInvite: (token: string) => void;
  widgets?: GameWidget[];
  onPushWidget?: (widget: GameWidget) => void;
  onRemoveWidget?: (widgetId: string) => void;
}

interface PanelDef {
  id: string;
  title: string;
  icon: string;
  badge?: ReactNode;
  defaultOpen?: boolean;
  content: ReactNode;
}

function usePanelDefs(props: PanelShelfProps): PanelDef[] {
  const {
    session,
    invites,
    copiedToken,
    memoryLevels,
    memoryFileContents,
    onFetchMemoryLevel,
    cost,
    npcs = [],
    onSaveNpc,
    onCreateNpc,
    expandedCharacter,
    onExpandCharacter,
    onCharacterAction,
    onKick,
    onGenerateInvite,
    onCopyInvite,
    widgets = [],
    onPushWidget,
    onRemoveWidget,
  } = props;

  const players = session?.players ?? [];
  const submittedCount = players.filter((p) => p.character.status === "submitted").length;
  const newInviteCount = invites.filter((i) => i.status === "new").length;

  return [
    {
      id: "session",
      title: "Session",
      icon: "⚙",
      defaultOpen: true,
      content: <SessionPanel session={session} cost={cost} />,
    },
    {
      id: "players",
      title: "Players",
      icon: "👤",
      badge: players.length > 0 ? (
        <span className="text-[10px] text-keeper/80 bg-keeper/10 px-1.5 py-0.5 rounded-full">
          {players.length}
        </span>
      ) : undefined,
      defaultOpen: true,
      content: <PlayersPanel players={players} onKick={onKick} />,
    },
    {
      id: "characters",
      title: "Characters",
      icon: "📋",
      badge: submittedCount > 0 ? (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-40 animate-ping" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
        </span>
      ) : undefined,
      content: (
        <CharactersPanel
          players={players}
          expandedId={expandedCharacter}
          onExpand={onExpandCharacter}
          onCharacterAction={onCharacterAction}
        />
      ),
    },
    {
      id: "invites",
      title: "Invitations",
      icon: "✉",
      badge: newInviteCount > 0 ? (
        <span className="text-[10px] text-accent/80 bg-accent/10 px-1.5 py-0.5 rounded-full">
          {newInviteCount}
        </span>
      ) : undefined,
      content: (
        <InvitationsPanel
          invites={invites}
          onGenerate={onGenerateInvite}
          onCopy={onCopyInvite}
          copiedToken={copiedToken}
        />
      ),
    },
    {
      id: "npcs",
      title: "NPCs",
      icon: "🎭",
      badge: npcs.length > 0 ? (
        <span className="text-[10px] text-keeper/80 bg-keeper/10 px-1.5 py-0.5 rounded-full">
          {npcs.length}
        </span>
      ) : undefined,
      content: (
        <NpcPanel
          npcs={npcs}
          onSave={onSaveNpc ?? (() => {})}
          onCreate={onCreateNpc ?? (() => {})}
        />
      ),
    },
    {
      id: "memory",
      title: "Memory",
      icon: "🧠",
      content: (
        <MemoryPanel
          memoryLevels={memoryLevels}
          fileContents={memoryFileContents}
          onFetchLevel={onFetchMemoryLevel}
        />
      ),
    },
    {
      id: "widgets",
      title: "Widgets",
      icon: "🧩",
      badge: widgets.length > 0 ? (
        <span className="text-[10px] text-ice/80 bg-ice/10 px-1.5 py-0.5 rounded-full">
          {widgets.length}
        </span>
      ) : undefined,
      content: (
        <WidgetsPanel
          widgets={widgets}
          players={players}
          onPushWidget={onPushWidget ?? (() => {})}
          onRemoveWidget={onRemoveWidget ?? (() => {})}
        />
      ),
    },
  ];
}

// === Sidebar mode (wide) ===
function SidebarShelf({ panels }: { panels: PanelDef[] }) {
  return (
    <div className="w-[280px] flex-shrink-0 flex flex-col border-l border-border bg-surface overflow-y-auto">
      {panels.map((p) => (
        <Panel key={p.id} id={p.id} title={p.title} badge={p.badge} defaultOpen={p.defaultOpen}>
          {p.content}
        </Panel>
      ))}
    </div>
  );
}

// === Drawer mode (medium) ===
function DrawerShelf({ panels }: { panels: PanelDef[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t border-border bg-surface">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-center gap-2 py-2 text-xs text-muted/80 hover:text-foreground transition-colors"
      >
        <svg
          className={`w-3 h-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M18 15l-6-6-6 6" />
        </svg>
        Panels
        <svg
          className={`w-3 h-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M18 15l-6-6-6 6" />
        </svg>
      </button>
      <div
        className={`overflow-y-auto transition-[max-height] duration-300 ease-in-out ${
          open ? "max-h-[50vh]" : "max-h-0"
        }`}
      >
        {panels.map((p) => (
          <Panel key={p.id} id={p.id} title={p.title} badge={p.badge} defaultOpen={false}>
            {p.content}
          </Panel>
        ))}
      </div>
    </div>
  );
}

// === Toolbar + bottom sheet mode (narrow) ===
function ToolbarShelf({ panels }: { panels: PanelDef[] }) {
  const [activeSheet, setActiveSheet] = useState<string | null>(null);
  const activePanel = panels.find((p) => p.id === activeSheet);

  return (
    <>
      {/* Bottom sheet overlay + content — only rendered when a sheet is active */}
      {activePanel && (
        <>
          <div
            className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
            onClick={() => setActiveSheet(null)}
          />
          <div
            className="fixed left-0 right-0 bottom-12 z-50 bg-surface border-t border-border rounded-t-xl shadow-2xl"
            style={{ maxHeight: "60vh", overflowY: "auto" }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-surface">
              <h4 className="text-xs font-semibold text-muted tracking-wide uppercase">
                {activePanel.title}
              </h4>
              <button
                onClick={() => setActiveSheet(null)}
                className="text-xs text-muted/70 hover:text-foreground transition-colors px-1"
              >
                ✕
              </button>
            </div>
            <div className="px-4 py-3">{activePanel.content}</div>
          </div>
        </>
      )}

      {/* Fixed toolbar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around bg-surface border-t border-border py-2 panel-toolbar">
        {panels.map((p) => (
          <button
            key={p.id}
            onClick={() => setActiveSheet(activeSheet === p.id ? null : p.id)}
            className={`relative flex flex-col items-center gap-0.5 px-3 py-1 rounded transition-colors ${
              activeSheet === p.id
                ? "text-accent bg-accent/10"
                : "text-muted/70 hover:text-foreground"
            }`}
          >
            <span className="text-base">{p.icon}</span>
            <span className="text-[9px] uppercase tracking-wider">{p.id === "invites" ? "Inv" : p.title.slice(0, 4)}</span>
            {p.badge && (
              <span className="absolute -top-0.5 -right-0.5">{p.badge}</span>
            )}
          </button>
        ))}
      </div>
    </>
  );
}

export default function PanelShelf(props: PanelShelfProps) {
  const panels = usePanelDefs(props);

  switch (props.mode) {
    case "wide":
      return <SidebarShelf panels={panels} />;
    case "medium":
      return <DrawerShelf panels={panels} />;
    case "narrow":
      return <ToolbarShelf panels={panels} />;
  }
}
