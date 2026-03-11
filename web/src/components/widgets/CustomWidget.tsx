"use client";

import type { CustomData } from "@/lib/types";

interface CustomWidgetProps {
  custom: CustomData;
}

/** Simple markdown renderer for bold, italic, lists, headers */
function renderSimpleMarkdown(md: string): React.ReactNode[] {
  const lines = md.split("\n");
  const nodes: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Headers
    if (line.startsWith("### ")) {
      nodes.push(<h5 key={i} className="text-xs font-semibold text-foreground/90 mt-2 mb-1 uppercase tracking-wider">{formatInline(line.slice(4))}</h5>);
    } else if (line.startsWith("## ")) {
      nodes.push(<h4 key={i} className="text-sm font-semibold text-accent mt-2 mb-1">{formatInline(line.slice(3))}</h4>);
    } else if (line.startsWith("# ")) {
      nodes.push(<h3 key={i} className="text-sm font-semibold text-accent mt-2 mb-1">{formatInline(line.slice(2))}</h3>);
    }
    // List items
    else if (line.startsWith("- ") || line.startsWith("* ")) {
      nodes.push(
        <div key={i} className="flex items-start gap-2 text-xs text-foreground/80">
          <span className="text-accent/50 mt-0.5">&bull;</span>
          <span>{formatInline(line.slice(2))}</span>
        </div>
      );
    }
    // Empty line
    else if (line.trim() === "") {
      nodes.push(<div key={i} className="h-1.5" />);
    }
    // Plain paragraph
    else {
      nodes.push(<p key={i} className="text-xs text-foreground/80 leading-relaxed">{formatInline(line)}</p>);
    }
  }

  return nodes;
}

/** Inline formatting: **bold**, *italic* */
function formatInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      parts.push(<strong key={keyIdx++} className="font-semibold text-foreground/95">{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<em key={keyIdx++} className="italic">{match[3]}</em>);
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 1 && typeof parts[0] === "string" ? parts[0] : <>{parts}</>;
}

export default function CustomWidget({ custom }: CustomWidgetProps) {
  return <div className="space-y-0.5">{renderSimpleMarkdown(custom.markdown)}</div>;
}
