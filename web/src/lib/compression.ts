import { RemoteKeeper, type CompressionResult } from "./keeper";
import { writeMemoryLevel } from "./memory";
import type { Message } from "./types";

/**
 * Compress messages from the current act into a summary.
 * Called when MC advances act or ends session.
 *
 * Flow:
 * 1. Send messages to keeper-service /compress endpoint
 * 2. Write summary to Level 1 memory as act-N-summary.md
 * 3. Return result for potential recap use
 */
export async function compressAct(
  messages: Message[],
  sessionNumber: number,
  act: number,
): Promise<CompressionResult | null> {
  // Filter to substantive messages (skip system messages)
  const substantive = messages.filter(
    (m) => m.sender.role !== "system" && m.content.length > 0
  );

  if (substantive.length === 0) return null;

  const keeper = new RemoteKeeper();

  try {
    const result = await keeper.compress(
      substantive.map((m) => ({
        role: m.sender.role,
        name: m.sender.name,
        content: m.content,
      })),
      sessionNumber,
      act,
    );

    // Write summary to Level 1 memory
    const summaryContent = [
      `# Session ${sessionNumber}, Act ${act} — Summary`,
      "",
      result.summary,
      "",
      "## Key Events",
      ...result.keyEvents.map((e) => `- ${e}`),
    ].join("\n");

    await writeMemoryLevel(1, `session-${sessionNumber}-act-${act}-summary`, summaryContent);

    console.log(`[Compression] Act ${act} compressed: ${substantive.length} messages → ${result.keyEvents.length} key events`);

    return result;
  } catch (err) {
    console.error("[Compression] Failed:", err);
    return null;
  }
}

/**
 * Build a "Previously on..." recap from compressed act summaries.
 * Called at session start to give players context.
 */
export async function buildRecap(sessionNumber: number): Promise<string | null> {
  if (sessionNumber <= 0) return null;

  const { readMemoryLevel: readLevel } = await import("./memory");
  const plotState = await readLevel(1);

  // Find all act summaries from the previous session
  const prefix = `session-${sessionNumber - 1}-act-`;
  const summaries = Object.entries(plotState)
    .filter(([key]) => key.startsWith(prefix) && key.endsWith("-summary"))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, content]) => content);

  if (summaries.length === 0) return null;

  return `Previously on The Ceremony...\n\n${summaries.join("\n\n---\n\n")}`;
}
