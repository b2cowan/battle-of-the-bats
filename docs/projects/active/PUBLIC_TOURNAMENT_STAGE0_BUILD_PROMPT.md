# Public tournament pages — Stage 0, the trust fixes (build prompt, two sessions)

> Written 2026-10-27. Stage 0 of `PUBLIC_TOURNAMENT_SITE_REVIEW_PLAN.md` (§9). **Ruled: Ask 7, build now, ahead of the
> design stages.** No drawings: nothing here changes how a page looks, except a few words. It ships to customers on its
> own; it does NOT go behind the preview switch (that starts at Stage 1).

## How this runs: two sessions, a `/clear` between them

This is split so neither session carries the other's reading. **Run Part 1 in a fresh session, `/clear`, then run
Part 2 in a fresh session.** Each part ends at a clean seam: committed, typechecked, reviewed, its walk written.

| Part | Covers | Why on its own |
|---|---|---|
| **1** | **D1**: an unpublished schedule stops reaching families, on the server, in every public read; the demo seed publishes its divisions | The only heavy one: a census across many reads, a shared gate, a guard test, a production impact check |
| **2** | **D2** "No score yet", **D3** the club fallback chip, **D4** "Starts in", **D7** the Branding page stops dropping the club's colours | Four small, separate fixes |

**Token discipline (owner, 2026-10-27):** nearly all of a session's cost is re-reading its own history, so:
- Read **this prompt and plan §2 (the defect table) and §4a (D7 only)**. Do not read the whole plan, the review hub
  (a 100 KB drawing page; Stage 0 needs none of it), or the findings file.
- Send censuses ("find every public read of games") to a helper and ask for paths + line numbers + a verdict, not file
  dumps. Read only the hunks you will edit. A helper's claim is a lead: open the cited lines before relying on it.
- Prefer `npm run verify:changed`; run `npm run typecheck` once (Part 1 touches shared data reads). Leave the dev
  server running unless a restart rule applies (AGENTS.md).
- At the end of each part, tell the owner in one line that it is a good place to `/clear`, and what carries over.

**Both parts:** work on `dev`; stage explicit paths only; other sessions share this working copy (AGENCY_RULES). Commit
only after the owner says yes. Present the product-owner summary (what a family or organizer sees differently) before
writing code, as AGENCY_RULES requires; for Part 1 it is short, because the visible change is "games you have not
published stop showing".

---

## Part 1 · D1, the publish gate

### The defect (plan §2, D1)
The organizer publishes a schedule division by division. A schedule they have **not** published still reaches
families: the tournament home lists its games and the live-scores ticker shows them, while the Schedule tab says
"coming soon" and a team's page says 0-0-0 with no games. Cause, as recorded 2026-10-24 (line numbers may have
moved; re-find them):
- the home reads games with the admin flag and no publish check (`components/public/TournamentHomeContent.tsx`, ~:51);
- the schedule and scores feeds send **every** game to the browser and the page hides the unpublished ones
  (`lib/public-tournament-data.ts`, ~:174-189), so the draft is in the page source even where it is hidden;
- the team page is already right: it gates on the server (`app/api/public/team-profile/route.ts`, ~:57).
The demo seed never sets the per-division publish setting (`scheduleVisibility`), so the demo shows every symptom.

**It is not a demo problem** (Codex read it as one): any customer with an unpublished division has it.

### What to build
1. **Census first (helper):** every public read of games or results on a tournament: the home, the schedule and
   scores feeds, the ticker, standings and recent scores, the playoffs page, champions, the teams list (record and next
   opponent), a game's page, the team page, share images (`opengraph-image`), the sitemap if it lists games, and any
   `app/api/public/*` route. For each: does it apply the publish setting, on the server? The family and coach reads
   already respect it (`lib/family-view.ts`, `lib/public-team-schedule.ts`, `lib/coach-tournament-*.ts`); reuse their
   rule rather than inventing one. Return a table: read · file:line · gated today (y/n).
2. **One shared rule, applied on the server in every public read** the census finds ungated. Unpublished games never
   leave the server for a public page: not hidden in the browser, absent from the response. Decide, from the existing
   family/coach rule, what a game in an unpublished division counts as for standings and results (most likely: absent,
   as the team page already treats it), and say what you chose in the summary.
   - A tournament with **no** published division then shows no games anywhere public. That is correct (it is what the
     Schedule tab already says), and it is the reason for step 4.
   - The organizer's own preview: if the admin side previews the public pages as staff today, keep exactly what it
     does; do not widen the public rule for staff.
