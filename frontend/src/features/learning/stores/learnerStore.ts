import { create } from "zustand";
import type { LearnerIdentity } from "../types";

const LS_KEY = "learner:v1:identity";

function generateId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
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
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(identity));
  } catch {
    /* storage unavailable */
  }
  return identity;
}

interface LearnerState {
  identity: LearnerIdentity;
}

export const useLearnerStore = create<LearnerState>()(() => ({
  identity: loadOrCreate(),
}));
