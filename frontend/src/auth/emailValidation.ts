// Surface-level email format check. Not an RFC 5322 parser — we want
// cheap + friendly client-side feedback; Supabase itself rejects malformed
// addresses on the wire, so this is advisory only.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}
