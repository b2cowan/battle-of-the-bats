# Tournament admin redesign · Stage 2 build — Teams and registration, Communications, built to hub v16

> Paste into a fresh session on `dev`. Written 2026-09-30, the day the owner ruled Stage 2: T1, T3 and every ask
> (A13–A17) "I agree with your recommendations", after the `/design` review's twelve changes were applied to the
> drawing (hub v15) and the editable title corrected (v16).
>
> **The spec is the hub:** https://claude.ai/artifact/HQoRuEsKd7i6cAvCrMNzgM → **Stage 2** tab (v16 or later).
> - Build **to the drawings, exactly** (memory `feedback_build_to_approved_mockups`). Every NEW / RESTYLED /
>   UNCHANGED tag note on the tab is a requirement; open each one.
> - The tab's last section, **"The formatting check"**, is your checklist: every row, including D1–D12 (the
>   `/design` review).
> - Where you must depart, say so at build time and record why; never silently.
> - The asks' **unchosen options** (A13 options 2–3, A14 option 2, A16's lens, A17's shared row) are not built.
>
> **Read first:** plan `TOURNAMENT_ADMIN_REDESIGN_PLAN.md` §3 (F15–F18 re-read, F41–F46, "Re-measured 2026-09-30"),
> §6b (T1–T7, C1, C2 as drawn, the `/design` review, the taps), §7 (A13–A17), §9 (verification), §11 (the formatting
> check). Memory: `project_tournament_admin_redesign`, `feedback_portal_is_the_formatting_benchmark`,
> `feedback_build_to_approved_mockups`, `decision_edit_autosaves_create_asks`, `decision_autosave_word_is_transient`,
> `feedback_required_marker_not_optional_tags`, `feedback_form_selects_are_dropdowns`,
> `feedback_shared_component_over_shared_class`, `reference_code_gotchas_index`. The in-repo
> `memory/design_decisions.md` entries of 2026-09-30 (a record names its neighbours; a plan lock is never a dashed
> box) and 2026-09-29 (a row's worded action is olive; one lime per screen).
> **Stage 1's build is your model** (`TOURNAMENT_ADMIN_REDESIGN_STAGE1_BUILD_PROMPT.md`, commit `890d0aac`): it put the
> admin's row recipe (`ClubRow*` in `components/admin/kit/club/RepKit.tsx`, with `lead`, `captionFirst`, `beside`,
> `ClubRowBand`) inside the tournament screens. Use it; **never a second row recipe.**

## Preconditions (check before code)

1. **The dev server works.** Don't fix another session's code; tell the owner. Start it only with `npm run dev`,
   with network access.
2. **`/marketing` confirms the words before you build them.** The placement is ruled; the words are
   `/marketing`'s. Take this list in one run:
   - Teams: *At a glance* · *Registration health* and its caption (*Every division · 10 missing info*) ·
     *Payments* and its three figures (*$1,825 past due* · *$1,825 to collect* · *All collected*) ·
     *Registration open* / *Registration closed* and the sentence *"New teams can't sign up for U11 Girls. You can
     reopen it any time."* · the bands *To review*, *Waitlist*, *Accepted — needs a spot*, *No pool yet* · the
     captions *registered May 8*, *waits for an open spot*, *a spot is open* · *Accept*, *Promote*, *Place*.
   - The status word for a pending team: the game state is "Pending Review" (§245) and the club's tryouts say
     "Pending review". **One spelling** (AGENCY_RULES) — ask `/marketing` which, and flag the other as drift.
   - The record: *Mark paid · $475* · the payment line (*Owes $475 · deposit due May 28 · balance due Jun 7 · past
     due*) · *Resend the access link* · *Rejecting it frees Red Team 2.* · *Accepting puts Blaze on the list of
     teams that need a spot.* · *Delete this team…* · *‹ Previous* / *Next ›* with *3 of 8*.
   - Selection mode and swap: *2 selected* · *Done* · *Deposit paid* · *Paid in full* · *Send a reminder* ·
     *Move to pool* · *Tap two teams to swap their places*.
   - Communications: the filter *All · On the site · Emailed* · the row caption *Jun 13 · On the site, pinned ·
     Emailed to 18* · *Removed from the site* · *Start from* / *A blank message* and the five template names ·
     *Where it goes* · *Post to the public site* · *Pin it at the top* · *Show under* · *Email the teams* and its
     choices (*Accepted · Waitlisted · Waiting for a decision · Every registered team*; *Any · Owes · Paid*) ·
     *18 teams · every accepted team, all divisions* · *Push to fans' phones* · *Post and email 18* · the three
     lock lines.