3. **A guard test** in the repo's guard style (`tests/unit/*-guard.test.ts`): the public game reads go through the
   shared rule, so a new public read cannot quietly skip it.
4. **Before committing, a read-only production impact check** (helper, the read-only path in
   `reference_prod_supabase` memory; never a write): how many tournaments that are live or upcoming have games in an
   unpublished division, and how many games. **Report the numbers to the owner and wait for a go.** If any are live,
   their families will see those games disappear from the home and ticker the moment this ships, and the organizer may
   need a nudge to publish. That is the owner's call, not this session's.
5. **The demo seed publishes its divisions** (the riverdale demo's seed and any import it uses). The master build
   re-seeds a demo whose world changed (CLAUDE.md, demo sandboxes); do not re-seed production by hand. Check the other
   seed scripts that set `scheduleVisibility` for the pattern.

### Done when
- Every row of the census table is gated on the server; the guard test passes; typecheck and `verify:changed` pass.
- On dev, with one division unpublished: the home, ticker, schedule, standings, playoffs, teams list, a game's page,
  a team's page and its share image show none of that division's games, and the page source does not contain them.
  Publish it: they all appear.
- `/review` run on the diff (offer it per CLAUDE.md; it is substantive and touches shared reads).
- A QA walk written as a checkable Artifact, one purpose (an unpublished division stays private everywhere), with the
  next free § in `OWNER_QA_LEDGER.md`; the owner walks it. The plan's §9 row and the TODO line record the commit hash.
- **Then: tell the owner it is a good place to `/clear`, and that Part 2 starts from the "Part 2" heading below.**

---

## Part 2 · D2, D3, D4, D7

Part 1 is committed. Do not re-derive it; read only what each fix below names.

1. **D2 · "No score yet".** A game that is live by the clock but has no score prints a lone "–" on the home
   (`TournamentHomeContent.tsx`, ~:322 prints raw nulls). Show **"No score yet"**. Check the ticker and a game's page
   for the same null and fix them the same way.
2. **D3 · the club fallback chip.** For an organization with no club site, the club home's fallback list labels every
   active tournament **"Live"**, even one weeks away (`app/[orgSlug]/page.tsx`, ~:225-227). Use the date-aware chip that
   already exists (`lib/club-site-home.ts`, ~:33-56), with the ruled words (Ask 8): **Live now · This weekend ·
   Registration open · Finished**. One spelling everywhere; `npm run check:spelling` runs in `verify:changed`.
3. **D4 · "Starts in".** "First pitch in 20 days" is one sport's words, in `TournamentNavStatus.tsx` (~:80),
   `TournamentHomeContent.tsx` (~:483, ~:977), `Countdown.tsx`, and a game's page countdown. Make it **"Starts in 20
   days"** everywhere (sport-neutral rule). Grep the help content (`lib/help-content/*`) and the demo tour files for
   "First pitch" too; a help article quoting the old words is part of this fix.
4. **D7 · the Branding page drops the club's colours.** A tournament's Branding page drafts an unset theme as
   `'platform'` (`app/[orgSlug]/admin/tournaments/branding/page.tsx`, ~:95) and every autosave sends the whole draft
   (`bodyOf`, ~:109-125), so **any** save, even switching a page on, writes `theme_preset='platform'`, and the club's
   colours stop applying to that tournament. Fix: **send the theme fields only when the theme was changed.** Leave the
   Theme card's look alone (the visible "The club's colours" choice is Stage 1a, ruled, not built yet).
   - **Data question, report only:** tournaments that already carry `'platform'` from an accidental save cannot be told
     apart from a deliberate choice. Count them in production (read-only, as in Part 1) and report the number to the
     owner. Change no data.

### Done when
- Each fix verified on dev (the live-no-score game, the fallback list on an org without a club site, a countdown, a
  Branding-page save that leaves the club's colours applying); `verify:changed` passes.
- `/review` offered; `/docs` offered only if a help article changed (D4).
- One QA walk for the four (one purpose: "the small wrong things are right"), next free §; the plan's §9 row says
  Stage 0 is built, with the commit hashes; TODO updated.
- **Then: tell the owner Stage 0 is done and it is a good place to `/clear`.** The next session writes the Stage 1
  build prompt (the frame + readable baseline behind the preview switch, plan §9); that one is heavy and will itself
  be split into session-sized parts.
