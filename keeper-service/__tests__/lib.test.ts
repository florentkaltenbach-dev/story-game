import { describe, it, expect } from "vitest";
import {
  estimateTokens,
  truncateToTokens,
  RateLimiter,
  MODE_TIERS,
  MODE_MAX_TOKENS,
  TIER_BUDGETS,
  CHARS_PER_TOKEN,
} from "../lib";

describe("estimateTokens", () => {
  it("estimates based on chars/token ratio", () => {
    // 20 chars / 4 chars per token = 5 tokens
    expect(estimateTokens("a".repeat(20))).toBe(5);
  });

  it("rounds up for partial tokens", () => {
    // 5 chars / 4 = 1.25 → ceil = 2
    expect(estimateTokens("hello")).toBe(2);
  });

  it("returns 0 for empty string", () => {
    expect(estimateTokens("")).toBe(0);
  });

  it("handles single character", () => {
    expect(estimateTokens("x")).toBe(1);
  });
});

describe("truncateToTokens", () => {
  it("passes through text under budget", () => {
    const text = "short text";
    expect(truncateToTokens(text, 100)).toBe(text);
  });

  it("truncates text over budget", () => {
    const text = "a".repeat(100); // 100 chars = 25 tokens
    const result = truncateToTokens(text, 5); // 5 tokens = 20 chars
    expect(result).toBe("a".repeat(20) + "\n[...truncated]");
  });

  it("handles exact boundary", () => {
    const text = "a".repeat(20); // 20 chars = 5 tokens exactly
    expect(truncateToTokens(text, 5)).toBe(text);
  });
});

describe("RateLimiter", () => {
  it("allows requests under limit", () => {
    const limiter = new RateLimiter(5, 50);
    expect(limiter.check().allowed).toBe(true);
    limiter.record();
    expect(limiter.check().allowed).toBe(true);
  });

  it("blocks when per-minute limit reached", () => {
    const limiter = new RateLimiter(2, 100);
    limiter.record();
    limiter.record();
    const result = limiter.check();
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("2/min");
  });

  it("blocks when per-session limit reached", () => {
    const limiter = new RateLimiter(100, 3);
    limiter.record();
    limiter.record();
    limiter.record();
    const result = limiter.check();
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("3 requests");
  });

  it("tracks usage correctly", () => {
    const limiter = new RateLimiter(10, 100);
    limiter.record();
    limiter.record();
    expect(limiter.usage).toEqual({ session: 2, limit: 100 });
  });
});

describe("constants", () => {
  it("MODE_TIERS covers all keeper modes", () => {
    const modes = ["player_response", "mc_query", "mc_generate", "journal_write", "compression", "thread_evaluation"];
    for (const mode of modes) {
      expect(MODE_TIERS[mode as keyof typeof MODE_TIERS]).toBeDefined();
    }
  });

  it("MODE_MAX_TOKENS has reasonable values", () => {
    expect(MODE_MAX_TOKENS.mc_query).toBe(512);
    expect(MODE_MAX_TOKENS.mc_generate).toBe(1024);
    expect(MODE_MAX_TOKENS.thread_evaluation).toBe(256);
  });

  it("TIER_BUDGETS sum is reasonable", () => {
    const total = Object.values(TIER_BUDGETS).reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(2000);
    expect(total).toBeLessThan(10000);
  });

  it("CHARS_PER_TOKEN is 4", () => {
    expect(CHARS_PER_TOKEN).toBe(4);
  });
});
