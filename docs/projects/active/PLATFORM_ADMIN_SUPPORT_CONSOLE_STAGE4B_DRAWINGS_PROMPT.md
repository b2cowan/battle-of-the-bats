# Platform admin support console · Stage 4b, Coaches Portal free time (drawings prompt)

> Paste into a new chat on `dev`. Written 2026-10-27, after Stage 7 was built and walked. **This session draws and asks.
> It builds nothing.** The output is a drawings Artifact, the owner's rulings on it, and then a Stage 4b build prompt
> (written last, like Stages 2 to 7). **Re-verify every lead against the code before you draw on it:** this prompt is a
> lead, not evidence, and so is any helper's summary. The census in §4 came from one helper on 2026-10-26; only the claims
> marked ✔ were re-checked by hand. The working copy is shared with other sessions: stage explicit paths only, check the
> branch before every commit, `git show --stat HEAD` after it. Commit nothing without the owner's OK.

## 1 · What Stage 4b makes true (the owner's ruling, 2026-10-26)

**Support can give a coach free time on the Premium Coaches Portal, and it goes back by itself without losing anything
the coach has made.** The use the owner expects most: a coach who arrived by being claimed onto a tournament team has
the free (Basic) Coaches Portal and wants to try Premium. Support says "I'll convert your free portal to Premium for 30,
60 or 90 days." When the time ends the coach is back on the free portal, **with their data intact.**

The owner's requirement, in his words: the two portals are built differently in the back end, so going from Basic to
Premium and back must be **efficient without compromising the coach's data.** Everything below serves that sentence.

Stage 4b makes four things true:

1. **Support can give it.** A window on the portal's record (the coach's own record, not a club's) with a length, a
   reason and a one-sentence confirmation, as Stage 4's Give free time window does for a club.
2. **Premium is genuinely on for that time.** The Premium workspace is made (or reused if the coach had one), the
   coach's team, roster, schedule and fees are there, and the Premium tools work. Nothing about it is pretend.
3. **It goes back on its own,** with no cron and nobody remembering: the product reads "is this still in force?" each
   time, as Stage 4's club grants do. **What "back" does with the work the coach did on Premium is the central design
   question** (§5-C and ask 1).
