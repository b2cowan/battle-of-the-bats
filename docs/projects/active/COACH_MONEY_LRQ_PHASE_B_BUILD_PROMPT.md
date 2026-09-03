# BUILD PROMPT — List · Room · Question, PHASE B: Fundraising (open a FRESH session with this)

You are building Phase B of an owner-ruled project. Phase 0 (the shared room shell) and Phase A
(the Club tab) are **built and committed** (`246bff21`, 2026-09-02) — Phase B makes the
Fundraising tab's two bands adopt the same grammar. Do not redesign; the design is ruled.

**Read first, in this order:**
1. `docs/projects/active/COACH_MONEY_LIST_ROOM_QUESTION_PLAN.md` — §0 (the grammar, guard rules,
   classifier, verdict table) and §3 (Phase B).
2. `memory/design_decisions.md`, the 2026-09-02 entry "LIST · ROOM · QUESTION" — binding; it names
   the 2026-08-31 "a drive opens in place" ruling as **deliberately superseded**. Do not restore it.
3. The mockup artifact `claude.ai/code/artifact/11607f0a-e0c1-4bb4-bbd5-b6f81d834fbc` — §2 draws the
   drive room and the two-zone sponsor room; §0 the list row anatomy. The artifact IS the spec.
4. `components/coaches/RoomShell.tsx`, `useDialogFloor.ts`, `useRoomAddress.ts`,
   `lib/room-neighbours.ts` — the shell you consume (props documented in the file), and
   `app/[orgSlug]/coaches/teams/[teamId]/accounting/club/panel.tsx` — the ONE reference consumer.
   Copy its patterns exactly: the address hook + stale-address effect, the memoised room derivation,
   `key={record.id}` on every live control inside the room, `onBusyChange` into the room's `busy`,
   value-settled write marks, `tabActive` gating, `sentinel` + `data-room-state`.
5. Owner QA Ledger §134 (`docs/projects/active/OWNER_QA_LEDGER.md`) — Phase A's walk. **If it has
   been walked, every shell finding in it is fixed BEFORE this phase adds two more consumers.** If
   it has not, say so in your first message and proceed; flag that shell fixes may ripple.
6. Auto-memory `project_coach_money_list_room_question.md` (the three review catches) and
   `project_coach_fundraiser_band.md` / `project_coach_sponsorship_lifecycle.md` (what the bands
   are today, and the guarded-delete + payout-floor rules that must survive the rebuild).

## 0. Preconditions — verify, stop if any fails

1. **Quiet tree:** `git status` shows no other session's uncommitted money files; pre-commit gates
   green on a no-op commit. One hot money stream in this shared working copy at a time.
2. Branch `dev`; the dev server is not being used by anyone for a sweep.
3. The UAT fixture holds a drive with entries AND a sponsor with two arrivals + a credit plan
   (`node scripts/seed-uat-coach-fixture.mjs` heals it; `resolveUatContext()` returns
   `fundraiserId` + `sponsorId`).

## 1. ITEM ONE — the mockup gate

Before QA, put whole-screen screenshots of the built Fundraising tab, the drive room and the sponsor
room (desktop + a true-size ≤640 phone frame each) beside the artifact's §2 frames and list every
deviation. A deviation is acceptable only when forced by a standing ruling; each goes in the plan's
deviations list with the ruling that forced it. The owner sees the comparison before the walk.

## 2. What Phase B builds

**The lists (D2: room only — no read-only glance fold at first).** Both bands become flat lists;
`DriveBand` / `SponsorBand` in-place expansions retire (with `BandRows` if nothing else uses it —
the dead-selector gate will demand the CSS goes too). Row anatomy: name · one status chip · the
one figure · a real `<button>` chevron opening the room (aria-label "Open {name}"). The sponsor
list keeps its flat Pledged / In / To come columns — they are why comparing sponsors never needed
a fold. Drives keep Raised and Team keeps. Rows never grow a form.

**The drive's room** (`sentinel="drive"`): tiles Raised · Team keeps · Credited to families
(figure + team share %); the entries table (player · received date · method · amount · credit)
with per-entry **Edit** (a compact Question — amount + received date, the entries PATCH already
takes both; the inline `EntryEditor` and its `doorsLive` lockout retire) and **Remove** (the
existing guarded refusal sentence, unchanged); the action row: quiet "✎ Edit drive" (the existing
Edit sheet, unchanged, a Question) and the one **Record** door (the existing drive Record window —
the grid Question, opened through `useRecordMoneySignal` with the drive locked as the context
door); guarded **Delete this fundraiser** at the foot (existing floor sentence, dead button + reason
line). No History fold unless something real accumulates beyond the entries — do not render empty
theatre.

