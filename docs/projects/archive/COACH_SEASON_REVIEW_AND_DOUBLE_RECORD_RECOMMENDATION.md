# Two recommendations from Practice Plans Phase 4 — the season review, and one adult with several records

**Written 2026-08-03.** Recommendation session — **no code was written, nothing was staged, nothing was
committed.** Both questions were verified against the code and the Business Decisions Log rather than
against the prompt that raised them.

> **Status: ✅ RULED BY THE OWNER 2026-08-03 — all three recommendations ACCEPTED as written.**
> **A — No:** Season's End and Season Wrapped are coach surfaces; all six doors close, not one.
> **C — Leave the model alone:** no merge, no combined list; the quiet "also follows the team" label
> only. **D — Fix the sentence:** the staff-removal confirmation is corrected to say what it actually
> does. **B** was closed on evidence and needed no ruling; **E** is carried into A1's scope.
> Logged in `BUSINESS_DECISIONS.md` via `/strategy`.
>
> **✅ ALL THREE RULINGS ARE NOW BUILT on `dev` 2026-08-03, uncommitted** (Phase 4 committed at
> `2e3e7e0d`, so the sequencing block is lifted; A1 shipped first, then these).
> **A —** the season review is closed to non-coaches at the route, the nav and the page, so all six
> paths land on the honest screen. **C —** no merge; the permitted label only. **D —** the removal
> sentence is corrected and names the family relationship when one exists.
> QA = `OWNER_QA_LEDGER.md` §1.9c.

---

## 0 · What changed while this was being asked

Verified first, because the prompt warned it would move:

| Source | Says | Status |
|---|---|---|
| `BUSINESS_DECISIONS.md`, top entry | **A1** — names, numbers and positions are baseline for **everyone with portal access, including helpers**; the `roster` view/off grant is retired and `planPlayerNames` retires with it | **Decided**, not started |
| `BUSINESS_DECISIONS.md`, second entry | A Helper sees full roster basics exactly as an assistant does; the double-record seam is an **accepted limitation**, logged for the guardian switch-on | **Decided**, built |
| `CLAUDE.md` | The coaches-portal archive is **opt-in** and fails closed; hide an entry point rather than let it dead-end | Binding |

**A1 does dissolve the capability half of question 1**, exactly as the prompt said. It does *not*
dissolve the archive half — and it introduces a new problem of its own, which is the single most
valuable thing this session found (§1.4).

---

## 1 · Question one — who should receive a season review

### 1.1 · Recommendation (1a): **Season's End and Season Wrapped are for coaches. Ratify Phase 4's judgement, and rebuild it on a foundation that survives A1.**

A helper should **not** receive a season review. Phase 4 got the answer right; it got it right in one
place, by accident of where the fix happened to be needed, and on a predicate A1 is about to break.

**The reasoning is altitude, not privacy.** After A1 there is nothing on the Wrapped card a helper is
forbidden to see — the one person-level fact on it is `First name #number`, and that is baseline now.
The question is whether a whole season belongs to someone who ran one station on one Tuesday.

The portal's own rule answers it. `CLAUDE.md` makes the archive **opt-in**, and the test that enforces
it (`tests/unit/coach-season-write-guard.test.ts`) asks three questions of every archive door. The
third is *"does it show what the coach could see AT THE TIME?"* — and for a helper, what they could see
at the time was **one practice**. Season Wrapped is a season: the record, the win streak with its
dates, the closest game with the opponent named, attendance across every game day, who won the most
awards. None of it was ever theirs. It is not a leak; it is a category error, and the archive rule
exists precisely to make someone decide rather than let reachability decide.

**The alternative it beat:** *let them have it — the names are baseline anyway, and a season review is
a warm gesture toward a volunteer who helped.* This is a genuinely reasonable position and it is worth
recording that it was considered. It loses on two grounds. First, the archive ruling is opt-in **by
default** — "harmless" is not the standard, "someone decided" is. Second, a helper is the first
non-coach adult on a staff list and will not be the last; whatever is ruled here is the precedent for
everyone who follows, and the cheap moment to set it is now, with one persona, not later with three.

