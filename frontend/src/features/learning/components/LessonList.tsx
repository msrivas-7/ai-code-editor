import type { LessonMeta, ProgressStatus } from "../types";
import { LessonProgressBadge } from "./LessonProgressBadge";

interface LessonListProps {
  lessons: LessonMeta[];
  progressMap: Record<string, ProgressStatus>;
  completedIds: string[];
  practiceProgressMap?: Record<string, { done: number; total: number }>;
  onSelect: (lessonId: string) => void;
  onSelectPractice?: (lessonId: string) => void;
}

export function LessonList({ lessons, progressMap, completedIds, practiceProgressMap, onSelect, onSelectPractice }: LessonListProps) {
  return (
    <ol className="flex flex-col gap-1.5">
      {lessons.map((lesson, idx) => {
        const status = progressMap[lesson.id] ?? "not_started";
        const prereqsMet =
          lesson.prerequisiteLessonIds.length === 0 ||
          lesson.prerequisiteLessonIds.every((id) => completedIds.includes(id));
        const locked = !prereqsMet && status === "not_started";
        const pp = practiceProgressMap?.[lesson.id];
        const hasPractice = !!pp && pp.total > 0;
        const practiceUnlocked = hasPractice && status === "completed";
        const practiceAllDone = hasPractice && pp.done === pp.total;
        const practiceTooltip = practiceUnlocked
          ? practiceAllDone
            ? "Replay practice"
            : `Practice ${pp.done}/${pp.total}`
          : "Unlocks after completing the lesson";

        return (
          <li key={lesson.id}>
            <div className={`flex items-stretch rounded-lg transition ${
              locked ? "" : "hover:bg-elevated/60"
            }`}>
              <button
                disabled={locked}
                onClick={() => onSelect(lesson.id)}
                aria-label={locked ? `${lesson.title} (locked — complete prerequisites first)` : undefined}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-l-lg px-3 py-2.5 text-left disabled:cursor-not-allowed"
              >
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  locked
                    ? "bg-elevated/60 text-faint"
                    : status === "completed"
                      ? "bg-success/15 text-success"
                      : status === "in_progress"
                        ? "bg-accent/15 text-accent"
                        : "bg-elevated text-muted"
                }`}>
                  {status === "completed" ? (
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    idx + 1
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`truncate text-sm font-medium ${locked ? "text-muted" : ""}`}>
                      {lesson.title}
                    </span>
                    {locked && (
                      <svg
                        className="h-3 w-3 shrink-0 text-muted"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-label="Locked"
                        role="img"
                      >
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    )}
                  </div>
                  <p className={`truncate text-[11px] ${locked ? "text-faint" : "text-muted"}`}>
                    {locked ? "Complete the previous lesson to unlock" : lesson.description}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-[10px] text-faint">{lesson.estimatedMinutes}m</span>
                  <LessonProgressBadge status={status} />
                </div>
              </button>

              {hasPractice && (
                <button
                  disabled={!practiceUnlocked || !onSelectPractice}
                  onClick={() => practiceUnlocked && onSelectPractice?.(lesson.id)}
                  title={practiceTooltip}
                  aria-label={practiceTooltip}
                  className={`ml-1 flex shrink-0 items-center gap-1 self-center rounded-md px-2 py-1 text-[10px] font-semibold transition ${
                    practiceUnlocked
                      ? practiceAllDone
                        ? "bg-success/15 text-success hover:bg-success/25"
                        : "bg-violet/15 text-violet hover:bg-violet/25"
                      : "cursor-not-allowed bg-elevated/60 text-faint"
                  }`}
                >
                  {!practiceUnlocked ? (
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  ) : (
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  )}
                  <span>Practice {pp.done}/{pp.total}</span>
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
