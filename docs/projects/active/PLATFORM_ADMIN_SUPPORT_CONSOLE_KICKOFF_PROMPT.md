# Platform admin, reorganized for the support team's jobs: kickoff (a measured walk, a ladder, and the end state drawn)

> Paste into a fresh session on `dev`. Written 2026-10-24. The owner queued this project on 2026-10-10 "after Club
> Tier", then on 2026-10-24 said: *"don't take my after club tier too literally, I am fine running them in parallel,
> they are different areas of the application completely."* **It runs now, in parallel with Club Tier.**
>
> **This session walks, measures, draws and asks. It does not build.** The build prompt is written only after the
> owner rules. Follow the deep-dive pattern (memory `feedback_deep_dive_is_walk_then_stages`): a measured walk, a
> stage ladder, and the END STATE drawn in the SAME first publish, each changed part tagged with the stage that
> delivers it. Never draw an intermediate state that looks like today, and never put a QA walk of old work in front
> of the design walk.

## 1 · The ask (owner, verbatim)

2026-10-10: *"reformat and reorganize platform admin to be more user friendly to the different business use cases and
user types that exist on the support team (i.e. troubleshooting technical issues, marketing resources,
plan/subscription modifications, user/org subscription observability and editability, etc.). part of the project
should making the design more of a warm theme like the rest of the app and then go section by section analyzing the
design/ux so I can do a serious review and testing to ensure they fit my needs."*

2026-10-24, on this prompt: *"I am happy with the walkthroughs by support role but I also want you to consider some
specific actions a user intends to take and evaluate the path it takes to get there, does it make sense? is it
intuitive? etc. for instance, we need to investigate a user who got double billed, we need to activate a user without
charging them for a period of time, we need to see the status of our dev servers and api error handling, we are also
adding this company accounting section in there so make a later phase handle investigating the usability of that
(after the work is complete). also consider the formatting, I have liked the formatting changes we have made on our
client portals and want the platform admin to follow a similar path so keep that in mind as well."*

**This session therefore runs TWO walks over the same screens, and both go in the first publish:**
- **Walk A, by support role:** what each role (§2) sees, can open and can change, and whether that fits the job the
  role exists for.
- **Walk B, by intent:** a person arrives with a specific task. Follow the path click by click and judge whether it
  makes sense and is intuitive (§4).

Plan of record: `PLATFORM_ADMIN_SUPPORT_CONSOLE_PLAN.md` + `_PM_BRIEF.md`. Update both as you go. The plan's "what
exists" was read on 2026-10-10. **Re-verify every claim against the code. The plan is a lead, not evidence, and so is
this prompt.**

## 2 · Facts to start from (checked 2026-10-24; re-verify)

- **36 page routes under the platform admin, counting sign-in.** The menu groups them by what the system holds
  (overview, orgs, users, plans, billing, email, help, engineering, marketing), not by the task being done.
- **Six support roles already exist in the code:** super admin, support, billing, product, growth, read-only. Each
  area has its own view and write rules. The plan's kickoff question 1 ("don't build staff roles until a second person
  exists") assumed none existed, which is wrong. Walk A tests whether those six fit the jobs.
- **It is the last working surface in the old dark look.** Check what the layout already borrows from the warm portal
  before you claim "none of it".
- **Timed grants are not built, as far as the TODO says.** "Timed Entitlement Grants (Comps & Trials)" (auto-revert at
  expiry) and "Plan / Tier Trial" are open TODO lines. The org screen has plan and override controls. Verify what they
  do. Today's path for "activate without charging for a period" probably ends in a manual change that nobody has to
  remember to undo. If so, that is the walk's finding, and it is the strongest case for pulling timed grants inside
  this project.
- **Company accounting is in scope for a LATER phase only.** The owner's private bookkeeping lives inside the platform
  admin but is its own project (`BOOKKEEPING_OWNER_EXPERIENCE_PLAN.md`), with its own access rule and its own build
  under way. This session decides only where its door sits in the reorganized menu. Its usability review is a stage at
  the END of the ladder (§5), run after that project's work is complete. Another session added its menu door on
  2026-10-24, uncommitted when this was written. Take the menu from the current file, not from this prompt.
