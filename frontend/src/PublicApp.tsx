import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import WhyNotChatGPTPage from "./pages/WhyNotChatGPTPage";

const MarketingHomepage = lazy(
  () => import("./features/marketing/study/MarketingHomepage"),
);
const TrustPage = lazy(() => import("./pages/TrustPage"));
const FullApp = lazy(async () => {
  const [appModule, { initAuth }] = await Promise.all([
    import("./App"),
    import("./auth/authStore"),
  ]);

  // Public routes deliberately defer auth hydration so acquisition content can
  // paint quickly. Once a visitor explicitly enters the product, that delay is
  // no longer useful: begin authoritative hydration before rendering FullApp.
  initAuth();
  return appModule;
});

function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg text-muted">
      <span className="skeleton h-4 w-32 rounded" />
    </div>
  );
}

function PublicSurface({ children }: { children: ReactNode }) {
  return <div className="public-surface contents">{children}</div>;
}

/**
 * Lightweight route shell for acquisition and trust surfaces.
 *
 * Public visitors should not download the authenticated workspace, admin
 * console, Supabase client, or learner-state stores before the first screen
 * can paint. Navigating into any product/auth route promotes the session to
 * the full application without a document reload.
 */
export default function PublicApp() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route
          path="/"
          element={
            <PublicSurface>
              <MarketingHomepage />
            </PublicSurface>
          }
        />
        <Route
          path="/why-not-chatgpt"
          element={
            <PublicSurface>
              <WhyNotChatGPTPage />
            </PublicSurface>
          }
        />
        <Route
          path="/privacy"
          element={
            <PublicSurface>
              <TrustPage />
            </PublicSurface>
          }
        />
        <Route
          path="/terms"
          element={
            <PublicSurface>
              <TrustPage />
            </PublicSurface>
          }
        />
        <Route
          path="/support"
          element={
            <PublicSurface>
              <TrustPage />
            </PublicSurface>
          }
        />
        <Route path="*" element={<FullApp />} />
      </Routes>
    </Suspense>
  );
}
