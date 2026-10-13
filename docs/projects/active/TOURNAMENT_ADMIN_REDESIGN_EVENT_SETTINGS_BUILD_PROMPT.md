# Tournament admin redesign · Stage 5 addendum: Event settings in the kit's look, the questions in their card, the web address to Settings & access

> **Where it comes from.** Stage 5 ruled Event settings "the model" (E3) for how a setup screen SAVES, rebuilt one of its
> seven cards (Fees & payments) on the kit, and left the rest in the old public-site stylesheet. The owner, 2026-10-12, on
> screenshots: *"looks like event settings has not gone through our format consistency work … can you review?"*; *"why do
> we have the 'org address' in the event settings? that is not tied to a specific event"*; *"when I go to manage
> questions, it brings me to a new page (should be a drawer over the page based on our standard), but also the 'back'
> button brings me to settings, which after going there, doesn't have a button in settings to get back to the
> registrations questions"*; and *"should we make these full screen drawers on phones with a back button at the top?
> isn't that our portal standard?"*. Measured read-only on dev the same day, redrawn on a standalone sheet, put through
> `/design` (D1–D4, all applied).
>
> **The spec is the sheet:** https://claude.ai/artifact/LRhCUNmjGNsHGUcWH6XBCS (v3 or later; source
> `.probe/es-format/sheet.src.html`, built by `.probe/es-format/build.cjs` to
> `docs/projects/active/TOURNAMENT_EVENT_SETTINGS_SHEET.html`). Its seven redrawn cards (desk 860px, phone 358px, true
> size, each beside today's capture), the questions section (A and B), the web-address section, the tag notes (NEW /
> RESTYLED / UNCHANGED / FIX, and why), findings **F108–F114**, asks **A71–A77**, and the Notes part (what rides without
> an ask, what is not touched, the design review). Plan of record: `TOURNAMENT_ADMIN_REDESIGN_PLAN.md` §6e **"Stage 5
> addendum: Event settings in the kit's look"**. Design log: `memory/design_decisions.md`, the 2026-10-12 entry "A
> SETTINGS PAGE'S CARDS OPEN IN PLACE …".
>
> **⚖ The ruling (owner, 2026-10-12): "agree with your recommendations"** — A71–A77 all as recommended.
>
> - **A71** every card in the Fees & payments card's look: ClubKit field labels (12/650, sentence case), each setting's
>   name in plain bold, text on the ladder (`--type-body` 14 / `--type-support` 12, no italics), card titles 16px
>   (`--type-heading`) in sentence case. Same seven cards, same order, same save-as-you-go, same floating "Saved".
> - **A72** all **12** on/off settings become switch rows (Post-event results included, today Enabled / Disabled); the
>   **4** one-value choices become dropdowns with their sentence under them (Game timing, Tie-breaker rules, Registration
>   alert routing, Score finalization); **Tournament format** reads as its value with a lock and today's sentences once
>   the event leaves Draft, and is a dropdown while in Draft.
> - **A73** the tie-breaker list on the reorder standard (`ReorderList`, numbered handle; tap for **Move up · Move down ·
>   Remove · Cancel** — the row's × goes), the unused ones as Add chips in the kit's look — **in a division's form too**
>   (`divisions/DivisionRecord.tsx` uses the same `TieBreakerEditor`).
> - **A74** Registration questions live **in their card**: the card lists them (grip handle, title, "type · Required",
>   chevron), **Add a question at the right of the card's first line, above the list** (a + glyph on a phone), a question
>   opens its existing window (`QuestionRecord`) over Event settings. The separate page retires; its address, the Teams
>   page's Tools door and the help's link open **Event settings with the questions card open** (`?section=questions`).
> - **A75** the workspace's web address leaves Event settings and becomes **Settings & access's fourth door, "Web
>   address"**, owner only, on **Tournament and Tournament Plus**; League and Club keep it in the club's Settings only.
>   **One name both sides: "Web address"** (today "Organization Address" here, "URL slug" in the club's Settings). For
>   the owner, a line under Event settings' Public URL says where the first part of the link is changed.
> - **A76** the stragglers in the same pass: the Teams page's add/edit team form (7 Title Case `form-label`s: "Team Name
>   *", "Payment Status", "Division *", "Coach", "Email") and the bracket editor's one ("Teams in first round").
> - **A77** **on a phone a card opens in place**, as at a desk — the portal's settings standard (Team settings: six
>   closed `CoachCollapseSection`s with a summary, no phone variant). Full screen with a back arrow at the top is the
>   **window** standard (KitDialog on a phone), which the question's and the address's windows already follow.

## Read first

- **The sheet, whole** — every redrawn card and its tags, today's captures, the questions and web-address sections, the
  findings, the asks' "what rides on it", the Notes. Then **plan §6e** (the addendum and "Stage 5 — as built", which is
  E3's build: the Fees card, the floating pill, `RecordFromList`, `useTournamentLists`).
- **The page today:** `app/[orgSlug]/admin/tournaments/settings/event/page.tsx` (≈1,925 lines; read it whole). It imports
  the public-site screen's stylesheet (`../../branding/branding.module.css`: `subSectionLabel`, `segmentButton`,
  `descriptionText`, `inheritNote`, `urlPreview`, `cardDivider`, `warningBanner`) and the global `form-label` /
  `form-input` / `form-textarea` classes; its own `event-settings.module.css` (28 lines); `components/admin/CollapsibleCard.tsx`
  (each card has a `sectionId`: overview, questions, roster, fees, contact, coach-emails, schedule — `?section=` opens
  and scrolls to one); three `FeedbackModal`s (the Public URL change, the address change, errors); words in
  `lib/event-settings-words.ts`.
