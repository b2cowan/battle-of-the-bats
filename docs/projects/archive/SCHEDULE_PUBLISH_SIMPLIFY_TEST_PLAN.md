# Schedule Publishing Simplification — Step-by-Step Test Plan

> Branch: `fix/fp3-volunteer-dayof` (has the two-state code + migration 129). Dev DB already migrated.
> Companion to `SCHEDULE_PUBLISH_SIMPLIFY_PLAN.md`.

> **Verification status (2026-06-15):** Logic + data layer verified by agent — live DB constraint
> rejects `published_teams`/`published_generic` and accepts `published` (check-violation 23514);
> publish writes `is_closed:true` atomically; reopen clears visibility server-side; the publish
> modal has zero `nameMode` refs (radio gone); public schedule/game-detail/OG/coach-portal have
> zero `published_generic` branches. **Visual/pixel pass (modal layout, banner absence on the
> rendered public page) is the remaining human step** — the agent confirmed behavior, not pixels.

## What you're verifying (one sentence)
Publishing a schedule no longer offers a "placeholder names" choice — it always publishes real team names and closes registration, and reopening registration takes the schedule back offline.

## Pre-flight (already done by agent, listed so you can re-confirm)
- [x] On branch `fix/fp3-volunteer-dayof`.
- [x] Dev server restarted with a clean `.next`; "✓ Ready"; login page returns 200, no Supabase EACCES.
- If you need to restart yourself: stop the server → `rm -rf .next` → `npm run dev` → wait for "✓ Ready".

