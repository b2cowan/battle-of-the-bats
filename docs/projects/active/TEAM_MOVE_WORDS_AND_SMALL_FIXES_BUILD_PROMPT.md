# Build prompt — The team move's words (what the coach is told at the yes) and the three small fixes from the doors walk

> Paste into a new chat as *"Read and follow docs/projects/active/TEAM_MOVE_WORDS_AND_SMALL_FIXES_BUILD_PROMPT.md"*.
> Written 2026-11-20 after Free League removal Stage 2b committed (`bd2e7fd58`), which deleted the Founding branches this
> code carried. One session, small. Rulings it carries: On-sale pages call **C1** (the team move is "its own small session
> next", walk §545, 2026-11-19), the four rulings **(a)–(d)** of 2026-11-19, and call **C5** (the three small items, "to
> /plan as small items"). Plan of record: `docs/projects/active/CLUB_ON_SALE_PAGES_PLAN.md` (S2's "Three small items" and
> "RULED 2026-11-19"). Legal drafts: `docs/agents/legal/ON_SALE_PAGES_S2_REVIEW.md` §4.

---

You are building two small pieces for FieldLogicHQ in one session: **(A)** the words around a **team move** (a coach
brings their own Coaches Portal team into a club), and **(B)** three small defects the on-sale doors walk found. Neither
changes what anyone is charged. (A) changes what a coach is **told** at the moment they say yes, and what the Terms say.

## Read first

1. `CLAUDE.md`, `AGENCY_RULES.md`, `AGENTS.md` (not the Next.js you know; read the guide in `node_modules/next/dist/docs/`
   before touching a page's `metadata`, a redirect or a route handler).
2. The plan's "RULED 2026-11-19" block and S2's "Three small items" in `CLUB_ON_SALE_PAGES_PLAN.md`; **do not re-open a
   ruled call.**
3. `docs/agents/legal/ON_SALE_PAGES_S2_REVIEW.md` §4: the two drafted texts, the Terms steps, and the open §18 question.
4. `lib/team-move-words.ts` (every sentence both screens read) and `tests/unit/team-move-words.test.ts`.

**Every code line below was true on 2026-11-20 and is a lead, not evidence.** Open each before building on it. A helper
agent does any census; you read the lines a decision turns on.

## ⚠ What is ruled, and what this session must change on purpose

The move ends the coach's own subscription at once, no refund, no proration (`lib/team-ownership-transfer.ts`
`cancelCoachSubscription`, ~:526-540, after the move commits; owner ruling 2026-09-28). **That behaviour does not change.**

The published Terms (2026-11-17 §8) promise a cancelled plan runs to the end of the paid period and, in §8's last
paragraph, a refund of the unused part when *we* end a plan for a reason that is not the customer's fault. Without a
carve-out the Terms promise the coach what the code does not give.

**The standing rule that blocks the fix is itself being replaced.** `lib/team-move-words.ts` (header, :7-11) and
`tests/unit/team-move-words.test.ts` (`NO_MONEY_BACK`, :19; assertions :73-133) forbid the words *refund, credit,
proration, money back* on every move screen and help article. That was the 2026-09-28 ruling; the 2026-11-19 ruling (a)
overrides it **for one sentence at one place**. Do not delete the rule: narrow it. The refund words are allowed only
inside the new carve-out constant(s), and still forbidden everywhere else (the club's screen, the bells, the other help
text). Update the words file's header to say which ruling superseded which.

## Part A — the team move's words

Before any code: the **plain-language UX summary** `AGENCY_RULES.md` requires, with the two draft texts below in it so
the owner can approve the wording in the same reply. The build does not start until the owner has answered.

1. **At the coach's yes (ruling a).** The coach's side is `app/[orgSlug]/coaches/link-org/page.tsx` (the request card's
   "What it costs you" block ~:257 and the confirm window ~:349-376, body `CONFIRM_BODY_COACH`). Today it says only
   `COACH_PLAN_LINE`. Add, in both the card and the confirm window (the confirm is the real yes), `/legal`'s draft:
   **"Your own plan ends today, because {club name} now covers this team. The unused part of what you paid, to {date}, is
   not refunded. You won't be charged for your own plan again."** The wording is `/legal`'s; `/marketing` may check tone
   but never change the meaning.
   - **{date} is the date the coach's plan would have run to.** Find where the period end is stored or read; do not
     invent a figure. Edge cases to decide and show in the UX summary: a coach already set to end at renewal (the date is
     that one), a coach on **free time** (no subscription; `cancelCoachSubscription` returns `not_needed`: say nothing about
     a refund, there is nothing paid), a coach with no period end on record.
   - Keep "You won't be charged for your own Coaches Portal again" (ruling c, true); the new sentence sits with it, not
     over it. One spelling of the sentence everywhere it appears.
