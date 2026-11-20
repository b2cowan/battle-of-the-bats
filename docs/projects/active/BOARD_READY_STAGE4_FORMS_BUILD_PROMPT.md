# Prompt — Board Ready Stage 4 · BUILD: the club's sign-up form, first used by house league

> Three build sessions, one Part each, each pasted into a fresh chat (`/clear` first) as
> *"Read and follow docs/projects/active/BOARD_READY_STAGE4_FORMS_BUILD_PROMPT.md — Part N"*. Written 2026-11-20, after
> the owner ruled every drawing ask. Parts run **in order** (2 fills what 1 stores; 3 reads what 2 collects). Plan of
> record: `BOARD_READY_PLAN.md` §5 Stage 4 (the 20 rulings, the `/legal` debts, the gaps this stage owns). Index:
> `BOARD_READY_PROMPTS_INDEX.md`. The tournament question fixes (F1–F3) are a separate prompt and can run beside this.

## The source of truth
**The drawings, as ruled:** https://claude.ai/artifact/THVuyR2zxwU8ezeFti5of9 (source
`BOARD_READY_STAGE4_FORMS_DRAWINGS.html`, round 2). Tabs 1–9 are the specimens and their notes (click every tag: the
notes carry build rules); tab 10 holds the asks, **all 20 ruled as recommended** (owner 2026-11-20: *"I agree with your
recommendations"*). **Build to the drawings.** Where the code makes a drawn thing wrong or impossible, STOP and draw the
difference for the owner. Never decide it silently (`feedback_build_to_approved_mockups`).

## The rulings the build must hold (plan §5 Stage 4 has the full text; add nothing)
- **One form per owner** (a season now; a camp, a sponsorship package, a tryout later). The data model never says
  "house league": a form belongs to its owner, a tick points at what it was ticked for (as `family_consents` already
  does with `source_table`/`source_id`), and a form has a **subject kind** (child-and-sign-up now; business later) that
  decides whether "Asked" and the Health switch exist (drawing tab 9).
- **Seven types:** short answer, long answer, one choice (round buttons ≤4, dropdown from 5, every width), many choices,
  yes or no, date (the shared date field), file upload. Required (plain asterisk), help text, a set order. **No
  branching.** A **file question can't be required**.
- **Two groups:** "For each child" (default) and "Once per sign-up" (ruling 1). Moving between them is the "Asked" field,
  refused once answered.
- **Health or medical switch** (ruling 5): marked answers never in list columns, the filter, the draft board, emails,
  push or bell lines; out of every export but the new opt-in; optional by default; a keyword suggestion that never blocks.
- **Documents** (rulings 2, 8, 18): a PDF or typed text; the tick sentence "I have read {doc}." or "I have read and agree
  to {doc}."; always required; a PDF must be opened (handed over by our server) before its tick enables; typed text
  ticks in place as today. Versions keep their ticks; a version with ticks is never deleted; replace asks "Their tick
  stands" / "They must tick again" (+ a reason). A tick records document, version, a fingerprint of the bytes or text,
  the exact sentence, registration, child, the sign-up it came from, the guardian, server time, and for a PDF the
  hand-over time. **No IP address.**
- **Fixed fields stay** in a locked "Every sign-up asks" card (ruling 4); the fixed "who is asking" notice above the first
  club question; the club can't edit or hide either.
- **Change rules** (ruling 7, drawing tab 7 table): verbatim, including "Not asked" (never a blank) and "No longer asked".
- **Who** (rulings 6, 16): answers, files and health answers = the seats that open Registrations (A8: owner, admin,
  league_admin, league_registrar, plus per-member house-league grants). The form is edited by the season runners only
  (owner, admin, league_admin), only while the season is live. Every other seat gets nothing, not "Not shared".
- **Files** (ruling 9): one per question, ≤8 MB, PDF/JPEG/PNG/HEIC checked from the file's content, ≤5 per child's
  sign-up, uploaded one per request on choose, rate-limited on the public route; a file never attached to a sign-up is
  deleted within a day; Remove deletes at once; served by a 1-hour signed link with `Content-Disposition: attachment`
  and `nosniff`; each opening recorded in the club's activity log (actor, time, registration, file id; never the name or
  content).
- **Retention** (ruling 10): family files and health answers removed 90 days after the season is marked finished, or
  120 days after its last day if never; the record then reads "Removed {date}" / "File removed {date}".
- **The club's side** (rulings 11–13): up to 3 answer columns via a new Tools (⋯) → Answer columns (per person;
  absent on a phone and while the form has no questions; placed Export · Tools · Add); Filter groups per question with
  choices + Documents › Needs a new tick; the record window's two new sections **after Fee, before History**; the export
  menu keeps its shipped order (Excel · CSV · PDF, divider, opt-ins) and gains "Excel with contact details and health
  answers"; a file answer exports as "Attached"; the draft board's note popover gains board-shown answers.
