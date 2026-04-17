import { studentSeemsStuck, countAssistantTurns } from "./stuckDetection.js";
import type { AIMessage } from "../provider.js";

export interface SituationParams {
  history: AIMessage[];
  question: string;
  runsSinceLastTurn?: number;
  editsSinceLastTurn?: number;
}

export function buildSituationBlock(params: SituationParams): string {
  const priorTutorTurns = countAssistantTurns(params.history);
  const stuck = studentSeemsStuck(params.question);
  const runs = params.runsSinceLastTurn ?? 0;
  const edits = params.editsSinceLastTurn ?? 0;

  return `SITUATION:
- Prior tutor turns in this conversation: ${priorTutorTurns}
- Student signalled being stuck: ${stuck}
- Runs since last tutor turn: ${runs}
- Edits since last tutor turn: ${edits}

Use activity counters to calibrate tone:
- Zero edits AND zero runs after a prior tutor turn → the student is probably
  re-reading or confused; favour "explain"/clarification over new hints.
- High edits AND high runs with the same failure → experimentation isn't
  working; escalate hints sooner.

For intent="debug", calibrate escalation using SITUATION:
- 0 prior turns AND not stuck → fill "diagnose" + "checkQuestions" only; leave "hint",
  "nextStep", "strongerHint" null. Let the student think first.
- Prior turns > 0 AND not stuck → may add "hint" (small nudge) and/or "nextStep".
  Leave "strongerHint" null unless the student explicitly said they're stuck.
- Stuck = true → fill "hint", "nextStep", AND "strongerHint". Strongest hint still
  points at the location, never the replacement code.

STUCKNESS (emit in the "stuckness" field, one of "low" | "medium" | "high" | null):
- "low" → student is making progress (fresh question or obvious follow-up).
- "medium" → two+ follow-ups on the same issue, or edits+runs+still-failing without
  explicit frustration.
- "high" → student said they're stuck OR three+ unsuccessful runs on the same
  symptom OR repeating a question we already answered. When you emit "high" you
  MUST also fill "strongerHint".
- Leave null if it's a first turn with no prior context.`;
}
