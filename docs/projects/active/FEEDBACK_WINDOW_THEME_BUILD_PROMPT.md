# Feedback window wears the portal that opens it — build prompt

> Paste into a fresh session on `dev`. Written 2026-10-19. **Precondition: One Window Stage 2 is committed** (the
> reason is under "The precondition", below). One Window Stage 1 is committed `992243fb` and walked (§339, 30 of 30).
> **A production release (2026-10-19) is being promoted from dev right now: commit locally, and do NOT push to
> origin until the owner says the release's staging sweep is done.** No migration and no new API route are expected
> (verify the category claim in step 3 of the gate).

**Read first**
- The hub: https://claude.ai/artifact/6GmRQkQ6HgdCKKwEPMwGmU, read with the Artifact tool (`action: "read"`). Source
  `docs/projects/active/FEEDBACK_WINDOW_THEME_HUB.html`; live version `1792352031-3ec9` at writing. Tabs: Mockup (screens
  1–7, asks on screen 6), PM Brief, Full Plan, Decisions. The Decisions tab held ONE row at writing ("Draw it"): **A1–A6
  were not ruled.** The TODO line: `grep -n "Feedback window wears the portal" TODO.md`.
- `docs/projects/active/ONE_WINDOW_PLAN.md`: the status line, §3 (Q1–Q16), §4 Stage 2 (and its "as built" notes, if Stage
  2 has landed), and the Stage 2 build prompt if one exists in `docs/projects/active/`. Design log:
  `memory/design_decisions.md`, "2026-10-18 — ONE WINDOW FOR THE WHOLE PRODUCT". Auto-memory
  `project_feedback_window_theme.md` and `project_one_window.md`.
- Then `AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md`. CLAUDE.md's rule applies here: broad reading and searching go to a
  helper, and a helper's claim is a lead — open the cited lines before you build on it. Every line number below was read
  on 2026-10-19; files move, so re-open before editing.

## The precondition: One Window Stage 2 first
Stage 1 is enough for the window's LOOK, and I checked that it holds in both portals: `KitDialog.module.css` is
tokens-only with no `[data-admin-kit]` scoping, and Stage 1 brought the admin's and the coaches' windows to the same
sentence-case labels, the 520 default, 24px inside, the tinted edge and the themed scrim (Q1–Q6); what still differs
(the coach field is 35px to the admin's 36, the head, the foot) is Stage 2's. So this is not a technical block. **Stage 2 should still land first**,
for three reasons:
1. The window's BEHAVIOUR is what Stage 2 builds. The closing ask in the foot (A6 = Q7), the foot sentence and the
   refusal line (Q8, Q9) and the 44px phone floor (Q10) exist today only in KitDialog (`footerStart` at
   `components/admin/kit/club/KitDialog.tsx:173`, the reason slot at :311). The coach shell leaves the foot to each
   consumer (`components/coaches/QuestionShell.tsx` header: "renders its own `.modalFooter`") and a scrim tap calls the
   consumer's closer. Built first, the closing ask is hand-rolled a third time (`MessageFamilyWindow.tsx:75-82` is the
   second) and replaced by Stage 2 soon after.
2. After Stage 2 there is ONE window piece for both portals, so the feedback window is written once and the "admin
   window or coach window?" question becomes "which themed root am I in?". Before it, the widget needs two windows and a
   host test.
3. Both pieces of work edit `KitDialog.tsx` / `KitDialog.module.css` and the window guards on the one shared `dev`
   tree. Run them in sequence.
Nothing is lost by waiting: the hub's own priority is "small, and not blocking anything".

