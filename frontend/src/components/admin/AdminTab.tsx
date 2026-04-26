import { useState } from "react";
import { ProjectCapsSection } from "./ProjectCapsSection";
import { UsersSection } from "./UsersSection";
import { AuditLogSection } from "./AuditLogSection";

// Phase 20-P5: hidden Settings → Admin tab. Visible only when the user's
// JWT carries app_metadata.role = 'admin' (set by the Supabase Custom
// Access Token hook). Three sub-sections inside, picker pills at top.

type Section = "project" | "users" | "audit";

const SECTION_LABEL: Record<Section, string> = {
  project: "Project caps",
  users: "Users",
  audit: "Audit log",
};

export function AdminTab() {
  const [section, setSection] = useState<Section>("project");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Admin controls</h2>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
            Adjust free-tier caps and view usage. Changes take effect within
            ~60 s of a save (resolver cache TTL). Every write is audited.
          </p>
        </div>
      </div>

      <nav
        aria-label="Admin sections"
        className="flex shrink-0 gap-0.5 rounded-md bg-elevated/40 p-0.5"
      >
        {(Object.keys(SECTION_LABEL) as Section[]).map((s) => {
          const active = section === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setSection(s)}
              aria-current={active ? "page" : undefined}
              className={`flex-1 rounded px-3 py-1 text-[11px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                active
                  ? "bg-bg text-ink shadow-soft ring-1 ring-accent/40"
                  : "text-muted hover:bg-bg/50 hover:text-ink"
              }`}
            >
              {SECTION_LABEL[s]}
            </button>
          );
        })}
      </nav>

      {section === "project" && <ProjectCapsSection />}
      {section === "users" && <UsersSection />}
      {section === "audit" && <AuditLogSection />}
    </div>
  );
}
