import { useEffect, useRef } from "react";
import { api, type EditorProjectPayload } from "../api/client";
import { useProjectStore } from "../state/projectStore";
import { useRunStore } from "../state/runStore";
import { useAuthStore } from "../auth/authStore";

// Phase 18b: persist the free-form editor project (files, active file, tab
// order, stdin, language) to the user_data.editor_project table so it
// follows the user across devices. Lesson-mode code is already persisted
// per-lesson via progressStore.saveCode; this hook handles Editor mode only.
//
// Initial hydration happens in `useProjectStore.hydrateEditor()` (kicked off
// by the auth flow and awaited by HydrationGate), so by the time this hook
// runs the store already reflects the server row. This hook only subscribes
// to in-app changes and debounce-saves them back.

const DEBOUNCE_MS = 800;

export function useEditorProjectPersistence(): void {
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;

    function schedule() {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        if (!useProjectStore.getState().editorHydrated) return;
        const p = useProjectStore.getState();
        if (p.projectContext !== "editor") return;
        const payload: EditorProjectPayload = {
          language: p.language,
          files: p.files,
          activeFile: p.activeFile,
          openTabs: p.openTabs,
          fileOrder: p.order,
          stdin: useRunStore.getState().stdin,
        };
        api.saveEditorProject(payload).catch((err) => {
          console.error("[editorProject] save failed:", (err as Error).message);
        });
      }, DEBOUNCE_MS);
    }

    const unsubP = useProjectStore.subscribe((s, prev) => {
      if (s.projectContext !== "editor") return;
      if (
        s.files === prev.files &&
        s.language === prev.language &&
        s.activeFile === prev.activeFile &&
        s.openTabs === prev.openTabs &&
        s.order === prev.order
      ) {
        return;
      }
      schedule();
    });
    const unsubR = useRunStore.subscribe((s, prev) => {
      if (s.stdin === prev.stdin) return;
      if (useProjectStore.getState().projectContext !== "editor") return;
      schedule();
    });

    return () => {
      unsubP();
      unsubR();
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [authLoading, user]);
}
