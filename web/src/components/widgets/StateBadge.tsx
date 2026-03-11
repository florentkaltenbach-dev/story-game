"use client";

import { useRef, useEffect } from "react";

interface StateBadgeProps {
  states: string[];
  current: string;
  label?: string;
  variant?: "default" | "danger" | "positive" | "neutral";
  size?: "sm" | "md";
  animate?: boolean;
}

// Color palette from project theme
const COLORS = {
  gold: "#d4b36a",
  goldDim: "rgba(212, 179, 106, 0.35)",
  goldGhost: "rgba(212, 179, 106, 0.12)",
  green: "#7cb88c",
  greenDim: "rgba(124, 184, 140, 0.35)",
  greenGhost: "rgba(124, 184, 140, 0.12)",
  ice: "#8db8d8",
  iceDim: "rgba(141, 184, 216, 0.35)",
  iceGhost: "rgba(141, 184, 216, 0.12)",
  danger: "#c55050",
  orange: "#c8884a",
  muted: "rgba(176, 192, 216, 0.4)",
  mutedLine: "rgba(176, 192, 216, 0.15)",
  labelText: "rgba(176, 192, 216, 0.55)",
  separator: "rgba(42, 58, 85, 0.7)",
};

// Danger variant interpolates through a gradient as states progress
const DANGER_GRADIENT = ["#d4b36a", "#c8a050", "#c8884a", "#c06848", "#c55050"];

function getDangerColor(index: number, total: number): string {
  if (total <= 1) return DANGER_GRADIENT[0];
  const t = index / (total - 1);
  const gradientIdx = t * (DANGER_GRADIENT.length - 1);
  const lo = Math.floor(gradientIdx);
  const hi = Math.min(lo + 1, DANGER_GRADIENT.length - 1);
  const frac = gradientIdx - lo;
  return lerpColor(DANGER_GRADIENT[lo], DANGER_GRADIENT[hi], frac);
}

// Positive variant interpolates from muted toward green
const POSITIVE_GRADIENT = ["rgba(176, 192, 216, 0.5)", "#8aaa8a", "#7cb88c"];

function getPositiveColor(index: number, total: number): string {
  if (total <= 1) return POSITIVE_GRADIENT[0];
  const t = index / (total - 1);
  const gradientIdx = t * (POSITIVE_GRADIENT.length - 1);
  const lo = Math.floor(gradientIdx);
  const hi = Math.min(lo + 1, POSITIVE_GRADIENT.length - 1);
  const frac = gradientIdx - lo;
  return lerpColor(POSITIVE_GRADIENT[lo], POSITIVE_GRADIENT[hi], frac);
}

