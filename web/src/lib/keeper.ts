import type {
  KeeperInput,
  KeeperResponse,
  KeeperMode,
  AssembledContext,
} from "./types";
import { assembleContext } from "./context";
import { readMemoryLevel } from "./memory";

// === KeeperBackend interface ===

export interface KeeperBackend {
  query(input: KeeperInput, context: AssembledContext): Promise<KeeperResponse>;
}

// === MockKeeper — reads from filesystem, returns contextual responses ===

export class MockKeeper implements KeeperBackend {
  async query(
    input: KeeperInput,
    _context: AssembledContext
  ): Promise<KeeperResponse> {
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
          "A folded newspaper clipping falls from between the pages — dated three years ago. The headline reads: 'MISKATONIC EXPEDITION RETURNS — FULL ACCOUNT WITHHELD.' Someone has circled a single word in the article: 'alive.'",
          "The temperature drops two degrees in the time it takes you to cross the deck. Your breath fogs. The barometer has not moved. The first mate mutters something about the Southern Cross and makes a sign you do not recognise.",
          "In the quiet of the hold, you hear it — not a sound exactly, but an absence of sound. A pocket of silence that moves. The crates around you are stencilled with coordinates you will not understand for weeks yet.",
        ];
    }
  }
}

// === ClaudeKeeper — stub for Claude API integration ===

export class ClaudeKeeper implements KeeperBackend {
  async query(
    _input: KeeperInput,
    _context: AssembledContext
  ): Promise<KeeperResponse> {
    // Phase 5: Wire Claude API here
    // For now, fall back to mock
    return {
      narrative:
        "[The Keeper is momentarily silent. The wind fills the pause.]",
      stateUpdates: [],
      degraded: true,
    };
  }
}

// === Keeper factory — selected by environment variable ===

export function createKeeper(): KeeperBackend {
  if (process.env.KEEPER_BACKEND === "claude") {
    return new ClaudeKeeper();
  }
  return new MockKeeper();
}

// === Query the Keeper (main entry point) ===

const keeper = createKeeper();

export async function queryKeeper(
  input: KeeperInput
): Promise<KeeperResponse> {
  try {
    const context = await assembleContext(input);
    return await keeper.query(input, context);
  } catch {
    return {
      narrative:
        "[The Keeper is momentarily silent. The wind fills the pause.]",
      stateUpdates: [],
      degraded: true,
    };
  }
}