**Cost of doing nothing:** a parent volunteer who ran one station in June signs in months later and is
handed the team's whole season, including a **share button that produces an image with a child's name
on it** (§1.2). Nobody decided that. The default decided it.

### 1.2 · Finding (1b): **Wrapped has a real exit door — and it is a considered design that should not change.**

Verified, not assumed. There **is** a live export path today:

- `components/coaches/SeasonWrappedCard.tsx` renders a **"Share your season"** button.
- It draws a 1080×1080 PNG on a canvas in the browser (`lib/wrapped-share-card.ts`) and hands it to
  the **native OS share sheet** (Web Share API Level 2), falling back to a file download.
- **There is no server route, no hosted image, no public link, and nothing indexable.** The comment
  says so and the code matches it: *"no server image infra, no public route, the coach decides where
  it goes."*

**What can leave the app on that image:** team name, season name, the win–loss record, the longest
streak with its start and end dates, the closest game with score, opponent name and date, an
attendance percentage, and one person-level line — **"MOST AWARDED · Emma #7"** — plus any tied names.
Money is excluded by construction.

**Assessment: this is settled, and I recommend closing it.** The share-safe first-name-plus-number
label is a deliberate design that a prior adversarial review already tightened once, when a reused
lineup's auto-generated label leaked full names into the same payload. A coach sharing their own
team's season on their own phone is the intended use, and the card carries strictly less than the
team photo they would otherwise post. **No new project, no `/strategy` entry.**

⚠ **But it makes §1.1 sharper, not softer.** The exit door exists, so "should a helper receive a season
review?" is not only about what they read — it is about what they can **publish**. A helper today can
press that button. That is the strongest single argument for the recommendation above.

