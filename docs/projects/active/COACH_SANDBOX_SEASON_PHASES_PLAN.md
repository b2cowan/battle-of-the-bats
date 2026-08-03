# Coach Sandbox with Season Phases — Implementation Plan

**Status:** Planned (owner agreed to recommendations 2026-08-02). Companion brief:
`COACH_SANDBOX_SEASON_PHASES_PM_BRIEF.md`.
**Sibling project:** `TOURNAMENT_ADMIN_SANDBOX_PLAN.md` — **mockups approved 2026-08-02; it IS
building first.** The demo-mode machinery — demo-session entry pattern, central write block,
outbound silence, demo-org hygiene, re-anchor job pattern — is SHARED between the two sandboxes
and is being built there as org-agnostic pieces. **Check its state before building any of those
pieces here; assume they exist and reuse them.**

**Inherited GTM posture (binding, `BUSINESS_DECISIONS.md` 2026-08-02):**
- **Ungated at the door.** No email, no form, no lead capture on the coach sandbox either. The
  premise (Premium Coaches Portal is $0 until 2027-01-01, so a competitor gets more by signing up)
  holds identically here. Revisit trigger 2027-01-01.
- **Curate the room, not the visitor.** Hide admin/portal areas that would dead-end in a sandbox —
  billing/subscription, invitations and other fully-outbound screens, exports, deep settings —
  rather than showing screens made entirely of locked controls. Same hide-don't-dead-end principle
  as the binding archive-is-opt-in ruling.
- **Hygiene includes search exclusion** of any public demo pages, alongside directory, metrics and
  observability exclusion.
- **Fictional world:** the tournament sandbox uses **Riverdale Minor Ball Association**. Keep the
  coach demo in the same invented world (the "Riverdale" convention) rather than inventing a
  second one.

**Origin:** Ideas Backlog ("Play With a Live One First", coach track) expanded by owner direction:
a no-login sandbox of the REAL premium coaches portal with a **season-phase picker** — the
prospect jumps between frozen moments of a team's year. Grounding: 2026-08-02 feasibility
investigation (this repo, coaches-demo agent) + owner Q&A.

## Product shape

- **Entry:** one tap from marketing (no login, no email) → the real portal, on a fictional demo
  team, as a demo coach. Distinct sandbox chrome: slim banner "Sandbox — nothing here is saved ·
  Start your own team free →".
- **Phase dock** (persistent, sandbox-only UI): "You're viewing: Mid-season · Jump to:
  **Tryout day / Off-season / Season start / Mid-season / Season's End**" — moments naming
  (owner-adopted), not month names.
- **Per-phase landing screens** (proposed defaults, owner may adjust at build):
  | Moment | Lands on | The beat |
  |---|---|---|
  | Tryout day | Tryouts live scoring board | Evaluations mid-flight, split scores visible |
  | Off-season | Money — budget vs. actual | Budget built, expenses logged, dues installments underway; practice plan one tap away |
  | Season start | Schedule | Full season laid out; dues/expenses fuller |
  | Mid-season | Overview | One-thing card + six tiles, game this Saturday |
  | Season's End | Season Wrapped / Season's End door | Closed year, recap, archive browsing |
- **Look-don't-touch:** everything browsable; editors work on screen (client state) but any save
  is intercepted with the sales nudge: "Not saved in the sandbox — start your own team free to
  keep this." (exact copy via /marketing at build).

## Architecture

**Not a time machine — five parallel teams.** One permanent demo org, one demo coach account
(head coach), **five teams frozen at different lifecycle moments** under it. The phase dock
navigates between teams. Each team's data is anchored *relative to today* (mid-season team always
has a game this Saturday; tryout team's tryout is always today, mid-scoring) and a **nightly
re-anchor/reseed job** shifts dates and restores canonical state.

Components:

1. **Demo session entry (new auth surface — build deliberately).**
   A dedicated route (e.g. `/try/coaches`) that server-side establishes a session for the ONE
   fixed demo Supabase user and redirects into the portal. Constraints: demo user id hardcoded
   allow-list (never parameterized), no `next`/redirect params, origin via
   `resolveTrustedAppOrigin` (auth-email gotcha), rate-limited via `lib/rate-limit.ts`.
   Blast-radius argument: this session can only ever see the fictional demo org. Rejected
   alternative: a cookie-less read-only render path — would fork the coach layout plus ~53 API
   routes that all assume a session.
