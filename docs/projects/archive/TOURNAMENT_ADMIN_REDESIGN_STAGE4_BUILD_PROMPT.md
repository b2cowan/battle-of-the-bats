# Tournament admin redesign · Stage 4 build — After the event, built to hub v23

> Paste into a fresh session on `dev`. Written 2026-10-06, the day the owner ruled Stage 4 from the hub's paste-back:
> **D1, D2, D3 and D5 as drawn, and A19–A24 as recommended**, after the `/design` review's thirteen changes (+1) were
> applied (hub v22) and the tab was split into parts (v23). A18 was ruled 2026-10-05: **Stage 5 owns the dashboard's
> before-event view.**
>
> **The spec is the hub:** https://claude.ai/artifact/HQoRuEsKd7i6cAvCrMNzgM → **Stage 4** tab (v23 or later), read
> one part at a time from its bar.
> - Build **to the drawings, exactly** (memory `feedback_build_to_approved_mockups`). Every NEW / RESTYLED /
>   UNCHANGED tag note on the tab is a requirement; open each one.
> - The **Formatting check** part is your checklist: every row, including the `/design` review's.
> - Where you must depart, say so at build time and record why; never silently.
> - The rulings' **unchosen options** are not built: D1 keep-archive / champions-only · D2 content-only / not-now ·
>   D3 no-standings / keep-recap · D5 keep-row-tools / not-now · A19 three doors / keep Summary's window · A20 a
>   confirming menu / offline-only · A21 absent / as today · A22 one page / report only · A23 route-only / leave ·
>   A24 top team / as today.
>
> **Read first:** plan `TOURNAMENT_ADMIN_REDESIGN_PLAN.md` §3 "After the event" (F26, F32–F35, F47–F55 and the
> 2026-10-05 re-check), §6d (D1–D6 as drawn, the formatting check, the `/design` review, the asks, Not drawn, the
> taps), §7, §9. Memory: `project_tournament_admin_redesign`, `feedback_portal_is_the_formatting_benchmark`,
> `feedback_build_to_approved_mockups`, `decision_record_reads_first_edits_whole`,
> `decision_edit_autosaves_create_asks`, `decision_autosave_word_is_transient`,
> `feedback_required_marker_not_optional_tags`, `feedback_shared_component_over_shared_class`,
> `reference_code_gotchas_index`. The in-repo `memory/design_decisions.md` entries of 2026-10-05 (after the event: one
> list per phase, a strip gives way, a figure counts what it names), 2026-10-03 (one control height, 34px at a desk),
> 2026-10-01 (the white action button; a door is olive text; no club name above a title) and 2026-09-30 / 09-29 (a
> record names its neighbours; a plan lock is never a dashed box; a row's worded action is olive; one lime per screen).
> **Stage 2's build is your model** (its prompt; commits `f4a4cc79` · `12aee778` · `aab3a3f4`): the admin row recipe
> (`ClubRow*` and `ClubRowBand` in `components/admin/kit/club/RepKit.tsx`) and the form window
> (`KitDialog`, with the named Previous / Next and editable title Stage 2 gave it). **Never a second row recipe or a
> second record window.**

## Preconditions (check before code)

1. **The dev server works.** Don't fix another session's code; tell the owner. Start it only with `npm run dev`,
   with network access.
2. **`/marketing` confirms the words before you build them.** The placement is ruled; the words are `/marketing`'s.
   One run, this list:
   - **The board:** *How it finished* · *U11 champion · beat Riverdale Rapids 5–4 in the final* · *U13 · first in
     the standings, 3-0-0 · no final* · the foot line in its three money states (*$4,800 collected, all paid* ·
     *$4,350 collected · $450 still owed by 1 team* · no money part when no fees) · *Copy champions link* ·
     *Next year* and its sentence · *Reuse this setup* · the door card (*Summary* · *The weekend's recap* · *A
     champions link to share, and a printed page for your records*) · the Tournament plan's one-slot sentence ·
     *Archive this tournament* · each lock line.
   - **One name, "Summary"** — the page title, the browser tab, the door card, the lock lines, the printout and the
     strip's *Review the summary* (today *Post-event summary*, *Review event summary*, and Plan & billing's
     *Post-tournament summaries…* sentence in `lib/plan-features.ts`'s upgrade copy: words only, no gate change).
     *The weekend* and its four captions; the printed page's headings and footer; whether the *League Plus and
     Club* line stays.
   - **The reuse step:** *Create the draft* · *What to bring forward* · *Review before you publish* · the
     never-copied sentence · the toast *Draft created from Riverdale Season Opener*.
   - **The lists:** *Tournaments* (the browser tab and 14 help places say *Manage Tournaments*) · *Past tournaments*
     (its title says *Archives*) · *Live* vs the status help's *Active* · *Reuse setup* (row) vs *Reuse this setup*
     · *Finished events are in Past tournaments* · the band words · *1 of 1 tournament slots in use*.
   - **The record:** each Status sentence (*Finished Oct 4. Its public site is live and its results are
     read-only.*) · *Bringing it back needs a free slot. Your plan has one, and ‹event› holds it.* · every
     confirm (Activate · Mark complete · Move back to draft · Reopen · Archive · Bring back · Seal · Delete).
   - ⚠ **The archive sentence must change.** `lib/tournament-archive-words.ts` says *"To bring it back, change its
     status on the Tournaments list"*; after this build the way back is the record's **Bring back**, reached from
     Past tournaments. Its header comment says it must stay TRUE to the code — it stops being true in this build.
   - **An Exhibition:** *Copy standings link*.
3. **Ask the owner whether another session is measuring** before any probe, `auth-setup` or sweep. One browser
   tester at a time; scope sweeps with `--only=`.
4. **The UX summary for the owner comes first** (AGENCY_RULES). Keep it short, since the drawings are ruled: what an
   organizer sees the morning after, what the Tournament plan sees, and the two placements below.
5. **Two placements the drawing does not show — put them to the owner in the summary, each with a recommendation.**
   - **P1 · a division with tiers.** The board and Summary name each division's **top tier's** champion today
     (`decidedFinalFor`, `lib/champions.ts`); the public champions page lists **every** tier
     (`deriveTierChampions`). The drawing has one row per division. **Recommend:** one row per division, its top
     tier's champion, as today's admin rule; the caption names the tier only when the division has tiers (*U11 ·
     Tier 1 champion*), and the lower tiers stay on the public page the Copy link shares. Alternative: a row per
     decided tier.
   - **P2 · a bracket whose final was never scored** (an event marked complete early). Neither *champion* nor *no
     final* is true. **Recommend:** where its top team finished in the standings, with *final not scored*, no
     trophy; words to `/marketing`.

## ⚠ Running beside other work (as of 2026-10-06)

Club Tier Stage 3b is mid-build (session 1, the server, committed `26277b5f`; session 2, the screens, next), and the
coaches portal's Notifications and Sheet-frame steps run in their own sessions. What you may share with them:

- **The admin row recipe** (`RepKit.tsx` + `RepKit.module.css`), **the form window** (`KitDialog.*`), **the context
  strip** (`AdminContextStrip.tsx`), **the rail** (`AdminKitRail.tsx`, which mounts the setup wizard), **the
  old-look baseline** (`scripts/.admin-old-look-baseline.json`), the dev server, the UAT sessions, the owner's
  walks, and the shared docs (`TODO.md`, the Owner QA Ledger).

Five rules, Stage 2's:
1. **Neither session edits the other's files.** If any of the shared files above has someone else's uncommitted
   edits when you reach it, stop and tell the owner rather than editing around them. Whole-tree gates may fail on
   the other session's half-done edits: typecheck your commit's own tree in an isolated copy (`git archive` of the
   staged tree, `node_modules` junctioned in), run your tests by file, report a failure in someone else's files.
2. **`check:old-look --init` reads the whole working tree.** `git status` the baseline's other files first; if
   another session has any modified, run `--init` in the isolated copy and commit only your files' lines.
3. **Stay off the dev server during another session's captures or sweeps**; ask the owner before any browser use.
   Write code meanwhile.
4. **Stage by explicit pathspecs from a private index**; commit only your hunks of shared docs.
5. **Take the next free Owner QA Ledger §** at the moment you write the walk, after re-reading the ledger.

## Fixtures, and what never gets written

- **The only finished event in any test data is the local demo's Riverdale Season Opener** (Tournament Plus). Its
  club stores a one-slot limit, so its Reuse is refused (F52, `/demos`'): prove the reuse flow on `uat-plus-org`.
- The free club has **no finished event**; the design session pictured one with a read-only probe that flips the
  status in the `/api/admin/tournaments` JSON (`.probe/s4/probe.mjs`). Reuse it for the Tournament plan's board.
- **Complete, archive, seal, bring back or delete only an event this build creates for the purpose, and deletes
  after**, with the owner's OK. Never change a seeded event's status; **never write to production's demo.**

## Retire the old look as you rebuild (definition of done)

Every file this stage rebuilds loses its old look in the same build, by Stage 1's method (fold `kx()`, drop
`useAdminKit()` false branches and `legacy` props, fold `[data-admin-kit] .x` rules one at a time with the
kit-shadow and background-shorthand audits, keep every `:where(:not([data-public-preview] *))` guard).
`npm run check:old-look:report` on 2026-10-06:
- `tournaments/summary/page.tsx` — useAdminKit 1 · legacy 2; `summary.module.css` — kitScope 54.
- `tournaments/archives/page.tsx` — useAdminKit 1 · kx 4 · helpers 1 · legacy 1; `archives-admin.module.css` —
  kitScope 7.
- `org/tournaments/page.tsx` — useAdminKit 1 · kx 3 · helpers 1 · legacy 1; `tournaments-admin.module.css` —
  kitScope 49.
- `tournaments/dashboard/page.tsx` — kx 35 · helpers 2; `dashboard.module.css` — kitScope 207. **The after-event
  rules only** (A18): the before-event view's are Stage 5's, so this file is cleaned in two passes — report what
  you left and why.
- `TournamentSetupWizard.tsx` — kx 4 · helpers 1; `.module.css` — kitScope 77. **The reuse step's rules only**; the
  rest of the wizard is Stage 5's (creation).

Lock in every drop with `--init` in the same commit (rule 2). **Never fold:** `globals.css`'s kit layer,
`BottomSheet`, `ExportMenu`, `CollapsibleCard`, `admin-common.module.css`, the shared tournament header and toolbar
parts in `components/admin/tournament/`, and the shared helpers (`useKitStyle`, `kitStyler`, `useKitButtons`,
`useKitAsterisk`). Report what was retired and anything left.

## What to build (all ruled 2026-10-05/06)

Commits: **Part 0 · Part 1 · Parts 2–3 · Part 4** (one per logical part is fine). Part 0 first: the board, Summary
and the print all read it.

### Part 0 · "How it finished" and the weekend's figures: one read, one definition each (own commit)

Today the board (`app/api/admin/tournament-dashboard/route.ts`) and Summary
(`app/api/admin/tournaments/[tournamentId]/summary/route.ts`) each build their own champion list on the shared
`decidedFinalFor`; the board's passes the name only.
- **Write the definitions first**, one sentence each, into the plan's §6d before any code (Club Tier 3b's practice):
  *a division's finish* (a decided top-tier final → champion, runner-up, both scores, the final's date; no playoff
  games → the team first in the **published standings**, with its W-L-T; P1 and P2 as the owner rules); **teams** =
  the teams that played at least one scored game (8 in the demo — today's 9 is the registrations, F47); **games
  played**; **collected**; **still owed** (and by how many teams).
- **One helper** beside `lib/champions.ts` computes them; **both routes return the same shape** from it; the board
  and Summary render **one shared card** (never two copies of "How it finished").
- The standings read is the one Summary's ranking already uses since `936655a9` (the published standings, not a
  recount).
