import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { AuthShell } from "../auth/AuthShell";
import { OAuthButtons } from "../auth/OAuthButtons";
import { PasswordField } from "../auth/PasswordField";
import { isValidEmail } from "../auth/emailValidation";
import { isPasswordAcceptable } from "../auth/passwordPolicy";
import { useAuthStore } from "../auth/authStore";

export default function SignupPage() {
  const nav = useNavigate();
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const signUpWithPassword = useAuthStore((s) => s.signUpWithPassword);
  const clearError = useAuthStore((s) => s.clearError);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // If the Supabase project has email confirmation OFF (local dev default),
  // signUp completes with a live session attached. The auth subscriber will
  // push that into the store within a tick; when it does, we want the user
  // on the app — not parked on the "check your email" panel.
  useEffect(() => {
    if (sent && user) {
      nav("/", { replace: true });
    }
  }, [sent, user, nav]);

  if (!loading && user && !sent) {
    return <Navigate to="/" replace />;
  }

  const emailValid = email === "" || isValidEmail(email);
  const confirmValid = confirm === "" || confirm === password;
  const passwordOk = isPasswordAcceptable(password);
  const canSubmit =
    isValidEmail(email) && passwordOk && password === confirm && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    clearError();
    setSubmitting(true);
    try {
      await signUpWithPassword(email.trim(), password);
      // Supabase default: email confirmation is ON. Show the check-inbox
      // panel rather than bouncing to `/` (which they can't access yet).
      // If the project has confirmations disabled, onAuthStateChange will
      // fire with a session immediately and RequireAuth flow takes over —
      // the `sent` screen is then just a momentary message.
      setSent(true);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <AuthShell
        title="Check your email"
        subtitle={`We sent a confirmation link to ${email}. Click it to activate your account.`}
        footer={
          <button
            type="button"
            onClick={() => nav("/login")}
            className="text-accent hover:underline"
          >
            Back to sign in
          </button>
        }
      >
        <p className="text-center text-[11px] text-muted">
          If you don't see it, check your spam folder. The link expires in
          an hour.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Save your progress and sync it across devices."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
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

        <PasswordField
          id="password"
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          disabled={submitting}
          showPolicy
          describedById="password-policy"
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirm" className="text-[11px] font-medium text-muted">
            Confirm password
          </label>
          <input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            aria-invalid={!confirmValid}
            disabled={submitting}
            className="rounded-md border border-border bg-elevated px-2.5 py-1.5 text-xs text-ink transition focus:border-accent/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger/60"
          />
          {!confirmValid && (
            <span className="text-[10px] text-danger">
              Passwords don't match.
            </span>
          )}
          {confirmValid && confirm.length > 0 && confirm === password && (
            <span className="text-[10px] text-success">✓ Passwords match</span>
          )}
        </div>

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
          disabled={!canSubmit}
          className="rounded-md bg-accent px-3 py-1.5 text-[11px] font-semibold text-bg transition hover:bg-accentMuted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:bg-elevated disabled:text-faint"
        >
          {submitting ? "…" : "Create account"}
        </button>
      </form>

      <div className="my-4 flex items-center gap-2 text-[10px] text-faint">
        <div className="h-px flex-1 bg-border" />
        <span>or sign up with</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <OAuthButtons disabled={submitting} />
    </AuthShell>
  );
}
