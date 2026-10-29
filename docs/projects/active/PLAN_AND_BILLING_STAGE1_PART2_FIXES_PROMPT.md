# Plan & billing — Stage 1, Part 2 fixes (after `/simplify` and `/review`)

**Prepared 2026-10-28.** Paste into a Codex chat on `dev`. Do not commit or push. This is a **fix pass on Part 2**, not
Part 3 and not Stage 2.

Part 2 (the shared billing body) was built, then cleaned by `/simplify` and reviewed by `/review` by Claude. The
review found real gaps between the new body and the old screens. This prompt fixes them, nothing else. Read the
rulings first; do not reopen any of them.

## 1. Read first

1. `AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md`, then `docs/projects/active/PLAN_AND_BILLING_CODEX_RULES.md`.
2. `docs/projects/active/PLAN_AND_BILLING_ONE_EXPERIENCE_PLAN.md` — §9's rulings and the Part 2 hand-off at the end.
3. `docs/projects/active/PLAN_AND_BILLING_COPY.md` — every sentence marked **Keep** is a promise (see item B).
4. `docs/projects/active/PLAN_AND_BILLING_STAGE_A_DRAWINGS.html` — the owner's file; read it, never edit it.
5. The current files, not this prompt's description of them: `components/billing/BillingBody.tsx`,
   `lib/plan-billing-words.ts`, `lib/plan-billing-profile.ts`, `lib/free-time-copy.ts`, and the old screens for
   comparison (`git show HEAD:components/admin/kit/club/BillingKit.tsx`; the non-Club screen in
   `app/[orgSlug]/admin/org/billing/page.tsx`).

**Entry state to know:** the tree has Parts 1 and 2 plus the review's own fixes, all **uncommitted** and mixed with other
sessions' files. The review already fixed: the `export *` build break in `components/admin/FreeTimeBand.tsx`, Cancel and
Downgrade showing to a Founding Season customer, a failed grant read looking like "no free time" (`getCustomerFreeTime`
now takes `{ strict }`), the Founding "still free through" date being dropped on a Club free-time plan, and the
org-slug comments. Do not redo or undo them. Check `git status` and preserve every other session's edits.

## 2. What to fix

**A. A cancelled or ended-free-time customer must never be stranded.** Today, when the free-time read fails
(`/api/admin/org/free-time?billing=1` answers 503 on purpose), the cancelled and ended-portal screens never mount
(they wait for `controlsReady`). The customer sees a green "Canceled" chip, a price that reads "Loading…" forever, a
stale "Renews …" line, and no Reactivate / Keep Premium. Decide, from the code, the smallest honest behavior — the
failure must not paint "Loading…" as a price, must not show a good-tone status for a cancelled org, and must give the
customer a way to retry (a Try again control that re-runs the reads) and, for a plain cancelled organization, still a
way back (Reactivate or the Contact us door). Do **not** weaken the 503 itself: the rule that an unreadable read is not
"no grant" stays. A staff free-time org is stored cancelled while running, so "show Reactivate whenever the status is
cancelled" is wrong — say in the hand-off exactly which states you show what in when the read fails, and why.
Same family, same treatment: the plan-availability read failing (`/api/plan-gating`) must fall back to the **Contact us**
door (as the old Club page did), not render nothing; and a Founding-status read failure must not hide every control
for a cancelled organization (the cancelled screen does not need Founding at all).

**B. Restore the sentences the copy doc says to Keep.** Compare `PLAN_AND_BILLING_COPY.md` (lines marked Keep) with what
the body renders, and restore each dropped one through the words file (no hand-typed strings in the screen):
- the team-count helpers `growingTeams`, `largestTeams`, `freeTeams` — including the Club free-time line "Teams you add
  while Club is free are kept after it ends." and "Growing past 15? … Club · Association holds 30." / "More than 30?
  Contact us for a custom plan." (the numbers must come from `plan-config`, not be retyped);
- the Coaches Portal free-time **billing line** ("No billing action needed: your free time runs through …"), which the
  old page rendered for running and ending portal free time and the body drops;
- the cancelled **Premium** screen's Basic-records door ("Basic records are still available" and the link to the
  tournament records) — the unused `W.reactivate.basicTitle/basicBody/basicDoor` exist for it;
- the Founding **card saved** notice (`W.notice.foundingCardSaved`, unused): a Founding customer returning from card
  setup while the Founding Season is active must read it, as the old page did.
