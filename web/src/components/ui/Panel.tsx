"use client";

import { useState, type ReactNode } from "react";

interface PanelProps {
  id: string;
  title: string;
  icon?: ReactNode;
  badge?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

export default function Panel({
  id,
  title,
  icon,
  badge,
  defaultOpen = false,
  children,
}: PanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border" data-panel={id}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-surface-light/30 transition-colors"
      >
        {icon && <span className="text-muted/80 w-4 text-center text-sm">{icon}</span>}
        <h4 className="text-xs font-semibold text-muted tracking-wide uppercase flex-1">
          {title}
        </h4>
        {badge}
        <svg
          className={`w-3 h-3 text-muted/60 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}
