# Bank check through a volunteer's eyes — plan of record

**Status:** STARTED 2026-11-08. Every owner ask is ruled (§0). **S1 built 2026-11-08** (§4; commit hash goes in §4
when committed; owner walk owed). Next: S1b (`BANK_CHECK_NOVICE_UX_S1_BUILD_PROMPT.md`, Session B). PM brief:
`BANK_CHECK_NOVICE_UX_PM_BRIEF.md`.

**Source:** the evaluation "The Volunteer's Bank Check" (2026-11-08), published at
https://claude.ai/artifact/SDTnvjwNmq5HUUhAyj7BVF (v3), source `.probe/bank-ux-eval/claude/artifact.src.html`, built by
`.probe/bank-ux-eval/claude/build.mjs` into `docs/projects/active/BANK_CHECK_NOVICE_UX_EVALUATION_CLAUDE.html`. Its
**Words** tab (rows 1–25) and **End state** tab (drawings D1–D6) are this plan's spec; this file does not restate them. Its
verdict: *helpful, and buried* — the check is right for a volunteer; the way to it and the words around it are not yet.

The bank check itself (balance check BC1–BC9, working draft WD1–WD3) is built, walked and committed; its plan is
`docs/projects/archive/BANK_RECONCILIATION_PLAN.md`. Nothing here reverses a ruling recorded there except where §0 says so.

---

## 0. Owner rulings (2026-11-08)

The owner added A17 and A18 and ruled them, then ruled "agree with the rest of the recommendations": every other ask
takes the page's recommendation.

