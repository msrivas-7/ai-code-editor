import { useEffect, useState } from "react";

// Platform detection lives in one place so the UI stays platform-agnostic —
// components never hard-code "⌘" or "Cmd" anywhere. SSR-safe: assumes Mac on
// the server (our default) and corrects on mount. On platforms that don't
// expose a Mac-like userAgent (Linux, Windows, Android, iPad-as-iPad-OS),
// we surface the Ctrl-family labels.

function detectIsMac(): boolean {
  if (typeof navigator === "undefined") return true;
  const platform = navigator.platform || "";
  const ua = navigator.userAgent || "";
  return /Mac|iPhone|iPad|iPod/i.test(platform) || /Mac OS X/i.test(ua);
}

export function useIsMac(): boolean {
  const [isMac, setIsMac] = useState(true);
  useEffect(() => {
    setIsMac(detectIsMac());
  }, []);
  return isMac;
}

export interface ShortcutLabels {
  run: string;        // Run the current project
  focusAsk: string;   // Focus the tutor/assistant composer
  newline: string;    // Insert newline inside a submit-on-enter textarea
  runPhrase: string;  // Human phrase used in prose: "Cmd+Enter" / "Ctrl+Enter"
  askPhrase: string;  // "Cmd+K" / "Ctrl+K"
  modKey: string;     // Just the mod: "⌘" / "Ctrl"
}

export function shortcutLabels(isMac: boolean): ShortcutLabels {
  return isMac
    ? {
        run: "⌘↵",
        focusAsk: "⌘K",
        newline: "⇧↵",
        runPhrase: "Cmd+Enter",
        askPhrase: "Cmd+K",
        modKey: "⌘",
      }
    : {
        run: "Ctrl+↵",
        focusAsk: "Ctrl+K",
        newline: "Shift+↵",
        runPhrase: "Ctrl+Enter",
        askPhrase: "Ctrl+K",
        modKey: "Ctrl",
      };
}

export function useShortcutLabels(): ShortcutLabels {
  return shortcutLabels(useIsMac());
}
