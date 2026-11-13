# GST/HST 6.4 Part B — close: simplify, review, commit, then hand over the next prompt

> Written 2026-11-13 by the Part B build session. Run as ONE fresh session on `dev`. Part B is BUILT, uncommitted; /legal and
> /accounting already ran and are applied. Plan of record: [GST_HST_STAGE6_4_BUILD_PROMPT.md](GST_HST_STAGE6_4_BUILD_PROMPT.md).
> Read its **Progress** block's Part B entry first: what was built, what was decided in the build, the review results and the
> owner calls. **Do not re-litigate §2's rulings or the decisions recorded there. Do not change §6's reviewed words.**

## 0. Before anything
- `git rev-parse --abbrev-ref HEAD` must be `dev`. Other sessions share this working copy: **never** `git add -A` / `git add .`;
  explicit pathspecs only; **ask the owner before committing**.
- Re-run the build's own checks first, so you start from green:
  `node --import ./tests/ts-resolver.mjs --test tests/unit/gst-hst-6-4-renewal-reminder.test.ts tests/unit/billing-location-every-path-guard.test.ts tests/unit/billing-location-checkout-guard.test.ts tests/unit/public-face-s3b-family-emails.test.ts tests/unit/gst-hst-6-4-purchase-email.test.ts`
  (194 + the purchase file, all passing at hand-off) and `npm run typecheck` (clean at hand-off).

## 1. The files of this build (and ONLY these)
New: `lib/renewal-reminder.ts`, `lib/renewal-reminder-server.ts`, `tests/unit/gst-hst-6-4-renewal-reminder.test.ts`,
`docs/agents/legal/RENEWAL_REMINDER_AND_QUEBEC_GATE.md`, this file.
Changed, whole file is this build's: `app/api/platform-admin/stripe-fees-daily/route.ts`, `lib/billing-location.ts`,
`lib/billing-location-server.ts`, `app/api/billing/create-checkout/route.ts`, `app/api/billing/create-team-checkout/route.ts`,
`app/api/billing/choose-next-season/route.ts`, `app/api/billing/move/route.ts`, `app/api/billing/move/preview/route.ts`,
`components/billing/BillingAddressFields.tsx`, `components/billing/PlanMoveDialog.tsx`,
`tests/unit/billing-location-every-path-guard.test.ts`, `tests/unit/billing-location-checkout-guard.test.ts`,
`tests/unit/plan-reader-door-guard.test.ts` (one ALLOWED line), `tests/unit/workspace-flip-guard.test.ts` (one LIVE_ROW entry),
`tests/unit/public-face-s3b-family-emails.test.ts` (Part A's red, fixed), `docs/projects/active/GST_HST_STAGE6_4_BUILD_PROMPT.md`,
`docs/agents/accounting/GST_HST_ON_SUBSCRIPTIONS_CANADA.md` (the Québec bullet).
**SHARED — stage only this build's hunks** (`git diff -U0 <file>` → keep the hunks below → `git apply --cached --unidiff-zero`; or the
temp-index method in the memory note "Partial commit out of shared files"):
- `docs/agents/db/DATA_DICTIONARY.md`: ONLY the two `renewal_reminded_for` entries (organizations ~line 192, team_workspaces ~2610).
  The `answer`/mig 480 trigger hunks (~6243+) are another session's (family accounts 4b).
- `docs/agents/legal/LEGAL_INDEX.md`: ONLY the row "The yearly renewal reminder + the Québec purchase gate (GST/HST 6.4 Part B)".
  The privacy-policy row change and the Audit log row are other sessions'.
Before staging, `git diff --stat` each "whole file" above and confirm nothing foreign has landed in it since 2026-11-13.

## 2. /simplify, then /review (in that order; apply what survives)
- `/simplify` on the files in §1. Likely candidates: `lib/renewal-reminder-server.ts`'s two candidate reads (the annual one and the
  no-cycle one) and the next-season read; whether `money` should move out of `lib/purchase-details.ts` now that two emails use it;
  the Québec 409 body built twice (`requireBillingLocation` and the in-place preview route).
