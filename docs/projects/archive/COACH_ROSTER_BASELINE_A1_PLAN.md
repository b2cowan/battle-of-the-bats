# A1 — Retiring the roster visibility switch (implementation plan)

**Created 2026-08-03.** Implements the owner ruling *"Player NAMES, NUMBERS and POSITIONS are BASELINE
for everyone with portal access"* (`BUSINESS_DECISIONS.md`, 2026-08-03), **with the helper-recognition
finding from the 2026-08-03 season-review ruling folded in** rather than deferred.

**Mockups (spec):** https://claude.ai/code/artifact/1f7c75ac-b7bc-42c7-b4bf-69fe71a70a5a
**PM brief:** `COACH_ROSTER_BASELINE_A1_PM_BRIEF.md`

> **Status: ✅ BUILT on `dev` 2026-08-03 — UNCOMMITTED, owner QA pending (§7, §7.5).**
> Ruled 2026-08-03; all three questions answered as recommended:
> **§3 = Option A** (section visibility falls out of the duties held; no new grant) ·
> **the standing line STAYS** on the staff card (mockup frame 1) ·
> **change notice = release notes + help guides only** — no email, no in-app announcement, since
> nobody's access narrows (see §5 S6 / §6).
> ✅ Unblocked: Practice Plans Phase 4 committed `2e3e7e0d`; no shared files dirty.
> ⚠ **No migration. No new capability. The model gets strictly smaller.**

---

## 1 · What the ruling says, and the one thing it does not

A1 as logged is precise about three things and silent about a fourth:

| # | Logged | Status |
|---|---|---|
| 1 | The `roster` view/hidden control is retired from the head coach's duty grid | Clear |
| 2 | `rosterPii` (Contacts & birthdates) is **unchanged and untouched** — it was always doing the real protective work | Clear |
| 3 | `planPlayerNames` retires with it | Clear |
| 4 | **What happens to the surfaces `roster` was gating** | ⚠ **Not stated** — §3 |

A1's own handoff anticipated this: *"re-audit the surface list rather than trust this entry — the
helper work was itself changing those gates as this was written."* The audit below is that re-audit.

## 2 · The re-audit — the grant was doing TWO jobs

Every read of `roster` in the codebase, classified. This is the finding that shapes the whole plan.

### Job 1 — "may a player's NAME be rendered here?" → **A1 makes this always yes**

| Surface | Behaviour with `roster: 'off'` today |
|---|---|
| Practice plan read route | Player list withheld from the payload (source-gated, Phase 3 `/review` fix) |
| `canSeePlanPlayers` predicate | The only predicate `planPlayerNames` opens |
| Lineup builder · playing-time report · dues page · awards | **Ignored the grant entirely** — full names shown regardless. This is the fiction the ruling names. |

### Job 2 — "does this SECTION exist for this person?" → **A1 is silent; §3 must answer**

| Surface | Gate today | If `roster` simply disappears |
|---|---|---|
| Roster page (route + nav) | `canViewRoster` | Opens to everyone with portal access |
| Attendance (route + nav) | `canViewRoster` — nav needs `attendance && roster !== 'off'` | Opens |
| Development hub (nav) | `notes \|\| roster !== 'off'` | Opens |
| Insights (nav) | `isHeadCoach \|\| roster !== 'off' \|\| lineups \|\| attendance \|\| money !== 'off'` | Opens |
| Overview tiles (`coach-overview`) | `canViewRoster` selects the roster tile | Opens |
| Ask the Front Office (`coach-ask-questions`) | attendance questions ride `canViewRoster` | Opens |
| Depth chart · player page · history | `roster !== 'off'` | Opens |
| ⚠ **Past practice plans** (the one archive door) | `canViewSchedule && (notes \|\| roster !== 'off')` | ⚠ **NARROWS** — see below |
| Season's End / Wrapped altitude (`hasNoTeamRecordAccess`) | `roster === 'off' && …` | **Stops matching — see §4** |
| The word "Helper" (`staffKindLabel`) | `roster === 'off' && planPlayerNames && …` | **Stops matching — see §4** |

