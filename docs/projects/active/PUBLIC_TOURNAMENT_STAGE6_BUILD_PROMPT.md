# Public tournament pages — Stage 6, News, Rules, Register, Champions (build prompt, four sessions, for Codex)

> Written 2026-10-31, the day the Stage 5 walk (§432) passed 60/60 and its eight review findings were corrected
> (`PUBLIC_TOURNAMENT_SITE_REVIEW_PLAN.md` §13). Stage 6 of that plan (§9, the "6 · News, Rules, Register, Champions"
> row). **Ruled already:** Ask 14, "tabs follow what there is," **as recommended** (owner, 2026-10-27, "every ask 1–17
> as recommended," §10): News and Rules are hidden from the tab row while empty; Register is a tab only while
> registration is open (today it is **never** a tab — CTA-only); Champions is a tab from the first title, positioned
> second, right after Overview. Rules becomes tap-open sections, the phone dropping the jump-chip list because the
> closed section list is already the index; desk keeps the chips (plan §5, lines 216–217). **Register's card and its
> form are explicitly unchanged** — this stage does not touch the Register page's body, only whether it appears in
> the tab row. The Champions page's body **does** change: it adopts `PublicChampions`, the shared card Stage 2 built
> for the Overview, closing the "Stage 8 debt" duplication plan §5 (line 286) flagged — `PublicChampions.tsx`'s own
> doc comment already says so: *"The Champions page itself is Stage 6's; the old home banner is deleted with the old
> Overview at Stage 8 — this is the frame's one copy of the card, not a third."*
> Stages 1 (frame), 2 (Overview), 3 (Schedule, a game's page), 4 (Standings, Playoffs) and 5 (Teams, a team's page)
> are built; this stage **reuses the parts they built** — it adds no new shared card for Rules or News.
> **Ruled 2026-10-31 (owner, both as recommended):** the Champions tab/page wait for the whole tournament to be
> Finished, matching the Overview's existing `PublicChampions` trigger exactly (not "the first division decided"),
> and the Register tab disappears the moment there is no live Register/waitlist button — the same `open` signal
> `registerCardView` already computes — rather than staying visible through a closed-registration state card.
> These replace Part 1's question 0; do not re-ask them.
> **Everything here is built behind the preview switch**: with it off, customers and the public demo see today's
> News, Rules, Register pages and Champions page, unchanged, and the tab row exactly as it is today (News/Rules always
> shown, Register never a tab, Champions never a tab).
> You are Codex. Read `AGENTS.md` and `AGENCY_RULES.md` first (this repo's Next.js is not the one you know; one shared
> branch `dev`; stage explicit paths only; commit only when the owner says). `/simplify` and `/review` are Claude Code
> commands you do not have: Part 4 says what to do instead.

## What Stage 6 is (one paragraph, so every part shares it)

Four pages change, but not by the same amount. **News** and **Register** keep their bodies **exactly as they are
today** — the only change for either is whether their tab appears in the row (News hides when there are no posts;
Register appears, for the first time, while registration is open, and disappears once it closes). **Rules** gets a
new body: today's rules text becomes tap-open sections (one open at a time), the phone's jump-chip list dropped
because the closed list of section names already serves as the index, while the desk keeps its chips (plan §5). Its
tab hides when there is no rules text at all. **Champions** gets a new body too: the page adopts `PublicChampions`
(the same card already shown on a finished Overview), replacing its own hand-built recap, and its tab appears "from
the first title" — second in the row, right after Overview — and never shows a held-back division's champion (D1).
**The shared tab row itself must learn to apply this rule with the switch on and ignore it with the switch off**,
and that list — `visibleTournamentTabs` in `lib/tournament-page-tabs.ts` — is read by **four** separate renderers
(the mobile top tabs, the desktop side rail, the footer links, and the site `Navbar`), so a frame-on branch has to
reach all four or the tab row will disagree with itself between surfaces. The drawings: hub
`PUBLIC_TOURNAMENT_SITE_REVIEW_HUB.html` (185 KB, **never read it whole**), frames `#f-news` and `#f-rules` (reported
near lines 1028 and 1061 — **confirm by grep, not by trusting that number**); the Register and Champions frames are
in the same "Every page" tab but their ids were not confirmed — locate them with a short node script before Part 2.
Plan §5's "Every page" bullets (lines ~180–220) and §10's Ask 14 (lines 335–337) hold the words.

## How this runs: four sessions, a `/clear` between them

| Part | Covers | Ends with |
|---|---|---|
| **1** | The two 2026-10-31 rulings (below) and a small drawing of the states the hub skipped; **the switch plumbing** for the tab row (all four renderers) and all four pages; the guard test; the D1 rule for Champions | Committed; nothing visible with the switch on |
| **2** | **News** (tab visibility only, no body change) and **Rules** (tap-open sections, phone and desk) | Committed; owner check at 360/390 |
| **3** | **Register** (tab visibility only, no body change) and **Champions** (the new `PublicChampions` body, D1 applied, the old recap retired for the frame-on page) | Committed |
| **4** | Cleanup and review of Stage 6's diff, the QA walk (next free §: grep `OWNER_QA_LEDGER.md`), the records | Committed, walk written and published |

At the end of each part, tell the owner in one line that it is a good place to `/clear`, and where the next part starts.

**Token discipline (owner, unchanged).** Nearly all of a session's cost is re-reading its own history.
- Read this prompt and plan §5/§10. Nothing else of the plan unless a step names it.
- **Build to the drawing, but the Stage 1 band, tab row, footer and tokens, and Stages 2–5's shared parts, already
  exist: reuse them, don't redraw them.** Rules and Champions need no new shared component beyond `PublicDisclosure`
  and `PublicChampions`, which already exist.
- Delegate wide searches if you have helpers; a summary is a lead, so open the cited lines before you rely on it.
  (The census below was taken 2026-10-31; line numbers will have moved.)
- Prefer `npm run verify:changed`; `npm run typecheck` once per part. `check:layout --changed` only on the screens a
  part touched, **with the switch on**. Leave the dev server running unless AGENTS.md's restart rule applies; new
  files mean a restart before handing the owner a check.

**Every part:** work on `dev`; stage explicit paths only (other sessions share this working copy); present the
product-owner summary **before** writing code (AGENCY_RULES: plain language, what the family sees, role differences);
write to the owner as to a product owner, not an engineer. For a partial commit out of a file another session has
also edited, build the blob from HEAD plus your own lines and diff it against HEAD before committing. **The owner
does the browser testing**; you verify with tests, the type check and the layout check.

### Rulings this stage stands on (do not re-open them; cite them)
- **Ask 14, as recommended (owner, 2026-10-27; plan §10 lines 335–337):** News/Rules hidden while empty; Register a
  tab while registration is open; Champions a tab from the first title, second after Overview.
- **Rules as tap-open sections, phone drops the jump chips, desk keeps them** (plan §5, lines 216–217) — this is the
  one body redesign Stage 6 owns beyond tab visibility.
- **Register's card and form are unchanged** (plan §9's Stage 6 row) — do not redesign `RegisterContent.tsx`; the
  only change is the tab row's decision to show or hide the Register entry.
