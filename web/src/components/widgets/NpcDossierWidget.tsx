"use client";

import type { NpcDossierData } from "@/lib/types";

interface NpcDossierWidgetProps {
  npc: NpcDossierData;
}

const ATTITUDE_COLORS: Record<string, string> = {
  friendly: "text-keeper bg-keeper/10 border-keeper/20",
  neutral: "text-muted bg-surface-light border-border",
  suspicious: "text-accent bg-accent/10 border-accent/20",
  hostile: "text-danger bg-danger/10 border-danger/20",
};

export default function NpcDossierWidget({ npc }: NpcDossierWidgetProps) {
  const attitudeClass = npc.attitude
    ? ATTITUDE_COLORS[npc.attitude.toLowerCase()] || ATTITUDE_COLORS.neutral
    : null;

  return (
    <div className="space-y-3">
      {/* Name + role */}
      <div>
        <h5 className="text-sm text-accent tracking-wide" style={{ fontFamily: "Georgia, serif" }}>
          {npc.name}
        </h5>
        <p className="text-xs text-muted/70 font-mono uppercase tracking-wider">{npc.role}</p>
      </div>

      {/* Attitude badge */}
      {npc.attitude && attitudeClass && (
        <span className={`inline-block text-[10px] px-2 py-0.5 rounded border ${attitudeClass}`}>
          {npc.attitude}
        </span>
      )}

      {/* Description */}
      {npc.description && (
        <p className="narrative-text text-xs text-foreground/80 leading-relaxed">
          {npc.description}
        </p>
      )}

      {/* Known facts */}
      {npc.knownFacts.length > 0 && (
        <div>
          <p className="dossier-label text-[10px] mb-1.5">Known</p>
          <ul className="space-y-1">
            {npc.knownFacts.map((fact, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-foreground/70">
                <span className="text-accent/50 mt-0.5">&bull;</span>
                <span>{fact}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
