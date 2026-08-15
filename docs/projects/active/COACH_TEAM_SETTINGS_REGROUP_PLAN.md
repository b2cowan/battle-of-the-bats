# Team settings regroup — and the dues settings move into it

**Status:** built on dev 2026-08-14, awaiting owner QA (§22) and a release.
**Owner call:** 2026-08-14 — approved from mockup artifact `8a8582f5`, with the collapsed-groups
revision the owner proposed in the same sitting.
**Migration:** none. No schema change; both settings already live on the season record.

---

## The problem

`Automatic Dues Reminders` and `Credits reduce` sat as two ~70px cards at the foot of **Player
Dues** — a screen a coach opens weekly to chase money. Both are set-once-a-season decisions. A
set-once control charging permanent rent on a daily working screen is the wrong trade.

The naive fix — delete them from Player Dues, put them in Settings — loses something real.
"Credits reduce the last payment first" is not only a preference; it is the *explanation* for why
a family's far-end installments keep shrinking while their next bill holds its date. Removing the
sentence removes the table's own explanation.

## The three rules this follows

1. **Move the control, keep the fact.** Settings owns the change; Player Dues keeps a one-line
   read-only statement of the policy, with a link to where it changes. This is the pattern the
   Depth Chart already uses for lineup caps ("Edit in Settings →").
2. **An empty page is a setup moment.** Before any dues schedule exists, both controls appear
   inline on Player Dues, live and editable — that is when a coach is deciding how dues will work
   and nothing they change can surprise a family. The instant the first schedule exists, the block
   is replaced by the table plus the policy line. The two states are mutually exclusive by
   construction, so there is never a question about which place is authoritative.
3. **Collapsed, but never silent.** Team settings ships six groups closed by default (the
   tournament-admin settings idiom), and every header carries its own current value. That is what
   makes collapsing safe: the *closed* page now answers more than the old open one did.

---

## What was built

### 1. Team settings — six collapsed groups, one row grammar

`app/[orgSlug]/coaches/teams/[teamId]/settings/page.tsx`, rebuilt on the existing
`CoachCollapseSection` primitive (native `<details>`, children stay mounted, `?section=` deep-link
opens + scrolls + flashes). No new component was invented for this.

| Group | Header value | Contents |
|---|---|---|
| Team | the division, or "No division set" | Division |
| Season | `Summer 2026 · Active` | Start next season · Season Review |
| Game day | `3 at a position · 2 pitching` or "No rules set" | the three lineup caps |
| **Money** (new) | `Reminders on · credits reduce the last payment first` | Automatic Dues Reminders · Credits reduce |
| Sharing | `Book shared with the club` / `Book not shared` | Club Shared Book switch |
| Organization | `Not connected to a club` | Manage organization link |

Every setting is now the same row — name, one line of plain English, control on the right — in
`.settingRows` / `.settingRow` in `coaches.module.css`. The mixed save model is kept deliberately
(typed values commit on **Save**, choices save on change) but each card now shows "Saved" where a
save actually happened, so the difference reads as intentional rather than accidental.

The value line is also a discipline, not just a convenience: **a group that cannot state its
condition in six words is holding two unrelated things and should be split.**

### 2. The access gate — and why the page had to narrow as the door widened

`lib/coach-nav-visibility.ts`: `Settings` used to share the `Tournaments` gate verbatim
(`isHeadCoach || scheduleManage`). Money is a **separate grant**. A head coach who set an
assistant up as the team's treasurer — money write, nothing else — would have watched both
controls disappear from the product entirely the day they moved.

- The **door** now also opens for `money === 'write'`.
- The **page** narrows to match: the five original groups render only for
  `isHeadCoach || scheduleManage`; the Money group renders only for money access. A money-only
  coach therefore finds a settings page containing Money and nothing else — no lineup rules, no
  organization link. **Nobody gains anything except money editors gaining the Money group.**
- `money === 'read'` deliberately does **not** open the door: Settings is where things change, and
  a read-only coach has nothing to do there. The Player Dues policy line still tells them the
  answer.

Locked by two new cases in `tests/unit/coach-helper-preset.test.ts` (the treasurer sees Settings
and Money but not Tournaments/Staff/Schedule; the read-only bookkeeper sees Money but not
Settings).

### 3. Player Dues

- **Policy line** under the table when any schedule exists: reminders state · credits state ·
  "Change in Team settings" → `?section=money`.
- **Setup block** above the table when no schedule exists anywhere on the roster: both controls
  inline, plus **Set dues for all players** — an empty state that only explains is a dead end.
- ⚠ **The whole policy line is absent in an archive** — and the first cut of it was wrong in a way
  worth recording. It originally rendered in a past season too (link suppressed, sentence kept), on
  the reasoning that a finished season should still explain its own numbers. **It cannot.** The
  settings route it reads resolves the team's ACTIVE program year and ignores the `?year=` the
  panel sends, so an archived season would have printed *today's* policy over *last year's* table —
  governing rule 3 of the archive ruling ("what the coach could see AT THE TIME, not today")
  violated by a surface whose own comment claimed to honour it. Found by the archive lens in
  `/review`. A record page stating a live setting is worse than one stating nothing, so the line is
  now live-season-only.

  **OPEN DECISION (owner):** the per-season values *do* exist on each program-year row — serving an
  archived season its own policy only needs the settings route to join the season-read rail. That
  is a deliberate decision point by design (the allow-list fails the build until someone edits it),
  so it was **not** taken here. Worth asking: should a finished season restate the dues policy it
  actually ran under?

