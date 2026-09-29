# Tournament admin redesign · the defects pass (A8) — nine live defects, fixed now

> Paste into a fresh session on `dev`. **Run this BEFORE the Stage 1 build**
> (`TOURNAMENT_ADMIN_REDESIGN_STAGE1_BUILD_PROMPT.md`): both touch the dashboard, and this pass is small.
> Written 2026-09-29, the day the owner ruled A8 "fix them now as one small pass" (with every other ask,
> "I agree with your recommendations").
>
> **The record:** plan `TOURNAMENT_ADMIN_REDESIGN_PLAN.md` §3 (F04, F08, F16, F26, F32, F34) and §5's row
> "D · Defects now"; hub https://claude.ai/artifact/HQoRuEsKd7i6cAvCrMNzgM (The walk, stations 9–13, and the
> Decisions tab). The June findings are in `docs/projects/archive/journeys/JOURNEY_J1_TOURNAMENT_ORGANIZER.md`.
>
> **Read first:** memory `project_tournament_admin_redesign`, `feedback_portal_is_the_formatting_benchmark`,
> `project_admin_design_continuity` (Part B, and the admin scrolls INSIDE `main.adminMain`),
> `reference_code_gotchas_index` (dates through `formatStoredDate`/`formatTime` only).

## What this is, and what it is not

Nine small defects the walk found on live tournament screens. Each is either **false words** (a sentence
that promises something the product doesn't do), **a control you cannot reach**, or **a wrong answer**. None
is a redesign. Where a screen will later be redesigned (Teams in Stage 2, Summary in Stage 4), fix only the
defect: the smallest change that makes the screen honest and reachable. **Don't restyle, don't rearrange,
don't add features.**

## Preconditions

1. **The dev server works.** On 2026-09-29 it was 500 on every route from another session's in-progress
   code (Club Tier Stage 2: a dynamic import in `lib/team-workspace-entitlements.ts` pulling `next/headers`
   into the client bundle, plus a deleted route file Tailwind still stats). **Don't fix another session's
   code**; tell the owner and wait. Start the server only with `npm run dev`, with network access
   (`AGENTS.md`).
2. **Ask the owner whether another session is measuring** before any probe or auth-setup run. Run one browser
   tester at a time, and scope any sweep with `--only=`.
3. **The UX summary for the owner comes first** (AGENCY_RULES). Keep it short: per defect, what the organizer
   sees differently.
4. **Words go to `/marketing`.** Four of the nine are sentences a customer reads (F32, J1-075, "0 champions",
   F08's line). You decide where a sentence goes and when it shows; `/marketing` writes it. Run `/marketing`
   once with all four and build to its answer.

## The nine

Re-read each cited line first; they may have moved since the walk.

1. **F32 · The archive confirm promises a restore that doesn't exist** (`dashboard/page.tsx` ~2791). It says
   "You can restore it later from Past Tournaments", but Past tournaments has only Seal and View; restoring
   lives on the Tournaments list's status menu, and the plan's slot limit can block it. It also never says the
   public site goes offline, which the Tournaments list's own confirm does say. Make it tell the truth about
   both, matching the Tournaments list's confirm (J1-103, J1-104).
2. **F16 · The pools view's row button is unreachable on a phone** (`teams-admin.module.css` ~1799–1850). At
   390 each slot row's badges end 52–139px past the edge and its open button 152–179px past it (182–209px at
   360), hidden by the card. The cause is two fixed-width columns (130 + 160px) with no phone rule. Add the
   phone rule so every badge and the button sit inside the card at 360 and 390 (J1-071). Teams' redesign is
   Stage 2; this is only the reach.
3. **F26 · Two Tournament Plus notices render as plain text** (`TournamentSetupWizard.tsx` ~1211,
   `dashboard/page.tsx` ~2715): their classes are defined nowhere. Draw them as the kit's callout: a white
   card with a coloured left edge, since tinted panels are retired. No price, no plan-name change and no gate
   change; the words stay as they are unless `/marketing` changes them.
4. **F08 · Results' empty state promises "no refresh needed"**, and Results does not refresh. Remove the false
   half (J1-086, J1-087). The refresh itself is Stage 1's G6, not this pass.
5. **J1-075 · Accept/Reject's confirm always says "An automated email will be sent"**, even when the email
   toggles are off or the team has no email (`registrations/page.tsx` ~1166–1169; what is actually sent is
   decided in `api/admin/teams/route.ts` ~482–499). Say it only when it's true, reading the same conditions
   the route reads.
6. **F34 · Summary's "Leader" line can name the wrong team** (J1-109). It sorts differently from the
   published standings. Take the published standings' own order, from the same function, not a second
   sort. This is a correctness defect: prove it on the fixture with a probe that compares the two.
7. **F34 · "0 champions detected".** When there are none, say nothing or say it plainly (`/marketing`); never
   show the count zero as a finding.
8. **F04 · The board's empty activity box.** An empty bordered box closes the dashboard (J1-099). When the
   feed has nothing in it, don't draw it.
9. **J1-116 · The context strip points at the page you're already on** ("Review event summary →" while on
   Summary; `AdminContextStrip.tsx`). Suppress it on its own destination. The strip belongs to the admin
   frame (the foundation's, and Club Stage 8's nav review); this is only the self-reference, so tell them in
   your summary rather than changing anything else about the strip.

## Part B (the foundation's cleanup)

Part B proves its deletions pixel for pixel against reference pictures captured on 2026-09-28 (local,
`.admin-identity/before-{warm,dark}/`). This pass changes pixels on the dashboard, Teams (pools view), the
wizard, Results' empty state, Registrations' confirm, Summary and the strip. **Don't recapture anything
yourself.** Add one line to `ADMIN_DESIGN_CONTINUITY_PLAN.md`'s Part B section naming these screens and this
commit, so Part B recaptures their reference before its proof.

## Verification

- `npm run verify:changed` (includes the spelling gate), and `npm run typecheck` because the dashboard and
  a route are touched.
- A probe per fix, run in `.probe/` and never in `test-results/`, asserting on state and never on a guessed
  delay:
  - F16's button is inside the card and tappable at 360 and 390.
  - The Summary leader equals the standings' first team.
  - The Accept/Reject confirm has no email sentence with the toggles off.
  - The archive confirm names neither Past tournaments nor a restore.
- Warm and Dark both; the admin scrolls inside `main.adminMain`.
- The demo tour-anchor guard stays green.

## Close-out

- **Commit only when the owner says.** On `dev`, in a private index, with explicit pathspecs, then
  `git show --stat HEAD`. Offer `/review` before the commit.
- **An owner walk:** a checkable Artifact on the project hub's QA tab. The hub is ONE artifact, so republish
  the same URL. Give it one purpose ("nine defects, each gone"), a numbered Owner QA Ledger §, and never sort
  the § numbers.
- **Offer `/docs`** if a help article repeats a sentence you changed (the archive and email confirms).
- **Record:** plan §5 row D as done with its commit, the TODO line, memory `project_tournament_admin_redesign`.