⚠ **The one place a naive retirement NARROWS rather than widens.** The past-practice-plan archive door
gates on `notes || roster !== 'off'` deliberately, to mirror its own entry point (the "Practices you've
run" list in the Development report). Drop the `roster` clause and it becomes `notes`-only — which
still keeps a helper out, but **locks out every ordinary assistant coach**, who passes through it today
on `roster` (assistant defaults carry `notes: false`). Both the door and its entry point take the same
`hasRecordAccess` treatment as everything else in §3, which restores the assistant and keeps the helper
out. ⚠ **The gate and the list it hangs off must move together** — if they diverge, this becomes a URL
a helper can type.

⚠ **Retiring the grant with nothing behind Job 2 is a widening**, which contradicts A1's own text
(*"It is a simplification, not a widening"*). Job 2 needs an answer that is **not a new grant**.

## 3 · ✅ RULED — how Job 2 gets answered

**Owner ruling 2026-08-03: Option A — section visibility falls out of the duties a person already
holds.** Option B was drawn side-by-side in the mockups and declined.

Replace every Job-2 read of `roster` with the **union of the record grants that already exist**:

```
hasRecordAccess(c) = c.isHeadCoach || c.attendance || c.lineups || c.notes
                     || c.money !== 'off' || c.documents !== 'off' || c.tryouts
```

This is the existing `hasNoTeamRecordAccess` predicate, negated — already written, already tested,
already expressed purely in surviving grants.

| Bundle | `hasRecordAccess` | Result |
|---|---|---|
| Head coach | true | Unchanged |
| Assistant (defaults: attendance, lineups, documents `view`) | true | Unchanged |
| Assistant hand-stripped to schedule only | false | Treated as a helper — **correct, that is what they are** |
| **Helper preset** | false | Sections stay closed; names still render on their plan |

**Why this is the right shape**
- **No new grant, no new vocabulary.** The model loses `roster` and `planPlayerNames` and gains
  nothing — A1's promise kept literally.
- **It self-corrects.** Grant a helper attendance and the roster page opens by itself; nobody has to
  remember a second switch.
- **It delivers the owner's stated complaint directly.** *"There shouldn't be an assistant coach that
  can see players' dues with no players' names"* — under Option A, holding `money` is itself record
  access, so the dues page names people. Today that combination is a dead grant.
- **It is not the retired toggle under a new name.** The retired switch answered *"may this person
  see a name"*. This answers *"does this person do any record work"* — a different question, keyed on
  duties the head coach already sets deliberately.

**Rejected: Option B — retire the grant and let every section open.** Simpler to build and defensible
on the literal wording, but hands a parent volunteer the roster, the development board and the
season's numbers. Recorded so the choice is visible, not to be adopted.

✅ Ruled — build against Option A.

## 4 · The folded-in finding — two mechanisms keyed on the retiring grant

Neither is a permission gate. Both are load-bearing UX, and both would fail silently.

### 4.1 · `staffKindLabel` — the word "Helper"

Requires `roster === 'off'` **and** `planPlayerNames`. Both retire ⇒ every helper is relabelled
**"Assistant"** on the head coach's staff card.

**Fix:** re-derive from the surviving shape. A helper is the only bundle holding `schedule` while
holding *no* `scheduleManage`, *no* `staffChat`, and no record grant:

```
looksLikeHelper = c.schedule && !c.scheduleManage && !c.staffChat && !hasRecordAccess(c)
```
Verified distinguishing: assistant defaults carry `scheduleManage` + `staffChat` + `attendance`.

⚠ The existing rule stands and must stay in the comment: **this is DISPLAY ONLY — never gate on it.**

### 4.2 · `hasNoTeamRecordAccess` — the end-of-season screen

Drives the *"This season has finished"* screen a helper meets when their season closes, and the
`isClosedTeam` redirect that precedes it. Keyed on `roster === 'off'`.

**Fix:** drop the `roster` clause; the remaining six terms already express it. Under Option A this
predicate becomes load-bearing for §3 as well, so it graduates from "altitude only" to a real gate —
**its comment must be rewritten to say so**, since it currently states the opposite emphatically.

⚠ **This is the regression that would reopen the season-review door closed by the 2026-08-03 ruling.**
It ships inside this change or the ruling is undone.

## 5 · Build slices

| # | Slice | Contents |
|---|---|---|
| **S1** | **Capability model** | Remove `roster` + `planPlayerNames` from `CoachCapabilities`, `ASSISTANT_DEFAULTS`, `HEAD_COACH_ALL`, `HELPER_PRESET`, the grants type and `normalizeGrants`. Add `hasRecordAccess`. Retire `canSeePlanPlayers` (always true) and `canViewRoster` per §3. Re-derive `staffKindLabel` + `hasNoTeamRecordAccess` (§4). ⚠ **Stored grants keep a `roster` key on existing rows — the resolver must ignore it, not choke on it.** |
| **S2** | **Routes** | Replace `canViewRoster` denials on the roster, attendance, player, recap and practice-plan routes per §3. ⚠ `rosterPii` reads are **untouched** — verify each one individually. |
| **S3** | **Nav + altitude** | `isCoachNavItemVisible`: Roster / Attendance / Development / Insights re-keyed. `coach-overview` tile selection, `coach-ask-questions` attendance questions, depth chart, history page. |
| **S4** | **Head coach's staff card** | Remove the Roster segment; add the standing line (mockup frame 1). Remove `planPlayerNames` from the helper access card copy — it currently promises the roster stays hidden, which becomes false. Check `GRANT_LABELS` / `DEFAULT_ON` / `DEFAULT_OFF` derivations. |
| **S5** | **Admin mirror** | `admin/rep-teams/assistant-coaches` reads `roster === 'off'` — same treatment. |
| **S6** | **Tests + docs** | Update `coach-helper-preset.test.ts` (asserts `hasNoTeamRecordAccess` on a roster-keyed bundle). Add a test that a helper-shaped bundle still labels "helper" and still has no record access **after** the grant is gone. `/docs` handoff for the assistant-coaches + Season's End help sections. |

## 6 · Risks

| Risk | Mitigation |
|---|---|
| ⚠ **Weakening the guardian-PII gate** — the standing owner item on A1. The retired grant feeds the same redaction helper as `rosterPii` | S2 verifies every `rosterPii` read individually. **The family access panel is already `rosterPii`-gated server-side (verified 2026-08-03), so opening the roster page does not expose the family queue.** |
| Stored grants still carry `roster` | Resolver ignores unknown keys; `normalizeGrants` already drops them. No backfill, no migration. |
| ⚠ **THE ONE BUNDLE THAT NARROWS — found by `/review`, verified against both databases** | The plan and the owner briefing both claimed *"nobody's access narrows."* **That is very slightly too strong, and the exception is worth stating precisely.** A pre-A1 assistant holding `roster: 'view'` as their ONLY record-ish grant — i.e. attendance, lineups **and** documents all explicitly switched OFF — had `canViewRoster === true` and got the roster page, Development and Insights. Post-A1 they hold no duty at all, so `hasRecordAccess` is false: those sections close, and the team page shows them the duty-less landing screen instead of the Overview. ⚠ Note `documents` defaults to `'view'`, so this requires a deliberate **three**-switch-off configuration; leaving documents alone keeps record access. **Blast radius verified as ZERO: `rep_team_coaches` holds 0 assistant-coach rows on dev AND prod** (queried 2026-08-03), so no live coach is affected and A1 is not on prod. **The real consequence is forward-looking and is a true property of the ruled design, not a bug:** the model can no longer express *"sees the team list, holds no duties"* — that bundle is now indistinguishable from a Helper, which is what Option A means. Recorded rather than fixed; a code fix would mean either resurrecting the retired grant or inventing a new one, and both are what the ruling forbids. |
| An assistant deliberately set to Roster: Hidden gains sections | Intended by the ruling. ✅ **Owner-ruled 2026-08-03: release notes + help guides only** — no email and no in-app announcement, because nobody's access narrows and nothing breaks. Actively notifying affected head coaches was offered and declined (it advertises a control that never worked). |
| Season's End door reopens | §4.2 ships in the same slice set. Non-negotiable. |

## 7 · Verification

- `npm run typecheck` (shared module — `CoachCapabilities` is portal-wide) + full unit suite.
- ⚠ **Owner browser QA needs a SECOND signed-in account set up as a helper.** Phase 4 could not probe
  the helper's own screens for exactly this reason; this change alters them. → `OWNER_QA_LEDGER.md`.
- Confirm on a closed season: a helper meets *"This season has finished"*, and the season review is
  not reachable from the portal root, the sidebar, either team switcher, the season rail or a typed URL.

## 7.5 · ✅ BUILD RECORD (2026-08-03, `dev`, uncommitted)

**All six slices built. `npm run typecheck` clean · 1174/1174 unit tests ✓ · 0 lint errors ·
`verify:changed` all green (token debt 0, palette AA, date-correctness 0, schema parity 0,
dictionary OK, org-context guard 286 routes clean).** No migration, no new capability.

**Three things the build found that the plan did not:**

1. ⚠ **`canManageAwards` was a live hole, and is now closed.** It read `schedule || roster !== 'off'`
   — and a **Helper holds `schedule: true`**, so the awards API said yes to a parent volunteer. The
   nav never offered it (awards sit inside Insights, shut to a helper), but the route is the last
   line and it was open. Now keyed on `hasRecordAccess`. Costs no real coach anything.
2. ⚠ **The Insights page had one flag doing two jobs.** A single `canRoster` decided both whether to
   *fetch* the attendance report and whether to *draw the door* to it. With the attendance route
   re-keyed to its own duty, a record-access flag would have fetched a 403 and reported it as a
   genuine failure ("couldn't be loaded"), then drawn a door onto it. Split into `canAttendance`.
3. ⚠ **The admin mirror kept a hand-written COPY of the capability shape**, which is exactly why A1
   produced no compile error there while every other caller failed loudly. Replaced with an alias of
   the real type, so the next grant change breaks the build here instead of drifting.

**Two tests added** rather than only updated: the stale-key contract (a pre-A1 bundle still carrying
`roster`/`planPlayerNames` resolves correctly and still labels "helper"), and the
assistant-reaches-past-plans-without-notes property that §2's narrowing fix depends on.

**Change notice (owner ruling):** ⚠ `/release` must carry a line at promote time — assistants who
had the roster hidden gain those sections. Suggested: *"Players' names and numbers are now visible to
everyone on a team's coaching staff. Contact details and birthdates stay behind their own separate
control, unchanged."* Entries are appended by `/release` at promotion, so none is dated here.

## 8 · Out of scope

The six-door season-review closure and the staff-removal sentence are **separate items** from the same
ruling — sequenced after this one so the helper gate is written once, against the post-A1 model.
