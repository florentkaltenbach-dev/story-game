// Keeper-service shared types
//
// These mirror the canonical definitions in web/src/lib/types.ts.
// When updating types here, keep them in sync with the web source.

export type KeeperMode =
  | "player_response"
  | "mc_query"
  | "mc_generate"
  | "journal_write"
  | "compression"
  | "thread_evaluation";

export type MemoryLevelNumber = 1 | 2 | 3 | 4 | 5;

export type SessionStatus = "lobby" | "active" | "paused" | "ended";

export type BuiltInChannel = "all" | "keeper-private" | "mc-keeper" | "secret-action";
export type Channel = BuiltInChannel | `group-${string}`;

export interface KeeperInput {
  mode: KeeperMode;
  trigger: {
    type: "player_action" | "mc_query" | "mc_narration" | "session_event";
    channel: Channel;
    content: string;
    playerId?: string;
  };
  session: {
    number: number;
    act: number;
    status: SessionStatus;
  };
  recentHistory?: Array<{ role: string; name: string; content: string }>;
  players?: Array<{ name: string; characterName: string; journal: string; notes: string }>;
  playerKnowledge?: Record<string, "unknown" | "rumored" | "confirmed">;
}

export interface StateUpdate {
  level: MemoryLevelNumber;
  key: string;
  value: string;
  threadId?: string;
  status?: NarrativeThreadStatus;
}

export interface KeeperResponse {
  narrative: string;
  journalUpdate?: string;
  stateUpdates?: StateUpdate[];
  internalNotes?: string;
  degraded?: boolean;
}

export type NarrativeThreadStatus =
  | "dormant"
  | "planted"
  | "growing"
  | "ripe"
  | "resolved";

export interface NarrativeThread {
  id: string;
  name: string;
  status: NarrativeThreadStatus;
  triggerConditions?: { type: string; value: string; comparator?: string }[];
  plantedInSession?: number;
  payoffInSession?: number;
  content: string;
}
