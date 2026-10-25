# Platform admin support console · Stage 2, Find, the menu by job, Today, the customer record (drawings prompt)

> Paste into a new chat on `dev`. Written 2026-10-25, the day the owner passed the Stage 1 walk (ledger §371, 45 of 45).
> **This session draws and asks. It builds nothing.** The output is a drawings Artifact, the owner's rulings on it, and
> then a Stage 2 build prompt (written last, like Stage 1's). **Re-verify every lead against the code before you draw
> on it:** this prompt is a lead, not evidence, and so is any helper's summary. The working copy is shared with Club
> Tier and Bookkeeping sessions: stage explicit paths only, check the branch before every commit, `git show --stat HEAD`
> after it. Commit nothing without the owner's OK.

## 1 · What Stage 2 makes true (the objective)

A support person starts every job the same way: *find the customer, read what has happened to them.* Today that is two
unrelated searches (neither reaches a Stripe number), a 1,000-account silent cap, a front door of five figure tiles,
and a club record about 2,000 px tall that opens on edit fields. Stage 2 fixes the front half of every job:

1. **Find**: one box in the top strip, on every page. People (email, name), clubs (name, web name, owner) and Stripe
   numbers (customer, subscription, charge) in one grouped list. A person shows their clubs beneath. No 1,000 cap.
   Card digits are deliberately not a search key.
2. **The menu by job**: Customers · Health · Growth · Product · Records, then Bookkeeping's private group last, where
   it sits today. Roles trim it. Help and Collapse stay at the foot.
3. **Today**: the front door becomes *what is waiting on us*, grouped by job (Customers, Health, Growth, Product), with
   a one-line "is everything up" strip. Replaces Overview's tiles-then-queue page.
4. **The customer record reads first**: opens on its **Story** (one dated list: what happened, who, why), with the
   chips and a figure band above it. Edit forms move behind a deliberate door (a record reads first and edits whole,
   R2). The tabs become Story · Money · Access · People & tournaments.
5. **One rulebook**: the menu, the pages and the APIs agree on who may do what (today the area matrix says nobody
   writes Organizations while support, billing and product do, via the older permission table).

**Not Stage 2** (later stages; do not draw them as if built):
- the Money tab's Stripe reads and refunds (S3);
- Give free time and Founding as a grant group (S4);
- the Status page and the health line's data (S5);
- the sent-email log (S5);
- the reason column in the audit log (S3).

## 2 · Standing rulings (do not reopen)

- Plan "Owner rulings 2026-10-24" and the standing rules **R1–R8** (one place to find a customer · a record reads
  first and edits whole · every live change confirms in one sentence · every change records who and why · undo is "Put
  it back", never for anything that reached Stripe or an inbox · read-only shows as a record without controls · the
  money truth is shown, never remembered · plain words, in the product's look).
- **Q1:** menu by job, roles trim it. **M3 (Billing loses Support's account powers) was NOT ticked: it is open.**
- **Q2:** confirm + reason on every live change; "Put it back" for plan, limit, section and free time.
- **Q4:** desktop only; Today (and Status later) readable on a phone.
- **Stage 1 is done and walked** (§371): shell = strip, folding menu, Help and Collapse at the foot, account menu with
  Appearance and Sign out; the portal is "Support console"; Help opens in place; sign-in always warm. The strip's
  middle is empty on purpose, waiting for Find. All eight Stage 1 build calls were accepted as built.
- D1–D5 and F1 (heading above the card; white buttons, one lime per screen, olive text for a door; data face only for
  codes; the nav standard in full; a pick-one is a dropdown or radio rows).
- Warm is the default; Dark follows the account setting. Draw both.

## 3 · Read first

- The end state: https://claude.ai/artifact/RCpPoxNNxGDfiC4FFo4m1g (source `PLATFORM_ADMIN_SUPPORT_CONSOLE_END_STATE.html`).
  **Screens 1–3 are Stage 2's starting drawings**, with the S2-tagged parts. They were drawn *before* Stage 1 existed:
  redraw them on the real shell (capture it from dev), do not copy them.
- Stage 1 drawings https://claude.ai/artifact/7DWPUBp9cDp26a2P359zLW for the format owners already approved (true size,
  Warm and Dark, before = a capture from dev, NEW / RESTYLED / UNCHANGED tags, each clickable with its reason).
- The walk https://claude.ai/artifact/2sNNCtRUJWi9PSE1QDmCDq (Walk A by role, Walk B by intent; tasks 4–12 are the
  Stage 2 jobs: find by email, the subscription story, a mid-season plan change, can't sign in, "I never got the
  email").
- `PLATFORM_ADMIN_SUPPORT_CONSOLE_PLAN.md` (ladder row S2, "What exists", kickoff findings) and the PM brief.
- Project index https://claude.ai/artifact/TLP8d5Zec4xVkTSYrQU8tp: news goes in as an `ArtifactData` write to
  `stages/s2` and `log/…`. Never republish it.
- `docs/agents/design/NAV_STANDARD.md`, `TABLE_AND_LIST_STANDARD.md`, the head of `memory/design_decisions.md` (the
  2026-10-24 entries and the 2026-10-19 type rulings).
- `AGENTS.md` and `AGENCY_RULES.md` (PM UX summary before code; disagree out loud).

## 4 · Verify these leads first (the plan has been wrong before)

| Claim | Check against |
|---|---|
| Customer Users loads 1,000 accounts and filters in the browser | `app/platform-admin/customer-users/page.tsx`. What does the Supabase admin API actually let you search server-side (email, name)? **If it cannot search by name, say so before drawing a Find that promises it.** |
| The area matrix and the legacy permissions disagree on Organizations | `lib/platform-areas.ts`, `lib/platform-auth.ts`, the org routes. List every route and what each role may do, as a table. This is the "one rulebook" input |
| Story could be built from what is recorded today | Which events exist *now*: `platform_audit_log`, plan changes, overrides, notes, email campaign sends? Account emails are **unlogged**; Stripe charges are **not read anywhere**. Mark every Story row type as *exists today* or *arrives in S3/S4/S5* |
| Today's queues exist | The ones in the end state (owner inactive, retention, free time ending, missing owner, new errors, new feedback, campaigns past due / due soon, approval queue). Which are computed today, which are invented? "Free time ending" cannot be real before S4 |
| Who can open the record at all | `canViewPlatformArea` per role; what a `read_only` or `growth` user sees on a customer record |
| The record's present size and what is on it | Capture the Stage 1 version from dev with `.probe/pasc/` (signs in read-only, aborts every non-GET). Never overwrite `tests/uat/.auth/platform-admin.json` |

## 5 · The drawings (blocking: no code in this session at all)

Published as one Artifact from `PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE2_DRAWINGS.html`, linked from the index's
`stages/s2`. True size, 1440 wide, Warm and Dark. Whole-screen before → after. Every highlight clickable with its
reason (hover is not enough). Checkable paste-back with a recommendation beside every ask.

- **A · The menu by job.** Every one of today's 19 entries placed in its new group (a table: old group → new group, and
  what is renamed; "Customer users" becomes "People"). Roles shown as a trimmed menu (at least Support, Billing,
  Growth, Read only). The Read marker. Bookkeeping's private group unchanged. A phone-width Today only (Q4).
- **B · Today.** Replaces Overview. The "is everything up" line (data arrives in S5: say so on the drawing; draw the
  line with only what exists today). The waiting list grouped by job, an empty group shown as one quiet line, the
  business and dev numbers kept but quiet and below. **The current-week queue is the focus, not the numbers.**
- **C · Find.** The strip's box in rest, focused-empty (recent / what you can type), results grouped (Clubs · People ·
  Stripe), a person with their clubs beneath, no results, "too many, narrow it", a role that may not read the thing
  (how a result is hidden, not shown-then-refused), keyboard (`/`, ↑ ↓, Enter, Esc), and the sentence that says
  card digits are not searched. Where the box sits on a narrow window.