2. **Central write block.** In `proxy.ts` (the funnel for `/coaches` and `/api/coaches`):
   requests for the demo org with non-GET methods get a structured `sandbox: true` JSON
   rejection. One chokepoint, zero per-route edits. Client save paths surface the nudge on that
   response (one shared fetch-layer hook, not 53 edits — verify feasibility at build; fall back
   to a generic toast). Concurrency is thereby solved: all visitors share one account but nobody
   can write, so nobody can clobber.
3. **Outbound silence.** Demo org short-circuits at the `notify()` chokepoint and the email send
   path — "Email families" composes but can never send. Guardian emails in seed data are
   `@example.com` fictional addresses regardless (defense in depth).
4. **The seed (the long pole).** One idempotent script (patterned on
   `scripts/seed-uat-coach-fixture.mjs` + `seed-free-tier-org.mjs`) creating org + coach user +
   five teams with per-phase datasets:
   - **Tryout day:** active year, roster-in-formation, tryout event TODAY with 2–3 evaluator
     sessions, partial per-evaluator scores + notes (include one deliberate split-opinion),
     offer/waitlist not yet decided.
   - **Off-season:** budget plan + logged expenses, dues schedules with some installments paid /
     one overdue, partial schedule of off-season practices, 2 practice plans (one with stations/
     rotation), development goals + a completed session.
   - **Season start:** full schedule, roster complete with jerseys/positions, dues mostly
     current, first lineup saved, attendance for early events.
   - **Mid-season:** the richest team — record ~14-3-1, game this Saturday (one-thing = lineup
     not set), attendance history with a dip, playing-time data (fairly-even with one outlier),
     arm-care data, insights that fire, 1 unsigned waiver, $ outstanding across 2 families.
   - **Season's End:** a prior program year taken through the REAL season-close lifecycle
     (binding: archive content flows only through `APPROVED_ARCHIVE_DOORS` /
     `APPROVED_SEASON_AWARE_ROUTES`; no hand-written "closed" states the app can't reach; no
     list edits — demo uses already-approved doors only). Season Wrapped + family-recap preview
     populated.
   All persons fictional (existing convention: fictional first names, fictional surnames, no
   real contact data). Time-relative anchoring throughout; script refuses to run against prod
   ids other than the dedicated demo org.
5. **Nightly re-anchor cron** (existing scheduled-jobs pattern): re-run the seed's anchor pass so
   "today" stays true; full reseed weekly or on-demand.
6. **Phase dock UI:** portal-level component rendered only for the demo org; five moments; also
   carries the "Start your own" CTA. Small guided-tour chips per phase (Phase 3, optional).
7. **Marketing doors:** "See it live" beside "Start free" on /for-coaches hero + the homepage
   Head Coach card (copy via /marketing; this is a GTM move — offer /strategy logging when the
   door ships). Demo org excluded from /discover, admin metrics, and observability alert noise.

## Rollout

- **Phase 1 (launch):** machinery (entry, write block, silence, dock, cron) + **three moments:
  Tryout day, Mid-season, Season's End** (most differentiated; covers recruit-a-coach season).
- **Phase 2:** add Off-season + Season start datasets.
- **Phase 3 (polish):** per-phase guided-tour chips; "what parents see" preview stop; QR/share
  collateral for in-person pitching.

## Risks & notes

- Season's-End fidelity: producing the closed year through the real lifecycle inside a seed
  script is the trickiest seed work — budget time for it; do NOT shortcut with hand-written rows.
- The demo coach account is shared by all visitors simultaneously — acceptable ONLY because
  writes are centrally blocked; any future "let them save something" idea reopens concurrency
  and needs its own design.
- Founding-season free pricing means no billing bypass needed until 2027-01-01; the demo org
  needs a permanent comp decision before then (note for /strategy).
- Nightly job failure = visibly stale demo ("tryout was yesterday"); alert on cron failure.
- These five teams double as permanent internal QA/UAT fixtures and screenshot sources — build
  the seed to be reusable for that (clean module boundaries per phase).

## Owner decisions (non-blocking, wanted at build)

1. Demo org/team naming (fictional-obvious vs. realistic; "Riverdale Ridge" convention exists).
2. Save-nudge copy (draft above; /marketing pass).
3. Whether the dock also offers "what parents see" at launch or Phase 3.

## Effort

L overall. Machinery ≈ M; the five-phase seed is the long pole (≈ M on its own, Season's End the
hardest slice). Phase 1 (three moments) is most of the machinery + the three richest datasets.
