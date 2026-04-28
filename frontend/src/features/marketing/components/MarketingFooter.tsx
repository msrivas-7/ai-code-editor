import { Link } from "react-router-dom";
import { Wordmark } from "../../../components/Wordmark";

// Phase 22C — minimal one-row footer.
// Wordmark + copyright left, three links right: Sign in · GitHub · LinkedIn.
// No sitemap, no newsletter, no marketing copy. Restraint at the bottom of
// the page mirrors the restraint at the top.

const CURRENT_YEAR = new Date().getFullYear();

export function MarketingFooter() {
  return (
    <footer className="mt-24 border-t border-border-soft/60 bg-bg/40 py-8 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 sm:flex-row sm:px-8">
        <div className="flex flex-col items-center gap-1 sm:items-start">
          <Wordmark size="sm" tone="muted" />
          <span className="text-[11px] text-faint">
            © {CURRENT_YEAR} Mehul Srivastava
          </span>
        </div>
        <div className="flex items-center gap-1 text-[12px] text-faint">
          <Link
            to="/login"
            className="rounded px-2 py-1 transition hover:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            Sign in
          </Link>
          <span aria-hidden="true" className="text-border">
            ·
          </span>
          <a
            href="https://github.com/msrivas-7/CodeTutor-AI"
            target="_blank"
            rel="noreferrer"
            className="rounded px-2 py-1 transition hover:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            GitHub
          </a>
          <span aria-hidden="true" className="text-border">
            ·
          </span>
          <a
            href="https://www.linkedin.com/in/msrivas7/"
            target="_blank"
            rel="noreferrer"
            className="rounded px-2 py-1 transition hover:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            LinkedIn
          </a>
        </div>
      </div>
    </footer>
  );
}
