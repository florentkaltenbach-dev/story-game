import { useState } from "react";
import type { Player } from "@/lib/types";

interface CharactersPanelProps {
  players: Player[];
  expandedId: string | null;
  onExpand: (id: string | null) => void;
  onCharacterAction: (playerId: string, action: "approve" | "revise", comment?: string) => void;
}

export default function CharactersPanel({
  players,
  expandedId,
  onExpand,
  onCharacterAction,
}: CharactersPanelProps) {
  const [revisionComment, setRevisionComment] = useState("");
  const [showRevisionInput, setShowRevisionInput] = useState<string | null>(null);

  if (players.length === 0) {
    return (
      <p className="text-xs text-muted/60 italic">No players yet</p>
    );
  }

  function handleRevise(playerId: string) {
    onCharacterAction(playerId, "revise", revisionComment.trim() || undefined);
    setRevisionComment("");
    setShowRevisionInput(null);
  }

  return (
    <ul className="space-y-2">
      {players.map((p) => {
        const cs = p.character;
        const isExpanded = expandedId === p.id;
        const statusColor =
          cs.status === "approved"
            ? "bg-keeper"
            : cs.status === "submitted"
              ? "bg-accent animate-pulse"
              : "bg-muted/40";
        const statusLabel =
          cs.status === "approved"
            ? "Approved"
            : cs.status === "submitted"
              ? "Submitted"
              : cs.status === "draft"
                ? "Draft"
                : "Pending";

        return (
          <li key={p.id}>
            <button
              onClick={() => onExpand(isExpanded ? null : p.id)}
              className="w-full flex items-center gap-2 text-left hover:bg-surface-light/50 rounded px-1 py-0.5 -mx-1 transition-colors"
            >
              <span className={`h-2 w-2 rounded-full flex-shrink-0 ${statusColor}`} />
              <span className="text-xs text-foreground/90 flex-1">{p.name}</span>
              <span className="text-xs text-muted/70">{statusLabel}</span>
              {cs.status === "approved" && (
                <span className="text-keeper text-xs">&#10003;</span>
              )}
            </button>

            {isExpanded && cs.status !== "pending" && (
              <div className="mt-2 ml-3.5 pl-3 border-l border-border space-y-2">
                {cs.archetype && (
                  <div>
                    <span className="text-[11px] tracking-wider uppercase text-muted/70 font-mono">Role</span>
                    <p className="text-xs text-foreground/85">{cs.archetype}</p>
                  </div>
                )}
                {cs.background && (
                  <div>
                    <span className="text-[11px] tracking-wider uppercase text-muted/70 font-mono">Background</span>
                    <p className="text-xs text-foreground/85">{cs.background}</p>
                  </div>
                )}
                {cs.motivation && (
                  <div>
                    <span className="text-[11px] tracking-wider uppercase text-muted/70 font-mono">Motivation</span>
                    <p className="text-xs text-foreground/85 italic">{cs.motivation}</p>
                  </div>
                )}
                {cs.fear && (
                  <div>
                    <span className="text-[11px] tracking-wider uppercase text-muted/70 font-mono">Fear</span>
                    <p className="text-xs text-foreground/85 italic">{cs.fear}</p>
                  </div>
                )}
                {cs.qualities.length > 0 && (
                  <div>
                    <span className="text-[11px] tracking-wider uppercase text-muted/70 font-mono">Qualities</span>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {cs.qualities.map((q) => (
                        <span key={q} className="px-1.5 py-0.5 bg-accent/10 border border-accent/20 rounded text-xs text-accent/85">{q}</span>
                      ))}
                    </div>
                  </div>
                )}
                {cs.relationships.length > 0 && (
                  <div>
                    <span className="text-[11px] tracking-wider uppercase text-muted/70 font-mono">Connections</span>
                    {cs.relationships.map((r, i) => (
                      <p key={i} className="text-xs text-foreground/80">&bull; {r}</p>
                    ))}
                  </div>
                )}

                {cs.status === "submitted" && (
                  <div className="space-y-2 pt-1">
                    <div className="flex gap-2">
                      <button
                        onClick={() => onCharacterAction(p.id, "approve")}
                        className="text-xs px-2 py-1 bg-keeper/15 text-keeper border border-keeper/30 rounded hover:bg-keeper/25 transition-colors"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          if (showRevisionInput === p.id) {
                            setShowRevisionInput(null);
                          } else {
                            setShowRevisionInput(p.id);
                            setRevisionComment("");
                          }
                        }}
                        className="text-xs px-2 py-1 bg-surface-light text-muted border border-border rounded hover:text-foreground transition-colors"
                      >
                        Request Revision
                      </button>
                    </div>

                    {showRevisionInput === p.id && (
                      <div className="space-y-1.5">
                        <textarea
                          value={revisionComment}
                          onChange={(e) => setRevisionComment(e.target.value)}
                          placeholder="Feedback for the player (optional)..."
                          rows={2}
                          className="w-full bg-surface-light border border-border rounded px-3 py-1.5 text-xs text-foreground placeholder:text-muted/60 focus:outline-none focus:border-accent/50 resize-none"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRevise(p.id)}
                            className="text-xs px-2 py-1 bg-amber-500/15 text-amber-500 border border-amber-500/30 rounded hover:bg-amber-500/25 transition-colors"
                          >
                            Send Revision
                          </button>
                          <button
                            onClick={() => {
                              setShowRevisionInput(null);
                              setRevisionComment("");
                            }}
                            className="text-xs px-2 py-1 text-muted/60 hover:text-foreground transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {cs.status === "approved" && (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => onCharacterAction(p.id, "revise")}
                      className="text-xs px-2 py-1 text-muted/60 hover:text-foreground transition-colors"
                    >
                      Reopen
                    </button>
                  </div>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
