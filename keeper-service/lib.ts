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

// === Model routing ===

export const MODE_MODELS: Record<string, string> = {
  player_response:   "claude-haiku-4-5-20251001",
  mc_query:          "claude-haiku-4-5-20251001",
  mc_generate:       "claude-haiku-4-5-20251001",
  journal_write:     process.env.KEEPER_QUALITY_MODEL ?? "claude-haiku-4-5-20251001",
  compression:       process.env.KEEPER_QUALITY_MODEL ?? "claude-haiku-4-5-20251001",
  thread_evaluation: "claude-haiku-4-5-20251001",
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

// === Cost tracking ===

// Pricing per million tokens (USD) — update when models change
const PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-haiku-4-5-20251001": { input: 0.80, output: 4.00, cacheRead: 0.08, cacheWrite: 1.00 },
  "claude-sonnet-4-20250514":  { input: 3.00, output: 15.00, cacheRead: 0.30, cacheWrite: 3.75 },
  "claude-opus-4-20250514":    { input: 15.00, output: 75.00, cacheRead: 1.50, cacheWrite: 18.75 },
};

interface UsageRecord {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  calls: number;
}

export class CostTracker {
  private byMode: Record<string, UsageRecord> = {};

  record(mode: string, _model: string, usage: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  }) {
    if (!this.byMode[mode]) {
      this.byMode[mode] = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, calls: 0 };
    }
    const r = this.byMode[mode];
    r.inputTokens += usage.input_tokens ?? 0;
    r.outputTokens += usage.output_tokens ?? 0;
    r.cacheReadTokens += usage.cache_read_input_tokens ?? 0;
    r.cacheCreationTokens += usage.cache_creation_input_tokens ?? 0;
    r.calls++;
  }

  summary(model?: string) {
    const pricing = PRICING[model ?? "claude-haiku-4-5-20251001"] ?? PRICING["claude-haiku-4-5-20251001"];
    let totalCost = 0;
    let totalInput = 0;
    let totalOutput = 0;
    let totalCacheRead = 0;
    let totalCalls = 0;
    const modes: Record<string, { calls: number; tokens: number; cost: number }> = {};

    for (const [mode, r] of Object.entries(this.byMode)) {
      const cost =
        (r.inputTokens * pricing.input / 1_000_000) +
        (r.outputTokens * pricing.output / 1_000_000) +
        (r.cacheReadTokens * pricing.cacheRead / 1_000_000) +
        (r.cacheCreationTokens * pricing.cacheWrite / 1_000_000);
      modes[mode] = { calls: r.calls, tokens: r.inputTokens + r.outputTokens, cost };
      totalCost += cost;
      totalInput += r.inputTokens;
      totalOutput += r.outputTokens;
      totalCacheRead += r.cacheReadTokens;
      totalCalls += r.calls;
    }

    return {
      totalCalls,
      totalInput,
      totalOutput,
      totalCacheRead,
      totalCostUsd: Math.round(totalCost * 10000) / 10000,
      modes,
    };
  }
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
