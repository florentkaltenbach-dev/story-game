// === Existing types (preserved) ===

export type Role = "player" | "mc" | "keeper" | "system";
export type Channel = "all" | "keeper-private" | "mc-keeper";

export interface Message {
  id: string;
  channel: Channel;
  sender: { role: Role; name: string };
  content: string;
  timestamp: number;
  playerId?: string;
}

export interface Player {
  id: string;
  name: string;
  characterName: string;
  journal: string;
  notes: string;
}

export interface Scene {
  title: string;
  description: string;
  location: string;
}

export type SessionStatus = "lobby" | "active" | "paused" | "ended";

export interface Session {
  id: string;
  name: string;
  preset: string;
  scene: Scene;
  players: Player[];
  status: SessionStatus;
}

// === Keeper types ===

export type KeeperMode =
  | "player_response"
  | "mc_query"
  | "mc_generate"
  | "journal_write"
  | "compression"
  | "thread_evaluation";

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
}

export interface KeeperResponse {
  narrative: string;
  journalUpdate?: string;
  stateUpdates: StateUpdate[];
  internalNotes?: string;
  degraded?: boolean;
}

export interface StateUpdate {
  level: MemoryLevelNumber;
  key: string;
  value: string;
  threadId?: string;
  status?: NarrativeThreadStatus;
}

// === Memory types ===

export type MemoryLevelNumber = 1 | 2 | 3 | 4 | 5;

export const MEMORY_LEVEL_NAMES: Record<MemoryLevelNumber, string> = {
  1: "plot-state",
  2: "character-state",
  3: "narrative-threads",
  4: "thematic-layer",
  5: "world-state",
} as const;

export const MEMORY_LEVEL_DIRS: Record<MemoryLevelNumber, string> = {
  1: "1-plot-state",
  2: "2-character-state",
  3: "3-narrative-threads",
  4: "4-thematic-layer",
  5: "5-world-state",
} as const;

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
  triggerConditions: TriggerCondition[];
  plantedInSession?: number;
  payoffInSession?: number;
  content: string;
}

export interface TriggerCondition {
  type: "keyword" | "location" | "session" | "player_action" | "visit_count";
  value: string | number;
  comparator?: "equals" | "contains" | "gte" | "lte";
}

// === Context assembly types ===

export type PriorityTier =
  | "P0_identity"
  | "P1_preset"
  | "P2_scene"
  | "P3_characters"
  | "P4_threads"
  | "P5_theme"
  | "P6_world"
  | "P7_history"
  | "P8_input";

export interface ContextBlock {
  tier: PriorityTier;
  content: string;
  tokenEstimate: number;
}

export interface AssembledContext {
  systemPrompt: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  totalTokenEstimate: number;
}

// === Session persistence types ===

export interface SessionSnapshot {
  id: string;
  name: string;
  preset: string;
  scene: Scene;
  players: Player[];
  status: SessionStatus;
  lastMessageId: string;
  timestamp: number;
}

// === SSE event types ===

export type EventType =
  | "message"
  | "scene"
  | "session"
  | "player_joined"
  | "keeper_response"
  | "memory_update";

export interface SSEEvent {
  type: EventType;
  data: unknown;
}

// === Preset config types ===

export interface PresetConfig {
  story: StoryConfig;
  world: WorldConfig;
  characters: CharactersConfig;
  techniques: TechniquesConfig;
}

export interface StoryConfig {
  genre: string;
  tone: string[];
  atmosphere: string;
  pacingStructure: string[];
  actStructure: string;
  sessionCount: number;
}

export interface WorldConfig {
  era: string;
  geography: Record<string, string>;
  environmentRules: string[];
  timeline: string;
  technology: string[];
}

export interface CharactersConfig {
  archetypes: Array<{
    name: string;
    motivation: string;
    skills: string;
    vulnerability: string;
  }>;
  npcs: Array<{
    name: string;
    role: string;
    description: string;
    agenda: string;
  }>;
}

export interface TechniquesConfig {
  narrativeTechniques: string[];
  sensoryPalette: {
    sight: Record<string, string>;
    sound: Record<string, string>;
    touch: Record<string, string>;
    smell: Record<string, string>;
    taste: Record<string, string>;
  };
  keeperBehaviorRules: string[];
}
