"use client";

import { useId } from "react";

/** Sanitize React useId() for SVG pattern references (colons break url()) */
function useSvgId(prefix: string) {
  const raw = useId();
  return `${prefix}${raw.replace(/:/g, "")}`;
}

/**
 * Greek key meander strip — a tiling ornamental border.
 * Each 32px tile creates one spiral hook of the classic pattern.
 * The tile path connects seamlessly at boundaries: the last point
 * of one tile (32,9) meets the first point of the next (0,9),
 * creating the characteristic interlocking spiral.
 */
export function MeanderStrip({ className = "" }: { className?: string }) {
  const id = useSvgId("meander");
  return (
    <div className={`meander-fade ${className}`} aria-hidden="true">
      <svg className="w-full h-[10px] text-accent" preserveAspectRatio="none">
        <defs>
          <pattern
            id={id}
            width="32"
            height="10"
            patternUnits="userSpaceOnUse"
          >
            <polyline
              points="0,9 0,1 22,1 22,6 8,6 8,9 32,9"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            />
          </pattern>
        </defs>
        <rect
          width="100%"
          height="10"
          fill={`url(#${id})`}
          opacity="0.25"
        />
      </svg>
    </div>
  );
}

/**
 * Ornamental flourish — symmetrical Art Deco divider.
 * Three diamonds (small–large–small) connected by fading lines.
 */
export function Flourish({
  className = "",
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const maxW =
    size === "sm" ? "max-w-48" : size === "lg" ? "max-w-80" : "max-w-64";
  return (
    <div
      className={`flex items-center justify-center ${className}`}
      aria-hidden="true"
    >
      <div className={`flex items-center w-full ${maxW}`}>
        <span className="h-px flex-1 bg-gradient-to-r from-transparent to-accent/40" />
        <svg
          viewBox="0 0 120 20"
          className="w-28 h-5 text-accent shrink-0 mx-1"
          fill="none"
        >
          {/* Left small diamond */}
          <path
            d="M30,6 L36,10 L30,14 L24,10Z"
            stroke="currentColor"
            strokeWidth="0.7"
            opacity="0.35"
            fill="currentColor"
            fillOpacity="0.06"
          />
          {/* Connecting lines */}
          <line
            x1="36"
            y1="10"
            x2="50"
            y2="10"
            stroke="currentColor"
            strokeWidth="0.5"
            opacity="0.25"
          />
          {/* Center diamond — larger, with inner fill */}
          <path
            d="M60,2 L70,10 L60,18 L50,10Z"
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.55"
            fill="currentColor"
            fillOpacity="0.1"
          />
          <path
            d="M60,6 L65,10 L60,14 L55,10Z"
            fill="currentColor"
            opacity="0.2"
          />
          <circle cx="60" cy="10" r="1" fill="currentColor" opacity="0.5" />
          {/* Connecting line */}
          <line
            x1="70"
            y1="10"
            x2="84"
            y2="10"
            stroke="currentColor"
            strokeWidth="0.5"
            opacity="0.25"
          />
          {/* Right small diamond */}
          <path
            d="M90,6 L96,10 L90,14 L84,10Z"
            stroke="currentColor"
            strokeWidth="0.7"
            opacity="0.35"
            fill="currentColor"
            fillOpacity="0.06"
          />
        </svg>
        <span className="h-px flex-1 bg-gradient-to-l from-transparent to-accent/40" />
      </div>
    </div>
  );
}

/**
 * Art Deco stepped corner frame.
 * Adds decorative corners to a container — the stepped L-shape
 * is characteristic of 1930s design, fitting the expedition era.
 */
export function CornerFrame({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const Corner = ({ flip }: { flip: string }) => (
    <svg
      className={`absolute w-5 h-5 text-accent pointer-events-none ${flip}`}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M1,19 L1,5 L3,5 L3,3 L5,3 L5,1 L19,1"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.3"
      />
    </svg>
  );

  return (
    <div className={`relative ${className}`}>
      <Corner flip="top-0 left-0" />
      <Corner flip="top-0 right-0 -scale-x-100" />
      <Corner flip="bottom-0 left-0 -scale-y-100" />
      <Corner flip="bottom-0 right-0 -scale-x-100 -scale-y-100" />
      {children}
    </div>
  );
}

/**
 * Ornamental system message divider — replaces plain hr lines
 * in the story log with small diamond accents flanking the text.
 */
export function SystemDivider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="py-3 flex items-center gap-3 px-4">
      <span className="flex-1 flex items-center gap-1.5 justify-end">
        <span className="h-px flex-1 bg-border/60" />
        <svg
          viewBox="0 0 8 8"
          className="w-1.5 h-1.5 text-accent/40"
          fill="currentColor"
        >
          <path d="M4,0 L8,4 L4,8 L0,4Z" />
        </svg>
      </span>
      {children}
      <span className="flex-1 flex items-center gap-1.5">
        <svg
          viewBox="0 0 8 8"
          className="w-1.5 h-1.5 text-accent/40"
          fill="currentColor"
        >
          <path d="M4,0 L8,4 L4,8 L0,4Z" />
        </svg>
        <span className="h-px flex-1 bg-border/60" />
      </span>
    </div>
  );
}
