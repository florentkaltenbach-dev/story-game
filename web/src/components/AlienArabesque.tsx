"use client";

import { useId } from "react";

/**
 * Alien Arabesque Band — tileable geometric ornament based on fives.
 * Distinct from the existing Greek meander: this uses pentagonal
 * symmetry with "depressed lines 1-2 inches deep" forming
 * "obscurely symmetrical curves and angles based on quantity of five."
 *
 * The pattern tiles a single 60px-wide unit that interlocks
 * via shared edge geometry — five-fold rotational motifs connected
 * by angular bridges.
 */
export function AlienArabesque({ className = "" }: { className?: string }) {
  const raw = useId();
  const id = `arabesque${raw.replace(/:/g, "")}`;

  return (
    <div className={`meander-fade ${className}`} aria-hidden="true">
      <svg className="w-full h-[14px] text-accent" preserveAspectRatio="none">
        <defs>
          <pattern
            id={id}
            width="60"
            height="14"
            patternUnits="userSpaceOnUse"
          >
            {/* Five-pointed angular motif — the alien geometry */}
            {/* Central pentagon formed by angular strokes */}
            <polyline
              points="0,7 6,3 12,7 9,12 3,12 0,7"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity="0.3"
            />
            {/* Bridge to next unit */}
            <line x1="12" y1="7" x2="18" y2="7" stroke="currentColor" strokeWidth="0.6" opacity="0.15" />
            {/* Angular zigzag bridge */}
            <polyline
              points="18,7 22,3 26,7 22,11 18,7"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.6"
              opacity="0.2"
            />
            {/* Second bridge */}
            <line x1="26" y1="7" x2="34" y2="7" stroke="currentColor" strokeWidth="0.6" opacity="0.15" />
            {/* Inverted pentagon */}
            <polyline
              points="34,7 37,3 43,3 46,7 43,11 37,11 34,7"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity="0.25"
            />
            {/* Five dots at the center of the hex */}
            <circle cx="40" cy="5" r="0.8" fill="currentColor" opacity="0.25" />
            <circle cx="38" cy="7" r="0.8" fill="currentColor" opacity="0.25" />
            <circle cx="42" cy="7" r="0.8" fill="currentColor" opacity="0.25" />
            <circle cx="39" cy="9" r="0.8" fill="currentColor" opacity="0.25" />
            <circle cx="41" cy="9" r="0.8" fill="currentColor" opacity="0.25" />
            {/* Final bridge to tile edge */}
            <line x1="46" y1="7" x2="54" y2="7" stroke="currentColor" strokeWidth="0.6" opacity="0.15" />
            {/* Partial pentagon at tile edge (completed by next tile's start) */}
            <polyline
              points="54,7 57,3 60,7"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity="0.3"
            />
            <polyline
              points="60,7 57,12 54,7"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity="0.3"
            />
          </pattern>
        </defs>
        <rect width="100%" height="14" fill={`url(#${id})`} opacity="0.25" />
      </svg>
    </div>
  );
}
