import { beforeEach, describe, expect, it, vi } from "vitest";

// Phase 18b: theme pref lives in the preferencesStore, not localStorage.
// Mock the store entry-points so the module under test doesn't try to hit
// the backend. We assert against the captured patch payloads instead of
// storage.

const state = { theme: "dark" as "system" | "light" | "dark", hydrated: true };
const patch = vi.fn(async (_body: { theme: typeof state.theme }) => {});

vi.mock("../state/preferencesStore", () => ({
  usePreferencesStore: Object.assign(
    (selector: (s: typeof state) => unknown) => selector(state),
    {
      getState: () => state,
      subscribe: () => () => {},
    },
  ),
  setTheme: async (t: typeof state.theme) => {
    state.theme = t;
    await patch({ theme: t });
  },
}));

import { getThemePref, setThemePref } from "./theme";

beforeEach(() => {
  state.theme = "dark";
  patch.mockClear();
});

describe("theme preference", () => {
  it("reads the current theme from preferencesStore", () => {
    state.theme = "light";
    expect(getThemePref()).toBe("light");
    state.theme = "system";
    expect(getThemePref()).toBe("system");
    state.theme = "dark";
    expect(getThemePref()).toBe("dark");
  });

  it("setThemePref forwards to preferencesStore.setTheme", () => {
    setThemePref("light");
    expect(patch).toHaveBeenCalledWith({ theme: "light" });
    expect(getThemePref()).toBe("light");

    setThemePref("system");
    expect(patch).toHaveBeenCalledWith({ theme: "system" });
    expect(getThemePref()).toBe("system");
  });
});
