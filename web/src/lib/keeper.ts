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
      stateUpdates: [],
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
      stateUpdates: [],
      degraded: true,
    };
  }
}
