# PM Brief — Coach Onboarding: Quiet Mode

**Status:** Approved 2026-07-29 · Phases A + B built on `dev`, owner QA pending · Phase C open
**Full plan:** `COACH_ONBOARDING_QUIET_MODE_PLAN.md`

---

## In one line

A paying coach currently opens their team and sees a setup checklist instead of their team; we
are shrinking that checklist to a single line, moving progress into a small header control, and
moving the actual product explanation to where each feature lives.

---

## What's wrong today

When a Premium coach opens their team, the entire first screen is a setup panel — a five-step
progress trail, a checklist of things they haven't done, a row of unlabelled shortcut chips, and
a link to a guide. Their roster count, their next game, their dues, their tournaments — the
things they came for — start below the fold.

Three things make it worse than a normal onboarding panel:

- **There's no way out.** The "hide" option only appears once every step is finished or skipped,
  and steps can only be skipped one at a time. Clearing it takes five separate actions.
- **It says the same things twice.** "Add players", "Add a game", "Set up dues" already appear
  as prompts on the dashboard tiles immediately below it.
- **It reappears for every team.** A coach running three teams gets three panels, and an
  assistant coach gets a panel about a roster they may not be allowed to edit.

It also promises a timeline it can't keep. The panel is headed "Your first week" but stays up
until every step is cleared — which can take a month — and in a coach's second season it comes
back and tells them it's their first week again.

---

## What changes for the coach

### They see their team first

The panel is replaced by a single line under the page title naming one next action, and a small
"Season setup 1/5" control tucked into the header beside the help button. The dashboard tiles
move above the fold. Onboarding chrome goes from roughly a full screen to roughly one line.

### They can turn it off in one click

The line has an ✕. One click ends all setup prompting for that coach — on every team they hold.
Nothing is destroyed: the header control stays, quietly, and reopens the full checklist whenever
they want it. Inside that control, **every** step can be skipped, not just the next one.

### Setup stops shouting once they're running

Once the five essentials are done, the line disappears entirely and the header control goes
quiet — no count, no percentage, no "3 optional steps left" banner. A coach who is running their
team stops being counted at. When everything is done or skipped, the control disappears too.

### Each feature explains itself where it lives

Instead of a row of chips on the dashboard, every section teaches itself when a coach opens it
and finds it empty. Lineups explains what a lineup is, what it feeds (game sheets, attendance,
playing-time fairness), and what's blocking it ("you'll need players first") — with one button
and one link to the fuller guide.

This is the part that actually answers "help coaches understand what the product does", and it
works for coaches who never saw a setup panel at all: someone joining a team mid-season, an
assistant, a coach on their third team.

### A one-time tour, offered not imposed

On a coach's very first visit only, the next-action line carries a quiet second link: "New here?
Take the 2-minute tour." It is a link, never a pop-up. It opens as a side panel so the sidebar
stays visible while the tour talks about the sidebar, and walks through four groups — Squad,
Season, Money, Communication.

**Skipping it ends it permanently, for that coach, on every team and every device.** It never
asks again. It stays available forever from the help button for anyone who changes their mind.

### The wording stops promising a deadline

"Your first week" becomes **"Season setup"** — true at day 2, week 6, and in year three, and it
explains why the checklist reappears when a coach starts a new season. The optional group renames
from "Finish setting up" to "When you're ready", because skipping a budget is a legitimate way to
run a team, not an unfinished job.

---

## Why it matters

A coach's first impression of a paid product should be their team, not a list of homework. The
current panel inverts that on the one screen every coach lands on, every time, on every team.

It also isn't teaching. A checklist demands action before understanding — a coach can't tell from
a chip labelled "Development" whether they care about it. Moving the explanation to the moment of
curiosity is both quieter and more effective.

And the "no way out" problem is a trust cost: a product that won't stop nagging a coach who has
decided not to use budgets reads as a product that doesn't listen.

---

## Who's affected

| Who | What changes |
|---|---|
| **Head coach (Premium)** | Full change — reclaimed screen, one-click dismissal, tour offer |
| **Assistant coach** | Bigger improvement: they no longer see a setup panel for steps they can't complete. The control only appears if they can actually do something |
| **Coach with multiple teams** | Dismisses once, not once per team |
| **Free-tier coach** | No change — the free portal has its own onboarding, deliberately separate |
| **Org admins / parents** | No change |

---

## Tradeoffs made

- **The tour is the weakest teaching tool of the three**, and we know it — it's read cold, before
  the coach has context to hang it on, and most people won't finish four cards. It earns its place
  as a day-one orientation for coaches who want one. We are not relying on it to make features
  discoverable; the in-section explanations do that job.
- **Progress becomes something a coach opens rather than something they're shown.** Some coaches
  will never open it. That's the intended trade: the next-action line still names the single most
  useful thing to do, and the dashboard tiles still prompt for what's missing.
- **Step skips stay per team.** Only the preferences ("hints off", "tour skipped") follow the
  coach. Skipping "set a budget" on one team shouldn't silently skip it on another — that's a fact
  about a season, not a preference.