- **D · The customer record.** Club, person and tournament shapes if they differ. Chips, figure band, Story (every row:
  when · what · who · why), the filters, the Edit door and the window it opens (confirm + reason, R3/R4), the read-only
  version (R6), "Put it back" on the rows that allow it and its absence on the rows that cannot be undone. Money,
  Access and People & tournaments tabs drawn as **frames only**, labelled with the stage that fills them.
- **E · The boundary.** One page marking every part NEW / RESTYLED / UNCHANGED / LATER (S3, S4, S5), so the owner sees
  what Stage 2 will and will not deliver. **Nothing in a drawing may imply a later stage is built.** Example data is
  labelled "example" (the end state's convention).
- Run **`/design`** on the drawings before the hand-off, apply its fixes, and list any written-rule conflict for the
  owner. Its proposals stay on the drawings page, never in the design log.
- **Find is a new way to read customer data: draw and review it as a security change.** On the drawings page, state:
  who may call it, what each role sees, what is logged (a search by staff reads personal data; does it leave a trace?),
  rate limiting, that it is server-side, and that no sign-in or `proxy.ts` change is needed. Run **`/review`**'s
  security lens over the *design* (a written threat list), not code.

## 6 · Asks for the owner (one recommendation each, beside the drawing it decides)

Draft these, reword to the drawings: **do not decide for the owner.**
1. **M3 (still open):** does Billing keep Support's account powers? (Plan recommends no.)
2. **Find's reach by role:** does everyone with console access search everything, or does a role see only its areas?
3. **Find leaves a trace?** Log who searched for what (personal data read by staff) or not.
4. **Story's first version:** show only what is recorded today, with a quiet "more arrives with Money and Free time"
   line, or hold the Story until S3/S4 so it ships whole? (Push back if you think the second is better; argue from what
   exists.)
5. **Today's queues:** which of the end state's eight are real now, and do invented ones stay out until their stage?
6. **The record's edit door:** one Edit for the whole record (R2), or per-section doors (Access, Plan)?
7. **Names:** "People", "Today", "Story", "Put it back": confirm, they are the owner's words to approve.
8. **The old orgs / customer-users pages:** do they become the Find results plus a list under People, or stay as
   lists under their menu entries?
9. **Still open from the kickoff, ask again where it bears:** the rest of Q5; the morning check on Status (Q6, S5);
   the prod `ENTITLEMENT_GRANTS_ENABLED` check (gates S4).

## 7 · Hand-off

- Restate the **PM summary in five lines** (`AGENCY_RULES`): what support sees, what moves, what is deliberately left
  for S3–S5, Warm/Dark, roles.
- Update the index (`stages/s2` state + anchor + a `log/` row), the plan's S2 row and Status, TODO, the PM brief, and the
  auto-memory file `project_platform_admin_support_console.md`. A ruling is recorded exactly as ruled; add nothing it did
  not rule.
- When the owner has ruled: write `PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE2_BUILD_PROMPT.md`, in Stage 1's shape (verified
  state, scope is / is not, parts, guards, verify, hand-off, do not).

## 8 · Do not

- Write or change code, schema, `proxy.ts`, hooks or any watched script.
- Redraw what Stage 1 ruled (the shell, the type, the buttons) or the S1 look of untouched pages.
- Draw Money, free time, Status, the sent-email log or the audit reason column as if they exist.
- Draw a phone design beyond Today (Q4).
- Touch Bookkeeping's inside (its own plan's session).
- Decide an ask for the owner, or tick a box for them.
