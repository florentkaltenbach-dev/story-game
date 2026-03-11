"use client";

import { useState } from "react";
import { Scene } from "@/lib/types";

interface SceneDisplayProps {
  scene: Scene;
  editable?: boolean;
  onUpdate?: (scene: Partial<Scene>) => void;
}

export default function SceneDisplay({
  scene,
  editable,
  onUpdate,
}: SceneDisplayProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(scene);

  function handleSave() {
    onUpdate?.(draft);
    setEditing(false);
  }

  if (editing && editable) {
    return (
      <div className="border-b border-border bg-surface px-3 sm:px-6 py-3 sm:py-4 space-y-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={draft.location}
            onChange={(e) => setDraft({ ...draft, location: e.target.value })}
            placeholder="Location"
            className="bg-surface-light border border-border rounded px-2 py-1 text-xs text-foreground w-full sm:w-40 focus:outline-none focus:border-accent/50"
          />
          <input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="Scene title"
            className="bg-surface-light border border-border rounded px-2 py-1 text-sm text-accent font-semibold flex-1 focus:outline-none focus:border-accent/50"
          />
        </div>
        <textarea
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          rows={3}
          className="w-full bg-surface-light border border-border rounded px-3 py-2 text-sm text-foreground/80 resize-none focus:outline-none focus:border-accent/50 narrative-text"
        />
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => setEditing(false)}
            className="text-xs px-3 py-1 text-muted hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="text-xs px-3 py-1 bg-accent/20 text-accent border border-accent/30 rounded hover:bg-accent/30 transition-colors"
          >
            Update Scene
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-border bg-surface px-3 sm:px-6 py-3 sm:py-4 group">
      <div className="flex items-baseline gap-2 sm:gap-3 flex-wrap">
        <span className="text-[10px] sm:text-xs tracking-widest uppercase text-muted">
          {scene.location}
        </span>
        <span className="text-accent/60">|</span>
        <h2 className="narrative-text text-base sm:text-lg font-semibold text-accent">{scene.title}</h2>
        {editable && (
          <button
            onClick={() => {
              setDraft(scene);
              setEditing(true);
            }}
            aria-label="Edit scene"
            className="ml-auto text-xs text-muted/70 hover:text-accent touch-visible transition-opacity"
          >
            edit scene
          </button>
        )}
      </div>
      <p className="narrative-text mt-2 text-xs sm:text-sm text-foreground/90 leading-relaxed">
        {scene.description}
      </p>
    </div>
  );
}
