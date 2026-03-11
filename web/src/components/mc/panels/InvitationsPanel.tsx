import type { Invite } from "@/lib/types";

interface InvitationsPanelProps {
  invites: Invite[];
  onGenerate: () => void;
  onCopy: (token: string) => void;
  copiedToken: string | null;
}

export default function InvitationsPanel({
  invites,
  onGenerate,
  onCopy,
  copiedToken,
}: InvitationsPanelProps) {
  return (
    <div>
      <div className="flex items-center justify-end mb-3">
        <button
          onClick={onGenerate}
          className="text-xs px-2 py-0.5 bg-accent/15 text-accent border border-accent/30 rounded hover:bg-accent/25 transition-colors"
        >
          Generate
        </button>
      </div>
      {invites.length === 0 ? (
        <p className="text-xs text-muted/60 italic">No invitations yet</p>
      ) : (
        <ul className="space-y-1.5">
          {invites.map((inv) => (
            <li key={inv.token} className="flex items-center gap-2">
              <span
                className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                  inv.status === "new"
                    ? "bg-accent"
                    : inv.status === "used"
                      ? "bg-keeper"
                      : "bg-red-400"
                }`}
              />
              <span className="text-xs text-muted/80 font-mono truncate flex-1">
                {inv.token.slice(0, 8)}
              </span>
              {inv.status === "new" ? (
                <button
                  onClick={() => onCopy(inv.token)}
                  className="text-xs text-accent/85 hover:text-accent transition-colors flex-shrink-0"
                >
                  {copiedToken === inv.token ? "copied" : "copy"}
                </button>
              ) : (
                <span className="text-xs text-muted/60 flex-shrink-0">
                  {inv.status === "used" ? inv.usedBy ?? "used" : inv.status}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
