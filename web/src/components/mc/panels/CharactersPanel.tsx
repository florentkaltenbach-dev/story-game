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
  if (players.length === 0) {
    return (
      <p className="text-xs text-muted/60 italic">No players yet</p>
    );
  }

  const unpickedCount = players.filter((p) => p.character.status !== "approved").length;

  return (
    <div>
      {unpickedCount > 0 && (
        <p className="text-xs text-muted/70 mb-2">
          {unpickedCount} player{unpickedCount !== 1 ? "s" : ""} still choosing...
        </p>
      )}
      <ul className="space-y-2">
        {players.map((p) => {
          const cs = p.character;
          const isExpanded = expandedId === p.id;
          const isPicked = cs.status === "approved";

          return (
            <li key={p.id}>
              <button
                onClick={() => onExpand(isExpanded ? null : p.id)}
                className="w-full flex items-center gap-2 text-left hover:bg-surface-light/50 rounded px-1 py-0.5 -mx-1 transition-colors"
              >
                <span className={`h-2 w-2 rounded-full flex-shrink-0 ${isPicked ? "bg-keeper" : "bg-muted/40 animate-pulse"}`} />
                <span className="text-xs text-foreground/90 flex-1">{p.name}</span>
                {isPicked ? (
                  <span className="text-xs text-muted/70">{cs.archetype}</span>
                ) : (
                  <span className="text-xs text-muted/50 italic">choosing...</span>
                )}
                {isPicked && (
                  <span className="text-keeper text-xs">&#10003;</span>
                )}
              </button>

              {isExpanded && isPicked && (
                <div className="mt-2 ml-3.5 pl-3 border-l border-border space-y-2">
                  <div>
                    <span className="text-[11px] tracking-wider uppercase text-muted/70 font-mono">Character</span>
                    <p className="text-xs text-foreground/85">{p.characterName}</p>
                  </div>
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
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => onCharacterAction(p.id, "revise")}
                      className="text-xs px-2 py-1 text-muted/60 hover:text-foreground transition-colors"
                    >
                      Reopen
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
