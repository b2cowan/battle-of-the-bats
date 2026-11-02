# Signed-in family accounts · Stage 2, Tournament registration tidy-up: draw it (prompt)

> **Written 2026-11-01**, the day Stage 1 closed (Session 1 `d79603110`, Session 2 `0e8294ddf`, walk §437 passed 17/17).
> **Paste `execute @docs/projects/active/SIGNED_IN_FAMILY_STAGE2_DRAWING_PROMPT.md` into a new chat on `dev`.** Other sessions
> share this working copy (billing, house league, public tournament pages): stage explicit paths only, commit only your own
> hunks, and only when the owner says.
>
> **This is a drawing session, not a build.** No product code, migration, seed, help article or demo change.
>
> **How to draw (owner ruling 2026-10-26, binding):** one published HTML-page Artifact with tabs and a written explanation beside
> every frame, published by `file_path` (source `docs/projects/active/SIGNED_IN_FAMILY_STAGE2_DRAWINGS.html`). **Never** the design
> canvas / the `design` quickstart / a Design artifact type, and never open an empty artifact "to fill later". Load
> `artifact-design` first. House layout (memory "Mockups → Claude Artifacts"): sticky tabs, minimal scroll, an Everything /
> Show-only-what-differs toggle, whole-screen before/after, frames at TRUE SIZE, a desk and a phone for each. Draw every control
> from its SHIPPED component. Run `/design` on the drawings before handing them over. Emails are drawn in the warm email card the
> product sends today, not a generic one.

## What Stage 2 is, and what is ruled

Plan of record: `SIGNED_IN_FAMILY_ACCOUNTS_PLAN.md`, **Stage 2** (~line 83). Read it, the "rule this plan builds" table at the top,
and the tournament-coach journey on the journeys page (source `SIGNED_IN_FAMILY_JOURNEYS.html`, the "Tournament coach" table,
~lines 310–345: rows 2b, 3 and 4 have an "End state" cell — that is the target this stage draws).

**Ruled, do not reopen** (BUSINESS_DECISIONS 2026-10-31 "A family gets an account when their child is PLACED ON A TEAM…"; record
each as ruled and add nothing it did not rule):
- A tournament coach **keeps their account at registration**, unchanged. Stage 2 tidies the doors around it; it never moves the
  account moment.
- Tournaments stay public (`BUSINESS_DECISIONS.md` ~line 150): parents and fans never need an account.
- **A tournament team's pay link STAYS** as a sent link (the plan's "Sent links that stay").
- No other link is ever sent to a family. (A coach is not a family, but do not add a new sent link for coaches either without
  asking.)

**The plan's five items** (from the 2026-10-31 trace, **not a fresh read — the plan itself says re-verify 1–3 before drawing**):
1. **One email, not two**, for a new coach whose registration also makes their account. Today (per the trace): "Registration
   Received" (saying the portal "is ready") plus a separate "Confirm your email"; and "Your free FieldLogicHQ Coaches Portal
   account is ready" (`lib/email.ts` ~333). Journeys end state: one email, "We've got your registration", with the confirm button
   inside it.
2. **An honest finish screen** (`components/public/RegisterContent.tsx`, the "Create a Password" step): it no longer offers a
   "Create Coaches Portal Account" button for the password they just set. Journeys end state: "Confirm your email to open your
   portal".
3. **No email address inside portal links** (the registration email's portal link carries the coach's address in the web address).
4. **A throttle on the tournament registration form** (`app/api/register/route.ts` ~221; census N3: no throttle, no captcha),
   reusing `lib/public-form-throttle.ts`. Draw only what a refused coach reads (match the family forms' "Too many attempts" words
   if they fit; one spelling).
5. **Delete the dormant tournament-team claim link** (census N4: `app/coaches/claim/[token]/page.tsx`, the dev seed route
   `app/api/dev/seed/team-claim/route.ts`, its token code). Nothing to draw; say in the drawing page that it goes, and find out
   (from the snapshots / live `information_schema`, never migration files) whether its table or column needs a migration.

## Before drawing: verify against the code (delegate the reading; open the cited lines yourself before relying on them)

Send helpers out in parallel (CLAUDE.md "broad reading goes to a helper"), asking each for paths with line numbers and a verdict:
- **Every email a tournament registration sends, by case**: new coach (account made here), a coach who already has an account
  (signed in, "Which team?"), a manager registering an existing portal team (the Coach Register Existing Team project changed this
  flow: read `COACH_REGISTER_EXISTING_TEAM_PLAN.md` §9 and §13 "as built"), invite-only events, the waitlist. Which emails fire,
  in what order, with which subject, which links, and which of those links carry the email address.
- **Every finish screen** of `RegisterContent.tsx` for the same cases, and what its buttons do.
- **The confirm-email path**: what Supabase sends, what the coach lands on, what happens if they never confirm (can they sign
  in? does the registration stand?). The drawing must not promise "confirm to open your portal" if the portal opens without it.
- **The organizer side**: does anything the organizer sees (the registration row, the admin emails) change with items 1–3? Draw
  it only if so.
- **Overlap with the public tournament pages project** (`PUBLIC_TOURNAMENT_SITE_REVIEW_PLAN.md`): its stages redraw the public
  site, including the Register card ("free Coaches Portal" line, Stage 2 Part 3) and the team pay page (Stage 7, in flight).
  Does any planned stage redraw the registration form or its finish screen? If so, draw this stage's frames on that project's
  approved look and say which stage owns the shared screen; never two drawings of one screen.
- **Help + demo exposure**: which help articles and tour stops describe the two emails or the finish screen (list them for the
  build's `/docs` step; change nothing now).

## Owner asks to frame (each with a recommendation and its reason; options lettered)

At minimum, check whether each of these is real once the code is read, and drop any the code settles:
- **The one email's words and order**: what leads (the registration or the portal), where the confirm button sits, what a
  returning coach (already has an account) gets instead.
- **Item 3**: what replaces the address in the link (the sign-in page that asks for it, or the address pre-filled from a signed
  token, or nothing).
- **The finish screen** for the new coach vs. the returning coach vs. invite-only.
- **⚠ Not in the plan's list, raise it, do not draw it as decided:** the journeys page's end state for row 4 says the team pay link
  "ends when the tournament ends and the organizer can send a new one, the same as the families' link", and "the coach can also
  pay from the portal". The plan's Stage 2 does not include it, and the public tournament project's Stage 7 is rebuilding the team
  pay page now. Ask the owner whether it belongs to this stage, to Stage 7, or to neither. Recommend from the code and the rework
  risk.

## Hand-off

1. Publish the drawings; run `/design` and apply its round; republish.
2. Update the plan's Stage 2 with a "Drawn 2026-11-xx" note (the page link, the source file, the asks as OPEN) and the TODO line
   (Signed-in family accounts) in one clause. Record any item that turned out wrong against the code as a correction in the plan,
   with the evidence.
3. Update the auto-memory note `project_end_state_signed_in_family_app.md` and its MEMORY.md line.
4. Tell the owner in product-owner words: what each frame shows, the asks with recommendations, and anything the code
   contradicted in the plan. Do not commit unless asked.

After the owner rules the asks, the next session writes `SIGNED_IN_FAMILY_STAGE2_BUILD_PROMPT.md` (as Stage 1 did).