- **The Club release adds new support jobs.** Draw the console for the jobs it will have when the Club plan goes on
  sale, not just today's: setting up a club and its plan, a club's own web address (the status check, its owner emails
  and the domain quota), Founding Season accounts and comped portals, sponsor and payment work. Read
  `CLUB_TIER_PRODUCTION_READINESS_PLAN.md` for this (delegate it, the file is 3,000+ lines).
- **Open work to fold in, not duplicate:** `PROGRAM_PLATFORM_ADMIN_CONSOLE.md` (the earlier operator walkthroughs:
  about 25 issues by persona, a long unverified tail, several areas never walked), `PLATFORM_ADMIN_ACTION_ENFORCEMENT_PLAN.md`
  and its audit findings, and the TODO lines for timed grants, the Stripe price guard (H8), plan limits shown vs
  enforced, and observability and in-app feedback. For each one, propose in or out.
- **Sign-in is checked in the request proxy.** Any change to who can open what is a security change. Draw it, never
  slip it in.

## 3 · Parallel-work safety (Club Tier sessions share this working copy)

- Stay inside the platform admin. If the warm move needs an admin-kit change, **name it in the ladder as a shared
  change**. A kit edit restyles club screens other sessions are building and walking.
- Stage explicit paths only, check the branch before every commit, and run `git show --stat HEAD` after it (see
  `AGENCY_RULES.md`). This session should commit nothing but its own docs.
- The dev server is shared. Capture only the platform-admin screens you walk. No whole-product layout sweep.
- **A live status view is not automatic.** If Walk B's server-status task leads you to propose anything that runs on
  a schedule or by itself against production, that is shared automation (`AGENCY_RULES.md`, the 2026-09-26 rulings).
  Draw it and ask; never wire it. A page that reads when the owner opens it is fine to propose.

## 4 · Walk B: the task paths

Each task is one station. For each, record:
- **The intent** in the owner's words: who arrives, what they know when they arrive (an email, a name, a card's last
  four digits, an org name, an error message), and what "done" looks like.
- **The path as built:** every screen and click from the platform admin's front door to "done", with captures. Count
  the screens, clicks and dead ends, and every time the person must already know where to go, copy an ID, leave for
  Stripe, Supabase or the AWS console, or keep something in their head across screens.
- **The verdict:** does it make sense, is it intuitive, where does a first-time support person get lost, and can it
  go wrong (a change with no confirmation, no reason recorded, no undo, a write a read-only role can still reach)?
- **The proposed path:** drawn at true size, with the click count before → after.

**The owner's three tasks (required):**
1. **Investigate a double billing.** A customer emails: "I was charged twice." Find the customer from what they
   gave you, see every charge and subscription event side by side with what our side recorded, tell a real duplicate
   from two legitimate charges (a plan change, a renewal plus a pro-rated charge, two orgs on one card), decide, act
   (a refund, a credit, a note), and leave a record of what was done and why. Note where today's path makes you leave
   for Stripe.
2. **Activate a user without charging them, for a period of time.** A club gets a free month, or a coach gets a comp
   season. Grant it, see when it ends, see it end by itself, and see it in the customer's record later, with who
   granted it and why. Evaluate this against Founding Season, which already gives free time. One idea of "free for a
   while" or two?
3. **Check the status of our servers and how the API is handling errors.** Ask in the kickoff questions what the owner
   means by "dev servers" (the deployed environments and their builds, the databases, or the local dev machine) and
   propose a recommendation. Then walk: is everything up, are recent builds green, are API errors rising, which route
   is failing, and what happened to the person who hit it. Today some of this lives in the platform admin's
   observability screens and some outside it (the morning stack-health check, the hosting and database consoles).
   Count how many places the owner looks.

**Add the tasks the walk turns up,** at least: finding a person from an email when you don't know their org; an
organization's whole subscription story on one screen; changing a plan mid-season; a customer who can't sign in; a
club whose own web address stopped working; answering an in-app feedback message; finding a marketing resource to send
a prospect. Mark each one owner-named or added.

## 5 · Formatting: follow the client portals' path

