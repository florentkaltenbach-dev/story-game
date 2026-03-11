import type { MemoryWrite, DetectedEvent } from "./types";

export interface LocationConfig {
  name: string;
  description?: string;
}

/**
 * Detect location changes in narrative text by matching against known locations.
 * Returns memory writes for Level 1 (plot state) and detected events.
 */
export function detectLocation(
  narrative: string,
  knownLocations: LocationConfig[],
  currentLocation: string
): { memoryWrites: MemoryWrite[]; events: DetectedEvent[] } {
  const memoryWrites: MemoryWrite[] = [];
  const events: DetectedEvent[] = [];

  // Find which known locations are mentioned
  const mentioned: LocationConfig[] = [];
  for (const loc of knownLocations) {
    const pattern = new RegExp(`\\b${escapeRegex(loc.name)}\\b`, "i");
    if (pattern.test(narrative)) {
      mentioned.push(loc);
    }
  }

  if (mentioned.length === 0) return { memoryWrites, events };

  // Use the last mentioned location (most likely the current one in narrative flow)
  const newLocation = mentioned[mentioned.length - 1];

  // Only trigger if location actually changed
  if (newLocation.name.toLowerCase() !== currentLocation.toLowerCase()) {
    events.push({
      type: "location_change",
      data: {
        from: currentLocation,
        to: newLocation.name,
        description: newLocation.description || "",
      },
    });

    memoryWrites.push({
      level: 1,
      key: "current-location",
      value: JSON.stringify({
        location: newLocation.name,
        description: newLocation.description || "",
        updatedAt: new Date().toISOString(),
      }, null, 2),
    });
  }

  return { memoryWrites, events };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
