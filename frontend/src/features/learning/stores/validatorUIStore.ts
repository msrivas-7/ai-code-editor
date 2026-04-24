import { create } from "zustand";

// Cinema Kit — tiny signal slot for validator-driven UI moments.
//
// Right now there's exactly one signal: `sonarNonce`, which bumps
// when a Check pass fires. LessonPage watches it and renders a
// three-ring RingPulse anchored to the Check button — the literal
// déjà vu of the cinematic's closing ring, at a different scale and
// color. The store exists so the ring can live in LessonPage's JSX
// tree (has the ref to the Check button) while being triggered from
// the validator hook (which owns the pass event). A prop-drill would
// have required threading callbacks through three hooks.

interface ValidatorUIState {
  sonarNonce: number;
  bumpSonar: () => void;
}

export const useValidatorUIStore = create<ValidatorUIState>((set, get) => ({
  sonarNonce: 0,
  bumpSonar: () => set({ sonarNonce: get().sonarNonce + 1 }),
}));