3. **Ask the owner whether another session is measuring** before any probe, `auth-setup` or sweep. One browser
   tester at a time; scope sweeps with `--only=`.
4. **The UX summary for the owner comes first** (AGENCY_RULES). Keep it short, since the drawings are ruled:
   what an organizer sees differently on Teams and Communications, what the Tournament plan sees, and the one
   open placement below (**P1**).
5. **P1 · one placement the drawing does not show — put it to the owner in the summary, with a recommendation.**
   A13 puts Promote (a waitlisted team) and Place (a team that needs a spot) on the row only when a spot is open,
   and only on Tournament Plus (`waitlist_automation`, `lib/plan-features.ts`). The drawing shows Plus only.
   Today the Tournament plan sees a lime "Tournament Plus" / "Needs a slot" button on the row that opens a
   warning. **Recommend:** on the Tournament plan the row carries no button (one action per row, and a lock line
   does not fit a row); the record's Registration block carries the lock as one plain line (padlock · *Promote
   from the waitlist* · the Tournament Plus chip, opening Plan & billing — the 2026-09-30 lock rule). A
   needs-a-spot row's caption keeps today's truth that on that plan accepting fills the next open spot.

## ⚠ Running beside Club Tier Stage 3a (added 2026-09-30)

Club Tier Stage 3a (club money) was drawn the same day (its hub v20) with five asks open; its build prompt is
not written yet. When it builds, expect it split like Club Stages 1–2: a **server** session and a **screens**
session. The owner may start either while this build runs. What the two share:

- **The admin row recipe** (`RepKit.tsx` + `RepKit.module.css`) and **the form window** (`KitDialog.tsx` +
  `KitDialog.module.css`). This build changes the form window (Part 1). 3a's ask 5d proposes three more shared
  table parts (a void row, a band row that carries a total in its words, a blank on the empty side of a paired
  money column).
- **The old-look baseline** (`scripts/.admin-old-look-baseline.json`), which both lower.
- **The dev server, the UAT sessions, the owner's walks** and the shared docs (`TODO.md`, the Owner QA Ledger).

Five rules keep them apart:

1. **Part 1 (the shared kit) is its own commit, first after Part 0**, so 3a's screens start on it rather than
   beside it. Tell the owner when it lands: that is when 3a's screens session can begin. 3a's server session
   touches none of your files and may run beside you at any time.
2. **Neither session edits the other's files.** If 3a has uncommitted edits in `RepKit.*` or `KitDialog.*` when
   you reach Part 1, stop and tell the owner rather than editing around them. Whole-tree gates may fail on the
   other session's half-done edits: typecheck your commit's own tree in an isolated copy (`git archive` of the
   staged tree, `node_modules` junctioned in), run your tests by file, and report a failure in someone else's
   files.
3. **`check:old-look --init` reads the whole working tree.** Before running it, `git status` the baseline's other
   files; if the other session has any modified, run `--init` in the isolated copy of your staged tree instead,
   and commit only your files' lines of the baseline.
4. **Stay off the dev server during the other session's capture or sweep windows**; ask the owner before any
   browser use. Write code meanwhile: most of this build is code before it is proof.
5. **Stage by explicit pathspecs from a private index**; commit only your hunks of shared docs. Take the next
   free Owner QA Ledger § number at the moment you write the walk, after re-reading the ledger.

## Part 0 · The email reaches the teams it names (A15, ruled "fix now, as a defect") — its own commit, first

