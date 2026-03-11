import type { Session } from "@/lib/types";

interface CostSummary {
  totalCalls: number;
  totalInput: number;
  totalOutput: number;
  totalCacheRead: number;
  totalCostUsd: number;
}

interface SessionPanelProps {
  session: Session | null;
  cost?: CostSummary | null;
}

export default function SessionPanel({ session, cost }: SessionPanelProps) {
  if (!session) {
    return <p className="text-xs text-muted/60 italic">Loading session...</p>;
  }
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <p className="text-xs text-foreground/85">{session.name}</p>
        <p className="text-xs text-muted/70">Preset: {session.preset}</p>
      </div>

      {cost && cost.totalCalls > 0 && (
        <div className="pt-1 border-t border-border/50 space-y-1">
          <p className="text-[10px] text-muted/60 uppercase tracking-wider">API Usage</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
            <span className="text-muted/70">Calls</span>
            <span className="text-foreground/80 text-right">{cost.totalCalls}</span>
            <span className="text-muted/70">Input</span>
            <span className="text-foreground/80 text-right">{(cost.totalInput / 1000).toFixed(1)}k</span>
            <span className="text-muted/70">Output</span>
            <span className="text-foreground/80 text-right">{(cost.totalOutput / 1000).toFixed(1)}k</span>
            {cost.totalCacheRead > 0 && (
              <>
                <span className="text-muted/70">Cache hits</span>
                <span className="text-keeper/80 text-right">{(cost.totalCacheRead / 1000).toFixed(1)}k</span>
              </>
            )}
            <span className="text-muted/70">Est. cost</span>
            <span className="text-accent/90 text-right font-mono">${cost.totalCostUsd.toFixed(4)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
