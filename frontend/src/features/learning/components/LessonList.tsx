import type { LessonMeta, ProgressStatus } from "../types";
import { LessonProgressBadge } from "./LessonProgressBadge";

interface LessonListProps {
  lessons: LessonMeta[];
  progressMap: Record<string, ProgressStatus>;
  completedIds: string[];
  onSelect: (lessonId: string) => void;
}

export function LessonList({ lessons, progressMap, completedIds, onSelect }: LessonListProps) {
  return (
    <ol className="flex flex-col gap-1">
      {lessons.map((lesson, idx) => {
        const status = progressMap[lesson.id] ?? "not_started";
        const prereqsMet =
          lesson.prerequisiteLessonIds.length === 0 ||
          lesson.prerequisiteLessonIds.every((id) => completedIds.includes(id));
        const locked = !prereqsMet && status === "not_started";

        return (
          <li key={lesson.id}>
            <button
              disabled={locked}
              onClick={() => onSelect(lesson.id)}
              className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                locked
                  ? "cursor-not-allowed opacity-40"
                  : "hover:bg-elevated/60"
              }`}
            >
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                status === "completed"
                  ? "bg-green-500/15 text-green-400"
                  : status === "in_progress"
                    ? "bg-accent/15 text-accent"
                    : "bg-elevated text-muted"
              }`}>
                {status === "completed" ? (
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  idx + 1
                )}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{lesson.title}</span>
                  {locked && (
                    <svg className="h-3 w-3 shrink-0 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  )}
                </div>
                <p className="truncate text-[11px] text-muted">{lesson.description}</p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className="text-[10px] text-faint">{lesson.estimatedMinutes}m</span>
                <LessonProgressBadge status={status} />
              </div>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