- A win–loss record is **hyphenated** (*3-0-0*, the 2026-08-19 rule); a score keeps its dash (*5–4*). Dates through
  the house formatters only (`formatStoredDate`; never `toLocaleDateString()`).
- **Proof:** a unit test per definition on a fixture with a decided final, a round-robin-only division, a tiered
  division and an unscored final (P1, P2), and one asserting the board's and Summary's payloads are equal.

### Part 1 · Reuse this setup: one flow, every door (D2, A19) — own commit, the wizard is shared with Stage 5

`components/admin/TournamentSetupWizard.tsx` already opens straight at the reuse step when given
`initialSourceTournamentId` (`preStep 'clone-name'`).
- **The doors:** the finished board's lime · Summary's Next year · Past tournaments' Completed rows (*Reuse setup*)
  · every event's record (its Next year block). New tournament (the rail's +, the list's button) keeps its *Start
  blank, or reuse* step: Stage 5's.
- **One opener, not a wizard per screen.** Today the Tournaments list and `AdminKitRail` each mount their own. Lift
  one instance into a small shared opener every door calls with the event's id. The source must be in the wizard's
  list **even when archived** (both callers pass non-archived events only; the clone route accepts any source).
- **Opened from a door there is no Back to the pick step**; the foot is Cancel and the one lime. From New
  tournament, today's Back stays.
