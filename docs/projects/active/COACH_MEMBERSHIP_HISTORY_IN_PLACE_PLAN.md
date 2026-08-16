# Coach membership & history-in-place — Design A on M1

**Status:** APPROVED 2026-08-16 (owner), not yet built. Build begins with Phase 1.
**Decision record:** mockup artifact `aa758bcb` (R1, §10 verdict) — owner accepted the recommendation
verbatim: **Design A** (the season toggle and archive-place are deleted; history is delivered inside
live tools + Season's End) on **M1** (staff membership lives on the TEAM, not on season rows).
**PM brief:** `COACH_MEMBERSHIP_HISTORY_IN_PLACE_PM_BRIEF.md`.
**Supersedes:** `COACH_CURRENT_STAFF_ACCESS_PLAN.md` (its rulings are absorbed here; its
"latest-season-rows" access definition is replaced by M1 — see §2), the Chunk F frozen-season
architecture, and the archive-rail season-toggle work (`COACH_ARCHIVE_RAIL_PLAN.md` Phases 1–2's
season-switching half; its live-season defect fixes are KEPT — see §6.3).

---

## 1. The owner rulings this plan is built on (all 2026-08-16 unless noted)

1. **Design A**: no season toggle, no archive menu, no frozen-season portal. History reaches a coach
   three ways only: Season's End / Season Wrapped / the every-season compare list; the six existing
   surgical surfaces; and named in-tool shelves (v1: practice plans + money book).
2. **M1**: membership (role + capabilities + active/revoked) attaches to the person-on-the-TEAM.
   Seasons keep a staff *record* (who coached that year) that grants nothing and is never managed.
3. **Removal revokes access without deleting the record** (ruled with the earlier plan; unchanged).
   Re-adding restores access.
4. **Capabilities are the coach's current ones, everywhere** (ruled earlier; unchanged — and under
   M1 there is only one set of capabilities anywhere, so the rule holds by construction).
5. **v1 reference pieces = Practice plans shelf + Money past-season book.** Everything else ships
   with NO historical access until a real moment names it.
6. **⚠ NEW — per-screen planning gates:** each history shelf (practice plans, money, and any future
   piece) gets its **own detailed planning session with mockups, approved before build**. Binding
   design constraint for those sessions: **the current season is always the primary focus** — the
   historical layer must be quiet (below the live content, collapsed/on-demand, never default-open,
   never stealing the page's first read). A shelf that makes the live screen noisier is a failed
   design regardless of how useful the history is.
7. Standing rulings that survive unchanged: playing-time analytics are PERMANENTLY live-only
   (2026-08-16); drill/plan-template libraries, opponent scouting book, club shared book are
   instruments and never become archive surfaces (2026-08-01/04); Season Wrapped carries no money
   and no PII beyond first-name+number.

---

## 2. The M1 data model

New table (migration — take the next free number at build time):

```sql
rep_team_staff_memberships (
  id uuid pk,
  org_id uuid not null references organizations,
  team_id uuid not null references rep_teams,
  user_id uuid not null references auth.users,
  coach_role text not null check (coach_role in ('head_coach','assistant_coach')),
  capabilities jsonb,              -- null = role defaults, same semantics as today
  status text not null default 'active' check (status in ('active','revoked')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz, revoked_by uuid,
  unique (team_id, user_id)
)
```

- **Backfill:** one membership per user from their row on each team's LATEST program year (any
  status). Users holding only older-season rows get NO membership — that is the point (ex-staff
  lose access the day this ships). No live clients; no compatibility shim.
- **`rep_team_coaches` becomes the season RECORD + live-season projection.** Closed seasons' rows
  are never touched again (they are the "who coached 2024" fact). The LIVE season's rows are
  maintained as a mirror of active memberships (dual-write on add/remove/role-change) so the ~54
  write routes that resolve `getCoachingAssignmentsForUser` → active-year row keep working with
  ZERO edits. ⚠ The mirror is a projection, not a source: nothing may ever READ capabilities from a
  row when a membership exists — capability resolution goes through membership only.
- **Rollover** (both paths): stops copying staff as an access act; instead it (a) writes the new
  season's record rows FROM active memberships (so the new season names its staff and the write
  routes see their rows), and (b) never touches capabilities — the yearly silent reset of custom
  grants dies here. The org-admin manual per-year coach add/remove becomes membership add/remove
  (admin UI touches this — see §5 P1 scope).