2. **The club's screen is not changed by (a)** (`app/[orgSlug]/admin/rep-teams/bring-in/page.tsx`, `coachPlanLineForClub`).
   The ruling says "where the coach says yes". If you think the club should see it too, say so in the UX summary; do not
   add it unasked.
3. **The "everything comes with it" lines show only while Club is open (ruling c).** Strings: `clubPageLede`,
   `coachPageLede`, `WHAT_COMES_WITH_THE_TEAM` (`lib/team-move-words.ts`); the coach's Plan & billing Club card
   (`lib/plan-billing-words.ts` `change.clubBody`, rendered in `components/billing/BillingBody.tsx`); the Settings "Join a
   club" row (`app/[orgSlug]/coaches/teams/[teamId]/settings/page.tsx` ~:1089-1103); the help articles
   `recipe-link-parent-org` (`lib/help-content/coaches.tsx`) and `recipe-bring-in-coach-team` (`rep-teams.tsx`).
   The gate is `isPlanOpen(gating, 'club')` fed by `getPlanGatingMap()` (`lib/plan-config.ts`; **that file must stay
   import-free**, the demo seed scripts load it with plain Node). **Do the census first** (every reader of those strings,
   both gate states mocked in the tests). Two things to settle, and push back if the ruling does not fit the code:
   - *What "Club is open" means for a screen a coach can already reach.* Production has no club on sale, so no club can
     receive a team yet; the lines promise a path that does not exist. But a club made another way (a demo, a platform-admin
     grant) can receive one. Say in the UX summary which behaviour you built for that.
   - *Static help.* Help articles are static content, not a runtime read. Do not build a new runtime gate for them if a
     proportionate answer exists (hide the entry points that lead to them while closed, or leave them and say so). Report
     the choice; do not widen the help system for this.
4. **The Terms sentence (ruling b) — drafted, not published by you.** `/legal` drafted a new §8 paragraph "If your team
   moves into a club" (the S2 review §4) as edit **T5** on the held next draft (`docs/agents/legal/drafts/TERMS_OF_SERVICE.md`,
   the version that publishes with the Payments Terms; `draftPath` in `lib/legal-documents.ts` is null today). This session:
   add T5 to the held draft with its owner-note shape so the draft-preview test passes. **Do not publish a version, move
   `current` or `oldestAccepted`, or touch the frozen `2026-11-17.md`** (a test hashes it). Publishing is the release
   session's step, and the confirm-screen sentence must not reach production without it (the same promote carries both;
   the Terms' effective date already moves to the release day).
5. **Not built (ruling d):** a prorated refund. If you see a cheap way to refund instead, that is `/accounting`'s call and a
   separate decision; record it, do not build it.

