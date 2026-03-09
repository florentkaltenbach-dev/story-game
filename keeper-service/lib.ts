// Pure functions extracted from server.ts for testability

import type { KeeperMode } from "./types";

// Re-export types used by server.ts
export type { KeeperMode };

// === Mode-aware tier loading ===

export const MODE_TIERS: Record<KeeperMode, Set<string>> = {
  player_response:   new Set(["P2", "P3", "P4", "P7", "P8"]),
  mc_query:          new Set(["P2", "P3", "P7", "P8"]),
  mc_generate:       new Set(["P2", "P3", "P4", "P5", "P6", "P7", "P8"]),
  journal_write:     new Set(["P3", "P7", "P8"]),
  compression:       new Set(["P7", "P8"]),
  thread_evaluation: new Set(["P4", "P7", "P8"]),
};

// === Mode-aware output caps ===

export const MODE_MAX_TOKENS: Record<KeeperMode, number> = {
  player_response:   768,
  mc_query:          512,
  mc_generate:       1024,
  journal_write:     512,
  compression:       512,
  thread_evaluation: 256,
};

// === Token budgets per tier ===

export const TIER_BUDGETS: Record<string, number> = {
  P0_identity: 800,
  P1_preset: 1200,
  P2_scene: 300,
  P3_characters: 600,
  P4_threads: 300,
  P5_theme: 200,
  P6_world: 200,
  P7_history: 500,
  P8_input: 200,
};

// === Token estimation ===

export const CHARS_PER_TOKEN = 4;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function truncateToTokens(text: string, maxTokens: number): string {
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n[...truncated]";
}

// === Rate limiter ===

export class RateLimiter {
  private requestsThisMinute = 0;
  private requestsThisSession = 0;
  private minuteStart = Date.now();

  private readonly maxPerMinute: number;
  private readonly maxPerSession: number;

  constructor(maxPerMinute = 10, maxPerSession = 100) {
    this.maxPerMinute = maxPerMinute;
    this.maxPerSession = maxPerSession;
  }

  check(): { allowed: boolean; reason?: string } {
    const now = Date.now();
    if (now - this.minuteStart > 60_000) {
      this.requestsThisMinute = 0;
      this.minuteStart = now;
    }

    if (this.requestsThisSession >= this.maxPerSession) {
      return { allowed: false, reason: `Session limit reached (${this.maxPerSession} requests). The Keeper rests.` };
    }
    if (this.requestsThisMinute >= this.maxPerMinute) {
      return { allowed: false, reason: `Rate limit reached (${this.maxPerMinute}/min). Wait a moment.` };
    }
    return { allowed: true };
  }

  record(): void {
    this.requestsThisMinute++;
    this.requestsThisSession++;
  }

  get usage() {
    return { session: this.requestsThisSession, limit: this.maxPerSession };
  }
}