| Ask | What | Ruling | Stage |
|---|---|---|---|
| A1a | Card heading and labels: "Check your bank balance", "Date" | Reshape | S1 |
| A1b | The list, windows, print title, season windows drop "statement" | Reshape | S1 |
| A1c | Club start card: lead names which statement and why; label "Date" | **Folded into A17** (the start card is redesigned there) | S1b |
| A2 | View pill option reads "Balance check" | Reshape | S1 |
| A3 | Overview bank line in every season stage, an invitation until the first check | Reshape | S2 |
| A4 | A purpose line on the check card, always | Reshape | S1 |
| A5 | "Record a bank fee" / "Add a bank fee" beside the missing-amount door | Reshape, through `/accounting` | S3 |
| A6 | The printed check names its method | Reshape (the method line), through `/accounting` | S4 |
| A7 | "The same $4.50 as your last check" | Reshape | S3 |
| A8 | The coach's cash field behind a quiet link | Reshape | S1 |
| A9 | Phone: a second Save under the band while Find is open | **Not yet** — re-measured after S3 | S5 (parked) |
| A10 | The Overview line carries the age of the last check | **Not yet** | S6 (parked) |
| A11 | No-team-account: the neutral sentence now; the personal-account position later | Reshape (sentence) · position Not yet | S1 |
| A12 | A reader-only Accounting seat | **Not yet — route to `/plan`** | outside |
| A13 | When no line explains the gap, the list waits behind "Show them" | Reshape | S3 |
| A14 | A bank row on the team home's Season check card | **Not yet** | — |
| A15 | "Print any check you want to keep first" in the season windows; the money shelf later | Reshape (sentence) · shelf Not yet (P4's own session) | S1 |
| A16 | The club's Bank tab keeps the chosen account across a reload | Reshape | S2 |
| A17 | **The club starts from the first statement's opening balance, then checks that statement** | Reshape (owner, 2026-11-08) | S1b |
| A18 | **Start working on a statement, save it for later, then save the check** — the full version, draft on the server | Reshape (owner, 2026-11-08) | S7 |

**A17, as ruled.** Owner read the start card's "Statement date / Bank balance on that date" as the statement he wanted
to check, which would have made that statement's own lines part of the unchecked baseline. The card asks for the FIRST
statement to check: the day it starts and its opening balance (both printed at the top), and says nothing dated before
that day is compared with the bank. Saving opens the check form on that same statement for its end date and ending
balance. Everywhere the start is named it becomes a starting balance dated the day checking starts. Which statement the
card suggests (the year's first or the most recent) is "fine either way"; help says the year's first checks the whole
year. Club only: a team starts from its season's opening balance.

**A18, as ruled (the full version).** "Start checking this statement" fixes the date and balance in a strip at the top of
the card with a Change link; Find and the gap work sit under it; the card ends with "Save for later" and "Save this
check". The draft is kept on the server, per person and per account, so it follows the person to another device.
**This reverses working-draft ask 1** (this browser only, ruled 2026-11-07, `BANK_CHECK_WORKING_DRAFT_PLAN.md` §5) and
replaces "Kept in this browser only, until you save this check or sign out." The cheaper middle (keep the browser draft,
change only the card's look) was turned down: a "save" button must not promise more than one browser keeps.
**Open for S7's drawing session:** whether a second treasurer or coach sees someone else's draft (WD ruled shared drafts
out); how long a saved-for-later draft lasts (the browser's: 14 days); both portals (assumed yes, as the working draft is).

---

## 1. What A17 overtakes in the page's spec

A17 was ruled after the Words tab and the drawings were written, so these belong to S1b, not S1, and are rewritten there:

- **Row 5**, the club start card's label part only (the check form's "Date" stays in S1).
- **Row 9**, the club band caption: "since your starting statement of Oct 31" becomes "since checking started Nov 1"
  (the day after the stored start).
- **Row 14**, the saved list's start cell ("Starting point" → "Checking started here"): S1b decides it with the rest of
  the start's names.
- **Row 17**, the start card lead — replaced by A17's lead.
- **Row 18 and drawing D5**, the same-day dead end — **gone**: the latest a start can be is yesterday, so no sentence.
- **Drawing D4**, the start card — redrawn in S1b.

**Row 10 and S7.** Row 10 merges three notes into one. S1 writes it but leaves the draft's own sentence ("Kept in this
browser only…") as it is: S7 replaces that sentence, so S1 must not polish it.

---

## 2. Stages, by dependency

No dates and no release timing. Each stage ends with its own reviews and a short owner walk (a checkable page, one
purpose per walk, a § in the Owner QA Ledger).

### S1 — Words, both portals
Rows 1, 3, 4, 5 (the check form only), 6, 7, 8, 10 (see §1), 11, 13, 16, 19, 21, 22, 23, 25, plus A15's sentence in both
season windows and the help fixes: the club article's read-only paragraph (T9, a defect: club read = write today) and
"Print this check" is "on a computer". `/marketing` settles the strings first (its first pass is already folded into the
Words tab); `/design` on the changed cards (A8's link moves a field; A4 adds a line). Help articles in the same unit.
- **Depends on:** nothing. **Asks:** A1a, A1b, A2, A4, A8, A11, A15. **Risk:** low.
- ⚠ Row 3 bends the BC2a `/marketing` word ("Check a statement") and row 11 bends the cash field's 2026-11-0x placement —
  both now owner-ruled (A1a, A8); record that in the archived plan's §0 pointer, not as drift.

### S1b — The club's start is a statement's opening (A17)
Redraw D4 (the start card) and the check form as it opens after a start, run `/design` on the drawing, owner yes, then
build. Then the start's names everywhere (saved list row and phone card, the start's window and its delete words, Find's
"since" headings, the look-back heading, the printed check's starting-point line, the refusal sentences, Help), and rows
9, 14, 17 per §1. No migration: a start row keeps meaning "the balance at the end of day D"; the card stores the day
before the one typed and every screen shows D + 1.
- **Depends on:** S1 (the card's words settle once). **Asks:** A17 (A1c folded in). **Risk:** low.
- **An early build exists** (2026-11-08, built ahead of the project and taken back out of the working copy): patch
  `.probe/bank-ux-eval/A17_START_CARD_EARLY_BUILD.patch` (73 hunks, 16 files incl. tests and the data dictionary note;
  applies with `git apply --unidiff-zero`). It passed the bank tests (438), typecheck, lint, spelling and the dictionary
  check at the time. S1b may re-apply it after the redraw and S1's words, then reconcile the strings with `/marketing`;
  it is a head start, not the spec. Its one judgment call: the end date after a start is left empty (no guessed
  month-end).

### S2 — The door
The Overview's bank line in every season stage, worded as an invitation until the first check, both portals (row 2, D3);
a "How the bank check works" link on the head line (row 20); the coach's View pill writes the chosen view into the
address; the club's Bank tab writes the chosen account into the address the same way (A16).
- **Depends on:** S1 (the line's words). **Asks:** A3, A16. **Risk:** low.

### S3 — Find's doors and its quiet list
"Record a bank fee" (coach) / "Add a bank fee" (club) when the bank took out money nothing explains; "Record interest" /
"Record a deposit" when it received money nothing explains; each opens the ordinary window with the fee named and filed,
amount and date filled (row 12, D2). The list waits behind "Show them" with a sentence that says why (row 24, A13); desk
rows show "Not in the bank yet" without hover. "The same $4.50 as your last check" (A7). A Bank fees word in the coach's
default library.
- **Depends on:** S1; **`/accounting` review before handing off** (a new default item; Off-plan on Budget vs. Actual until
  budgeted). **Asks:** A5, A7, A13. **Risk:** medium (touches the Record money prefill and the club's category words).

### S4 — The printed check names its method
One method line above the items on both portals' printed checks (row 15, D6).
- **Depends on:** nothing; any time after S1. **`/accounting` review** (it changes what the product prints about money).
  **Asks:** A6. **Risk:** low.

### S5 — The phone's second Save (parked, A9 Not yet)
After S3, measure Save's distance on a phone with Find open. If it is within a screen once the list waits behind "Show
them", drop the stage; if not, bring it back to the owner as an ask with the measurement.

### S6 — A rhythm (parked, A10 Not yet)
Not built. Re-raise only if the owner asks.

### S7 — Start, work, save for later (A18)
Its own owner mockup session first, drawn from the cards as S1–S3 shipped them (draw a control from its shipped
component): the pinned strip with Change, the work area, "Save for later" and "Save this check", both portals, phone and
desk; the session settles the three open questions in §0. Then the build: a server-kept draft per person per account
(new stored record → `/dba`, the data dictionary and snapshots in the same unit; a light `/legal` look, since it keeps
something new about a person's work), replacing the working draft's browser storage on both portals and its resting
sentence; the walked working-draft cards change shape and their walks are redone. Likely two or three sessions.
- **Depends on:** S1, S1b, S3. **Asks:** A18. **Risk:** high.

**Order:** S1 → S1b → S2 → S3 → S7 (drawing session, then build). S4 may run any time after S1. S5 is decided after S3.

---

## 3. Outside the ladder
- **A12** — a reader-only Accounting seat for a board member: a `/plan` item, not this project.
- **A14** — not built.
- **A15's shelf** — saved checks belong on the closed season's money shelf (P4 of the season-close plan) when P4 has
  its own owner mockup session; nothing here.
- **The demo** has no bank step; a `/demos` pass decides whether the shop window earns one.
- **What's new** — drawn, not built; the bank check is a natural first entry when it ships.
- **The other evaluation page** (`BANK_CHECK_NOVICE_UX_EVALUATION.html`, another tool's run of the same prompt): its
  findings are mapped onto these asks on the Claude page's "Codex compared" tab.

---

## 4. Record

- 2026-11-08 — Project started. All asks ruled (§0). Plan, PM brief and the S1/S1b build prompt written. The early A17
  build was saved as a patch and taken out of the working copy (only its own hunks; another session's Account-pill and
  help hunks in the same files left in place); bank tests back to 434/434.
- 2026-11-08 — **S1 built** (both portals). Rows 1, 3, 4, 5 (form), 6, 7, 8, 10 (the draft's own sentence left for S7),
  11, 13, 16 + A15, 19, 21, 22, 23, 25; the band's first caption ("Bank balance on {date}", drawn in D1); the help
  (club article's read-only paragraph made true; both articles' words, keywords and searchText; the coach Ledger
  article's "fourth view"). `/marketing` final read (helper) changed the page's proposals in five places: list
  "Balance checks" (a bare "Checks" reads as cheques, A2's reason), row 7 "from {date} to today", the hint "posted
  balance … with pending transactions left out", row 10 two sentences without the amount, row 21 one neutral line
  ("{date} is checked already…"; the toast already says "Checked"), row 22 "expected {date}"; "Bank check" →
  "Balance check" on both printed eyebrows and the coach's printed path (one name). Kept the page's row 4 last
  sentence over the helper's rewrite (shorter, matches help). Three coach day refusals lost "statement"
  (`before_season`, `ends_in_future`, `bad_team_item`). Placement: the coach's note line sits under the fields on desk
  and phone (D1/D2); the club card's notes keep their place. `/design`: purpose line in the quiet ink (D1's `p-lead`),
  the cash link's tap box trimmed to the note's rhythm on a phone; the team-only sentence shows on the phone too
  (D1's phone frame omitted it — **owner call, recorded here as built**). `/review` (standard): 3 lenses, 4 fixed
  (restored-draft cash field folding mid-edit, an empty note line, the coach's saved window still saying "books", the
  Ledger help's "fourth view, Bank"); 0 refuted as false claims. `check:layout --changed` NOT run (other sessions'
  shared-chrome edits widened it to 352 screens and the free-coach fixture is broken; not repaired, shared); a
  read-only probe walk (`.probe/bank-ux-s1/walk.mjs`) covered both cards at 1440/800/390, no overflow. Bank + help
  tests 462/462; typecheck, lint, spelling clean. Archived plan §0 carries the A1a/A8 pointer.
  **Left for later stages (not misses):** the printed check's title and "Bank balance on the statement", and the coach's
  printed "What your books should say" / "Your books on" / "Books now say" (S4, the printed page as one unit); the
  Overview's "Bank:" line (S2); the start's refusals and names (S1b).
