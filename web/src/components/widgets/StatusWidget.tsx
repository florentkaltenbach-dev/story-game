"use client";

import type { StatusData } from "@/lib/types";

interface StatusWidgetProps {
  status: StatusData;
}

const COLOR_MAP: Record<string, string> = {
  green: "text-keeper",
  red: "text-danger",
  yellow: "text-accent",
  blue: "text-ice",
};

export default function StatusWidget({ status }: StatusWidgetProps) {
  if (status.entries.length === 0) {
    return <p className="text-xs text-muted/60 italic">No status data</p>;
  }

  return (
    <div className="space-y-1.5">
      {status.entries.map((entry, i) => (
        <div key={i} className="flex items-baseline justify-between gap-3">
          <span className="text-xs text-muted/70 uppercase tracking-wider font-mono">{entry.label}</span>
          <span className={`text-sm font-mono ${entry.color ? (COLOR_MAP[entry.color] || "text-foreground/90") : "text-foreground/90"}`}>
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}
