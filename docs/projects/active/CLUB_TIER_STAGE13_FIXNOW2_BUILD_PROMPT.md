# Club Tier Stage 13 · Fix now 2: a promise made true, a way back, a step that ticks honestly (build prompt)

> Written 2026-11-07, after the external IA review was cross-checked
> ([CLUB_TIER_STAGE13_NAVIGATION_JOURNEYS_PLAN.md](CLUB_TIER_STAGE13_NAVIGATION_JOURNEYS_PLAN.md) §11; the review itself is
> `CLUB_TIER_PRODUCT_IA_REVIEW.md`). Items are F-XR-1 to F-XR-4 in §11.1.
> **No drawing session.** Nothing here changes a screen's shape: each item makes a sentence true or puts back a missing door.
> **One session.** Recommended model: Opus, because item 2 decides a door from a person's role. Work on branch `dev` and
> stage explicit pathspecs only.
> **Facts.** Mark each fact you rely on [V] (opened this session, file:line) or [H] (handed over). Everything below is
> [H 2026-11-07]: helpers read the code, and the parent re-opened the lines each item turns on. Line numbers drift; re-open
> before editing.

## Owner rulings this build carries

- **F-XR-1 (owner, 2026-11-07, as recommended):** keep the club's Families page as it is. Rewrite the coach-facing promise so
  it says what the club actually sees. Do not hide rep dues on Families.
  - D1 (2026-11-06) still holds for the team's *books*: one cash figure, no budget, no other spending.
- **`/legal` reviewed the words, 2026-11-07** (`docs/agents/legal/IN_CLUB_VISIBILITY_PROMISES.md`). Approved, with one
  correction already applied below: "never sees your **other** spending". The club does see what the team pays the payees
  it shares, so "never sees your spending" would be false.
- **Not this build:**
  - 13c, 13b, 13d, 13e, and 13i's admin sidebar.
  - Rep dues online (Stage 12 → 12e).
  - The owner questions F-XR-8 and F-XR-9.

## Before any code: the plain-language summary (required, blocking)

Present a product-manager summary in the conversation first. For each item: what the person sees differently; who sees it
(owner / admin / league admin / registrar / treasurer / coach); and what doesn't change.

Item 3's choice is a recommendation, not yet ruled. Put it to the owner in that summary and wait for the answer before
building item 3.

## The four

### 1 · The coach is told the truth about what the club sees (F-XR-1, High)

**Today.** The coach reads "{Club} sees what you owe it, your requests, your cash on hand, and what you pay the payees it
shares. Never your families' payments or the rest of your books." (`lib/club-money-words.ts` ~609-610,
`coachWhatTheClubReads`, shown at the foot of Money › Club).

The club's Families page shows, for each child on a club-owned rep team:
- the season's dues, paid and balance (`lib/child-page.ts` ~158-166; `lib/child-page-words.ts:63`);
- when a dues reminder last reached the family ("Chased").

The Families export adds credits and amounts handed back (`lib/families-export.ts` ~110-118).

The same false clause sits in four more places:
- the club's team page, "What the club sees" (`WHAT_THE_CLUB_SEES_3B.cash`, `lib/club-money-words.ts:604`);
- the rep-teams help (`lib/help-content/rep-teams.tsx` ~21);
- the coach help article (`lib/help-content/coaches.tsx` ~2554);
- the coach help's `searchText` (`lib/help-content/coaches.tsx` ~2101).

**Fix, using the words below exactly:**
- **Coach line.** "{Club} sees what you owe it, your requests, your cash on hand and what you pay the payees it shares. On
  its Families page it also sees each family's dues: what's owed, credited, paid and handed back, and when a reminder last
  reached them. It never sees your other spending or the rest of your books."
- **Club team page, cash line.** "The team's cash on hand (one figure; never its other spending or the rest of its books)".
- **Club team page, new row** in "The coach's, and you can read it": "What each family owes and has paid (on Families)".
  - Don't use the word "payments" here. The club sees totals, not individual payment entries.
- **Help on both sides.** Say the same thing, and move the search words with the prose.
- **Families help.** Add one sentence telling the club that the team's coaches are told the club sees these figures.

**Check before writing [V].** The coach line must appear only where that team's families really appear on that club's
Families page, which means club-owned rep teams.
- Find every team that can open Money › Club.
- If any team that is not club-owned can open it, the new sentence is false there. Stop and report; don't word around it.

**Guard.** Extend `tests/unit/club-stage3b-screens-guard.test.ts` §6. Assert:
- the coach line names Families and "other spending";
- the clause "families’ payments" no longer appears in the coach line, the cash line or either help article.

Run `npm run check:spelling`.

