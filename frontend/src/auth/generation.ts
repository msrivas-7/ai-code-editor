// Monotonic counter bumped on every auth identity transition (sign-in,
// sign-out, user-change). Each hydrate() captures the generation it was
// kicked off under; if the counter has since advanced when the fetch
// resolves, the late response is from a prior user and must not mutate
// the current user's store. Lives in its own module so the three hydrate()
// owners (preferences, progress, project) can import it without any of
// them having to import the authStore (which imports them — cycle).

let gen = 0;

export function currentGen(): number {
  return gen;
}

export function bumpGen(): number {
  gen += 1;
  return gen;
}
