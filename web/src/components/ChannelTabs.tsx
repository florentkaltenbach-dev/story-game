"use client";

import type { Channel, BuiltInChannel, GroupChannel } from "@/lib/types";

const BUILTIN_LABELS: Record<BuiltInChannel, string> = {
  all: "All",
  "keeper-private": "Private to Keeper",
  "mc-keeper": "MC \u2194 Keeper",
  "secret-action": "Secret Action",
};

function channelLabel(ch: Channel, groupChannels?: GroupChannel[]): string {
  if (ch in BUILTIN_LABELS) return BUILTIN_LABELS[ch as BuiltInChannel];
  if (ch.startsWith("group-") && groupChannels) {
    const group = groupChannels.find((g) => g.id === ch);
    if (group) return group.name;
  }
  return ch;
}

interface ChannelTabsProps {
  channels: Channel[];
  active: Channel;
  onChange: (channel: Channel) => void;
  unread?: Partial<Record<string, boolean>>;
  groupChannels?: GroupChannel[];
  onCreateGroup?: () => void;
}

export default function ChannelTabs({
  channels,
  active,
  onChange,
  unread,
  groupChannels,
  onCreateGroup,
}: ChannelTabsProps) {
  return (
    <div role="tablist" className="flex gap-0.5 sm:gap-1 border-b border-border bg-surface px-2 sm:px-4 overflow-x-auto">
      {channels.map((ch) => (
        <button
          key={ch}
          role="tab"
          aria-selected={active === ch}
          onClick={() => onChange(ch)}
          className={`relative px-2 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm whitespace-nowrap transition-colors ${
            active === ch
              ? "border-b-2 border-accent text-accent"
              : "text-muted hover:text-foreground"
          }`}
        >
          {channelLabel(ch, groupChannels)}
          {unread?.[ch] && (
            <span className="absolute top-2 right-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
          )}
        </button>
      ))}
      {onCreateGroup && (
        <button
          onClick={onCreateGroup}
          className="px-2 sm:px-3 py-2 sm:py-2.5 text-xs text-muted/50 hover:text-accent transition-colors whitespace-nowrap"
          aria-label="Create group channel"
          title="Create group channel"
        >
          +
        </button>
      )}
    </div>
  );
}
