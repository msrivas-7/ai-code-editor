import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "./authStore";

// Route guard. Reads auth state from the store:
//  - `loading` (initial hydration): render a neutral skeleton so we don't
//    flash `/login` to a user whose session is about to hydrate from
//    localStorage.
//  - No user once loading is done: redirect to `/login` and stash the
//    original location in router state so the login page can bounce back
//    after a successful sign-in.
//  - Signed in: render the protected subtree.
export function RequireAuth({ children }: { children: ReactNode }) {
  const loading = useAuthStore((s) => s.loading);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-bg text-muted">
        <span className="skeleton h-4 w-32 rounded" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
