# Coach access becomes CURRENT STAFF ONLY — and the archive follows the team, not the tenure

**Status:** PLANNED 2026-08-16, owner-ruled, not yet built.
**Owner ruling:** 2026-08-16, in response to the archive rail's scrapbook question.
**Supersedes:** the head-coach-only scrapbook restriction shipped in `12cf1b19` (now redundant —
see §6), and **governing rule 1 of Chunk F** (see §3, which is the whole point of this plan).
**PM brief:** `COACH_CURRENT_STAFF_ACCESS_PM_BRIEF.md`.

---

## 1. The defect, stated precisely

**Removing a coach does not remove them.**

The staff screen is *per season*. `removeRepTeamCoach` deletes ONE assignment row — the one for the
season being viewed. Access, however, is granted by having a row on **any** season: the closed-season
lookup (`getClosedCoachingAssignmentsForUser`) returns every completed/archived year the user holds a
row on, and the season-read rail admits a request when a row exists for the *requested* year.

So a head coach who drops an assistant in January removes them from **this** season and nothing else.
That assistant keeps every past season they were ever on, and can sign in and read its roster,
schedule, attendance, money and results indefinitely. Nothing tells the head coach this, and the only
way to actually revoke it is to switch into each past season in turn and remove them again.

⚠ **The owner's framing is the sharp version of this:** there is no way for a head coach to express
"remove them entirely" versus "replace them but keep their historical access" — and the system
silently picks the second one, which is the option nobody asked for.

---

## 2. The ruling

> **Access to a team belongs to its CURRENT staff. Whoever the head coach and assistants are right
> now can open the team and every season it has ever had. Everyone else has no access at all.**

Two decisions taken with it:

1. **A current coach sees the WHOLE team history** — not only the seasons they personally worked.
   *(Owner, 2026-08-16.)* A new assistant added today can open 2022. The team's history belongs to
   the team, and the people running it now are the ones trusted with it.
2. **Removal revokes access; it does NOT delete the record.** *(Owner, 2026-08-16.)* A past season's
   staff list still names everyone who actually coached it — that is a true fact about that season
   and the record stays accurate. What the row no longer does is grant a login any access. Re-adding
   someone next year restores their access immediately, because nothing was destroyed.

**"Current staff" means: holds an assignment row on the team's MOST RECENT program year**, whatever
its status. ⚠ That last clause matters — a team whose season has ended and has not rolled over yet
has a *completed* most-recent year, and its staff must keep access. "Season over" is not "off the
team", and conflating them would lock a coach out of the season they just finished.

---

## 3. ⚠⚠ This REVERSES governing rule 1, deliberately — and that must be recorded, not inferred

Chunk F's governing rule 1 is *"same access as when it was live, for everyone who had it"* —
capabilities resolved from the assignment row recorded against the **viewed** season, so an assistant
granted money this year could not read last year's money. It is documented in `CLAUDE.md`, enforced
in `lib/coach-season-read.ts`, and probed by the frozen-season fixture.

**It cannot survive decision 2.1, and not for an implementation reason.** If a current assistant may
open 2022 and was never on 2022's staff, there is no historical capability row to read. The only
alternatives are:

- **current capabilities everywhere** — simple, coherent; or
- **per-season where a row exists, current where it doesn't** — which produces the absurd result that
  a promoted assistant sees *more* of a season they never worked than one they did.

So: **capabilities are the coach's CURRENT ones, in every season.**

⚠ **This is a widening and it must be stated plainly:** an assistant granted money access today can
read every past season's dues and family payment records; one granted guardian-contact access can
read historical guardian details. The rule it replaces existed *because access itself was historical*
— once only current staff hold access, their current grant is the honest one. Recorded here so the
reversal is a decision on the record rather than a side effect somebody finds later.

**What does NOT change:** a finished season stays **read-only**. Governing rule 2 (no writes to a
past season) and the build-enforced archive allow-lists are untouched. This plan changes *who gets
in*, never *what a record permits*.

---

## 4. What changes

| Layer | Today | After |
| --- | --- | --- |
| Which seasons a coach may open | every year they hold a row on | **every year of any team they currently staff** |
| The season-read rail's gate | a row on the *requested* season, else 403 | **current-staff membership on the team**, else 403 |
| Capabilities for a viewed season | that season's row (rule 1) | **the coach's current row** (§3) |
| Cross-season capability map | per-year map | one current answer for every year |
| Removing a coach | drops one season's row; past access survives | **revokes everything at once**; rows kept as record |
| Past-season staff management | a deliberate write exception exists so a head coach can revoke per-season | **no longer needed** — removal from current staff is the single control |

**The change lands at one layer.** 35 coach routes ride `resolveCoachSeasonRead`; none of them need
editing, because the gate they share is what moves. The real surface is the ~5 files that decide
access, plus the fixtures that encode the old model.

---

## 5. Risks

1. **⚠⚠ Lock-out is the expensive failure.** A coach whose season has ended but who is still on the
   team must keep access. The "most recent program year, any status" definition is what prevents
   this, and it deserves a probe of its own — a team mid-rollover has both an active and a completed
   year, and picking the wrong one silently locks out real coaches.
2. **The widening in §3** — historical money and guardian PII become visible to any current coach
   holding those grants. Deliberate, recorded, and reversible by narrowing capabilities alone.
3. **The frozen-season fixture asserts the OLD model in two places** (rule 1's capability leak probe
   and rule 3's revocation probe). Both must be rewritten to assert the new rule rather than deleted
   — a test that stops asserting anything is worse than one that asserts the wrong thing.
4. **`CLAUDE.md` states governing rule 1** and must be updated in the same unit of work, or the next
   session builds against a rule that no longer holds.

---

## 6. What this makes redundant

The head-coach-only restriction on the multi-season scrapbook (`12cf1b19`, ledger §37 part D2) was
built to stop a coach from three years ago browsing the team's history. **Under this model that
person has no access at all**, and decision 2.1 says a current assistant *should* see the whole
history — so the restriction is both unnecessary and now wrong. **Revert it**, and retire §37 part D2
from the QA ledger rather than asking the owner to walk a rule that no longer exists.

---

## 7. Phases

**One phase.** Splitting it would ship a half-changed access model, which is the state most likely to
leak. Owner QA gets its own ledger section, and it needs three sign-ins: a head coach, a current
assistant, and a removed coach.
