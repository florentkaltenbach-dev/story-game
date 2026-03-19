// === Existing types (preserved) ===

export type Role = "player" | "mc" | "keeper" | "system";
export type BuiltInChannel = "all" | "keeper-private" | "mc-keeper" | "secret-action";
export type Channel = BuiltInChannel | `group-${string}`;

export interface GroupChannel {
  id: string;           // e.g. "group-abc123"
  name: string;         // player-chosen display name
  members: string[];    // player IDs
  createdBy: string;    // player ID
  createdAt: number;
}

export interface Message {
  id: string;
  channel: Channel;
  sender: { role: Role; name: string };
  content: string;
  timestamp: number;
  playerId?: string;
}

export type CharacterStatus = "pending" | "draft" | "submitted" | "approved";

export interface CharacterSheet {
  status: CharacterStatus;
  archetype: string;
  background: string;
  motivation: string;
  fear: string;
  qualities: string[];
  relationships: string[];
  revisionComment?: string;
}

export interface Player {
  id: string;
  name: string;
  characterName: string;
  journal: string;
  notes: string;
  character: CharacterSheet;
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
  keeperAutoRespond: boolean;
  number: number;
  act: number;
}

// === Invite types ===

export type InviteStatus = "new" | "used" | "error";

export interface Invite {
  token: string;
  status: InviteStatus;
  createdAt: number;
  usedBy?: string;
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
  recentHistory?: Array<{ role: string; name: string; content: string }>;
  players?: Array<{ name: string; characterName: string; journal: string; notes: string }>;
  playerKnowledge?: Record<string, "unknown" | "rumored" | "confirmed">;
}

export interface KeeperResponse {
  narrative: string;
  journalUpdate?: string;
  stateUpdates?: StateUpdate[];
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
  number: number;
  act: number;
  lastMessageId: string;
  timestamp: number;
  widgets?: GameWidget[];
}

// === Widget types ===

export type WidgetKind = "inventory" | "npc_dossier" | "environment" | "status" | "custom";

export interface InventoryItem {
  name: string;
  description?: string;
  quantity?: number;
  category?: string;
}

export interface NpcDossierData {
  name: string;
  role: string;
  description?: string;
  knownFacts: string[];
  attitude?: string;
}

export interface EnvironmentData {
  conditions: Array<{ label: string; value: string; unit?: string }>;
  narrative?: string;
}

export interface StatusData {
  entries: Array<{ label: string; value: string; color?: string }>;
}

export interface CustomData {
  markdown: string;
}

export type WidgetData = InventoryItem[] | NpcDossierData | EnvironmentData | StatusData | CustomData;

export interface GameWidget {
  id: string;
  kind: WidgetKind;
  label: string;
  icon?: string;
  target: "all" | string;   // "all" or playerId
  data: WidgetData;
  updatedAt: number;
  priority?: number;         // sort order (lower = first)
}

// === Preset character pool types ===

export interface PresetCharacter {
  id: string;
  name: string;
  archetype: string;
  tagline: string;
  portrait: string;
  background: string;
  motivation: string;
  fear: string;
  qualities: string[];
  relationships: string[];
}

// === SSE event types ===

export type EventType =
  | "message"
  | "scene"
  | "session"
  | "player_joined"
  | "player_kicked"
  | "keeper_response"
  | "keeper_typing"
  | "memory_update"
  | "character_update"
  | "pool_update"
  | "widget_update"
  | "widget_remove";

export interface SSEEvent {
  type: EventType;
  data: unknown;
}

// === Journal voice type ===

export type JournalVoice = "player" | "narrator";

// === Event trigger types ===

export interface EventTrigger {
  id: string;
  event: string;
  mode: KeeperMode;
  cooldownMinutes: number;
  conditions?: Record<string, unknown>;
  description?: string;
}

export interface TriggerState {
  lastFired: Record<string, number>;  // trigger id → timestamp
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
  historicSites?: Record<string, string>;
  historicContext?: Record<string, string>;
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
  npcArchetypes?: Array<{
    name: string;
    source: string;
    template: string;
    useFor: string;
  }>;
  pool?: PresetCharacter[];
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

// === State chain types ===

export interface StateChainDef {
  states: string[];
  variant: "default" | "danger" | "positive" | "neutral";
}

// === Story matrix types ===

export type CharacterBeatStatus = "healthy" | "shaken" | "injured" | "critical" | "incapacitated" | "dead";

export type NarrativeRole = "lead" | "support" | "tension" | "danger" | "pivot" | "absent";

export interface CharacterBeat {
  characterId: string;
  session: number;
  act: number;
  location: string;
  status: CharacterBeatStatus;
  emotional: string;
  knowledge: string[];
  narrativeRole: NarrativeRole;
  threadsActive: string[];
  danger: 0 | 1 | 2 | 3;
  activity: string;
  mcNote?: string;
  npcBehavior?: string;
}

export interface CharacterArc {
  throughline: string;
  peak: string;
  break: string;
  ifPlayer: string;
  ifNpc: string;
}

export interface StoryMatrixAct {
  name: string;
  index: number;
}

export interface StoryMatrixSession {
  id: number;
  name: string;
  acts: StoryMatrixAct[];
  beats: CharacterBeat[];
}

export type StoryMatrixArcs = Record<string, CharacterArc>;

export const STATE_CHAINS: Record<string, StateChainDef> = {
  "npc-disposition-negative": { states: ["neutral", "wary", "suspicious", "hostile"], variant: "danger" },
  "npc-disposition-positive": { states: ["neutral", "curious", "friendly", "allied"], variant: "positive" },
  "radio-condition": { states: ["clear", "static", "degraded", "intermittent", "blackout"], variant: "neutral" },
  "injury-severity": { states: ["healthy", "shaken", "injured", "critical", "incapacitated"], variant: "danger" },
  "fuel-level": { states: ["full", "adequate", "low", "critical", "empty"], variant: "danger" },
  "weather": { states: ["calm", "wind", "storm", "whiteout"], variant: "neutral" },
  "narrative-thread": { states: ["dormant", "planted", "growing", "ripe", "resolved"], variant: "default" },
} as const;

// === Story data graph types (used by /api/story-data and viz pages) ===

export interface StoryNode {
  id: string;
  name: string;
  type: "player" | "npc" | "location" | "thread";
  desc: string;
  role?: string;
  status?: string;
  session?: number;
  meta?: Record<string, unknown>;
}

export interface StoryEdge {
  source: string;
  target: string;
  type: "bond" | "tension" | "secret" | "presence" | "thread-link";
  desc: string;
}

export interface SessionDef {
  id: number;
  name: string;
  subtitle: string;
  color: string;
  acts: Array<{
    name: string;
    beats: string[];
  }>;
}

export interface FogEntry {
  playerId: string;
  playerName: string;
  knowledge: Record<string, "unknown" | "rumored" | "confirmed">;
}

export interface FateSummary {
  characterId: string;
  name: string;
  slot: number;
  session: number;
  act: string;
  escalation: string;
  manner: string;
  capabilityLost: string;
  threadsAdvanced: string[];
}

export interface StoryDataGraph {
  nodes: StoryNode[];
  edges: StoryEdge[];
  sessions: SessionDef[];
  fog: FogEntry[];
  fates: FateSummary[];
  meta: {
    presetId: string;
    genre: string;
    tone: string[];
    era: string;
    updatedAt: string;
    hash: string;
  };
}