### 4. Two extractions, to stop the same sentence existing twice

- `CREDIT_MODE_LABELS` / `CREDIT_MODE_HINTS` moved from the dues panel into `lib/dues-credits.ts`.
  Three surfaces now say those three sentences; a second copy is how a picker and the sentence
  beside it start disagreeing about what the team chose.
- The reminder-email preview became `components/coaches/DuesReminderPreviewModal.tsx`, so "See an
  example" works from both Settings and Player Dues off one implementation. Its copy stopped
  saying "above the table" and now names the buttons by the page they live on.

### 5. The dead anchor

`DepthChartBoard`'s caps bar linked `…/settings#lineup-rules-title`. That anchor no longer exists,
and a hash cannot open a collapsed `<details>` anyway — it would scroll to a shut card and leave
the coach guessing. Switched to `?section=lineup-rules`.

### 6. The coach demo

Asked the two drift questions. **Nothing the demo already said had become false** — the tour's money
step and the off-season dock line never named where these settings lived. But the second question
found something the first would have missed:

- **The demo's best moment was riding a database default.** The tour narrates a family whose bill
  reads *"covered by fundraising"* because half a bottle drive came off their dues — which only
  happens while credits are applied to bills at all. The seeder never set `credit_application`, so
  that whole sentence depended on the column default being `last_first`. A future default of
  `keep_separate` would have left the tour describing a screen that no longer said it, with every
  page still rendering perfectly. `DEMO_DUES_SETTINGS` now states both settings on every demo year
  through `ensureProgramYear`, so no call site can forget them. A default is not a decision.
- **One clause added to the money step**, the demo's only mention of the new group and deliberately
  so: the prospect who has just been shown a credit landing on a bill is the one prospect who cares
  that *which* bill is a choice. No new tour step — the walk is five season moments, and a settings
  screen is not one of them.

⚠ **The pin changes nothing on dev today** (the DB default already produced these values); it stops
the demo drifting if that default ever moves. A reseed is not required for the current world.

### 7. Help

Six passages named the old location ("at the foot of Player Dues", "the toggle at the bottom of
Player Dues") across `lib/help-content/coaches.tsx` and `accounting.tsx`. All corrected. The Team
settings guide gained the Money and Sharing groups and the collapsed-groups behaviour, its keyword
and searchText lines gained the money vocabulary, and a new FAQ answers *"Where did the dues
reminder and credit settings go?"* — including both exceptions (the empty state, the archive).

---

## Deliberately not done

- **Schedule visibility** (staff / families / public link, on the Roster page) is a genuine
  set-once preference and would sit naturally under Sharing. Left where it is: it works with the
  family-link controls beside it and splitting the pair costs more than the tidiness gains. Worth
  a separate call.
- **Staff permissions, tryout setup, the test-types library, the roll-forward carry-over
  checkboxes** — all fail the set-once test. They are working surfaces revisited in the same
  sitting as the task they serve.

## What `/simplify` and `/review` changed

`/simplify` (4 lenses) — the two money rows and their save logic existed twice and **had already
drifted**: the dues page carried a revert guard earned in an earlier review, the settings page
surfaced save errors, neither had both, and the dues page's reminder toggle failed *silently*. Now
one shared row component + one shared save path. The settings page's second network round trip was
folded into the team payload (it re-resolved the same auth/team/season to read two fields). The
"can this coach configure the team" rule became one named predicate instead of two hand-copies.

`/review` (high-risk, 4 lenses + rendered gate) — 6 confirmed, all fixed:

1. **The rendered sweep caught a 20px tap target** on "Change in Team settings" (floor is 44). Quiet
   by type size is the rule; quiet by *tap* size was rejected once already on the money rail.
2. **"Credits reduce they don't — settle at season's end"** — the collapsed header and the policy
   line composed `"Credits reduce " + label.toLowerCase()`, but the third mode's label answers a
   different question. A label and a sentence are different jobs; `CREDIT_MODE_SENTENCES` now
   carries the prose form.
3. **The Game day header reported unsaved typing as if it were saved** — its summary read the live
   input state, so typing "5" and walking away left the closed group announcing a rule that was
   never persisted. Now reads the saved value, like Division already did.
4. **The optimistic revert was structurally unsound.** Two overlapping saves that both fail leave
   the switch disagreeing with the database — and the change itself created the reachable path by
   giving the settings a *second* live editable copy. For the setting that decides whether families
   get dunning emails, "shows off while the schedule still sends" is the wrong way to be wrong.
   Both screens now re-read the server on failure, the cure this file already used for book sharing.
5. **The archive violation above.**
6. **Collapsing the page blinded the gate that protects it** — with all six groups shut, the layout
   sweep measured nothing but the page chrome; a green run would have proved only that the page
   still has an `<h1>`. Two `?section=` screen entries added, mirroring the settlement sheet's own
   precedent for exactly this trap.

**Accepted residual:** the settings route takes last-write-wins with no compare-and-swap, so two
successful saves racing from two open screens could land in the opposite order to the clicks. The
window is small, both screens re-read on load, and adding versioning to team settings is a product
decision nobody has asked for — recorded rather than built.

## Verification

`npm run verify:changed` green (0 errors; the 160 warnings are pre-existing `any`/effect
warnings). `npx tsc --noEmit` clean. `npm test` — 1827 pass / 0 fail, including the two new
capability cases. Browser QA is §22 in the Owner QA Ledger.

**Not verified by any of the above:** the collapsed-groups layout on a real phone, and the
deep-link flash. Both are in §22.