- **The model card, as built (E3):** the Fees & payments card in the same file — `ck.field` / `ck.label` / `ck.select`
  (`components/admin/kit/club/ClubKit.module.css`: label 12/650 secondary, select 40px, 384px wide at a desk via
  `event-settings.module.css` `.choice`), the ClubKit switch row (`ck.switchRow`, name 14/650, `ck.hint` 12, a 44×26
  switch), the `ClubRow` door "Each division's fee". Measured on dev 2026-10-12: `.probe/es-format/fees-parts.json`.
- **The kit's other switch part:** `components/admin/tournament/SwitchRows.tsx` (Stage 5 E6/E7, Notifications and Public
  site: the whole 52px row is the switch). See Build-start question P1.
- **The questions page today:** `app/[orgSlug]/admin/tournaments/settings/registration-fields/page.tsx` (190 lines; the
  list on `ReorderList` since `9d7a1b5a`, its back link `backHref` / `backLabel`, `?from=registrations`) and
  `QuestionRecord.tsx` (the KitDialog record: reads first, the pencil edits, Archive ends the body, Add asks). Plan
  gate: `custom_registration_fields` (Tournament Plus+; Event settings shows `requiresTournamentPlusCopy` in the card
  below it). Doors in: Event settings' "Manage questions →" (`registrationFieldsHref`, ≈ line 247), the Teams page's
  Tools row (`registrations/page.tsx` ≈ line 1601, `questionsHref`), help `lib/help-content/tournaments.tsx` ≈ line 591.
- **The address today:** Event settings ≈ lines 1064–1110 (owner-only field, preview, warning, "Update address") and
  `handleOrgSlugUpdate` ≈ line 753, the confirm `FeedbackModal` ≈ line 1910, `PATCH /api/admin/org-settings?orgSlug=…`
  (`app/api/admin/org-settings/route.ts`, owner-gated). The club's side: `components/admin/kit/club/SettingsKit.tsx`
  ≈ line 476 ("URL slug", its warning ≈ line 490, the post-save `router.push` ≈ line 270).
- **Settings & access:** `app/[orgSlug]/admin/tournaments/settings/page.tsx` + `settings-access.module.css` (three door
  cards, 2-column grid at a desk, `isLeagueOrClub`, `isOwner`, `lockedCard`).
- **The tie-breaker list:** `components/admin/TieBreakerEditor.tsx` (its own look, a 19px drag-only handle, a × per row,
  "ADD" chips), used by Event settings and `divisions/DivisionRecord.tsx`. **The reorder standard:**
  `components/admin/tournament/ReorderList.tsx` + `.module.css` (`ReorderRow number` = the grip and the olive number;
  desk 28 × 34 borderless; phone 44, bordered only when numbered; the tap menu is Move up · Move down · Cancel — A73
  adds **Remove**: extend the menu with an optional item, never a second menu; the four existing lists render exactly as
  today).
- **The stragglers:** `registrations/page.tsx` ≈ lines 2044–2104 (the add / edit team form), `schedule/components/BracketEditor.tsx`
  ≈ line 461.
