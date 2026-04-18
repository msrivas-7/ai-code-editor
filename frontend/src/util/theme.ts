import { useEffect, useState } from "react";

export type ThemePref = "system" | "light" | "dark";
export type EffectiveTheme = "light" | "dark";

const LS_KEY = "ui:theme-pref";

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(LS_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* localStorage disabled — fall through */
  }
  return "system";
}

function writePref(pref: ThemePref): void {
  try { localStorage.setItem(LS_KEY, pref); } catch { /* */ }
}

function systemTheme(): EffectiveTheme {
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function resolve(pref: ThemePref): EffectiveTheme {
  return pref === "system" ? systemTheme() : pref;
}

// Broadcast channel so every hook instance stays in sync when setThemePref() is
// called from any part of the app. Browser localStorage 'storage' events only
// fire cross-tab, not in the same tab — this fills that gap.
const listeners = new Set<() => void>();
function notify() { for (const fn of listeners) fn(); }

export function setThemePref(pref: ThemePref): void {
  writePref(pref);
  applyDocumentTheme(resolve(pref));
  notify();
}

export function getThemePref(): ThemePref {
  return readPref();
}

function applyDocumentTheme(theme: EffectiveTheme): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

// Initialize on module load so <html data-theme="..."> is correct before any
// component mounts. Guarded for SSR / test environments without a document.
if (typeof document !== "undefined") {
  applyDocumentTheme(resolve(readPref()));
}

export function useEffectiveTheme(): EffectiveTheme {
  const [theme, setTheme] = useState<EffectiveTheme>(() => resolve(readPref()));

  useEffect(() => {
    const recompute = () => setTheme(resolve(readPref()));
    listeners.add(recompute);
    // Respond to OS-level changes when pref is "system".
    const mq = window.matchMedia?.("(prefers-color-scheme: light)");
    const onMedia = () => { if (readPref() === "system") recompute(); };
    mq?.addEventListener?.("change", onMedia);
    // Cross-tab preference changes via localStorage.
    const onStorage = (e: StorageEvent) => { if (e.key === LS_KEY) recompute(); };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(recompute);
      mq?.removeEventListener?.("change", onMedia);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return theme;
}

export function useThemePref(): [ThemePref, (p: ThemePref) => void] {
  const [pref, setPref] = useState<ThemePref>(() => readPref());
  useEffect(() => {
    const recompute = () => setPref(readPref());
    listeners.add(recompute);
    const onStorage = (e: StorageEvent) => { if (e.key === LS_KEY) recompute(); };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(recompute);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return [pref, setThemePref];
}