- **Families** (ruling 20): Your sign-up shows each child's answers and the sign-up's answers in folded rows with
  Change until the teams are made (then the club's contact), plus the re-tick block first while a document needs one.
- **Copy** (ruling 17): a "Sign-up form" line in Start next season (on by default; the waiver leaves the Settings line)
  and "Copy {season}'s form" on an empty form. Never answers.
- **Gate:** reuse `custom_registration_fields` for the club's own questions (every house-league plan passes it today);
  documents and ticks are **never** gated.
- **Words:** drawn words are drafts; one `/marketing` pass per part confirms them, one spelling everywhere
  (`npm run check:spelling`).

## `/legal` build rules (from the drawing's review; not optional)
- Keep the published Privacy Policy's promises: 1-hour signed links, sensitive records read only through our server (no
  browser access to the new tables), health information never on a public page (Stages 6/7 too), never in a push or bell
  line.
- The "who is asking" notice, verbatim from tab 5 (`/marketing` may tune words, never narrow what it says); the club's
  privacy link only when `privacy_policy_url` is set.
- The health line under a marked question: "Only answer what {club} needs to keep {child} safe."
- File and text questions carry "Don't ask for a health card number or a photo of one." in the builder.
- The product says families are asked to open a document; never "we confirm they read it". Moved ticks read "recorded
  before documents had versions; text as the club held it on {date}" and never show a fingerprint or open time.
- Answers stay on the season's registration; never copied onto the child's cross-season record (Stage 14), never
  pre-filled from last season.
- Anonymous text reaches Excel/CSV: confirm `formulaSafeRow` covers every new answer column.
- Do not write "scanned" or "virus-checked" anywhere.
- **Owed at Part 3:** the next Privacy Policy version (§5) and Data Terms (§12) name club questions and attached files;
  the §9 retention sentence only once the nightly job is live. Route through `/legal`; a policy that promises what the
  product doesn't do is a defect for `/plan`.
- For a lawyer's eye (flag in the close-out; no gate): a club-written health question and our notice; health card
  numbers (Ontario); Québec Law 25 for a Québec family; tick + hand-over as evidence; liability for a leaked health
  answer; a public no-login endpoint taking files.

## Facts read from the code (2026-11-20; re-check the lines you touch)
- **The model to generalize:** `tournament_registration_fields` / `…_field_answers` (mig 056; dictionary ~L1530–1592).
  Editor `app/[orgSlug]/admin/tournaments/settings/event/RegistrationQuestions.tsx` + `QuestionRecord.tsx`, words
  `lib/tournament-settings-words.ts` ~L156–210, reorder `components/admin/tournament/ReorderList` (grip, tap sheet,
  saves each move). Copy its look; don't fork it. The tournament tables are **not** migrated in this stage (ruling 15).
