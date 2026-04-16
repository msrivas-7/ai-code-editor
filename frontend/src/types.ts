export type Language = "python" | "javascript" | "c" | "cpp" | "java";

export interface ProjectFile {
  path: string;
  content: string;
}

export type ErrorType = "none" | "compile" | "runtime" | "timeout" | "system";

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  errorType: ErrorType;
  durationMs: number;
  stage: "compile" | "run" | "setup";
}

export const LANGUAGES: Language[] = ["python", "javascript", "c", "cpp", "java"];

export const LANGUAGE_LABEL: Record<Language, string> = {
  python: "Python",
  javascript: "JavaScript",
  c: "C",
  cpp: "C++",
  java: "Java",
};

export const LANGUAGE_ENTRYPOINT: Record<Language, string> = {
  python: "main.py",
  javascript: "main.js",
  c: "main.c",
  cpp: "main.cpp",
  java: "Main.java",
};

export interface TutorSections {
  whatIThink?: string | null;
  whatToCheck?: string | null;
  hint?: string | null;
  nextStep?: string | null;
  strongerHint?: string | null;
}

export interface AIMessage {
  role: "user" | "assistant";
  content: string;
  sections?: TutorSections;
}

export interface AIModel {
  id: string;
  label: string;
}

export interface AIAskResult {
  sections: TutorSections;
  raw: string;
}

export function monacoLangFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "py": return "python";
    case "js": return "javascript";
    case "ts": return "typescript";
    case "c":
    case "h": return "c";
    case "cpp":
    case "cc":
    case "cxx":
    case "hpp": return "cpp";
    case "java": return "java";
    case "json": return "json";
    case "md": return "markdown";
    default: return "plaintext";
  }
}
