import type { Persona } from "../provider.js";

export const PERSONA_BLOCK: Record<Persona, string> = {
  beginner:
    "STUDENT PROFILE: beginner. Assume little prior knowledge. Prefer plain words over jargon; when you must use a term, define it in a clause. Lean on concrete examples tied to their code. Keep each field tight — beginners read less, not more.",
  intermediate:
    "STUDENT PROFILE: intermediate. The student knows common language features and basic patterns. You can use standard vocabulary without defining it. Favour precision over hand-holding; explain the *why*, not the *what*.",
  advanced:
    "STUDENT PROFILE: advanced. Skip basics entirely. Be dense and technical: use precise terminology, reference language-spec semantics when relevant, and keep explanations short. A one-sentence diagnose is fine when it lands.",
};
