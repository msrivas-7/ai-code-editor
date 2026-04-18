import type { ProgressStatus } from "../types";

const config: Record<ProgressStatus, { label: string; cls: string }> = {
  not_started: { label: "Not started", cls: "bg-elevated text-muted" },
  in_progress: { label: "In progress", cls: "bg-accent/15 text-accent" },
  completed: { label: "Completed", cls: "bg-success/15 text-success" },
};

export function LessonProgressBadge({ status }: { status: ProgressStatus }) {
  const { label, cls } = config[status];
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
