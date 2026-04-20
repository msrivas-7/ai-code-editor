import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { AuthShell } from "../auth/AuthShell";
import { supabase } from "../auth/supabaseClient";
import { useAuthStore } from "../auth/authStore";

// Landing route for Supabase's email + OAuth redirects. Our client is
// configured with `detectSessionInUrl: true`, so `getSession()` kicks off
// the PKCE exchange automatically on mount. We just wait for it to resolve
// (or fail) and then either send the user into the app or surface the
// error.
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
          setErr("Sign-in link couldn't be verified. Try again.");
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
      title={err ? "Sign-in failed" : "Signing you in…"}
      subtitle={err ?? "One moment while we verify your link."}
      footer={
        err ? (
          <a href="/login" className="text-accent hover:underline">
            Back to sign in
          </a>
        ) : undefined
      }
    >
      {!err && (
        <div className="flex justify-center">
          <span className="skeleton h-4 w-32 rounded" />
        </div>
      )}
    </AuthShell>
  );
}