No look changes here beyond one lock line; the composer's redraw is Part 3. The owner may promote this commit
without the rest.
- **F42:** `app/api/admin/communications/route.ts` `resolveRecipients(tournamentId, null)` reads every team in the
  tournament (22 on the test event, including a rejected, a waitlisted and two pending teams) while the composer
  says "All accepted teams · 18". With no targeting, the send reaches **accepted teams only**: the composer's
  own words and the client's own comment ("always send to all accepted teams").
- The email's record ("Recipients") lists **who it actually reached** — the same set the send used.
- The free plan's 100-recipient cap counts **the recipients**, not every team.
- **F43:** a site post's "Division visibility" renders on every plan, and the send refuses a division filter
  without `targeted_tournament_announcements` with a 403 after the message is written. On the Tournament plan,
  show it as one lock line with the plan's name (A6; no dashed box), opening Plan & billing's Tournament Plus
  panel. No gate changes.
- **Proof:** a route test that a rejected, waitlisted and pending team are not recipients when targeting is null,
  and that the record lists exactly the recipients. Re-run the read-only probe `.probe/s2/recipients.mjs`: 18,
  not 22.

## Retire the old look as you rebuild (definition of done)

Every file this stage rebuilds loses its old look in the same build; the method is Stage 1's (its prompt's
"Retire the old look" section: fold `kx()`, drop `useAdminKit()` false branches and `legacy` props, fold
`[data-admin-kit] .x` rules one at a time with the kit-shadow and background-shorthand audits, keep every
`:where(:not([data-public-preview] *))` guard). `npm run check:old-look:report` today:
- `registrations/page.tsx` — kx 14 · helpers 1; `registrations/teams-admin.module.css` — kitScope 233.
- `communication/page.tsx` — kx 7 · helpers 1 · legacy 1; `communication/communication.module.css` — kitScope 52.
- `RegistrationHealthPanel.tsx` carries none; rebuild it to the drawing all the same.

Lock in every drop with `--init` in the same commit (rule 3 above). **Never fold:** `globals.css`'s kit layer,
`BottomSheet`, `ExportMenu`, `CollapsibleCard`, `admin-common.module.css`, the shared tournament header and
toolbar parts in `components/admin/tournament/`, and the shared helpers (`useKitStyle`, `kitStyler`,
`useKitButtons`, `useKitAsterisk`). Report what was retired and anything left.

## What to build (all ruled 2026-09-30)

### Part 1 · The form window learns a record's two new parts (own commit; shared kit)

Both are the portal's own answers, now on the admin side (design decisions 2026-09-30). The club's records
will use them when their stages draw them, so they belong to the kit, not to Teams.
- **Named Previous / Next at the foot, with the position between** — "‹ Previous · Falcons U11 Girls" · "3 of 8"
  · "Next › · Ravens U11 Girls" (the desk reads "3 of 8 in U11 Girls"). Two lines per button (the small word,
  then the name, cut with an ellipsis), 48px on a phone and 38px at a desk as drawn. It goes in `KitDialog`'s
  `footer`. Stepping keeps the window open and moves to the neighbour in **the order of the list it was opened
  from**. The drawing shows no end of the list: match how the portal's depth-chart player (register F-43)
  handles its ends, and say what you did.
- **The record's name as its editable title**: the bill room's form (`CommitmentView.tsx`,
  `commitTitleField`): a dashed rule at rest and a pencil beside it, **no required marker** (the title-slot
  exemption), an empty name refused in words and never sent by autosave. The window's accessible name stays the
  record's name while it is edited. Read-only viewers get the plain heading.
- Nothing else joins the kit. A17 is ruled: **Teams keeps its own selection mode.** `ClubRow`'s `beside` and
  `ClubRowBand` already exist. If you find a band or row needs something new, that is an ask to the owner, tagged
  "shared — Club Tier 3a draws tables too", not an invention.

### Part 2 · Teams (`registrations/page.tsx`, `teams-admin.module.css`, `RegistrationHealthPanel.tsx`)