**Owner question for the UX summary (recommend, do not wait on it to start):** is T5 a *significant* change under Terms §18
(30 days' email and a fresh accept-again screen)? `/legal` recommends publishing it before any club can receive a team on
production, bundled with the held version, so it arrives as an ordinary new version. Record the owner's answer in the plan.

## Part B — the three small items (call C5)

The walk saw these on dev only. **Re-read each screen first**; run each on its own, `/review` the create route.

1. **Two tabs naming a club at the same moment make two organizations.** Both doors post to `POST /api/org/create`
   (`app/api/org/create/route.ts`): the Start a club / League Plus form and Run a tournament (`StartTournamentForm.tsx`). The
   guards (`userBelongsToOtherRealOrg` ~:73, `hasLiveInvitation` ~:85) read then write with no lock, and
   `generateUniqueOrgSlug` (`lib/db.ts` ~:1673) is check-then-insert, so a different or suffixed slug sails through. Fix in
   the **shared create step**, not one door; test both. Prefer a fix that needs no migration; if only a database-level guard
   truly closes the race, say so and ask before adding one (a migration means the data dictionary and a production step).
   Also check each form's own double-click guard. Observe the visitor's result: one club, no empty twin, no raw 500.
2. **Signing in from `/auth/login?next=/start/club` lands on Home.** Cause (verify): `resolveLoginDestination` in
   `app/(consumer)/auth/login/page.tsx` (~:96-107) honours `next` only when `hasWorkspace`; a person with no organization yet
   (exactly who starts a club) gets `/discover`. Honour `next` for the start doors (and `/start/league`) without a workspace,
   by an explicit allow-list, **not** by dropping the `hasWorkspace` check (it exists so a workspace-less person is not sent
   to an admin page they cannot open: find why before changing it). Also `StartDoorForm.tsx` ~:388 links bare `/auth/login`
   with no `next`. Add the missing test.
3. **Start-page titles read "… — FieldLogicHQ | FieldLogicHQ".** `app/layout.tsx` ~:46 appends `| FieldLogicHQ`; the start
   pages already say "— FieldLogicHQ" (`app/(consumer)/start/page.tsx`, `club/page.tsx` two variants, `league/page.tsx`,
   `team/page.tsx`, `tournament/page.tsx`). Same doubling on `app/coaches/start/page.tsx`, `app/coaches/checkout/complete/page.tsx`,
   `app/platform-admin/layout.tsx`, `app/platform-admin/bookkeeping/page.tsx`: grep the built titles for the rest. Copy only;
   keep `check:spelling` green; add one small guard test so a title cannot carry the brand twice again. No `/marketing` pass.

## Tests and checks

- Unit tests: both gate states for every reader of the gated lines; the narrowed `NO_MONEY_BACK` rule (allowed only in the
  carve-out, forbidden elsewhere); the date edge cases; the login `next` allow-list; the title guard; the concurrent-create
  behaviour. Existing coverage to keep green: `team-move-words`, `team-move-guard`, `team-move-coverage`, `plan-ending`
  (:713, withdraw-then-cancel order), `plan-billing-words`, `plan-billing-body`, `on-sale-doors-s2`, `legal-documents`.
- The move itself, end to end on dev with Stripe **test mode** (`tests/uat/scenarios/team-ownership-transfer-smoke.spec.ts`,
  `premium-to-club-path.spec.ts`). Tear down any throwaway org or test-clock customer afterwards (list calls hide
  test-clock objects: prove "none left" with search or per-customer lists). Never run a seed while a walk or sweep is live.
- `npm run verify:changed`; `npm run typecheck` (shared modules); `npm run check:spelling`; `check:layout --changed` on the
  two coach/club screens, on the dev server only. New or changed shared modules: **restart the dev server before handing off.**

## Reviews before handing off

`/review` (accounts, a refund statement, the create route); **`/legal` and `/accounting` before hand-off, not offered after**
(`/legal`: the sentence, the Terms draft, the §18 call; `/accounting`: confirm nothing charged or recorded changed, and that
the no-refund statement matches what the code does); `/design` on the two screens; offer `/docs` (the coach's and club's
help for the move must read as the product does) and `/simplify` if the gate duplicates machinery.

## Rules

- Branch `dev` only. Explicit pathspecs, never `git add -A`. **No commit and no push without the owner's yes.** Re-check the
  branch before committing; confirm with `git show --stat HEAD` that only your files landed.
- ⚠ The working copy holds other sessions' uncommitted edits, including shared files near yours (the start-door and
  sign-up forms, the Terms tick row, the legal drafts). Read the hunk before editing; stage only your own.
- Another chat may be building Board Ready Stage 4 Part 2 (the family side of the sign-up form). Nothing here overlaps it; if
  a file you need is open there, stop and say so.
- Production is read only as counts and schema, never a person's row. The shared automation and database checks are not
  touched.

## Hand back

1. What the coach, the club admin and a signed-out visitor see and do differently, in product-owner voice, with how to see
   each state on dev (Club open, and "show as closed").
2. A checkable walk (Artifact, 20 to 50 boxes, one action per step; owner calls never in the counter) entered in the Owner
   QA Ledger as the next free section, plus a changed-board line in the same commit.
3. What the release must do for this: the Terms version that carries T5 and the same promote as the confirm sentence.
