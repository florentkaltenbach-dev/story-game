import { describe, it, expect, vi } from "vitest";
import { stateEmitter, createSSEStream, type SSEFilterContext } from "../events";

describe("StateEmitter", () => {
  it("subscribe and emit deliver events", () => {
    const handler = vi.fn();
    const unsub = stateEmitter.subscribe("all", handler);

    stateEmitter.emit("message", { text: "hello" });
    expect(handler).toHaveBeenCalledWith({
      type: "message",
      data: { text: "hello" },
    });

    unsub();
  });

  it("unsubscribe stops delivery", () => {
    const handler = vi.fn();
    const unsub = stateEmitter.subscribe("all", handler);
    unsub();

    stateEmitter.emit("message", { text: "hello" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("type-specific subscribers only get matching events", () => {
    const handler = vi.fn();
    const unsub = stateEmitter.subscribe("scene", handler);

    stateEmitter.emit("message", { text: "hello" });
    expect(handler).not.toHaveBeenCalled();

    stateEmitter.emit("scene", { title: "New Scene" });
    expect(handler).toHaveBeenCalledTimes(1);

    unsub();
  });
});

describe("SSE filtering", () => {
  // Helper to collect SSE events from stream
  async function collectEvents(
    filter: SSEFilterContext,
    events: Array<{ type: string; data: unknown }>,
  ): Promise<string[]> {
    const controller = new AbortController();
    const stream = createSSEStream("all", controller.signal, filter);
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    // Emit events after stream is set up
    for (const e of events) {
      stateEmitter.emit(e.type as "message", e.data);
    }

    // Read what the stream produced
    const chunks: string[] = [];
    // Give the stream time to process
    await new Promise((r) => setTimeout(r, 10));
    controller.abort();

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        chunks.push(decoder.decode(value));
      }
    } catch {
      // Stream aborted
    }

    return chunks.join("").split("\n\n").filter((c) => c.startsWith("event:"));
  }

  it("mc-keeper messages hidden from non-mc", async () => {
    const events = await collectEvents({ role: "player", playerId: "p1" }, [
      { type: "message", data: { channel: "mc-keeper", content: "secret" } },
      { type: "message", data: { channel: "all", content: "public" } },
    ]);
    // Should only see the "all" channel message
    expect(events).toHaveLength(1);
    expect(events[0]).toContain("public");
  });

  it("keeper-private filtered by playerId", async () => {
    const events = await collectEvents({ role: "player", playerId: "p1" }, [
      { type: "message", data: { channel: "keeper-private", playerId: "p1", content: "for-p1" } },
      { type: "message", data: { channel: "keeper-private", playerId: "p2", content: "for-p2" } },
    ]);
    expect(events).toHaveLength(1);
    expect(events[0]).toContain("for-p1");
  });

  it("mc sees all channels", async () => {
    const events = await collectEvents({ role: "mc" }, [
      { type: "message", data: { channel: "mc-keeper", content: "secret" } },
      { type: "message", data: { channel: "all", content: "public" } },
      { type: "message", data: { channel: "keeper-private", playerId: "p1", content: "private" } },
    ]);
    expect(events).toHaveLength(3);
  });

  it("mc sees other players keeper-private messages", async () => {
    const events = await collectEvents({ role: "mc" }, [
      { type: "message", data: { channel: "keeper-private", playerId: "p2", content: "for-p2" } },
    ]);
    expect(events).toHaveLength(1);
  });
});