### 2 · Every person who reaches the club admin has a way back from the Coaches Portal (F-XR-2, High)

**Today.** The portal's Admin door appears only for an owner or admin:
- the sidebar's `isOrgAdmin` (`components/coaches/CoachesSidebar.tsx:187`, door at ~467);
- the phone bar and the More sheet (`components/coaches/CoachesBottomNav.tsx:152`, and its More sheet ~460).

A treasurer, league admin or registrar who also coaches gets no door. The workspace switcher would offer a way out, but it
only renders with two or more places (`components/shared/WorkspacesPill.tsx:55`, threshold 2 in `lib/use-role-summary.ts:39`).
So a one-club treasurer-coach has **no** way back without typing the address.

Going the other way, the admin rail does offer them the "Coaches Portal" door (`components/admin/kit/AdminKitRail.tsx` ~179).
The trip is one-way.

**Fix:**
- Show the Admin door to anyone the club admin itself admits. Decide that from the **same rule** that admits a person to
  `/admin`, found [V]. Do not write a new role list beside it.
- Cover all three surfaces: the desktop sidebar, the phone bar, and the phone More sheet. The sheet was nearly missed once.
  See the CLAUDE.md season-gate note on navs.
- The door lands on that person's own admin landing, not the owner's.
- A team-workspace org (`isTeamWorkspaceOrg`) stays as it is.

**Guard.** A unit test. For each role (owner, admin, league admin, registrar, treasurer, coach-only), assert the door's
condition matches the admin's own admission rule, on all three surfaces. Read the source as text if the components can't be
rendered.

**Watch.**
- The roles are `owner | admin | staff | official | league_admin | league_registrar | treasurer | coach` (`lib/types.ts:16`).
  Settle `staff` and `official` (tournament roles) by the same admission rule. Don't special-case them.
- A member limited to some teams: confirm [V] what the admin admits them to, and give them the door only if it admits them.

### 3 · Setup step 4 ticks only when it's done (F-XR-3, Low; choice owed in the summary)

**Today.** The step reads "Add a tagline and a contact email" (`components/admin/kit/club/ClubSetupKit.tsx:46`), but ticks on
the tagline alone. The query reads only `tagline` (`lib/club-checklist.ts:23, :72, :103, :130`).

**Recommended: the tick needs both.**
- The step asks for both.
- A club's public contact email is where families reach it.
- `/legal`'s open flag on the "Stop these emails" page says its "reply to the club" fallback reaches nobody when a club has no
  public contact email (`docs/agents/legal/CASL_SECOND_PARENT_EMAIL.md`).

**Alternative:** the step asks only for the tagline. Ask the owner which one in the summary.

**Fix (if recommended).**
- Find where the club's public contact email is stored [V].
- Tick on tagline AND contact email, and say which one is missing on the step.
- The Overview's "Setup: n of 5" reads the same checklist, so it follows. Confirm [V].
- An existing club whose step ticked on the tagline alone will un-tick. Say that in the hand-off. It is the honest state, not
  a regression.

**Guard.** Extend the club checklist's existing test (find it [V]; `tests/unit/club-stage1-screens-guard.test.ts` is the likely
home) with the two-field case.

### 4 · One line for a person who coaches in both programs (F-XR-4, Low)

**Today.** A house league coach gets the season's team page (9c·1, ruled). A rep coach gets the Coaches Portal. Nothing tells
someone who does both why the two differ.

**Fix.**
- First establish [V] whether the house league coach's team page knows who is reading it (signed in, or a link).
- If it knows, and the reader also has a Coaches Portal team: one quiet line there, "Your rep team is in the Coaches Portal",
  with the door.
- If it doesn't know: the line goes into both help articles only (house league's coach section and the Coaches Portal's
  start), with search words.
- Never a new nav entry.

**Guard.**
- If it's on the page: a source assertion.
- If it's help only: the help tests.

## After the build

- **Reviews:** `/simplify` (only if item 2 grows a new shared helper), then `/review`.
- **Help:** `/docs` covers items 1 and 4's help words. Item 1's help is part of the build, so `/docs` checks it.
- **Walk:** one walk, one purpose, as an Owner QA Ledger row and a checkable Artifact.
  - A coach reads the new line.
  - The club owner reads the team page.
  - A treasurer who coaches goes portal → admin on a desk and on a phone (sidebar, bar, More sheet).
  - A fresh club's step 4 ticks only with both fields.
- **Records:**
  - Mark F-XR-1 to F-XR-4 built in the Stage 13 plan §11.1, with a status-log entry.
  - The PM brief's "An outside review" paragraph gets one line.
- **Restart:** the dev server needs a restart before hand-off only if a new file or shared module was added (AGENTS.md).