**If Stage 2 is not committed** (check the plan's status line and `git log -5 -- components/admin/kit/club/KitDialog.tsx
components/coaches/QuestionShell.tsx`): say so and stop. **If the owner says go first anyway:** build the window as a
`KitDialog kind="form"` in EVERY host (it renders correctly under the coach marker — see B2), hand-roll the ask as
`MessageFamilyWindow` does, and add one line to the plan's Stage 2 section saying the feedback widget is a KitDialog
consumer outside the admin, so Stage 2's "admin-only ends" guard allows it.

## What the owner will see (if A1–A6 are accepted as the hub recommends)
- **Send feedback** opens the window of the place he opened it from: the admin's form window in the club and tournament
  admin, the coaches portal's window in the coaches portal. Both follow his Warm / Dark choice; no more dark mono card
  over a Warm page. On a phone it fills the screen with ← and covers the bar.
- Type is a dropdown (Bug · Feature request · General feedback). Title no longer says "(optional)"; Description carries
  a plain asterisk and Send stays faded until it has words. There is no Category field.
- With words typed, Cancel, ×, Back or a tap outside asks in the foot first: "Close without sending? What you typed
  won't be kept." with Keep writing / Discard. With nothing typed it closes at once.
- Send closes the window and a pill fades in: "Feedback sent. Thank you." A failure shows "Could not send feedback."
  beside the buttons (above them on a phone).
- The coach's account page (Help) and the public pages' account menu open the same window in the person's theme.
- In the platform inbox the category is right more often (Rep teams, House league, Families, Schedules are new).
  Nothing else on any screen changes.

## Blocking gate (no code until all five are done)
1. **Stage 2 is committed** (above).
2. **Read the live hub** (Artifact tool, every line of the saved file) and its Decisions tab. For each of A1–A6 that is
   NOT ruled: put it to the owner in plain language with the hub's recommendation (table below) and **stop for his
   answer**. Record each ruling the turn it is given — a new row on the hub's Decisions tab, a dated entry in
   `memory/design_decisions.md`, the TODO line — adding nothing the ruling did not rule.
3. **Confirm the facts below against the code** (a helper may do the reading; open the cited lines yourself): the doors
   table; that nothing but `FeedbackWidget` imports `FeedbackLauncher`; that `feedback_submissions.category` has no
   CHECK (`docs/agents/db/DATA_DICTIONARY.md:8709` says so — confirm against the schema snapshot, never a migration
   file); the exact route tree for the category map. Report anything that differs before building on it.
4. **Say these out loud with the asks** (the repo's "disagree before the work" rule; none of them reverses a
   recommendation, all of them change what the owner is agreeing to):
   - **The hub's drawings of BOTH windows predate One Window Stage 1.** They draw the admin window at 640 with a shadow,
     20px inside, 40px / 7px fields; and the coach window with small-capital labels "that stay that way" and a black
     60% scrim. Stage 1 made the admin's 520, no shadow, 24px, 36px / 6px paper fields, and the coaches' labels sentence
     case with the themed scrim. **Build the live window, not the pixels** — the drawings' structure (fields, foot,
     states, pill) stands; their paint does not. Add a one-line banner to the hub's Mockup tab saying so.
   - **A1's premise is half wrong.** Only coaches reach Send feedback on the account page (`isCoach`,
     `app/(consumer)/account/page.tsx:89`, `.../account/help/page.tsx:49`). But the public pages' account menu shows it to
     EVERY signed-in person — fans, parents, admins: `ConsumerNav.tsx:456` and `Navbar.tsx:234` / `:345` use
     `AccountMenu` with `showFeedback` left at its default `true`. The window is a shell, not a coach-only thing, so the
     recommendation stands; the QA walk must include a signed-in non-coach.
   - **A5's pill costs more than the drawing shows.** The portal has no one-off notice pill outside the admin:
     the admin's is `NoticePill` (`components/admin/kit/club/RepKit.tsx:460`), the coach portal's
     `SaveStatusPill.tsx` is autosave-only, and the account / public pages have neither. And every nav host unmounts the
     widget the moment it closes (`{feedbackOpen && <FeedbackWidget …/>}`: `AdminKitBottomNav.tsx:363`,
     `CoachesBottomNav.tsx:463`, `CoachFreeBottomNav.tsx:218`), so a pill the widget draws would vanish with it unless the
     widget outlives its window. Option 2 (the window turns into the thank-you) needs none of that. Put the cost to the
     owner with the recommendation; if he still picks the pill, see B5.
   - **The F06 note on the hub is stale.** The club kit's red required asterisk was made plain by One Window Stage 1
     (`ClubKit.module.css:191`, `.required` carries no colour). The feedback window can use `ck.required` as it is.
5. **Restate the PM summary** in the chat in five plain lines (what changes, for whom, what does not), per
   `AGENCY_RULES.md`.

## The six asks (hub screen 6) — what to put to the owner, and what a different ruling does
| Ask | The question | Hub recommends | A different ruling changes |
|---|---|---|---|
| A1 | Account page and public pages open the coach window on the person's Warm / Dark | Yes (the alternative is a third window for two low-traffic doors) | No: those doors keep the old terminal window, the last place it lives. Ask him what he wants there (hide the door, or a third window) before building anything |
| A2 | Drop "(optional)" on Title; plain asterisk on Description | Yes | No: keep "(optional)" and no mark. Trivial |
| A3 | Type becomes a dropdown: Bug · Feature request · General feedback | Dropdown | Buttons: keep the three-button row, restyled to tokens in the new window; more work, same values |
| A4 | Stop asking for Category; fill it from the page, and add the club's areas to the list | Option 1: remove it | Option 2: keep the field, add the areas to the list and to the guess; B4 still applies in full |
| A5 | After Send: close with a fading pill "Feedback sent. Thank you.", or turn into a thank-you window | Option 1: the pill | Option 2: keep today's thank-you (`done` state, `FeedbackWidget.tsx:117-122`) restyled in the window, Done in the foot; skip B5 |
| A6 | Ask before throwing typed words away, in both portals | Yes | No: Cancel, × and a tap outside close at once as today (still themed) |

## What to build (after the gate; B1–B7 cover the recommended answers)
**The shape.** `components/feedback/FeedbackWidget.tsx` stays the one public component with its props
(`open`, `onClose`, `helpSection`) so the eight mount points need no edit: `AccountMenu.tsx:241` (kept mounted, driven by
`open`), `AdminKitBottomNav.tsx:363`, `CoachesBottomNav.tsx:463`, `CoachFreeBottomNav.tsx:218` (mounted on open), and
`components/consumer/AccountFeedbackRow.tsx:22` (kept mounted; used by the account page and its Help page). Put the form in
a child that mounts only while open, so closing resets it and the manual `reset()` (`FeedbackWidget.tsx:49-56`) goes.
Keep `useOverlayOpenIfAvailable(open)` (:45): in the coaches portal it steps the phone bar aside.

**B1 · The window.** Replace the global `modal-overlay` / `modal` markup (:105-106, inline `zIndex: 1100`) with the one
window piece (KitDialog `kind="form"`, per Stage 2), no `size` (a one-column form is 520). Title "Send feedback"; the
tap-outside-closes behaviour goes with the markup. Rules KitDialog's own guards impose: a sentence in the foot goes in
`footerStart`, never in `footer` (`tests/unit/kit-dialog-foot-text-guard.test.ts`); the window floor
(`tests/unit/kit-dialog-floor-guard.test.ts`).

**B2 · Open it inside the portal's themed root — this is the real fix for the old look.** Today the widget portals to
bare `document.body` (:104, :187), outside every marker, which is why `:where([data-admin-kit]) .modal`
(`app/globals.css:2572+`) never reaches it. It must still portal out: the phone bars are `position: fixed` with a
`backdrop-filter` (`CoachesBottomNav.module.css:29-30`, and the admin bar wears the same sheet), which would trap a
fixed window mounted inside them. So: `createPortal` to `document.body`, wrapped the way `components/help/HelpDrawer.tsx:137-141`
and `:226` wraps its drawer — `PortalKitRoot` (`components/admin/AdminKitProvider.tsx:60`, supplies the admin marker only
inside the admin) plus a `display: contents` box carrying `coachWarmAttr` (`lib/coach-warm-preview.ts:19`) for the
coaches portal, the account pages and the public pages. The marker wins from `html[data-user-theme]`, so the person's
Warm / Dark setting decides on every page, including public pages that wear a venue's colours. ⚠ Verify first: that
KitDialog under that wrapper picks up the paper fields and the themed scrim in Warm and Dark on the account page and on a
public tournament page (the account pages use their own `.warm` wrapper, `account.module.css:3`; the wrapper above makes
the window independent of it).

**B3 · Fields (A2, A3).** Use the club kit's field classes as `MessageFamilyWindow.tsx:154-163` does (`ck.field`,
`ck.label`, `ck.required`, `ck.input`, `ck.textarea` from `components/admin/kit/club/ClubKit.module.css`). Title: label
"Title", no suffix. Description: "Description" + `ck.required` star, `aria-required`, today's placeholders (:170) and
today's "Send waits for Description" rule (:179). Type: how other KitDialog forms render a one-value choice (find the
house dropdown — grep `ck.select` in KitDialog callers; memory "Form selects are dropdowns") with the values unchanged
(`bug`, `feature`, `feedback` — the DB CHECK and the inbox's Type filter depend on them); only the labels change
("Bug", "Feature request", "General feedback"). The words go in ONE constants file (e.g. `lib/feedback-words.ts`), as
`lib/families-words.ts` does — do not import the families constants into a feedback window. New or changed strings:
"Feature request", "General feedback", "Feedback sent. Thank you." and the ask's two buttons; keep the ask sentence as
`FAMILY_MESSAGE_WORDS.discardAsk`. Offer the owner a `/marketing` pass on them; `npm run check:spelling` must pass.

**B4 · Category (A4 option 1) — server side.** Stop sending `category` from the widget (:78 and the select :140-147 go;
`FEEDBACK_CATEGORIES` is no longer imported by the widget). In `lib/feedback-shared.ts`: (a) extend
`FEEDBACK_CATEGORIES` (:11-18) with the club's areas — the owner named Rep teams, House league, Families and Schedules;
propose any others (Calendar, Public site, Members and settings) in the PM summary, do not add them unasked; (b)
`validateFeedbackInput` (:75-78): when `category` is absent, derive it from `context.route` with `categoryFromRoute`
instead of falling to 'Other' — an old cached client that still sends `category` keeps working; (c)
`categoryFromRoute` (:25-41) is **first-match-wins on substrings**, so the order is the whole job: the club areas must
come before the `/schedule` → Tournaments (:34) and `/ledger` / `/budget` → Accounting (:27) tests, or House league's
`/seasons/[id]/schedule`, `/ledger` and `/registrations` (all real routes under `app/[orgSlug]/admin/house-league/`) and
every `/rep-teams/…/schedule` still land on the old buckets. Read the route tree (`app/[orgSlug]/admin/`: accounting,
calendar, families, house-league, org, public-site, rep-teams, schedules, tournaments) and unit-test one real path per
bucket in `tests/unit/feedback.test.ts`. (d) **`app/platform-admin/feedback/page.tsx:14` holds its own hard-coded copy of
the category list** (the inbox filter at :157-160 reads it): import `FEEDBACK_CATEGORIES` instead so the two cannot
drift again. (e) Update the `feedback_submissions.category` entry in `docs/agents/db/DATA_DICTIONARY.md` (:8709, "TS-only
enum …"); `npm run check:dictionary` is part of `verify:changed`. If the inbox page or export reads anything else from
the old list, find it with a repo-wide grep for `'Registrations'`.

**B5 · The ending (A5 option 1) — only if the owner still picks the pill.** The pill must outlive the window: the widget
sets an internal `sent` state, stops registering as an open window (`useOverlayOpenIfAvailable(open && !sent)`), shows the
pill in its own themed portal, and calls `onClose()` only when the pill finishes — so the hosts (which unmount on close)
need no change. Pill look: the admin's `NoticePill` (`RepKit.tsx:460`, lingers ~2.5s then fades, `onDone`) where the
window is the admin's; the coach portal and the account / public pages have no equivalent. Before writing a third pill,
decide with the owner whether to move `NoticePill` to a shared module (a new abstraction: offer `/simplify`) or draw the
pill once inside the widget. One Window Stage 3 plans a shared notice pill (Q13): if it has landed, use it. Keep
`role="status"`; the 202 "throttled" answer is a success to the person (`FeedbackWidget.tsx:89-90`), so the pill shows for it too.

**B6 · The closing ask (A6).** Copy the pattern in `MessageFamilyWindow.tsx:75-82` and `:119-134` — or, if Stage 2
shipped a shared one, use that. "Typed" is Title or Description non-empty after trim; changing Type alone does not count.
The close handler is the window's `onClose` (× / Esc / Back / Cancel); while asking, the same key is "Keep writing"; Escape
and Back do nothing while `busy` (KitDialog `busy`, :188). The refusal line "Could not send feedback." goes in the reason
slot: `FormError` (`components/admin/kit/club/money/MoneyKit.tsx:268`) portals into it today. Do not let the ask replace
the error: a failed send keeps the words typed.

**B7 · Tidy.** Delete `components/feedback/FeedbackLauncher.tsx` (no importer; only guards read it) and
`FeedbackWidget.module.css` (all hard-coded white-on-dark and `--font-data`) unless something token-only remains. Update:
`tests/unit/sidebar-strip-guard.test.ts:152` (reads the launcher — will fail on deletion; the `doesNotMatch(<FeedbackLauncher)`
lines at :151 and `tests/unit/nav-standard-guard.test.ts:149` are now empty promises, drop them); the `feedback` row of
`tests/unit/admin-overlay-guard.test.ts:67` (it reads an inline `zIndex` from the widget, which will be gone, so
`Math.max()` of nothing fails — point it at the `kitForm` layer or remove the row and say why); and the baselines
`scripts/.admin-type-baseline.json:299,303` and `scripts/.tsx-token-baseline.json:310` (`node scripts/check-admin-type.mjs
--init` lowers the first; find the second's `--init` in its script and lower by hand if it refuses). `components/feedback`
is a scanned folder in `scripts/check-admin-type.mjs:63` and `scripts/check-public-tokens.mjs:92`: anything you keep there
is tokens-only and body-face sentence case.

## Rulings not to reopen
- One Window Q1–Q16 (sentence-case labels, paper fields 36 / 6, widths 520 / 640 / 800, 24px, themed scrim, tinted edge,
  no stray-tap close, foot sentence, refusal line, 44px phone floors). This window follows them.
- Standing rules the asks rest on: one-value form fields are dropdowns; mark the few required fields, never the many
  optional ones, with a plain asterisk (red means something went wrong); a transient word fades and only an error
  persists; a disabled button fades (0.5) rather than vanishing.
- A phone form fills the screen with ← and covers the bar (drawer-layers ruling, 2026-09-23). The 44px coach tap floor
  is Stage 2's, not this project's.
- Out of scope, by the hub: making the two windows one look (that is One Window), the other global windows, the
  platform feedback inbox screen, the admin's faint field edges in Dark. **Do not touch `components/FeedbackModal.tsx`:**
  despite its name it is the old "are you sure" confirm (`ConfirmProvider`), not this window; One Window Stage 3 deletes it.
  Scorekeeper and check-in deliberately have no Send feedback; the demo sandboxes hide it.

## Guards
Add `tests/unit/feedback-window-guard.test.ts` in the repo's source-reading style (`tests/unit/_source-code.ts`):
- the widget no longer renders the global `modal-overlay` / `"modal"` markup or a bare-`document.body` portal without the
  themed wrapper; it renders the one window piece; it keeps `useOverlayOpenIfAvailable`;
- no `FeedbackWidget.module.css` (or, if kept, no literal colour, no `--font-data`, no `text-transform`), and no
  `FeedbackLauncher.tsx`;
- no "(optional)"; Type is a select, not a button row; Description carries `ck.required`; no Category field (if A4
  option 1); the closing-ask handler exists and `onClose` is not called straight from the Cancel button;
- `FEEDBACK_CATEGORIES` includes the club areas, and the inbox page imports the list instead of restating it.
Behaviour that is pure goes in `tests/unit/feedback.test.ts`: one real route per bucket, a club path that used to say
'Other', and "absent category + `context.route` → derived". **Mutation-check every assertion** (revert the line, see it
red, restore) and say which you checked. Keep green: `kit-dialog-foot-text-guard`, `kit-dialog-floor-guard`,
`admin-overlay-guard`, `one-window-stage1-guard`, `check:admin-type`, `check:spelling`.

## Verify
- `npm run verify:changed -- <files>`, then `npm run typecheck` (a shared component and `lib/feedback-shared.ts` change).
  If a check fails on a file you did not touch, report it; do not fix shared automation.
- `check:layout`: run `node scripts/check-layout-invariants.mjs --list` and see whether any screen opens this window; if
  one does, `--only=<ids> --workers=1` on the running dev server, Warm and Dark, 1280 and 390. If none does, say so — the
  owner's walk is the check. Never a whole-product sweep on the dev server.
- Files are added and deleted: restart the dev server before the hand-off (stop it BEFORE deleting `.next`, per
  `AGENTS.md`). Do not drive the browser for visual checks yourself; the owner tests in the browser.
- Help docs: the hub says no article describes this form's fields, only where to find it (confirmed for
  `lib/help-content/coaches.tsx:104-108` and `org.tsx`: they name the account menu and the More foot). Grep
  `lib/help-content` for "Category" and "optional" near "feedback" and say so; offer `/docs` only if an article does.

## Each step
Present the PM UX summary first. Then build, `/design` pass on the result before the walk (run it; do not only offer it),
offer `/simplify` if a new abstraction appeared (a shared pill, a themed-portal helper), then `/review`. The owner's walk
follows.

## QA walk (one purpose: the Send feedback window at every door)
Add it to `docs/projects/active/OWNER_QA_LEDGER.md` as the next free § (**§340 was the last at writing — re-check**; other
sessions add daily) and publish it on the hub's QA tab (the tab button and `#hub-qa` exist, hidden: show them; checkable
steps, a Copy-results paste-back, a "Sign in as" card). Parse the hub's page script before publishing (one unescaped
apostrophe in the data kills every tab). Accounts (all one password): club admin `uat-club-owner@uat-rep-club.local`;
tournament admin `uat-owner@uat-test-org.local`; Premium coach `uat-coach@uat-test-org.local`; free coach
`uat-free-coach@uat-free-coach.local`; a signed-in non-coach on a public page (the tournament admin visiting the public
site works). Cover: every door in the census (account menu in the club admin, tournament admin, Premium coach and free
coach; the admin phone More foot; the paid coach phone More foot; the free coach's team bar More; the coach's account
Help; a public page's account menu) × Warm and Dark × computer and phone where the door exists; the empty, typed, could-
not-send (DevTools offline) and closing-with-words states; one real Send per portal, then the inbox row at
`/platform-admin/feedback` (a Rep teams page now reads "Rep teams", not "Other"); that the confirm dialogs and every other
window are untouched; scorekeeper and check-in still have no Send feedback. ⚠ Signed-in senders are limited to one
accepted send an hour per user (`app/api/feedback/route.ts:70`; the person still sees success): tell the walker, and use
a second account for the second portal. Steps pin to identities, never to a figure that moves.

## Records
- Create `docs/projects/active/FEEDBACK_WINDOW_THEME_PLAN.md` and `FEEDBACK_WINDOW_THEME_PM_BRIEF.md` (AGENCY_RULES: a
  plan and a PM brief per significant feature; the hub's Full Plan and PM Brief tabs are the source — point at them, do
  not fork them). The plan records the rulings, the precondition, the as-built notes and the walk.
- Update: the TODO.md line (one line, links to the plan), the hub (Decisions rows; the stage strip with anchored facts only,
  "Built `<hash>` <date>"; the Mockup banner; the QA tab; same file path, and re-read the live copy fully with the Read
  tool before republishing), `memory/design_decisions.md`, the ledger, and the auto-memory file
  `project_feedback_window_theme.md` (and `MEMORY.md` if its line changes). Status wording: positive facts with anchors,
  never "not pushed" or "uncommitted".

## Commit (local only)
Only after the owner confirms. Stay on `dev` (`git rev-parse --abbrev-ref HEAD` first), stage explicit paths only, one
commit whose message says what changes on screen. `TODO.md`, the ledger and `memory/design_decisions.md` may carry other
sessions' uncommitted edits: commit only your own lines (memory `reference_partial_commit_shared_tree`: HEAD + your exact
block in a temporary index, `commit-tree`, compare-and-swap `update-ref`). Then `git show --stat HEAD` and confirm only
your files landed. **Do not push** until the owner says the 2026-10-19 release's staging sweep is done. End the message
with the attribution line from the session's system reminder.

## Context you would otherwise miss
- The admin frame carries BOTH `data-admin-kit` and `data-coach-warm-enabled` (`lib/admin-kit-marker.ts`); a coaches-marker
  rule also reaches the admin. `PortalKitRoot` returns its children bare outside the admin, which is why B2 adds the
  coach marker separately.
- The admin's plain `.modal` re-skin (`app/globals.css:2572+`) still serves the tournament's remaining global windows.
  Leave it.
- Description's hint changes with the type (:170); keep that. The route throttles quietly (202), so "Sent" does not mean
  "stored" for a second send within the hour; that is existing behaviour, not this project's to fix.
- Helper claims in this repo have been wrong before (two in Toolbar Rules Stage 1). Open what they cite.
- The task that opened this project pointed at `components/FeedbackModal.tsx`. That is the wrong file (see "Rulings not to
  reopen"); the Send feedback window is `components/feedback/FeedbackWidget.tsx`.
