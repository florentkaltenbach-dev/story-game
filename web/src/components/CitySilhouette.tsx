"use client";

/**
 * Dead City Skyline Silhouette — the alien architectural vocabulary
 * rendered as a tiling silhouette strip. Cones, cylinders, truncated
 * pyramids, five-pointed forms, and tubular bridges — the skyline
 * grammar of a billion-year-old non-human city.
 */

import { useId } from "react";

export function CitySilhouette({
  className = "",
  height = 60,
  opacity = 0.15,
}: {
  className?: string;
  height?: number;
  opacity?: number;
}) {
  const raw = useId();
  const id = `city${raw.replace(/:/g, "")}`;

  return (
    <div className={`meander-fade ${className}`} aria-hidden="true">
      <svg
        className="w-full text-accent"
        style={{ height }}
        preserveAspectRatio="none"
      >
        <defs>
          <pattern
            id={id}
            width="240"
            height={height}
            patternUnits="userSpaceOnUse"
          >
            {/* Truncated cone — left */}
            <polygon
              points={`10,${height} 18,${height * 0.3} 28,${height * 0.3} 36,${height}`}
              fill="currentColor"
              opacity="0.6"
            />
            {/* Cylinder with bulbous top */}
            <rect x="42" y={height * 0.25} width="12" height={height * 0.75} fill="currentColor" opacity="0.5" />
            <ellipse cx="48" cy={height * 0.25} rx="8" ry={height * 0.08} fill="currentColor" opacity="0.6" />
            <ellipse cx="48" cy={height * 0.18} rx="5" ry={height * 0.06} fill="currentColor" opacity="0.4" />

            {/* Five-pointed building — central, tallest */}
            <polygon
              points={`80,${height} 75,${height * 0.4} 80,${height * 0.08} 85,${height * 0.4} 90,${height}`}
              fill="currentColor"
              opacity="0.7"
            />
            {/* Spire */}
            <line
              x1="80" y1={height * 0.08}
              x2="80" y2={height * 0.02}
              stroke="currentColor"
              strokeWidth="1"
              opacity="0.4"
            />

            {/* Tubular bridge connecting buildings */}
            <rect x="55" y={height * 0.45} width="20" height="3" rx="1.5" fill="currentColor" opacity="0.3" />

            {/* Terraced pyramid */}
            <polygon
              points={`100,${height} 105,${height * 0.55} 108,${height * 0.55} 108,${height * 0.4} 114,${height * 0.4} 114,${height * 0.25} 120,${height * 0.25} 120,${height * 0.4} 126,${height * 0.4} 126,${height * 0.55} 129,${height * 0.55} 134,${height}`}
              fill="currentColor"
              opacity="0.5"
            />

            {/* Short truncated cone cluster */}
            <polygon
              points={`142,${height} 146,${height * 0.5} 154,${height * 0.5} 158,${height}`}
              fill="currentColor"
              opacity="0.4"
            />
            <polygon
              points={`155,${height} 160,${height * 0.35} 168,${height * 0.35} 173,${height}`}
              fill="currentColor"
              opacity="0.55"
            />

            {/* Another bridge */}
            <rect x="134" y={height * 0.5} width="8" height="2" rx="1" fill="currentColor" opacity="0.25" />

            {/* Cylindrical shaft with scalloped disk top */}
            <rect x="180" y={height * 0.2} width="10" height={height * 0.8} fill="currentColor" opacity="0.5" />
            <ellipse cx="185" cy={height * 0.2} rx="10" ry={height * 0.04} fill="currentColor" opacity="0.5" />
            <ellipse cx="185" cy={height * 0.15} rx="8" ry={height * 0.03} fill="currentColor" opacity="0.4" />
            <ellipse cx="185" cy={height * 0.11} rx="6" ry={height * 0.025} fill="currentColor" opacity="0.3" />

            {/* Low wall connecting to next tile */}
            <rect x="200" y={height * 0.7} width="40" height={height * 0.3} fill="currentColor" opacity="0.3" />
            {/* Arched loopholes in wall */}
            <ellipse cx="210" cy={height * 0.78} rx="3" ry={height * 0.06} fill="black" opacity="0.4" />
            <ellipse cx="225" cy={height * 0.78} rx="3" ry={height * 0.06} fill="black" opacity="0.4" />
          </pattern>
        </defs>
        <rect width="100%" height={height} fill={`url(#${id})`} opacity={opacity} />
      </svg>
    </div>
  );
}
