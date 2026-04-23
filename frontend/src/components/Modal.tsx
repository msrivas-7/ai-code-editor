import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";

interface ModalProps {
  onClose: () => void;
  children: ReactNode;
  // ID of the heading element inside `children` that labels the dialog for
  // screen readers. Omit for alertdialog-style confirms where the entire body
  // is the announcement.
  labelledBy?: string;
  // ID of the element that further describes the dialog (body copy or subtitle)
  // for screen readers. Paired with labelledBy so SRs announce both the title
  // and the descriptive line on focus.
  describedBy?: string;
  // "alertdialog" is the right role for destructive confirms (Reset Lesson /
  // Reset Course) — it tells screen readers the dialog is interrupting with a
  // high-priority message that requires a response.
  role?: "dialog" | "alertdialog";
  // Tailwind classes for the inner panel. Callers own colour/size — the Modal
  // only owns the overlay + dismissal lifecycle.
  panelClassName?: string;
  // Layout of the overlay: "center" vertically centres the panel (confirms),
  // "top" anchors near the top of the viewport (Settings).
  position?: "center" | "top";
}

// Shared modal wrapper. Owns Esc-to-close, backdrop-click-to-close, portal,
// focus-on-mount, and focus-restore-on-unmount so every modal in the product
// behaves the same — previously SettingsModal had Esc but the confirm dialogs
// didn't, and none restored focus when closed.
export function Modal({
  onClose,
  children,
  labelledBy,
  describedBy,
  role = "dialog",
  panelClassName = "w-full max-w-md rounded-xl border border-border bg-panel p-5 shadow-xl",
  position = "top",
}: ModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    (first ?? panel)?.focus();
    return () => {
      previouslyFocused?.focus?.();
    };
  }, []);

  // Phase 20-P1: Tab focus trap. Modal.tsx focused first element on mount but
  // Tab could escape to the page behind (Settings, Reset Lesson, language
  // switch), which is both a WCAG failure and a confusing UX — the backdrop
  // swallows clicks but not keystrokes. Wrap focus back to the first/last
  // focusable inside the panel when the user Tabs past the edge.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled"));
      if (focusables.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !panel.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !panel.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const overlayPos = position === "center" ? "items-center justify-center" : "items-start justify-center pt-[10vh]";

  // Honor prefers-reduced-motion — skip the scale/translate entrance
  // and fall back to a pure opacity fade. framer-motion's hook returns
  // true when the OS flag is set.
  const reduce = useReducedMotion();
  const panelInitial = reduce
    ? { opacity: 0 }
    : { opacity: 0, scale: 0.96, y: 4 };
  const panelAnimate = { opacity: 1, scale: 1, y: 0 };
  const panelTransition = {
    duration: reduce ? 0.12 : 0.18,
    ease: [0.22, 1, 0.36, 1] as const,
  };

  return createPortal(
    <motion.div
      ref={backdropRef}
      className={`fixed inset-0 z-50 flex ${overlayPos} bg-black/50 backdrop-blur-sm`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
    >
      <motion.div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        className={panelClassName}
        initial={panelInitial}
        animate={panelAnimate}
        transition={panelTransition}
      >
        {children}
      </motion.div>
    </motion.div>,
    document.body,
  );
}
