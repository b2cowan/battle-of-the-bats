# Club Tier Stage 9a: house league's frame and who can do what (build prompt)

> **Written 2026-10-24**, the day 9a was ruled. **Paste this into a new chat on `dev` and re-verify every lead first**: the
> leads below come from the Stage 9 deep dive's helpers and my own reads of the cited lines, so this prompt names **files, not
> lines**, and code moves. Other sessions share this working copy (TODO, the Club plan, the ledger and the design log carry
> their edits): stage explicit paths only and commit only your own hunks.
>
> **Recommended model: Opus 5.5** for this session (multi-file, auth on 16 routes, shared navigation); helpers stay on Sonnet
> as configured.
>
> 9a is built in **parts, each committed locally after its own checks**, in the order below. Part 1 (the gate) is safe on its
> own and fixes a live defect, so it goes first.

## What 9a makes true

A convenor opens **House league** and sees the seasons that are happening, labelled by what's happening (Playing now,
Registration open, past its end date), with the ones getting ready below and past seasons on a closed shelf. Inside a season,
**every page of it is one click away**: the rail's season block (a working switcher, then Overview, Registrations, Teams &
draft, Schedule, Standings, **Money**, **Email families**), and on a phone a season header with a scrolling strip of the same
pages. The season's own page is its home: a figures band, its divisions, its registration settings read-first, and **one next
step**: a season getting ready leads with a checklist and "Open registration"; Complete and Archive are a rare door at the end.
**Every status change asks** in a window that says what changes for families. A **club admin can now do everything a league
admin does** (today they can open everything and save nothing); a registrar works registrations, fees and family email; a
treasurer reads Money. A finished season reads in place, locked, with Money still open. On the public side, **every live season
shows** on the league index and the club home. The home and the season page are on the kit, off the old-look list.

## The rulings (do not reopen; record nothing they did not rule)

All in `docs/projects/active/HOUSE_LEAGUE_STAGE9_PLAN.md` §0 (round 1) and §0b (round 2), owner 2026-10-24, every one as
recommended:
- **9a·1** the home: grouped rows — Running now · Getting ready (only when a season is in draft) · a closed Past seasons shelf.
- **9a·2** the rail's season block: switcher, then Overview · Registrations · Teams & draft · Schedule · Standings · Money ·
  Email families, set in under House league.
- **9a·3** on a phone: a season header (name, state, a 44 px switch button, symbol alone) and a scrolling strip of 44 px page
  pills on **every** season page, inside house league's own page. **The phone bar is Stage 13's: do not touch it.**
- **9a·4** a just-created season leads with a checklist and a primary "Open registration" (absent until it can be pressed);
  Close registration sits on the Registration block; Complete and Archive are a rare door at the end of the page; **every status
  change asks**, in a window (sentence left, buttons right; a full-screen window on a phone).
- **9a·5** on a phone, Add registration is a + in the toolbar and Approve is the one primary. (The Registrations screen itself
  is rebuilt in 9b-2; 9a only puts it inside the frame.)
- **9a·6** section headings stay inside the card. **9a·7** a season taking sign-ups shows in "Open now" and in its program
  section, on purpose.
- **S1·b** the dead "Auto-generate fee entries" switch is removed.
- **Q14** every live season shows, labelled by what's happening. **Q16** a finished season reads in place, locked **through the
  one gate**: the same pages with every write control absent, **Money still open** (fees received and refunds recorded after the
  last game), "Finished" in the switcher. **Q17** club admin = league admin; registrar = registrations, fees and refunds, add by
  hand, email families, reads the rest; treasurer reads Money; a coach (if Q7) becomes a column of the same gate in 9c. **Q18**
  the money page is called "Money". **Q12** the composer's row is "Email families".
- Round 2, **Q12b/Q12c**: one composer (the Families window, opened from the season); automatic notices never count toward a
  cap; each season has its own 3 typed sends a day. **See Part 6: the switch-over belongs in 9d, not 9a.**

## Read first

