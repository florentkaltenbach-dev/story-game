"use client";

import { useEffect, useRef } from "react";
import { Message } from "@/lib/types";
import { SystemDivider } from "./Ornaments";

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MessageBubble({ message }: { message: Message }) {
  const { sender, content, timestamp } = message;

  if (sender.role === "system") {
    return (
      <SystemDivider>
        <span className="text-xs text-muted/80 italic whitespace-nowrap">
          {content}
        </span>
      </SystemDivider>
    );
  }

  if (sender.role === "mc") {
    return (
      <div className="py-4 px-6 my-1 border-l-2 border-accent/50 bg-accent/[0.03]">
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-xs tracking-widest uppercase text-accent/85">
            {sender.name}
          </span>
          <span className="text-xs text-muted/70">
            {formatTime(timestamp)}
          </span>
        </div>
        <p className="narrative-text text-[15px] text-foreground leading-[1.9]">
          {content}
        </p>
      </div>
    );
  }

  if (sender.role === "keeper") {
    return (
      <div className="py-3 px-6 my-1 border-l-2 border-keeper/40 bg-keeper/[0.04] rounded-r">
        <div className="flex items-baseline gap-2 mb-1.5">
          <span className="text-xs tracking-widest uppercase text-keeper/90">
            {sender.name}
          </span>
          <span className="text-xs text-muted/70">
            {formatTime(timestamp)}
          </span>
        </div>
        <p className="narrative-text text-sm text-foreground/90 italic leading-relaxed">
          {content}
        </p>
      </div>
    );
  }

  // Player message
  return (
    <div className="py-2.5 px-6">
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-xs font-medium text-ice">{sender.name}</span>
        <span className="text-xs text-muted/70">
          {formatTime(timestamp)}
        </span>
      </div>
      <p className="text-sm text-foreground/90 leading-relaxed">{content}</p>
    </div>
  );
}

interface StoryLogProps {
  messages: Message[];
  streamingText?: string | null;
}

export default function StoryLog({ messages, streamingText }: StoryLogProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto py-2"
    >
      {messages.length === 0 && (
        <div className="flex items-center justify-center h-full">
          <p className="text-muted/70 text-sm italic narrative-text">
            The story has not yet begun...
          </p>
        </div>
      )}
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      {streamingText && (
        <div aria-live="polite" className="py-3 px-6 my-1 border-l-2 border-keeper/40 bg-keeper/[0.04] rounded-r animate-pulse">
          <div className="flex items-baseline gap-2 mb-1.5">
            <span className="text-xs tracking-widest uppercase text-keeper/90">
              The Keeper
            </span>
            <span className="text-[10px] text-keeper/50">typing...</span>
          </div>
          <p className="narrative-text text-sm text-foreground/90 italic leading-relaxed">
            {streamingText}
          </p>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
