# Platform admin support console · Stage 4, Free time (drawings prompt)

> Paste into a new chat on `dev`. Written 2026-10-25, the day the owner passed the Stage 2 walk (ledger §377, 60 of 60).
> **This session draws and asks. It builds nothing.** The output is a drawings Artifact, the owner's rulings on it, and
> then a Stage 4 build prompt (written last, like Stage 2's). **Re-verify every lead against the code before you draw on
> it:** this prompt is a lead, not evidence, and so is any helper's summary. The working copy is shared with Club Tier and
> Bookkeeping sessions: stage explicit paths only, check the branch before every commit, `git show --stat HEAD` after it.
> Commit nothing without the owner's OK.

## 1 · What Stage 4 makes true (the objective)

Support can give a customer **free time on a plan, with an end date, and the product takes it back by itself.** Today
the pieces are scattered: a timed override can grant a module or a subscription status (not a plan), a "comp period"
exists as a separate older mechanism, the Founding Season comp is its own desk, and none of them show the customer
"Free until". Stage 4 makes it one idea:

1. **A plan can be granted for a time.** The whole plan (Tournament Plus, League, Club…), not only a section. It ends on
   its date with **no cron and no one remembering**: the product reads "is this still in force?" every time (the
   read-time revert the overrides already use).
2. **One window to give it.** Plan · until when · why. Confirm in one sentence (R3), reason kept (R4). It lives where
   "Add an override" lives on the club record's Access tab, and is not a second place to hunt for.
3. **Founding Season becomes a group of grants**, not a parallel system: support sees who is on it, when each ends, and
   can put one back like any other.
4. **The customer sees it.** The club's own billing page says "Free until {date}" so the end of free time is never a
   surprise. This is the **one customer-facing screen** the console project touches: drawn first, `/billing` for the
   copy and the gates.
5. **The older "comp period" is retired** into this, and a **past-expiry check on the server** means an expired grant
   cannot be read as still in force anywhere (screens, API gates, emails).
6. **It joins what Stage 2 built:** the grant and its end are rows in the club's **Story**; **Put it back** is offered
   on it; **Today's "free time ending"** queue becomes real (S2 only had overrides ending).

**Not Stage 4** (later stages; do not draw them as if built):
- Stripe reads, charges, refunds, the audit-log reason column (S3);
- Status and the health line, the sent-email log (S5);
- club web addresses and quota (S6).

## 2 · Standing rulings (do not reopen)

- Plan "Owner rulings 2026-10-24" and "2026-10-25", and the standing rules **R1–R8** (a record reads first and edits
  whole · every live change confirms in one sentence · every change records who and why · undo is "Put it back", **never
  for anything that reached Stripe or an inbox** · read-only shows as a record without controls · the money truth is
  shown, never remembered · plain words, in the product's look).
- **Q5:** timed grants IN, **the whole plan**, Founding Season folded in. **Q2:** Put it back covers free time.
- **A6 (S2):** one pencil + confirm window per record; **Add an override stays a door on the Access tab.**
- **Stage 1 and Stage 2 are done and walked** (§371, §377). Shell, Find, menu by job, Today, Story, Put it back, the
  trail of records opened, the person record: all as built. Do not redraw them; draw Stage 4's parts **on** them.
- **`ENTITLEMENT_GRANTS_ENABLED=true` on production (AWS), confirmed by the owner 2026-10-25.** That clears the gate the
  plan set. Still check dev yourself, and say what happens when the switch is off (the grant must not silently do
  nothing: see §5-F).
- Warm is the default; Dark follows the account setting. Draw both. Desktop only for the console (Q4); the customer's
  "Free until" line is a customer screen and needs its phone and desktop view.

## 3 · Read first

- The plan (`PLATFORM_ADMIN_SUPPORT_CONSOLE_PLAN.md`: ladder row S4, "What exists", the S2 facts), the PM brief, and
  the index https://claude.ai/artifact/TLP8d5Zec4xVkTSYrQU8tp (news goes in as an `ArtifactData` write to `stages/s4`
  and `log/…`; never republish it).
- The end state https://claude.ai/artifact/RCpPoxNNxGDfiC4FFo4m1g: its free-time screen was drawn before Stages 1–2
  existed; **redraw it on the real shell**, do not copy it.
- The S2 drawings https://claude.ai/artifact/Ub7fXLh29SC34Zp4oqKUx1 and walk https://claude.ai/artifact/GqozHVh1Bg2FLqSKEM78Xs
  for the format the owner approved (true size, Warm and Dark, before = a capture from dev, NEW / RESTYLED / UNCHANGED /
  LATER tags, each clickable with its reason, a checkable paste-back with a recommendation beside every ask).
- What S2 left that S4 stands on: `lib/entitlement-grants.ts` (read-time revert), `lib/platform-story.ts` (Story rows +
  Put it back eligibility), `lib/club-record-changes.ts` (club writes), `PLATFORM_POWERS` in `lib/platform-areas.ts`
  (who may do what), `lib/platform-waiting.ts` (Today and menu counts).
- `docs/agents/strategy/PLAN_PRICING_FACTS.md` (plans, gating, inclusions: **never restate a price or gate; reconcile
  against it**), `BUSINESS_DECISIONS.md`, `PROGRAM_BILLING_AND_ENTITLEMENTS.md`, `docs/agents/design/` standards,
  `AGENTS.md`, `AGENCY_RULES.md` (PM UX summary before code; disagree out loud).

## 4 · Verify these leads first (the plan has been wrong before)

| Claim | Check against |
|---|---|
| Overrides revert at read time for `module_addon` and `subscription_status` only; there is no whole-plan grant | `lib/entitlement-grants.ts`: `computeEffectiveEntitlements`, `applyEntitlementGrants`, `OverrideTarget`. Which callers go through it, and **which read the org's plan some other way** (those would ignore a plan grant: list every one) |
| "Comp period" is a separate older mechanism | Every use of `comp_period` (it appears in `lib/plan-config.ts`, `lib/team-checkout.ts`, `lib/founding-season*.ts`, `lib/platform-labels.ts`, the org/league create routes, `choose-next-season`, email routes, bulk operations). What does each do, and **what would "retire it into a grant" change for each**? Mark which are read paths and which are write paths |
| Founding Season is its own desk | `lib/founding-season.ts`, `lib/founding-season-desk.ts`, the founding-season-status route. Is a Founding club's time a row you could express as a grant, or is it a flag with its own end rule? **Do not draw "folded in" until you can say how a club already on it migrates** (and note a comped coach portal is a shadow org, memory `project_founding_season_2027`) |
| A plan grant on a club that already pays | What does the product do today for a club with a live Stripe subscription whose plan is also overridden? S2's rule: Put it back for a plan is offered only with no Stripe subscription (Stripe moves the plan with no audit row). **A plan grant over a paying club is the dangerous case: say what is allowed, what is refused, and what the customer's billing page then shows** |
| Expiry is checked everywhere | Server gates, `proxy.ts` and API routes, emails, the customer billing page, the public club site, tournament seat limits. Anywhere that caches a plan (session, query, build-time) is a hole: list them |
| Today's "free time ending" queue | `lib/platform-waiting.ts`: what exists now ("overrides ending", window 30 days) and what the new queue would add. Do not invent a second queue beside the first |
| The customer billing page can show a date | Find the page and the data it reads; what it shows today for a comped or trial club |
| The Story and Put it back already cover overrides | `lib/platform-story.ts`: which rows an override writes, which the put-back route acts on. A plan grant must be a new row type, not a variation |

## 5 · The drawings (blocking: no code in this session at all)

Published as one Artifact from `PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE4_DRAWINGS.html`, linked from the index's `stages/s4`.
True size, 1440 wide, Warm and Dark. Whole-screen before → after. Every highlight clickable with its reason.

- **A · Give free time.** The window on the club record's Access tab: plan, until (the shared date field), why. The
  confirm sentence, with the **plain consequence** ("Riverdale gets League features until Mar 31, 2027, then returns to
  Tournament Plus on its own"). What shows when the plan is already higher, already granted, or the club pays.
- **B · The club record with free time running.** Chips and figure band (the non-Club band reads Members · Tournaments ·
  Overrides · Renews; where free time sits), the Access tab's list of what is running and when each ends, the Story rows
  (granted · ended by itself · put back · extended), and Put it back on the right rows only.
- **C · Founding Season as a group.** A list of who is on it, when each ends, a bulk "Put back"? (draw as a question,
  see asks), and how it sits in the menu (Customers). Include the migration of clubs already on it, stated plainly.
- **D · The customer's view.** The club's billing page: "Free until {date}", what happens on that date, and the
  moment after it ends. Phone and desktop, Warm and Dark. **Copy goes through `/billing` and `/marketing`; nothing
  here restates a price or a gate.** Include the coach's own portal if a coach-tier grant can exist.
- **E · Today.** "Free time ending" as a real queue (30-day window, same as overrides?), its menu count, and how it
  sits beside the existing "Overrides ending" so there is one queue, not two.
- **F · When it cannot work.** The switch off; a grant that fails to write; an expired grant read after the date;
  a grant someone edits twice; the staff role that may not give it (who may give free time: draw each role).
- **G · The boundary.** One page marking every part NEW / RESTYLED / UNCHANGED / LATER so the owner sees what Stage 4
  will and will not deliver. Nothing may imply S3, S5 or S6 is built. Example data labelled "example".
- Run **`/design`** on the drawings before the hand-off, apply its fixes, and list any written-rule conflict for the owner.
- **Giving a plan away is a money-adjacent write: draw and review it as one.** On the drawings page, state who may give
  it, the longest period allowed (is there a cap?), what is logged, and what stops one staff member granting free Club
  time to themselves or a friend. Run **`/review`**'s security lens over the *design* (a written threat list), not code.

## 6 · Asks for the owner (one recommendation each, beside the drawing it decides)

Draft these, reword to the drawings: **do not decide for the owner.**
1. **Who may give free time**, and is there a longest period (a cap, or "more than N months needs the super admin")?
2. **A paying club:** refuse a plan grant while a Stripe subscription is live, or allow it and say what the customer sees?
3. **Founding Season:** migrate existing clubs into grants now, or leave the desk as it is and have new grants only?
4. **"Comp period":** retire it in this stage, or keep it reading until every club on it has ended?
5. **Extend:** is "give more time" a new grant, or a change to the running one (and how does the Story say so)?
6. **Today's queue:** one "Free time ending" that includes overrides, or two?
7. **What the customer is told** when it ends (a line on the billing page only, or an email too; **an email is a
   family-facing or customer-facing send and needs its own ruling**).
8. **The switch off:** should the console refuse to show "Give free time" when the grants switch is off, or show it with a
   warning? (Prod is on; dev and any other environment may not be.)
9. **Still open from the kickoff, ask again where it bears:** the morning check on Status (Q6, S5), the rest of Q5.

## 7 · Hand-off

- Restate the **PM summary in five lines** (`AGENCY_RULES`): what support sees and does, what the customer sees, what is
  deliberately left for S3/S5/S6, Warm/Dark, roles.
- Update the index (`stages/s4` state + anchor + a `log/` row), the plan's S4 row and Status, TODO, the PM brief, and the
  auto-memory file `project_platform_admin_support_console.md`. A ruling is recorded exactly as ruled; add nothing it did
  not rule.
- When the owner has ruled: write `PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE4_BUILD_PROMPT.md`, in Stage 2's shape (verified
  state, scope is / is not, parts, guards, verify, hand-off, do not). If the build needs a migration, say so then; this
  session writes none.

## 8 · Do not

- Write or change code, schema, `proxy.ts`, hooks, env settings or any watched script.
- Redraw what Stages 1–2 ruled (the shell, Find, the menu, Today's frame, the Story, the one pencil).
- Draw Stripe reads, refunds, the audit reason column, Status or the sent-email log as if they exist.
- Restate or change a price, plan name or gate (`/strategy` decides; `PLAN_PRICING_FACTS.md` is the record).
- Send any email or touch a real customer's record: probes are read-only, non-GET aborted, and never overwrite
  `tests/uat/.auth/platform-admin.json`.
- Decide an ask for the owner, or tick a box for them.