- **Memory:** `project_tournament_event_settings_redraw`, `decision_reorder_is_hold_and_drag`,
  `feedback_tournament_org_separation` (tournament tiers never link to `/admin/org/*`; League/Club may),
  `decision_edit_autosaves_create_asks`, `decision_record_reads_first_edits_whole`, `decision_disabled_btn_face` (absent
  beats disabled), `feedback_form_selects_are_dropdowns`, `feedback_shared_component_over_shared_class`,
  `reference_code_gotchas_index` (dates `formatStoredDate` / `formatTime` only; one period after "a.m.").
- **AGENTS.md:** this Next.js differs from training data — read `node_modules/next/dist/docs/` before writing the redirect.

## Preconditions (check before code)

1. **Nobody else holds these files.** `git status` on every file under "Read first" must be clean (or hold only your own
   work). On 2026-10-12 they were all clean. If one isn't, stop and tell the owner.
2. **`/marketing` confirms the new words before you build them** (the list below). The placements are ruled; the words
   are `/marketing`'s.
3. **The UX summary for the owner comes first** (AGENCY_RULES), short: the page in one look; switches and dropdowns; the
   questions in their card; the address on Settings & access; what does NOT change (cards, order, autosave, what any
   setting does).
4. **Ask the owner whether another session is measuring** before any probe or sweep. One browser tester at a time.
5. **Settle P1–P3 with the owner at the start** (below), each with its recommendation.
6. **Open walks:** read the Owner QA Ledger. §291–§293 (Stage 5, walks 10–12) and §304 (walk 17, reorder — it walks
   Registration questions on their page) may still be open: tell the owner which of their steps this build changes
   (any step on Event settings, the Registration questions page, the address, the tie-breakers).

## Build-start questions (ask, with the recommendation)

- **P1 · One switch part.** The page will hold 13 switch rows. The Fees card uses ClubKit's switch row (the switch alone
  is the target); Notifications and Public site use `SwitchRows` (the whole 52px row is the target). *Rec.:* `SwitchRows`
  for all 13, the Fees card's one moving onto it — one part, the whole row tappable on a phone. Its rows carry their own
  1.1rem side padding: lay the list edge to edge in the card body so a row's text lines up with the fields. *Alt.:*
  ClubKit's switch row everywhere (as drawn — the two read alike).
- **P2 · Card titles: the shared card or this page only.** `CollapsibleCard` is also used by Public site and by
  platform-admin's observability page. *Rec.:* change `CollapsibleCard` itself (16px, the display face, the page gives it
  sentence-case words) — Public site is the same kit card and should match; check the platform-admin page still reads.
  *Alt.:* a prop or class for Event settings only.
- **P3 · The retired questions address.** *Rec.:* the route becomes a server redirect to
  `settings/event?section=questions`, keeping `tournamentId`; `?from=` is dropped (nothing to go back to). *Alt.:* delete
  the route (a bookmark would 404).

## ⚠ Running beside other work (as of 2026-10-12)

- **Shared with Club Tier:** `KitDialog`, `RepKit`, `ClubKit`, `SettingsKit` (the name change only). Nothing here changes
  how Club's screens look; the club's Settings gains only the word "Web address".
- **Shared with the coaches portal:** nothing is touched (`CoachCollapseSection` is read, not changed).
- **`ReorderList`** is used by Rules (sections, links), a rule section's points, Registration questions and the playoff
  seeds: the Remove item is opt-in; those lists render exactly as today (their guards stay green untouched).
- Typecheck your commit's own tree in an isolated copy when the whole tree is red from other work; stage by explicit
  pathspecs; commit only your hunks of shared docs (HEAD + your exact edits); take the next free Ledger § after
  re-reading the ledger.

## What to build (ruled 2026-10-12)

### Part 1 · Event settings in the kit's look (A71, A72, A77)

- Every card: ClubKit fields (label, input/select/textarea, hint) and the switch part P1 settles; the old stylesheet's
  classes and the global `form-*` classes leave this file (`check:admin-old-look`'s count falls — update its baseline to
  the lower number, never up). Sentence-case words in `lib/event-settings-words.ts` (card titles: Tournament overview,
  Registration questions, Roster requirements, Fees & payments, Contact, Coach emails, Schedule rules). No italics.
