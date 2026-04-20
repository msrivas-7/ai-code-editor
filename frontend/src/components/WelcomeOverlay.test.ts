import { beforeEach, describe, expect, it, vi } from "vitest";

const state = { welcomeDone: false };
const marked: string[] = [];

vi.mock("../state/preferencesStore", () => ({
  usePreferencesStore: Object.assign(
    (selector: (s: typeof state) => unknown) => selector(state),
    {
      getState: () => state,
      subscribe: () => () => {},
    },
  ),
  markOnboardingDone: (flag: string) => {
    marked.push(flag);
    if (flag === "welcomeDone") state.welcomeDone = true;
  },
}));

import { isWelcomeDone, markWelcomeDone } from "./WelcomeOverlay";

beforeEach(() => {
  state.welcomeDone = false;
  marked.length = 0;
});

describe("WelcomeOverlay logic", () => {
  it("isWelcomeDone returns false initially", () => {
    expect(isWelcomeDone()).toBe(false);
  });

  it("isWelcomeDone returns true after markWelcomeDone", () => {
    markWelcomeDone();
    expect(isWelcomeDone()).toBe(true);
  });

  it("markWelcomeDone delegates to preferencesStore with the welcomeDone flag", () => {
    markWelcomeDone();
    expect(marked).toEqual(["welcomeDone"]);
  });
});