If a sentence is truly obsolete under a later owner ruling, do not restore it — list it with the ruling that retires it.

**C. "Change plan or card" must do what it says.** For a customer with a Founding next-season choice, the button
currently re-submits the same plan and cycle. Make it do what the old button did (open the card page / Stripe portal so
the plan, cycle or card can be changed) or relabel it to what it does — read the old page and the drawing; say which.

**D. `justChose` after a bfcache Back.** After choosing, a Stripe round trip and Back leaves the chooser hidden with no
choice recorded. Reset it with the busy state on restore and re-read the Founding status after a webhook-lagged
`?next_season=1` return, so the block fills in.

**E. A reload must not flicker the controls away.** Every `reload()` flips all reads to loading, `controlsReady` goes
false, and Move / Upgrade / Cancel briefly become "Contact us to move"; an open cancel dialog can lose its body. Keep
the previous data painted while a same-org revision refetches (the stale-**org** guard must stay: previous-org data
never paints), and keep an open review window's content stable.

**F. Small corrections:** the Change plan "Holds" column prints "1 of 1 tournament slot" — it should describe the
plan's limit, not a count of itself (check the drawing and the words file); `void reload()` needs a catch (a rejected
`refresh()` must not replace a success notice with an error when the action itself succeeded); a cancelled free-tier
Tournament organization must not be offered a self-serve "Reactivate Tournament" checkout unless that is what the old
page did (check, report); `PlanMoveDialog`'s "Go to Rep teams" must not vanish when a host omits `teamsHref` (default
the way the old dialog did, or make the prop required and update the hosts).

**G. Pin the money requests with a test.** The only request-shape checks today are source regexes. Add a real test
that drives the owner body's actions with a stubbed `fetch` and asserts, per action, the endpoint, the method and the
exact body fields: checkout/reactivate (`planKey`, `billingCycle`, `returnTo`, `orgSlug`), portal, card, keep (DELETE
with `orgSlug` in the query), cancel confirm, downgrade preflight and confirm, choose next season, and the move
dialog's preview / move / checkout fallback. A renamed field must fail a test. Also fix the two weak assertions in
`tests/unit/plan-billing-body.test.ts` the review found: the section-order check passes vacuously when the first item
is missing (assert every item is present, then the order), and the `replaceAll('’', '’')` no-op.

## 3. Not in this pass (owner decisions or Part 3 — do NOT touch)

- Whether `app/api/billing/usage/route.ts` should keep `allowSuspendedOrg: true` and its guard exemption. **Owner call
  pending; leave the route and the guard entry exactly as they are.**
- Owner-only versus delegable billing (new read routes gate on `role === 'owner'`; the money routes use the `billing`
  capability). **Owner call pending.**
- A monthly / yearly choice for upgrades in the Change plan table, the mixed-state "free time hides the upgrade door"
  question, the Part 3 cutover, rail and More-sheet rows, the portal-return fix, retiring the old screens — all Part 3.
- The `export *` re-export shims in `components/admin/kit/club/` — keep them until Part 3.
- Hooks, check scripts, `.claude/settings*.json`, generated baselines (`scripts/.admin-type-baseline.json` needs the
  owner to run `--init`), the owner's drawings HTML, pricing, entitlements, migrations.

## 4. Verify and hand off

Run expensive checks serially: focused lint and the touched unit tests while working; then `npm run typecheck` and
`npm run verify:changed`. Report the **exact current** result. Known shared-tree failures that are not this task's
(report, do not repair): lint errors in another session's untracked `app/dev/crash-test/page.tsx`; the
admin-lettering baseline listing two CSS files this work deleted; unused-CSS, export-catalogue and repo-root-file
checks on other sessions' files. Never call a failed or aborted command passing.

Restart the dev server only if you added files or touched shared modules (`npm run dev`, escalated network access;
confirm `/platform-admin/login?next=%2Fplatform-admin` returns 200 with no Supabase `EACCES`; stop before deleting
`.next`). Browser testing is the owner's.

End with: what each customer type sees differently; for item A the exact table of states shown on a failed read; the
files grouped; checks and exact failures; sentences restored versus retired (with the ruling); what you did not walk;
and the owed steps (`/simplify` on the delta, `/review` of the fixed hunks, `/docs`, owner walk). Update the plan §9
hand-off, the PM brief and the one TODO line. Do not claim Stage 1 complete. Do not commit or push.
