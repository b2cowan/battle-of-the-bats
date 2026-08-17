# Families Book — Phase 1 build prompt

Paste this into a fresh chat. **Read the plan and this prompt, then verify §4 before writing anything.**

---

## Your task

Build **Phase 1 only** of `docs/projects/active/CLUB_FAMILIES_BOOK_PLAN.md`.

**Phase 1 = create the family records and show nobody.** No UI. No route. No nav entry. Nothing in the product reads any of it. It ends with a report the owner and I read together.

Read first:
- `docs/projects/active/CLUB_FAMILIES_BOOK_PLAN.md` — the plan (§3 model, §4 matching rules)
- `docs/projects/active/CLUB_FAMILIES_BOOK_PM_BRIEF.md` — why this exists
- Finding #35 in `docs/agents/db/DB_ARCHITECTURE_REVIEW.md` — the evidence
- Mockups (later phases, context only): `claude.ai/code/artifact/f089153c-8583-4c5c-b8c3-d70c5278602b`

---

## 1. Scope

**In:**
1. `org_people` — org-scoped person record (plan §3.1).
2. `org_person_emails` — current + former addresses, all searchable (plan §3.2).
3. Nullable `person_id` on `rep_roster_players`, `rep_tryout_registrations`, `league_registrations`, `family_links`.
4. **`org_id` on `league_registrations`** (NOT NULL after backfill, indexed) — it has none today and reaches org 2-hop.
5. A **backfill** that mints people from the four sources and attaches `person_id`, applying §4's matching rules.
6. A **report script** producing the exit-criterion numbers (§3 below).
7. One shared **email normalizer** used by every write path (plan §4, last bullet).

**Out — do not build:**
- Any screen, route, nav entry, or API endpoint.
- The Families capability (Phase 2).
- Merge/duplicate *resolution* (Phase 2). Phase 1 only *detects and counts* candidates.
- Anything from Phases 3–5.
- `basic_coach_team_players` as a source — see §4.

---

## 2. Owner decisions (settled — do not reopen)

- **Tiers: Club AND League.** League is first-class, not a follow-up.
- **Access: a dedicated Families capability, off by default.** Not needed in Phase 1 (no UI), but do not design anything that assumes plain admin access.
- **Actions live inside the Families area** (Phase 3). Binding constraint for later: an action writes through the **same code path** as the existing surface — two doors, one mechanism. Do not fork a write.
- **Org-scoped, never platform-wide.** The same parent at two clubs is deliberately two records.
- **Household balance is assembled live**, not stored (revisit only if measured slow).
- Naming: the area is **Families**. `module_members` is already taken and means staff.

Still open, **not needed for Phase 1**: whether a coach sees a cross-team hint; whether families ever see their own record.

---

## 3. Exit criterion — this is the deliverable

Phase 1 is not "the migration ran". It is **a report the owner reads and approves**:

- Families created, per org, split by source.
- **Suspected duplicates** — pairs matching on surname+phone or surname+shared-child but *not* on email.
- **Children not confidently attached** — source rows whose guardian email was missing, malformed, or shared across obviously different families.
- Guardians whose email appears in **more than one source** (the cross-module wins — these are the families the whole project exists to reveal).
- Anything that looks wrong to you. Say so plainly.

**If those numbers look wrong, we fix matching before Phase 2 exists.** Do not proceed to any UI work. Do not treat a clean run as approval.

---

## 4. ⚠ Verify these before writing code — the plan has already been wrong three times

This repo's handoff prompts have been corrected by the code repeatedly. **Argue from the schema, not from this document.** The plan's §3.3 was rewritten on 2026-08-17 after exactly this check; assume more remain.

Already corrected (do not re-introduce):
- ❌ **`family_links` is NOT the relationship table.** `rep_team_id` is **NOT NULL**, so it is rep-team-bound and cannot represent a house-league child. It keeps its current job (portal access) and merely gains `person_id`.
- ❌ **`basic_coach_team_players` is NOT a source.** `basic_coach_teams` has **no `org_id`** — the free coach product hangs off `team_workspaces`. An org-scoped person record has no org to attach those rows to.
- ❌ **`league_registrations` has no `org_id`.** 2-hop via `season_id → league_seasons.org_id`.

Verify yourself before building:
1. The exact guardian column names on each of the four sources, from the **snapshots or `information_schema`** — never from migration files (they mislead in a drifted DB).
2. Whether `rep_tryout_registrations` guardians should mint people at all, or only on acceptance. A candidate who never made the team is still a real person, but check whether that is wanted before creating records for every tryout.
3. Whether any existing code already normalizes emails, and reuse it. `early_access_leads` stores a normalized column; `family-guardian.ts` normalizes in application code only. **One normalizer, used by both.** Do not add a third.
4. RLS posture on the two new tables — service-role-only, `ENABLE ROW LEVEL SECURITY` with **no policies** (mig 091 / Finding #30 posture), unless you can show a client read path exists.

---

## 5. ⚠ Concurrent work — check this FIRST

At the time of writing another session had **49 files in flight**, including two that collide with Phase 1:

- `docs/agents/db/DATA_DICTIONARY.md` (modified, uncommitted) — **any schema change must update this file**, and you cannot stage half a file. Editing it while another session holds edits means committing their unfinished work with yours.
- `supabase/migrations/247_club_money_belongs_to_a_season.sql` (untracked) — adds `rep_team_payment_requests.program_year_id`, which is currently **undocumented and failing `check:dictionary`**. That failure is theirs, not yours; do not "fix" it by documenting their column.

**Before you start:** run `git status --porcelain`. If the dictionary is still dirty, that is a **coordination point, not a code problem** — say so to the owner and ask whether to wait. Do not silently commit another session's work.

Standing rules: work on `dev`; re-check the branch before committing; stage **explicit pathspecs only**, never `git add -A`; after committing run `git show --stat HEAD` and confirm only your files landed.

---

## 6. Definition of done

- Migration applied to **dev only**; prod is a separate explicit owner step.
- `DATA_DICTIONARY.md` updated **in the same unit of work** (subject to §5).
- `npm run refresh:snapshots` run and committed.
- `npm run check:indexes` passes — every new `org_id` leads an index (mig 249 gates this now).
- `npm run typecheck` and the test suite pass.
- The §3 report produced and **handed to the owner**, with your own read of whether the numbers look right.
- Nothing user-visible has changed. If a screen moved, you have overbuilt.

Offer `/simplify` then `/review` before calling it done. Skip `/docs` — no user-facing flow changed.

---

## 7. What matters most

The riskiest thing in this whole project is **minting person records from drifting email addresses**. Everything else depends on that being right.

Two rules carry it, and both are in plan §4:
- **Auto-match on exact normalized email only. Never auto-merge anything else.** A wrong merge shows one parent another parent's children — worse than leaving duplicates.
- **Where preferences meet, the strictest wins.** Phase 1 does not merge, but the backfill must not let a person inherit a *weaker* contact preference than any of its source rows. A "newest wins" default would silently re-subscribe people who asked not to be contacted — the exact failure this project exists to prevent.

If you find that the matching produces messy results, **that is a successful Phase 1**, not a failed one. Report it.
