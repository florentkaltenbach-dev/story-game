"use client";

/**
 * Five-Pointed Elder Star — the recurring symbol of the Elder Things.
 * Precise geometry matching the soapstone artifact: five points,
 * smooth center depression, dot patterns at inward angles.
 *
 * The star uses a pentagonal geometry where each point extends outward
 * and the inner vertices form the characteristic concave angles where
 * dot-group writing appears on the physical artifacts.
 */
export function ElderStar({
  size = 48,
  className = "",
  showDots = true,
  showDepression = true,
  broken = false,
  animate = false,
}: {
  size?: number;
  className?: string;
  showDots?: boolean;
  showDepression?: boolean;
  broken?: boolean;
  animate?: boolean;
}) {
  // Five-pointed star geometry: outer points at 54° intervals starting from top
  const cx = 50,
    cy = 50;
  const outerR = 45;
  const innerR = 18;

  const points: [number, number][] = [];
  for (let i = 0; i < 5; i++) {
    const outerAngle = ((i * 72 - 90) * Math.PI) / 180;
    const innerAngle = (((i * 72 + 36) - 90) * Math.PI) / 180;
    points.push([cx + outerR * Math.cos(outerAngle), cy + outerR * Math.sin(outerAngle)]);
    points.push([cx + innerR * Math.cos(innerAngle), cy + innerR * Math.sin(innerAngle)]);
  }

  const starPath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ") + " Z";

  // Dot positions at each inward angle (5 clusters of 3 dots)
  const dotClusters: [number, number][][] = [];
  if (showDots) {
    for (let i = 0; i < 5; i++) {
      const angle = (((i * 72 + 36) - 90) * Math.PI) / 180;
      const bx = cx + (innerR + 4) * Math.cos(angle);
      const by = cy + (innerR + 4) * Math.sin(angle);
      const spread = 2.5;
      dotClusters.push([
        [bx, by - spread],
        [bx - spread * 0.866, by + spread * 0.5],
        [bx + spread * 0.866, by + spread * 0.5],
      ]);
    }
  }

  // Broken tips: clip the outer 20% of each point
  const tipClipPaths = broken
    ? Array.from({ length: 5 }, (_, i) => {
        const angle = ((i * 72 - 90) * Math.PI) / 180;
        const tx = cx + outerR * Math.cos(angle);
        const ty = cy + outerR * Math.sin(angle);
        const clipR = 6;
        return { tx, ty, clipR };
      })
    : [];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`text-accent ${className}`}
      fill="none"
      aria-hidden="true"
    >
      {animate && (
        <style>{`
          @keyframes elder-pulse {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 0.5; }
          }
        `}</style>
      )}

      {/* Star body */}
      <path
        d={starPath}
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.4"
        fill="currentColor"
        fillOpacity="0.06"
        style={animate ? { animation: "elder-pulse 4s ease-in-out infinite" } : undefined}
      />

      {/* Broken tips mask */}
      {tipClipPaths.map(({ tx, ty, clipR }, i) => (
        <circle
          key={i}
          cx={tx}
          cy={ty}
          r={clipR}
          fill="var(--background, #060a11)"
        />
      ))}

      {/* Center depression */}
      {showDepression && (
        <>
          <circle cx={cx} cy={cy} r="6" stroke="currentColor" strokeWidth="0.6" opacity="0.25" />
          <circle cx={cx} cy={cy} r="3" fill="currentColor" opacity="0.1" />
        </>
      )}

      {/* Dot-group writing at inward angles */}
      {dotClusters.map((cluster, ci) =>
        cluster.map((dot, di) => (
          <circle key={`${ci}-${di}`} cx={dot[0]} cy={dot[1]} r="1.2" fill="currentColor" opacity="0.3" />
        ))
      )}
    </svg>
  );
}
