import type { KeeperMode } from "./types";

export interface ParsedCommand {
  mode: KeeperMode;
  content: string;
  npcName?: string;
}

const COMMANDS: Record<string, { mode: KeeperMode; description: string }> = {
  "/generate": { mode: "mc_generate", description: "Generate narrative content" },
  "/reveal":   { mode: "mc_generate", description: "Reveal a clue or detail" },
  "/hint":     { mode: "mc_query",    description: "Ask Keeper for a hint to give a player" },
  "/npc":      { mode: "mc_generate", description: "Generate NPC dialogue" },
};

/**
 * Parse MC input for backstage commands.
 * Returns null if the input is not a command (plain text query).
 *
 * Supported:
 *   /generate <prompt>     → mc_generate mode
 *   /reveal <clue>         → mc_generate mode, prefixed with reveal context
 *   /hint <player> <topic> → mc_query mode, asking for hint suggestion
 *   /npc <name> <dialogue> → mc_generate mode with NPC context
 */
export function parseCommand(input: string): ParsedCommand | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) return null;

  const spaceIdx = trimmed.indexOf(" ");
  if (spaceIdx === -1) return null;

  const cmd = trimmed.slice(0, spaceIdx).toLowerCase();
  const rest = trimmed.slice(spaceIdx + 1).trim();

  if (!rest) return null;

  const def = COMMANDS[cmd];
  if (!def) return null;

  switch (cmd) {
    case "/generate":
      return { mode: "mc_generate", content: rest };

    case "/reveal":
      return { mode: "mc_generate", content: `Reveal this to the players in your narrative: ${rest}` };

    case "/hint": {
      return { mode: "mc_query", content: `Suggest a hint I can give about: ${rest}` };
    }

    case "/npc": {
      // /npc Starkweather says something about the ice
      const npcSpaceIdx = rest.indexOf(" ");
      if (npcSpaceIdx === -1) return { mode: "mc_generate", content: rest };
      const npcName = rest.slice(0, npcSpaceIdx);
      const dialogue = rest.slice(npcSpaceIdx + 1);
      return { mode: "mc_generate", content: `Generate dialogue for NPC ${npcName}: ${dialogue}`, npcName };
    }

    default:
      return null;
  }
}

/** List available commands for help display */
export function listCommands(): Array<{ command: string; description: string }> {
  return Object.entries(COMMANDS).map(([command, { description }]) => ({
    command,
    description,
  }));
}