- **The drawings, ruled:** https://claude.ai/artifact/UtrYHLaqbkfQQC2kBbGEQ7, tab **"9a drawn"**, frames A–F (source
  `docs/projects/active/HOUSE_LEAGUE_STAGE9_HUB.html`). A home · B the season page + rail · C phone (season page, registrations,
  a registrar's view) · D the status window (desk + phone) · E two live seasons on the public side · F who can do what. The
  "Formatting check" card lists the /design pass already applied. 9b's drawings
  (https://claude.ai/artifact/Ru3aDgVoyBTJb8XivYPLgT) show the same frame with 9b's contents; **do not build their contents.**
- **The plan:** `HOUSE_LEAGUE_STAGE9_PLAN.md` §3 (re-verified census, findings F01–F24 with evidence), §4 (ladder), §6a (build
  notes from the reviews).
- `memory/design_decisions.md`: "Edit autosaves, create asks", "A record reads first, edits whole", "One window", "A window's
  foot", "A rare door ends the body", "A disabled .btn fades", "One loading line", the amber waiting count, the phone
  secondary-action rule, money figures = one joined band, absent beats disabled.
- `AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md`. **Broad reading goes to a helper agent; a helper's summary is a lead, not
  evidence.** Schema = dictionary, same unit of work; decide columns from the snapshots, never migration files.

## Verified state (leads; re-check each)

| What | Today |
|---|---|
| The write gate (F01) | Every house-league write in `app/api/admin/house-league/seasons/**` (16 route files) checks `ctx.role !== 'owner' && ctx.role !== 'league_admin'` by name, after a `gate()` that reads the `module_house_league` capability. D8 (`lib/roles.ts`, `ROLE_DEFAULTS.admin`) gave admin the capability, so admin reads everything and saves nothing. Fee and status writes allow `LEAGUE_FEE_ROLES` (`lib/league-fee-paid.ts`: owner, league_admin, league_registrar). The `email` route refuses admin even on GET. The treasurer has `module_accounting` only. |
| The rail | `components/admin/kit/AdminKitRail.tsx`: `seasonPages` lists five rows; `SeasonBlock` renders the switcher only when `seasons.length > 1`. **`useHouseLeagueSeasons` reads `d.seasons[].id`/`.name`, but the route returns `{ seasons: [{ season, … }] }` summaries (`getLeagueSeasonSummary`), so the list is always empty and the switcher never renders** (F02). Nav config: `lib/admin-kit-nav.ts` (one "Seasons" row, `also` keeps it lit; the dead Past seasons link was removed). |
| Phone | `lib/nav-tiles.ts`, `AdminKitBottomNav.tsx`: no season block, no switcher. `app/[orgSlug]/admin/house-league/layout.tsx` exists; **there is no `seasons/[seasonId]/layout.tsx`** (the natural home for the season header + strip). |
| The home | `app/[orgSlug]/admin/house-league/page.tsx`: cards in `created_at desc` order (`getLeagueSeasons`), a stat grid, one-click Mark complete / Close registration (Archive on the grid asks; on the season page it doesn't), the "U10" chip from `league_seasons.division` (free text). |
| The season page | `seasons/[seasonId]/page.tsx`: Status strip, division cards with five pill-links, `DivisionBornYears.tsx`, one-click status moves, the Edit window with the dead switch (`auto_generate_fees`: stored by `seasons/route.ts`, read by nothing). The Ledger is `seasons/[seasonId]/ledger/` (reachable only from a division card). |
| Old look | `scripts/lib/admin-old-look.mjs` lists the folder as "Club Tier Stage 9"; `scripts/.admin-old-look-baseline.json` holds 9 files; `scripts/check-public-tokens.mjs` lists `house-league.module.css` in `ADMIN_COLOUR_DEBT`; `scripts/.layout-baseline.json` holds the tap-floor exceptions per screen. |
| Two live seasons (F04) | `app/[orgSlug]/league/page.tsx` takes the first live season by `created_at desc`; `lib/club-site-home.ts` (`runningLeagueSeason`) and the fallback home `app/[orgSlug]/page.tsx` do the same. The club home's House league row read "Schedule and standings from Jun 1, 2027" for a season starting May 31: check the date math while there. |
| The composer | `seasons/[seasonId]/notifications/` (one-by-one `sendFamilyEmail`, no cap, its own `league_email_log`) and a "Message registrants" modal on Registrations (same route). The club's composer is Families › Email families (`lib/families-email.ts`, batched, one per household, `CLUB_EMAIL_CAP`, gated by `module_families` in `lib/families-auth.ts`; its season audience only offers `registration_open`/`active` seasons, `lib/families-audience.ts`). |
| Fixture | `dev-league-org` (League plan), `league-owner@dev.local` / `devpass123` (sign-in only, no password reset); 2025 completed, 2026 active (past its Aug 30 end), 2027 registration open; extended per the plan §7. A probe needs `?orgSlug=dev-league-org` on admin API calls (`requireOrgSlug`), and `MSYS_NO_PATHCONV=1` in git-bash. **There is no admin, registrar or treasurer on this org:** add them for the walk (a seed that resets no one else's password), or use `uat-rep-club`'s registrar. |

## Before any code

1. **The product-manager UX summary** (AGENCY_RULES, blocking): what the convenor, the club admin, the registrar, the
   treasurer and a family see differently, in plain words, with the role differences. Include Part 6's recommendation below
   and get the owner's yes on it.
2. **The words through `/marketing`** → `docs/projects/active/HOUSE_LEAGUE_STAGE9A_COPY.md`: the home's group names and empty
   lines, the season states ("Playing now", "Registration open", "Registration closed", "Ended Aug 30", "Finished", "Getting
   ready"), the checklist lines, **every status window** (Open registration, Close registration, Reopen, Complete, Archive,
   Reopen a finished season: what changes for families, the loose-end warnings, the foot sentence), the registrar's absent-state
   lines, the public labels. House rules: sentence case, "8:00 a.m.", the bare possessive, `npm run check:spelling`.

## What to build, in parts

**Part 1 · The one gate (safe alone; commit first).** One house-league access module that every route reads: who may read,
who may write which area (season setup, divisions/teams/schedule, registrations and fees, family email, Money), **and whether
the season is finished** (completed/archived → every write refused except fees received and refunds). Encode Q17: admin =
league_admin; registrar = registrations + fees + refunds + add by hand + family email + read the rest; treasurer reads Money
through `module_accounting` (the Money read must accept it). Replace the hard-coded role checks on all 16 routes and the
`email` route's GET. The client reads the same rules to decide what to render: **a control a person can't use is absent**.
A guard test in the shape of `tests/unit/club-stage5c-families-guard.test.ts`: every house-league write route goes through the
module; no route names a role. Unit tests for the matrix, including a finished season. Re-check `tests/unit/role-defaults-guard.test.ts`.

**Part 2 · The season frame (rail + phone).** Fix the switcher's data shape (read the summaries' `season`), list live seasons
first and finished ones marked "Finished", and keep the current page when switching. Add Overview and Money rows (Money =
today's Ledger page, renamed; prefer a `/money` path with `/ledger` redirecting so old links work), rename Notifications to
"Email families" (it still opens today's composer: see Part 6). Set the block in under House league as drawn. On a phone, a
new `seasons/[seasonId]/layout.tsx` carries the season header (name, state pill, switch button) and the page strip (44 px
pills, the amber count on Registrations, scrolls sideways, the current page scrolled into view) above every season page;
the desk keeps the rail block. Nothing in the phone bar or the More sheet changes.

**Part 3 · The home (frame A).** Running now (live seasons, each with its state pill, one line of facts, the amber
waiting count alone) · Getting ready (drafts; not drawn when empty) · Past seasons (closed shelf, count pill). Status buttons
leave the cards. The "U10" chip goes. A season past its end date and not completed reads "Ended {date}" with "complete it from
the season page". Kit only; off the old-look baseline.

**Part 4 · The season page (frame B, the C registrar view, D).** The figures band (Players, To review, Waitlist, Teams; one
joined band; the 9b-2 money figure is **not** built here: leave the band without it rather than show today's wrong number),
the divisions table on the kit (today's edit window; birth-year editing and prices are 9b-1), the Registration block reading
first and editing whole with today's fields minus the dead switch (stop writing `auto_generate_fees`; **do not drop the column
in 9a** — a DROP COLUMN goes last in a release, see the prod release history), the checklist for a draft season with today's
fields (divisions with sizes, dates, fee), "Open registration" absent until they are done. **The status windows**: Open
registration, Close registration, Reopen, Complete, Archive, Reopen a finished season; each says what changes for families and
warns about loose ends (waiting registrations, unpaid fees) without blocking; one window component (KitDialog, `footerStart`),
full screen on a phone. Complete and Archive as the rare door at the end of the body. A finished season: every write control
absent, Money still writable, "Finished" pill. Kit only; off the old-look baseline.

**Part 5 · Two live seasons on the public side (frame E).** The league index and the club home (both the public-site home and
the fallback home) list **every** live season, each labelled by what's happening: "Playing now" inside its dates, "Final
standings" after them, "Registration open" while it takes sign-ups; each row a whole link, its Schedule / Standings / Register
links at 44 px; Past seasons below on the index. "Open now" keeps listing seasons taking sign-ups (9a·7). Fix the club home's
date line while there.

**Part 6 · Email families: rename now, switch over in 9d (recommended; confirm at the UX summary).** The ruling (Q12b) puts the
season's door on the Families window, and Q12c gives each season its own allowance with automatic notices outside any cap.
**If 9a pointed the row at the Families window without Q12c, every house-league send would count toward the club's 3 a day**,
and a club with several age groups could not send a rainout to each — a regression from today's uncapped composer. So in 9a the
row is renamed "Email families" and keeps opening today's composer; the switch to the Families window, the per-season allowance,
the division/team/status/"Selected" audiences, the season's own sent history (the registrar has no Families access) and
retiring the old page and modal all land **together in 9d**. If the owner prefers the door in 9a, Q12c must ship with it.

**Part 7 · Help, demos and the lists.** `/docs`: the house-league help articles for the home, the season page, the status
windows and who can do what (the club admin can now save). Remove the rebuilt files from the old-look baseline and the colour-
debt list; refresh the layout baseline for the rebuilt screens (`check:layout --changed`, never a whole-product sweep on dev).
The demos follow the product (CLAUDE.md): nothing to do unless a tour anchor moved; the build fails if one did.

## Definition of done

- Parts 1–7 committed; `npm run verify:changed` and `npm run typecheck` clean; the new guard and matrix tests pass;
  `check:layout --changed` on the home, the season page and the public index/club home at 1440 and 390, Warm and Dark.
- `/review` run on the gate (Part 1) and on the whole, findings fixed or recorded.
- **The 9a walk**: a checkable Artifact and the next § in `OWNER_QA_LEDGER.md` (after §370 as of 2026-10-24; check), one
  purpose per walk, signed in as owner, club admin, registrar and treasurer. Cover: every save a club admin makes; the
  registrar's absent controls; the treasurer's Money; the switcher with three seasons; the phone strip on every season page;
  each status window; a finished season locked with Money open; both live seasons on the public pages.
- The plan's status log and §4 updated; a news row on the Club index (`ArtifactData`, artifact `MBKRySURVFu3V9cZJvmjVr`,
  stage `s9`, read it first and pin `if_version`); the TODO line updated with the commit anchors.

## Do not

- Build any 9b content: prices per division, early bird, real dates, the form, capacity atomicity, CASL, the Money band, the
  Registrations rebuild, refunds. 9a is the frame.
- Touch the phone bar, the More sheet or the top level of the rail (Stage 13). Record anything you find there as a Stage 13
  input in the plan.
- Drop `auto_generate_fees` (later, last in a release). Change the Families email gate or cap (9d).
- Show today's Ledger "Outstanding" figure anywhere new (it always reads $0.00; F14).
- Reopen a ruling. If the code says a ruling can't be built as drawn, bring it to the owner drawn, before building around it.
- Push or promote.

## Git

`dev` only. Explicit pathspecs; `git show --stat HEAD` after every commit; if another session's work is staged, build your
commit in a temporary index (memory: "Partial commit out of shared files"). Part 1 in its own commit. No push and no promote
without the owner's word.