The owner likes the formatting on the client portals and wants the platform admin to follow the same path. The club
admin already took it (Admin Design Continuity, closed 2026-09-30): it moved onto the admin kit and the one Warm / Dark
setting, with the Premium Coaches Portal as the benchmark. **The platform admin takes the same path. It does not get
its own look.** Memory `feedback_portal_is_the_formatting_benchmark`:

- **Read the written rules before drawing, not an older hub's CSS:** `docs/agents/design/TABLE_AND_LIST_STANDARD.md`
  + `TABLE_EXCEPTION_REGISTER.md`, the coach kit and admin kit styles, the portal's page header and section rules,
  and the type ladder. The 2026-05 design principle memory files are obsolete.
- **The owner's standing rulings apply here as everywhere:** the page frame at the portal's two widths (960 reading,
  1200 tables), centred; the name is the link, plus one chevron column, and no links or buttons inside cells; a list
  is a table when a column answers the question; one toolbar (scope · Search · Filter · Tools ⋯); a record reads first
  and edits whole; edit autosaves, create asks; money figures sit in one joined band; a waiting count is the amber
  pill; Export is one button; every highlight opens its explanation on click; one loading line; a window's foot puts
  the sentence left and the buttons right; the close × is a plain glyph; a disabled button fades; a rare door ends
  the body; one lime per screen; times read "8:00 a.m."; one spelling everywhere.
- **What may differ, and must be said:** a support console reads dense data (event logs, charge histories, error
  traces) that no client screen has. Where a platform screen needs to break a rule, propose it as an entry in the
  exception register with its reason. Never break a rule silently.
- **Draw a "formatting check" screen** in the publish: each rule, how today's platform admin breaks it (with a
  capture), and the drawn fix.

## 6 · What you publish (ONE first publish)

A project hub as an INDEX (template `docs/agents/design/PROJECT_HUB_TEMPLATE.html`, memory
`feedback_project_hub_single_artifact`), linking these as their own artifacts:

1. **Walk A, by support role:** each role's view of the console, what it can change, and the fit.
2. **Walk B, by task (§4):** the owner's three tasks first, then the added ones. Re-check the program doc's open
   issues against today's code and mark each fixed, still open or moot.
3. **Standing back:** the rules that cut across both walks (confirmations before a live change, a reason in the
   audit log, undo, how a role sees a section it may only read, one place to find a customer).
4. **The stage ladder:** Stage 1 the warm foundation (§5), then one stage per section, ordered by the job the owner
   does most or the one that hurts most (ask which). **The LAST stage is the company accounting usability review,**
   run with the same two walks once the bookkeeping project's work is complete (its own trigger, not a date). Its
   tasks, to confirm then: record a purchase, find a receipt, correct an entry, see spending for a period, hand the
   accountant a package.
5. **The END STATE drawn at true size,** desktop first: the reorganized menu and the proposed path for each task,
   before = capture, after = drawn, each change tagged with its stage. Plus the formatting check screen (§5). Run
   `/design` on the drawings before the hand-off.
6. **The kickoff questions** beside the drawings they decide, each with a recommendation:
   1. Who does support today and in the next year, and do today's six roles fit those people? Should the menu follow
      the task, the role, or both?
   2. Editing live customer data: what needs a confirmation, what needs a reason in the audit log, what should be
      undoable?
   3. Which job goes first: the one done most, or the one that hurts most?
   4. Is any support job done from a phone? If not, say so and draw desktop only.
   5. Which open lines from §2 land inside this project (timed grants above all, given task 2)?
   6. What does "the status of our dev servers" mean, and should the platform admin show the morning stack-health
      result rather than send the owner to another window?
   7. A refund or credit for a double billing: done from the platform admin, or a deliberate hand-off to Stripe with
      a recorded note?
7. A paste-back summary.

Then stop. The owner reads it against the product and rules. The build prompt for Stage 1 comes after.

## 7 · Records to keep current

The plan's Status line and stage ladder, the PM brief, the TODO line, the in-repo `memory/` only if you write there
(with its index), and the Claude auto-memory file `project_queued_free_tier_and_platform_admin.md` (rename it if the
project gets its own file).
