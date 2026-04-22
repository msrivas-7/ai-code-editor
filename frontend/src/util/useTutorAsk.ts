import { useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { api, type AskStreamRequest } from "../api/client";
import { useAIStore } from "../state/aiStore";
import { usePreferencesStore } from "../state/preferencesStore";
import { useProjectStore } from "../state/projectStore";
import { useAIStatus, notePlatformQuestionConsumed } from "../state/useAIStatus";
import type { EditorSelection, ProjectFile, AIMessage } from "../types";
import { computeDiffSinceLast } from "./diffSinceLast";
import { parsePartialTutor } from "./partialJson";

// Shape passed to each panel's buildBody callback. The hook owns the
// snapshot/diff/history lifecycle and hands the caller exactly the values it
// needs to compose a request body — the caller is responsible only for the
// language/persona/lessonContext bits that differ per panel.
export interface BuildBodyInput {
  question: string;
  files: ProjectFile[];
  diffSinceLastTurn: string | null;
  historyForSend: AIMessage[];
  selection: EditorSelection | null;
}

export interface UseTutorAskOpts {
  // Compose the final AskStreamRequest from the shared inputs the hook gathers.
  buildBody: (input: BuildBodyInput) => AskStreamRequest;
  // Pre-send hook — returns an optionally-adjusted history slice. The editor
  // panel uses this to plan a background summarize pass and ship a trimmed
  // window; guided mode omits it and ships the full turn-by-turn history.
  beforeSend?: (ctx: { history: AIMessage[] }) => AIMessage[] | undefined;
  // Fires exactly once per ask, after the stream terminates. `ok: true` means
  // the assistant returned a response (onDone); `ok: false` means error /
  // cancel / abort / thrown. Used for side-effects bound to the ask outcome
  // — e.g. the guided panel's hint counter only commits on success, so the
  // student doesn't burn a hint on a 500 they never saw.
  onAskComplete?: (outcome: { ok: boolean }) => void;
}

export interface UseTutorAskResult {
  submitAsk: (question: string) => Promise<void>;
  cancelAsk: () => void;
}

// Shared wrapper around api.askAIStream that owns the panel-agnostic lifecycle
// (abort, snapshot, diff, stream updates, post-abort commit). Both the editor
// AssistantPanel and the guided GuidedTutorPanel use this — previously each
// carried its own near-identical ~100-line copy of this logic.
export function useTutorAsk(opts: UseTutorAskOpts): UseTutorAskResult {
  // P-C1: shallow-compared reactive slice + stable action refs. A no-arg
  // `useAIStore()` re-runs this hook's body on every noteEdit/noteRun tick,
  // which fires during the stream loop (each delta triggers updateStream).
  const { selectedModel, history, asking, lastTurnFiles, activeSelection } =
    useAIStore(
      useShallow((s) => ({
        selectedModel: s.selectedModel,
        history: s.history,
        asking: s.asking,
        lastTurnFiles: s.lastTurnFiles,
        activeSelection: s.activeSelection,
      })),
    );
  const pushUser = useAIStore((s) => s.pushUser);
  const pushAssistant = useAIStore((s) => s.pushAssistant);
  const setAsking = useAIStore((s) => s.setAsking);
  const setAskError = useAIStore((s) => s.setAskError);
  const startStream = useAIStore((s) => s.startStream);
  const updateStream = useAIStore((s) => s.updateStream);
  const clearStream = useAIStore((s) => s.clearStream);
  const commitTurnSnapshot = useAIStore((s) => s.commitTurnSnapshot);
  const setActiveSelection = useAIStore((s) => s.setActiveSelection);

  const hasKey = usePreferencesStore((s) => s.hasOpenaiKey);
  const snapshot = useProjectStore((s) => s.snapshot);
  const { status: aiStatus } = useAIStatus();
  const abortRef = useRef<AbortController | null>(null);

  // Platform (free-tier) users have no BYOK key and no selectedModel — the
  // backend picks `gpt-4.1-nano` for them. Mirror the panel-level gate here
  // so submitAsk doesn't early-return for every platform user.
  const onPlatform = !hasKey && aiStatus?.source === "platform";
  const configured = onPlatform || (hasKey && !!selectedModel);

  const submitAsk = async (question: string): Promise<void> => {
    const trimmed = question.trim();
    if (!trimmed || !configured || asking) return;

    const selectionForTurn = activeSelection;
    setActiveSelection(null);
    pushUser(trimmed);
    setAsking(true);
    setAskError(null);
    startStream();

    const controller = new AbortController();
    abortRef.current = controller;
    let raw = "";
    let committed = false;

    // P-C2: throttle the partial-JSON parse + store update. At ~50 tokens/s
    // the provider emits chunks every ~20ms; re-parsing the growing buffer
    // on every chunk walked O(n²) work and dragged the whole panel into a
    // re-render loop. 100ms feels instant to a human but drops parse work
    // by ~5x during the fastest parts of a stream. Prefer requestIdleCallback
    // (browsers only call back when the main thread is free) with a 100ms
    // deadline so a busy tab still animates smoothly.
    type TimerHandle = number | ReturnType<typeof setTimeout>;
    let pendingParse: TimerHandle | null = null;
    const cancelPending = (): void => {
      if (pendingParse == null) return;
      if (typeof window !== "undefined" && "cancelIdleCallback" in window) {
        (window as Window).cancelIdleCallback!(pendingParse as number);
      } else {
        clearTimeout(pendingParse as ReturnType<typeof setTimeout>);
      }
      pendingParse = null;
    };
    const scheduleParse = (): void => {
      if (pendingParse != null) return;
      const flush = (): void => {
        pendingParse = null;
        updateStream(raw, parsePartialTutor(raw));
      };
      if (typeof window !== "undefined" && "requestIdleCallback" in window) {
        pendingParse = (window as Window).requestIdleCallback!(flush, { timeout: 100 });
      } else {
        pendingParse = setTimeout(flush, 100);
      }
    };

    try {
      const files = snapshot();
      const diffSinceLastTurn = computeDiffSinceLast(lastTurnFiles, files);
      // Snapshot BEFORE the request goes out so that edits/runs during the
      // model's thinking time are attributed to the NEXT turn.
      commitTurnSnapshot(files);

      const adjusted = opts.beforeSend?.({ history });
      const historyForSend =
        adjusted ?? history.map((m) => ({ role: m.role, content: m.content }));

      const body = opts.buildBody({
        question: trimmed,
        files,
        diffSinceLastTurn,
        historyForSend,
        selection: selectionForTurn,
      });

      let askOk = false;
      await api.askAIStream(body, {
        signal: controller.signal,
        onDelta: (chunk) => {
          raw += chunk;
          scheduleParse();
        },
        onDone: (finalRaw, sections, usage) => {
          cancelPending();
          pushAssistant(finalRaw || raw, sections, usage);
          clearStream();
          committed = true;
          askOk = true;
          // P-H6: optimistic local decrement avoids a /ai-status refetch per
          // turn. The 30s cache + next natural fetch reconciles if we drift.
          if (aiStatus?.source === "platform") notePlatformQuestionConsumed();
        },
        onError: (message) => {
          cancelPending();
          setAskError(message);
          clearStream();
          committed = true;
        },
      });

      // Abort path: askAIStream returns without firing onDone/onError. Commit
      // partial text so the student keeps the context rather than losing it.
      // An aborted ask still counts as "not ok" for outcome-bound side-effects
      // (e.g. hint rollback) — the student pressed Stop or walked away.
      if (!committed && controller.signal.aborted && raw.trim()) {
        cancelPending();
        pushAssistant(raw, parsePartialTutor(raw));
        clearStream();
      }
      opts.onAskComplete?.({ ok: askOk });
    } catch (err) {
      cancelPending();
      setAskError((err as Error).message);
      clearStream();
      opts.onAskComplete?.({ ok: false });
    } finally {
      cancelPending();
      setAsking(false);
      abortRef.current = null;
    }
  };

  const cancelAsk = (): void => {
    abortRef.current?.abort();
  };

  return { submitAsk, cancelAsk };
}
