import { useSessionStore } from "../state/sessionStore";

const LABEL: Record<string, string> = {
  idle: "Idle",
  starting: "Starting…",
  active: "Active",
  reconnecting: "Reconnecting…",
  error: "Error",
  ended: "Ended",
};

const DOT: Record<string, string> = {
  idle: "bg-faint",
  starting: "bg-warn animate-pulseDot",
  active: "bg-success",
  reconnecting: "bg-warn animate-pulseDot",
  error: "bg-danger",
  ended: "bg-faint",
};

export function StatusBadge() {
  const phase = useSessionStore((s) => s.phase);
  const error = useSessionStore((s) => s.error);

  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-elevated px-2.5 py-1 text-xs">
      <span className={`inline-block h-2 w-2 rounded-full ${DOT[phase] ?? DOT.idle}`} />
      <span className="text-ink">{LABEL[phase] ?? phase}</span>
      {error && (
        <span className="max-w-[180px] truncate text-[11px] text-danger" title={error}>
          — {error}
        </span>
      )}
    </div>
  );
}
