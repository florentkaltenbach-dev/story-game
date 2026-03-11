import { describe, it, expect } from "vitest";
import { deriveWidgets } from "../widget-deriver";
import type { MemoryWrite } from "../types";

describe("widget deriver", () => {
  describe("NPC widgets", () => {
    it("creates npc_dossier widget from Level 2 NPC write", () => {
      const writes: MemoryWrite[] = [
        {
          level: 2,
          key: "dr-harold-starkweather",
          value: JSON.stringify({
            name: "Dr. Harold Starkweather",
            role: "Co-patron",
            description: "A former colleague of Dyer",
            status: "mentioned",
          }),
        },
      ];
      const ops = deriveWidgets(writes, []);
      expect(ops).toHaveLength(1);
      expect(ops[0].action).toBe("upsert");
      expect(ops[0].widget.kind).toBe("npc_dossier");
      expect(ops[0].widget.id).toBe("auto-npc-dr-harold-starkweather");
      expect(ops[0].widget.label).toBe("Dr. Harold Starkweather");
    });

    it("populates NPC dossier data correctly", () => {
      const writes: MemoryWrite[] = [
        {
          level: 2,
          key: "the-ship-captain",
          value: JSON.stringify({
            name: "The Ship Captain",
            role: "Veteran whaler",
            description: "Practical, skeptical",
            agenda: "Crew safety above all",
          }),
        },
      ];
      const ops = deriveWidgets(writes, []);
      const data = ops[0].widget.data as { name: string; role: string; knownFacts: string[] };
      expect(data.name).toBe("The Ship Captain");
      expect(data.role).toBe("Veteran whaler");
      expect(data.knownFacts).toContain("Practical, skeptical");
      expect(data.knownFacts).toContain("Agenda: Crew safety above all");
    });

    it("skips invalid JSON in Level 2 writes", () => {
      const writes: MemoryWrite[] = [
        { level: 2, key: "bad-data", value: "not json" },
      ];
      const ops = deriveWidgets(writes, []);
      expect(ops).toHaveLength(0);
    });

    it("skips NPC without name field", () => {
      const writes: MemoryWrite[] = [
        { level: 2, key: "no-name", value: JSON.stringify({ role: "Unknown" }) },
      ];
      const ops = deriveWidgets(writes, []);
      expect(ops).toHaveLength(0);
    });
  });

  describe("environment widgets", () => {
    it("creates environment widget from Level 5 current-environment write", () => {
      const writes: MemoryWrite[] = [
        {
          level: 5,
          key: "current-environment",
          value: JSON.stringify({
            conditions: [
              { label: "Temperature", value: "-30°C" },
              { label: "Wind", value: "40 knots" },
            ],
          }),
        },
      ];
      const ops = deriveWidgets(writes, []);
      expect(ops).toHaveLength(1);
      expect(ops[0].widget.kind).toBe("environment");
      expect(ops[0].widget.id).toBe("auto-env");
    });

    it("ignores non-environment Level 5 writes", () => {
      const writes: MemoryWrite[] = [
        { level: 5, key: "other-world-data", value: JSON.stringify({ foo: "bar" }) },
      ];
      const ops = deriveWidgets(writes, []);
      expect(ops).toHaveLength(0);
    });
  });

  describe("mixed writes", () => {
    it("handles both NPC and environment writes", () => {
      const writes: MemoryWrite[] = [
        {
          level: 2,
          key: "npc-1",
          value: JSON.stringify({ name: "NPC One", role: "Guide" }),
        },
        {
          level: 5,
          key: "current-environment",
          value: JSON.stringify({ conditions: [{ label: "Weather", value: "blizzard" }] }),
        },
        {
          level: 1,
          key: "current-location",
          value: JSON.stringify({ location: "McMurdo" }),
        },
      ];
      const ops = deriveWidgets(writes, []);
      expect(ops).toHaveLength(2); // NPC + environment, not location
    });
  });
});
