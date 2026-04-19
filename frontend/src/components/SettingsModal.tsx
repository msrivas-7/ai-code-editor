import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { SettingsPanel } from "./SettingsPanel";

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Portal to document.body so `fixed inset-0` escapes any ancestor with a
  // `backdrop-filter` / `transform` / `filter` — those create a containing
  // block for fixed descendants and would otherwise clamp the overlay to
  // the ancestor's box (e.g. blurring only the header).
  return createPortal(
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[10vh] backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-panel p-5 shadow-xl">
        <SettingsPanel onClose={onClose} />
      </div>
    </div>,
    document.body,
  );
}
