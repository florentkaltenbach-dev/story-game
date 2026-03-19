"use client";

/**
 * Dot-Group Writing — procedural Elder Thing text system.
 * Generates mathematically-patterned dot clusters resembling
 * the cartouche inscriptions found on city walls and artifacts.
 *
 * Lovecraft describes: "oddly patterned groups of dots" in depressions
 * ~1.5 inches deep with dots ~0.5 inch deeper. The pattern implies
 * a systematic notation — possibly base-5 given the Elder Thing
 * obsession with pentagonal symmetry.
 */
export function DotScript({
  width = 200,
  height = 32,
  seed = 0,
  density = "normal",
  className = "",
}: {
  width?: number;
  height?: number;
  seed?: number;
  density?: "sparse" | "normal" | "dense";
  className?: string;
}) {
  // Seeded pseudo-random for deterministic generation
  const rng = (n: number) => {
    const x = Math.sin(seed * 127.1 + n * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };

  const groupCount = density === "sparse" ? 3 : density === "dense" ? 8 : 5;
  const padding = 8;
  const groupSpacing = (width - padding * 2) / groupCount;

  const groups: { cx: number; cy: number; dots: [number, number][] }[] = [];

  for (let g = 0; g < groupCount; g++) {
    const gcx = padding + groupSpacing * (g + 0.5);
    const gcy = height / 2;

    // Each group has 1-5 dots in a base-5 pattern
    const dotCount = Math.floor(rng(g * 7) * 5) + 1;
    const dots: [number, number][] = [];

    // Arrange in pentagonal or linear sub-patterns
    if (dotCount <= 2) {
      // Linear pair
      for (let d = 0; d < dotCount; d++) {
        dots.push([gcx + (d - (dotCount - 1) / 2) * 4, gcy]);
      }
    } else {
      // Pentagonal arrangement (partial)
      for (let d = 0; d < dotCount; d++) {
        const angle = ((d * 72 - 90) * Math.PI) / 180;
        const r = 4 + rng(g * 13 + d) * 2;
        dots.push([gcx + r * Math.cos(angle), gcy + r * Math.sin(angle)]);
      }
    }

    groups.push({ cx: gcx, cy: gcy, dots });
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`text-accent ${className}`}
      fill="none"
      aria-hidden="true"
    >
      {/* Depression background for each group */}
      {groups.map((g, i) => (
        <ellipse
          key={`bg-${i}`}
          cx={g.cx}
          cy={g.cy}
          rx={groupSpacing * 0.35}
          ry={height * 0.32}
          fill="currentColor"
          opacity="0.04"
        />
      ))}

      {/* Dots */}
      {groups.map((g, gi) =>
        g.dots.map((d, di) => (
          <circle
            key={`${gi}-${di}`}
            cx={d[0]}
            cy={d[1]}
            r="1.5"
            fill="currentColor"
            opacity={0.25 + rng(gi * 31 + di * 17) * 0.15}
          />
        ))
      )}

      {/* Thin separator lines between groups */}
      {groups.slice(0, -1).map((g, i) => {
        const next = groups[i + 1];
        const mx = (g.cx + next.cx) / 2;
        return (
          <line
            key={`sep-${i}`}
            x1={mx}
            y1={height * 0.3}
            x2={mx}
            y2={height * 0.7}
            stroke="currentColor"
            strokeWidth="0.5"
            opacity="0.1"
          />
        );
      })}
    </svg>
  );
}
