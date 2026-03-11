import type { JournalEntry } from "./types";
import type { JournalVoice } from "../types";

/**
 * Detect whether journal text is written in player voice or narrator voice.
 * Player voice uses first-person pronouns (I/my/we/our/me/mine/myself).
 * Narrator voice is everything else (third-person, "you", descriptive).
 */
export function detectVoice(text: string): JournalVoice {
  // Match first-person pronouns as whole words (case-insensitive)
  const firstPersonPattern = /\b(I|my|me|mine|myself|we|our|ours|ourselves)\b/i;
  // Count first-person matches vs total words for confidence
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "narrator";

  const firstPersonMatches = words.filter((w) =>
    firstPersonPattern.test(w)
  ).length;

  // If >5% of words are first-person pronouns, it's player voice
  return firstPersonMatches / words.length > 0.05 ? "player" : "narrator";
}

/**
 * Process a journal update from the Keeper response.
 * Returns a JournalEntry with voice detection applied.
 */
export function processJournal(
  journalUpdate: string,
  playerId: string
): JournalEntry {
  const voice = detectVoice(journalUpdate);
  return {
    playerId,
    text: journalUpdate,
    voice,
  };
}
