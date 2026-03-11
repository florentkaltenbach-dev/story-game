"use client";

import type { EnvironmentData } from "@/lib/types";
import StateBadge from "./StateBadge";

interface EnvironmentWidgetProps {
  environment: EnvironmentData;
}

const STATE_CHAINS: {
  match: (label: string) => boolean;
  states: string[];
  variant: "neutral" | "danger";
}[] = [
  { match: (l) => l.includes("radio"), states: ["clear", "static", "degraded", "intermittent", "blackout"], variant: "neutral" },
  { match: (l) => l.includes("fuel"), states: ["full", "adequate", "low", "critical", "empty"], variant: "danger" },
  { match: (l) => l.includes("weather"), states: ["calm", "wind", "storm", "whiteout"], variant: "neutral" },
  { match: (l) => l.includes("injury") || l.includes("condition"), states: ["healthy", "shaken", "injured", "critical", "incapacitated"], variant: "danger" },
];

function getChainForCondition(label: string, value: string): { states: string[]; variant: "neutral" | "danger" } | null {
  const lowerLabel = label.toLowerCase();
  const lowerValue = value.toLowerCase();
  for (const chain of STATE_CHAINS) {
    if (chain.match(lowerLabel) && chain.states.includes(lowerValue)) {
      return chain;
    }
  }
  return null;
}

export default function EnvironmentWidget({ environment }: EnvironmentWidgetProps) {
  return (
    <div className="space-y-3">
      {/* Condition rows */}
      {environment.conditions.length > 0 && (
        <div className="space-y-1.5">
          {environment.conditions.map((c, i) => {
            const chain = getChainForCondition(c.label, c.value);
            return (
              <div key={i} className="flex items-baseline justify-between gap-3">
                <span className="text-xs text-muted/70 uppercase tracking-wider font-mono">{c.label}</span>
                {chain ? (
                  <StateBadge
                    states={chain.states}
                    current={c.value.toLowerCase()}
                    variant={chain.variant}
                    size="sm"
                  />
                ) : (
                  <span className="text-sm text-foreground/90 font-mono tabular-nums">
                    {c.value}{c.unit ? <span className="text-muted/60 text-xs ml-0.5">{c.unit}</span> : null}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Narrative */}
      {environment.narrative && (
        <>
          <div className="h-px bg-border" />
          <p className="narrative-text text-xs text-foreground/70 leading-relaxed italic">
            {environment.narrative}
          </p>
        </>
      )}
    </div>
  );
}
