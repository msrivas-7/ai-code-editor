import type { ProgressStatus } from "../types";

// Phase B: "Not started" is a verdict — it documents the user's
// failure to have begun, before they had a chance to. Render NOTHING
// for the not_started state. The lesson list / course rows already
// imply position; this badge only earns its space once the learner
// has actually engaged.
const config: Record<ProgressStatus, { label: string; cls: string } | null> = {
  not_started: null,
  in_progress: { label: "In progress", cls: "bg-accent/15 text-accent" },
  completed: { label: "Completed", cls: "bg-success/15 text-success" },
};

export function LessonProgressBadge({ status }: { status: ProgressStatus }) {
  const entry = config[status];
  if (!entry) return null;
  const { label, cls } = entry;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>
      {status === "completed" && (
        <svg className="mr-1 h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
      {label}
    </span>
  );
}