- **Ask 17, ticker (round 2, plan §10 line 342–343):** the ticker stays on News and Rules (it already left the
  Schedule and a game's page at Stage 3; do not touch it here).
- **Ask 8 / D2 / D4:** the moment names are **Live now** and **Up next** only; "No score yet," never a lone dash.
  Any new empty/closed state card on these four pages uses the product's existing state words, never invented ones.
- **D1:** a held-back division's games, teams, seeds, bracket and now **champion** appear nowhere. Stage 4 applied it
  to Standings/Playoffs, Stage 5 to Teams/the team page; **Stage 6 must apply it to Champions.** News and Rules are
  tournament-wide, not per-division — D1 does not change their content, only confirm this rather than inventing a
  division filter where none is needed.
- **Stage 1's frame is the frame:** light ground, club type, 12 px minimum, tabular figures, 4.5:1 text and 3:1
  edges, 44 px taps. `check:contrast`, `check:text-contrast` and `check:public-tokens` run in `verify:changed`.
- **Nothing here reaches a customer before Stage 8.** With the switch off every page and the tab row are
  byte-for-byte what they were.
- **One spelling, and the clock is "8:00 a.m."** Build times only with `formatTime()`. Grep for the other spelling
  before you write a word with a variant.
- **Hiding a tab never 404s the page.** Exactly as an organizer-hidden page behaves today (`isPublicPageEnabled`
  false still renders an "unavailable" state, not a 404), a tab Stage 6 hides because it is empty or closed still
  resolves for anyone who already has the link — only its row entry disappears.

## What the code does today (a 2026-10-31 census; re-check before you rely on a line)

**News.** `app/[orgSlug]/[tournamentSlug]/news/page.tsx` (53 lines, server) → `components/public/NewsContent.tsx`
(177 lines). Visibility check today: `isPublicPageEnabled(tournament, 'news')` only. **No `frameOn` plumbing exists.**
Not touched beyond the tab-row question — do not give it a new body.

**Rules.** `app/[orgSlug]/[tournamentSlug]/rules/page.tsx` (61 lines) → `components/public/RulesContent.tsx`
(196 lines). Same — `isPublicPageEnabled(tournament, 'rules')` only, **no switch branch**. This is the page that gets
a new frame-on body, built with `PublicDisclosure` (`components/public/PublicDisclosure.tsx`; `modalOnDesktop` prop
opens content in a dialog on desk instead of pushing the page — already used by Schedule's finals fold, so the desk
behaviour Stage 6 wants may already exist in that prop rather than needing new code).

**Register.** `app/[orgSlug]/[tournamentSlug]/register/page.tsx` (18 lines, an invite-only redirect only) →
`components/public/RegisterContent.tsx` (**1,747 lines** — the real form). **No switch branch, and the plan says
leave it that way.** The only Stage 6 work on Register is the tab-row entry.

**Champions.** `app/[orgSlug]/[tournamentSlug]/champions/page.tsx` (227 lines) +
`components/public/ChampionsRecap.module.css` (304 lines). No switch branch. Its own visibility is already correct
and must stay: it inherits the **Standings** page's visibility (line ~40–43's comment: *"an organizer who hid
Standings must not have the final results leaked through this URL"*) — keep that gate on the new frame-on body too.
Already computes `deriveTierChampions` / `isTournamentPlayoffsComplete` from `lib/champions.ts`, the same source the
Overview's `PublicChampions` consumes via `championCards` in `lib/public-host-card.ts`. The frame-on body's job is to
call that same pipeline and render `PublicChampions`, not reimplement the recap.

**The tab row — one list, four renderers.** `lib/tournament-page-tabs.ts` exports `TOURNAMENT_PAGE_TABS` (today:
news, schedule, standings, teams, rules — its own comment says *"Register is intentionally absent (CTA-only)"*) and
`visibleTournamentTabs(hiddenPages, hasBracket)`, which filters that list and inserts the Playoffs tab beside
Standings. It is called from **four** places, which must all agree once a frame-on branch exists:
`components/public/TournamentTopTabs.tsx` (mobile), `components/public/TournamentSideRail.tsx` (desktop rail),
`components/public/TournamentFooter.tsx` (footer links) and `components/Navbar.tsx` (site navbar, line ~310). **A
frame-on signature change (adding a conditional Register entry, a conditional Champions entry, and the hide-when-empty
rule for News/Rules) has to reach all four call sites identically, or the tab row will say different things on the
phone bar than on the desktop rail** — exactly the drift the shared-list comment in that file already warns about.
None of the four callers currently has `frameOn`, nor do they have the per-tournament facts the new rule needs
(does News have any posts? does Rules have any text? is registration open? is there a decided final?) — that data
does not reach the tab row today and will need a small, single computation (likely alongside wherever each caller
already reads `hiddenPages`/`hasBracket`) rather than four separate lookups.

**Admin preview.** `app/[orgSlug]/admin/tournaments/preview/[tournamentSlug]/[section]/page.tsx`, `VALID_SECTIONS`
(line 32) is `{'news','schedule','standings','teams','rules','register'}` — **`'champions'` is missing** and must be
added for an organizer to preview the new Champions body at all.

**Layout screens already seeded.** `scripts/layout-screens.mjs` has `pubt-register-open`, `pubt-news-pale`,
`pubt-rules-pale`, `pubt-champions-after` (all `ready: '[data-public-frame-band]'`) — Stage 1's Part 4 already applied
frame-readable CSS to these four pages' **old** bodies (light ground, no new layout). Point `check:layout --changed`
at these existing ids rather than inventing new ones.

**Guard test.** `tests/unit/public-tournament-stage2-guard.test.ts`: `PARTS` (shared-component filenames, line 14)
and `FRAME_ONLY_USERS` (consuming files, line 18) are the extension point Stage 5 used for Teams. Add
`PublicChampions`'s new consumer (the Champions frame-on page) if it is not already allowed there, and add the new
Rules body component to `PARTS`.

## Part 1 · The owner's two questions, the states the hub skipped, the plumbing

0. **Already ruled 2026-10-31 (owner, both as recommended — do not re-ask):**
   1. **The Champions tab/page wait for the whole tournament to be Finished** (Ask 8's crowned word), matching the
      Overview's existing `PublicChampions` trigger exactly, not "the first division decided." A fan never finds a
      half-populated Champions page while other divisions are still deciding theirs.
   2. **The Register tab disappears the moment there is no live Register/waitlist button** — the same `open` signal
      `registerCardView` (`lib/public-pre-event.ts`) already computes (`registerOn && !isPreview &&
      registration.cta !== null`, minus the preview term), not a closed-registration state card kept in the row.
      Direct links to the Register page still work either way; this only changes whether the tab stays in the row.
   Also tell the owner (do not ask): Register's and Champions' **position** in the tab row beyond "Champions second,
   after Overview" is read from the hub drawing, not guessed — locate the Register/Champions frames in the "Every
   page" tab before Part 2 and build to what they show; News and Rules keep their existing position when visible.
2. **Draw the states the hub skipped, as one small page, before building them** (CLAUDE.md: mockups are Claude
   Artifacts, whole-screen, true size). The drawings are silent on:
   - **The tab row itself:** News and Rules present vs. hidden-while-empty, Register present (open) vs. absent
     (closed), Champions absent vs. present, all four phone-bar, desktop-rail, footer and navbar surfaces so the four
     renderers can be checked against the same picture.
   - **Rules:** the tap-open phone list with nothing open, one section open, the desk's chip row, a Rules page with
     no text at all (the hidden-tab state, for the one organizer who still types a direct link).
   - **Champions:** one decided final, several, a round-robin tournament with no champion (per the owner's Part 1
     answer, this may mean "no page at all" rather than an empty state), a held-back division's champion absent
     next to a visible one, the admin preview with no section added yet today.
   Present it, get the owner's yes, then build Parts 2–3 to it.
3. **The switch plumbing, for the tab row (all four renderers) and all four pages.** Extend
   `visibleTournamentTabs`'s inputs (or wrap it with a frame-on-aware caller) so: switch off → today's list exactly,
   unchanged, Register and Champions never appear; switch on → News/Rules filtered by whether they have content,
   Register filtered by the Part-1 ruling, Champions inserted second when the Part-1 ruling's trigger is met, always
   respecting D1 for Champions. Update all four call sites identically; add a test that pins all four agreeing.
   News and Register pages pass `frameOn` through but render their **existing** bodies either way (no new JSX
   branch needed beyond whatever the tab-row change requires). Rules and Champions each get a `frameOn` branch to a
   new body (name them e.g. `PublicRules`, and reuse the page's own existing fetch for Champions), **left
   byte-for-byte for the old body**, in the pattern `schedule/page.tsx` already uses.
4. **Admin preview.** Add `'champions'` to `VALID_SECTIONS` and a frame-on branch in `[section]/page.tsx` so the
   organizer can preview it; News, Rules and Register's preview branches already exist — confirm they adopt the new
   Rules body and the tab-row rule (with no acting links, matching every other preview section).
5. **The D1 rule for Champions, server-side.** The frame-on Champions body must filter out a held-back division's
   champion in the data it is given (reuse the filtered read Stage 4/5 already built,
   e.g. `publishedCompetitionData`), never client-side hiding of a champion already shipped — exactly D1's original
   defect. Pin it with a test the way `team-reads-guard.test.ts` pins the team profile route.
6. **Extract, don't fork.** If the tab-row's four callers end up needing the same small "does this tournament have
   News/Rules/an open registration/a decided final" computation, write it once and have all four call it, rather
   than four independent lookups that can drift.
7. Verify, then the `/clear` note. Say that nothing is visible yet with the switch on.

## Part 2 · News (tab only) and Rules (tap-open), phone and desk

1. **News:** no body change. Confirm the frame-on tab-row rule hides it when there are zero posts and shows it
   otherwise, on all four surfaces. The page itself, reached directly, is unchanged either way.
2. **Rules:** build to the drawing — phone shows the closed section list as the index (no jump chips), tapping a
   section opens it (one at a time, via `PublicDisclosure`), desk keeps the chip row. Reuse `PublicDisclosure`'s
   existing `modalOnDesktop` behaviour rather than writing a new desk interaction if it already matches.
3. Keep: the ticker (Ask 17 keeps it on both pages), the "Rules unavailable" organizer-hidden state, the admin
   preview branch.
4. **Measure** at 360, 390 and 1,280: no sideways scroll, no tap under 44 px, the tab row agreeing across the phone
   bar, desktop rail, footer and navbar when News/Rules are hidden by emptiness. `check:layout --changed` against
   `pubt-news-pale` and `pubt-rules-pale`, with the switch on. Verify; commit only on the owner's word after his
   phone check.

## Part 3 · Register (tab only) and Champions (the new body), phone and desk

1. **Register:** no body change. Confirm the frame-on tab-row rule shows it only while the Part-1 ruling's signal is
   true, on all four surfaces, and that it has never been a tab with the switch off. `RegisterContent.tsx` is not
   edited.
2. **Champions:** build the frame-on body around `PublicChampions`, fed by the same `championCards` pipeline the
   Overview uses, filtered for D1 and gated by the Standings page's visibility (unchanged from today). Retire the
   duplicate hand-built recap **for the frame-on page only** — the old body (switch off) keeps its own JSX, byte for
   byte, same as every other stage's old-body rule.
3. Keep: the share image if the Champions page has one (confirm; if not, say so rather than inventing one), the club
   forward, the admin preview branch (new, from Part 1).
4. **Measure** at 360, 390 and 1,280: no sideways scroll, no tap under 44 px, the tab row agreeing across all four
   surfaces when Champions appears. `check:layout --changed` against `pubt-register-open` and `pubt-champions-after`,
   with the switch on. **Fixtures:** reuse or extend the reserved Stage 4/5 marked-clone fixtures
   (`scripts/seed-public-stage4-fixtures.mjs` / `seed-public-stage5-fixtures.mjs`'s sibling pattern) for at least: a
   tournament with a decided champion, one with several, one with no champion yet, and one with a held-back
   division's champion. Say which you did. Verify; commit only on the owner's word after his check.

## Part 4 · Cleanup, review, the walk, the records

1. **Cleanup pass** on Stage 6's own files only. **Then an adversarial read of the whole Stage 6 diff.** If you have
   no review command, do it by hand across these lenses, or stop and tell the owner to run Claude Code's `/simplify`
   and `/review` on the committed range:
   - **The tab row disagreeing between its four renderers** — the phone bar, desktop rail, footer and navbar showing
     a different set of tabs for the same tournament and the same switch state.
   - **The switch-off pages or tab row** changing by one word or pixel (old News, old Rules, old Register, old
     Champions, the Stage 1 guard's frame-off block).
   - **D1:** a held-back division's champion reaching the Champions tab, the page, the admin preview, or the share
     image.
   - **Register's body actually changing** — any edit inside `RegisterContent.tsx` beyond what the ruling allows.
   - **Hiding a tab 404ing its page** instead of leaving the page reachable by direct link.
   - **Privacy:** notes, email, payment status or admin-only data reaching the new Rules or Champions bodies.
   - **The admin preview** showing an acting link or a star where none should be.
2. **The QA walk**: one purpose, *"with the preview on, News and Rules appear only while they have something to
   show, Register appears only while sign-ups are open, and Champions appears once there is a title to show — a
   held-back division's champion appears nowhere, and with the preview off, nothing changed."* A checkable Artifact
   in the established shell (`PUBLIC_TOURNAMENT_STAGE5_WALK.html` is the shell to copy, if committed, or §432's
   style). **Grep `OWNER_QA_LEDGER.md` for the next free §.** Parts to cover: the tab row on all four surfaces, in
   each content state; Rules' tap-open phone list and desk chips; a Rules page with no text; Register's tab opening
   and closing around the registration window; Champions after one final, after several, before any, and with a
   held-back division; the admin preview for Rules, Register and the new Champions section; the preview off is
   today's four pages and today's tab row; the demo.
3. **Records:** plan §9's Stage 6 row (commit hashes, walk §), the `TODO.md` line, the ledger entry, `memory`'s
   status line. `/docs` and `/demos` wait for Stage 8.
4. **Then tell the owner Stage 6 is done and a good place to `/clear`.** Next is Stage 7 (the pay page) or Stage 1a
   (who owns the look); name both and let him choose.

## Not in Stage 6 (say so if a step drifts toward one)
A Register body redesign (explicitly ruled unchanged). The pay page (Stage 7). Retiring the old bodies and turning
the switch on everywhere (Stage 8). The database-level public read on games (separate follow-up with `/db`). The
club's rule for its tournaments' look (Stage 1a). Any change to how champions, standings or registration state are
computed: those are not touched, only where their words are shown.

## Part 1 execution · 2026-10-31

**Owner direction:** "go ahead and build" (Stage 6 kickoff); the two open calls in Part 1 item 0 were ruled by
`AskUserQuestion`, both as recommended, before this part started (recorded above; not re-asked here).

**The architecture question Part 1 needed to answer first:** where do the four frame-on tab facts (does News have
posts, does Rules have text, is registration open, is there a crowned champion) get computed, given the tab row has
four separate renderers and two of them (the live mobile top tabs and the live desktop rail) read
`hiddenPages`/`hasBracket` two different ways — the rail falls back to `OrgNavContext` when no explicit prop is
passed, the mobile tabs (mounted through `TournamentBand`) always get explicit props. Resolved by matching each
renderer's existing pattern rather than inventing one: `visibleTournamentTabs` (`lib/tournament-page-tabs.ts`) gained
one new **optional** third parameter, `frameContent: FrameTabContent | undefined` — omitted, the function is
byte-for-byte what it was, so every switch-off caller needed no change at all. Three of the four facts turned out to
already exist with zero new reads: `registrationOpen` is the same `registerCta !== null` the layout already computed
for the Overview's Register card; `hasChampion` is `!!tournament.championsCrownedAt`, the one-time stamp
`lib/champions-notify.ts` only claims once no division is held back and the whole tournament's playoffs are decided
— already loaded on the `tournament` row, so Ask 14's "the whole tournament is Finished, matching the Overview's own
trigger" ruling cost nothing extra. Only News/Rules needed a new read (an existence check), added to the live
layout's and the admin preview's existing `Promise.all` and skipped outright when the organizer already hid that
page — so the only tournaments that ever pay this cost are ones where the switch is on (today, dev/preview traffic
only) and the page in question isn't already hidden. The live side rail's `OrgNavContext` fallback needed three new
fields (`tournamentHasNews/HasRules/HasChampion`) threaded through `TournamentNavSync`; the live mobile tabs, the
footer and the admin preview (which has no `OrgNavContext` at all) all take `frameContent` as an explicit prop
instead, mirroring how those three already receive `hiddenPages`/`hasBracket`.

**Built:** `visibleTournamentTabs` now inserts `CHAMPIONS_TAB` second (right after the Overview slot every renderer
draws itself) when `hasChampion` is true and Standings itself would be visible, and appends `REGISTER_TAB` at the end
when `registrationOpen` is true — its exact position beyond "not structural" still awaits Part 2's drawing review,
not fixed by this stage's data model. News/Rules are filtered out of the loop when their fact is false. All three
frame-on renderers (`TournamentTopTabs` via `TournamentBand`, `TournamentSideRail`, `TournamentFooter`) now accept
and forward `frameContent`; `components/Navbar.tsx`'s own call to `visibleTournamentTabs` needed no change — it
`return`s before reaching that call whenever `tournamentPublicFrame` is true, so it is dead code under the switch and
was already correct. `rules/page.tsx` and `champions/page.tsx` each gained an `isPublicFrameOn()` branch (the
`schedule/page.tsx` pattern) to a new body, the legacy JSX left untouched below. News and Register pages are not
touched at all — the ruling says their bodies don't change, only the tab row's decision. `PublicRules` is a
placeholder (`return null`) for Part 2 to fill. `PublicChampionsPage` is **not** a placeholder — it's built for real
now, because D1 is safety-sensitive and the pipeline was already free to reuse: it wraps the existing
`onlyPublishedGames`/`deriveTierChampions`/`championCards` pipeline (identical in the live page and the new admin
preview branch) around the existing `PublicChampions` card, with its own "Final results unavailable" / "No champions
crowned yet" states reusing the legacy page's own copy. The admin preview's `VALID_SECTIONS` gained `'champions'`
(with its own `isPublicFrameOn()` gate — no legacy preview existed for this page, so the section 404s with the switch
off) and the `'rules'` preview branch gained the same `frameOn` check the live page did.

**Guard test:** `tests/unit/public-tournament-stage2-guard.test.ts` gained a new "Stage 6" describe block: the
switch-off row is unchanged (no `frameContent` argument), News/Rules/Register/Champions insert and filter correctly
including the D1 Standings-hidden gate on Champions, a held-back division's champion never reaches either reader
(`onlyPublishedGames` → `deriveTierChampions`, asserted by source regex in both the live and preview files), both
layouts compute `hasChampion` from the stamp rather than re-deriving it, the legacy Rules/Champions JSX still renders
for a switch-off visitor, and `RegisterContent.tsx` carries no Stage 6 edit at all. `PublicChampionsPage.tsx` was
added to the Stage 2 guard's `FRAME_ONLY_USERS` allow-list (it imports the shared `PublicChampions` part).

**The states drawing:** published as a Claude Artifact (https://claude.ai/artifact/UEATANhqTQbERrmRcHYwVg) — sticky
view tabs (Tab row / Rules / Champions) and an Everything/"Show only what differs" toggle, true-size phone (390px),
desktop (720px) and footer frames for: the tab row across all three live renderers in a "today" state plus three
frame-on states (before-the-event with Register open, finished with a champion, and the minimal case with nothing to
show anywhere); Rules' closed section list as its own index, one section open, the desk's kept chip row, and the
no-rules-text direct-link state; Champions with one decided final, several (including a tiered Gold/Silver division),
no champion yet, a held-back division's champion absent next to a visible one, and the admin preview. Run through
`/design`: one real issue found and fixed before the owner sees it — the device frames used a fixed pixel width that
would have forced the whole page to scroll horizontally on an actual phone; replaced with a flex-based cap that holds
true size down to where the viewport allows it and shrinks cleanly below that. Republished (version 2) with the fix.
**The owner said yes to this drawing 2026-10-31** (after the Champions "held-back division" panel was corrected — the
first version wrongly showed a per-division partial reveal; the republished version 3 shows the real all-or-nothing
gate instead). Part 2 builds to it as published.

**Verification:** 281 focused tests pass across the Stage 1/2 frame guards, the Stage 6 additions, team/game read
guards, the pre-event/host-card/moment/playoffs helpers (no regressions in anything Stage 6's plumbing touches). Full
`npm run typecheck` passes clean. Focused lint on all 15 touched/added files is clean. `check:spelling`,
`check:public-tokens --scope=all`, `check:dictionary-coverage` and `check:css-module-purity` all pass with no new
findings. Smoke-tested (not a substitute for the owner's browser check, since nothing is visible yet): all five live
pages (Overview, News, Rules, Register, Champions) on a real Stage 5 fixture tournament return HTTP 200 with the
switch off, on, and at its dev default, with no server-side errors logged; all seven admin preview sections
(including the new `champions` one) return the same HTTP 307 sign-in redirect unauthenticated as the pre-existing
sections did, under both switch states — consistent behavior, not a new failure. The dev server was stopped (its
full supervisor tree), `.next` cleared, and restarted with `npm run dev`; Ready in 641ms, the platform-admin login
returned HTTP 200, and no Supabase `EACCES` appears in the log.

**Known, accepted limits, not fixed in this part:** the admin preview's Champions "no champions yet" empty state
links to a `/playoffs` preview path that isn't itself a valid preview section (no such section existed before Stage
6 either) — a real but narrow edge an organizer is unlikely to hit before Part 3 polishes this state further.
`championsCrownedAt` is a one-way stamp: if a division were re-hidden after being crowned, the tab could still show
while the Champions page's own live D1 check (unaffected by this stage) would correctly say "unavailable" — the same
kind of accepted edge Stage 5 recorded for its own failed-refresh case, not Stage 6's to solve.

Nothing is committed — this is a good place for the owner to review the drawing and give Part 2 its yes, then
`/clear`.

## Hand-off to Codex · start at Part 2

**You (Codex) are picking this stage up mid-way.** Part 1 above was built and verified by a different session
(Claude Code, not Codex), on the owner's direct "go ahead and build." It is sitting **uncommitted** in this shared
`dev` working copy right now — do not re-build it, and do not assume the working tree is clean. This repo is shared
by several concurrent agent sessions; `git status` will show many modified files that have nothing to do with Stage
6. The Part 1 files, and only these, are this stage's:

- `lib/tournament-page-tabs.ts`
- `app/[orgSlug]/[tournamentSlug]/champions/page.tsx`
- `app/[orgSlug]/[tournamentSlug]/rules/page.tsx`
- `app/[orgSlug]/[tournamentSlug]/layout.tsx`
- `components/public/PublicRules.tsx` (new, untracked)
- `components/public/PublicChampionsPage.tsx` (new, untracked)
- `components/OrgNavContext.tsx`
- `components/TournamentNavSync.tsx`
- `components/public/TournamentBand.tsx`
- `components/public/TournamentFooter.tsx`
- `components/public/TournamentSideRail.tsx`
- `components/public/TournamentTopTabs.tsx`
- `app/[orgSlug]/admin/tournaments/preview/[tournamentSlug]/[section]/page.tsx`
- `app/[orgSlug]/admin/tournaments/preview/[tournamentSlug]/layout.tsx`
- `tests/unit/public-tournament-stage2-guard.test.ts`

**Before touching anything:** diff each of those 14 files against `HEAD` and confirm what you see matches the "Part
1 execution" section above (the optional `frameContent` parameter, the four renderers forwarding it, the two new
`frameOn` branches, the guard test's new "Stage 6" block). If any of them don't match — another session edited one
since — stop and tell the owner rather than guessing which version is right.

**Then:** the owner has already said yes to the states drawing (see above, corrected version 3,
https://claude.ai/artifact/UEATANhqTQbERrmRcHYwVg). Do not re-present it or re-ask Part 1's two rulings. Go straight
to **Part 2** (News tab visibility + the new Rules body) as written above. Before you commit anything, raise with the
owner whether Part 1's uncommitted files should go into your Part 2 commit or be committed separately first — that
choice wasn't made for you, and this doc's own "commit only when the owner says" rule covers Part 1's files too, not
just Part 2's.

## Part 2 execution · 2026-10-31 (Codex)

**Handoff checked:** all 15 enumerated Part 1 paths were inspected against HEAD (the two new components were read
directly); their contents matched the Part 1 execution record. Work stayed on `dev`. The hub's Rules/News frames were
located by grep, and a bounded frame inspection located Register at `#f-reg` and Champions at `#f-champ`.
The hub's `inv` tab list confirms Register last; Champions remains second after Overview. The approved states drawing
and the two owner rulings were accepted as recorded, without reopening them.

**Built:** `PublicRules` now renders the original rules through the existing `PublicDisclosure`. Its private
`PublicRuleSections` list controls one open section at a time, uses the shared desktop dialog, keeps desktop jump
chips when there are more than four sections, and hides those chips on phones. The existing disclaimer leads the
list; Downloads & Resources is its final section. Initial hash links and later hash changes open the target section;
copying a link to division-tagged content includes `view=all` so a recipient's saved division cannot hide it. Existing
title anchors remain valid; repeated titles receive stable suffixes across the filtered and full views. No update
date is invented because the rules data supplies none.

The live and admin-preview branches now pass the existing reads to this body. Rules unavailable and Rules coming
soon retain the existing state words and direct links. The division preference and View all option remain; rules
and news stay tournament-wide, independent of the schedule's publication gate (D1). Only public titles, item text
and resource labels/URLs cross the interactive-list boundary. `DivisionFilterBar`'s input type was narrowed to the
ID/name pair it already uses, allowing the new server body to pass those alone. The admin preview keeps copy,
download and email actions absent. The legacy `RulesContent`, News route/body and ticker were left intact; this
part made no Register-body change (other sessions already had their own edits in the shared working tree).

**Development fixture:** `scripts/seed-public-tournament-stage6-fixtures.mjs` is a manual, additive seeder for
`/stage1-lakeshore-lightning/fall-classic/rules`: eight `[Stage 6 QA]` sample rule sections and two labelled sample
resources. It refuses production and an organization without the Stage 1 fixture marker, leaves existing rows
intact and tolerates reruns. Run with `node --env-file=.env.local scripts/seed-public-tournament-stage6-fixtures.mjs`.
The sample resource URLs point to example.com; they are visibly labelled QA content. The original fixture had no
News or Rules content, so its initial layout passes were followed by populated-Rules measurements.

**Verification (type-aware + focused layout):**
- 119 tests pass across the Stage 1 frame guard, Stage 2–5 guards and the new Stage 6 Rules tests. These include real
  server-rendered markup for hidden/empty/resource-only/filtered Rules, preview action suppression and the shared
  disclosure's existing and controlled modes. Navigation guards cover all three frame renderers and Navbar's early
  return under the frame. News/Rules tab facts are tested independently in all four combinations.
- Full `npm run typecheck` passes, including the new tests. Focused lint passes for the ten Part 2 code/test paths.
  Tokens, CSS module purity, spelling, palette contrast and text contrast pass. Broad `verify:changed` was replaced
  by focused checks because this shared working tree contains extensive unrelated changes.
- `check:layout --changed --only=pubt-news-pale,pubt-rules-pale` passes at 390 and 1,280 px, with no findings, after
  Rules was populated (four screen/width pairs, one worker). The frame marker was confirmed. The runner does not
  accept an ad-hoc 360 px width; a bounded geometry probe explicitly set the preview cookie on and measured exactly
  360/390/1280. Rules has no sideways scroll or target below 44 px in its closed, one-open, downloads-open and desktop
  dialog states. News's empty direct link also fits at 360. The probe confirmed one-open behaviour, desktop chips and
  dialog Close, initial section links and hash changes. Actual phone bar/rail/footer link sets agreed, with populated
  Rules present and empty News absent. This is automated measurement; the owner's visual phone check remains separate.
- The dev server was restarted through `npm run dev` with network access. The platform-admin login returned HTTP 200
  and the log had no Supabase `EACCES` failure.

**Owner handoff:** open `http://localhost:3000/api/public-frame?frame=on&to=%2Fstage1-lakeshore-lightning%2Ffall-classic%2Frules`
at 360 and 390 px. Check one section open, another replacing it, a copied section link, resources last and desktop
chips/dialog. Use the same switch URL with `frame=off` to compare the legacy body. News remains available by direct
link at the sibling `/news` address while absent from the row when empty.

Part 2's implementation and automated checks are complete; the owner phone check and explicit commit instruction
follow. Before any commit, ask whether Part 1 should be committed separately or together with Part 2, as this
handoff requires. No Stage 6 owner-walk verdict or full-stage completion is claimed here. This is a good place to
`/clear`; the next session starts at **Part 3 · Register and Champions**.

## Part 3 execution · 2026-10-31 (Codex)

**Owner direction:** "go ahead with part 3." Work continued on `dev`; commit authority remains explicit and separate.
Part 1's all-or-nothing Champions ruling and Register's live-CTA ruling were reused without changing the champion,
standings or registration calculations.

**Built:** the frame-on `PublicChampionsPage` now leads with `PublicChampions`, the Overview's existing shared card,
using the existing `onlyPublishedGames` → `deriveTierChampions` → `championCards` readers. The bracket and final
standings doors follow, with the existing Share results control retained. Top-tier winners headline the shared
message; lower tiers retain their own cards and badges. The Standings-hidden, pending-final and held-back gates
remain server-side. `forwardToOwnAddress` and the legacy recap remain in place. The legacy recap body, from
"Final standings per division" onward, was compared against HEAD and matches after line-ending normalization.

The admin preview adopts the same body and state messages, with no acting result/share links. `PublicDoorRow` now
also accepts a null destination and renders an inert row in that case; existing destinations retain their markup.
This closes Part 1's accepted broken-Playoffs-preview edge in both populated and empty Champions states.

**Sharing confirmed:** Champions has no dedicated image route. It inherits the existing tournament
`opengraph-image.tsx`; no new image was invented. Its D1-filtered public read was retained. The preview-on image now
uses the existing whole-playoffs-complete helper, requires public Standings and published division schedules, and
suppresses all champion names until those gates pass. This closes the inherited image's partial-reveal gap while
preserving the switch-off image's existing behaviour. Unit tests exercise both branches.

**Register confirmed:** open and waitlist CTAs both insert Register last; closed, started, completed and draft states
remove it. The live and preview layouts already derive this from the same registration helper and skip the read for
hidden/invite-only registration. The shared list reaches top tabs, rail and footer; Navbar still returns before its
legacy list whenever the frame is on. Register's route and body received no Part 3 edit. The body hash before and after
this part is `f72308ffadda444cc7e09a932ecb76641e48e211` (the shared working copy already contains other sessions' edits).

**Measured correction outside the page body:** the initial 390 px canonical check found five free-event promotion
failures: the badge's 19 px link, banner's 34 px link and 30 px dismiss control, its 30 px width, and the badge link
covered by the wrapped banner. A direct off/on measurement confirmed those sizes predate this part. The correction
is gated by the preview marker: controls are 44 px, the banner publishes its measured height through a cleaned-up
ResizeObserver, and the frame uses that height to clear the badge and footer. The switch-off promotion geometry
remains unchanged. The canonical check then passed with zero findings; no baseline or check script was changed.

**Reserved fixtures:** `scripts/seed-public-stage6-fixtures.mjs prepare|resume|show` follows the Stage 4/5 sibling
pattern. Run with `node --env-file=.env.local`. It permits only the known development project, verifies the Stage 1
organization and Stage 4 source markers, reserves IDs in `.probe/stage6-fixtures.json`, and reads inserts back. It
leaves the Stage 4/5 source fixtures intact. Resume can recover only unfinished reserved clones; completed clones
are retained. A numeric-field mismatch during the first preparation was corrected using the dev snapshot, and the
incomplete marked clone was recovered. All eight fixtures are prepared:

| Under `/stage1-metro-sports/` | Purpose |
|---|---|
| `stage6-one/champions` | One decided champion, with a long name |
| `stage6-several/champions` | Three cards: U11 Gold/Silver and U13 |
| `stage6-none/champions` | No decided final |
| `stage6-partial/champions` | One final decided, another pending: no Champions cards/tab |
| `stage6-held/champions` | Visible and held-back decided finals: no partial Champions reveal |
| `stage6-register-open/register` | Open registration; tab present |
| `stage6-register-closed/register` | Future event with closed divisions; direct link works, tab absent |
| `stage6-register-waitlist/register` | Full division with waitlist CTA; tab present |

**Verification (type-aware + focused layout):**
- 306 tests pass across the Stage 1–5 guards, Stage 5 review checks, both Stage 6 suites and the public-games guard.
  New tests render the real live/preview Champions routes and inherited image for decided, pending, partial,
  submitted and held-back results; Standings hidden; tiers; switch-off fallback; and registration CTA states.
- Full `npm run typecheck` and focused lint on the eight Part 3 code/test paths pass. Public tokens, CSS module
  purity, spelling, palette contrast and text contrast pass. Focused checks replace broad `verify:changed` because
  the shared working copy contains extensive unrelated work.
- `check:layout --changed --only=pubt-register-open,pubt-champions-after --width=390|1280 --workers=1` passes with
  zero findings after the promotion correction (four canonical screen/width pairs, preview on).
- Bounded geometry probes inspected all eight reserved fixtures at 360/390/1280 (24 pairs). No sideways scroll;
  top tabs/rail/footer agree; Champions is second only for fully decided visible results; Register is last only for
  open/waitlist states. Cards count 1/3/0 as expected. Neither fixture private notes nor held-back winner names reach
  the rendered responses. The new Champions targets clear 44 px. Navbar's absent frame-on branch is source-pinned.
- **Retained Register limitation under the unchanged-body ruling:** its open/waitlist lower help copy has two
  existing 15 px inline links, "schedule" and "standings", below the first viewport. They were found by the bounded
  full-body probe and are not claimed to clear 44 px. The closed Register's existing desktop buttons are about
  36 px; the standard checker applies the touch floor only through 768 px. Its canonical first-viewport checks pass.
  No form/CSS change was made to quiet these findings.

**Owner check:** open
`http://localhost:3000/api/public-frame?frame=on&to=%2Fstage1-metro-sports%2Fstage6-several%2Fchampions`
at 360/390, then 1280. Check the long names, Gold/Silver distinction, both result doors and Share results; compare
the one/partial/held siblings above. Open the three Register siblings to check their tabs and unchanged bodies.
The visual check remains owner-owned; automated measurements are not an owner verdict.

Part 3's implementation and automated checks are complete, with the Register limitation above retained explicitly.
The final dev-server restart used `npm run dev` with network access; Ready in 349 ms. The platform-admin login,
several-champions fixture and open-Register fixture returned HTTP 200, with no Supabase `EACCES` failure logged.
The inherited image endpoint also returned HTTP 200 PNGs for the completed and held-back fixtures. After the
promotion correction, a bounded off/on probe confirmed the original off sizes (19/34/30 px), on sizes of 44 px,
and an accessible badge before and after dismissing the banner. The dev server remains running for the owner check.
The owner check and explicit commit instruction follow; before any commit, settle whether Part 1 is committed
separately or together with the later parts. This is a good place to `/clear`; next is **Part 4 · cleanup, review,
the Stage 6 QA walk and the records**. Stage 6 as a whole still awaits that part and its owner walk.

## Part 4 execution · 2026-10-31 (Codex)

**Owner direction:** "go ahead with part 4." Stage 6 implementation, cleanup and manual adversarial review are
complete. The owner walk is prepared and published; an owner visual pass remains separate. Detailed review:
`PUBLIC_TOURNAMENT_STAGE6_REVIEW.md`. Scope was this stage's own delta against
`2fe15478ca86ae66e9d43d17354a46061cbf22a8`, including new files; unrelated shared-working-copy changes were excluded.
The review was performed by hand, as this prompt permits, without claiming Claude `/simplify` or `/review` execution.

**Review fixes:**
1. The desktop rail previously waited for an effect-populated context, unlike the band/footer. Both frame layouts
   now supply explicit tab facts, hidden pages and bracket presence as applicable. The live/preview computation is
   centralized in `tournamentFrameTabContent`. Redundant Stage 6 context fields/sync props were removed, returning
   those two context files to HEAD. Actual server HTML and React SSR tests now agree before JavaScript runs.
2. A one-way crown stamp no longer overrides later withholding: current divisions must be nonempty and all
   published for the Champions tab. This closes Part 1's accepted re-hidden-after-crown edge. A reserved-clone
   command preserves the stamp while withholding/publishing, and the live response was verified both ways.
3. The live/preview Champions bodies now also check current division publication: comparing filtered and raw game
   counts alone missed an unpublished division with zero games. Tests prove that case reveals no partial recap.
4. The tab helper refuses organizer-hidden Register even if an input CTA fact is stale. Registration calculations
   and the form itself remain unchanged.

The existing Navbar is CSS-suppressed at first paint under the frame and then returns early after sync; its legacy
list is not a fourth visible preview menu. The legacy Rules JSX/News body remain intact; the legacy Champions recap
was compared against HEAD after line-ending normalization and matches. Register's hash remains
`f72308ffadda444cc7e09a932ecb76641e48e211`, unchanged through these parts. No new role, membership, schema or
registration-write behaviour was introduced.

**Owner walk §435:** `PUBLIC_TOURNAMENT_STAGE6_WALK.html`, **66 steps in 16 parts**, in the established Stage 5 shell.
Private published walk: **https://fieldlogichq-stage6-owner-walk.b2cowan.chatgpt.site**. No Claude Artifact publishing
session was connected, so the available Sites skill published the standalone checklist privately. Only its HTML
and hosting manifest went to the isolated artifact repository; product Git history was not used for that publication.
Native deployment `appgdep_6ae6634f7c588191a70aab976767eb53` succeeded; artifact source commit
`f236857df8e8884f675de7ff9da940230e1003ea`. The published HTML matches the repository source, SHA-256
`e5e268c56a7131456f17d1e8740695ada8457b93cbacbce77af9da2c37d94858`.

The walk saves ticks, notes and verdicts locally, provides editable target-server and authorized-preview paths, and
refuses a complete-looking summary when ticks or verdicts are missing. It covers full/empty/mixed News/Rules tabs,
phone Rules and desktop chips/dialogs, section links, resources-only Rules, open/waitlist/date-closed Register,
one/several/tiered/partial/held-back Champions, re-withholding after a crown, all navigation surfaces, organizer
previews, all four switch-off pages, the demo, free-event promotions and restoration. No results were pre-filled.
Admin preview requires an actual accepted membership and tournament scope; unavailable populated scenarios must be
recorded as incomplete, not ticked against an empty event. The walk grants no access.

**Verification (type-aware + focused rendered checks):**
- 315 focused tests pass across Stage 1–5 guards/review, Stage 6 Rules/Champions/review/walk suites and the public-games
  guard. The Stage 1 rail assertion now pins the explicit frame-on props; its frame-off assertions are preserved.
- Full `npm run typecheck` passes. Focused lint across the Stage 6 code/tests and the updated Stage 1 guard is clean.
  Tokens, CSS module purity, spelling, palette contrast and text contrast pass. Broad changed-file verification was
  replaced by scoped checks because the working tree contains extensive unrelated work.
- Final `check:layout --changed --only=pubt-news-pale,pubt-rules-pale,pubt-register-open,pubt-champions-after`, one worker,
  passes at 390/1280: **eight screen/width pairs, zero findings**. Dumps: `.next/stage6-part4-layout-390.json` and
  `.next/stage6-part4-layout-1280.json`. Part 3's exact-360 geometry evidence remains applicable; owner appearance
  checks remain in the walk.
- Actual server HTML matches band/rail/footer tab keys in finished, populated/open, empty and resource-only states.
  The new fixture modes were exercised against the real reserved clones: mixed News/Rules, registration's real
  date boundary, and re-withholding with the crown retained. Every mutation was read back and restored. Receipts:
  `.probe/stage6-part4/`. `content-on` leaves one QA post/rule/resource on register-open and a resource-only Rules case
  on register-closed. The Stage 4/5 source events and demo data were left intact.
- The four demo pages return HTTP 200 with preview explicitly off and no frame marker. This is an HTTP smoke check,
  not a demo visual/tour verdict. No `/demos` or `/docs` rewrite ran; those remain Stage 8's work.
- The network-enabled `npm run dev` restart was Ready, platform-admin login returned HTTP 200, and no Supabase
  `EACCES` appeared. The server remains available for the owner walk.

**Records:** plan header and §9 Stage 6 row, PM brief, TODO, in-repo memory index, review report and ledger §435 now
point to the same implementation/review and published-walk result. The owner verdict is pending; no owner pass is
inferred from automated tests. Retained limits: Register's two existing small inline help links under the unchanged
form ruling; pointer-width legacy controls; membership/populated-state availability for organizer preview; share-app
image caching; and the separate database-level public-game read follow-up. No tournament application deployment or
production-database work was performed.

**Commit boundary:** owner selected **"Commit Stage 6 together"** on 2026-10-31, authorizing one combined Stage 6
implementation commit. Explicit path staging and HEAD-plus-owned-lines blobs for shared records exclude concurrent work.
The private walk publication's source commit is not a Stage 6 product commit.

Stage 6's build/review is ready for the owner walk. This is a good place to `/clear`; the next build is **Stage 7
(the pay page)** or **Stage 1a (who owns the look)**, at the owner's choice. Stage 8 retains the release switch,
legacy-body retirement, help and demo work.

**Product commit receipt · 2026-10-31:** all Stage 6 parts committed together on `dev` as `295ebce8a`
(`295ebce8aab03005dde8124b4c41f299454d7e35`), on the owner's explicit instruction. The 37-path commit uses HEAD-plus-owned-lines blobs
for shared records and excludes concurrent work. Pre-commit token/date/lockfile checks passed. The owner walk §435
remains open; no owner visual pass is inferred. The private checklist's source commit remains separate.
