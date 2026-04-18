import { describe, it, expect, beforeEach, vi } from "vitest";

const storage = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
  clear: () => storage.clear(),
  get length() { return storage.size; },
  key: () => null as string | null,
});

import { getThemePref, setThemePref } from "./theme";

beforeEach(() => {
  storage.clear();
});

describe("theme preference", () => {
  it("defaults to 'system' when nothing is persisted", () => {
    expect(getThemePref()).toBe("system");
  });

  it("returns persisted 'light' and 'dark' values", () => {
    storage.set("ui:theme-pref", "light");
    expect(getThemePref()).toBe("light");
    storage.set("ui:theme-pref", "dark");
    expect(getThemePref()).toBe("dark");
  });

  it("returns persisted 'system' value", () => {
    storage.set("ui:theme-pref", "system");
    expect(getThemePref()).toBe("system");
  });

  it("coerces garbage localStorage values back to 'system'", () => {
    storage.set("ui:theme-pref", "purple");
    expect(getThemePref()).toBe("system");
    storage.set("ui:theme-pref", "");
    expect(getThemePref()).toBe("system");
  });

  it("setThemePref persists the new value", () => {
    setThemePref("light");
    expect(storage.get("ui:theme-pref")).toBe("light");
    expect(getThemePref()).toBe("light");

    setThemePref("dark");
    expect(storage.get("ui:theme-pref")).toBe("dark");
    expect(getThemePref()).toBe("dark");

    setThemePref("system");
    expect(storage.get("ui:theme-pref")).toBe("system");
    expect(getThemePref()).toBe("system");
  });
});