- **Sign-up:** `components/league/RegisterForm.tsx` (one page, anonymous; children first, then guardian; "Waiver and
  agreement" ~L356–377; inline errors, one global box above the button, no scroll or focus today) → POST
  `app/api/league/[orgSlug]/[seasonSlug]/register/route.ts` (JSON; one shared waiver timestamp for every child ~L182;
  friends saved after placement, failure only logged ~L214–222 — **answers must not follow that pattern**: save them in
  the same step as the placement, `lib/league-registration-place.ts`). Friends block `components/league/FriendFields.tsx`.
- **The waiver today:** `league_seasons.waiver_text` (editable any time), `league_registrations.waiver_accepted_at`
  (per child; NULL = not recorded, never "not accepted"), and `family_consents` rows written by
  `recordLeagueWaiverConsent` (`lib/org-people.ts` ~L80–108; `consent_text` = the text then; a duplicate live row for
  the same guardian can be skipped, code 23505). Email consent `recordLeagueMarketingConsent` (~L45–67) is unchanged.
- **Season setup:** `components/admin/kit/club/league/SeasonRecordBlocks.tsx` Registration block ~L215–325 (Waiver and
  Email consent facts ~L239–240; waiver textarea ~L291–297); PATCH `app/api/admin/house-league/seasons/[seasonId]/route.ts`
  ~L193. The onboarding wizard also has a waiver textarea (`app/[orgSlug]/admin/onboarding/page.tsx` ~L1298) — decide
  with the drawing's rule (it becomes the first document) and say what you did.
- **Who:** `lib/house-league-access.ts` (`run` = `LEAGUE_RUNNER_ROLES`, `read`, `register`; finished =
  `FINISHED_LEAGUE_SEASON_STATUSES`), `lib/house-league-gate.ts` (`houseLeagueRefusal`, 423 on a finished season),
  `SeasonLockLine.tsx` in the season layout.
- **Copy:** `components/admin/kit/club/CreateLeagueSeasonDialog.tsx`, `lib/house-league-start-from.ts` /
  `-server.ts` (Settings copies `waiver_text`; `started_from` keeps a hash per line incl. `waiver`).
- **Your sign-up:** `app/[orgSlug]/league/[seasonSlug]/status/YourSignup.tsx` (also `/family/signup/[registrationId]`);
  the "Your sign-up" button rides family emails only while owed — the build extends that to "a document needs a new
  tick or a question is unanswered", so Email families carries it (no new kind of link).
- **Registrations:** `components/admin/kit/club/league/registrations/` — `RegistrationsScreen.tsx` toolbar ~L840–883
  (DivisionPicker, View pill, search, `FilterMenu`, `ExportMenu`, lime Add; no Tools today), `RegistrationsList.tsx`,
  `RegistrationRecordWindow.tsx` (sections Details · Friend requests · Fee · History · What you can do; no edit),
  `registrationsExport.ts` (sensitive columns via `lib/export/table.ts` `serializeHeaders`/`serializeRows`),
  `ExportMenu.tsx` (divider before opt-ins ~L411). Words `REGS_WORDS` in `lib/house-league-money-words.ts`.
- **Board:** `components/admin/kit/club/league/teams/TeamsBoard.tsx` `NotePlace` ~L274–292 (popover; `popTitle`,
  `popQuote`, `popFoot`), notes read by `readBoardNotes` (`lib/house-league-teams.ts` ~L267) behind
  `houseLeagueRefusal(ctx,'read')` in `teams-board/route.ts` ~L40–51; guard
  `tests/unit/house-league-board-notes-guard.test.ts` — extend it to answers.
- **Files:** the tournament store `tournament-registration-files` keeps only a path and never signs a link (F2): don't
  copy that. Signed-link pattern: permits / rep documents. The proxy buffers 10 MB per request
  (`resource-file-storage.ts` ~L17–23). Add the new bucket to `ORG_FILE_BUCKETS` (`org-storage-purge.ts` ~L19–26,
  build-enforced) and close F7 for it (deleting a registration, child or org removes its files).
- **Retention clock:** friend-request deletion is the model (finish-season moment + a backstop on the existing pg_cron
  tick, mig 183). The finish confirm gains the line.
- **Activity log:** the club audit log (`AUDIT_LOG_SCOPE_WORDING.md`, P8c pay-link rows) — keep its "isn't listed here"
  wording; add file opens, not every screen.
- Latest migration at writing: **512**. Check again at commit time; other sessions add migrations.

## Part 1 — The form, the documents and the waiver move
Drawing tabs 1, 2, 3, 4 and the gate half of 9. The Registration block's "Sign-up form" fact and door; the form page
(locked card folding; Your questions with the two bands; Documents to read; phone); Add a question / the question record
(read ↔ pencil, autosave, Previous / Next, Archive at the body's end, Delete only unanswered, the locked Type/Asked line,
the "N sign-ups will read Not asked" foot); Add a document / the document record (versions) / Replace; Copy (the Start
next season line + the empty form's button); the unreachable plan line.
- **Migration first:** forms (owner kind + id, subject kind), questions (type, label, help, choices, required, asked,
  health, board, order, archived), documents (name, source kind, tick sentence, order, archived), document versions
  (file path or text, fingerprint, created, reason, tick-again flag), answers (registration, child/sign-up scope,
  value, file path, created/updated), ticks (as the rulings list), files (path, size, type, registration, status,
  created). RLS as the house-league tables have it, **no browser access** to answers, ticks or files; explicit
  `service_role` grants. `DATA_DICTIONARY.md` + `npm run refresh:snapshots` in the same unit of work. Dev only; the prod
  step in `MANUAL_PROD_STEPS.json`.
- **The waiver move (F5), counts first:** before writing the move, count on dev and production (**counts and schema only
  on production**, binding rule): seasons with waiver text; registrations with `waiver_accepted_at`; those with no
  ledger row; seasons whose ledger text differs from the season's text. **Show the owner the counts and stop for his yes**
  before the move runs anywhere. The move never backfills or rewrites `waiver_accepted_at` or `family_consents`; it adds
  versions and links beside them, labelled as moved.
- The sign-up page keeps working throughout: until Part 2 ships, it reads the waiver from the new document.
- Ends with: `/legal` re-check on the built words, `/docs`, one `/marketing` pass, `/simplify` then `/review`, then a QA
  walk (an Artifact, `feedback_qa_walkthroughs_as_checkable_artifacts`).

## Part 2 — The family side
**Start here (written 2026-11-20, after Part 1 committed `ee560e92a` and its walk §546 passed 41 of 41).** Part 1 is
built, on dev only: migration 513 is applied to dev, the prod step waits in `MANUAL_PROD_STEPS.json`, and Parts 1–3 reach
production together (call C1). Read plan §5 Stage 4 "Part 1 built" first: its **"Carried to Part 2"** list is part of
this Part's scope. In short: (1) ticks are saved inside the placement's locked step, not just after it; (2) the PDF's
open-first gate, and the consent-ledger text names a PDF's file and version; (3) the family page keeps typed answers
across a form change, but **health answers and files are never kept across a reload** (call C3, ruled — no `/legal`
question left to ask); (4) a question delete also clears its attached/removed file rows; (5) Start next season honours
the questions plan gate when copying; (6) the readers that say "Waiver accepted" (child page, duplicates, families
export) read the ticks or say "Documents ticked" before Part 2 promotes. The family page today is the interim one Part 1
made (it ticks each typed document and refuses a page drawn before a document changed): Part 2 replaces it with the
drawn one. Open the walk §546 source (`BOARD_READY_STAGE4_SIGNUP_FORM_WALK.html`, part F) to see what it does now.
Drawing tabs 5 and the family half of 7. The notice; per-child questions under the division and friends (only for a
spot or waitlist line; kept while hidden, never sent for a child not signed up); Questions from {club}; Documents and
agreement (typed text in place; PDF gate with the reason; "Download it instead" + contact when a PDF won't open); file
states (uploading + Cancel, too large before upload, failed + Try again / Remove; Sign up waits on "Uploading…"); errors
(count + first named in the global box, focus to it, "Go to it" focuses the field); Remove on a child with answers asks
first; a form changed mid-fill comes back with the new question and keeps what was typed; F8 (the confirmation names a
child not signed up; a page where no child fits says so above the parent's section). Your sign-up: the re-tick block
(saving, failed, "Ticked version N · Undo", places aren't affected) and the folded answer rows with Change until the
teams are made.
- **Answers and ticks are saved in the same step as the placement.** A failure fails the sign-up and says so.
- The form keeps typed answers for the browser tab until sent (a phone reloading after the PDF). Whether health answers
  are kept that way is a `/legal` call: ask before building it.
- Accessibility: the faded tick stays focusable (`aria-disabled` + `aria-describedby` with the reason); Open's name says
  "PDF, 412 KB, opens in a new tab"; "Opened. You can now tick." in a polite live region.
- The public upload route: per-file request, content check, rate limit, a day's orphan purge.
- Ends as Part 1 does (+ `/legal` on the notice, the health line and the upload route; `/ux` on the built page).

## Part 3 — The club's side, retention and the close-out
Drawing tabs 6, 8 and the findings in 9. Tools → Answer columns; the Filter groups; "Not asked" / "Not answered" cells;
the record's Sign-up answers (HEALTH chip, file link with the 1-hour note, "For the whole sign-up", "No longer asked")
and Documents (version, times, NEEDS A NEW TICK); the export changes; the board popover line and the pool Filter; the
who-sees-what table as server rules + guard tests on **every** route that returns answers, files or ticks; file opens in
the activity log; the 90/120-day removal (finish moment + backstop + the finish confirm's line); a finished season's
locked form page and the "Removed {date}" reads.
- Guard tests: answers, files and ticks readable only behind the Registrations read; health answers absent from the
  list, filter, board, export (except the opt-in), every email, push and bell payload.
- `/legal` close-out: the Privacy Policy §5 and Data Terms §12 sentences (a new policy version, through `/legal`), the
  §9 sentence only if the nightly job is live; the lawyer's-eye flags in the close-out note.
- Ends as Part 1 does (+ the help guide for the form and the registrar's answers).

## Not in this stage (recorded, don't build)
- Coaches seeing a child's answers (ruling 14): the first follow-up, its own drawing.
- Tournaments moving onto the club form (ruling 15): its own later stage. Their F1–F3 fixes are the separate prompt.
- Branching questions; payment on the form; tryout, camp and sponsor forms.

## Standing rules
- Branch `dev`. Explicit paths only. **No commit without the owner's yes.** Shared files go through a private index
  (`reference_partial_commit_shared_tree.md`).
- `npm run verify:changed` per part; `npm run typecheck` (shared modules, routes, migrations).
- Dev server: restart only as `AGENTS.md` says (new files, `lib/` shared changes).
- Don't seed or reset the demo worlds from here; `/demos` picks this up in its cycle.
- Record each part's commit hash and walk number in plan §5 Stage 4, the index row and the board line (positive facts
  only, same commit as the work).
