# Build prompt — the coach's Add player form (tryout check-in)

**Paste this into a fresh chat.** Everything below is decided; nothing here is an open question
unless it says so. Approved mockup (the spec):
https://claude.ai/code/artifact/517a46b0-db2e-421b-bcdf-71dbd9d5ce9a

---

## The job

Widen the coach's **Add player** dialog on tryout check-in from three fields to the full set the
record already holds, and add one genuinely new field: **Last season's team**.

Build **Option B from the mockup** — approved 2026-08-26.

## Why (the argument, so you don't re-litigate it)

The same tryout record is written by three doors, and the coach — the person actually running the
tryout — gets the thinnest one:

| Field | Public form | Club admin | **Coach** |
|---|---|---|---|
| Player name | ✓ | ✓ | ✓ |
| Date of birth | ✓ | ✓ | **✗** |
| Guardian name | ✓ | ✓ | **✗** |
| Guardian email | ✓ | ✓ | ✓ |
| Guardian phone | ✓ | ✓ | **✗** |
| Notes | ✓ | ✓ | **✗** |

**Three shipped features are already broken by the gap** — verify each still is, then confirm each is
fixed:

1. **The printed check-in sheet has an Age column, calculated from date of birth.** A coach-added
   player prints a blank cell on the coach's own sheet. This is what the owner noticed.
2. **The decision board flags a family "no email on file — reach them by phone"** and there is
   nowhere in the entire tryout flow to have recorded a phone number.
3. **The board surfaces "family's note" one tap away** on a row; a coach-added player can never have
   one.

Plus: **returning-player matching runs on date of birth + name + guardian email.** A coach entering
their squad by hand today gets no returning-player detection at all. Adding date of birth switches
that feature back on — worth saying in the PM summary, because it is the biggest invisible win.

## What to build

### 1. The dialog — compact, with a reveal

Closed (the walk-up at the desk, unchanged speed): **First name\***, **Last name**, then a
**"More details — birthdate, last season's team, contact"** disclosure, then Cancel / Add & check in.

Open (the coach entering a squad in advance): adds **Date of birth**, **Last season's team**,
**Guardian name**, **Phone**, **Email**, **Notes**.

The reveal should **stay open for the rest of the session** once opened — the pre-entry coach opens
it once, not fourteen times. Per-device is fine; do not persist it server-side.

⚠ **MARKERS: a plain asterisk on the FEW required, and NOTHING on the optional ones.** Only the
player's first name gates the save, so it is the only marked field. Never "· optional" tags — owner
rulings 2026-08-25 (the marker is plain, never red, because red means something has gone wrong) and
2026-08-26 (mark the few required, never the many optional). See
`memory/design_decisions.md` and the memory file `feedback-required-marker-not-optional-tags`.

⚠ **Selects are dropdowns, never segmented pill rows** (owner 2026-08-22) — relevant if you reach for
one; you probably should not need one.

### 2. Last season's team — the only new stored field

**Free text.** ⚠ **Not a dropdown of levels** (A/AA/AAA/Rep/House): those mean different things per
sport and association, and this product is deliberately sport-neutral (`lib/sports.ts` Sport Pack).
A fixed list would be wrong for somebody on day one.

- **New player:** empty, coach types it — "Oakville Rangers 11U", "first year", "house league".
- **Returning player:** auto-filled from the prior season's team, editable, with a quiet note saying
  where it came from. It is the family's claim, not a verified fact, so never lock it.
- Needs a **migration** (a column on the tryout registration) plus the Data Dictionary update and
  `npm run refresh:snapshots` **in the same unit of work** — and the snapshot refresh must be
  COMMITTED, or the release check goes red (that exact failure cost an Amplify job once).

**Where it surfaces afterwards** — decide this deliberately and say so in the PM summary; a field
that swallows information is worse than no field. The natural home is the candidate's row on the
decision board beside the family's note.

⚠ **There is NO blind gate to work around any more.** As of commit `a137dfd5` (QA §110) the head
coach sees everything on every tryout screen — names, birth years, last season, returning-player
history. Blind is a **helper-side** rule only. Do not add a blind condition to this field.

### 3. The club-admin "Add Applicant" form

Leave it alone unless something is genuinely inconsistent. It already collects the full set. But
**check its wording against the coach's** — the two doors have drifted before (the coach's button
said "Add walk-up" while admin said "Add Applicant", which is what prompted the rename).

## Rules that will bite you

- **`dev` branch only.** Stage explicit pathspecs, never `git add -A`. Bracketed route folders
  (`[orgSlug]`) need `:(literal)` pathspecs or they stage nothing.
- **Other agents share this working copy.** Check `git diff --cached` before committing and use
  `git commit --only -- <paths>` so you don't sweep their staged work into your commit. Expect
  unrelated typecheck failures from their in-flight files — attribute before chasing.
- **PM UX summary before any code.** Plain language, what the user sees and does differently.
- **`/review` after, then commit only with explicit per-action approval.** Never commit unasked.
- **Sweep the CONCEPT, not the identifier**, when you change copy. Two rounds of review on this same
  feature found stale sentences because the sweep looked for control names while the copy said the
  same thing in different words. Check: help articles AND their `keywords`/`searchText` arrays, the
  live screen copy (panel intros, empty states, hints, the "what to do next" prompt), the demo seed,
  and the pitch-deck copy in `lib/walkthrough-content.ts`.
- **Demo sandbox:** if the flow changes visibly, check whether the demo's seeded world and tour
  narration still tell the truth. The coach demo is live on production.
- Add a **QA ledger section** (`docs/projects/active/OWNER_QA_LEDGER.md`, next § number) with a
  **published artifact walkthrough** linked under the heading — that is the house convention, and
  the artifact is expected.

## Verification expected

`npx tsc --noEmit`, `npm test`, `npm run lint:focused -- <files>`, `npm run check:spelling`,
`npm run check:dictionary`, `npm run check:migrations`, and `npm run check:layout -- --only=coach-tryouts`
against a running dev server. ⚠ **Prove a new guard can fail before trusting its green** — this
feature's last review found a guard that was dead on arrival and passing.

## Context worth reading first

- `docs/projects/active/COACH_TRYOUT_EMAIL_REMOVAL_PLAN.md` — the last three chunks of work here and
  every ruling behind them.
- `docs/projects/active/OWNER_QA_LEDGER.md` §108, §109, §110 — what shipped and what is owed.
- `memory/design_decisions.md` — newest three entries are all this feature.

## Still owed on this feature (not your job, but do not undo)

- QA walks for §109 and §110.
- **Migration 264 is on dev only**; **migration 263 must reach prod** (its column is written by the
  names switch and read by the development baseline).
- **The production demo still promises tryout decision emails** until it is reseeded there.
