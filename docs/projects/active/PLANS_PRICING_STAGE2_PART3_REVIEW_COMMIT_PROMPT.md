# Plans & pricing · Stage 2 · Part 3: simplify, review and commit (kickoff prompt)

> Written 2026-11-07, after Part 3 (Watching Stripe) was built and probed on dev. Read first: the Part 3 line in the
> **Progress** block of [PLANS_PRICING_STAGE2_BUILD_PROMPT.md](PLANS_PRICING_STAGE2_BUILD_PROMPT.md) (what was ruled and built), and
> the ledger section §484 in [OWNER_QA_LEDGER.md](OWNER_QA_LEDGER.md) (the walk, NOT YET WALKED).
> This session simplifies, reviews and commits. It builds nothing new. **The owner has NOT yet approved the commit: ask before committing.**
> Mark each fact you rely on [V] (verified this session) or [H] (handed to you).

## What Part 3 changed (read only; no migration; nothing stored; no new Stripe write)

A new platform-admin page, **Health › Stripe** (`/platform-admin/watching-stripe`). Super admin, Billing, Support and Product read it;
the eye shows for all but Super admin; Growth is sent to Today. Four parts, no control that changes anything:
- A chip ("All clear" / "N need a look") and a four-figure band.
- **Updates from Stripe:** two rows (plan billing from `stripe_billing_events`; family payments from `stripe_connect_events`):
  last received, still failing (any age), set aside and wrong mode in the last 7 days (billing only; Connect shows "Not recorded"),
  and a short list of what failed with its stored message.
- **Our records against Stripe:** the newest `stripe_billing_drift_checks` row for this site's mode, as stored. Never re-run here.
  Stale after 36 hours.
- **Stripe settings:** `auditPortal` from `scripts/lib/stripe-portal-audit.mjs`, imported by the app (one copy, shared with the audit
  scripts), 8 second limit; plus a fixed "Cannot be read from here" row for the failed-try outcome (never a pass or a fail).

Owner rulings it carries (2026-11-07, "go with your recommendations"): no "Check now"; the failed-try row says it cannot be read;
two feeds, not three; no club-payouts card; no "This month" card or export (Part 4); no "Send again" (Part 5).

## The files, and whose edits are in them

Wholly Part 3 (stage whole files):
- `lib/watching-stripe.ts`, `lib/watching-stripe-words.ts`, `app/platform-admin/watching-stripe/page.tsx` (all new, untracked).
- `tests/unit/watching-stripe.test.ts` (new, untracked).
- `docs/projects/active/PLANS_PRICING_STAGE2_PART3_WALK.html` and this prompt file (new, untracked).
- `app/platform-admin/console-menu.ts` (the `'stripe'` icon name and the Health entry) and `app/platform-admin/PlatformAdminNav.tsx`
  (`Radio` import and the `stripe: Radio` icon): confirm with `git diff` that each is only those lines.
- `tests/unit/platform-admin-stage1-guard.test.ts` (one href added) and `tests/unit/support-console-stage2-guard.test.ts` (the Health
  label list and three eye lists): only those lines.
- `docs/projects/active/PLANS_PRICING_STAGE2_BUILD_PROMPT.md`: the Part 2 "walk §483 PASSED" clause and the new Part 3 entry. It also
  carries the Part 2 walk record, which was never committed: it goes in this commit.

**Mixed: other sessions' uncommitted edits are in these files. Do NOT revert them and do NOT commit them.** Use the partial-commit
method (memory `reference_partial_commit_shared_tree`: temp index from HEAD, apply only this work's hunks, CAS `update-ref`).
- `docs/projects/active/OWNER_QA_LEDGER.md`: take ONLY the §483 (Part 2 walk) and §484 (Part 3 walk) sections at the end. The
  Stage 13 hunks are another session's. ⚠ `reference_shared_ledger_truncation`: grep the ledger for your sections before staging,
  and again after.
- `TODO.md`: take ONLY a one-clause update to the existing Stage 2 line (the "Stage 2 · read-only views" item): Part 2 walked §483
  PASSED 2026-11-07; Part 3 built, walk §484 owed; commit hash after the commit. Everything else in the file is another session's.
- Do not touch the files `git status` shows that are not named above (the Stage 13, admin-kit, club-hub and GST/HST work).

Re-check all of this with `git status` and `git diff` before staging; another session may have moved on.

## Steps

1. `git rev-parse --abbrev-ref HEAD` must be `dev`. Read the current diffs of the mixed files and confirm the split above still holds.
2. **Run `/simplify`** on Part 3's files only (it adds a new page, a new reader and a new words module, and imports a script helper
   into the app). Points worth a look: the two feed readers share a shape (`readBillingFeed`, `readConnectFeed`); the page's
   figure-band logic is long for what it decides (is any of it better in the words module, where `needsALook` already lives?);
   `ok`/`count` helpers vs. what `lib/platform-online-payments.ts` does; whether `FeedRow`/`Drift`/`Settings` should stay in the page.
   Do not change behaviour. Re-run `tests/unit/watching-stripe.test.ts` after.
