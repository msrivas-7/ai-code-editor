import { memo } from "react";
import { motion, useReducedMotion } from "framer-motion";

// Prominent always-there signal at the top of a completed course's
// content area. The pill in the header is the at-a-glance cue; this
// hero card is the "take a moment — you actually did this" cue. Lives
// above the course description so it's the first thing the learner
// sees on re-entry.
//
// Composition:
//   - Soft gold gradient background (low-sat)
//   - Rosette/medal SVG on the left, rotating imperceptibly
//   - "Course Complete" title in gradient; stats underneath
//   - A slow shimmer sweeps across the card on a loop (2.5s)
//   - Border + faint glow
//
// Subtle because it doesn't use bright colors, doesn't animate large
// transforms, doesn't push content. Effective because every element
// says "finished" — the card, the rosette, the shimmer, the gradient.

interface CourseCompleteHeroProps {
  courseTitle: string;
  completedLessons: number;
  totalLessons: number;
  practiceDone?: number;
  practiceTotal?: number;
}

function CourseCompleteHeroComponent({
  courseTitle,
  completedLessons,
  totalLessons,
  practiceDone = 0,
  practiceTotal = 0,
}: CourseCompleteHeroProps) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className="relative mb-5 overflow-hidden rounded-xl border border-[rgb(234,179,8)]/35 bg-gradient-to-br from-[rgb(234,179,8)]/10 via-[rgb(250,204,21)]/5 to-transparent px-5 py-4 shadow-[0_0_24px_-6px_rgba(234,179,8,0.35)]"
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      role="status"
      aria-label={`${courseTitle} course complete`}
    >
      {/* Shimmer sweep — diagonal band that traverses the card every
          2.5s. Mix-blend-mode:soft-light keeps it gold-on-gold without
          punching through the content. */}
      {!reduce && (
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -skew-x-12"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(250,204,21,0.35), transparent)",
            mixBlendMode: "soft-light",
          }}
          initial={{ x: "-50%" }}
          animate={{ x: "450%" }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", repeatDelay: 1.2 }}
        />
      )}

      <div className="relative z-10 flex items-center gap-4">
        {/* Rosette SVG — inline so we control stroke + tint via currentColor.
            A slow rotation (20s full turn) adds life without being
            demanding; the ribbons at the bottom stay roughly vertical. */}
        <motion.svg
          viewBox="0 0 64 64"
          width="48"
          height="48"
          className="shrink-0 text-[rgb(234,179,8)] drop-shadow-[0_0_8px_rgba(234,179,8,0.45)]"
          aria-hidden="true"
          animate={reduce ? {} : { rotate: [0, 2, -2, 0] }}
          transition={reduce ? {} : { duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Outer petals */}
          <g fill="currentColor" opacity="0.85">
            {Array.from({ length: 12 }).map((_, i) => {
              const angle = (i * 30 * Math.PI) / 180;
              const cx = 32 + Math.cos(angle) * 20;
              const cy = 32 + Math.sin(angle) * 20;
              return (
                <ellipse
                  key={i}
                  cx={cx}
                  cy={cy}
                  rx="4"
                  ry="7"
                  transform={`rotate(${i * 30} ${cx} ${cy})`}
                />
              );
            })}
          </g>
          {/* Center disc */}
          <circle cx="32" cy="32" r="14" fill="rgb(250,204,21)" />
          <circle cx="32" cy="32" r="14" fill="none" stroke="rgb(202,138,4)" strokeWidth="1.5" />
          {/* Check mark inside */}
          <path
            d="M24 33 L30 39 L42 27"
            fill="none"
            stroke="rgb(113,63,18)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Ribbon tails — hang below the medal */}
          <path d="M22 46 L20 60 L26 56 L28 62 L30 48 Z" fill="rgb(220,38,38)" />
          <path d="M42 46 L44 60 L38 56 L36 62 L34 48 Z" fill="rgb(220,38,38)" />
        </motion.svg>

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 className="bg-gradient-to-r from-[rgb(234,179,8)] via-[rgb(250,204,21)] to-[rgb(217,119,6)] bg-clip-text text-[17px] font-semibold leading-tight tracking-tight text-transparent">
            Course Complete
          </h2>
          <p className="text-[12px] leading-relaxed text-ink/75">
            You finished every lesson in {courseTitle}. All{" "}
            <span className="font-semibold text-ink">
              {completedLessons}/{totalLessons}
            </span>{" "}
            lessons done
            {practiceTotal > 0 && (
              <>
                {" · "}
                <span className="font-semibold text-ink">
                  {practiceDone}/{practiceTotal}
                </span>{" "}
                practice
              </>
            )}
            .
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export const CourseCompleteHero = memo(CourseCompleteHeroComponent);
