import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../auth/authStore";

// Phase 18a: header-mounted user menu. Industry standard for auth'd web apps
// (GitHub, Vercel, Figma, Notion, …) — avatar in the top-right opens a
// dropdown with the signed-in email and Sign-out. Account concerns live here,
// not buried inside SettingsPanel's tabs — a user shouldn't have to open
// "Settings" to sign out.
//
// v1 is intentionally lean: email + sign-out + a disabled Delete-account
// stub we'll light up when the server-side delete path exists. Keeps the
// surface area matched to what 18a actually ships.

function initialsFrom(email: string | null | undefined, id: string): string {
  if (email && email.includes("@")) {
    const local = email.split("@")[0];
    return (local[0] ?? "?").toUpperCase();
  }
  return (id[0] ?? "?").toUpperCase();
}

export function UserMenu({ className }: { className?: string } = {}) {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Click-outside + Escape to close. Standard dropdown ergonomics.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;

  const email = user.email ?? null;
  const initial = initialsFrom(email, user.id);

  const handleSignOut = async () => {
    setErr(null);
    setSigningOut(true);
    try {
      await signOut();
      nav("/login", { replace: true });
    } catch (e) {
      setErr((e as Error).message);
      setSigningOut(false);
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open user menu"
        title={email ?? "Account"}
        className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-elevated text-[11px] font-semibold text-ink transition hover:border-accent/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {initial}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-9 z-50 w-60 rounded-md border border-border bg-panel p-2 shadow-lg"
        >
          <div className="flex flex-col gap-0.5 px-2 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
              Signed in as
            </span>
            <span className="break-all text-xs text-ink">{email ?? user.id}</span>
          </div>

          <div className="my-1 h-px bg-border" />

          {err && (
            <div
              role="alert"
              className="mx-1 mb-1 rounded-md border border-danger/40 bg-danger/10 px-2 py-1 text-[11px] text-danger"
            >
              {err}
            </div>
          )}

          <button
            role="menuitem"
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-[11px] font-semibold text-ink transition hover:bg-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>

          <button
            role="menuitem"
            disabled
            title="Available in a future update"
            className="mt-0.5 flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-[11px] font-semibold text-faint"
          >
            Delete account
          </button>
        </div>
      )}
    </div>
  );
}