- **The permanent tour-skip needs account-level storage**, which arrives with the tour rather than
  with the first phase. Until then the first phase's dismissal is remembered on the device the
  coach used.

---

## Priority and sequencing

**Phase A — reclaim the screen.** The direct fix for the complaint, contained to the team
Overview page. No database change. This is what ships first.

**Phase C — the one-time tour.** Mostly wiring on top of A; the tour content largely exists in
the help system already. Brings the account-level preference store that makes "skip forever"
actually mean forever.

**Phase B — teach in each section.** The most valuable for long-term understanding and the
longest tail, because it's a per-section writing job. Ships section by section; sections not yet
rewritten keep what they have, so there's no half-finished state.

---

## Phase B — what shipped (2026-07-29)

All twelve sections now explain themselves at their own empty state, in three beats: what this is,
what it makes easier elsewhere, and what has to happen first. Then one button, and a quiet link
into the guide.

The second beat is the point. A chip could say "Development"; it could never say *"this is what
lets Insights tell you whether every player is getting attention."* That sentence is now a
first-class part of every empty state rather than something a copy edit can quietly drop.

**Nine sections gained a permanent Help control in their header** — Lineups, Development,
Insights, Roster, Schedule, Money, Announcements, Documents and Staff had none, so a coach with a
question had to leave the page to find one.

**Four guides had to be written from scratch,** because Lineups, Development, Insights and
Coaching staff had nowhere to link. Lineups was the worst case: "How does Auto-fill decide who
plays where?" was filed under *Taking attendance*, so a coach browsing the guide would never find
it. Those answers have been moved to where they belong.

**Five places were quietly promising things a coach couldn't do,** all found while checking that
every button matches the permission that lets you *finish* the job:

- An assistant with lineups but Schedule turned off was told to "Add a game" — and sent to a page
  they can only read. Same on the Schedule's own empty state.
- An assistant allowed to send announcements was told to go add guardian emails to the roster.
  Editing the roster is the head coach's job, so that was a dead end.
- **Tryouts had no permission check on the page at all** — anyone reaching it by link saw the full
  set of write controls, which then failed at the server.
- **The Documents "Upload Template" button never worked for anyone.** There is no upload feature
  behind it; every coach who filled the form in got "Upload failed". Removed, with your approval —
  Documents is honestly download-only now (your organization publishes the templates; signed
  copies attach to each player on the roster). It can come back when the feature is built.

**The "Also in your portal" chips are gone,** as planned — and only now that every section teaches
itself, so no discovery gap opened in between.

**Two help answers were out of date** and are fixed: one still described the five-step "Your first
week" trail Phase A removed, and the chip row Phase B just removed.

---

## How to test it

1. **Open a team with an empty roster.** The dashboard tiles should be visible without scrolling.
   One line under the title should name adding players, with a button.
2. **Click the ✕ on that line.** All setup prompting should stop. Open another team you coach —
   it should be off there too.
3. **Click the header control.** The full checklist should open, every step should offer a Skip,
   and skipped steps should offer an Undo.
4. **Add a player, then reload.** The next-action line should move on to the next step, and the
   count in the header should tick up.
5. **Clear all five essentials.** The line should vanish and the header control should go quiet —
   no percentage, no leftover banner.
6. **Sign in as an assistant coach with money access turned off.** No budget or dues steps should
   appear, and the count should reflect the smaller list.
7. **(Phase C) Skip the tour, then open a different team, then a different browser.** It should
   never offer itself again, but should still be reachable from the help button.

### Phase B specifically

8. **Open Lineups on a team with no games.** It should explain what a lineup is, say that game
   sheets, attendance and Insights read from it, and tell you a game has to exist first — with
   one button to the Schedule and a "How lineups work" link that opens the guide in a slide-over.
9. **Open Development, Insights, Chat, Documents and Staff on a fresh team.** Each should explain
   itself rather than showing a bare "nothing here". Insights and Chat should offer no button —
   there is genuinely nothing to do on either until data or an organizer arrives.
10. **Tap the Help (?) control in each section header.** It should open that section's guide
    without leaving the page.
11. **Open the Season setup chip on your Overview.** The "Also in your portal" chip row should be
    gone; the tour link and the off-switch should still be there.
12. **Sign in as an assistant with Schedule turned off, then open Lineups.** It should say a game
    is needed and that adding games needs schedule access — and should *not* offer an "Add a game"
    button.
13. **Sign in as an assistant who can send announcements but can't edit the roster.** With no
    guardian emails on file, it should tell you to ask your head coach, not to go add them
    yourself.
14. **Open Documents.** The "Upload Template" button should be gone; the empty state should say
    your organization publishes the templates.

---

## Success criteria

1. A first-time coach sees their team's real data above the fold on first load.
2. Onboarding chrome shrinks from roughly a full screen to roughly one line.
3. Turning off all setup guidance takes one click, down from five.
4. Every section explains itself at its own empty state, without a trip to the dashboard.
5. A coach who skips the tour is never offered it again — any team, any device.
6. No coach is shown a step or card for something their permissions forbid.
