import type { AIMessage, EditorSelection, Persona, ProjectFile, RunResult } from "./provider.js";
import { TUTOR_CORE_PROMPT } from "./prompts/coreRules.js";
import { PERSONA_BLOCK } from "./prompts/persona.js";
import { buildSituationBlock } from "./prompts/situation.js";
import {
  renderFiles,
  renderRun,
  renderHistory,
  renderStdin,
  renderDiff,
  renderSelection,
} from "./prompts/renderContext.js";
import type { LessonContext } from "./prompts/lessonContext.js";
import { buildLessonContextBlock } from "./prompts/lessonContext.js";

const GUIDED_ADDENDUM = `

ADDITIONAL GUIDED-MODE RULES:
- You are in GUIDED LESSON mode. The student is following a structured course.
- Never solve the lesson task outright. Your job is to teach, not to unblock.
- If the student asks something outside the lesson scope, briefly acknowledge it
  but redirect them to the current lesson's objectives.
- When giving hints for debug intent, tie them to the specific lesson task rather
  than generic debugging advice.
- Stronger hints should reference the lesson's completion criteria so the student
  knows what "done" looks like.`;

export interface GuidedSystemPromptOptions {
  runsSinceLastTurn?: number;
  editsSinceLastTurn?: number;
  persona?: Persona;
}

export function buildGuidedSystemPrompt(
  history: AIMessage[],
  question: string,
  lessonContext: LessonContext,
  opts: GuidedSystemPromptOptions = {},
): string {
  const situation = buildSituationBlock({
    history,
    question,
    runsSinceLastTurn: opts.runsSinceLastTurn,
    editsSinceLastTurn: opts.editsSinceLastTurn,
  });
  const lessonBlock = buildLessonContextBlock(lessonContext);
  const personaBlock = opts.persona ? PERSONA_BLOCK[opts.persona] : null;

  return [
    TUTOR_CORE_PROMPT + GUIDED_ADDENDUM,
    situation,
    lessonBlock,
    personaBlock,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export interface BuildGuidedUserTurnParams {
  question: string;
  files: ProjectFile[];
  activeFile?: string;
  language?: string;
  lastRun?: RunResult | null;
  history: AIMessage[];
  stdin?: string | null;
  diffSinceLastTurn?: string | null;
  selection?: EditorSelection | null;
}

export function buildGuidedUserTurn(p: BuildGuidedUserTurnParams): string {
  const sections: string[] = [
    `LANGUAGE: ${p.language ?? "python"}`,
    "",
    "PROJECT FILES:",
    renderFiles(p.files, p.activeFile),
    "",
    "STDIN:",
    renderStdin(p.stdin),
    "",
    "LAST RUN:",
    renderRun(p.lastRun),
    "",
    "CHANGES SINCE LAST TUTOR TURN:",
    renderDiff(p.diffSinceLastTurn),
    "",
    "RECENT CONVERSATION:",
    renderHistory(p.history),
  ];

  const selectionBlock = renderSelection(p.selection);
  if (selectionBlock) {
    sections.push("", "STUDENT SELECTION (focus answer here when relevant):", selectionBlock);
  }

  sections.push("", "STUDENT QUESTION:", p.question);
  return sections.join("\n");
}
