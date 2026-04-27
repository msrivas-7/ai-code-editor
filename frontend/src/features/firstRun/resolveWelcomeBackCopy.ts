import type { CourseProgress, LessonMeta, LessonProgress } from "../learning/types";

// Welcome-back hero + subtitle copy. One helper, tested in isolation,
// so the overlay component stays a dumb renderer. Branches ordered
// by priority — first match wins:
//   0. Phase 21B — milestone streak day → celebrate quietly
//      ("Day 7.", "A week in.")
//   1. Something in-flight → pick up there
//   2. Freshly finished a course → celebrate forward
//   3. Has progress, nothing in-flight → dashboard wait
//   4. Never touched anything → invitation
//
// The hero line swaps at >7-day absence to a softer "Good to see you
// again" — a small, high-value detail that makes the app feel like
// it noticed you were gone.

export interface WelcomeBackCopy {
  hero: string;
  subtitle: string;
}

export interface WelcomeBackContext {
  firstName: string;
  now?: Date;
  lastWelcomeBackAt: string | null;
  // Keyed by courseId → CourseProgress, same shape as useProgressStore.
  courseProgressMap: Record<string, CourseProgress>;
  // Keyed by `${courseId}/${lessonId}` — matches progressStore.
  lessonProgressMap: Record<string, LessonProgress>;
  // Keyed by courseId → the course's title + lesson list. Used to
  // label the in-progress subtitle with a human lesson name instead
  // of an id.
  courseCatalog?: Record<
    string,
    { title: string; lessons: readonly Pick<LessonMeta, "id" | "title" | "order">[] }
  >;
  // Phase 21B: optional streak data for milestone copy. When current
  // matches a milestone (7, 14, 30, 100, 365) AND we're on the day
  // the streak is still active, the hero swaps to a quiet "Day N."
  // celebration line. Absent or zero → fall through to the existing
  // branches.
  streakCurrent?: number;
  streakIsActiveToday?: boolean;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const STREAK_MILESTONES: ReadonlySet<number> = new Set([7, 14, 30, 100, 365]);

function streakMilestoneCopy(current: number, firstName: string): WelcomeBackCopy | null {
  if (current === 7) return { hero: "Day 7.", subtitle: `A week in, ${firstName}.` };
  if (current === 14) return { hero: "Day 14.", subtitle: "Two weeks. The habit is forming." };
  if (current === 30) return { hero: "Day 30.", subtitle: "A month of showing up." };
  if (current === 100) return { hero: "Day 100.", subtitle: "Triple digits. That's rare air." };
  if (current === 365) return { hero: "Day 365.", subtitle: "A year. Take a breath." };
  return null;
}

export function resolveWelcomeBackCopy(ctx: WelcomeBackContext): WelcomeBackCopy {
  const now = (ctx.now ?? new Date()).getTime();
  const longAbsence =
    ctx.lastWelcomeBackAt !== null &&
    now - Date.parse(ctx.lastWelcomeBackAt) > SEVEN_DAYS_MS;
  const hero = longAbsence
    ? `Good to see you again, ${ctx.firstName}.`
    : `Welcome back, ${ctx.firstName}.`;

  // Branch 0: streak milestone day. Most celebratory — wins over
  // in-progress / catch-up branches because hitting Day 7 / 30 / 100
  // is a moment the product should never miss. STREAK_MILESTONES
  // gates the trigger so non-milestone days fall through silently.
  if (
    ctx.streakCurrent !== undefined &&
    ctx.streakIsActiveToday &&
    STREAK_MILESTONES.has(ctx.streakCurrent)
  ) {
    const m = streakMilestoneCopy(ctx.streakCurrent, ctx.firstName);
    if (m) return m;
  }

  // Branch 1: an in-progress lesson anywhere. Prefer the most recently
  // updated one — a learner who bounces between two lessons should
  // land at whichever they touched last.
  const inProgress = Object.values(ctx.lessonProgressMap)
    .filter((l) => l.status === "in_progress")
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];
  if (inProgress) {
    const course = ctx.courseCatalog?.[inProgress.courseId];
    const lesson = course?.lessons.find((l) => l.id === inProgress.lessonId);
    if (lesson) {
      return {
        hero,
        subtitle: `Picking up at Lesson ${lesson.order}: ${lesson.title}.`,
      };
    }
    return { hero, subtitle: "Picking up where you left off." };
  }

  // Branch 2: a course completed in the last 24 hours — recency filter
  // so we don't congratulate someone weeks after the fact.
  const completedRecently = Object.values(ctx.courseProgressMap)
    .filter(
      (c) =>
        c.status === "completed" &&
        c.completedAt &&
        now - Date.parse(c.completedAt) < 24 * 60 * 60 * 1000,
    )
    .sort(
      (a, b) => Date.parse(b.completedAt ?? "0") - Date.parse(a.completedAt ?? "0"),
    )[0];
  if (completedRecently) {
    const course = ctx.courseCatalog?.[completedRecently.courseId];
    const title = course?.title ?? "that course";
    return {
      hero,
      subtitle: `Nice work on ${title} — ready for what's next?`,
    };
  }

  // Branch 3: has progress, nothing in-flight — quiet, low-pressure.
  // Phase B: replaced "Your dashboard is waiting" (a status report
  // about a piece of UI) with copy that names what the user is
  // actually carrying: their longest run of completed lessons.
  const hasAnyProgress = Object.values(ctx.courseProgressMap).some(
    (c) => c.status !== "not_started",
  );
  if (hasAnyProgress) {
    const completedCount = Object.values(ctx.lessonProgressMap).filter(
      (l) => l.status === "completed",
    ).length;
    if (completedCount > 0) {
      return {
        hero,
        subtitle:
          completedCount === 1
            ? "One lesson down. Pick the next one when you're ready."
            : `${completedCount} lessons done. The next one's there when you are.`,
      };
    }
    return { hero, subtitle: "Pick up where you left off." };
  }

  // Branch 4: a returning user with zero progress (rare — maybe they
  // signed up months ago and only today opened a lesson). Invite
  // without pressure.
  return { hero, subtitle: "Today's a good day to start." };
}
