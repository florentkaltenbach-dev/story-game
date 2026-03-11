import type { MemoryLevelNumber, GameWidget, JournalVoice } from "../types";

export interface PipelineInput {
  narrative: string;
  journalUpdate?: string;
  playerId?: string;
  session: { number: number; act: number };
}

export interface PipelineResult {
  journalEntries: JournalEntry[];
  memoryWrites: MemoryWrite[];
  widgetOps: WidgetOp[];
  detectedEvents: DetectedEvent[];
}

export interface JournalEntry {
  playerId: string;
  text: string;
  voice: JournalVoice;
}

export interface MemoryWrite {
  level: MemoryLevelNumber;
  key: string;
  value: string;
}

export interface WidgetOp {
  action: "upsert" | "remove";
  widget: GameWidget;
}

export type DetectedEventType = "npc_mention" | "location_change" | "keyword" | "environment_change";

export interface DetectedEvent {
  type: DetectedEventType;
  data: Record<string, unknown>;
}