function lerpColor(a: string, b: string, t: number): string {
  const ca = parseColor(a);
  const cb = parseColor(b);
  if (!ca || !cb) return b;
  const r = Math.round(ca.r + (cb.r - ca.r) * t);
  const g = Math.round(ca.g + (cb.g - ca.g) * t);
  const bl = Math.round(ca.b + (cb.b - ca.b) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

function parseColor(c: string): { r: number; g: number; b: number } | null {
  // Hex
  const hex = c.match(/^#([0-9a-f]{6})$/i);
  if (hex) {
    return {
      r: parseInt(hex[1].slice(0, 2), 16),
      g: parseInt(hex[1].slice(2, 4), 16),
      b: parseInt(hex[1].slice(4, 6), 16),
    };
  }
  // rgb(r, g, b) or rgba(r, g, b, a)
  const rgb = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgb) {
    return { r: +rgb[1], g: +rgb[2], b: +rgb[3] };
  }
  return null;
}

function getNodeColor(
  variant: StateBadgeProps["variant"],
  index: number,
  total: number,
): { active: string; dim: string; ghost: string } {
  switch (variant) {
    case "danger": {
      const c = getDangerColor(index, total);
      return { active: c, dim: withAlpha(c, 0.35), ghost: withAlpha(c, 0.12) };
    }
    case "positive": {
      const c = getPositiveColor(index, total);
      return { active: c, dim: withAlpha(c, 0.35), ghost: withAlpha(c, 0.12) };
    }
    case "neutral":
      return { active: COLORS.ice, dim: COLORS.iceDim, ghost: COLORS.iceGhost };
    default:
      return { active: COLORS.gold, dim: COLORS.goldDim, ghost: COLORS.goldGhost };
  }
}

function withAlpha(color: string, alpha: number): string {
  const parsed = parseColor(color);
  if (!parsed) return color;
  return `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${alpha})`;
}

// Sizing
const SIZES = {
  sm: { r: 3, rActive: 4, gap: 4, lineLen: 10, fontSize: 9, labelSize: 9, svgH: 14 },
  md: { r: 5, rActive: 6.5, gap: 6, lineLen: 14, fontSize: 11, labelSize: 11, svgH: 20 },
};

const ANIM_ID = "state-badge-pulse";

export default function StateBadge({
  states,
  current,
  label,
  variant = "default",
  size = "sm",
  animate = true,
}: StateBadgeProps) {
  const s = SIZES[size];
  const currentIdx = states.indexOf(current);
  const pulseRef = useRef<SVGCircleElement>(null);
  const prevCurrent = useRef(current);

  // Restart pulse animation on state change via DOM
  useEffect(() => {
    if (prevCurrent.current !== current) {
      prevCurrent.current = current;
      const el = pulseRef.current;
      if (el) {
        el.style.animation = "none";
        // Force reflow to restart the animation
        void el.getBoundingClientRect();
        el.style.animation = `${ANIM_ID} 0.6s ease-out forwards`;
      }
    }
  }, [current]);

  // Compute SVG width
  const nodeSpacing = s.r * 2 + s.lineLen;
  const svgWidth = states.length * s.r * 2 + (states.length - 1) * s.lineLen + s.rActive * 2;
  const cy = s.svgH / 2;

  return (
    <div className="inline-flex items-center gap-1.5" style={{ fontFamily: "var(--font-mono, monospace)" }}>
      {/* Keyframes for pulse animation */}
      <style>{`
        @keyframes ${ANIM_ID} {
          0% { transform: scale(1); opacity: 1; }
          40% { transform: scale(1.8); opacity: 0.6; }
          100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>

      {/* Label */}
      {label && (
        <>
          <span
            style={{
              fontSize: s.labelSize,
              color: COLORS.labelText,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </span>
          <span
            style={{
              display: "inline-block",
              width: 1,
              height: s.svgH - 2,
              backgroundColor: COLORS.separator,
              flexShrink: 0,
            }}
          />
        </>
      )}

      {/* State chain SVG */}
      <svg
        width={svgWidth}
        height={s.svgH}
        viewBox={`0 0 ${svgWidth} ${s.svgH}`}
        style={{ overflow: "visible", flexShrink: 0 }}
        role="img"
        aria-label={`State: ${current} (${states.join(" → ")})`}
      >
        {states.map((state, i) => {
          const isPast = currentIdx >= 0 && i < currentIdx;
          const isCurrent = i === currentIdx;
          const isFuture = currentIdx >= 0 ? i > currentIdx : true;

          const nodeR = isCurrent ? s.rActive : s.r;
          const cx = i * nodeSpacing + s.rActive;
          const colors = getNodeColor(variant, i, states.length);

          // Connecting line to the next node
          const nextCx = (i + 1) * nodeSpacing + s.rActive;
          const nextR = i + 1 === currentIdx ? s.rActive : s.r;

          return (
            <g key={state}>
              {/* Connecting line (drawn before the next node) */}
              {i < states.length - 1 && (
                <line
                  x1={cx + nodeR + 1}
                  y1={cy}
                  x2={nextCx - nextR - 1}
                  y2={cy}
                  stroke={isPast || isCurrent ? colors.dim : COLORS.mutedLine}
                  strokeWidth={size === "sm" ? 1 : 1.5}
                  strokeDasharray={isFuture && !isCurrent ? "2,2" : "none"}
                />
              )}

              {/* Pulse ring (animated, only on current when state changes) */}
              {isCurrent && animate && (
                <circle
                  ref={pulseRef}
                  cx={cx}
                  cy={cy}
                  r={nodeR}
                  fill="none"
                  stroke={colors.active}
                  strokeWidth={1}
                  style={{
                    transformOrigin: `${cx}px ${cy}px`,
                    animation: `${ANIM_ID} 0.6s ease-out forwards`,
                  }}
                />
              )}

              {/* Node circle */}
              <circle
                cx={cx}
                cy={cy}
                r={nodeR}
                fill={isCurrent ? colors.active : isPast ? colors.dim : "none"}
                stroke={isCurrent ? colors.active : isPast ? colors.dim : colors.ghost}
                strokeWidth={isCurrent ? 0 : 1}
                style={isCurrent ? {
                  filter: `drop-shadow(0 0 ${size === "sm" ? 3 : 4}px ${withAlpha(colors.active, 0.5)})`,
                } : undefined}
              >
                <title>{state}</title>
              </circle>

              {/* State label (shown below for md size, tooltip only for sm) */}
              {size === "md" && isCurrent && (
                <text
                  x={cx}
                  y={cy + s.rActive + s.fontSize + 1}
                  textAnchor="middle"
                  fill={colors.active}
                  fontSize={s.fontSize}
                  style={{ fontFamily: "var(--font-mono, monospace)" }}
                >
                  {state}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Inline state name for sm size */}
      {size === "sm" && currentIdx >= 0 && (
        <span
          style={{
            fontSize: s.fontSize,
            color: getNodeColor(variant, currentIdx, states.length).active,
            whiteSpace: "nowrap",
          }}
        >
          {current}
        </span>
      )}
    </div>
  );
}
