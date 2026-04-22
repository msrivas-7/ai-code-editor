-- Phase 20-P4 follow-up (Round 6): denylisted users can now click "Get in
-- touch about paid access". Round 5 had hidden the CTA + 403'd the POST —
-- operator reversed that: a denylisted user expressing willingness to pay is
-- still a lead worth surfacing, we just want the row marked so the operator
-- can see context when reviewing. A past abuser willing to pay is actually a
-- stronger signal than a casual tire-kicker.
--
-- See plan: /Users/mehul/.claude/plans/hazy-wishing-wren.md §"Round 6"
ALTER TABLE public.paid_access_interest
  ADD COLUMN denylisted_at_click boolean NOT NULL DEFAULT false;

-- No index — the operator's review query is a full scan of <1k rows at
-- Phase 1 scale, and filtering denylisted rows out is a trivial WHERE clause.