*(One small, optional polish, not a decision: the share button carries no wording about what is on the
card. A coach presses "Share your season" without being told a player's first name and number are on
it. Low priority, copy-only — noted so it isn't rediscovered.)*

### 1.3 · Door list (1c): **Phase 4 closed one of six doors, and the one it closed is the one nobody walks through.**

Every path into Season's End for a person holding a helper-shaped bundle on a closed season. **All six
end at the same place, and in every case the server SENDS the payload** — the Wrapped route
(`app/api/coaches/.../wrapped/route.ts`) gates only on *"did you hold an assignment on this season"*
and *"is the season closed"*. **It checks no capability at all.**

| # | Door | State |
|---|---|---|
| 1 | **The portal root.** Signing in at `/{org}/coaches` auto-redirects to `…/season-end` when the chosen team's season is closed | ⚠ **OPEN — and it needs no click.** No helper check exists here. This is where a helper actually lands. |
| 2 | **The archive sidebar.** `CLOSED_TEAM_NAV_ITEMS` lists "Season's End" first; `isCoachNavItemVisible` has **no case for that label**, so it falls through to `default: return true` | ⚠ **OPEN.** It is the only door in the closed-season set that no grant governs. |
| 3 | **The sidebar team switcher** — a closed team opens on `…/season-end` | ⚠ Open |
| 4 | **The phone's team dropdown** (`CoachesBottomNav`) — same href | ⚠ Open |
| 5 | **The season switcher `?year=` rail** — sections that don't exist in an archive fall back to `…/season-end` | ⚠ Open |
| 6 | **A typed URL, or a direct API call** | ⚠ Open — the route is the last line and it isn't one |
| — | **The team page** (`teams/[teamId]/page.tsx`) — shows *"This season has finished"* instead of redirecting | ✅ **Fixed by Phase 4** — but a helper only reaches it by typing the URL, because door 1 redirects them away first |

**This is not a criticism of Phase 4.** Its `/review` found a real thing and fixed it correctly at the
place it was looking. The fix was placed one level below the door people use — which is the exact
defect class `CLAUDE.md` warns about for archives: *"the unit of work is every page reachable from the
door, not the door."*

**The shape of the right fix (not a build instruction — for whoever scopes it):** the archive's door
set is currently answered **per season** (`APPROVED_ARCHIVE_DOORS`) but never **per person**. Season's
End is the first door that needs both. One gate in `isCoachNavItemVisible` plus one capability check
in the Wrapped route closes all six at once, because every door leads to that route.

### 1.4 · ⚠ The finding that matters most: **A1, as scoped, silently reopens the door Phase 4 closed.**

Both mechanisms Phase 4 built to recognise a helper are keyed on **`roster === 'off'`** — the exact
state A1 retires:

- `hasNoTeamRecordAccess()` — the predicate behind the *"This season has finished"* screen. It reads
  `roster === 'off' && !attendance && !lineups && …`. Give a helper roster visibility and it returns
  **false**, the helper-shaped branch stops firing, and the normal closed-season redirect to Season's
  End resumes.
- `staffKindLabel()` — the function that prints the word **"Helper"** on the head coach's staff list.
  It requires `roster === 'off'` too. After A1 every helper is labelled **"Assistant"**, and the head
  coach loses the only place the portal tells them what they invited.

**Neither is a gate** — both files say so emphatically, and that is true. But A1's own handoff already
warned about this: *"re-audit the surface list rather than trust this entry — the helper work was
itself changing those gates as this was written."* This is what it was warning about.

**This belongs in A1's scope, not in a new project.** A1 is a simplification and should stay one; it
simply needs to re-derive "is this bundle a helper / does this bundle have any record altitude" from
something other than the grant it is retiring. Flagging it here so whoever picks up A1 does not
discover it in QA.

**Cost of doing nothing:** A1 ships as a clean simplification, and two things quietly regress with no
diff that looks like a regression — the helper's honest end-of-season screen, and the word "Helper" on
the staff list.

---

## 2 · Question two — one adult, several records

### 2.1 · Recommendation: **Separation is correct. Do not join them. Fix one sentence instead.**

**Recommended: leave the model alone.** The two relationships are genuinely different things and the
platform is right to model them separately:

- They **originate differently.** A helper is *invited by the head coach*. A follower *asks, and is
  approved*. Those are opposite directions of trust.
- They carry **different consent**, and the guardian tier will carry a stored legal artifact that
  neither of the other two has.
- The separation is what makes the boundary **auditable**. `lib/family-access.ts` says so in its own
  header: one file answers *"who is in?"*, a different file answers *"what do they see?"*, and
  **neither file can quietly answer both**. A joined identity record is a third file that answers
  both, which is the property being protected.
- **A merge is the single change most likely to widen access by accident.** It would not widen access
  on the day it shipped; it would create a place where a future change *could*, and nothing in the
  test suite would notice.

**And the coherence problem is smaller than it was described.** Both surfaces already display the
**email address** — the staff card shows it under the name, and the follower row *is* the email. A
head coach who wonders is not blocked from finding out. What is missing is correlation, not
information.

**The alternative it beat:** a combined *"people connected to this team"* view. **Reject it.** A
single list implies a single record, and a single list invites a single **Remove** button — which is
the merge arriving through the UI instead of the schema. It is the most attractive-looking option and
the most dangerous one.

**Cost of doing nothing:** genuinely low today, and it rises on the day the guardian tier turns on.

### 2.2 · ⚠ Verified defect (2.4): **removing a helper tells the coach something that is not true.**

The prompt asked whether removing one relationship can mislead a coach into thinking they removed the
other. **It can, and in the direction that matters.** From `components/coaches/CoachStaffPanel.tsx`,
the confirmation a head coach reads before removing a helper or assistant on a **live** season:

> **"{name} loses access to this team immediately. You can invite them again later."**

For an adult who is *also* a family follower, that sentence is **false**. The family layer is untouched
by a staff removal: they keep the schedule, the results, and any game page that was shared. The head
coach most likely to read that sentence carefully is the one removing someone after a problem — and
they will stop reading at "immediately".

The reverse direction is safer only by accident: removing a follower has **no confirmation at all**,
so it makes no claim to be wrong about.

**Recommendation: fix the sentence, not the model.** Make the staff-removal dialog say what it
actually does, and — when the same email also holds a family link — say so in the same breath, with a
pointer to where the other one is managed. That is a copy change plus one lookup. **No schema, no
merge, no joined record**, and it is the thing that keeps mattering when the third record arrives.

**Cost of doing nothing:** a head coach removes a helper after an incident, is told access ended
immediately, and it did not.

### 2.3 · The smallest thing that helps, ranked

| Rank | Option | Verdict |
|---|---|---|
| **1** | **Make the staff-removal confirmation truthful** (§2.2), and name the other relationship when one exists | ✅ **Do this.** Copy + one lookup. Fixes a real defect, not a coherence itch. |
| **2** | A quiet **"also follows the team"** note on the staff card — a *label*, computed by comparing normalised emails at render, **joining no data and offering no action** | ✅ Worth doing **with** #1, since both need the same lookup. Cheap and reversible. |
| **3** | Wait for the guardian tier before anything further | ✅ Correct posture for everything beyond #1 and #2. Two records are legible; three, one of which is player-linked and legally consented, is where it stops being. |
| **4** | A combined "people connected to this team" view | ❌ **Reject** — §2.1. |
| **5** | A shared identity record joining staff and family | ❌ **Reject emphatically** — this is the merge. |

### 2.4 · What the guardian switch-on inherits (input for that scoping)

Handing this forward, as the prompt asked, so it is not discovered late:

1. **The third record is different in kind.** Follower and helper are both revocable grants with no
   artifact. A guardian link carries a **stored consent record** (`lib/family-guardian-consent.ts`) and
   is tied to **one specific child**. Removing it is not symmetrical with removing the other two, and
   the removal copy (§2.2) must be re-checked with three records on the table, not two.
2. **Nothing prevents the same email holding all three.** Verified: no constraint, no check, no warning.
   That is fine — but it should be a *decision* recorded at switch-on, not an omission discovered after.
3. ✅ **One thing that is already safe, verified so the obvious fear can be set aside.** The family
   access panel (followers, the approval queue, schedule visibility) is mounted on the **Roster page**
   and gates itself **server-side on `rosterPii`**, which a helper does not hold. **So when A1 opens the
   roster page to helpers, it does not hand them the family panel** — the panel asks the API first and
   draws only on a yes. The "two doors" safety property that Gate 2 demanded survives A1 intact.
4. **The tier boundary must stay the audit surface.** Whatever is built for coherence must not give
   `family-access.ts` or the capability resolver knowledge of the other. A label computed at render is
   safe; a joined record is not.

---

## 3 · Summary — what the owner is being asked to rule

| # | Decision | Recommendation |
|---|---|---|
| **A** | Should a non-coach adult (helper, and anyone like them later) receive a **season review** in a finished season? | **No.** Season's End and Wrapped are coach surfaces. Ratify Phase 4's judgement as a rule, and close all six doors rather than one. |
| **B** | Is **Wrapped's share-to-phone image** an open question? | **No — closed.** Real export path, no public link, deliberately share-safe payload. Evidence in §1.2. |
| **C** | Should staff and family relationships for the **same adult** be joined? | **No.** Separation is the correct design; §2.1 gives the reasoning at length. |
| **D** | Is anything **broken today**? | **Yes, one thing:** the staff-removal confirmation claims an absolute it cannot deliver (§2.2). Fix the sentence. |
| **E** | Carried to **A1's** scope (not a new project) | A1 retires `roster: 'off'`, which is what both helper-recognition mechanisms are keyed on (§1.4). |

**Nothing here is blocked on the guardian counsel packet.** A, B, C and D can all be ruled today; only
the further coherence work in §2.3 waits for the tier to turn on.
