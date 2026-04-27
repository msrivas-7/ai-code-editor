import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { api } from "../../../api/client";
import type { SharedLessonCompletion } from "../../../api/client";
import { ApiError } from "../../../api/ApiError";
import { CinematicLighting } from "../../../components/cinema/CinematicLighting";
import { FilmGrain } from "../../../components/cinema/FilmGrain";
import { CodeTypewriter } from "../components/CodeTypewriter";
import { masteryLabel } from "../components/MasteryRing";

// Phase 21C: cinematic share page at /s/:token. Public route — no auth
// required. Renders a slow, choreographed reveal of the learner's
// completion: page chrome → wordmark → lesson title → code typewriter →
// money-shot zoom → mastery ring → footer with view counter and CTA.
//
// The actual OG card (PNG) is generated server-side by Satori and
// embedded as <meta og:image> for unfurl crawlers. THIS page is what
// the visitor sees AFTER they click the share link.
//
// Reduced-motion users get a static poster — same hierarchy, no
// typewriter, no zoom, no breath.

const TIER_COLOR: Record<SharedLessonCompletion["mastery"], string> = {
  strong: "rgb(217 178 105)", // --color-gilt
  okay: "rgb(176 184 196)",
  shaky: "rgb(180 132 96)",
};

function fmtTimeSpent(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  if (ms < 60_000) return "<1m";
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem === 0 ? `${hrs}h` : `${hrs}h ${rem}m`;
}

