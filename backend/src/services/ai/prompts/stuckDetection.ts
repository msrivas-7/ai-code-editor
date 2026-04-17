import type { AIMessage } from "../provider.js";

const STUCK_SIGNALS = [
  "stuck", "don't understand", "don't get", "confused", "give up",
  "just tell me", "just give me", "what's the answer", "what is the answer",
  "i give up", "no idea", "what line", "which line", "show me the fix",
  "doesn't make sense", "makes no sense", "still broken", "still not working",
  "frustrated", "tried everything",
];

export function studentSeemsStuck(question: string): boolean {
  const q = question.toLowerCase();
  return STUCK_SIGNALS.some((s) => q.includes(s));
}

export function countAssistantTurns(history: AIMessage[]): number {
  return history.filter((m) => m.role === "assistant").length;
}
