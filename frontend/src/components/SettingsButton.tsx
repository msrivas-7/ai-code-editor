import { useState } from "react";
import { SettingsModal } from "./SettingsModal";

export function SettingsButton({ className }: { className?: string } = {}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          className ??
          "rounded p-1.5 text-muted transition hover:bg-elevated hover:text-ink"
        }
        title="Settings"
        aria-label="Open settings"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M8 5a3 3 0 100 6 3 3 0 000-6zm0 4.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
          <path d="M13.87 9.4l1.09.64a.5.5 0 01.17.68l-1.5 2.6a.5.5 0 01-.68.18l-1.08-.63a5.44 5.44 0 01-1.78 1.03l-.17 1.25a.5.5 0 01-.5.44h-3a.5.5 0 01-.5-.44L5.75 13.9a5.44 5.44 0 01-1.78-1.03l-1.08.63a.5.5 0 01-.68-.17l-1.5-2.6a.5.5 0 01.17-.68l1.09-.64a5.38 5.38 0 010-2l-1.09-.65a.5.5 0 01-.17-.68l1.5-2.6a.5.5 0 01.68-.17l1.08.63A5.44 5.44 0 015.75 2.1l.17-1.25A.5.5 0 016.42.4h3a.5.5 0 01.5.44l.17 1.26c.67.25 1.28.6 1.78 1.03l1.08-.63a.5.5 0 01.68.17l1.5 2.6a.5.5 0 01-.17.68l-1.09.65a5.38 5.38 0 010 2z" />
        </svg>
      </button>
      {open && <SettingsModal onClose={() => setOpen(false)} />}
    </>
  );
}
