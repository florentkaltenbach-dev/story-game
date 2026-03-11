"use client";

import type { EnvironmentData } from "@/lib/types";

interface EnvironmentWidgetProps {
  environment: EnvironmentData;
}

export default function EnvironmentWidget({ environment }: EnvironmentWidgetProps) {
  return (
    <div className="space-y-3">
      {/* Condition rows */}
      {environment.conditions.length > 0 && (
        <div className="space-y-1.5">
          {environment.conditions.map((c, i) => (
            <div key={i} className="flex items-baseline justify-between gap-3">
              <span className="text-xs text-muted/70 uppercase tracking-wider font-mono">{c.label}</span>
              <span className="text-sm text-foreground/90 font-mono tabular-nums">
                {c.value}{c.unit ? <span className="text-muted/60 text-xs ml-0.5">{c.unit}</span> : null}
              </span>
            </div>
          ))}
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
