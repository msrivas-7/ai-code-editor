import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { AuthShell } from "../auth/AuthShell";
import { supabase } from "../auth/supabaseClient";
import { useAuthStore } from "../auth/authStore";

// Landing route for Supabase's email + OAuth redirects. Our client is
// configured with `detectSessionInUrl: true`, so `getSession()` kicks off
// the PKCE exchange automatically on mount. We just wait for it to resolve
// (or fail) and then either send the user into the app or surface the
// error.
//
// Microcopy notes: the failure message needs to be actionable, not just
// "failed". The three realistic causes (expired link, already-clicked
// link, unknown-tenant OAuth) all share the same fix — go back and start
// the sign-in again — so we surface that as a primary action rather than
// forcing the user to reason about a raw Supabase error string.
export default function AuthCallbackPage() {
  const user = useAuthStore((s) => s.user);
  const [err, setErr] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setErr(error.message);
        } else if (!data.session) {
          setErr(
            "That sign-in link is expired or was already used. Request a new one to continue.",
          );
        }
        setReady(true);
      })
      .catch((e) => {
        if (cancelled) return;
        setErr((e as Error).message);
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (ready && user) return <Navigate to="/" replace />;

  return (
    <AuthShell
      title={err ? "We couldn't finish signing you in" : "Signing you in…"}
      subtitle={
        err ??
        "Verifying your link — this only takes a moment."
      }
      footer={
        err ? (
          <Link to="/login" className="text-accent hover:underline">
            Back to sign in
          </Link>
        ) : undefined
      }
    >
      {err ? (
        <div
          role="alert"
          aria-live="assertive"
          className="flex flex-col items-center gap-2 text-center text-xs text-muted"
        >
          <p>
            If you came from a magic-link email, request a new link. Links
            expire after an hour and can only be used once.
          </p>
        </div>
      ) : (
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          className="flex justify-center"
        >
          <span className="skeleton h-4 w-32 rounded" />
        </div>
      )}
    </AuthShell>
  );
}