**T1 · Teams opens on the teams.**
- The title band as Stage 1 built it (Export · Registration questions · **Add team**, the screen's one lime ·
  Help).
- **One toolbar line:** the division dropdown (its options say "· 1 to review"), then Select many · Swap ·
  Randomize at 44×44. **Randomize wears the shuffle mark** (lucide `Shuffle`), not today's reload arrows.
- **"At a glance"**: one white section card, its 16/700 heading inside, three closed rows with hairlines:
  - **Registration health**: the score with its scale as the lead mark (*78/100*), the caption *Every division ·
    10 missing info* (only what no neighbour says), a down chevron; it opens to today's panel. **Keep the
    `registration-health` anchor on this row.**
  - **Payments**: this division; *$1,025 of $2,850 in*; one figure in three states: *past due* in the danger
    ink only once a due date has passed, *to collect* in plain ink before, *All collected* when everything is in.
    **Closed by default**; today's panel opens open and remembers it, which is what pushes the list down, so
    don't carry the old open state forward.
  - **Registration open**: *6 of 6 spots · full*, a down chevron. It **expands in place**; opened, one sentence
    and **Close registration** (olive, 44px). Closed, it reads *Registration closed* and opens to **Reopen**,
    which keeps today's warning when the schedule is published.
- **The counts card goes** (each fact is said once elsewhere).
- **Targets (measured from the drawing, 390 phone, the test event's U11 Girls):** the first team at **≈469px**
  (today 783), **3 teams** above the phone bar (today none). Desk 1440: **≈519px** (today 687).

**T2 · A pending team is on the screen (F41, A16 as recommended).**
- A division's pending teams are **the first band, "To review"**, each row *Coach Blaze · registered May 8* with
  a worded **Accept** beside the chevron (olive; 44px on a phone, 38px at a desk, where it appears in that band
  only — G4's desk rule).
- **Teams opens on the first division with a team to review**, else the remembered one. The context strip's
  "N teams to review" and the rail's Teams badge land on that division (`AdminContextStrip.tsx:104` links with
  no division today; `focusAttentionBucket` keeps the selected division).
- **Accept: 5 taps → 2** (the row's Accept, then the confirm that says whether an email goes).

**T3 · A row opens the team (F45).** The whole row is the button; it opens the team's record in the kit's **form
window** (full screen with ← on a phone, the phone's Back closes it; a window at a desk). In order:
- The title (Part 1's editable name), one status chip (T5) + *Red Team 2 · Red Pool · U11 Girls*, "Saved" per
  the transient-word ruling.
- **Payment first**: the payment line in facts (above), **Mark paid · $475** (Check-in's own sheet button), and
  the two amounts, saving as they change.
- **Coach**: head coach, registered by, registered (**house dates**, never `toLocaleDateString()`), and
  *Resend the access link*, worded, still asking.
- **Team details save as you go** (coach, email, seed). The name is edited in the title only, and the Edit window
  retires (edit autosaves, 2026-09-24). **Seed is absent for an Exhibition.**
- Admin notes; Registration answers.
- **Registration**: Reject for an accepted team (*Rejecting it frees Red Team 2*: true, `api/admin/teams` releases
  the slot).
- **Delete ends the body**, alone, red, asking first (today's two-step for a team with games kept).
- **The foot:** Part 1's Previous / Next, in the list's order (the review band, then the pools, then the waitlist).
- **A pending team's record opens on the decision:** Accept (the record's one lime) · Reject, with the sentence
  that says the truth about a full division (`claimNextOpenSlot` returns null when full). Nothing new is offered
  (no single-team "Move to waitlist").
- **Tap targets:** open a record 1 → 1; **a payment run** per team: today its chevron + typing the amount → drawn
  **Mark paid + Next**, no typing.

**T4 · The pool board's shape (F16, F40).**
- One frame per division: a band per pool with its fill (*Red Pool 3 of 3*), the waitlist and *Accepted — needs a
  spot* as bands in the same frame.
- Each team is one row (the name, then *Red Team 2 · Coach Storm · Owes $475*). No status badge under a pool band.
- **Swap mode:** a note with the kit's accent edge (`Callout`) — *Tap two teams to swap their places* + Done —
  replaces the toolbar line while on. Each row's chevron becomes a 44px swap mark; the first choice shows by its
  mark turning olive; **the row is never tinted.** Rows don't open while swapping. **Move a team to the other
  pool: 4 → 4**, every target 44px.
- **A13 as recommended:** Accept on To review; **Promote** on a waitlisted team and **Place** on a needs-a-spot
  team **only when a spot is open** (Plus; the Tournament plan per **P1**); nothing on a placed team. Reject,
  Waitlist and payment live in the record. With no open spot there is no button, and the caption says *waits for
  an open spot* (today a lime "No Slots" that does nothing).
- **Selection mode (A17, Teams' own):** a 22px tick leads each row (the whole 60px row toggles it). The note says
  how many and holds Done. **The bar docks above the phone bar** while selecting, in two lines: Accept · Waitlist ·
  (Reject, set apart, plain ink); then Deposit paid · Paid in full · Send a reminder (+ Move to pool where a
  division has pools and no slots). Olive on white, no lime. Today's actions only: nothing added or removed.
- **At a desk Teams is a table**: Team · Coach · Slot · Payment, the pools, review queue and waitlist as band rows,
  the heading row in the display face. Status is not a column (the band says it).

**T5 · One colour per status, words not glyphs (F17).**
- The band says a team's status once. Where a chip shows (the record; a row whose status differs from its band),
  it uses **the club tryouts' tone map** (`TRYOUT_STATUS_TONE`: pending warn · accepted good · waitlisted and
  declined neutral). No new tone; rejected is neutral.
- Payment reads as Check-in does: *Paid* plain, *Owes $475* amber. The 9px letters and 7px "$" glyphs go.

**T6 · A division without pool slots, and Exhibition.**
- Bands are statuses (To review · Accepted · Waitlist; Rejected only when chosen in the view).
- **What doesn't apply is absent:** no Pools grouping where a division has no pools, no "Pools aren't turned on"
  note, no Randomize.
- A division with pools but no slots keeps the grouping (bands = pools + *No pool yet*). Its in-row pool dropdown
  moves into the record and the bulk *Move to pool*: +1 tap for one team, bulk unchanged.
- **Exhibition changes one thing on Teams: Seed is absent.** It keeps its pools (`lib/public-pages.ts`: "An
  Exhibition HAS a round robin").

**T7 · The Club seams, as today.**
- Payments stays this stage's closed row; fees reaching the club's ledger is Club Stage 7's.
- *Add my team* is a star in the title's icon line while it applies; the *Your team* chip goes in the record's
  identity line.
- *Link to a rep team* is a line in the record's Coach block, opening today's picker.

### Part 3 · Communications (`communication/page.tsx`, `communication.module.css`, the send route)

**C1 · One list (F44).**
- One announcement row is one message: the data already holds `channel_site` and `channel_email` on the one
  row, so a message sent both ways is one row, not two.
- Each row: the title, then *Jun 13 · On the site, pinned · Emailed to 18*. A failed send is the one coloured word.
- One filter pill: *All · On the site · Emailed*. *Removed from the site* is a band at the foot; the record is
  kept, so "removed", not "deleted".
- Every row opens today's Edit Post or Email Details, in the kit's form window.
- The empty state keeps one sentence; the header's + is its one action (no second lime).
- At a desk, a table: Date · Message · Where it went · Reached.

**C2 · The composer says the true thing (F18, F42, F43; A14 as recommended).** The kit's form window, full screen
on a phone.
- **Start from**: one dropdown, *A blank message* first, then the five templates (free on every plan, as today).
- **Title \*** and **Message \***: the plain asterisk in the label's ink.
- **Where it goes**: a plain block (the tinted Channels panel goes), 22px boxes on 44px lines.
  - *Post to the public site* → *Pin it at the top* → **Show under**: today's multi-division checklist, at 44px
    lines.
  - *Email the teams* → **the picker (A14), for Tournament Plus, League Plus and Club** (the key
    `targeted_tournament_announcements`): three dropdowns — Teams (*Accepted · Waitlisted · Waiting for a decision
    · Every registered team*), Division (one or all), Payment (*Any · Owes · Paid*). Under them, a **live count**,
    and the send button says the same number (*Post and email 18*).
  - *Push to fans' phones*.
- **The count and the send are one definition.** The count comes from the route's own recipient rule (a dry run
  of `resolveRecipients` with the same targeting), never a second copy in the client. The send already accepts
  `targeting` (divisions, statuses, payment states, team ids) and gates it; the composer sends `null` today.
- **The Tournament plan** sees the email line *18 teams · every accepted team* and **each Plus choice as one plain
  44px lock line** (padlock · the words · the plan's chip; no dashed box), opening the `?plan=` door. No price, and
  no gate changes.
- Reconcile against `docs/agents/strategy/PLAN_PRICING_FACTS.md` (the Plus email row sells "segmentation"). Its
  templates and delivery-tracking drift (F44) is `/strategy`'s: report it, don't change it.
- **Message every team: 3 → 3**, to the teams it names.

## Don't

- Build Club Stage 7's fees-to-ledger, the admin frame, rail, bar or strip, public pages, the schedule, or
  anything in Stage 3+.
- Change prices, plan names or gates. Write customer copy yourself.
- Add a second row recipe, a shared selection row (A17), a new chip tone, or a multi-select dropdown.
- Tint an item row, put a dashed box round a lock, or put a required marker on a title.
- **Keep the demo tour anchors:** `registration-health` on the health row (whether the tour should still OPEN
  it is `/demos`' call, F46: report, don't change the tour), `post-event-summary` and `now-playing` untouched.
  The tour-anchor guard must stay green.

## Verification

- `npm run verify:changed`, and `npm run typecheck`, since the shared form window, the context strip and a send
  route are touched.
- **The layout sweep's `admin-t-*` entries for Teams and Communications** at 390 / 360 / 768 / 1440, in both
  themes. One runner at a time, scoped with `--only=`; contrast 0/0 in both themes.
- **Probes** (in `.probe/`), asserting on state, never a guessed delay:
  - the first team's top on Teams at 390 ≤ **469px** with **3** teams above the phone bar; at 1440 ≤ **519px**;
  - accept a pending team: **2 taps**; open a record: **1**; a payment run: **Mark paid + Next** per team;
  - move a team to the other pool: **4**; message every team: **3**, and the recipients equal the count shown;
  - the context strip's "to review" lands on the division with the work;
  - nothing an organizer taps is under 38px tall at touch widths, or under 44px wide for an icon-only control.
  - Reuse `.probe/s2/probe.mjs` and `.probe/s2/recipients.mjs`, both read-only.
- **The Tournament plan:** each lock line opens Plan & billing's Tournament Plus panel; no division choice fails
  at send.
- Re-measure the built screens against the hub's figures and report any gap.

## Close-out

- **Offer `/simplify`, then `/review`**, before the commit: a new shared part in the form window.
- **Commit only when the owner says**, on `dev`, from a private index, explicit pathspecs, then `git show --stat
  HEAD`. Commits: Part 0 · Part 1 · Parts 2–3 (one per logical part is fine).
- **Help:** `/docs` for Teams, registration and Communications, including `keywords` / `searchText`, since the
  flow changes (Accept from the list, the record window, targeting).
- **An owner walk:** a checkable Artifact on the project hub's QA tab. The hub is ONE artifact, so republish the
  same URL. Give it one purpose ("Teams and Communications from a phone"), a numbered Owner QA Ledger §, and pin
  identities, not figures.
- **Record:** the plan's status header and §6b as built with commits; the hub's stage strip (Build); the TODO
  line; memory `project_tournament_admin_redesign`; `PROGRAM_TOURNAMENTS.md`'s pointer.
- **Migrations:** none expected. If one appears, update the data dictionary in the same unit of work.
