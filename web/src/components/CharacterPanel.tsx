"use client";

import { useState } from "react";
import { Player } from "@/lib/types";

export default function CharacterPanel({ player }: { player: Player }) {
  const [tab, setTab] = useState<"journal" | "notes">("journal");
  const [notes, setNotes] = useState(player.notes);

  return (
    <div className="flex flex-col h-full border-l border-border bg-surface">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-accent tracking-wide">
          {player.characterName}
        </h3>
        <p className="text-xs text-muted mt-0.5">Journal & Notes</p>
      </div>

      <div className="flex border-b border-border">
        <button
          onClick={() => setTab("journal")}
          className={`flex-1 px-3 py-2 text-xs transition-colors ${
            tab === "journal"
              ? "border-b-2 border-accent text-accent"
              : "text-muted hover:text-foreground"
          }`}
        >
          Journal
        </button>
        <button
          onClick={() => setTab("notes")}
          className={`flex-1 px-3 py-2 text-xs transition-colors ${
            tab === "notes"
              ? "border-b-2 border-accent text-accent"
              : "text-muted hover:text-foreground"
          }`}
        >
          Notes
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {tab === "journal" ? (
          <p className="narrative-text text-sm text-foreground/80 leading-relaxed">
            {player.journal}
          </p>
        ) : (
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Your suspicions, plans, theories..."
            className="w-full h-full bg-transparent text-sm text-foreground/80 placeholder:text-muted/40 resize-none focus:outline-none"
          />
        )}
      </div>
    </div>
  );
}
