"use client";

import type { NpcDossierData } from "@/lib/types";
import StateBadge from "./StateBadge";

interface NpcDossierWidgetProps {
  npc: NpcDossierData;
}

const DANGER_CHAIN = ["neutral", "wary", "suspicious", "hostile"] as const;
const POSITIVE_CHAIN = ["neutral", "curious", "friendly", "allied"] as const;

function getAttitudeChain(attitude: string): {
  states: string[];
  variant: "danger" | "positive";
} {
  const lower = attitude.toLowerCase();
  if ((POSITIVE_CHAIN as readonly string[]).includes(lower)) {
    return { states: [...POSITIVE_CHAIN], variant: "positive" };
  }
  if ((DANGER_CHAIN as readonly string[]).includes(lower)) {
    return { states: [...DANGER_CHAIN], variant: "danger" };
  }
  // Default fallback
  return { states: [...DANGER_CHAIN], variant: "danger" };
}

export default function NpcDossierWidget({ npc }: NpcDossierWidgetProps) {
  const attitudeBadge = npc.attitude ? getAttitudeChain(npc.attitude) : null;

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
      {npc.attitude && attitudeBadge && (
        <StateBadge
          states={attitudeBadge.states}
          current={npc.attitude.toLowerCase()}
          variant={attitudeBadge.variant}
          size="sm"
        />
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
