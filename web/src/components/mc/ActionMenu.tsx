"use client";

import { useState, useRef, useEffect } from "react";
import type { Session } from "@/lib/types";

interface ActionMenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  hidden?: boolean;
  separator?: boolean;
}

interface ActionMenuProps {
  session: Session | null;
  onSessionAction: (action: string) => void;
  onReset: () => void;
  onLoadPreset: () => void;
  onLogout: () => void;
}

export default function ActionMenu({
  session,
  onSessionAction,
  onReset,
  onLoadPreset,
  onLogout,
}: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const isActive = session?.status === "active";
  const isPaused = session?.status === "paused";
  const isEnded = session?.status === "ended";
  const isRunning = isActive || isPaused;

  const items: ActionMenuItem[] = [
    {
      label: "Start Session",
      onClick: () => onSessionAction("start"),
      disabled: isActive,
    },
    {
      label: isPaused ? "Resume" : "Pause",
      onClick: () => onSessionAction("pause"),
      disabled: !isRunning,
    },
    {
      label: session?.keeperAutoRespond ? "Keeper → Silent" : "Keeper → Active",
      onClick: () => onSessionAction("toggle_keeper"),
    },
    { label: "", onClick: () => {}, separator: true },
    {
      label: "Next Act",
      onClick: () => onSessionAction("advance_act"),
      disabled: !isRunning || (session?.act ?? 0) >= 4,
      hidden: !isRunning,
    },
    {
      label: "End Session",
      onClick: () => onSessionAction("end_session"),
      danger: true,
      hidden: !isRunning,
    },
    {
      label: "Next Session",
      onClick: () => onSessionAction("next_session"),
      hidden: !isEnded || (session?.number ?? 0) >= 4,
    },
    { label: "", onClick: () => {}, separator: true },
    {
      label: "Load Preset",
      onClick: onLoadPreset,
      danger: true,
    },
    {
      label: "Reset Everything",
      onClick: onReset,
      danger: true,
    },
    {
      label: "Logout",
      onClick: onLogout,
    },
  ];

  const visibleItems = items.filter((i) => !i.hidden);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 text-muted/70 hover:text-foreground transition-colors rounded hover:bg-surface-light"
        title="Actions"
      >
        <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
          <circle cx="10" cy="4" r="1.5" />
          <circle cx="10" cy="10" r="1.5" />
          <circle cx="10" cy="16" r="1.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-surface border border-border rounded-lg shadow-xl z-50 py-1 overflow-hidden">
          {visibleItems.map((item, i) =>
            item.separator ? (
              <div key={i} className="h-px bg-border my-1" />
            ) : (
              <button
                key={i}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
                disabled={item.disabled}
                className={`w-full text-left px-3 py-1.5 text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  item.danger
                    ? "text-red-400 hover:bg-red-500/10"
                    : "text-foreground/85 hover:bg-surface-light"
                }`}
              >
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
