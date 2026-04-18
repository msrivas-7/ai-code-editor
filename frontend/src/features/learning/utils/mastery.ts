import type { LessonMeta, LessonProgress } from "../types";

export type MasteryLevel = "strong" | "okay" | "shaky";

export interface MasteryAssessment {
  level: MasteryLevel;
  score: number;
  reasons: string[];
}

const ATTEMPT_THRESHOLD = 2;
const HINT_THRESHOLD = 3;
const TIME_MULTIPLIER = 2;

export function computeMastery(
  lp: LessonProgress | null | undefined,
  meta: Pick<LessonMeta, "estimatedMinutes">,
): MasteryAssessment | null {
  if (!lp || lp.status !== "completed") return null;

  const reasons: string[] = [];
  let score = 0;

  if (lp.attemptCount > ATTEMPT_THRESHOLD) {
    score++;
    reasons.push(`${lp.attemptCount} attempts`);
  }

  if (lp.hintCount >= HINT_THRESHOLD) {
    score++;
    reasons.push(`${lp.hintCount} hints used`);
  }

  const timeSpentMs = lp.timeSpentMs ?? 0;
  const estimatedMs = (meta.estimatedMinutes ?? 0) * 60_000;
  if (estimatedMs > 0 && timeSpentMs > estimatedMs * TIME_MULTIPLIER) {
    score++;
    const mins = Math.round(timeSpentMs / 60_000);
    reasons.push(`${mins}m spent (est ${meta.estimatedMinutes}m)`);
  }

  let level: MasteryLevel;
  if (score === 0) level = "strong";
  else if (score === 1) level = "okay";
  else level = "shaky";

  return { level, score, reasons };
}

export interface ShakyLesson {
  lessonId: string;
  courseId: string;
  score: number;
  reasons: string[];
  meta: LessonMeta;
  lp: LessonProgress;
}

export function pickShakyLessons(
  lessonProgress: LessonProgress[],
  metasById: Record<string, LessonMeta>,
  limit = 3,
): ShakyLesson[] {
  const shaky: ShakyLesson[] = [];
  for (const lp of lessonProgress) {
    const meta = metasById[lp.lessonId];
    if (!meta) continue;
    const assessment = computeMastery(lp, meta);
    if (!assessment || assessment.level !== "shaky") continue;
    shaky.push({
      lessonId: lp.lessonId,
      courseId: lp.courseId,
      score: assessment.score,
      reasons: assessment.reasons,
      meta,
      lp,
    });
  }
  shaky.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.meta.order ?? 0) - (b.meta.order ?? 0);
  });
  return shaky.slice(0, limit);
}

export function formatTimeSpent(ms: number | null | undefined): string {
  if (!ms || !Number.isFinite(ms) || ms <= 0) return "0m";
  if (ms < 60_000) return "<1m";
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins === 0 ? `${hrs}h` : `${hrs}h ${remMins}m`;
}