**The sponsor's room — the ONE two-zone room** (`sentinel="sponsor"`): tiles Pledged · Arrived ·
To come (+ the past-due cue when expected-by has passed); zone one **Cheques** — every arrival
dated with its method, each with **Edit** (amount / date / method — parity with drive entries;
undo stays) — and zone two **Credited to players** — the existing `SponsorCreditPlanEditor` LIVE
in the room, not behind Edit. ⚠ Read that editor before deciding its save semantics: its writes
go through the payout-floor guards (SP-1, `lib/dues-credit-guards.ts`) whose refusals must stay
visible beside the control; if per-change saves would fire the floor on every keystroke, give the
zone its own Save with the refusal rendered in place. Action row: "✎ Edit sponsorship" (the
existing sheet) and **Record** (the conversation's sponsor branch, pre-answered to THIS sponsor);
guarded delete at the foot (R5-A rule unchanged: refuse until empty, name the amount and the way
out). A pledge that is fully arrived reads its chip accordingly; the status is DERIVED, never a
field.

**The address.** The tab already owns the one-shot key `fundraiser` (and `kind`); keep
`?fundraiser=<id>` as the room address for BOTH kinds — one `useRoomAddress('fundraiser')` call in
the panel, and the record's `kind` decides which room shape renders. (The guard test forbids two
FILES reading one key, not one file opening two shapes.) Existing deep links from the Money
overview's two rows keep working — they now open rooms.

**The Record conversation gains the promised-sponsorship hand-off** (carried ruling). ⚠ NOT a
ninth first-question sentence — the 2026-08-25 ruling capped the list at eight and folded a hand-off
INTO a branch instead ("Bills you owe" inside "we paid for something"). So: inside the sponsor
branch's Which-sponsor picker, a row **"This is a promise — nothing arrived yet"** that hands off
into the existing "+ Pledge" sheet with the typed name and amount carried, and reversible (the
`handOffToBillForm` shape). Record still never creates unpaid money itself.

**Verify the first genuinely stacked pair** (plan §3): the drive's Record grid Question opens OVER
the open drive room. Escape with nothing focused must close only the top layer; Escape inside the
grid must not close the room. If the bare-document fallback in `useDialogFloor` double-fires,
narrow it to the most recently opened dialog — never build an overlay stack in `lib/coaches-overlay`.

## 3. Same-commit obligations (blocking)

- `scripts/layout-screens.mjs`: re-point the EXISTING `coach-fundraiser` and `coach-sponsor` entries
  (keep their ids — the baseline is keyed on them) to `ready: '[data-room="drive"][data-room-state="loaded"]'`
  and the sponsor equivalent; the guard test will fail until every sentinel is named there.
- The fundraising UAT lifecycle spec (drive + sponsor, 15/15 today) drives the bands' expansions —
  rewrite it for the rooms AND RUN IT against the dev server. The money mobile smoke's ten-surface
  loop names 'Fundraiser open in place' — update it. A spec that only compiles is not run.
- Help: the fundraising answers were rewritten 2026-08-29 for two bands — rewrite for the rooms
  (`/docs`), keywords included. Demo: narration is SILENT on fundraising by ruling `ea8ddd14` — keep
  it silent, add the one-line re-read note in `lib/sandbox-chrome.ts`, run `check:demos`, and reseed
  the coach sandbox if a new state must show.
- Layout re-baseline for the three screens with reasons (rows→rooms re-keys entries); sweep on a
  quiet dev server (⚠ a sliced run against the owner's live server hung for 7 minutes in Phase A).
- `/simplify` then `/review` (high-risk tier — shared shell + money write surfaces); fix confirmed
  findings before the walk.
- A checkable QA walkthrough artifact (checkboxes + localStorage + paste-back; the Sign-in-as card:
  `uat-coach@uat-test-org.local` on `localhost:3000`, dev password from `.env.local`) and its own
  ledger section — read the ledger tail for the next § number, never guess it.
- Commit only on the owner's word, with EXPLICIT pathspecs (`git --literal-pathspecs add` for the
  bracket directories); co-edited shared docs are staged by constructed blob; verify
  `git show --stat HEAD` carried only your files.

## 4. Out of scope — do not take on the way past

The bill room and its field fixes (Phase C) · dues fixes (Phase D) · moving sponsorships to another
tab (not ruled; needs a named pressure) · glance folds on the lists (D2 says room only first) ·
any migration · touching `expenses/panel.tsx`, `budget/`, `budget-vs-actual/` (other streams) ·
restoring any in-place ruling this project supersedes.
