import type { LessonMeta, CourseProgress } from "../types";

interface ResumeLearningCardProps {
  courseTitle: string;
  progress: CourseProgress;
  nextLesson: LessonMeta | null;
  onResume: () => void;
}

export function ResumeLearningCard({ courseTitle, progress, nextLesson, onResume }: ResumeLearningCardProps) {
  if (!nextLesson) return null;

  return (
    <div className="flex items-center gap-4 rounded-xl border border-accent/30 bg-accent/5 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted">Continue {courseTitle}</p>
        <p className="truncate text-sm font-semibold">{nextLesson.title}</p>
        <p className="text-[10px] text-muted">
          {progress.completedLessonIds.length} lessons completed
        </p>
      </div>
      <button
        onClick={onResume}
        className="shrink-0 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-bg transition hover:bg-accent/90"
      >
        Resume
      </button>
    </div>
  );
}