- **Access rule, one sentence:** *a signed-in user may open a team iff they hold an ACTIVE
  membership on it; what they see is their membership's capabilities; the working season is the
  team's latest program year regardless of status; a completed/archived working season renders
  read-only.* This single rule replaces the live lookup, the closed lookup, the season-read rail's
  gate, and the per-season capability map.

## 3. What gets deleted (Phase 2)

- `lib/coach-season-read.ts` (the rail) and every `?year=` read in the ~30 approved routes — they
  revert to working-season resolution. The tag factory's `seasonAwareRead` flag goes.
- `CoachSeasonChip`, the sidebar season `<select>`, the phone "More" season list, the masthead
  archive branch, `CLOSED_TEAM_NAV_ITEMS` / `CLOSED_SECTION_EXTRAS` / `LIVE_ONLY_ARCHIVE_SECTIONS` /
  `archiveHasSection` / `resolveSeasonSwitchHref` and the `?year=` plumbing in `coach-season-view`
  (the page resolver itself survives, simplified to live+working-season duty — ~30 live pages
  import it).
- The `history/*` pages' `isRecord` halves. The live Insights hub, results report, awards report,
  attendance report, and the compare list + Season Wrapped links all SURVIVE as live-season
  surfaces.
- `season-end/page.tsx` SURVIVES (post-season landing + look-back door + start-next-season); it
  stops being reachable via a season dial and is reached by: automatic landing when the working
  season is closed, and per-year links from the compare list.
- The scrapbook head-coach-only restriction `12cf1b19` is reverted (11 files, +254/−12) and ledger
  §37 D2 retires with it (already ruled).

## 4. Tests: rewritten, never deleted (the standing lesson)

- `coach-season-write-guard.test.ts` → **`coach-history-endpoint-guard.test.ts`**: same fs-scan
  mechanism, new contract: (1) NO route under `app/api/coaches` may read a season/year parameter or
  resolve a non-working season EXCEPT the enumerated `HISTORY_ENDPOINTS` allow-list — initially
  `{wrapped, history (compare list), events/[eventId]/practice-plan/read}`, growing only via the
  gated shelf phases; (2) every write verb still resolves an inspectable body (vacuous-pass guard
  kept); (3) the decided-absence blocks (drills, templates, opponents, club book, playing-time)
  survive re-worded — they now assert those modules never join HISTORY_ENDPOINTS; (4) history
  endpoints gate on ACTIVE MEMBERSHIP, asserted by source scan.
- `coach-archive-season-rail.test.ts` → deleted WITH its assertions redistributed: the stale-request
  generation-counter probes and the awards-scoping probe move to a live-season unit test; the rest
  asserted season-switching and dies with the feature, stated in the commit message.
- `coach-frozen-season-smoke.spec.ts` → **`coach-membership-smoke.spec.ts`**: revoked member is
  refused everywhere at the API (the old rule-3 probe, re-aimed); re-add restores; the
  between-seasons limbo state keeps every nav door working (the state that breaks Settings /
  Announcements today); Season's End reachable + read-only working season draws no write controls;
  Wrapped/compare gated by membership + current capabilities.
- ⚠ The rendered layout fixture has NO completed season — that gap hid the original defects and
  would now blind the Season's End / compare / shelf surfaces. Phase 2 adds a completed season to
  the fixture world.

## 5. Phases

