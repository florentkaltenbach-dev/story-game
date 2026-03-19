"use client";

/**
 * Radio Signal Decay — SVG waveform that degrades across sessions.
 * Visualizes the expedition's radio contact deteriorating from
 * full signal (S0) to total blackout (S3-4).
 *
 * The waveform is generated as a series of vertical bars with
 * varying heights. As the session progresses, gaps appear,
 * amplitude drops, and noise increases until flatline.
 */
export function RadioSignal({
  session = 0,
  width = 160,
  height = 32,
  className = "",
}: {
  session?: 0 | 1 | 2 | 3 | 4;
  width?: number;
  height?: number;
  className?: string;
}) {
  const barCount = 40;
  const barWidth = width / barCount;
  const midY = height / 2;

  // Seeded RNG for consistent waveform
  const rng = (n: number) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };

  const bars: { x: number; h: number; opacity: number }[] = [];

  for (let i = 0; i < barCount; i++) {
    const t = i / barCount;
    const baseAmplitude = Math.sin(t * Math.PI * 3) * 0.6 + 0.4;
    const noise = (rng(i * 7) - 0.5) * 0.3;

    let amplitude: number;
    let opacity: number;
    let dropout: boolean;

    switch (session) {
      case 0:
        // Full signal — clean waveform
        amplitude = baseAmplitude + noise * 0.1;
        opacity = 0.5;
        dropout = false;
        break;
      case 1:
        // Crackle — occasional interference
        amplitude = baseAmplitude + noise * 0.3;
        opacity = 0.4;
        dropout = rng(i * 13) > 0.85;
        break;
      case 2:
        // Fragments — heavy interference, signal barely there
        amplitude = baseAmplitude * 0.5 + noise * 0.5;
        opacity = 0.3;
        dropout = rng(i * 17) > 0.6;
        break;
      case 3:
        // Near-flatline — rare spikes in noise
        amplitude = noise * 0.3;
        opacity = 0.2;
        dropout = rng(i * 23) > 0.3;
        break;
      case 4:
      default:
        // Total silence
        amplitude = 0;
        opacity = 0.1;
        dropout = true;
        break;
    }

    if (dropout) {
      amplitude = 0;
      opacity *= 0.3;
    }

    const h = Math.max(1, Math.abs(amplitude) * (height * 0.4));
    bars.push({ x: i * barWidth, h, opacity });
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
      {/* Baseline */}
      <line
        x1="0" y1={midY}
        x2={width} y2={midY}
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.1"
      />

      {/* Signal bars */}
      {bars.map((bar, i) => (
        <rect
          key={i}
          x={bar.x + barWidth * 0.15}
          y={midY - bar.h / 2}
          width={barWidth * 0.7}
          height={bar.h}
          fill="currentColor"
          opacity={bar.opacity}
          rx="0.5"
        />
      ))}

      {/* Session label indicator — small dots */}
      {Array.from({ length: 5 }, (_, i) => (
        <circle
          key={`s-${i}`}
          cx={width - 4 - (4 - i) * 6}
          cy={height - 4}
          r="1.5"
          fill="currentColor"
          opacity={i <= session ? 0.5 : 0.1}
        />
      ))}
    </svg>
  );
}