## Test accounts & data (dev)
- **Org admin login:** `owner@dev.local` / `devpass123` (org `dev-test-org`, plan = Tournament Plus, so the email-notify step is available).
- **Primary test tournament:** **Crimson Cup** → admin at `/dev-test-org/admin/tournaments/branded-light/schedule`, public at `/dev-test-org/branded-light/schedule`.
- Its divisions at the start (dev data): `U13` unpublished+open, `U15` unpublished+open, `U11` published+closed, `U18` **published+OPEN** (a legacy contradictory row — see Test 8).
- A second coach login for Test 5: any accepted coach in a published division (use `/coaches` with a coach account, or check the team's coach email on the U11/U18 division).

> Tip: if you'd rather start clean, re-seed Crimson Cup with `node --env-file=.env.local scripts/seed-crimson-8team.mjs` (creates unpublished divisions) — optional.

---

## Test 1 — Publish modal has NO placeholder option (the core change)
1. Log in as `owner@dev.local`, go to `/dev-test-org/admin/tournaments/branded-light/schedule`.
2. Select the **U13** division (unpublished, registration open). Click **Publish**.
3. **EXPECT:** The modal has **no "Team Names" section and no "Placeholder names / Real team names" radio.** (This is the bug from the screenshot — it must be gone.)
4. **EXPECT:** The description reads "…will appear on your public tournament page **with real team names**."
5. **EXPECT:** Because registration is open, an inline note: "Registration for U13 is still open and **will be closed when you publish**."

✅ Pass if there is no name-mode choice and the copy mentions real names + closing registration.

## Test 2 — Publish closes registration atomically (review fix)
1. From Test 1's modal, click **Publish**.
2. **EXPECT:** A confirm screen appears with the button **"Close Registration & Publish."** Click it.
3. **EXPECT:** Success state "Schedule Published!" The header status dot reads just **"Published"** (no "· names hidden").
4. Go to `/dev-test-org/admin/tournaments/branded-light/registrations`, select **U13**.
5. **EXPECT:** U13 registration is now **Closed**.

✅ Pass if publishing always leaves the division closed (this is the invariant the server now enforces — even if the close step had hiccuped).

## Test 3 — Public schedule shows real names; unpublished shows "coming soon"
1. Open the public page `/dev-test-org/branded-light/schedule` (incognito or logged out is fine).
2. Switch to the **U13** division (just published).
3. **EXPECT:** Games show **real team names** — never "Team 1 / Pool A Team 2". A bye or unseeded bracket slot may still show **TBD** (that's correct).
4. Switch to **U15** (still unpublished).
5. **EXPECT:** "Schedule coming soon" — and **no** "matchups will be announced soon" banner anywhere.

✅ Pass if published = real names, unpublished = coming soon, no placeholder banner.

## Test 4 — Game detail + shareable preview
1. On the public U13 schedule, click into a single **game** (`…/schedule/<gameId>`).
2. **EXPECT:** Real team names on the game detail page.
3. (Optional) View the social-preview image at `…/schedule/<gameId>/opengraph-image` — real names.

✅ Pass if the deep-linked game page shows real names.

## Test 5 — Coach portal shows real opponents
1. Log in as an accepted coach in a **published** division (e.g. a U11 team coach), go to `/coaches` → that tournament.
2. **EXPECT:** Games list shows **real opponent names** (TBD only for genuine byes). The tournament card is in the "schedule live" state.

✅ Pass if the coach sees real opponents for a published division.

## Test 6 — Publish email has no placeholder caveat (Tournament Plus)
1. Back as `owner@dev.local`, publish another division (e.g. **U15**) with **"Notify registered teams by email"** checked.
2. Check the resulting "Your schedule is live" email (Resend dashboard / the accepted team's inbox).
3. **EXPECT:** It says **"Your team name appears on the public schedule."** with **no** "displayed as placeholders until registration closes" line.

✅ Pass if the email has no placeholder caveat.

## Test 7 — Reopen registration takes the schedule offline (review-fix mirror)
1. Go to `/dev-test-org/admin/tournaments/branded-light/registrations`, select a **published** division (e.g. **U13**).
2. Click to **reopen** registration.
3. **EXPECT:** A confirm dialog: "This division's schedule is published. Reopening registration will **take the public schedule offline (back to 'coming soon')**…" Button reads **"Reopen & Unpublish."** Confirm.
4. **EXPECT:** Registration is open again, AND the public `/dev-test-org/branded-light/schedule` for U13 now shows **"Schedule coming soon."**

✅ Pass if reopening unpublishes the schedule in one action.

## Test 8 — Legacy "published + open" division (edge case from real dev data)
> Crimson Cup's **U18** started as published BUT registration open — a state created under the old system that the new model disallows. This is harmless to read (it shows real names), but worth a sanity check.
1. View U18 publicly → real names show (fine).
2. On the Registrations page, reopen→re-close or republish U18.
3. **EXPECT:** After any publish action it ends up **closed**; after any reopen it ends up **unpublished**. The contradictory state resolves itself the moment an organizer touches it; no error.

✅ Pass if touching the legacy row resolves it cleanly (no crash, ends in a consistent state).

## Test 9 — Slot-mode draft stays internal (planning tool preserved)
1. On the admin schedule page for an **unpublished** division, open the **Generator** and choose **slot mode** (placeholder-based draft).
2. **EXPECT:** It still builds a draft schedule; helper copy frames it as a **draft** ("assign real teams… then publish with real names once registration closes").
3. Confirm the draft's placeholder names do **not** appear on the public page (the division is still unpublished → "coming soon").

✅ Pass if slot-mode drafting works for planning and never leaks placeholders publicly.

---

## If anything fails
Note the test number + what you saw vs. expected. Most likely failure causes to check first:
- Still seeing the placeholder radio → browser cached the old page (hard-refresh) OR not on `fix/fp3-volunteer-dayof`.
- A division won't publish / 400 error → check the dev server log; the API now rejects any visibility other than `published`.

## Release sequence — migration + deploy MUST be tightly coupled (owner decision 2026-06-15)
The live prod code (on `master`) still writes `published_teams`/`published_generic` on publish.
Once mig 129 tightens the CHECK, those writes are **rejected** — so publishing a schedule on
prod would FAIL in any window where the migration is applied but the new code isn't deployed yet.
Prod currently has **1 division** (`published_teams`, low traffic), so the window risk is small,
but the owner chose to **apply the migration at release time, immediately before the deploy**,
not days ahead. Do these in order, back-to-back:
- [ ] 1. Apply mig 129 to prod: `node scripts/apply-migration-api.mjs supabase/migrations/129_schedule_visibility_two_state.sql --prod`
- [ ] 2. **Immediately** deploy the new code to master (the two steps should be seconds apart, not days).
- [ ] 3. `node scripts/refresh-db-snapshots.mjs` (prod snapshot should now show `('unpublished','published')`).
- [ ] ⚠ `check:migrations` stays GREEN whether or not mig 129 is applied — it diffs only tables/columns, NOT CHECK clauses, so it is BLIND to this migration. Do **not** rely on it; the apply is a deliberate manual step. Prod data impact when you do apply: 0 `published_generic` rows (nothing reverted), 1 `published_teams` → `published` (harmless rename).