- The twelve on/off settings → switch rows: List in the public tournament directory (drop "On by default — turn it off
  to hide this event."), Event roster, Communication with coaches, Show on public site, Automatic coach emails and its
  six emails (straight after it; with it off the six dim, the kit's off row, and keep their values), Post-event results
  ("When on, …"). Each keeps today's sentence as its caption.
- The four one-value choices → dropdowns with their sentence (Game timing; Tie-breaker rules; Registration alert routing:
  All registrations / Assigned only; Score finalization: Admin review / Final immediately). Tournament format: read as
  text with a lock and today's two sentences once the event leaves Draft; a dropdown in Draft.
- Group headings (Public contact, Travel and setup buffers) at 14/650 with their sentence at 12; Payment instructions a
  ClubKit field. The turnover example ends "9:45 a.m." (one period: the line's template, ≈ line 1749, adds its own).
- The two "are you sure" `FeedbackModal`s and the error modal → the kit's asking window (`KitDialog kind="question"`, as
  the record windows ask), today's words.
- On a phone: cards open in place (no full-screen card); summary under the title (as now); fields full width; every
  control ≥ 44px.

### Part 2 · Tie-breakers on the reorder standard (A73)

- `TieBreakerEditor` rebuilt on `ReorderList` with numbered rows; the handle's menu gains **Remove** (opt-in on
  `ReorderList`); the × leaves the row; the unused tie-breakers as Add chips (white pill, 34px / 44 on a phone). The
  tie-breakers keep their own names (Head-to-Head, Run Diff, Runs For, Runs Against, Coin Toss — the standings' column
  words). The hint and Max run differential stay. Both callers (Event settings, a division's form) get it.

### Part 3 · Registration questions in their card (A74)

- The card lists the questions on `ReorderList` (grip handle — the questions are not numbered), each row a door opening
  `QuestionRecord` over Event settings; "Add a question" at the right of the card's first line ("Asked on every team's
  registration form, in this order."), the + glyph on a phone; empty: "No questions yet." + the sentence + Add a
  question. Summary: "No questions yet" / "N questions". The plan gate unchanged (`custom_registration_fields`; the
  Tournament Plus copy where it is not on the plan).
- The page route redirects (P3); the Teams page's Tools row and the help's link open `settings/event?section=questions`;
  the layout sweep's `admin-t-settings-fields` entry goes (or points at the card — say which in the commit).

### Part 4 · The web address (A75)

- Event settings: the address block, its warning and its confirm go. Under Public URL, **for the owner only**: "The
  first part, uat-plus-org, is your web address, shared by every tournament. Change it in Settings & access" — on
  Tournament / Tournament Plus a link to Settings & access; on League / Club the same sentence pointing at the club's
  Settings (the separation rule: a tournament tier never links into `/admin/org/*`).
- Settings & access: a fourth card, **Web address** (icon: globe), on Tournament and Tournament Plus — the owner sees
  "Change the address →"; anyone else sees it dimmed with "Owner only" (as Plan & billing). Absent on League / Club. It
  opens a KitDialog form window: the field **"Address"** with "fieldlogichq.ca/" before it, the preview line, today's
  hint, the amber callout once changed (today's words), Cancel + the lime **Change the address**, which asks once more in
  the asking window, then `PATCH /api/admin/org-settings` and moves to the new address's Settings & access. The handler
  moves from Event settings; validation and the server are unchanged.
- The club's Settings: "URL slug" → **"Web address"** (label, warning sentence, help), the field itself unchanged.

### Part 5 · The stragglers (A76)

- The Teams page's add / edit team form: ClubKit labels in sentence case (Team name, Payment status, Division, Coach,
  Email; required marked with the kit's *). The bracket editor's "Teams in first round".

## The words for `/marketing` (Precondition 2)

**New:** Web address (Settings & access door; the club's Settings label) · "fieldlogichq.ca/uat-plus-org — the start of
every tournament link. Shared across all your tournaments." (the door's sentence) · Change the address · Address (the
window's field) · the asking window's title and sentence for a change (today: "Update Organization Address?" / "This
changes the address for your whole account — every tournament link, registration page, coach email, and bookmark that
uses the old address will break. This cannot be undone.") · the line under Public URL · "No questions yet" / "N
questions" (the card's summary) · "Asked on every team's registration form, in this order." (already the window's) ·
Remove (the tie-breaker handle's menu) · "When on, accepted team contacts receive one email …" (Post-event results).
**Changed:** card titles to sentence case · "The toggles set where it shows" → "The switches …" · "On by default — turn
it off to hide this event." removed · the Teams form's labels in sentence case. **Retiring:** Manage questions → ·
Organization Address · URL slug (the club's label) · Enabled / Disabled.

## Don't

- Change what any setting does, its default, who can change it, or the order of the cards or of the settings in them.
- Open a card full screen on a phone (A77), or add a phone-only variant of the page.
- Change the address of a UAT org in a walk, a probe or a test — **every walk link, fixture and other session's walk
  points at `uat-plus-org`**. A probe stops at the asking window and cancels; the server path is unchanged and needs no
  live proof.
- Send any email by walking it: the coach-email switches write settings only (state that in the walk).
- Touch the free tier's locks (the free tournament tier review owns them) or the coaches portal.

## Verification

- `npm run verify:changed`, `npm run typecheck` (`npx next typegen` first), the unit suite for the touched areas.
- **Tests and guards (update, never delete):** `tournament-stage5-event-settings.test.ts`, `tournament-stage5-settings.test.ts`,
  `tournament-stage5-public-site.test.ts`, `kit-dialog-floor-guard.test.ts`, `back-step-verdict.test.ts`,
  `club-stage1-screens-guard.test.ts` (the club's Settings), `team-move-words.test.ts`, `coach-page-actions-guard.test.ts`,
  and the reorder lists' guards (untouched and green). New guards: Event settings imports neither the branding
  stylesheet nor a `form-*` class; no segmented ON/OFF; the questions route redirects; the address field is absent
  from Event settings and present on Settings & access for the tournament plans only; one name "Web address".
- **Probes** (in `.probe/`, read-only — every write fulfilled locally, as `.probe/es-format/*.mjs`; the walk event
  "UAT Stage 3 Walk" on uat-plus-org): every card at 1440 × 900 and 390 × 844 against the sheet's drawings; no control
  under 34px at a desk, 44 at touch widths; the questions card's handle, Add and a question's window over Event
  settings; the tie-breaker menu with Remove at both widths (touch emulation on the phone); Settings & access's four
  doors and the address window up to its asking window, then Cancel. ⚠ Capture lesson: on a phone the admin scrolls
  inside its frame — hide sticky/fixed bars and the dev badge and use a tall viewport (390 × 3600) before element shots.
- **The layout sweep:** `--only=admin-t-settings-event,admin-t-settings,admin-t-divisions,admin-t-registrations,admin-t-branding,admin-t-schedule-bracket-editor,admin-org-settings`,
  390 / 360 / 768 / 1440, both themes.

## Close-out

- **Offer `/simplify`, then `/review`** before the commits.
- **Commit only when the owner says**, on `dev`: Part 1 (the look) · Part 2 (tie-breakers + `ReorderList`'s Remove) ·
  Part 3 (questions) · Part 4 (web address) · Part 5 (stragglers) · records — or fewer, each its own honest message.
- **Records:** plan §6e "Event settings — as built"; PM brief; TODO; the sheet's banner "Built `<hash>`"; the sheet
  folded into the hub as a Stage 5 addendum (read the live hub copy whole before publishing; another session may be
  publishing it); `memory/design_decisions.md` — check the 2026-10-12 entry matches what was built.
- **Help (`/docs`):** `lib/help-content/tournaments.tsx` — the Event settings article (card names in sentence case,
  switches, the questions in their card), the Registration questions articles (≈ lines 447–450, 591, 598, 662: two of
  them already send people to "Settings & Access → Registration Questions", a door that never existed), the address;
  `lib/help-content/org.tsx` — "Your URL slug" (≈ lines 924–950) to "Web address". Check the files for another
  session's edits first. Leave the tournament's own "URL slug" (its Public URL) and house-league's season slug alone
  unless `/marketing` widens the rename.
- **Demos (`/demos`):** the sandbox curation lists `settings/event`; grep the tour narration for the retired words.
- **The owner's walks (one purpose each, the next free Ledger §s):** "Event settings, at a desk and on a phone" (every
  card, switches, dropdowns, the locked format, the tie-breakers' handle and Remove, the questions in their card and a
  question's window, the turnover example) and "the web address" (Settings & access's fourth door, its window up to the
  asking window and Cancel — never Change; the line under Public URL; a League/Club org shows no door). Say in each walk
  that nothing is emailed.