- `/review` (the repo's adversarial funnel, `.claude/commands/review.md`) on the same diff. Points worth a hard look: the claim's
  PostgREST `.or(... neq."<iso>")` filter on a timestamptz; the release restoring the stamp to its previous value; `planLineFigures`
  (plan lines only, discounts, exclusive vs inclusive tax); the gate checking the SENT address before the save; the move route's
  `{ purchase: up }`; the in-place preview refusing a typed Québec address before `previewMove`.
- After any change: re-run §0's tests + `npm run typecheck`; `npm run lint:focused -- <the changed files>`. (`verify:changed`'s
  repo-wide lint step crashed at hand-off on a missing `react-hooks` plugin config, not this build's files; report it if it still does.)
- Known reds that are NOT this build's (re-check, don't fix): account-first-signup, billing-plus-tax-words (help content),
  club-accounting-teams-guard, club-stage13a-doors-guard, coach-practice-plans-phone-guard, kit-dialog-floor-guard,
  online-payments-card-dispute-screens, org-billing-access-guard, plan-billing-usage, plan-reader-door-guard
  (`lib/tournament-online-payments.ts` only), possessive-guard (PlayerGuardiansCard), public-tournament-stage6-walk,
  series-date-groups, support-console-stage3-guard, support-console-stage4b-inforce-guard, team-move-coverage, workspace-flip-guard
  (console-money-sales-tax-wait, DeskNamedPage, kit-tournament-groups). **A red that names a §1 file is yours: fix it.**

## 3. Commit (ask first)
- Show the owner the file list (§1, with the two partial files named) and the message; wait for a yes.
- Message, roughly: "GST/HST 6.4 Part B: the yearly reminder to every owner, and no purchase from a Québec billing address" — body:
  the reminder (30–37 days, once per charge date, late when the job was down, the plan's own figures from Stripe's preview, the
  exclusions); the Québec gate at every purchase door (sent address refused before the save; move down, cancel, payouts, fee
  invoices and saving untouched); the census's `purchase` column; Part A's s3b pin fixed. End with the attribution lines from the
  session's system reminder.
- After the commit: `git show --stat HEAD`; confirm only §1's files (and only the named hunks of the two shared ones) landed.
  If anything foreign slipped in: `git reset --soft HEAD~1`, `git restore --staged <file>`, re-commit.

## 4. Record it (a second small commit, also with the owner's yes, or folded into the first if he prefers)
- Build prompt Progress: change Part B's line from "BUILT 2026-11-13" to "COMMITTED `<hash>` 2026-11-13 (simplify + review +
  legal + accounting applied)", and add what /simplify and /review changed or found.
- The Claude memory file `project_gst_hst_collection.md` (outside the repo, the auto-memory folder): one dated bullet for Part B
  (hash, what it does, the owner calls below), and its line in that folder's `MEMORY.md` ("Part B COMMITTED `<hash>`; the 6.4
  walk next").
- `TODO.md`: update the GST/HST line if it names 6.4's state (one line; positive fact with the hash).

## 5. The owner calls to carry (decided in the build's reviews; do not act on them unasked)
1. **The reminder's template is editable** (/legal): an operator edit can drop the date/amount paragraph or the cancel sentence and
   silently break Terms §8. Rec: render them in code outside the editable body, like the purchase email (a new migration for the
   template row), or refuse to save without them. Route to `/plan` if he says yes.
2. **Québec accounts already on file renew at GST only** and count toward Québec's $30,000/12-month QST test (/accounting): keep a
   running total; a professional should confirm.
3. **Terms 0.3:** §17 must say existing Québec accounts keep their plan (the §9 replacement); §8 needs the trial line.
   Lawyer flags (Québec CPA/French on a renewing QC account; whether the renewal notice is owed by law against the `late` path).
4. `team_workspaces.renewal_reminded_for` is unused — drop it later, or leave it.
5. Still open from Part A's close (build prompt Progress): the six calls listed there.

## 6. Finish: give the owner the next prompt
End the session by writing `docs/projects/active/GST_HST_STAGE6_4_WALK_PROMPT.md` and giving the owner its one-line "execute
@…" — the **6.4 walk** (build prompt §8), its own session: a checkable Artifact, ONE purpose (the three deliverables on dev in
test mode with Canadian test cards). Cases: a first purchase, a League 30-day trial (and answer §6's open question there: does a
trialing subscription's preview carry tax lines?), an upgrade, Premium → Club, a comeback, a next-season choice, a two-owner club,
the reminder (a fixture subscription with its period end set inside the window; include a club with a queued fee item to see the
reminder ignore it), each Québec door (and Stripe Checkout's own page: no address field that changes the customer), the
stored-Québec club's move down, cancel, payouts and saving the address, and the Terms line in preview vs off. Fixture teardown
listed at the end. Point it at this file's §5 so the walk does not re-raise settled calls.
