"use client";

/**
 * Stratum Overlay — full-screen atmospheric overlay that intensifies
 * as the narrative descends through reality layers.
 *
 * Stratum I:   Nothing (rational, safe)
 * Stratum II:  Subtle five-point grain (awe, first cracks)
 * Stratum III: Green interference (terror, the tunnels)
 * Stratum IV:  Violet sky breakthrough (post-initiatory, the wound)
 *
 * Uses the CSS classes defined in globals.css (.stratum-i through .stratum-iv).
 */
export function StratumOverlay({
  level = 1,
}: {
  level?: 1 | 2 | 3 | 4;
}) {
  const stratumClass =
    level === 1
      ? "stratum-i"
      : level === 2
        ? "stratum-ii"
        : level === 3
          ? "stratum-iii"
          : "stratum-iv";

  return <div className={`stratum-overlay ${stratumClass}`} aria-hidden="true" />;
}
