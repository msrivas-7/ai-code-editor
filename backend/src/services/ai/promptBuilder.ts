import type { AIMessage, ProjectFile, RunResult } from "./provider.js";

// Tutor policy (spec §15). The assistant is a coaching guide, not a solver.
// Keep these rules explicit — the quality of the tutor depends entirely on
// this prompt.
const TUTOR_BASE_PROMPT = `You are a coding TUTOR helping a student learn. Follow these rules strictly:

1. You GUIDE. You do NOT write full solutions or paste corrected code blocks.
2. When the student's code has a specific bug, point to the FILE and LINE or the symptom — let them fix it.
3. Never invent library APIs. Only use functions/modules that appear in the student's code or in the language's standard library.
4. If the student asks "just give me the answer", still lead with a hint — do not produce a full solution.
5. Keep responses short. Each section at most 2-3 sentences. No code blocks longer than one line.
6. Prefer diagnostic questions ("what do you expect X to be when Y happens?") over direct statements when the student seems unsure.

Respond with JSON matching the provided schema. Never include full code solutions in any field.`;

const STUCK_SIGNALS = [
  "stuck", "don't understand", "don't get", "confused", "give up",
  "just tell me", "just give me", "what's the answer", "what is the answer",
  "i give up", "no idea", "what line", "which line", "show me the fix",
];

export function studentSeemsStuck(question: string): boolean {
  const q = question.toLowerCase();
  return STUCK_SIGNALS.some((s) => q.includes(s));
}

function countAssistantTurns(history: AIMessage[]): number {
  return history.filter((m) => m.role === "assistant").length;
}

// Turn-aware guidance: the quality issue we saw in practice is that on a
// student's FIRST question the tutor dumps a hint AND a next step that names
// the fix ("add a sort() call at the top of median()"). That's too close to a
// solution. So we thread hint strength through the system prompt based on how
// many tutor turns have already happened AND on whether the student signalled
// being stuck.
export function buildSystemPrompt(history: AIMessage[], question: string): string {
  const priorTutorTurns = countAssistantTurns(history);
  const stuck = studentSeemsStuck(question);

  let guidance: string;
  if (priorTutorTurns === 0 && !stuck) {
    // First turn, student has not signalled being stuck. Lean on diagnostic
    // questions. No hint, no next step, no stronger hint yet.
    guidance = `TURN GUIDANCE — FIRST QUESTION:
- Fill "whatIThink" with your read of the problem (1-3 sentences).
- Fill "whatToCheck" with 1-3 diagnostic questions, one per line.
- Leave "hint", "nextStep", and "strongerHint" as null. Do not name the fix.
- The student has not said they are stuck. Let them think first.`;
  } else if (priorTutorTurns >= 1 && !stuck) {
    // Follow-up turn. Student may be iterating. Offer a soft hint, but do not
    // name the exact fix unless they ask.
    guidance = `TURN GUIDANCE — FOLLOW-UP:
- Fill "whatIThink" briefly if still relevant; otherwise leave null.
- You may fill "hint" with a small nudge (still not the fix).
- You may fill "nextStep" with one concrete exploratory action.
- Leave "strongerHint" null unless the student explicitly said they are stuck.`;
  } else {
    // Student has said they are stuck, or asked again. Escalate — but still no
    // full solution.
    guidance = `TURN GUIDANCE — STUDENT STUCK:
- The student has signalled being stuck or asked for more help.
- Fill "hint" with a clearer pointer at the fix location.
- Fill "nextStep" with one concrete change to try (describe the change, don't write the code).
- Fill "strongerHint" with the most explicit guidance you'll give — still a pointer, not the replacement code.
- Never paste a working replacement block. The student still writes the fix.`;
  }

  return `${TUTOR_BASE_PROMPT}\n\n${guidance}`;
}

const MAX_FILE_CHARS = 4000;
const MAX_RUN_CHARS = 2000;
const MAX_HISTORY = 6;

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + `\n… [truncated, ${s.length - max} more chars]`;
}

function renderFiles(files: ProjectFile[], activeFile?: string): string {
  const sorted = [...files].sort((a, b) => {
    if (a.path === activeFile) return -1;
    if (b.path === activeFile) return 1;
    return a.path.localeCompare(b.path);
  });
  return sorted
    .map((f) => {
      const marker = f.path === activeFile ? " (ACTIVE)" : "";
      const body = truncate(f.content, MAX_FILE_CHARS);
      return `--- ${f.path}${marker} ---\n${body}`;
    })
    .join("\n\n");
}

function renderRun(run: RunResult | null | undefined): string {
  if (!run) return "No run yet.";
  const lines = [
    `stage: ${run.stage}`,
    `exitCode: ${run.exitCode}`,
    `errorType: ${run.errorType}`,
    `durationMs: ${run.durationMs}`,
  ];
  if (run.stdout) lines.push(`stdout:\n${truncate(run.stdout, MAX_RUN_CHARS)}`);
  if (run.stderr) lines.push(`stderr:\n${truncate(run.stderr, MAX_RUN_CHARS)}`);
  return lines.join("\n");
}

function renderHistory(history: AIMessage[]): string {
  if (!history.length) return "(no prior turns)";
  return history
    .slice(-MAX_HISTORY)
    .map((m) => `${m.role.toUpperCase()}: ${truncate(m.content, 800)}`)
    .join("\n\n");
}

export interface BuildUserTurnParams {
  question: string;
  files: ProjectFile[];
  activeFile?: string;
  language?: string;
  lastRun?: RunResult | null;
  history: AIMessage[];
}

export function buildUserTurn(p: BuildUserTurnParams): string {
  return [
    `LANGUAGE: ${p.language ?? "unspecified"}`,
    "",
    "PROJECT FILES:",
    renderFiles(p.files, p.activeFile),
    "",
    "LAST RUN:",
    renderRun(p.lastRun),
    "",
    "RECENT CONVERSATION:",
    renderHistory(p.history),
    "",
    "STUDENT QUESTION:",
    p.question,
  ].join("\n");
}

// JSON schema for OpenAI Responses API structured output. Every field is
// marked required AND nullable — the Responses API's strict mode requires all
// properties to appear in `required`, so we use `null` to mean "omitted".
export const TUTOR_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["whatIThink", "whatToCheck", "hint", "nextStep", "strongerHint"],
  properties: {
    whatIThink: {
      type: ["string", "null"],
      description: "Your read of what's happening, 1-3 sentences. Required unless the question is pure chit-chat.",
    },
    whatToCheck: {
      type: ["string", "null"],
      description: "Up to 3 specific things the student should verify, one per line.",
    },
    hint: {
      type: ["string", "null"],
      description: "A small nudge toward the fix. Not a solution.",
    },
    nextStep: {
      type: ["string", "null"],
      description: "One concrete action to take next.",
    },
    strongerHint: {
      type: ["string", "null"],
      description: "More explicit guidance. Only fill this when the student has asked again or is clearly stuck; otherwise null.",
    },
  },
} as const;
