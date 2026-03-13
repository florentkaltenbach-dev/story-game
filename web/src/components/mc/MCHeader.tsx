import type { Session, PresetCharacter } from "@/lib/types";
import type { Breakpoint } from "@/hooks/useBreakpoint";
import ActionMenu from "./ActionMenu";
import { MeanderStrip } from "../Ornaments";

interface MCHeaderProps {
  session: Session | null;
  breakpoint: Breakpoint;
  mcCharacter?: PresetCharacter | null;
  onSessionAction: (action: string) => void;
  onReset: () => void;
  onLoadPreset: () => void;
  onLogout: () => void;
}

function HeaderStatus({ session, compact }: { session: Session | null; compact?: boolean }) {
  if (!session) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-mono text-accent/85 bg-accent/10 px-1.5 py-0.5 rounded border border-accent/20">
        S{session.number} {compact ? `A${session.act}` : `Act ${session.act}/4`}
      </span>
      <span className="relative flex h-2 w-2">
        {session.status === "active" && (
          <span className="absolute inline-flex h-full w-full rounded-full bg-keeper opacity-40 animate-ping" />
        )}
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${
            session.status === "active"
              ? "bg-keeper"
              : session.status === "paused"
                ? "bg-accent"
                : "bg-muted/50"
          }`}
        />
      </span>
      <span className="text-xs text-muted">{session.status}</span>
      {!compact && (
        <>
          <span className="text-xs text-muted/50">|</span>
          <span className="text-xs text-muted">
            {session.players.length}p
          </span>
        </>
      )}
    </div>
  );
}

export default function MCHeader({
  session,
  breakpoint,
  mcCharacter,
  onSessionAction,
  onReset,
  onLoadPreset,
  onLogout,
}: MCHeaderProps) {
  const isWide = breakpoint === "wide";

  return (
    <>
      <div className="flex items-center justify-between px-4 py-2 bg-surface gap-2">
        <div className="flex items-center gap-3 flex-shrink-0">
          <h1 className="narrative-text text-lg text-accent">The Ceremony</h1>
          <span className="text-[10px] tracking-widest uppercase text-muted bg-surface-light px-2 py-0.5 rounded border border-border">
            MC
          </span>
          {mcCharacter && (
            <span className="text-xs text-ice/80 truncate max-w-[160px]" title={mcCharacter.name}>
              {mcCharacter.name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 min-w-0">
          <HeaderStatus session={session} compact={breakpoint === "narrow"} />

          {isWide && (
            <div className="flex items-center gap-2 ml-2">
              <button
                onClick={() => onSessionAction("start")}
                disabled={session?.status === "active"}
                className="text-xs px-3 py-1 bg-keeper/20 text-keeper border border-keeper/30 rounded hover:bg-keeper/30 transition-colors disabled:opacity-50"
              >
                Start
              </button>
              <button
                onClick={() => onSessionAction("pause")}
                disabled={session?.status !== "active" && session?.status !== "paused"}
                className={`text-xs px-3 py-1 rounded border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  session?.status === "paused"
                    ? "bg-accent/20 text-accent border-accent/30 hover:bg-accent/30"
                    : "bg-surface-light text-muted border-border hover:text-foreground"
                }`}
              >
                {session?.status === "paused" ? "Resume" : "Pause"}
              </button>
              <button
                onClick={() => onSessionAction("toggle_keeper")}
                className={`text-xs px-3 py-1 rounded border transition-colors ${
                  session?.keeperAutoRespond
                    ? "bg-keeper/20 text-keeper border-keeper/30 shadow-[0_0_6px_rgba(var(--keeper-rgb),0.3)]"
                    : "bg-surface-light text-muted/70 border-border hover:text-muted"
                }`}
              >
                {session?.keeperAutoRespond ? "Keeper Active" : "Keeper Silent"}
              </button>
            </div>
          )}

          <ActionMenu
            session={session}
            onSessionAction={onSessionAction}
            onReset={onReset}
            onLoadPreset={onLoadPreset}
            onLogout={onLogout}
          />
        </div>
      </div>
      <MeanderStrip className="opacity-50" />
    </>
  );
}
