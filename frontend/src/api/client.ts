const JSON_HEADERS = { "Content-Type": "application/json" };

async function post<T>(path: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { ...JSON_HEADERS, ...(extraHeaders ?? {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function get<T>(path: string, extraHeaders?: Record<string, string>): Promise<T> {
  const res = await fetch(path, { headers: extraHeaders });
  if (!res.ok) throw new Error(`${path} failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

import type { AIAskResult, AIMessage, AIModel, Language, ProjectFile, RunResult } from "../types";

export const api = {
  startSession: () => post<{ sessionId: string }>("/api/session"),
  rebindSession: (sessionId: string) =>
    post<{ sessionId: string; reused: boolean }>("/api/session/rebind", { sessionId }),
  // Returns a result object so callers (the heartbeat loop) can distinguish
  // 404 "session is gone" from transient network errors without parsing
  // thrown messages.
  pingSession: async (
    sessionId: string
  ): Promise<{ ok: true } | { ok: false; status: number; error: string }> => {
    try {
      const res = await fetch("/api/session/ping", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ sessionId }),
      });
      if (res.ok) return { ok: true };
      const text = await res.text().catch(() => "");
      return { ok: false, status: res.status, error: text || `HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, status: 0, error: (err as Error).message };
    }
  },
  endSession: (sessionId: string) => post<{ ok: boolean }>("/api/session/end", { sessionId }),
  sessionStatus: (sessionId: string) =>
    get<{ alive: boolean; containerAlive: boolean; lastSeen: number }>(
      `/api/session/${sessionId}/status`
    ),
  health: () => get<{ ok: boolean; uptime: number }>("/api/health"),
  snapshotProject: (sessionId: string, files: ProjectFile[]) =>
    post<{ ok: boolean; fileCount: number }>("/api/project/snapshot", { sessionId, files }),
  execute: (sessionId: string, language: Language) =>
    post<RunResult>("/api/execute", { sessionId, language }),

  validateOpenAIKey: (key: string) =>
    post<{ valid: boolean; error?: string }>("/api/ai/validate-key", { key }),
  listOpenAIModels: (key: string) =>
    get<{ models: AIModel[] }>("/api/ai/models", { "X-OpenAI-Key": key }),
  askAI: (
    key: string,
    body: {
      model: string;
      question: string;
      files: ProjectFile[];
      activeFile?: string;
      language?: string;
      lastRun?: RunResult | null;
      history: AIMessage[];
    }
  ) => post<AIAskResult>("/api/ai/ask", body, { "X-OpenAI-Key": key }),
};
