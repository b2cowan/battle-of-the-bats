# Data Dictionary — PM Brief

> **Plain-language companion to** [DATA_DICTIONARY_PLAN.md](DATA_DICTIONARY_PLAN.md)
> **Status:** Planning — awaiting owner sign-off
> **Priority:** High (prevents production-down incidents like the 2026-06-08 registration 500)

---

## What we're building

A **Data Dictionary** — one curated reference (`docs/agents/db/DATA_DICTIONARY.md`) that explains, for every
meaningful database field, **what it means, what code uses it, how it connects to other fields, and the
traps to avoid**. Think of it as the "meaning" layer on top of the raw structure dumps we already keep. It's
owned by our database agents (`/db`, `/dba`) and kept alive by binding rules, not a one-time write-up.

## Why it matters (the incident that triggered it)

On 2026-06-08, public tournament **registration broke with a 500 error** because the live code asked the
database for columns that didn't actually exist there — the database had quietly drifted from what the code
assumed, and the original debugging trusted the *migration history* (a record of intentions) instead of the
*live database* (the truth). We fixed the incident, but the deeper problem is that **nobody had written down
what each field actually means or which source of truth to trust**. This project fixes that permanently.

A quick verification pass while planning found that even the project's own starter notes contained **several
stale "facts"** (e.g. a function signature and a "this setting was removed" claim that are both wrong on the
current branch, and an outdated rule about how coaches are matched to teams). That's exactly the kind of
quiet rot this dictionary is designed to catch and stop.

## What changes for the team

- **Before:** an engineer or agent had to grep migrations, read code, and guess whether a column exists in
  dev vs prod — and sometimes guessed wrong, occasionally breaking production.
- **After:** they open one document, find the field, and see its meaning, the exact code that uses it, its
  relationships, and its gotchas — plus a clear rule that the *live snapshots* (not migrations) decide
  whether a column exists. New rule: **any schema change updates the dictionary in the same breath.**

This is an **internal/agent-facing** improvement — customers don't see it directly. The customer benefit is
**fewer production incidents** (like the registration outage) and **faster, safer feature work** on the
database.

## How we'll do it (phasing)

1. **Phase 0 — Fix the foundation first.** Our structure snapshots turned out to be badly out of date (they
   miss ~20 tables and predate months of changes). Documenting "meaning" against stale structure would waste
   effort and re-introduce errors. So first we build **one repeatable command that refreshes both the dev
   and prod snapshots** (today's script only does dev, and only a summary doc — not the machine-readable
   snapshots), runs it, and adds an automatic **dev-vs-prod drift report**. Good news: one existing access
   token already reaches both databases, and these are read-only structure reads (no customer data touched).
2. **Phase 1 — Tournaments & Registration.** The first and richest domain — same area as the incident — fully
   documented against the now-fresh snapshots, every claim backed by a code reference.
3. **Phases 2+ — the rest, domain by domain:** Coaches → Org core → Rep teams → League → Accounting →
   Billing → Platform admin → CRM → Notifications.

## Success criteria

- A single command refreshes dev **and** prod snapshots after any migration and flags any dev/prod
  divergence.
- **The doc can't quietly go stale:** an automated coverage check (in our routine pre-merge checks) fails
  when a schema change isn't reflected in the dictionary, the refresh/migration tools nudge for an update
  at the moment a column changes, and updating the dictionary is a required task in any schema-touching plan
  — so future projects keep it current instead of relying on memory.
- `DATA_DICTIONARY.md` exists with the binding maintenance rules in its header and the **Tournaments &
  Registration** domain fully written, every claim verified against the live schema **and** the code that
  uses it.
- The stale "facts" found during planning are corrected, in the dictionary and in project memory.
- Remaining domains are queued as clear follow-up phases.

## Priority & sequencing note

High priority, but it slots around active feature work on `feat/free-tier-coaches`. Phase 0 is small
(~half a day) and immediately useful on its own (it repairs our schema snapshots and adds drift detection).
Phase 1 is the bulk of the writing. Nothing here ships customer-facing changes or requires a deploy.
