# New-chat prompt — P3's GATE: design the practice-plans shelf, don't build it

Paste everything below the line into a fresh chat.

---

You are running a **design session, not a build.** P3 of
`docs/projects/active/COACH_MEMBERSHIP_HISTORY_IN_PLACE_PLAN.md` — the practice-plans history shelf —
is **owner-gated**: plan §1 ruling 6 says every history shelf gets *"its own detailed planning session
with mockups, approved before build."* Your output is **mockups and a recommendation**. You write no
production code, and you do not touch `HISTORY_ENDPOINTS`. If you find yourself editing a route, stop.

## Where this sits

P1 and P2 are committed on dev (`8415dcd2`, `fd7c2c3e`) and awaiting owner QA (ledger §39, §40).
Together they deleted the coaches portal's season toggle and the archive as a *place*. A coach sees
the season their team is on. Looking back happens in exactly three named spots — Season's End, Season
Wrapped, and the "Past seasons" compare list at the foot of Insights → *How are we doing?* — and one
build-enforced allow-list (`HISTORY_ENDPOINTS`, today just `wrapped`) says so.

**Read before proposing anything:**
- `CLAUDE.md`'s "HISTORY IS DELIVERED IN PLACE" section — the binding rule, replaced in P2.
- The plan's §1 (the rulings), §3 (what was deleted), §8 (open follow-ups).
- `tests/unit/coach-history-endpoint-guard.test.ts` — the three questions any addition must answer,
  and the reason the list exists at all.
- The live screens: the Practice plans hub (`/practice`), one plan (`/practice/[eventId]`), the
  read-only past-plan view (`/history/development/practices/[eventId]`), and the Development report
  that links to it.

## ⚠ The constraint that decides this, stated first because it is a design constraint, not a caveat

> **The current season is always the page's primary focus.** The historical layer must be quiet —
> below the live content, collapsed or on demand, never default-open, never stealing the page's first
> read. **A shelf that makes the live screen noisier is a failed design regardless of how useful the
> history is.**

That is the owner's ruling, verbatim in substance. Every option you present must be judged against it
*before* it is judged on usefulness. If your best idea makes the Tuesday-night practice screen busier,
say so and present it as the rejected option.

## ⚠⚠ Test the question before you answer it

This project's standing rule (`AGENCY_RULES.md`): **re-frame a wrong question rather than answering
it, and widen the question when the evidence is wider than the ask.** That rule has already paid for
itself twice on this rail — once when a plan's own audit recommended the opposite of a standing
ruling, and once when "who should see the multi-season history?" turned out to be the wrong question
because removing a coach didn't remove them.

So **do not start from "where does the shelf go."** Start from:

1. **What is the real moment?** Name the specific thing a coach is doing when they want a past plan.
   Copy last October's rotation forward? Remember what they did against this opponent? Show a parent
   what a practice looks like? Each implies a different surface, and some of them are not a shelf at
   all — a copy-forward already exists (`development/drills/past-seasons` and
   `plan-templates/past-seasons` both copy a coach's own past work into the LIVE library and write
   nothing back). **If the moment is already served, the honest answer is "build nothing", and that
   is an acceptable outcome of this session.**
2. **Is a past plan a RECORD or an INSTRUMENT?** The guard test's first question. A written plan is a
   record of what a coach intended on a night that happened — but the *libraries* around it (drills,
   plan templates, the tag vocabulary) are instruments and were ruled live-season-only. Where exactly
   is the line, and does your design stay on the right side of it?
3. **Could the coach tell which season they are reading?** The page-title season chip is GONE. Any
   surface that can show two different years now needs its own answer to this, and "add the chip back"
   is not one — it was the season switcher wearing a label.

## What already exists, so you design the delta and not a duplicate

- **A read-only past-plan page already ships**: `/history/development/practices/[eventId]`, served by
  `events/[eventId]/practice-plan/read`. Since P2 it resolves the team's **working** season, so it
  reaches a finished season only while the team is between seasons. **That is the actual gap** — not
  "there is no way to read an old plan", but "there is no way once the next season starts."
- **The plan renders from its own snapshot.** Every word comes from jsonb that copied the drill's text
  when the drill was added, so editing a drill today cannot rewrite what June's practice says. That is
  why this was the one archive door Chunk F approved without argument, and it is the strongest
  argument available to you.
- **The Practice plans hub** already lists upcoming and recent practices with `Plan set` / `No plan`
  chips and a "Needs a plan" filter. Whatever you propose lands next to that, not instead of it.

## What to produce

1. **TWO OR THREE genuinely different shapes**, as an owner-facing mockup artifact (per house rule,
   published as a Claude Artifact, not a local file). Not three variations of one idea — different
   *answers*, e.g.:
   - nothing new: the copy-forward path already covers the moment, plus wording that makes it findable;
   - a quiet drawer on the live plan screen ("what we did last October"), collapsed, opened on demand;
   - a per-season entry reached from the compare list, keeping history in the look-back layer where
     P2 put everything else.
   For each: what a coach sees on a Tuesday when they *don't* want it, which is the test that matters.
2. **A recommendation with the reasoning**, including which option you would reject and why.
3. **The `HISTORY_ENDPOINTS` consequence, stated explicitly** — for each option, whether it needs a
   route to serve a season the caller names, and if so, the three questions answered in full. An
   option that needs no allow-list change is *cheaper than it looks*; say so.
4. **What it costs the live screen**, measured not asserted: which rows/pixels/first-read the shelf
   takes on the Practice plans hub and on a single plan, at 390px as well as desktop.
5. If and only if the owner approves a shape: a plan + PM-brief pair in `docs/projects/active/`, and
   **then** a separate build prompt. Not before.

## What you must NOT do

- Build anything, add a route, or edit `HISTORY_ENDPOINTS` / the guard test.
- Re-open P2. The season dial is deleted by owner ruling; a design that reintroduces "point the portal
  at a past year" is out of scope, not a third option.
- Touch P4 (the money past-season book) — it has its own gate and its own session.
- Assume the plan's prose is true where it can be checked against code. This repo's plans have been
  wrong repeatedly, including an audit row that would have led to building the opposite of a standing
  ruling. **Argue from what the code does.**

## Two things in flight you should know about

- **A money-tab session is working in the same checkout** (the Money hub splitting into Transactions
  and Payables). Its files are uncommitted. You are writing docs and mockups, so you should not
  collide — but if you touch anything under `accounting/`, check `git status` first.
- **P2 owes one piece of verification**: the five new finished-season screens have no rendered
  baseline yet (plan §8). It needs a quiet dev server. Not your job unless you happen to have one.
