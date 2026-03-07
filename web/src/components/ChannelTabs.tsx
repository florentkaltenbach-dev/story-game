"use client";

import { Channel } from "@/lib/types";

const channelLabels: Record<Channel, string> = {
  all: "All",
  "keeper-private": "Private to Keeper",
  "mc-keeper": "MC \u2194 Keeper",
};

interface ChannelTabsProps {
  channels: Channel[];
  active: Channel;
  onChange: (channel: Channel) => void;
  unread?: Partial<Record<Channel, boolean>>;
}

export default function ChannelTabs({
  channels,
  active,
  onChange,
  unread,
}: ChannelTabsProps) {
  return (
    <div className="flex gap-1 border-b border-border bg-surface px-4">
      {channels.map((ch) => (
        <button
          key={ch}
          onClick={() => onChange(ch)}
          className={`relative px-4 py-2.5 text-sm transition-colors ${
            active === ch
              ? "border-b-2 border-accent text-accent"
              : "text-muted hover:text-foreground"
          }`}
        >
          {channelLabels[ch]}
          {unread?.[ch] && (
            <span className="absolute top-2 right-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
          )}
        </button>
      ))}
    </div>
  );
}
