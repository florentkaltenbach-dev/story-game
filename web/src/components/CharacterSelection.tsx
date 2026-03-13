"use client";

import { useState } from "react";
import type { PresetCharacter } from "@/lib/types";

interface CharacterSelectionProps {
  characters: PresetCharacter[];
  claimedIds: string[];
  onClaim: (id: string) => void;
  playerName: string;
}

export default function CharacterSelection({
  characters,
  claimedIds,
  onClaim,
  playerName,
}: CharacterSelectionProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  function handleCardClick(id: string) {
    if (claimedIds.includes(id)) return;
    if (expandedId === id) {
      setExpandedId(null);
      setConfirmingId(null);
    } else {
      setExpandedId(id);
      setConfirmingId(null);
    }
  }

  function handleClaimClick(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    setConfirmingId(id);
  }

  function handleConfirm(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    onClaim(id);
    setConfirmingId(null);
    setExpandedId(null);
  }

  function handleCancel(e: React.MouseEvent) {
    e.stopPropagation();
    setConfirmingId(null);
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-6 pt-6 pb-5 border-b border-border">
        <p className="text-[11px] tracking-[0.35em] uppercase text-muted/70 mb-1 font-mono">
          Starkweather-Moore Expedition
        </p>
        <h2
          className="text-lg text-accent tracking-wide mb-2"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
        >
          Personnel Dossiers
        </h2>
        <p className="text-sm text-muted/70">
          Select your character, {playerName}. This choice is permanent.
        </p>
      </div>

      {/* Card grid */}
      <div className="px-6 py-5 flex-1">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {characters.map((char) => {
            const isClaimed = claimedIds.includes(char.id);
            const isExpanded = expandedId === char.id;
            const isConfirming = confirmingId === char.id;

            return (
              <div
                key={char.id}
                onClick={() => handleCardClick(char.id)}
                className={`
                  relative bg-surface border border-border rounded-lg transition-all duration-200
                  ${isClaimed
                    ? "opacity-50 cursor-not-allowed"
                    : "cursor-pointer hover:border-accent/30"
                  }
                  ${isExpanded && !isClaimed ? "border-accent/40 ring-1 ring-accent/10" : ""}
                `}
              >
                {/* Claimed overlay */}
                {isClaimed && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/60 backdrop-blur-[1px]">
                    <span className="text-[11px] tracking-[0.3em] uppercase text-muted/70 font-mono">
                      Already Claimed
                    </span>
                  </div>
                )}

                {/* Collapsed content (always visible) */}
                <div className="px-4 py-3.5">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h3
                      className="text-sm text-accent"
                      style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                    >
                      {char.name}
                    </h3>
                    <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] tracking-[0.15em] uppercase text-muted/70 border border-border rounded font-mono">
                      {char.archetype}
                    </span>
                  </div>
                  <p className="text-xs text-muted/70 italic mb-1.5">
                    {char.tagline}
                  </p>
                  <p className="text-xs text-foreground/70 line-clamp-1">
                    {char.portrait}
                  </p>
                </div>

                {/* Expanded content */}
                {isExpanded && !isClaimed && (
                  <div className="px-4 pb-4 border-t border-border/50 pt-3 space-y-3">
                    {/* Background */}
                    <div>
                      <p className="text-[11px] tracking-[0.35em] uppercase text-muted/70 font-mono mb-1">
                        Background
                      </p>
                      <p className="text-xs text-foreground/80 leading-relaxed narrative-text">
                        {char.background}
                      </p>
                    </div>

                    {/* Motivation */}
                    <div>
                      <p className="text-[11px] tracking-[0.35em] uppercase text-muted/70 font-mono mb-1">
                        Motivation
                      </p>
                      <p className="text-xs text-foreground/80 italic leading-relaxed">
                        {char.motivation}
                      </p>
                    </div>

                    {/* Fear */}
                    <div>
                      <p className="text-[11px] tracking-[0.35em] uppercase text-muted/70 font-mono mb-1">
                        Fear
                      </p>
                      <p className="text-xs text-red-300/80 italic leading-relaxed">
                        {char.fear}
                      </p>
                    </div>

                    {/* Qualities */}
                    {char.qualities.length > 0 && (
                      <div>
                        <p className="text-[11px] tracking-[0.35em] uppercase text-muted/70 font-mono mb-1.5">
                          Qualities
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {char.qualities.map((q) => (
                            <span
                              key={q}
                              className="px-1.5 py-0.5 bg-accent/10 border border-accent/20 rounded text-xs text-accent/85"
                            >
                              {q}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Relationships */}
                    {char.relationships.length > 0 && (
                      <div>
                        <p className="text-[11px] tracking-[0.35em] uppercase text-muted/70 font-mono mb-1.5">
                          Connections
                        </p>
                        <ul className="space-y-1">
                          {char.relationships.map((r, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-2 text-xs text-foreground/70"
                            >
                              <span className="text-accent/50 mt-0.5">&bull;</span>
                              <span>{r}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Claim button / Confirmation */}
                    <div className="pt-2">
                      {isConfirming ? (
                        <div className="space-y-2">
                          <p className="text-xs text-muted/80 text-center italic">
                            Are you sure? This is permanent.
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => handleConfirm(e, char.id)}
                              className="flex-1 py-1.5 bg-accent/20 text-accent border border-accent/30 rounded text-sm tracking-wide hover:bg-accent/30 transition-colors"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={handleCancel}
                              className="flex-1 py-1.5 text-muted/70 border border-border rounded text-sm tracking-wide hover:text-foreground hover:border-border transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => handleClaimClick(e, char.id)}
                          className="w-full py-1.5 bg-accent/20 text-accent border border-accent/30 rounded text-sm tracking-wide hover:bg-accent/30 transition-colors"
                        >
                          Claim This Character
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
