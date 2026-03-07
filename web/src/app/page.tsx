import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-surface/50 to-background" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--accent)_0%,_transparent_70%)] opacity-[0.03]" />

      <main className="relative z-10 text-center px-6 max-w-2xl">
        {/* Title */}
        <div className="mb-12">
          <p className="text-xs tracking-[0.4em] uppercase text-muted mb-4">
            An Interactive Story Experience
          </p>
          <h1 className="narrative-text text-6xl font-bold text-foreground tracking-tight">
            The Ceremony
          </h1>
          <div className="mt-4 flex items-center justify-center gap-4">
            <span className="h-px w-16 bg-accent/40" />
            <span className="text-accent text-xs tracking-widest">&#9670;</span>
            <span className="h-px w-16 bg-accent/40" />
          </div>
        </div>

        {/* Description */}
        <p className="narrative-text text-foreground/60 text-lg leading-relaxed mb-16">
          Campfire meets theater. An AI-powered story told live, where every
          choice ripples through the dark. The Keeper remembers everything. The
          question is what you&apos;ll wish you could forget.
        </p>

        {/* Entry buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
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
        </div>

        {/* Current session */}
        <div className="mt-16 text-xs text-muted/50">
          <p>Current preset: At the Mountains of Madness</p>
        </div>
      </main>
    </div>
  );
}
