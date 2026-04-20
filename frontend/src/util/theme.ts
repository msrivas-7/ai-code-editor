import { useEffect, useState } from "react";
import { usePreferencesStore, setTheme as setThemeInStore } from "../state/preferencesStore";

// Phase 18b: theme preference is stored in Postgres via preferencesStore.
// This module is the legacy entry-point; it now thinly wraps the store so
// existing call sites (useThemePref, setThemePref, useEffectiveTheme) keep
// working without a refactor at every consumer.

export type ThemePref = "system" | "light" | "dark";
export type EffectiveTheme = "light" | "dark";

function systemTheme(): EffectiveTheme {
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function resolve(pref: ThemePref): EffectiveTheme {
  return pref === "system" ? systemTheme() : pref;
}

function applyDocumentTheme(theme: EffectiveTheme): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

// Apply the current theme once at module load so <html data-theme> is right
// before the first render. The initial pref is the store default (dark) if
// hydration hasn't landed yet; a later hydrate() re-applies the real pref.
if (typeof document !== "undefined") {
  applyDocumentTheme(resolve(usePreferencesStore.getState().theme));
}

// Subscribe once at module scope: any preferencesStore theme change
// re-applies the document attribute immediately. Also listens for system
// colour-scheme changes so `pref === "system"` tracks the OS.
if (typeof window !== "undefined") {
  usePreferencesStore.subscribe((state, prev) => {
    if (state.theme !== prev.theme || state.hydrated !== prev.hydrated) {
      applyDocumentTheme(resolve(state.theme));
    }
  });
  const mq = window.matchMedia?.("(prefers-color-scheme: light)");
  mq?.addEventListener?.("change", () => {
    if (usePreferencesStore.getState().theme === "system") {
      applyDocumentTheme(resolve("system"));
    }
  });
}

export function setThemePref(pref: ThemePref): void {
  applyDocumentTheme(resolve(pref));
  void setThemeInStore(pref).catch(() => {
    /* already logged in preferencesStore.patch() */
  });
}

export function getThemePref(): ThemePref {
  return usePreferencesStore.getState().theme;
}

export function useEffectiveTheme(): EffectiveTheme {
  const pref = usePreferencesStore((s) => s.theme);
  const [effective, setEffective] = useState<EffectiveTheme>(() => resolve(pref));

  useEffect(() => {
    setEffective(resolve(pref));
    if (pref !== "system") return;
    const mq = window.matchMedia?.("(prefers-color-scheme: light)");
    const onMedia = () => setEffective(resolve("system"));
    mq?.addEventListener?.("change", onMedia);
    return () => mq?.removeEventListener?.("change", onMedia);
  }, [pref]);

  return effective;
}

export function useThemePref(): [ThemePref, (p: ThemePref) => void] {
  const pref = usePreferencesStore((s) => s.theme);
  return [pref, setThemePref];
}
