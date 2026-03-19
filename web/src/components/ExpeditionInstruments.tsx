"use client";

/**
 * Expedition Instruments — period-accurate 1930s instrument cluster.
 * Compass (with magnetic drift near Elder Thing artifacts),
 * thermometer, and barometer rendered as SVG gauges.
 */

export function Compass({
  bearing = 0,
  drift = 0,
  size = 64,
  className = "",
}: {
  bearing?: number;
  drift?: number;
  size?: number;
  className?: string;
}) {
  const cx = 50, cy = 50;
  const needleAngle = bearing + drift;
  const rad = (needleAngle - 90) * Math.PI / 180;
  const needleLen = 30;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`text-accent ${className}`}
      fill="none"
      aria-hidden="true"
    >
      {/* Outer ring */}
      <circle cx={cx} cy={cy} r="44" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <circle cx={cx} cy={cy} r="42" stroke="currentColor" strokeWidth="0.5" opacity="0.15" />

      {/* Cardinal tick marks */}
      {[0, 90, 180, 270].map((angle) => {
        const r1 = 38, r2 = 42;
        const a = (angle - 90) * Math.PI / 180;
        return (
          <line
            key={angle}
            x1={cx + r1 * Math.cos(a)} y1={cy + r1 * Math.sin(a)}
            x2={cx + r2 * Math.cos(a)} y2={cy + r2 * Math.sin(a)}
            stroke="currentColor" strokeWidth="1.2" opacity="0.4"
          />
        );
      })}

      {/* Minor tick marks (every 30°) */}
      {Array.from({ length: 12 }, (_, i) => i * 30).filter(a => a % 90 !== 0).map((angle) => {
        const r1 = 39, r2 = 42;
        const a = (angle - 90) * Math.PI / 180;
        return (
          <line
            key={angle}
            x1={cx + r1 * Math.cos(a)} y1={cy + r1 * Math.sin(a)}
            x2={cx + r2 * Math.cos(a)} y2={cy + r2 * Math.sin(a)}
            stroke="currentColor" strokeWidth="0.6" opacity="0.2"
          />
        );
      })}

      {/* Needle — north half (red-tinted) */}
      <line
        x1={cx} y1={cy}
        x2={cx + needleLen * Math.cos(rad)} y2={cy + needleLen * Math.sin(rad)}
        stroke="var(--danger, #c55050)" strokeWidth="1.5" opacity="0.6"
      />
      {/* Needle — south half */}
      <line
        x1={cx} y1={cy}
        x2={cx - needleLen * 0.6 * Math.cos(rad)} y2={cy - needleLen * 0.6 * Math.sin(rad)}
        stroke="currentColor" strokeWidth="1" opacity="0.3"
      />

      {/* Center pivot */}
      <circle cx={cx} cy={cy} r="2.5" fill="currentColor" opacity="0.4" />

      {/* Drift indicator — subtle red arc showing deviation */}
      {Math.abs(drift) > 2 && (
        <circle
          cx={cx} cy={cy} r="34"
          stroke="var(--danger, #c55050)"
          strokeWidth="0.8"
          strokeDasharray="4 8"
          opacity={Math.min(0.3, Math.abs(drift) / 30)}
        />
      )}
    </svg>
  );
}

export function Thermometer({
  temp = 0,
  size = 64,
  className = "",
}: {
  temp?: number;
  className?: string;
  size?: number;
}) {
  // Map temp range: -40 to 40°F → 0 to 1
  const t = Math.max(0, Math.min(1, (temp + 40) / 80));
  const barHeight = 50 * t;

  return (
    <svg
      width={size * 0.35}
      height={size}
      viewBox="0 0 20 60"
      className={`text-accent ${className}`}
      fill="none"
      aria-hidden="true"
    >
      {/* Tube */}
      <rect x="7" y="5" width="6" height="45" rx="3" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />

      {/* Bulb */}
      <circle cx="10" cy="52" r="5" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
      <circle cx="10" cy="52" r="3.5" fill="var(--danger, #c55050)" opacity="0.4" />

      {/* Mercury column */}
      <rect
        x="8.5"
        y={50 - barHeight}
        width="3"
        height={barHeight}
        fill="var(--danger, #c55050)"
        opacity="0.35"
        rx="1.5"
      />

      {/* Tick marks */}
      {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
        <line
          key={i}
          x1="14" y1={5 + 45 * (1 - p)}
          x2="16" y2={5 + 45 * (1 - p)}
          stroke="currentColor" strokeWidth="0.5" opacity="0.2"
        />
      ))}
    </svg>
  );
}

export function Barometer({
  pressure = 30,
  size = 64,
  className = "",
}: {
  pressure?: number;
  size?: number;
  className?: string;
}) {
  // Map pressure 28-31 inHg → needle angle -60 to 60
  const t = Math.max(0, Math.min(1, (pressure - 28) / 3));
  const angle = -60 + t * 120;
  const rad = (angle - 90) * Math.PI / 180;
  const cx = 50, cy = 55;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`text-accent ${className}`}
      fill="none"
      aria-hidden="true"
    >
      {/* Dial arc */}
      <path
        d="M 15,55 A 40,40 0 0,1 85,55"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.3"
      />

      {/* Tick marks along arc */}
      {Array.from({ length: 7 }, (_, i) => {
        const a = ((-60 + i * 20) - 90) * Math.PI / 180;
        const r1 = 36, r2 = 40;
        return (
          <line
            key={i}
            x1={cx + r1 * Math.cos(a)} y1={cy + r1 * Math.sin(a)}
            x2={cx + r2 * Math.cos(a)} y2={cy + r2 * Math.sin(a)}
            stroke="currentColor" strokeWidth="0.8" opacity="0.25"
          />
        );
      })}

      {/* Needle */}
      <line
        x1={cx} y1={cy}
        x2={cx + 30 * Math.cos(rad)} y2={cy + 30 * Math.sin(rad)}
        stroke="currentColor" strokeWidth="1.2" opacity="0.5"
      />

      {/* Pivot */}
      <circle cx={cx} cy={cy} r="2" fill="currentColor" opacity="0.4" />
    </svg>
  );
}

/** Instrument cluster: compass + thermometer + barometer in a row */
export function InstrumentCluster({
  bearing = 0,
  drift = 0,
  temp = 0,
  pressure = 30,
  size = 48,
  className = "",
}: {
  bearing?: number;
  drift?: number;
  temp?: number;
  pressure?: number;
  size?: number;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`} aria-hidden="true">
      <Compass bearing={bearing} drift={drift} size={size} />
      <Thermometer temp={temp} size={size} />
      <Barometer pressure={pressure} size={size} />
    </div>
  );
}
