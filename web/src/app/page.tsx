import Link from "next/link";
import { Flourish, MeanderStrip, CornerFrame } from "@/components/Ornaments";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-surface/50 to-background" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--accent)_0%,_transparent_70%)] opacity-[0.03]" />

      <main className="relative z-10 text-center px-6 max-w-2xl">
        {/* Title */}
        <div className="mb-10">
          <MeanderStrip className="mb-8 opacity-60" />
          <p className="text-xs tracking-[0.4em] uppercase text-muted mb-4">
            An Interactive Story Experience
          </p>
          <h1 className="narrative-text text-6xl font-bold text-foreground tracking-tight">
            The Ceremony
          </h1>
          <Flourish size="lg" className="mt-6" />
        </div>

        {/* Description */}
        <p className="narrative-text text-foreground/80 text-lg leading-relaxed mb-12">
          Campfire meets theater. An AI-powered story told live, where every
          choice ripples through the dark. The Keeper remembers everything. The
          question is what you&apos;ll wish you could forget.
        </p>

        {/* Entry buttons */}
        <CornerFrame className="inline-flex flex-col sm:flex-row gap-4 justify-center px-6 py-5">
          <Link
            href="/play"
            className="px-8 py-3.5 bg-accent/15 text-accent border border-accent/30 rounded text-sm tracking-wide hover:bg-accent/25 transition-colors"
          >
            Enter as Player
          </Link>
          <Link
            href="/mc"
            className="px-8 py-3.5 bg-surface-light text-muted border border-border rounded text-sm tracking-wide hover:text-foreground hover:border-muted/50 transition-colors"
          >
            MC Dashboard
          </Link>
        </CornerFrame>

        {/* Current session */}
        <div className="mt-12 text-xs text-muted/70">
          <MeanderStrip className="mb-4 opacity-40" />
          <p>Current preset: At the Mountains of Madness</p>
        </div>
      </main>
    </div>
  );
}
