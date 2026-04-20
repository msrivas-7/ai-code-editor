import type { ReactNode } from "react";
import { usePreferencesStore } from "../state/preferencesStore";
import { useProgressStore } from "../features/learning/stores/progressStore";
import { useProjectStore } from "../state/projectStore";
import { useAuthStore } from "./authStore";
import { bumpGen } from "./generation";

// Phase 18b: after a user signs in, their preferences + progress are pulled
// from the server. Components that render pre-hydration would flash defaults
// (dark theme before the user's saved light theme; WelcomeOverlay before the
// welcomeDone flag lands; Monaco starter content before the persisted editor
// project) for a frame or two. This gate blocks the authenticated tree until
// every store reports `hydrated: true`, eliminating the whole class of
// hydration races.
//
// On fetch failure, stores now record `hydrateError` and leave `hydrated`
// at false so this gate stays up. That's intentional: if we let the app
// render with defaults after a transient Supabase outage, the first user
// mutation would overwrite the real row with those defaults. Instead we
// show a Retry button and a Sign-out escape hatch.
//
// Unauthenticated users bypass the gate — `useAuthStore.user` is null so
// there's no user state to hydrate yet; they see the login page directly.
export function HydrationGate({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const prefsHydrated = usePreferencesStore((s) => s.hydrated);
  const prefsError = usePreferencesStore((s) => s.hydrateError);
  const progressHydrated = useProgressStore((s) => s.hydrated);
  const progressError = useProgressStore((s) => s.hydrateError);
  const editorHydrated = useProjectStore((s) => s.editorHydrated);
  const editorError = useProjectStore((s) => s.editorHydrateError);

  const stillLoading =
    !!user && (!prefsHydrated || !progressHydrated || !editorHydrated);
  const firstError = prefsError ?? progressError ?? editorError;

  if (stillLoading && firstError) {
    // Hydration failed — offer Retry + Sign out. Retry re-kicks each
    // store under a fresh generation so late in-flight responses from
    // the previous attempt can't overwrite the retry result.
    const retry = () => {
      const g = bumpGen();
      void usePreferencesStore.getState().hydrate(g);
      void useProgressStore.getState().hydrate(g);
      void useProjectStore.getState().hydrateEditor(g);
    };
    return (
      <div
        className="flex h-full items-center justify-center bg-bg text-fg"
        role="alert"
        aria-live="assertive"
        data-testid="hydration-gate-error"
      >
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <p className="text-sm font-medium">Couldn't load your data.</p>
          <p className="text-xs text-muted">{firstError}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={retry}
              className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded border border-border px-3 py-1.5 text-xs font-medium hover:bg-elevated"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (stillLoading) {
    return (
      <div
        className="flex h-full items-center justify-center bg-bg text-muted"
        role="status"
        aria-live="polite"
        data-testid="hydration-gate"
      >
        <div className="flex flex-col items-center gap-3">
          <span className="skeleton h-4 w-32 rounded" />
          <p className="text-xs">Setting things up…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
