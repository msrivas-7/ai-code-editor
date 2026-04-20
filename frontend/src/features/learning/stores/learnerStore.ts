import { create } from "zustand";
import type { LearnerIdentity } from "../types";
import { wipeOwnedKeys } from "../../../util/progressSnapshot";

const LS_KEY = "learner:v1:identity";

function generateId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

function persist(identity: LearnerIdentity): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(identity));
  } catch {
    /* storage unavailable — progress is best-effort */
  }
}

function loadOrCreate(): LearnerIdentity {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LearnerIdentity;
      if (parsed.learnerId) return parsed;
    }
  } catch {
    /* corrupted — regenerate */
  }
  const identity: LearnerIdentity = {
    learnerId: generateId(),
    createdAt: new Date().toISOString(),
    isAnonymous: true,
  };
  persist(identity);
  return identity;
}

interface LearnerState {
  identity: LearnerIdentity;
  // Called from the auth subscriber (see `authStore.initAuth`) when the user
  // signs in. Overwrites the anonymous boot-time identity with the Supabase
  // user id so progress documents written from here on are tagged correctly.
  adoptAuthUser: (userId: string) => void;
  // Called on sign-out. Wipes owned progress/onboarding keys and re-seeds a
  // fresh anonymous identity so the next user on this device starts clean.
  resetToAnonymous: () => void;
}

export const useLearnerStore = create<LearnerState>()((set) => ({
  identity: loadOrCreate(),

  adoptAuthUser(userId) {
    const identity: LearnerIdentity = {
      learnerId: userId,
      createdAt: new Date().toISOString(),
      isAnonymous: false,
    };
    persist(identity);
    set({ identity });
  },

  resetToAnonymous() {
    wipeOwnedKeys();
    const identity: LearnerIdentity = {
      learnerId: generateId(),
      createdAt: new Date().toISOString(),
      isAnonymous: true,
    };
    persist(identity);
    set({ identity });
  },
}));
