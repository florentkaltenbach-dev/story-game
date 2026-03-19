"use client";

import type { StatusData } from "@/lib/types";
import { STATE_CHAINS } from "@/lib/types";
import StateBadge from "./StateBadge";

interface StatusWidgetProps {
  status: StatusData;
}

const COLOR_MAP: Record<string, string> = {
  green: "text-keeper",
  red: "text-danger",
  yellow: "text-accent",
  blue: "text-ice",
};

/** Match a status entry's label/value against known STATE_CHAINS. */
const CHAIN_MATCHERS: Array<{
  match: (label: string) => boolean;
  chainKey: string;
}> = [
  { match: (l) => l.includes("radio"), chainKey: "radio-condition" },
  { match: (l) => l.includes("fuel"), chainKey: "fuel-level" },
  { match: (l) => l.includes("weather"), chainKey: "weather" },
  { match: (l) => l.includes("injury") || l.includes("condition") || l.includes("health"), chainKey: "injury-severity" },
  { match: (l) => l.includes("thread"), chainKey: "narrative-thread" },
];

function getChainForEntry(label: string, value: string): { states: string[]; variant: "default" | "danger" | "positive" | "neutral" } | null {
  const lowerLabel = label.toLowerCase();
  const lowerValue = value.toLowerCase();
  for (const matcher of CHAIN_MATCHERS) {
    const chain = STATE_CHAINS[matcher.chainKey];
    if (chain && matcher.match(lowerLabel) && chain.states.includes(lowerValue)) {
      return chain;
    }
  }
  return null;
}

export default function StatusWidget({ status }: StatusWidgetProps) {
  if (status.entries.length === 0) {
    return <p className="text-xs text-muted/60 italic">No status data</p>;
  }

  return (
    <div className="space-y-1.5">
      {status.entries.map((entry, i) => {
        const chain = getChainForEntry(entry.label, entry.value);
        return (
          <div key={i} className="flex items-baseline justify-between gap-3">
            <span className="text-xs text-muted/70 uppercase tracking-wider font-mono">{entry.label}</span>
            {chain ? (
              <StateBadge
                states={[...chain.states]}
                current={entry.value.toLowerCase()}
                variant={chain.variant}
                size="sm"
              />
            ) : (
              <span className={`text-sm font-mono ${entry.color ? (COLOR_MAP[entry.color] || "text-foreground/90") : "text-foreground/90"}`}>
                {entry.value}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