4. **Everyone can see it:** the portal's record and Story (support), the coach's own billing page ("Premium free until
   {date}", what happens then), and Today's free-time queue.

**Not Stage 4b** (later or ruled out; do not draw them as built):
- Club free time (Stage 4, built and walked), refunds and Stripe reads (Stage 3), Status and sent-email log (Stage 5).
- Founding Season's turn-off. It shares the portal's own billing record with this stage, so it is drawn *beside* 4b
  (ask 6) but is not decided here.
- A coach **paying** for Premium (checkout, upgrade, cancel): unchanged.
- Any change to a price, plan name or gate. `docs/agents/strategy/PLAN_PRICING_FACTS.md` is the record; never restate it.

## 2 · Standing rulings (do not reopen)

- Plan "Owner ruling 2026-10-26 (S4b)" and "Owner rulings 2026-10-25 (Stage 4 drawings)" (all 11 as recommended), and
  the standing rules **R1–R8** (a record reads first and edits whole · every live change confirms in one sentence · every
  change records who and why · undo is "Put it back", **never for anything that reached Stripe or an inbox** · read-only
  shows as a record without controls · the money truth is shown, never remembered · plain words, in the product's look).
- **Stage 4's Q10 (no portal grants) was ruled for Stage 4 only** because a portal grant could not open a portal. Stage
  4b is the stage that revisits it; say so on the drawings and do not treat Q10 as a ruling against this work.
- **Stage 4's door and rules are built:** one effective-plan door (`applyEntitlementGrants`, `effectiveOrgFacts*`), the
  rules in `lib/free-time.ts`, the writes in `lib/free-time-writes.ts`, the list in `lib/free-time-list.ts`, the Story
  rows in `lib/free-time-story.ts`, the customer words in `lib/free-time-copy.ts`. **Every billing ACTION reads
  `ownPlanOf(org)`; access reads the effective plan.** Do not draw a second mechanism beside it: say how a portal uses
  the same door, or why it cannot (§4 row 2).
- Stage 1, 2, 3, 4, 5 and 7 are done and walked. Shell, Find, menu by job, Today, Story, Put it back, the one pencil,
  the Free time list. Draw 4b's parts **on** them; do not redraw them.
- Warm is the default; Dark follows the account setting. Draw both. Desktop only for the console (Q4). The coach's own
  billing line is a **coach-portal screen** and needs its phone and desktop view, Warm and Dark.
- Tournament **Basic** coaches are people who were claimed from a tournament team and never signed up. They have not
  chosen us. What they are told, and when, is a customer-facing send and needs its own ruling (ask 7).

## 3 · Read first

- The plan (`PLATFORM_ADMIN_SUPPORT_CONSOLE_PLAN.md`: ladder rows S4 and S4b, "Owner ruling 2026-10-26 (S4b)" and its
  findings, "Stage 4 findings", "Stage 4 build gate", "Stage 4 finish review"), the PM brief, and the index
  https://claude.ai/artifact/TLP8d5Zec4xVkTSYrQU8tp (news goes in as an `ArtifactData` write to `stages/s4b` and
  `log/…`; never republish it).
- The Stage 4 drawings https://claude.ai/artifact/5eawvGUPwQVPoWiAV7vQY5 and walk https://claude.ai/artifact/4nqZcj52DpjYoQSEBWMUVZ
  (ledger §379) for the format the owner approved: true size, Warm and Dark, before = a capture from dev, NEW /
  RESTYLED / UNCHANGED / LATER tags each clickable with its reason, a checkable paste-back with a recommendation beside
  every ask.
- Memory: `project_founding_season_2027` (offer closed 10-26, existing comps honoured to 9-30-27, **a comped coach
  portal is a shadow org**), `project_platform_admin_support_console`, and the Coach Premium and coach-billing notes in the
  settled memory index (`reference_memory_index_settled.md`). Coaches Portal vs Premium Coaches Portal is an **unresolved word call** in the console's
  plan-label maps: check which words the coach's own screens use and draw those.
- `docs/agents/strategy/PLAN_PRICING_FACTS.md`, `BUSINESS_DECISIONS.md`, `PROGRAM_BILLING_AND_ENTITLEMENTS.md`,
  `docs/agents/design/` standards, `AGENTS.md`, `AGENCY_RULES.md` (PM UX summary before code; disagree out loud).

## 4 · Verify these leads first (the plan has been wrong before)

| # | Claim | Check against |
|---|---|---|
| 1 | ✔ Basic → Premium today is a **one-way copy**: the Basic team's rows stay; a Premium workspace is made and the roster, schedule and fees are copied in once, behind an atomic claim (`basic_coach_teams.team_workspace_id IS NULL`), so exactly one copy ever happens per Basic team. Announcements are not copied | `provisionStandaloneTeamWorkspace` → `migrateBasicTeamIntoWorkspace` in `lib/coach-upgrade-migration.ts`. **List exactly what is copied, what is not, and what a second copy would do.** |
| 2 | Stage 4's door reads the **organization** record; a portal's liveness is read from its **own** record (org status, workspace status, team entitlement with `ends_at`), which grants never touch. "A portal grant can't open a portal" | Every place a portal asks "is Premium live?". List each, say which would ignore a grant, and say whether the answer is **one new reader** (the portal asks the door) or **a grant that writes the three records and a read-time revert on top**. Draw the one you can prove |
| 3 | ✔ While Premium is live, the Basic pages **redirect** to Premium; when the workspace is `canceled` the Basic team is usable again | `lib/coach-team-page.ts`. **Do Basic write APIs refuse while Premium is live, or only the pages redirect?** (A Basic write that lands while Premium is live is data the coach will not see.) |
| 4 | There is **no reverse copy**: work done on Premium during the time never returns to Basic. Basic's rows are the pre-upgrade ones | Read the Basic schema against the Premium one: which Premium things have **no Basic home at all** (practice plans, the money book, awards, tryouts, season history…)? For each: kept and hidden, copied back, or frozen. **This is the table the owner needs to see.** Never draw "your data comes back" until you have it |
| 5 | The only existing "back" is the **cancel path**, which archives hosted tournaments and tags records for retention: wrong for a trial. Staff cancel updates only the org row, not the workspace or entitlement | The cancel route(s). Say what a trial's end must **not** do that cancel does |
| 6 | Nothing runs at an end date; nothing enforces `ends_at` / `current_period_end` | Every reader of those two fields. A **read-time flip** (first visit after the date) is the shape that needs no new automation. A scheduled job is a shared-automation change and needs the owner's word |
| 7 | The first trial uses the existing copy; a **second** trial or a later real upgrade must reuse the same workspace (the claim guard prevents a second copy; one live portal per owner) | What happens on trial two, on trial then paid upgrade, on trial then Founding comp. Draw the money-adjacent cases first |
| 8 | A coach with a **real Stripe subscription** or a Founding comp must not be given a trial that overwrites it | The billing modes on `team_workspaces` (`team_direct`, a club paying, `platform_override`). Say what is allowed, what is refused, and what the coach's billing page then shows |
| 9 | Who the Basic coaches are and how many | Dev has few; **do not guess prod**. State the number you can and cannot know. The owner thinks the use is small and personal ("I'll convert you for 60 days"), so draw a **small** surface |
| 10 | The coach's own screens can show "Premium free until {date}" | The coach's billing/account page(s), what they show today for a comped or Founding coach, and where Stage 4's `FreeTimeBand` / `free-time-copy` could be reused |

## 5 · The drawings (blocking: no code in this session at all)

Published as one Artifact from `PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE4B_DRAWINGS.html`, linked from the index's
`stages/s4b`. True size, 1440 wide, Warm and Dark. Whole-screen before → after. Every highlight clickable with its
reason. **Draw a screen FROM its capture, part by part** (Stage 4's lesson: a customer page drawn from memory invented a
chip and a tab). **List what is KEPT as well as what changes.** Keep **one example coach** across every drawing (name,
team, dates), and recount any figure at the moment each frame is drawn.

- **A · Give free time on a portal.** The window on the coach's portal record: length (ask 2), why, the one-sentence
  confirmation with the **plain consequence** ("Alex gets the Premium Coaches Portal until Jan 12, 2027, then returns to
  the free one, and keeps everything"). What shows for a portal already Premium, already given time, billed by a club,
  or on a Founding comp.
- **B · The portal record with free time running.** Chips and band, the list of what is running and when it ends, the
  Story rows (given · ended by itself · put back · extended), and Put it back on the right rows only.
- **C · What "back" does.** **The central drawing.** From the §4 row 4 table: the coach's view on the last day, the day
  after, and a month later, for **each kind of work done on Premium**. Show the coach's data safe, and say plainly what is
  frozen, hidden or copied back. If the honest answer is "frozen, and it returns if they upgrade," draw that.
- **D · The coach's view.** The coach's own billing/account line while it runs ("Premium free until {date}"), the notice
  before it ends if any (ask 7), and the first visit after it ends. Phone and desktop, Warm and Dark. **Copy goes through
  `/billing` and `/marketing`; nothing restates a price or gate.**
- **E · Today.** Where a portal's ending sits in the existing free-time queue (one queue, not two) and its menu count.
- **F · When it cannot work.** A portal with a live subscription; a Founding comp; a second trial; a copy that fails
  halfway (what the coach sees, what support sees, what is retried); the switch off; a role that may not give it.
- **G · The boundary.** One page marking every part NEW / RESTYLED / UNCHANGED / LATER. Example data labelled "example".
- Run **`/design`** on the drawings before the hand-off, apply its fixes, and list any written-rule conflict for the owner.
- **Converting an account's plan is a money-adjacent, data-adjacent write: draw and review it as one.** State who may do
  it, the longest period, what is logged, and what stops one staff member giving themselves or a friend free Premium.
  Run **`/review`**'s security lens over the *design* (a written threat list), not code. Include **data loss** and
  **double copy** as threats beside the usual ones.

## 6 · Asks for the owner (one recommendation each, beside the drawing it decides)

Draft these, reword to the drawings: **do not decide for the owner.**
1. **What "back" does with Premium-era work:** keep it, frozen and returning on upgrade (recommend if §4 row 4 shows
   Premium work has no Basic home), copy it back where a home exists, or refuse to let a trial coach create what cannot
   come back.
2. **Lengths:** fixed 30 / 60 / 90, or any date up to a cap? **Cap:** is there a longest period, and does more need a
   Super admin? (Stage 4's club cap is the starting point; say what it is and whether a portal differs.)
3. **Who may give it:** the roles, as Stage 4 did for clubs (`PLATFORM_POWERS` is the one rulebook).
4. **A portal that already pays, or is on a Founding comp:** refuse, or allow and say what the coach sees.
5. **Extend:** a new grant or a change to the running one; how the Story says so; how many extensions.
6. **Founding Season, drawn beside:** both stages change the portal's own billing record and the coach Founding audience
   (existing comps run to 9-30-27). Do them as one build, or sequence them? (Do not decide Founding here; ask only how
   the two sit together.)
7. **What the coach is told:** a line on their billing page only, or an email before it ends and after. **An email is a
   customer-facing send and needs its own ruling.** Remember the coach was claimed, not signed up.
8. **Q10 revisited:** confirm that "no portal grants" (Stage 4) is replaced by this stage's rules.
9. **Still open from earlier stages, ask again where it bears:** the double-grant race (Stage 4 finish review), the bulk
   status override with no cap.

## 7 · Hand-off

- Restate the **PM summary in five lines** (`AGENCY_RULES`): what support sees and does, what the coach sees, what is
  deliberately left for Founding and later stages, Warm/Dark, roles.
- Update the index (`stages/s4b` state + anchor + a `log/` row), the plan's S4b row and Status, TODO, the PM brief, and
  the auto-memory file `project_platform_admin_support_console.md`. A ruling is recorded exactly as ruled; add nothing it
  did not rule.
- When the owner has ruled: write `PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE4B_BUILD_PROMPT.md`, in Stage 4's shape (verified
  state, scope is / is not, parts, guards, verify, hand-off, do not). If the build needs a migration or a scheduled job,
  say so then; this session writes none. A migration joins 365/367/373/380/389/398/402/404/405 at the release.

## 8 · Do not

- Write or change code, schema, `proxy.ts`, hooks, env settings or any watched script.
- Redraw what Stages 1 to 7 ruled (the shell, Find, the menu, Today's frame, the Story, the one pencil, Stage 4's Give
  free time window for clubs).
- Draw Founding Season's turn-off, Stripe reads, refunds, Status or the sent-email log as if they exist.
- Restate or change a price, plan name or gate (`/strategy` decides; `PLAN_PRICING_FACTS.md` is the record).
- Propose a scheduled job or cron without flagging it as a shared-automation change that needs the owner's word.
- Send any email or touch a real coach's record: probes are read-only, non-GET aborted, and never overwrite
  `tests/uat/.auth/platform-admin.json`.
- Decide an ask for the owner, or tick a box for them.
