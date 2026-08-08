# Build prompt — Phase 4: house league gets a real field, before it has data to migrate

**For:** a new chat. Build Phase 4 of `GAME_LOCATION_SOURCE_OF_TRUTH_PLAN.md`.
**Raised by:** owner ruling R3, 2026-08-08
**Status:** ✅ **EXECUTED 2026-08-08** — see the plan's Phase 4 section for what was built and the
two owner decisions taken at build time (org venue library as the field source; one booking pool).
Mig 229 is dev-only; prod application is an owner decision. Kept for the record.

---

## 1 · Read these first

- `docs/projects/active/GAME_LOCATION_SOURCE_OF_TRUTH_PLAN.md` — the whole plan. **§0 corrects two
  premises that look true and are not**; read it before trusting any earlier framing of this work.
- `docs/projects/active/GAME_LOCATION_SOURCE_OF_TRUTH_PM_BRIEF.md` — the owner-facing framing and
  all four rulings (R1–R4).
- `lib/venue-identity.ts` — the module you are reusing. **Read its header comment.** It was written
  module-agnostic specifically so this phase would not have to reshape it.
- Commit `f8ac4503` — Phase 1, for how the tournament side ended up.

## 2 · Why this phase, and why now

House league games and practices have **no venue structure whatsoever** — not typed-versus-picked,
*nothing*. There is no field reference on either table. So a league running all season across shared
diamonds gets **zero double-booking detection**: a weekly exposure, not a tournament-weekend one.

**The window is the entire reason this is cheap.** Measured on the live databases 2026-08-07:

| | dev | **prod** |
|---|---|---|
| `league_games` | 12 | **0** |
| `league_practices` | 2 | **0** |

Zero production rows means the schema decision can be made *before* there is anything to migrate.
The moment one customer schedules a league game, this becomes a migration with customers attached.
That is why it jumps Phases 2 and 3.

⚠ **Re-measure before you start.** Those numbers are days old and the point of this phase evaporates
if they are no longer zero. `node scripts/db-query.mjs --prod -q "select count(*) from league_games"`
(and `league_practices`). **If prod is no longer zero, stop and tell the owner** — the plan changes
from "decide freely" to "migrate carefully", and that is their call, not yours.

## 3 · The ruling you are implementing (R3, binding)

> **House league gets the SAME venue + surface model as tournaments.** Same references, same derived
> display string, same clash detection, from day one.

Explicitly **out of scope**, also ruled: coach team events and tryout sessions (`rep_team_events`,
`rep_tryout_sessions`, `basic_coach_team_events`) stay free text. They are frequently off-site —
a school gym, a rented field — and text is the honest representation. 115 prod rows across 7
distinct strings. **Record that as a decision, not an omission**; it is already written down in the
plan, do not re-litigate it.

## 4 · What "done" looks like

- A league organizer picks a field the same way a tournament organizer does.
- Two league games on the same field at the same time are **caught** — and the schedule-health
  surface for house league says how many games it could not check, exactly as tournaments now do.
- Practices are included. A practice occupying a diamond blocks a game on it, and vice versa —
  a booking is a booking. **Confirm this with the owner if the existing house-league UI treats
  practices as a separate world**; do not assume either way.
- `lib/venue-identity.ts` is reused **verbatim**. If you find yourself needing to change it to fit
  house league, that is a signal Phase 1 got the shape wrong — say so rather than bending it.

## 5 · Hard constraints

- **Migration first, and it is the only phase that has one.** `supabase/migrations/` — the migration
  is task #1 and nothing else starts before it.
- **Schema = dictionary, same unit of work.** The same commit updates
  `docs/agents/db/DATA_DICTIONARY.md` and runs `npm run refresh:snapshots` (dev **and** prod).
  `npm run check:dictionary` fails the build otherwise.
- **Migrations are NEVER auto-applied to production.** Apply to dev; prod is an owner decision.
  ⚠ Dev and prod are schema-identical except migration 226, which is applied **nowhere**. Do not
  widen that gap without saying so out loud in your summary.
- **Decide whether a column exists from the live snapshots or `information_schema` — never from
  migration files.** They mislead in a drifted DB.
- Multi-tenant: league venues belong to an org; nothing may leak across orgs. Phase 1's review
  traced every conflict-engine caller to a single-tournament fetch — **you must do the same for
  whatever you add**, because text matching is looser than id matching.
- Sport-neutral: "field" comes from the Sport Pack (`lib/sports.ts`), never hard-coded.
- One shared `dev` branch. Stage explicit pathspecs only — other agents are working in this tree.
  `[orgSlug]` paths need `:(literal)` or they stage nothing.

## 6 · Open question to resolve early (do not guess)

**Do league fields come from the tournament-style per-event venue tables, or from the org-level
venue library?** A league is an org-level, season-long thing; a tournament's venues are copies
scoped to that tournament. The org-level library (`org_venues` / `org_venue_facilities`, League/Club
plans) exists but has **0 rows on both dev and prod** — so it is unproven, not established.

This is a genuine architecture fork and it is the first thing to settle. Present both options to the
owner in plain language with a recommendation before writing the migration.

## 7 · Sequencing note

Phases 2 (stop new drift at the authoring surfaces) and 3 (resolve the existing typed names) are
still unbuilt and still worth doing. Phase 4 is being pulled forward only because its cost rises
with time and theirs does not. **Do not silently absorb Phase 2 work into this phase** — if house
league needs an authoring surface, build that surface for house league and leave the tournament-side
Phase 2 alone, or the two phases become impossible to review separately.

## 8 · Before you build

Per `AGENCY_RULES.md`, a **plain-language PM summary is a blocking step** — present what a league
organizer sees and does differently, and get agreement, before any code. Then build the whole phase
in one pass rather than trickling it out.

Offer `/review` when done (this touches shared modules and a migration — it is high-risk tier), and
`/docs` if the in-app help describes house-league scheduling.
