import type { Player } from "@/lib/types";

interface PlayersPanelProps {
  players: Player[];
  onKick: (player: { id: string; name: string }) => void;
}

export default function PlayersPanel({ players, onKick }: PlayersPanelProps) {
  if (players.length === 0) {
    return (
      <p className="text-xs text-muted/60 italic">
        Waiting for players to join...
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {players.map((p) => (
        <li key={p.id} className="group flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-keeper flex-shrink-0" />
          <span className="text-xs text-foreground/90 flex-1">{p.name}</span>
          <button
            onClick={() => onKick({ id: p.id, name: p.name })}
            className="text-xs px-1.5 py-0.5 rounded text-red-400/25 group-hover:text-red-400/60 hover:!text-red-400 hover:!bg-red-400/10 active:text-red-400 active:bg-red-400/10 transition-colors"
            title={`Remove ${p.name}`}
          >
            &#x2715;
          </button>
        </li>
      ))}
    </ul>
  );
}