- **P1 — Membership (M1).** Migration + backfill; `lib/coach-membership.ts` (the one access rule);
  staff screen de-seasoned (one list, Remove revokes everywhere with the new dialog copy, re-add
  restores); invite/accept + org-admin coach management write memberships (+ live-row mirror);
  rollover writes record rows from memberships; Settings + Announcements (and any other bare
  live-assignment page found by sweep) move to the uniform rule; player-documents endpoint gains
  the membership gate. Fixture probes for revocation rewritten. **No archive changes yet** — the
  rail temporarily gates on membership (one-line change) so nothing leaks between phases.

  **P1 build state (2026-08-16, this session): ✅ COMMITTED `8415dcd2`** (68 files; the money-tab
  session's concurrent edits were hunk-excluded from the three shared files). Everything above is
  BUILT except the tail below. **P2 handoff prompt:**
  `docs/projects/active/COACH_MEMBERSHIP_P2_ARCHIVE_REMOVAL_PROMPT.md`. Mig 245 APPLIED to dev (+dictionary +snapshots); typecheck ✓; 2,048 unit
  tests ✓; Staff also LEFT the archive (door, allow-list entries, rule-3 write exception — the
  per-season "remove access" control retired with the model, so keeping the door would have made
  its Remove button lie).
  - [x] **The bare-gate sweep — DONE (12 files + `components/coaches/CoachNotOnTeam.tsx`).**
    One shared component owns the branch (member-with-finished-season → "This season has
    finished" + Season's End link; everyone else → the honest not-assigned). Applied to:
    `accounting/allocations/panel`, `accounting/payment-requests/panel`, `development/drills`,
    `development/templates`, `development/templates/[templateId]`, `history/opponents`,
    `history/opponents/[opponentKey]`, `history/playing-time`, `lineups/templates/[templateId]`,
    `lineups/[eventId]`, `practice/[eventId]`, `practice/[eventId]/run`. (`game/[eventId]` was a
    false positive — it reads assignments only for the sport pack and has no gate sentence.)
    Announcements + Chat keep their bespoke notes (surface-specific copy).
  - [x] **`/simplify` run 2026-08-16 (4 lenses), 18 findings applied, all green after
    (typecheck ✓ · 2,057 tests ✓ · lint 0 errors).** The keepers: `resolveWorkingProgramYear` +
    `requireHeadCoachMembership` extracted (the working-season fallback and the head-coach gate
    each had 3-4 hand copies); one shared identity-enrichment recipe in db.ts; membership add is
    one upsert; every "fetch the list to find one row" became a point query on the
    `(program_year_id, user_id)` unique index; the rail resolves team+year+membership in ONE
    round trip (hot path, ~30 routes); two dead functions deleted
    (`updateRepTeamCoachCapabilities`, `getCoachAssignmentCapabilitiesForTeam`); the season-row
    staff read no longer exposes `capabilities` at all (stale-projection reads now impossible to
    write); **admin's create-year now REVERTS if the staff projection fails** (a draft year is
    live the instant it exists — a silent projection failure made the team look between-seasons
    to its own staff, the altitude pass's one real posture bug); and a new
    `coach-membership-projection-guard.test.ts` makes the projection invariant build-enforced.
    The billing-access guard caught the resolver extraction and its rail list learned
    `requireHeadCoachMembership` — a decision-point edit, exactly as that contract intends.
    **Skipped, with reasons:** collapsing the capability map to a single value (3 callers get
    reworked in P2 anyway — do it there); a copy-override slot on `CoachNotOnTeam`
    (announcements/chat's bespoke notes are pre-existing local chrome; P2 horizon);
    `getOrgAssistantCoaches`' third copy of the enrichment recipe + tryout-report's pre-existing
    double gate (both outside this diff — follow-ups). **Flagged to owner, recorded as intended:**
    a REVOKED former head coach who accepts an assistant invite reactivates as an ASSISTANT —
    the invite names the seat; reactivation restores grants, never the role.
  - [x] **`/review` run 2026-08-16 — high-risk tier, full funnel.** Stage 0 all green or
    attributed (typecheck ✓ · 2,060 tests ✓ · lint ✓ · css-purity ✓ · check:demos ✓ · rendered
    check PASSED scoped to coach-staff + coach-announcements ×4 widths; the --changed full-sweep
    widening aborted at the shared server's memory floor and was rerun scoped — stated, not
    silently skipped; schema-parity red = expected dev-only drift, migs 236–245). Five lenses →
    ~30 findings → adjudicated in the main loop. **Confirmed & FIXED same day:**
    · CRITICAL — new standalone-team provisioning minted the coach row but NO membership: every
      new signup 403'd from Settings/staff/seasons/documents from minute one. Provisioning now
      goes through `addStaffMember` and reads the projected row back.
    · HIGH — remove-vs-readd race could strand a REVOKED coach with a live projection row
      (writes admitted all season, nothing self-heals). Removal now deletes the row FIRST and
      heals on re-click; the sync deletes rows for revoked memberships, tolerates insert
      collisions (23505 → converge), and re-checks the membership after inserting.
    · CRITICAL-mechanism — the live-year lookup swallows DB errors to null; removal/sync now use
      a STRICT resolver that throws instead of skipping the one write that blocks a removed coach.
    · HIGH — season-creation projection collisions used to nuke the whole just-created year
      (cascade) — projection is idempotent now; admin create-year still reverts on REAL failures.
    · HIGH — client/server disagreed on the scrapbook gate ("ever" vs "current" head coach): a
      demoted head coach was shown doors the server wouldn't fill ("None yet" lie). Client now
      derives from the CURRENT role; the rail guard test re-pinned to the new rule.
    · Grants PATCH re-asserts team+active+assistant in its WHERE (check-then-act discipline);
      remove callers surface the removed:boolean; oversight remove verifies role/tenancy against
      the MEMBERSHIP; per-year admin staff endpoints refuse non-current-season years (two-open-
      years misfile); guest-org-membership cleanup asks memberships (its row-based premise
      expired with M1); `{}` grants can't wipe stored bundles; org_id asserted in revoke WHERE.
    · Seeds/fixtures: demo, UAT-fixture, QA-day seeds + create-uat-accounts.sql now mint
      memberships; check-demo-coach asserts an active membership per team; the dangerous help
      article ("Staff on a finished season") rewritten to the new removal semantics; stale
      comments/docs corrected (history route, tryout-memory R8, PHASE2 prompt, dictionary anchors).
    **Deferred with reasons (not silent):** 11 UAT spec fixtures still mint rows without
    memberships — fix before the next `/uat` run: coach-sponsor-money-lifecycle,
    team-tournament-game-mirror-smoke, coach-money-mobile-smoke, family-guardian-tier-boundary,
    family-access-boundary, tryout-blindfold-boundary, coach-record-access-boundary,
    family-recap-boundary, coach-findability-smoke, coach-schedule-smoke, coach-tryouts-smoke.
    Pre-existing, noted for backlog: two-drafts create TOCTOU (admin create guard ignores
    'draft'); staff panel's whole-bundle last-write-wins PATCH (M1 makes clobbers durable —
    consider a version guard); no behavioral/DB test exercises the membership lib (static guards
    + UAT smoke only); multiple head coaches remain representable (pre-M1 too) — owner nuance.
  - [x] Owner-QA ledger **§39** added (three sign-ins + the new-signup pass). `/docs`: the
    load-bearing staff article fixed inline; the full help sweep rides P2, where the archive UX
    changes wholesale.
- **P2 — The place comes out.** Everything in §3 + §4; demo re-script (tour step 7 + dock line +
  `check-demo-coach` section 6 — the 13U world keeps working, landing on Season's End); CLAUDE.md
  archive section REPLACED with the new contract (same unit of work); ledger §36/§37 retired with a
  salvage note (awards-count fix + live-hub regression checks fold into the new QA section); help
  docs updated (`/docs`); old plans moved to archive.
- **P3 — Practice plans shelf. GATED: mockup session first** (ruling §1.6 — quiet-integration
  constraint). Re-homes the read-only past-plan view + copy-forward.
- **P4 — Money past-season book. GATED: mockup session first.** Read-only closed book: budget vs
  actual + money story; money-capability only.
- **Adjacent, logged not built:** wire/warn the settlement-completeness check on season completion
  (books can seal with money outstanding today); documents retention stance → counsel; free-tier
  `basic_coach_*` model untouched by all of this.

## 6. Verification & risks

1. **Lock-out is still the expensive failure.** P1's membership rule must be probed in the limbo
   state (completed working season, no successor) and the mid-rollover state (draft + completed
   coexisting). Both live in the membership smoke.
2. **Dual-write drift:** the mirror row is write-only; add a unit test asserting no reader consumes
   row capabilities when a membership exists.
3. **Shared branch:** stage explicit pathspecs; bracketed dirs need `:(literal)`; check `git diff`
   per file before staging (two sessions have collided here before).
4. `npm run verify:changed` per phase; `npm run typecheck` (shared modules move); migration →
   DATA_DICTIONARY + `npm run refresh:snapshots` in the same unit of work; owner QA sections added
   to the ledger per phase (three sign-ins needed: head coach, current assistant, removed coach).

## 7. QA ledger

P1+P2 get one new ledger section each when built (next free § numbers at that time), replacing the
retired §36/§37 walk. §37 D2 retires now (restriction reverted in P2). The §36/§37 pieces worth
salvaging into the new sections: the awards "N this season" count fix, certificate printing the
award's own season (moves into the shelf-phase QA if awards ever get one; the live awards report
keeps the scoped count), and the live-hub regression checks.
