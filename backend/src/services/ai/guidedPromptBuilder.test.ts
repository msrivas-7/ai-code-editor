import { describe, it, expect } from "vitest";
import type { AIMessage } from "./provider.js";
import {
  buildGuidedSystemPrompt,
  buildGuidedUserTurn,
} from "./guidedPromptBuilder.js";
import type { LessonContext } from "./prompts/lessonContext.js";

const lessonCtx: LessonContext = {
  courseId: "python-fundamentals",
  lessonId: "hello-world",
  lessonTitle: "Hello, World!",
  lessonObjectives: ["Write and run a Python program", "Use print()"],
  conceptTags: ["print", "strings", "syntax"],
  completionRules: [{ type: "expected_stdout", expected: "Hello, World!" }],
  studentProgressSummary: "attempt 2, 1 run, 0 hints",
  lessonOrder: 1,
  totalLessons: 10,
};

const noHistory: AIMessage[] = [];
const oneTurn: AIMessage[] = [
  { role: "user", content: "help" },
  { role: "assistant", content: "sure" },
];

describe("buildGuidedSystemPrompt", () => {
  it("includes the core tutor rules", () => {
    const prompt = buildGuidedSystemPrompt(noHistory, "hi", lessonCtx);
    expect(prompt).toMatch(/coding TUTOR/);
  });

  it("includes the GUIDED_ADDENDUM rules", () => {
    const prompt = buildGuidedSystemPrompt(noHistory, "hi", lessonCtx);
    expect(prompt).toMatch(/GUIDED LESSON mode/);
    expect(prompt).toMatch(/Never solve the lesson task outright/);
  });

  it("includes the lesson context block with title and objectives", () => {
    const prompt = buildGuidedSystemPrompt(noHistory, "hi", lessonCtx);
    expect(prompt).toMatch(/GUIDED LESSON/);
    expect(prompt).toMatch(/"Hello, World!"/);
    expect(prompt).toMatch(/Write and run a Python program/);
    expect(prompt).toMatch(/Use print\(\)/);
  });

  it("includes concept tags", () => {
    const prompt = buildGuidedSystemPrompt(noHistory, "hi", lessonCtx);
    expect(prompt).toMatch(/print, strings, syntax/);
  });

  it("includes lesson order info", () => {
    const prompt = buildGuidedSystemPrompt(noHistory, "hi", lessonCtx);
    expect(prompt).toMatch(/lesson 1 of 10/);
  });

  it("includes SITUATION block", () => {
    const prompt = buildGuidedSystemPrompt(oneTurn, "stuck", lessonCtx);
    expect(prompt).toMatch(/SITUATION:/);
    expect(prompt).toMatch(/Prior tutor turns in this conversation: 1/);
  });

  it("includes persona block when specified", () => {
    const prompt = buildGuidedSystemPrompt(noHistory, "hi", lessonCtx, {
      persona: "beginner",
    });
    expect(prompt).toMatch(/beginner/i);
  });

  it("omits persona block when not specified", () => {
    const withPersona = buildGuidedSystemPrompt(noHistory, "hi", lessonCtx, {
      persona: "advanced",
    });
    const without = buildGuidedSystemPrompt(noHistory, "hi", lessonCtx);
    expect(withPersona.length).toBeGreaterThan(without.length);
  });

  it("passes run/edit counts to the situation block", () => {
    const prompt = buildGuidedSystemPrompt(noHistory, "hi", lessonCtx, {
      runsSinceLastTurn: 5,
      editsSinceLastTurn: 3,
    });
    expect(prompt).toMatch(/Runs since last tutor turn: 5/);
    expect(prompt).toMatch(/Edits since last tutor turn: 3/);
  });

  it("includes completion criteria description", () => {
    const prompt = buildGuidedSystemPrompt(noHistory, "hi", lessonCtx);
    expect(prompt).toMatch(/produce stdout containing "Hello, World!"/);
  });

  it("includes student progress summary", () => {
    const prompt = buildGuidedSystemPrompt(noHistory, "hi", lessonCtx);
    expect(prompt).toMatch(/attempt 2, 1 run, 0 hints/);
  });
});

describe("buildGuidedUserTurn", () => {
  it("defaults language to python", () => {
    const body = buildGuidedUserTurn({ question: "?", files: [], history: [] });
    expect(body).toMatch(/LANGUAGE: python/);
  });

  it("includes all standard sections", () => {
    const body = buildGuidedUserTurn({ question: "help me", files: [], history: [] });
    expect(body).toMatch(/PROJECT FILES:/);
    expect(body).toMatch(/STDIN:/);
    expect(body).toMatch(/LAST RUN:/);
    expect(body).toMatch(/CHANGES SINCE LAST TUTOR TURN:/);
    expect(body).toMatch(/RECENT CONVERSATION:/);
    expect(body).toMatch(/STUDENT QUESTION:\nhelp me/);
  });

  it("renders files", () => {
    const body = buildGuidedUserTurn({
      question: "?",
      files: [{ path: "main.py", content: "print('hi')" }],
      activeFile: "main.py",
      history: [],
    });
    expect(body).toMatch(/--- main\.py \(ACTIVE\) ---/);
    expect(body).toMatch(/print\('hi'\)/);
  });

  it("includes selection block when provided", () => {
    const body = buildGuidedUserTurn({
      question: "what does this do",
      files: [],
      history: [],
      selection: { path: "main.py", startLine: 3, endLine: 5, text: "for i in range(10):" },
    });
    expect(body).toMatch(/STUDENT SELECTION/);
    expect(body).toMatch(/main\.py \(lines 3-5\)/);
    expect(body).toMatch(/for i in range\(10\):/);
  });

  it("omits selection block when not provided", () => {
    const body = buildGuidedUserTurn({ question: "?", files: [], history: [] });
    expect(body).not.toMatch(/STUDENT SELECTION/);
  });

  it("renders run result when provided", () => {
    const body = buildGuidedUserTurn({
      question: "?",
      files: [],
      history: [],
      lastRun: {
        stdout: "Hello!",
        stderr: "",
        exitCode: 0,
        errorType: "none",
        durationMs: 50,
        stage: "run",
      },
    });
    expect(body).toMatch(/stdout:\nHello!/);
    expect(body).toMatch(/exitCode: 0/);
  });
});
