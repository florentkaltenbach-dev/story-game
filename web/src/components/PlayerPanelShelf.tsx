"use client";

import { useState, type ReactNode } from "react";
import type { Breakpoint } from "@/hooks/useBreakpoint";
import type { GameWidget, Player, Session, CharacterSheet } from "@/lib/types";
import Panel from "@/components/ui/Panel";
import CharacterPanel from "@/components/CharacterPanel";
import CharacterCreation from "@/components/CharacterCreation";
import WidgetRenderer from "@/components/widgets/WidgetRenderer";

interface PanelDef {
  id: string;
  title: string;
  icon: string;
  badge?: ReactNode;
  defaultOpen?: boolean;
  content: ReactNode;
}

interface PlayerPanelShelfProps {
  mode: Breakpoint;
  player: Player;
  session: Session;
  widgets: GameWidget[];
  onCharacterUpdate: (fields: Partial<CharacterSheet>) => void;
  onCharacterSubmit: () => void;
}

const KIND_ICONS: Record<string, string> = {
  inventory: "\uD83C\uDF92",    // backpack
  npc_dossier: "\uD83D\uDC64",  // bust
  environment: "\uD83C\uDF21",  // thermometer
  status: "\uD83D\uDCCA",       // chart
  custom: "\uD83D\uDCDD",       // memo
};

function usePanelDefs(props: PlayerPanelShelfProps): PanelDef[] {
  const { player, session, widgets, onCharacterUpdate, onCharacterSubmit } = props;

  // Character panel is always first
  const characterPanel: PanelDef = player.character.status === "approved"
    ? {
        id: "character",
        title: player.characterName || "Character",
        icon: "\uD83D\uDCD3", // notebook
        defaultOpen: true,
        content: <CharacterPanel player={player} />,
      }
    : {
        id: "character",
        title: "Personnel Record",
        icon: "\uD83D\uDCCB", // clipboard
        defaultOpen: true,
        content: (
          <CharacterCreation
            player={player}
            session={session}
            onUpdate={onCharacterUpdate}
            onSubmit={onCharacterSubmit}
          />
        ),
      };

  // Sort widgets by priority, then updatedAt
  const sorted = [...widgets].sort((a, b) => {
    if ((a.priority ?? 99) !== (b.priority ?? 99)) return (a.priority ?? 99) - (b.priority ?? 99);
    return b.updatedAt - a.updatedAt;
  });

  const widgetPanels: PanelDef[] = sorted.map((w) => ({
    id: `widget-${w.id}`,
    title: w.label,
    icon: w.icon || KIND_ICONS[w.kind] || "\uD83D\uDCDD",
    defaultOpen: false,
    content: <WidgetRenderer widget={w} />,
  }));

  return [characterPanel, ...widgetPanels];
}

// === Sidebar mode (wide) ===
function SidebarShelf({ panels, isCreation }: { panels: PanelDef[]; isCreation: boolean }) {
  // In creation mode, show the character creation form directly (not collapsible)
  if (isCreation) {
    return (
      <div className="w-96 flex-shrink-0 flex flex-col border-l border-border bg-surface overflow-y-auto">
        {panels[0].content}
        {panels.length > 1 && (
          <div className="border-t border-border">
            {panels.slice(1).map((p) => (
              <Panel key={p.id} id={p.id} title={p.title} defaultOpen={p.defaultOpen}>
                {p.content}
              </Panel>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-72 flex-shrink-0 flex flex-col border-l border-border bg-surface overflow-y-auto">
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
        {panels.length > 1 ? `Panels (${panels.length})` : "Panel"}
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
      {/* Bottom sheet overlay + content */}
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
            <span className="text-[9px] uppercase tracking-wider">{p.title.slice(0, 5)}</span>
            {p.badge && (
              <span className="absolute -top-0.5 -right-0.5">{p.badge}</span>
            )}
          </button>
        ))}
      </div>
    </>
  );
}

export default function PlayerPanelShelf(props: PlayerPanelShelfProps) {
  const panels = usePanelDefs(props);
  const isCreation = props.player.character.status !== "approved";

  switch (props.mode) {
    case "wide":
      return <SidebarShelf panels={panels} isCreation={isCreation} />;
    case "medium":
      return <DrawerShelf panels={panels} />;
    case "narrow":
      return <ToolbarShelf panels={panels} />;
  }
}
