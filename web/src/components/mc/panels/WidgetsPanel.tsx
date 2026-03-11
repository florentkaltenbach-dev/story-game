"use client";

import { useState } from "react";
import type { GameWidget, WidgetKind, Player } from "@/lib/types";

interface WidgetsPanelProps {
  widgets: GameWidget[];
  players: Player[];
  onPushWidget: (widget: GameWidget) => void;
  onRemoveWidget: (widgetId: string) => void;
}

const WIDGET_KINDS: { value: WidgetKind; label: string }[] = [
  { value: "inventory", label: "Inventory" },
  { value: "npc_dossier", label: "NPC Dossier" },
  { value: "environment", label: "Environment" },
  { value: "status", label: "Status" },
  { value: "custom", label: "Custom" },
];

const KIND_ICONS: Record<WidgetKind, string> = {
  inventory: "\uD83C\uDF92",
  npc_dossier: "\uD83D\uDC64",
  environment: "\uD83C\uDF21",
  status: "\uD83D\uDCCA",
  custom: "\uD83D\uDCDD",
};

function defaultDataForKind(kind: WidgetKind): GameWidget["data"] {
  switch (kind) {
    case "inventory":
      return [{ name: "Item", quantity: 1 }];
    case "npc_dossier":
      return { name: "NPC Name", role: "Unknown", knownFacts: [] };
    case "environment":
      return { conditions: [{ label: "Temperature", value: "-12", unit: "C" }] };
    case "status":
      return { entries: [{ label: "Status", value: "Normal" }] };
    case "custom":
      return { markdown: "**Note:** Details here" };
  }
}

export default function WidgetsPanel({ widgets, players, onPushWidget, onRemoveWidget }: WidgetsPanelProps) {
  const [showForm, setShowForm] = useState(false);
  const [kind, setKind] = useState<WidgetKind>("inventory");
  const [label, setLabel] = useState("");
  const [target, setTarget] = useState("all");
  const [dataJson, setDataJson] = useState("");

  function handleCreate() {
    const id = `w-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    let data: GameWidget["data"];
    if (dataJson.trim()) {
      try {
        data = JSON.parse(dataJson);
      } catch {
        return; // invalid JSON, don't create
      }
    } else {
      data = defaultDataForKind(kind);
    }

    const widget: GameWidget = {
      id,
      kind,
      label: label || kind.replace("_", " "),
      target,
      data,
      updatedAt: Date.now(),
    };
    onPushWidget(widget);
    setShowForm(false);
    setLabel("");
    setDataJson("");
  }

  return (
    <div className="space-y-3">
      {/* Active widgets list */}
      {widgets.length === 0 ? (
        <p className="text-xs text-muted/60 italic">No active widgets</p>
      ) : (
        <div className="space-y-2">
          {widgets.map((w) => (
            <div key={w.id} className="flex items-center gap-2 text-xs">
              <span>{KIND_ICONS[w.kind] || "\uD83D\uDCDD"}</span>
              <div className="flex-1 min-w-0">
                <span className="text-foreground/90">{w.label}</span>
                <span className="text-muted/50 ml-1.5">
                  {w.target === "all" ? "all" : players.find((p) => p.id === w.target)?.name || w.target}
                </span>
              </div>
              <button
                onClick={() => onRemoveWidget(w.id)}
                className="text-muted/50 hover:text-danger transition-colors flex-shrink-0"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create form */}
      {showForm ? (
        <div className="space-y-2 border border-border rounded p-3 bg-surface-light/30">
          <div>
            <label className="text-[10px] text-muted/70 uppercase tracking-wider block mb-1">Kind</label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as WidgetKind)}
              className="w-full bg-surface-light border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none"
            >
              {WIDGET_KINDS.map((k) => (
                <option key={k.value} value={k.value}>{k.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-muted/70 uppercase tracking-wider block mb-1">Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={kind.replace("_", " ")}
              className="w-full bg-surface-light border border-border rounded px-2 py-1 text-xs text-foreground placeholder:text-muted/50 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[10px] text-muted/70 uppercase tracking-wider block mb-1">Target</label>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full bg-surface-light border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none"
            >
              <option value="all">All Players</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-muted/70 uppercase tracking-wider block mb-1">Data (JSON, optional)</label>
            <textarea
              value={dataJson}
              onChange={(e) => setDataJson(e.target.value)}
              placeholder="Leave blank for defaults"
              rows={3}
              className="w-full bg-surface-light border border-border rounded px-2 py-1 text-xs text-foreground placeholder:text-muted/50 focus:outline-none resize-y font-mono"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              className="flex-1 py-1.5 bg-accent/20 text-accent border border-accent/30 rounded text-xs hover:bg-accent/30 transition-colors"
            >
              Push Widget
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-xs text-muted hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-1.5 text-xs text-accent/80 hover:text-accent border border-dashed border-accent/20 rounded hover:border-accent/40 transition-colors"
        >
          + Push Widget
        </button>
      )}
    </div>
  );
}
