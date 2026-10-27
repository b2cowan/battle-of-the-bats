# Support console · Stage 7 · the finish pass (prompt 1 of 3 — run FIRST)

> Paste into a new chat on `dev`. Written 2026-10-27 by the Stage 7 build session. Order of the three prompts: **this one,
> then the walks (`…_STAGE7_WALKS_PROMPT.md`), and the Part 8 prompt (`…_STAGE7_PART8_PROMPT.md`) whenever the owner
> chooses** — the finish pass runs before the walks so the owner never walks code a review then changes. Shared working
> copy (Club Tier, Bookkeeping and others): explicit pathspecs, branch check before every commit, `git show --stat HEAD`
> after. Commit nothing without the owner's OK. This prompt is a lead, not evidence: open the lines before you act.

## What exists (committed 2026-10-27)

Plan section **"Stage 7 build (2026-10-27)"** in `PLATFORM_ADMIN_SUPPORT_CONSOLE_PLAN.md` is the record: commits
`c6e3d3720` (Part 0) · `978b645fb` (mig 398, dev) · `c1c195f9b` (one definition) · `90d1f8408` (Leads) · `3d3cb8f98`
(words and places) · `99833214a` (help) · `56e137554` (two read fixes). Build prompt: `…_STAGE7_BUILD_PROMPT.md`.
Part 0's walk §394 is done (21/22, 1 Held). Part 8 (the public form) is NOT built.

The code: `lib/lead-numbers.ts` (pure one definition), `lib/lead-book.ts` (reads + the offered match),
`lib/lead-views.ts`, `lib/lead-numbers-view.ts`, `lib/lead-timeline.ts`, `lib/lead-writes.ts`, `lib/export/formula-safe.ts`;
`app/platform-admin/early-access/` (LeadsScreen, `[leadId]/` LeadRecord); `app/api/platform-admin/early-access/**`;
`lib/platform-waiting.ts` (Today), Business numbers' card, `lib/platform-story.ts` (lead rows filtered),
`lib/platform-audit-reason.ts` (`LEAD_ACTIONS`, `hiddenEntryLine`), Pitch decks (`app/platform-admin/pitch-deck-studio/`,
restyled by a helper and spot-checked only). Guards: `tests/unit/support-console-stage7-{guard,numbers,audit-guard}.test.ts`.

## Do, in order

1. **`/simplify`** over the Stage 7 diff (`git diff c6e3d3720~1..56e137554 -- lib app tests`, excluding other sessions'
   commits in that range — filter by the `support-console-s7` commit subjects). Likely candidates, verify each: the
   staff-address set is built three times (`lead-book.ts` readOffers, `lead-writes.ts` refusedClub, the clubs route);
   `token()` / filter parsing exists in three places (Leads page, `listFromParams`, numbers-export); `planWords` is
   re-exported from `lead-numbers-view.ts` for no reader. Behaviour must not change.
2. **`/review`** with the **privacy lens** first (the build prompt §10): Part 0's filter, the offered match (threats 5–6:
   who can be offered, what refuses when unread, `selfConfirmed`), the export and Copy emails (audit before file,
   formula safety, "Asked not to be contacted"), the Story filter, every route's power-before-read. Then correctness:
   - Known soft spots to check, not assumed bugs: `readAccounts` calls `isDemoOrgId` per org in a loop (cached, but
     confirm it stays cheap); `readLeadBook` reads the whole lead edit log on every Leads/Today load (fine at today's
     volume — say when it would not be); Today's lead rows run `readOffers` (several queries) inside the 30 s snapshot;
     `unlinkLead` reads the link's audit entry to find the step to go back to (falls back to Pilot); the lead page's
     `meta` line and timeline page names for "Other pages".
   - Pitch decks: diff it against the pre-restyle behaviour (commit `3d3cb8f98`), every save/publish path.
   Fix what is real; record what is not in the plan's Stage 7 build section as "reviewed, kept, because …".
3. **`/docs`**: the console help beyond the two articles already written (Leads, the Audit log line): Today's growth
   rows, Business numbers' card and its menu place, Campaigns' line, Promotions in Plans & pricing, Pitch decks' New deck
   window and Publish rule. Keep `keywords` / `searchText` in step; one spelling (`check:spelling`).
4. Verify: `npx tsc --noEmit`, `npx eslint` on changed files, the three Stage 7 guards plus
   `support-console-stage2/3-guard`, `platform-admin-stage1-guard`, `plan-reader-door-guard`,
   `platform-audit-reason-guard` (run with `node --import ./tests/ts-resolver.mjs --test …`, never `npm test` while
   another session may be mid-walk). Then the read-only render probe: `node --env-file=.env.local
   .probe/pasc/s7-render.mjs` (password sign-in as dev staff, GET only) — it must print "all good".
   ⚠ The layout sweep covers only four console screens and its saved console session is stale; do not refresh
   `tests/uat/.auth/*.json`.
5. **Records:** the plan's Stage 7 build section (what the finish pass changed), `TODO.md` (one line for S7 pointing at
   the plan), the PM brief's Stage 7 paragraph (built; walks next), and the support-console hub index if this session
   has its URL (`stages/s7`: "Built `<hash>` 2026-10-27"). Auto-memory `project_platform_admin_support_console.md`.

## Do not

Build Part 8 or touch the public form (prompt 3). Change the rulebook (`PLATFORM_POWERS`), shared automation, watched
scripts, `proxy.ts`, or production. Write either database from a probe. Reopen an owner ruling (plan "Owner rulings
2026-10-27 (Stage 7 drawings)" and the build gate answers under it).
