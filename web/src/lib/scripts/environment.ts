import type { MemoryWrite, DetectedEvent } from "./types";

/**
 * Conservative environment extraction from narrative text.
 * Only extracts when explicit environmental conditions are mentioned
 * with high confidence (specific measurements, clear descriptions).
 */

interface EnvironmentCondition {
  label: string;
  value: string;
  unit?: string;
}

// Patterns for explicit environmental mentions
const PATTERNS: Array<{
  label: string;
  pattern: RegExp;
  extract: (match: RegExpMatchArray) => string;
  unit?: string;
}> = [
  {
    label: "Temperature",
    // Matches: "-30°", "minus 40 degrees", "temperature dropped to -20", "thirty below"
    pattern: /(?:temperature\s+(?:dropped?|fell|rose|climbed|reached)\s+to\s+)?(-?\d+)\s*°\s*([CF])?|(?:minus\s+)?(\d+)\s+(?:degrees?\s+)?(?:below\s+zero|below)/i,
    extract: (m) => m[1] ? `${m[1]}°${m[2] || ""}` : `-${m[3]}°`,
    unit: "temperature",
  },
  {
    label: "Wind",
    // Matches: "winds of 60 knots", "gale force", "hurricane winds", "wind howled"
    pattern: /(?:winds?\s+(?:of\s+)?(\d+)\s*(?:knots?|mph|km\/h))|(?:(gale|hurricane|storm)\s*(?:force)?\s*winds?)|(?:winds?\s+howled|wind\s+(?:screamed|shrieked|roared))/i,
    extract: (m) => m[1] ? `${m[1]} ${m[0].match(/knots?|mph|km\/h/i)?.[0] || "knots"}` : m[2] ? `${m[2]} force` : "severe",
  },
  {
    label: "Visibility",
    // Matches: "visibility dropped to", "whiteout", "zero visibility", "could barely see"
    pattern: /(?:visibility\s+(?:dropped?|fell|reduced)\s+to\s+(\w+))|whiteout|zero\s+visibility|(?:could(?:n't|\s+not|\s+barely)\s+see)/i,
    extract: (m) => m[1] || (m[0].toLowerCase().includes("whiteout") ? "whiteout" : "near-zero"),
  },
  {
    label: "Time of Day",
    // Matches: "midnight sun", "at dawn", "nightfall", "dusk", "first light"
    pattern: /\b(?:midnight\s+sun|at\s+dawn|nightfall|dusk|first\s+light|twilight|sunrise|sunset|midday|noon|midnight)\b/i,
    extract: (m) => m[0].toLowerCase(),
  },
  {
    label: "Weather",
    // Matches: "blizzard", "storm broke", "snow began", "clear skies"
    pattern: /\b(?:blizzard|storm\s+broke|snow\s+(?:began|started|fell)|clear\s+skies?|fog\s+(?:rolled|crept|descended)|ice\s+storm)\b/i,
    extract: (m) => m[0].toLowerCase(),
  },
];

export function extractEnvironment(
  narrative: string
): { memoryWrites: MemoryWrite[]; events: DetectedEvent[] } {
  const memoryWrites: MemoryWrite[] = [];
  const events: DetectedEvent[] = [];
  const conditions: EnvironmentCondition[] = [];

  for (const { label, pattern, extract, unit } of PATTERNS) {
    const match = narrative.match(pattern);
    if (match) {
      conditions.push({
        label,
        value: extract(match),
        unit,
      });
    }
  }

  if (conditions.length === 0) return { memoryWrites, events };

  events.push({
    type: "environment_change",
    data: { conditions },
  });

  memoryWrites.push({
    level: 5,
    key: "current-environment",
    value: JSON.stringify({
      conditions,
      updatedAt: new Date().toISOString(),
    }, null, 2),
  });

  return { memoryWrites, events };
}