3. **Run `/review`** (`.claude/commands/review.md`) on Part 3's changes only. It is a staff screen that names clubs, so privacy counts.
   Points worth an adversarial look:
   - **Does it build for production?** The app imports `scripts/lib/stripe-portal-audit.mjs`, which itself imports
     `../../lib/stripe-portal-settings.ts` with the `.ts` extension. It compiled on the dev server and passes `tsc`. The production
     build is webpack (memory `reference_sharp_turbopack_webpack`). Prove it resolves there (a local production build of that one
     route if the memory allows it; read `reference_local_prod_build_reads_prod_env` first) or recommend copying the audit into `lib/`
     with the scripts importing it from there. This is the one real risk in the change.
   - `needsALook`: each part once; a failed read counts; "not ours" never counts; the failed-try row never counts. Does a feed
     that has never received anything (`lastReceived` null) read as healthy, and should it?
   - The "still failing" rule (error set, never processed, any age) against `stripe_billing_events`'s lifecycle: `done()` clears the
     error, `fail()` sets it, a retry that succeeds clears it. Is there a path that leaves an error on a processed row, or a
     processed event shown as failing? Same question for `stripe_connect_events` (the route sets `error` and later clears it).
   - The "stuck" query: `claimed_at` older than five minutes, nothing processed, no error, no ignored reason. Does a row that was
     never claimed (claimed_at null) correctly stay out?
   - `readSettings`: the 8 second race. The abandoned `auditPortal` promise keeps listing in the background; `audit.catch` stops an
     unhandled rejection. Is anything left running that matters? A missing `STRIPE_SECRET_KEY` must come out as "could not read".
   - The failure list prints up to 200 characters of the stored handler error to Product as well as Billing. Can a handler error
     message carry a customer's email, name or a card detail? Read what `lib/billing-webhook-handler.ts` and the Connect route put in
     `error`. If any can, cut the text or show the type and time only.
   - Stripe dashboard links come from `stripeDashboardBase()` (live vs test by key). The failed-try link
     (`/settings/billing/automatic`) is UNVERIFIED: say so in the hand-off; the walk's step D3 asks the owner.
   - Role gating: page asks `requirePlatformAreaView('watching_stripe')`; Growth and Read only are bounced; the eye test lists
     are right for every role (`support-console-stage2-guard`).
   - Spelling: the gate passed; check "Cancelling" against the house spelling again after any wording change.
   Apply what survives verification; report the rest.
4. **Tests:** `node --import ./tests/ts-resolver.mjs --test tests/unit/watching-stripe.test.ts tests/unit/support-console-stage2-guard.test.ts tests/unit/platform-admin-stage1-guard.test.ts`
   (172 passed at build time), plus every test that greps the menu or the nav (`grep -rlE "console-menu|PlatformAdminNav|platform-areas" tests/unit --include=*.test.ts`).
   Typecheck needs more heap than the default: `node --max-old-space-size=8192 node_modules/typescript/bin/tsc --noEmit --pretty false`
   (clean at build time). `npx eslint` on the new and edited files, `node scripts/check-spelling-consistency.mjs`,
   `node scripts/check-date-correctness.mjs`. Known red NOT from this work: `check-admin-type.mjs` names two club stylesheets
   (`Billing.module.css`, `KitDialog.module.css`) that another session changed. Report, do not fix.
5. **Help article.** This is a new staff screen. Check whether the platform-admin help (`app/platform-admin/help`, and any article
   list it indexes) describes the Health pages. If it does, offer `/docs` for a short "Stripe" entry; if it does not, say so and skip.
6. **`/legal` question for the owner.** The page shows club names and plan, status and renewal differences to Product, who does not
   read Stripe on the Money tab. No new data is collected and no email is sent, so no review was run. Put it to the owner as one line.
7. **Ask the owner before committing.** Then build the commit with the partial-commit method. Before `update-ref`, check the
   temp-index versions of the mixed files (`OWNER_QA_LEDGER.md`, `TODO.md`): they must contain this work's text and none of the
   other session's (grep for Stage 13 text, "13b" and the BC9 sections: absent). Suggested message: `Plans & pricing Stage 2 Part 3:
   the Stripe page in Health (updates from Stripe, the morning comparison, Stripe settings), read only, plus the Part 2 and Part 3
   walk records`, ending with the attribution lines from the system reminder.
8. `git show --stat HEAD`: only the files above. `git status` afterwards: the other sessions' edits are still in the working copy,
   untouched.
9. Update the Part 3 entry in the stage prompt's Progress block: "BUILT 2026-11-07, uncommitted" becomes "committed `<hash>`
   2026-11-07", with a clause for anything `/simplify` or `/review` changed. If that edit is not in the commit, make a tiny docs-only
   follow-up commit, with the owner's yes.
10. Hand-off in product-owner voice: what `/simplify` and `/review` changed, the commit, the walk still owed (§484, five parts,
    four `db-query` commands that change dev data and put it back), and the two open items: the unverified Stripe link, and the
    morning comparison that has read "differs" on every dev run since 2 November (report only, route to `/plan` if the owner wants it).

## Do not

Add a button, a "Check now", a "Send again" or anything that writes; run the morning comparison from the page; store anything;
touch `.claude/settings*.json`, hooks, `package.json` scripts or anything in `WATCHED_PATHS`; touch live Stripe; change the
comparison's rules or the daily job. Do not `git add -A` / `git add .`. Do not revert or "tidy" another session's hunks.
Do not start Part 4 (reports need their own drawing session first) or Part 5 (replay).
