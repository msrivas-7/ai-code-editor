import type { AIMessage } from "../provider.js";
import { truncate } from "./renderContext.js";

export const SUMMARIZE_SYSTEM_PROMPT = `You compress coding-tutor conversations.
Given a transcript between STUDENT and ASSISTANT, produce a 3-6 sentence recap:
1. What the student is working on (language, file(s), goal).
2. What has already been tried and where it went wrong.
3. The most recent direction/hint the assistant gave.
Do NOT include code blocks. Do NOT restate the final answer. Do NOT editorialize.
Output is a single paragraph, plain prose, under 500 characters.`;

export function buildSummarizeInput(history: AIMessage[]): string {
  return history
    .map((m) => `${m.role.toUpperCase()}: ${truncate(m.content, 1200)}`)
    .join("\n\n");
}
