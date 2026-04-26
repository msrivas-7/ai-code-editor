import { useEffect, useState } from "react";
import {
  api,
  type AdminAuditLogEntry,
  type AdminAuditEventType,
} from "../../api/client";

// Phase 20-P5: read-only tail of admin actions. The audit_log table
// records every successful write AND every rejected attempt — both
// surface here so admins notice their own near-misses (Phase 4.5
// client safety guard #8: "recent-actions panel always visible while
// editing" is the parent intent; this is the dedicated dashboard
// surface for it).

const EVENT_LABEL: Record<AdminAuditEventType, string> = {
  user_override_set: "Set user override",
  user_override_cleared: "Cleared user override",
  system_config_set: "Set project cap",
  system_config_cleared: "Cleared project cap",
  denylist_added: "Added to denylist",
  denylist_removed: "Removed from denylist",
  tab_opened: "Admin tab opened",
  rejected_attempt: "Rejected attempt",
};

const EVENT_TONE: Record<AdminAuditEventType, string> = {
  user_override_set: "bg-accent/15 text-accent",
  user_override_cleared: "bg-muted/15 text-muted",
  system_config_set: "bg-warn/15 text-warn",
  system_config_cleared: "bg-muted/15 text-muted",
  denylist_added: "bg-danger/15 text-danger",
  denylist_removed: "bg-muted/15 text-muted",
  tab_opened: "bg-muted/15 text-muted",
  rejected_attempt: "bg-danger/15 text-danger",
};

export function AuditLogSection() {
  const [entries, setEntries] = useState<AdminAuditLogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const r = await api.adminGetAuditLog({ limit: 50 });
      setEntries(r.entries);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  if (error) {
    return (
      <div className="rounded-md border border-danger/40 bg-danger/10 p-3 text-[11px] text-danger">
        {error}
      </div>
    );
  }
  if (!entries) {
    return <div className="text-[11px] text-muted">Loading…</div>;
  }
  if (entries.length === 0) {
    return (
      <div className="rounded-md border border-border bg-elevated/30 p-3 text-[11px] text-muted">
        No admin actions yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-faint">
          Last {entries.length} admin actions, newest first.
        </p>
        <button
          onClick={() => void refresh()}
          className="rounded-md border border-border bg-elevated px-2 py-0.5 text-[10px] text-muted transition hover:text-ink"
        >
          Refresh
        </button>
      </div>
      <div className="flex flex-col gap-1.5">
        {entries.map((e) => (
          <div
            key={e.id}
            className="rounded-md border border-border bg-elevated/30 p-2 text-[11px]"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span
                className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ring-1 ring-border/30 ${EVENT_TONE[e.eventType]}`}
              >
                {EVENT_LABEL[e.eventType]}
              </span>
              <span className="text-[10px] text-faint">
                {new Date(e.createdAt).toLocaleString()}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted">
              <span>
                actor:{" "}
                <span className="font-mono text-ink">
                  {e.actorId.slice(0, 8)}…
                </span>
              </span>
              {e.targetUserId && (
                <span>
                  target user:{" "}
                  <span className="font-mono text-ink">
                    {e.targetUserId.slice(0, 8)}…
                  </span>
                </span>
              )}
              {e.targetKey && (
                <span>
                  key: <span className="font-mono text-ink">{e.targetKey}</span>
                </span>
              )}
            </div>
            {e.reason && (
              <div className="mt-0.5 italic text-[10px] text-faint">
                "{e.reason}"
              </div>
            )}
            {(e.before !== null || e.after !== null) && (
              <details className="mt-1 text-[10px]">
                <summary className="cursor-pointer text-muted hover:text-ink">
                  before/after
                </summary>
                <pre className="mt-1 overflow-x-auto rounded bg-bg p-1.5 font-mono text-[10px] text-ink">
                  {JSON.stringify({ before: e.before, after: e.after }, null, 2)}
                </pre>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
