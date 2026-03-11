"use client";

interface KeeperResponse {
  narrative: string;
  journalUpdate: string | null;
  internalNotes: string | null;
  degraded: boolean;
}

interface KeeperPanelProps {
  response: KeeperResponse | null;
  onDismiss: () => void;
}

export default function KeeperPanel({ response, onDismiss }: KeeperPanelProps) {
  if (!response) {
    return (
      <div className="mx-3 mb-2 py-2 px-3 border border-keeper/10 rounded bg-keeper/[0.02]">
        <span className="text-xs text-keeper/40 italic">No Keeper response yet — query the Keeper below</span>
      </div>
    );
  }

  return (
    <div className="mx-3 mb-2 p-3 bg-keeper/[0.06] border border-keeper/20 rounded">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs tracking-widest uppercase text-keeper/90">
          Keeper Response
          {response.degraded && (
            <span className="ml-2 text-accent/60">(degraded)</span>
          )}
        </span>
        <button
          onClick={onDismiss}
          className="text-xs text-muted/70 hover:text-foreground transition-colors"
        >
          dismiss
        </button>
      </div>
      <p className="narrative-text text-sm text-foreground/90 italic leading-relaxed">
        {response.narrative}
      </p>
      {response.journalUpdate && (
        <div className="mt-2 pt-2 border-t border-keeper/10">
          <span className="text-xs tracking-widest uppercase text-accent/80">
            Journal Update
          </span>
          <p className="narrative-text text-xs text-accent/90 italic mt-0.5">
            {response.journalUpdate}
          </p>
        </div>
      )}
      {response.internalNotes && (
        <div className="mt-2 pt-2 border-t border-keeper/10">
          <span className="text-xs tracking-widest uppercase text-muted/70">
            Internal Notes
          </span>
          <p className="text-xs text-muted/70 italic mt-0.5">
            {response.internalNotes}
          </p>
        </div>
      )}
    </div>
  );
}
