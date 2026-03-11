import type {
  KeeperInput,
  KeeperResponse,
  KeeperMode,
} from "./types";
import { readMemoryLevel } from "./memory";

// === KeeperBackend interface ===

export interface KeeperBackend {
  query(input: KeeperInput): Promise<KeeperResponse>;
}

// === MockKeeper — reads from filesystem, returns contextual responses ===

export class MockKeeper implements KeeperBackend {
  async query(input: KeeperInput): Promise<KeeperResponse> {
    const plotState = await readMemoryLevel(1);
    const currentScene =
      plotState["current-scene"] ?? "The story has not yet begun.";

    const responses = this.getResponsesForMode(input.mode, currentScene);
    const narrative = responses[Math.floor(Math.random() * responses.length)];

    return {
      narrative,
      degraded: false,
    };
  }

  private getResponsesForMode(mode: KeeperMode, _scene: string): string[] {
    switch (mode) {
      case "mc_query":
        return [
          "The expedition proceeds as planned. No anomalies have been reported to me beyond what the MC already knows.",
          "The players have not yet discovered anything that contradicts the briefing. The five-pointed geometry has been mentioned but not connected to the specimens.",
          "I am tracking three active narrative threads. None have reached their trigger conditions yet.",
        ];
      case "mc_generate":
        return [
          "The wind shifts. For a moment, the gulls go silent — all of them, at once — and then resume as if nothing happened. No one else seems to have noticed.",
          "A folded newspaper clipping falls from between the pages — dated three years ago. The headline reads: 'MISKATONIC EXPEDITION RETURNS — FULL ACCOUNT WITHHELD.' Someone has circled a single word in the article: 'alive.'",
        ];
      case "player_response":
      default:
        return [
          "The wind shifts. For a moment, the gulls go silent — all of them, at once — and then resume as if nothing happened. No one else seems to have noticed.",
          "You find the crate marked with a five-pointed symbol you don't recognise. The wood is cold to the touch, colder than the air around it. The manifest lists its contents as 'geological samples (return).' Return from where?",
          "The old harbour master watches your party from his window. He has seen expeditions leave before. Not all of them came back the same. He says nothing. He never does.",
        ];
    }
  }
}

// === Shared types ===

export interface CompressionResult {
  summary: string;
  keyEvents: string[];
  threadUpdates?: Array<{ id: string; status: string; reason?: string }>;
}

export interface CostSummary {
  totalCalls: number;
  totalInput: number;
  totalOutput: number;
  totalCacheRead: number;
  totalCostUsd: number;
  modes: Record<string, { calls: number; tokens: number; cost: number }>;
}

// === RemoteKeeper — proxies to standalone keeper-service ===

export class RemoteKeeper implements KeeperBackend {
  private url: string;
  private sharedSecret: string | undefined;

  constructor() {
    this.url = process.env.KEEPER_URL ?? "http://localhost:3005";
    this.sharedSecret = process.env.KEEPER_SHARED_SECRET;
  }

  async query(input: KeeperInput): Promise<KeeperResponse> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.sharedSecret) {
      headers["X-Ceremony-Secret"] = this.sharedSecret;
    }

    const res = await fetch(`${this.url}/query`, {
      method: "POST",
      headers,
      body: JSON.stringify({ input }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Keeper service error ${res.status}: ${body}`);
    }

    return res.json();
  }

  async compress(messages: Array<{ role: string; name: string; content: string }>, sessionNumber: number, act: number): Promise<CompressionResult> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.sharedSecret) {
      headers["X-Ceremony-Secret"] = this.sharedSecret;
    }

    const res = await fetch(`${this.url}/compress`, {
      method: "POST",
      headers,
      body: JSON.stringify({ messages, sessionNumber, act }),
    });

    if (!res.ok) {
      throw new Error(`Compression failed: ${res.status}`);
    }

    return res.json();
  }

  async streamQuery(
    input: KeeperInput,
    onText: (text: string) => void
  ): Promise<KeeperResponse> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.sharedSecret) {
      headers["X-Ceremony-Secret"] = this.sharedSecret;
    }

    const res = await fetch(`${this.url}/query/stream`, {
      method: "POST",
      headers,
      body: JSON.stringify({ input }),
    });

    if (!res.ok) {
      throw new Error(`Keeper stream error ${res.status}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let finalResponse: KeeperResponse | null = null;
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const event = JSON.parse(line.slice(6));
          if (event.type === "text") {
            onText(event.content);
          } else if (event.type === "done") {
            finalResponse = event.response;
          }
        } catch { /* skip malformed lines */ }
      }
    }

    return finalResponse ?? { narrative: "", degraded: true };
  }

  async getCost(): Promise<CostSummary> {
    const headers: Record<string, string> = {};
    if (this.sharedSecret) {
      headers["X-Ceremony-Secret"] = this.sharedSecret;
    }
    const res = await fetch(`${this.url}/cost`, { headers });
    if (!res.ok) return { totalCalls: 0, totalInput: 0, totalOutput: 0, totalCacheRead: 0, totalCostUsd: 0, modes: {} };
    return res.json();
  }
}

// === Keeper factory — selected by environment variable ===

export function createKeeper(): KeeperBackend {
  if (process.env.KEEPER_BACKEND === "mock") {
    console.log("[Keeper] Using MockKeeper (KEEPER_BACKEND=mock)");
    return new MockKeeper();
  }
  const url = process.env.KEEPER_URL ?? "http://localhost:3005";
  console.log(`[Keeper] Using RemoteKeeper → ${url}`);
  return new RemoteKeeper();
}

// === Query the Keeper (main entry point) ===

const keeper = createKeeper();

export async function queryKeeper(
  input: KeeperInput
): Promise<KeeperResponse> {
  try {
    return await keeper.query(input);
  } catch (err) {
    console.error("[Keeper] Error:", err);
    return {
      narrative:
        "[The Keeper is momentarily silent. The wind fills the pause.]",
      degraded: true,
    };
  }
}
