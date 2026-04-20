import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthShell } from "../auth/AuthShell";
import { OAuthButtons } from "../auth/OAuthButtons";
import { PasswordField } from "../auth/PasswordField";
import { isValidEmail } from "../auth/emailValidation";
import { useAuthStore } from "../auth/authStore";

type Mode = "password" | "magic-link" | "magic-link-sent";

export default function LoginPage() {
  const nav = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const signInWithPassword = useAuthStore((s) => s.signInWithPassword);
  const signInWithMagicLink = useAuthStore((s) => s.signInWithMagicLink);
  const clearError = useAuthStore((s) => s.clearError);

  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // If the user is already authenticated (eg. came here by typing the URL)
  // bounce straight through. Preserve `from` if present for symmetry with
  // RequireAuth's redirect state.
  if (!loading && user) {
    const to =
      (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? "/";
    return <Navigate to={to} replace />;
  }

  const emailValid = email === "" || isValidEmail(email);
  const canSubmitPassword = isValidEmail(email) && password.length > 0 && !submitting;
  const canSubmitMagic = isValidEmail(email) && !submitting;

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    clearError();
    setSubmitting(true);
    try {
      await signInWithPassword(email.trim(), password);
      const to =
        (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? "/";
      nav(to, { replace: true });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    clearError();
    setSubmitting(true);
    try {
      await signInWithMagicLink(email.trim());
      setMode("magic-link-sent");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (mode === "magic-link-sent") {
    return (
      <AuthShell
        title="Check your email"
        subtitle={`We sent a sign-in link to ${email}. Click it to finish signing in.`}
        footer={
          <button
            type="button"
            onClick={() => {
              setMode("magic-link");
              setErr(null);
            }}
            className="text-accent hover:underline"
          >
            Use a different email
          </button>
        }
      >
        <p className="text-center text-[11px] text-muted">
          The link expires in an hour. You can close this tab once you've
          clicked it.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle="Welcome back. Keep your progress across devices."
      footer={
        <>
          Don't have an account?{" "}
          <Link to="/signup" className="text-accent hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <form
        onSubmit={mode === "password" ? handlePassword : handleMagicLink}
        className="flex flex-col gap-3"
        noValidate
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-[11px] font-medium text-muted">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            aria-invalid={!emailValid}
            disabled={submitting}
            className="rounded-md border border-border bg-elevated px-2.5 py-1.5 text-xs text-ink transition placeholder:text-faint focus:border-accent/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger/60"
          />
          {!emailValid && (
            <span className="text-[10px] text-danger">
              Enter a valid email address.
            </span>
          )}
        </div>

        {mode === "password" && (
          <PasswordField
            id="password"
            label="Password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            disabled={submitting}
          />
        )}

        {err && (
          <div
            role="alert"
            className="rounded-md border border-danger/40 bg-danger/10 px-2.5 py-1.5 text-[11px] text-danger"
          >
            {err}
          </div>
        )}

        <button
          type="submit"
          disabled={mode === "password" ? !canSubmitPassword : !canSubmitMagic}
          className="rounded-md bg-accent px-3 py-1.5 text-[11px] font-semibold text-bg transition hover:bg-accentMuted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:bg-elevated disabled:text-faint"
        >
          {submitting
            ? "…"
            : mode === "password"
              ? "Sign in"
              : "Send magic link"}
        </button>

        <div className="flex items-center justify-between text-[10px]">
          <button
            type="button"
            onClick={() => {
              setMode(mode === "password" ? "magic-link" : "password");
              setErr(null);
            }}
            className="text-accent hover:underline"
          >
            {mode === "password"
              ? "Prefer not to use a password?"
              : "Use a password instead"}
          </button>
          {mode === "password" && (
            <Link to="/reset-password" className="text-muted hover:text-ink">
              Forgot password?
            </Link>
          )}
        </div>
      </form>

      <div className="my-4 flex items-center gap-2 text-[10px] text-faint">
        <div className="h-px flex-1 bg-border" />
        <span>or continue with</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <OAuthButtons disabled={submitting} />
    </AuthShell>
  );
}
