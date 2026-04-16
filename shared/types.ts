export type Language = "python" | "javascript" | "c" | "cpp" | "java";

export interface ProjectFile {
  path: string;
  content: string;
}

export interface SessionStatus {
  alive: boolean;
  containerAlive: boolean;
  lastSeen: number;
}

export interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  errorType: "none" | "compile" | "runtime" | "timeout" | "system";
  durationMs: number;
}

export interface AIMessage {
  role: "user" | "assistant";
  content: string;
}

export interface TutorSections {
  whatIThink?: string;
  whatToCheck?: string;
  hint?: string;
  nextStep?: string;
  strongerHint?: string;
}

export interface AIAskResponse {
  sections: TutorSections;
  raw: string;
}