- **The content as drawn:** the five areas as the composer's checkbox rows (22px boxes on 44px lines, a title and one
  caption, the count beside the heading; the third detail line goes); *Never copied* as one sentence; the warnings
  as the kit's white callout with an amber edge. Fields and rules unchanged: name and public link arrive filled,
  **both dates required**, from today on.
- **Full screen on a phone** (the kit's form window, × to leave, "Leave setup?" after typing, as today). At a desk
  the window and its live preview stay (Stage 5's frame).
- **It lands on the new draft's board** with the toast. The list's *Tournament Draft Created* window and Summary's
  *Next tournament draft created* page go; the event it came from is untouched.
- **Summary's own window goes** (F33): its form, its year field and its everything-copied call.
- **Analytics:** add each new door to the wizard's `ReuseSetupSourceSurface` **and** the clone route's
  `SOURCE_SURFACES` allow-list, or every new door records `unknown`. (Metadata JSON; no migration.)
- **The Tournament plan:** no door opens the wizard; each shows its lock line (A21). The clone route's plan and slot
  refusals stay the authority.
- **Taps:** from the board **4 + typing → 2 + the dates**; from a list **2 → 2**.

### Part 2 · The finished board (D1, D6) — `tournaments/dashboard/page.tsx`, the after-event view only

- **Goes, for a completed or archived event:** the guidance card (its task list is in the title band's "?", which
  reads the same lifecycle list), the tinted wrap-up card, the *Did you know?* reuse link.
- **How it finished** (Part 0's card): a row per division in the event's division order, one lead mark (a trophy for
  a champion, the standings mark for a division without a final); rows open nothing, so no chevron; the foot line.
- **Copy champions link**: an action — the section head's **boxed 44px icon** on a phone, a **white 34px** worded
  button at a desk. It copies the public champions page; it follows the Standings page's visibility (hidden →
  absent).
- **Next year**: one sentence and the board's **one lime**, *Reuse this setup* (Part 1).
- **Summary's door**: the kit's door card, named *Summary*.
- **Archive leaves the board on unlimited plans** (it lives in the record, Part 4). **On the Tournament plan** Next
  year holds the one-slot sentence (A23), *Archive this tournament* (white, asking first with the archive sentence)
  and the Reuse lock line; Summary's lock line sits **in the door card's place**; the board has no lime.
- **The strip above the phone bar** (`AdminContextStrip.tsx`, completed/archived only): **gives way on the board**
  (the page carries the door) — the same rule as its "never point at the page you're on" — and is **not offered on
  a plan without Summary**. Elsewhere it stays, as *Review the summary*.
- **Desk:** How it finished beside a 330px side column (Next year, then the door card); one screen.
- **An Exhibition (D6, A24):** no winner rows and no champions link; *The weekend* (Summary's figures card) with
  **Copy standings link** (absent when Standings is hidden), then Next year. The public champions page's "once the
  playoff finals are decided" on an Exhibition is F51: report it to the public pages' owner, don't fix it here.
- **Targets (from the drawing):** 390 phone — first finish ≈**196px** (today 547), Reuse ≈**513px** (today none);
  1440 desk — ≈**195px** / ≈**345px**.

### Part 3 · Summary and its printed page (D3) — `tournaments/summary/page.tsx`, `summary.module.css`

- **Title band**: *Summary*, then Copy champions link and Print (44px icons on a phone, white 34px buttons at a
  desk), then Help. **Keep the `post-event-summary` tour anchor on the title band** (today it sits on two elements:
  one survives, on the band).
- **How it finished** (the board's card) · **The weekend**: one card, four figures at 24px, two by two · **Next year**
  open, a **white** button (the board keeps the lime) opening Part 1 · the League Plus and Club line as `/marketing`
  rules.
- **Goes:** the champions band, the division recap (registration counts, *Leader*), the four 143px figure cards,
  *Share the results*, the closed *What's next*, the Plus line (F53), Summary's reuse window and its result page.
- **The print stylesheet** (J1-110): one Letter page — the club, *Summary*, the event and its dates; How it finished
  as **Division · Team · How it finished**; the weekend; each division's final standings (**W-L-T**, hyphenated,
  the published standings' order); a footer (the public link · *Printed* + the house date). **No** strip, rail,
  header, buttons, bar or demo bar.
- **The Tournament plan:** the title, one sentence, one lock line (no full-page upsell, F38). Nothing a free
  organizer had is lost: How it finished is on their board.
- **Targets:** 390 phone — the figures card ≈**343px**, Next year ≈**548px** (today closed at 1,553), the page
  ≈**875px** (today 1,755).

### Part 4 · The event's record and the two lists (D4, D5, A20–A22)

**The event's record — one component, opened from both lists.** The kit's form window at a desk, full screen on a
phone; it **reads first** and the header pencil edits **Details** whole (name, year, public link, dates: today's Edit
window's fields and its `update` action; the Edit window retires). Its blocks:
- **Status**: what the state means for the public site and the slot, opening with the day it finished, never
  repeating the chip; then the changes that state allows, each a **white button that asks first** in the kit's
  question window — Draft: *Activate* · Live: *Mark complete*, *Move back to draft* · Completed: *Reopen*,
  *Archive* · Archived: *Bring back*.
- **Next year** (*Reuse this setup*, or its lock line) · **Permanent record** (*Seal*, or *Sealed ‹date› · its
  public record ↗*; the route accepts completed or archived) · **Details** · **Delete** ends the body, alone, red,
  asking first (hidden while Live, as today).
- **The foot:** named Previous / Next in the order of the list it was opened from (Stage 2's Part 1).
- **The slot, said before the tap:** the record knows the plan's limit and which non-archived events hold slots;
  where a change needs a slot and none is free, the button is replaced by the sentence naming the event holding it
  and the *More tournament slots* lock line. The set-status route stays the authority (a 403 that races still shows
  in words).

**The confirms (A20) — one home for every sentence, beside the archive sentence**, each verified against the route
before `/marketing` words it:
- *Activate* names today's activation blockers (dates, a division, a contact) before the tap, not after.
- *Mark complete*: results become read-only and the event moves to Past tournaments; **it emails the teams their
  results when the event's "notify teams on complete" setting is on** (`sendCompletionResultsNotification`) — say so
  only when it will.
- *Move back to draft*: the public site goes offline and registration closes.
- *Reopen* (completed → live): read what reopening actually does to registration before writing a word; the
  activation window's "open registration" is today's untrue line.
- *Archive*: the archive sentence, rewritten (Precondition 2). *Bring back*: it comes back as Completed, its site
  back online at the same links, holding a slot again.
- *Seal*: today's "Sealing is permanent" warning moves here.
- Each button's words repeat the verb of the button that opened it (*Move back to draft*, not *Move to draft*).

**The Tournaments list** (`org/tournaments/page.tsx`; `tournaments/manage/page.tsx` re-exports it):
- Title *Tournaments*, **no "Organization" eyebrow**; *New tournament* the one lime (a 44px icon on a phone); on a
  one-slot plan the slot fact as one line under the title.
- **Bands Live · Draft only** (an empty band is absent): the list holds what's ahead (A22). Each event a 60px row
  (the name; its dates · its teams) in **one frame** (`ClubRow`), the whole row opening the record; at a desk a table
  — Tournament · Dates · Teams — with band rows.
- **No controls on a row:** the status menu, Seal, Reuse, preview, edit and delete leave it.
- At the list's foot, the door **"Finished events are in Past tournaments"** (olive text, the kit's `footLink`, 44px).
- The two callouts and *How statuses work* go (Seal's warning into its confirm; status help into Help).

**Past tournaments** (`tournaments/archives/page.tsx`):
- Title and browser tab *Past tournaments* (`AdminTitleManager`); no eyebrow, no plan fact under the title;
  *Public ledger* a door (44px icon on a phone, a white button with its arrow at a desk).
- **One frame, bands Completed · Archived · Sealed records.** A row: the name; its dates · *public site live* /
  *offline*; at a desk a table — Tournament · Dates · Public site. The whole row opens the record.
- **Completed rows carry *Reuse setup*** (Plus; olive on white; at a desk in that band only — K-08's named
  exception, as Teams' Accept). Nothing on the Tournament plan.
- **Sealed records:** each a door to its public record ↗, or one sentence when there are none; on the Tournament
  plan one plain lock line (today a dashed box and *Seal Now*).

**Not built here:** the Tournaments list's own door from inside an event (F48 — the Stage 8 nav review; an
*All tournaments* line in the rail's event picker is the obvious place). The rail's Past tournaments row stays.

## Don't

- Build the dashboard's before-event view, the draft board's copy-into-this-draft (`populate-from`, F33's third
  flow) or *Set up fees* (F55): all Stage 5's (A18).
- Fix the public champions page for an Exhibition (F51) or the demo (F52): report them.
- Change prices, plan names, slot limits or gates; F49's packaging question is `/strategy`'s (A23), not this
  build's. Write customer copy yourself.
- Add a second row recipe, a second record window, a status menu, a new chip tone or a multi-select.
- Tint an item row, put a dashed box round a lock, put a club name above a title, or a required marker on a title.
- **Keep the demo tour anchors:** `post-event-summary` on Summary's title band; `now-playing` and
  `registration-health` untouched. The tour-anchor guard stays green.

## Verification

- `npm run verify:changed`, and `npm run typecheck` (the shared wizard, the strip, two API routes, the kit's form
  window as a consumer).
- **The layout sweep's `admin-t-*` entries** for the finished dashboard, Summary, Past tournaments and Tournaments
  at 390 / 360 / 768 / 1440, both themes. One runner at a time, scoped with `--only=`; contrast 0/0 in both themes.
- **Probes** (in `.probe/`), asserting on state, never a guessed delay:
  - the targets above (board, Summary) at 390 and 1440, read from the built screens;
  - run a finished event back: **2 taps + the dates**, landing on the new draft's board;
  - share the champions page: **1 tap**, the clipboard holds the public champions link;
  - print: **2 taps**, and the print render (`page.pdf`, Letter) is **one page with no admin frame**;
  - bring an archived event back: **3 taps + the confirm**; on a full plan the sentence shows **before** any tap;
  - **no status change writes before its confirm** (assert the set-status call is not sent until the confirm's
    button);
  - nothing an organizer taps is under 38px tall at touch widths, or under 44px wide for an icon-only control.
- **The Tournament plan:** each lock line opens Plan & billing's Tournament Plus panel; no door opens the wizard.
- Re-measure the built screens against the hub's figures and report any gap.

## Close-out

- **Offer `/simplify`, then `/review`**, before the commit: a new shared read (Part 0), a shared opener (Part 1) and
  a new record component.
- **Commit only when the owner says**, on `dev`, from a private index, explicit pathspecs, then `git show --stat
  HEAD`.
- **Help:** `/docs` for the finished board, Summary, reuse, statuses, Past tournaments and the Tournaments list,
  including `keywords` / `searchText` (*Manage Tournaments*, *Archives* and *Post-event summary* are searched words
  today).
- **Owner walks:** checkable Artifacts on the hub's QA tab (ONE artifact: republish the same URL), one purpose each
  — "the morning after, from a phone" and "statuses and the way back, at a desk" — each with its own Owner QA Ledger
  §; pin identities, not figures.
- **Route, don't do:** A23's packaging question to `/strategy`; F51 to the public pages' owner; F52 to `/demos`.
- **Record:** the plan's status header and §6d as built, with commits; the hub's stage strip (Build) and a "Built"
  part on the Stage 4 tab; the TODO line; memory `project_tournament_admin_redesign`; `PROGRAM_TOURNAMENTS.md`'s
  pointer.
- **Migrations:** none expected. If one appears, update the data dictionary in the same unit of work.