function fmtViewCount(n: number): string {
  if (n < 1000) return n.toLocaleString();
  if (n < 10_000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.round(n / 1000)}k`;
}

export default function SharePage() {
  const { token } = useParams<{ token: string }>();
  const nav = useNavigate();
  const [share, setShare] = useState<SharedLessonCompletion | null>(null);
  const [error, setError] = useState<"not_found" | "load_failed" | null>(null);

  // Fetch the share row. The route is public — no auth headers needed,
  // but the api.getShare wrapper attaches the bearer token if a session
  // exists (which is fine; the backend ignores it on this route).
  useEffect(() => {
    if (!token) {
      setError("not_found");
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.getShare(token);
        if (cancelled) return;
        setShare(res);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setError("not_found");
        } else {
          setError("load_failed");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Set OG meta tags on the live document head. Most modern unfurl
  // crawlers (Twitter, Slack, Discord, iMessage on iOS 17+) respect
  // client-rendered tags; LinkedIn and older crawlers prefer SSR. For
  // v1 we accept the LinkedIn gap — the cinematic page itself is the
  // primary conversion surface; OG fidelity is a multiplier, not the
  // mechanism.
  useEffect(() => {
    if (!share) return;
    const prevTitle = document.title;
    const author = share.displayName ?? "A learner";
    const docTitle = `${author} finished ${share.lessonTitle} — ${share.courseTitle}`;
    document.title = docTitle;

    const url = `${window.location.origin}/s/${share.shareToken}`;
    const description = `Built it in ${fmtTimeSpent(share.timeSpentMs)} on ${
      share.attemptCount === 1 ? "the first try" : `attempt ${share.attemptCount}`
    }. See the code on CodeTutor.`;

    const tags: Array<[string, string, string]> = [
      ["meta", "name=description", description],
      ["meta", "property=og:type", "article"],
      ["meta", "property=og:url", url],
      ["meta", "property=og:title", docTitle],
      ["meta", "property=og:description", description],
      ["meta", "name=twitter:card", "summary_large_image"],
      ["meta", "name=twitter:title", docTitle],
      ["meta", "name=twitter:description", description],
    ];
    if (share.ogImageUrl) {
      tags.push(["meta", "property=og:image", share.ogImageUrl]);
      tags.push(["meta", "property=og:image:width", "1200"]);
      tags.push(["meta", "property=og:image:height", "630"]);
      tags.push(["meta", "name=twitter:image", share.ogImageUrl]);
    }

    // Track BOTH tags we create new and prior `content` of tags we
    // mutated, so cleanup fully restores the head. The audit caught a
    // leak: navigating from /s/A → /s/B and back would otherwise carry
    // /s/A's mutated content forward, and crawlers re-rendering from
    // bfcache could see stale data for B.
    const created: HTMLMetaElement[] = [];
    const mutated: Array<{ el: HTMLMetaElement; prev: string | null }> = [];
    for (const [, selector, content] of tags) {
      const [attr, value] = selector.split("=");
      const existing = document.head.querySelector<HTMLMetaElement>(
        `meta[${attr}="${value}"]`,
      );
      if (existing) {
        mutated.push({ el: existing, prev: existing.getAttribute("content") });
        existing.setAttribute("content", content);
      } else {
        const el = document.createElement("meta");
        el.setAttribute(attr, value);
        el.setAttribute("content", content);
        document.head.appendChild(el);
        created.push(el);
      }
    }
    return () => {
      // Restore in two passes: revert content of tags we mutated, then
      // remove tags we created. Order matters when the same logical tag
      // gets resolved from `created` on first render and `mutated` on
      // subsequent ones.
      document.title = prevTitle;
      for (const { el, prev } of mutated) {
        if (prev === null) el.removeAttribute("content");
        else el.setAttribute("content", prev);
      }
      for (const el of created) el.remove();
    };
  }, [share]);

  if (error === "not_found") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-6 text-center text-ink">
        <h1 className="font-display text-3xl font-semibold text-ink">
          Share not found
        </h1>
        <p className="mt-3 max-w-md text-sm text-muted">
          The link you followed is invalid or was revoked.
        </p>
        <button
          onClick={() => nav("/")}
          className="mt-8 rounded-full bg-gradient-to-r from-violet to-accent px-5 py-2.5 text-xs font-bold text-bg shadow-glow transition hover:opacity-90"
        >
          Go to CodeTutor →
        </button>
      </div>
    );
  }

  if (error === "load_failed") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-6 text-center text-ink">
        <h1 className="font-display text-2xl font-semibold text-ink">
          Couldn't load this share
        </h1>
        <p className="mt-3 max-w-md text-sm text-muted">
          Try again in a moment, or open CodeTutor directly.
        </p>
        <button
          onClick={() => nav("/")}
          className="mt-8 rounded-full bg-gradient-to-r from-violet to-accent px-5 py-2.5 text-xs font-bold text-bg shadow-glow transition hover:opacity-90"
        >
          Go to CodeTutor →
        </button>
      </div>
    );
  }

  if (!share) {
    // Loading state — render the page chrome but without the artwork.
    // The cinematic lighting + grain land first; the rest fades in once
    // the share data resolves. Avoids a janky flash-of-empty-page.
    return (
      <div className="relative min-h-screen overflow-hidden bg-bg">
        <CinematicLighting variant="three-point" fadeInMs={400} keyColor="accent" intensity="soft" />
        <FilmGrain intensity="hero" fadeInMs={400} />
      </div>
    );
  }

  return <SharePageReady share={share} />;
}

interface SharePageReadyProps {
  share: SharedLessonCompletion;
}

function SharePageReady({ share }: SharePageReadyProps) {
  const reduce = useReducedMotion();
  // Coordinated timeline. Reduced-motion users skip past the staggered
  // beats and reveal everything statically — we keep the same hierarchy
  // but drop the typewriter and the zoom hold.
  const [phase, setPhase] = useState<
    "chrome" | "title" | "typing" | "moneyShot" | "ring" | "footer" | "idle"
  >(reduce ? "idle" : "chrome");

  // Master timeline timers. Refs so the Effect can clean up on unmount
  // without false-flashing state if the share-data prop ever swaps
  // mid-render. ALL setTimeout calls in this component (mount-time
  // schedule + onTypewriterDone chain) push into this ref so cleanup
  // is comprehensive — the audit caught a leak where onTypewriterDone
  // schedules unmounted-on-navigation.
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const schedule = (delay: number, fn: () => void) => {
    const t = setTimeout(fn, delay);
    timersRef.current.push(t);
  };
  useEffect(() => {
    if (reduce) return;
    // UX polish: typewriter starts at 900ms (was 1200) so it overlaps
    // the title gradient sweep tail rather than pausing after it. The
    // first ~1.4s used to feel stalled.
    schedule(400, () => setPhase("title")); // wordmark + title sweep
    schedule(900, () => setPhase("typing")); // typewriter starts
    // moneyShot/ring/footer are gated on the typewriter's onDone.
    return () => {
      for (const t of timersRef.current) clearTimeout(t);
      timersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);

  // Animated view counter — counts up to share.viewCount over 700ms
  // once we hit the footer beat. Reduced-motion: render final value.
  const [animatedViews, setAnimatedViews] = useState(
    reduce ? share.viewCount : 0,
  );
  useEffect(() => {
    if (reduce) return;
    if (phase !== "footer" && phase !== "idle") return;
    const target = share.viewCount;
    if (target <= 0) return;
    const startTs = performance.now();
    const duration = 700;
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - startTs) / duration);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimatedViews(Math.round(target * eased));
      if (t < 1) {
        raf = requestAnimationFrame(step);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [phase, share.viewCount, reduce]);

  // Money-shot trigger fires once typewriter completes. Brief hold,
  // then the ring strokes, then footer fades up. Timers go through the
  // shared ref so unmount-mid-reveal doesn't leak setStates onto an
  // unmounted component.
  const onTypewriterDone = () => {
    if (reduce) return;
    setPhase("moneyShot");
    schedule(600, () => setPhase("ring"));
    schedule(900, () => setPhase("footer"));
    schedule(1500, () => setPhase("idle"));
  };

  // Whether the page is past the money-shot beat — used to dim
  // peripheral chrome briefly during the hold.
  const inMoneyShot = phase === "moneyShot";

  const ringColor = TIER_COLOR[share.mastery];

  return (
    <div className="relative min-h-screen overflow-hidden bg-bg text-ink">
      {/* Lighting + grain — atmosphere from t=0. */}
      <CinematicLighting
        variant="three-point"
        fadeInMs={reduce ? 0 : 400}
        keyColor="accent"
        intensity={inMoneyShot ? "full" : "soft"}
      />
      <FilmGrain intensity="hero" fadeInMs={reduce ? 0 : 400} />

      {/* Header row — wordmark + share URL */}
      <motion.header
        className="relative mx-auto flex max-w-5xl items-center justify-between px-6 pt-10 sm:px-10"
        initial={reduce ? false : { opacity: 0, y: -4 }}
        animate={
          inMoneyShot
            ? { opacity: 0.7, y: 0 }
            : { opacity: 1, y: 0 }
        }
        transition={{
          duration: reduce ? 0 : 0.6,
          delay: reduce ? 0 : 0.4,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <div className="font-display text-2xl font-semibold tracking-tight text-ink">
          CodeTutor
        </div>
        <div className="font-mono text-xs text-faint sm:text-sm">
          codetutor.msrivas.com/s/{share.shareToken}
        </div>
      </motion.header>

      {/* Body — title + code, the centered headline */}
      <main className="relative mx-auto max-w-5xl px-6 pt-10 pb-16 sm:px-10">
        {/* Course context eyebrow */}
        <motion.div
          className="text-xs font-medium uppercase tracking-wider text-muted sm:text-sm"
          initial={reduce ? false : { opacity: 0, y: 4 }}
          animate={
            inMoneyShot
              ? { opacity: 0.6, y: 0 }
              : { opacity: 1, y: 0 }
          }
          transition={{
            duration: reduce ? 0 : 0.5,
            delay: reduce ? 0 : 0.7,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          {share.courseTitle} · Lesson {share.lessonOrder} of{" "}
          {share.courseTotalLessons}
        </motion.div>

        {/* Lesson title — ONE gradient on the page. Sweeps in via
            backgroundPosition on a 200% gradient. Money-shot beat
            scales the title+code group. */}
        <motion.div
          className="mt-3"
          animate={inMoneyShot ? { scale: 1.02 } : { scale: 1 }}
          transition={{
            duration: 0.6,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <motion.h1
            // text-balance keeps long titles from sprawling unevenly.
            // For very long titles (50+ chars — "Why Mutability
            // Matters in Python (and Other Languages)" type), step
            // the size DOWN one bracket instead of clamping with an
            // ellipsis — losing characters reads worse than smaller
            // type. line-clamp-3 catches the rare extreme case where
            // even at the smaller size the title still wraps long.
            className={`bg-gradient-to-r from-success via-accent to-violet bg-clip-text font-display font-semibold leading-tight tracking-tight text-transparent [text-wrap:balance] line-clamp-3 ${
              share.lessonTitle.length > 50
                ? "text-3xl sm:text-4xl md:text-5xl"
                : "text-4xl sm:text-5xl md:text-6xl"
            }`}
            style={{
              backgroundSize: "200% 100%",
            }}
            initial={
              reduce
                ? { opacity: 1, backgroundPosition: "0% 50%" }
                : { opacity: 0, backgroundPosition: "100% 50%" }
            }
            animate={{ opacity: 1, backgroundPosition: "0% 50%" }}
            transition={{
              opacity: {
                duration: reduce ? 0 : 0.5,
                delay: reduce ? 0 : 0.7,
                ease: [0.22, 1, 0.36, 1],
              },
              backgroundPosition: {
                duration: reduce ? 0 : 1.2,
                delay: reduce ? 0 : 1,
                ease: [0.22, 1, 0.36, 1],
              },
            }}
          >
            {share.lessonTitle}
          </motion.h1>

          {/* Code block — THE artifact. Padding generous, monospace,
              4-color tokenization, typewriter reveal. */}
          <motion.div
            className="mt-6 rounded-2xl border border-border bg-panel/95 p-6 shadow-2xl sm:p-8"
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: reduce ? 0 : 0.5,
              delay: reduce ? 0 : 1.0,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <CodeTypewriter
              code={share.codeSnippet}
              // Typewriter starts immediately on phase=typing (the
              // outer schedule fires that at t=900ms post-mount).
              // Prior 200ms padding made the first ~1.4s feel stalled.
              startDelayMs={0}
              onDone={onTypewriterDone}
            />
          </motion.div>
        </motion.div>

        {/* Footer band — author + ring + meta + CTA */}
        <motion.div
          className="mt-10 flex flex-col items-start gap-6 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={
            phase === "ring" || phase === "footer" || phase === "idle"
              ? { opacity: 1, y: 0 }
              : { opacity: 0, y: 8 }
          }
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-center gap-3">
            {/* Mastery ring — strokes in via stroke-dashoffset on the
                ring beat. Reduced-motion: rendered fully drawn. */}
            <svg
              width="28"
              height="28"
              viewBox="0 0 28 28"
              aria-hidden="true"
              className="shrink-0"
            >
              <motion.circle
                cx="14"
                cy="14"
                r="12"
                fill="none"
                stroke={ringColor}
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="75.4"
                initial={reduce ? false : { strokeDashoffset: 75.4, rotate: -90 }}
                animate={{ strokeDashoffset: 0, rotate: -90 }}
                style={{ originX: 0.5, originY: 0.5 }}
                transition={{
                  duration: reduce ? 0 : 0.8,
                  delay: 0,
                  ease: [0.4, 0, 0.2, 1],
                }}
                transform="rotate(-90 14 14)"
              />
            </svg>
            <div>
              <div className="text-base font-medium text-ink">
                {share.displayName ?? "A learner on CodeTutor"}
              </div>
              <div className="text-xs text-muted">
                {masteryLabel(share.mastery)}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-start gap-1 text-xs text-faint sm:items-end">
            <div>
              {fmtTimeSpent(share.timeSpentMs)} · {share.attemptCount}{" "}
              {share.attemptCount === 1 ? "attempt" : "attempts"}
            </div>
            {/* View counter — hidden when 0 readers. "0 readers" under
                a freshly-published share reads sad and undercuts the
                celebratory tone. Once at least one reader has visited,
                the count animates in. */}
            {animatedViews > 0 && (
              <div className="font-normal">
                {fmtViewCount(animatedViews)}{" "}
                {animatedViews === 1 ? "reader" : "readers"}
              </div>
            )}
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          className="mt-12 flex flex-col items-center gap-2"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={
            phase === "footer" || phase === "idle"
              ? { opacity: 1, y: 0 }
              : { opacity: 0, y: 8 }
          }
          transition={{
            duration: 0.5,
            delay: 0.2,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <CtaButton
            // Absolute URL — the share page can be embedded (Notion,
            // Discord, etc.) and a relative `/?...` would navigate
            // within the embedder's own host. window.location.origin
            // resolves to codetutor.msrivas.com on the live site,
            // localhost:5173 in dev, etc.
            href={`${window.location.origin}/?utm_source=share&utm_medium=lesson_share&utm_campaign=${share.shareToken}`}
            label="Try this lesson — takes 4 minutes →"
            breathe={phase === "idle" && !reduce}
          />
          <div className="text-[11px] text-faint">
            No signup needed for the first lesson.
          </div>
        </motion.div>
      </main>
    </div>
  );
}

interface CtaButtonProps {
  href: string;
  label: string;
  /** When true, fires a single 800ms breath at t=0 (one-shot, not
   *  looped). Looped CTA-pulse reads as desperate. */
  breathe?: boolean;
}

function CtaButton({ href, label, breathe }: CtaButtonProps) {
  // The button has a tactile press: hover lifts borderColor + bg,
  // press collapses translate + scale 0.985. Breath is opt-in by the
  // parent and runs once when phase reaches idle.
  return (
    <motion.a
      href={href}
      animate={
        breathe
          ? {
              scale: [1, 1.02, 1],
              transition: {
                duration: 0.8,
                ease: [0.22, 1, 0.36, 1],
                delay: 4,
                repeat: 0,
              },
            }
          : undefined
      }
      whileHover={{ y: -1 }}
      whileTap={{ y: 0, scale: 0.985 }}
      className="inline-flex items-center rounded-full border border-borderSoft bg-panel px-5 py-2.5 text-sm font-medium text-ink transition hover:border-accent/40 hover:bg-accent/5"
    >
      {label}
    </motion.a>
  );
}
