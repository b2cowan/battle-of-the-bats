# GST/HST · Stage 2 Part 5: the guard on charging calls (build prompt)

> Written 2026-11-05. Parent: [GST_HST_STAGE2_BUILD_PROMPT.md](GST_HST_STAGE2_BUILD_PROMPT.md) — read its ▶ Progress block first
> (Parts 0–4 and 2b are all committed; Part 2b's walk §463 passed 2026-11-05). The part's spec is the parent's "Part 5 · The guard".
> Recommended model: Sonnet (a source-reading unit test, no product behaviour). Words/behaviour in the product do NOT change.
> Mark each fact you rely on [V] (verified by you this session, with file:line) or [H] (handed to you). Everything below is [H]
> unless marked **[V 2026-11-05]**; line numbers drift — grep, do not trust them.

## What this part is

A unit test that fails the build, with a sentence naming the file, when any code under `app/` or `lib/` makes a Stripe call that
CHARGES FieldLogicHQ's own customers without tax switched on. After it, a new charging path cannot ship untaxed by accident — the
same job Stage 1's `tests/unit/billing-location-checkout-guard.test.ts` does for "every paid path asks for the address". Copy its
house style (reads source text, one sentence per failure). No product change, no Stripe calls, no migration.

## ⚠ Correct the parent's exemption list before you write it (disagree out loud)

The parent's Part 5 paragraph lists "the fee invoices per Ask 3" as deliberately **untaxed**. That is stale: **Ask 3 was ruled the
other way** (recovered Stripe fees are taxed ON TOP; Part 2 built it). So the fee-recovery calls are NOT exempt — the guard must
require them to carry tax (`RECOVERED_FEE_TAX` on each fee line; `AUTOMATIC_TAX` on the club's own monthly fee invoice). Say so in
your first message, fix the parent's Part 5 sentence in the same unit of work, and do not write the untaxed exemption.

## The calls, as read in the code [V 2026-11-05, grep of `app/` and `lib/`; re-grep]

**Must carry tax (the guard asserts it):**
- `app/api/billing/create-checkout/route.ts` and `create-team-checkout/route.ts` — `checkout.sessions.create` with `...TAXED_CHECKOUT`.
- `app/api/billing/choose-next-season/route.ts` — `checkout.sessions.create(params)`; the params (and `TAXED_CHECKOUT`) are built in
  `lib/next-season-choice.ts`. **The guard has to follow the params to where they are built**, or it checks nothing.
- `lib/plan-move.ts` — the move UP `subscriptions.update` (sets `automatic_tax`), the down move's `subscriptionSchedules.create` +
  `.update` (`default_settings.automatic_tax`), and the quote `invoices.createPreview` (`automatic_tax` unless the place is "wait").
- `lib/workspace-upgrade-preview.ts` — the no-trial checkout quote (`createPreview` with `automatic_tax`). Previews are in scope
  because a quote that disagrees with the charge is the plan §7 risk.
- `lib/platform-stripe-fees.ts` — three `invoiceItems.create` calls (`RECOVERED_FEE_TAX`) and the club's own `invoices.create`
  (`AUTOMATIC_TAX`).

**Deliberately untaxed — a short, commented list, each with its reason:**
- `lib/billing-setup.ts` `createCardSetupSession` — a setup-mode session; nothing is charged.
- `lib/stripe-connect.ts` — a family paying a club on the CLUB's own Stripe account (Club Stage 12 / plan Stage 5), not our sale.
- `lib/team-org-billing.ts` `startOrgTeamAddonCheckout` — **dead** (nothing calls it; it has no address). Do not revive it. The
  guard should also fail if something starts calling it, so "dead" stays true.
- `lib/plan-ending-server.ts` `subscriptions.update` with only `cancel_at_period_end` / `cancel_at` — cancels and Keep toggles
  charge nothing. The rule must allow an update whose only keys are those, and fail one that changes items, price or quantity.

## Rules for the guard

1. Scan every `.ts`/`.tsx` under `app/` and `lib/` for: `checkout.sessions.create`, `subscriptions.create`,
   `subscriptions.update`, `subscriptionSchedules.create/update`, `invoices.create`, `invoices.createPreview`,
   `invoiceItems.create`, `subscriptionItems.*`, `paymentIntents.create`. Any hit not matched by "must carry tax" or the
   deliberately-untaxed list **fails with the file and the call named** ("add automatic tax, or add it to the list with a reason").
2. Stale entries fail too (a list entry whose call no longer exists), as the parent's other guards do.
3. The failure sentence tells the next developer what to do in plain words, not a rule number.
4. **Mutate-and-fail on disk, as Stage 1's guard was, and record each in the Progress block:** (a) delete `...TAXED_CHECKOUT` from
   `create-team-checkout`; (b) delete `automatic_tax` from the move-up update; (c) delete `RECOVERED_FEE_TAX` from one fee line;
   (d) add a throwaway `stripe.checkout.sessions.create({ mode: 'subscription' })` in a new file under `lib/`; (e) make the dead
   add-on reachable. Each must fail with a sentence naming the file. Restore every one and show the guard green.

## Out of scope (do not build, do not "just add")

Anything that changes what a buyer sees or is charged; the Stripe test matrix (Part 6); the per-charge tax record (Stage 3);
US payments or tax (Stage 8). If the guard finds a real untaxed charging path nobody listed, **stop and report it** — that is a
money defect to rule on, not a line to quietly add to the exemption list.

## Closeout

1. Focused checks: `npm run lint:focused -- <the new test>` and run the new test; `npm run verify:changed` (report the known
   unrelated failures the Progress block already lists, do not fix them). No full typecheck needed (test-only) unless a shared
   module changed.
2. Records: the parent's Progress block (Part 5 entry with the five mutations), the parent's stale Part 5 sentence, the plan's
   Stage 2 status line, the TODO line (one line). Mark nothing "owed" that you did not verify.
3. No `/docs`, no `/marketing`, no walk (no screen changes). Offer `/review` once (billing guard).
4. Do not push. Ask before committing. Stage explicit pathspecs only.

## What comes next

Part 6 (the Stripe test matrix) waits on this part. **Owner step before Part 6, still open:** add our GST/HST number to TEST-mode
invoices (Stripe dashboard → Settings → Invoices → Tax → add, Set as default) — the sandbox account has no account tax ID.
