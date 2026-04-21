import { useState } from "react";
import { Modal } from "./Modal";
import { api } from "../api/client";
import { useAuthStore } from "../auth/authStore";

// Phase 20-P0 #9: destructive confirm dialog for self-service account
// deletion. The user has to re-type their email before the Delete button
// enables — blunts accidental clicks from a shared laptop and also acts as
// a second line of defense against a leaked session (the server re-checks
// the email against the JWT claim, but the UX guardrail matters for the
// common "oh no" case). On success we sign out (which triggers
// RequireAuth → /login) and show a one-shot toast by passing a search
// param through the redirect.
interface DeleteAccountModalProps {
  onClose: () => void;
}

export function DeleteAccountModal({ onClose }: DeleteAccountModalProps) {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const email = (user?.email ?? "").trim();

  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const matches =
    email.length > 0 && draft.trim().toLowerCase() === email.toLowerCase();

  const handleDelete = async () => {
    if (!matches || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await api.deleteAccount(draft.trim());
      // Clear Supabase session locally; the onAuthStateChange listener
      // hydrates the redirect. Append `?deleted=1` so the login page can
      // show a confirmation toast.
      await signOut().catch(() => {});
      window.location.replace("/signup?deleted=1");
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  if (!user) return null;

  return (
    <Modal
      onClose={busy ? () => {} : onClose}
      role="alertdialog"
      labelledBy="delete-account-title"
      position="center"
      panelClassName="w-full max-w-md rounded-xl border border-danger/40 bg-panel p-5 shadow-xl"
    >
      <div className="flex flex-col gap-3">
        <h2
          id="delete-account-title"
          className="text-sm font-semibold text-danger"
        >
          Delete account
        </h2>
        <p className="text-[12px] leading-relaxed text-ink/90">
          This permanently removes your account, lesson progress, saved editor
          projects, preferences, and your encrypted OpenAI key from our
          servers. <span className="font-semibold">This cannot be undone.</span>
        </p>
        <p className="text-[12px] leading-relaxed text-ink/80">
          Type your email <span className="font-mono text-ink">{email}</span>{" "}
          to confirm.
        </p>
        <input
          type="email"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (err) setErr(null);
          }}
          placeholder={email}
          autoComplete="off"
          spellCheck={false}
          disabled={busy}
          className="rounded-md border border-border bg-elevated px-2.5 py-1.5 font-mono text-xs text-ink transition placeholder:text-faint focus:border-danger/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-danger disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Confirm email"
        />
        {err && (
          <div
            role="alert"
            className="rounded-md border border-danger/40 bg-danger/10 px-2 py-1 text-[11px] text-danger"
          >
            {err}
          </div>
        )}
        <div className="mt-1 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-md border border-border bg-elevated px-3 py-1 text-[11px] font-semibold text-ink transition hover:border-accent/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!matches || busy}
            aria-busy={busy}
            className="rounded-md bg-danger px-3 py-1 text-[11px] font-semibold text-bg transition hover:bg-danger/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-danger disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Deleting…" : "Delete account"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
