import { describe, it, expect } from "vitest";
import { parseCommand, listCommands } from "../mc-commands";

describe("parseCommand", () => {
  it("returns null for plain text (no slash prefix)", () => {
    expect(parseCommand("What's happening with the threads?")).toBeNull();
  });

  it("returns null for unknown commands", () => {
    expect(parseCommand("/unknown do something")).toBeNull();
  });

  it("returns null for slash with no arguments", () => {
    expect(parseCommand("/generate")).toBeNull();
  });

  it("parses /generate with content", () => {
    const result = parseCommand("/generate a description of the ice cave");
    expect(result).toEqual({
      mode: "mc_generate",
      content: "a description of the ice cave",
    });
  });

  it("parses /reveal with clue", () => {
    const result = parseCommand("/reveal the five-pointed symbol on the crate");
    expect(result).toEqual({
      mode: "mc_generate",
      content: "Reveal this to the players in your narrative: the five-pointed symbol on the crate",
    });
  });

  it("parses /hint", () => {
    const result = parseCommand("/hint the temperature anomaly near the ruins");
    expect(result).toEqual({
      mode: "mc_query",
      content: "Suggest a hint I can give about: the temperature anomaly near the ruins",
    });
  });

  it("parses /npc with name and dialogue prompt", () => {
    const result = parseCommand("/npc Starkweather talks about the funding crisis");
    expect(result).toEqual({
      mode: "mc_generate",
      content: "Generate dialogue for NPC Starkweather: talks about the funding crisis",
      npcName: "Starkweather",
    });
  });

  it("parses /npc with name only (no separate dialogue)", () => {
    const result = parseCommand("/npc Moore");
    expect(result).toEqual({
      mode: "mc_generate",
      content: "Moore",
    });
  });

  it("is case-insensitive for commands", () => {
    const result = parseCommand("/GENERATE a storm description");
    expect(result).toEqual({
      mode: "mc_generate",
      content: "a storm description",
    });
  });

  it("trims whitespace", () => {
    const result = parseCommand("  /generate   ice cave  ");
    expect(result).toEqual({
      mode: "mc_generate",
      content: "ice cave",
    });
  });
});

describe("listCommands", () => {
  it("returns all available commands", () => {
    const cmds = listCommands();
    expect(cmds.length).toBeGreaterThanOrEqual(4);
    const names = cmds.map((c) => c.command);
    expect(names).toContain("/generate");
    expect(names).toContain("/reveal");
    expect(names).toContain("/hint");
    expect(names).toContain("/npc");
  });

  it("each command has a description", () => {
    for (const cmd of listCommands()) {
      expect(cmd.description).toBeTruthy();
    }
  });
});
