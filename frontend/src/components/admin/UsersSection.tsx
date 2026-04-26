import { useEffect, useState } from "react";
import {
  api,
  type AdminUserListEntry,
  type AdminUserOverride,
} from "../../api/client";

// Phase 20-P5: paginated users table + per-user override editor.
//
// The table is read-only by default; clicking a row opens an inline
// drawer with current usage + the override form. Search filters by
// email substring (server-side).
//
// Bounds:
//   • dailyQuestionsCap: 0–10000
//   • dailyUsdCap: 0–100
//   • lifetimeUsdCap: 0–1000
// All three are nullable — null means "use project default for this cap".
//
// Phase 4.5 client safety guard #7: if a user sets dailyQuestionsCap=0,
// we show a soft warning suggesting ai_platform_denylist instead. We
// don't block the save (cap=0 IS valid; sometimes you want a soft
// throttle without committing to the denylist).

const PAGE_SIZE = 25;

export function UsersSection() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<AdminUserListEntry[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const r = await api.adminListUsers({
        page,
        perPage: PAGE_SIZE,
        search: search.trim() || undefined,
      });
      setUsers(r.users);
      setHasMore(r.hasMore);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const onSearch = async () => {
    setPage(1);
    await refresh();
  };

  if (error) {
    return (
      <div className="rounded-md border border-danger/40 bg-danger/10 p-3 text-[11px] text-danger">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void onSearch();
          }}
          placeholder="search by email…"
          className="flex-1 rounded border border-border bg-bg px-2 py-1 text-[11px] text-ink"
        />
        <button
          onClick={() => void onSearch()}
          className="rounded-md border border-border bg-elevated px-3 py-1 text-[11px] font-semibold text-ink transition hover:border-accent/60"
        >
          Search
        </button>
      </div>

      {!users && <div className="text-[11px] text-muted">Loading…</div>}
      {users && users.length === 0 && (
        <div className="text-[11px] text-muted">No users on this page.</div>
      )}

      {users && users.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-elevated/50 text-[10px] uppercase tracking-wider text-muted">
              <tr>
                <th className="px-2 py-1">Email</th>
                <th className="px-2 py-1 text-right">Q today</th>
                <th className="px-2 py-1 text-right">$ today</th>
                <th className="px-2 py-1 text-right">$ lifetime</th>
                <th className="px-2 py-1">Flags</th>
                <th className="px-2 py-1" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  className={`border-t border-border ${
                    selected === u.id ? "bg-accent/5" : ""
                  }`}
                >
                  <td className="px-2 py-1.5 font-mono text-ink">
                    {u.email ?? <span className="text-faint">(no email)</span>}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-ink">
                    {u.questionsToday}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-ink">
                    ${u.usdToday.toFixed(4)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-ink">
                    ${u.usdLifetime.toFixed(4)}
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex gap-1">
                      {u.override && (
                        <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[9px] text-accent ring-1 ring-accent/30">
                          override
                        </span>
                      )}
                      {u.denylisted && (
                        <span className="rounded bg-danger/15 px-1.5 py-0.5 text-[9px] text-danger ring-1 ring-danger/30">
                          denylisted
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <button
                      onClick={() =>
                        setSelected((id) => (id === u.id ? null : u.id))
                      }
                      className="text-[10px] text-accent hover:underline"
                    >
                      {selected === u.id ? "Close" : "Edit"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-[10px] text-faint">
          Page {page}
        </div>
        <div className="flex gap-1">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-md border border-border bg-elevated px-2 py-0.5 text-[10px] text-muted disabled:opacity-50"
          >
            ← Prev
          </button>
          <button
            disabled={!hasMore}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-md border border-border bg-elevated px-2 py-0.5 text-[10px] text-muted disabled:opacity-50"
          >
            Next →
          </button>
        </div>
      </div>

      {selected && (
        <UserDrawer
          userId={selected}
          onClose={() => setSelected(null)}
          onSaved={async () => {
            await refresh();
          }}
        />
      )}
    </div>
  );
}

interface UserDrawerProps {
  userId: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

function UserDrawer({ userId, onClose, onSaved }: UserDrawerProps) {
  const [override, setOverride] = useState<AdminUserOverride | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const r = await api.adminGetUser(userId);
      setOverride(r.override);
      setLoaded(true);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return (
    <div className="rounded-md border border-accent/30 bg-accent/5 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-[12px] font-semibold text-ink">
          Override caps for{" "}
          <span className="font-mono text-[11px]">{userId.slice(0, 8)}…</span>
        </h4>
        <button
          onClick={onClose}
          className="rounded px-2 py-0.5 text-[11px] text-muted transition hover:bg-elevated hover:text-ink"
        >
          close
        </button>
      </div>
      {error && (
        <div className="rounded border border-danger/40 bg-danger/10 px-2 py-1 text-[10px] text-danger">
          {error}
        </div>
      )}
      {!loaded ? (
        <div className="text-[11px] text-muted">Loading…</div>
      ) : (
        <OverrideForm
          userId={userId}
          override={override}
          onSaved={async () => {
            await refresh();
            await onSaved();
          }}
        />
      )}
    </div>
  );
}

interface OverrideFormProps {
  userId: string;
  override: AdminUserOverride | null;
  onSaved: () => Promise<void>;
}

function OverrideForm({ userId, override, onSaved }: OverrideFormProps) {
  const [dailyQ, setDailyQ] = useState<string>(
    override?.dailyQuestionsCap?.toString() ?? "",
  );
  const [dailyUsd, setDailyUsd] = useState<string>(
    override?.dailyUsdCap?.toString() ?? "",
  );
  const [lifetimeUsd, setLifetimeUsd] = useState<string>(
    override?.lifetimeUsdCap?.toString() ?? "",
  );
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  type ParsedCap = number | null | "invalid";
  const parseOrNull = (s: string, max: number): ParsedCap => {
    if (s.trim() === "") return null;
    const n = Number(s);
    if (!Number.isFinite(n)) return "invalid" as const;
    if (n < 0 || n > max) return "invalid" as const;
    return n;
  };

  const dailyQVal: ParsedCap = parseOrNull(dailyQ, 10000);
  const dailyUsdVal: ParsedCap = parseOrNull(dailyUsd, 100);
  const lifetimeUsdVal: ParsedCap = parseOrNull(lifetimeUsd, 1000);
  const anyInvalid =
    dailyQVal === "invalid" ||
    dailyUsdVal === "invalid" ||
    lifetimeUsdVal === "invalid";
  const reasonOk = reason.trim().length >= 4;
  const canSave = !busy && !anyInvalid && reasonOk;

  // Soft warning if dailyQ = 0.
  const zeroNudge = dailyQVal === 0;

  const handleSave = async () => {
    if (!canSave) return;
    // After the canSave guard (which includes !anyInvalid), TS has
    // narrowed each *Val to `number | null` — no "invalid" possible.
    setBusy(true);
    setError(null);
    try {
      await api.adminSetUserOverride(userId, {
        dailyQuestionsCap: dailyQVal as number | null,
        dailyUsdCap: dailyUsdVal as number | null,
        lifetimeUsdCap: lifetimeUsdVal as number | null,
        reason: reason.trim(),
      });
      await onSaved();
      setReason("");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const handleClear = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.adminClearUserOverride(userId);
      await onSaved();
      setDailyQ("");
      setDailyUsd("");
      setLifetimeUsd("");
      setReason("");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        <CapInput
          label="Daily questions"
          value={dailyQ}
          onChange={setDailyQ}
          max={10000}
          placeholder="default"
          disabled={busy}
        />
        <CapInput
          label="Daily $"
          value={dailyUsd}
          onChange={setDailyUsd}
          max={100}
          step="0.01"
          placeholder="default"
          disabled={busy}
        />
        <CapInput
          label="Lifetime $"
          value={lifetimeUsd}
          onChange={setLifetimeUsd}
          max={1000}
          step="0.01"
          placeholder="default"
          disabled={busy}
        />
      </div>
      <p className="text-[10px] text-faint">
        Empty = use project default. Bounds enforced server-side.
      </p>

      {zeroNudge && (
        <div className="rounded border border-warn/40 bg-warn/10 px-2 py-1.5 text-[10px] text-warn">
          Setting daily questions = 0 effectively denylists this user. Consider
          adding to the platform denylist instead for clearer audit semantics.
        </div>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-medium text-muted">
          Reason <span className="text-faint">(required, 4+ chars)</span>
        </span>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={busy}
          placeholder="why this user gets a custom cap"
          className="rounded border border-border bg-bg px-2 py-1 text-[11px] text-ink"
        />
      </label>

      {error && (
        <div className="rounded border border-danger/40 bg-danger/10 px-2 py-1 text-[10px] text-danger">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="rounded-md bg-accent px-3 py-1 text-[11px] font-semibold text-bg transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:bg-elevated disabled:text-faint"
        >
          {busy ? "Saving…" : "Save override"}
        </button>
        {override && (
          <button
            onClick={handleClear}
            disabled={busy}
            className="rounded-md border border-border bg-elevated px-3 py-1 text-[11px] text-muted transition hover:text-ink"
          >
            Clear all caps
          </button>
        )}
      </div>
    </div>
  );
}

function CapInput({
  label,
  value,
  onChange,
  max,
  step,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max: number;
  step?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const n = value.trim() === "" ? null : Number(value);
  const invalid =
    n !== null && (!Number.isFinite(n) || n < 0 || n > max);
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-medium text-muted">{label}</span>
      <input
        type="number"
        min={0}
        max={max}
        step={step ?? "1"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`rounded border bg-bg px-2 py-1 font-mono text-[11px] text-ink ${
          invalid ? "border-danger/60" : "border-border"
        }`}
      />
      <span className="text-[9px] text-faint">0–{max}</span>
    </label>
  );
}
