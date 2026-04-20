import { beforeEach, describe, expect, it, vi } from "vitest";

const state = { workspaceCoachDone: false };

vi.mock("../../../state/preferencesStore", () => ({
  usePreferencesStore: Object.assign(
    (selector: (s: typeof state) => unknown) => selector(state),
    {
      getState: () => state,
      subscribe: () => () => {},
    },
  ),
  markOnboardingDone: (flag: string) => {
    if (flag === "workspaceCoachDone") state.workspaceCoachDone = true;
  },
}));

import { isOnboardingDone } from "./WorkspaceCoach";

beforeEach(() => {
  state.workspaceCoachDone = false;
});

describe("isOnboardingDone", () => {
  it("returns false when the flag is unset in preferencesStore", () => {
    expect(isOnboardingDone()).toBe(false);
  });

  it("returns true when the flag flips to true", () => {
    state.workspaceCoachDone = true;
    expect(isOnboardingDone()).toBe(true);
  });
});
