import type { EventType, SSEEvent } from "./types";

// === State event emitter — broadcasts changes to SSE clients ===

type Listener = (event: SSEEvent) => void;

class StateEmitter {
  private listeners: Map<string, Set<Listener>> = new Map();

  subscribe(key: string, listener: Listener): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(listener);

    return () => {
      this.listeners.get(key)?.delete(listener);
      if (this.listeners.get(key)?.size === 0) {
        this.listeners.delete(key);
      }
    };
  }

  emit(type: EventType, data: unknown): void {
    const event: SSEEvent = { type, data };

    // Broadcast to "all" subscribers
    this.listeners.get("all")?.forEach((listener) => listener(event));

    // Broadcast to type-specific subscribers
    this.listeners.get(type)?.forEach((listener) => listener(event));
  }

  get subscriberCount(): number {
    let count = 0;
    for (const set of this.listeners.values()) {
      count += set.size;
    }
    return count;
  }
}

// Singleton — shared across all route handlers
export const stateEmitter = new StateEmitter();

// === SSE stream factory ===

export interface SSEFilterContext {
  role?: string;
  playerId?: string;
}

export function createSSEStream(
  subscribeTo: string = "all",
  signal?: AbortSignal,
  filter?: SSEFilterContext
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      const send = (event: SSEEvent) => {
        try {
          // Per-client filtering for private channels
          if (filter && event.type === "message") {
            const msg = event.data as { channel?: string; playerId?: string };
            if (msg.channel === "mc-keeper" && filter.role !== "mc") return;
            if (msg.channel === "keeper-private") {
              if (filter.role !== "mc" && filter.playerId !== msg.playerId) return;
            }
          }
          controller.enqueue(
            encoder.encode(
              `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`
            )
          );
        } catch {
          // Controller may be closed
        }
      };

      // Send initial keepalive
      controller.enqueue(encoder.encode(": connected\n\n"));

      const unsub = stateEmitter.subscribe(subscribeTo, send);

      // Keepalive every 30 seconds
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          clearInterval(keepalive);
        }
      }, 30000);

      if (signal) {
        signal.addEventListener("abort", () => {
          unsub();
          clearInterval(keepalive);
          try {
            controller.close();
          } catch {
            // Already closed
          }
        });
      }
    },
  });
}
