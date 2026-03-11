"use client";

import { useState } from "react";

interface MemoryLevelSummary {
  fileCount: number;
  files: string[];
}

interface MemoryPanelProps {
  memoryLevels: Record<number, MemoryLevelSummary> | null;
  fileContents?: Record<number, Record<string, string>>;
  onFetchLevel?: (level: number) => void;
}

const LEVEL_NAMES = [
  "Plot State",
  "Character State",
  "Narrative Threads",
  "Thematic Layer",
  "World State",
];

function FileViewer({ content }: { content: string }) {
  // Try to render JSON files with structured display
  try {
    const parsed = JSON.parse(content);
    return (
      <div className="space-y-1">
        {Object.entries(parsed).map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <span className="text-accent/70 font-mono shrink-0">{k}:</span>
            <span className="text-foreground/70 break-words">
              {typeof v === "object" ? JSON.stringify(v) : String(v)}
            </span>
          </div>
        ))}
      </div>
    );
  } catch {
    // Plain text / markdown — show as preformatted
    return (
      <pre className="text-foreground/70 whitespace-pre-wrap break-words leading-relaxed">
        {content}
      </pre>
    );
  }
}

export default function MemoryPanel({ memoryLevels, fileContents, onFetchLevel }: MemoryPanelProps) {
  const [expandedFile, setExpandedFile] = useState<{ level: number; file: string } | null>(null);

  if (!memoryLevels) {
    return <p className="text-xs text-muted/60 italic">Loading...</p>;
  }

  function handleFileClick(levelNum: number, fileName: string) {
    const isSame = expandedFile?.level === levelNum && expandedFile?.file === fileName;
    if (isSame) {
      setExpandedFile(null);
      return;
    }
    // Fetch level contents if not already loaded
    if (!fileContents?.[levelNum] && onFetchLevel) {
      onFetchLevel(levelNum);
    }
    setExpandedFile({ level: levelNum, file: fileName });
  }

  return (
    <ul className="space-y-2.5 text-xs">
      {LEVEL_NAMES.map((level, i) => {
        const levelNum = i + 1;
        const data = memoryLevels[levelNum];
        const hasFiles = data && data.fileCount > 0;
        const levelFiles = fileContents?.[levelNum];

        return (
          <li key={i}>
            <div className="flex items-center gap-2.5">
              <span className="text-accent/80 font-mono text-[10px] w-3 text-right">
                {levelNum}
              </span>
              <span className={hasFiles ? "text-foreground/85" : "text-muted/70"}>
                {level}
              </span>
              {hasFiles && (
                <span className="text-[10px] text-keeper/80 ml-auto">
                  {data.fileCount} file{data.fileCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            {hasFiles && (
              <div className="ml-[22px] mt-1 space-y-0.5">
                {data.files.map((f) => {
                  const isExpanded = expandedFile?.level === levelNum && expandedFile?.file === f;
                  const fileKey = f.replace(/\.[^.]+$/, "");
                  const content = levelFiles?.[fileKey] ?? levelFiles?.[f];

                  return (
                    <div key={f}>
                      <button
                        onClick={() => handleFileClick(levelNum, f)}
                        className={`text-xs text-left w-full truncate transition-colors ${
                          isExpanded
                            ? "text-accent/90"
                            : "text-muted/60 hover:text-foreground/70"
                        }`}
                      >
                        {isExpanded ? "▾ " : "▸ "}{f}
                      </button>
                      {isExpanded && content && (
                        <div className="mt-1 mb-2 ml-3 p-2 bg-surface-light/50 border border-border/30 rounded text-[11px] max-h-48 overflow-y-auto">
                          <FileViewer content={content} />
                        </div>
                      )}
                      {isExpanded && !content && (
                        <p className="mt-1 ml-3 text-[10px] text-muted/50 italic">Loading...</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
