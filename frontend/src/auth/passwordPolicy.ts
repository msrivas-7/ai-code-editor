// Shared password policy used by SignupPage + ResetPasswordPage. Matches
// Supabase Auth's default minimum (8 chars) but layers on character-class
// requirements that the UI ticks off live as the user types. The rules here
// are advisory on the client — Supabase itself rejects <8 chars — so this is
// purely UX signal; the server is the source of truth.

export interface PasswordCheck {
  label: string;
  test: (pw: string) => boolean;
}

export const PASSWORD_CHECKS: readonly PasswordCheck[] = [
  { label: "At least 8 characters", test: (p) => p.length >= 8 },
  { label: "One lowercase letter", test: (p) => /[a-z]/.test(p) },
  { label: "One uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { label: "One number", test: (p) => /\d/.test(p) },
  { label: "One special character", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export type StrengthLevel = "empty" | "weak" | "fair" | "good" | "strong";

export function passwordStrength(pw: string): {
  level: StrengthLevel;
  passed: number;
  total: number;
} {
  const passed = PASSWORD_CHECKS.filter((c) => c.test(pw)).length;
  const total = PASSWORD_CHECKS.length;
  if (pw.length === 0) return { level: "empty", passed: 0, total };
  if (passed <= 1) return { level: "weak", passed, total };
  if (passed <= 2) return { level: "fair", passed, total };
  if (passed <= 3) return { level: "good", passed, total };
  return { level: "strong", passed, total };
}

// Minimum bar for submit to be enabled. Kept at "fair" rather than "strong"
// to avoid user frustration — we want to nudge, not block.
export function isPasswordAcceptable(pw: string): boolean {
  return pw.length >= 8;
}
