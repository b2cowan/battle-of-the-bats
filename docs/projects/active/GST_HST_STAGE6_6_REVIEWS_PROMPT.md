# GST/HST Stage 6 · step 6.6 — the reviews before hand-off (kickoff prompt)

> Written 2026-11-16, after the 6.4 walk (ledger §525) passed 83/83 and the F9 fix landed (`cabd35003`). **Paste everything
> below the line into a fresh chat on `dev`.** Plan of record: [GST_HST_STAGE6_TERMS_PLAN.md](GST_HST_STAGE6_TERMS_PLAN.md)
> §5 "6.6 — Reviews before hand-off" and §5 "6.7 — Publication" (what this step feeds). PM brief:
> [GST_HST_STAGE6_TERMS_PM_BRIEF.md](GST_HST_STAGE6_TERMS_PM_BRIEF.md).

---

You are running **step 6.6** of GST/HST Stage 6: the four review passes that must happen before the owner is asked to approve
the Terms of Service and privacy policy for publication in 6.7. **This is a review-and-apply session, not a build.** Nothing
is published, no switch is flipped, and nothing in 6.7 happens here.

## Where things stand (read these, don't re-derive)
- **Built and walked:** 6.2 (the accept step, "I agree" at every door; walk §500 passed 21/21), 6.3 (billing details; walk §506
  passed 81/81), 6.4 (the purchase email, the yearly reminder, no purchase from a Québec address; walk §525 passed 83/83 on
  2026-11-16, F9 fixed `cabd35003`). 6.5 (deleting an organization removes its files) is built, `45c134bea`, and rides the next
  release.
- **The texts under review are drafts:** `docs/agents/legal/drafts/TERMS_OF_SERVICE.md` and `PRIVACY_POLICY.md`. The product
  renders them only as "draft" in the dev preview (`LEGAL_PAGES_PREVIEW=true`); on production the legal pages are off until 6.7.
- **Settled — do not reopen:** the owner's sheet O1–O8 and P1–P7 (plan §5, "RULED"), the 6.4 rulings Q1–Q6, and "no lawyer and
  no accountant gate" (owner 2026-10-31 and 2026-11-04): the agents **flag** what a professional should look at; the owner
  decides when.

## The four passes (run in this order — each later one reads the earlier ones' output)

**1. `/accounting`** — read its index first. Review everything that states a price, a tax, a refund or an invoice:
   - Terms §6–§8 and §16 (price, taxes, renewals, yearly plans, cancellation and refunds, "the details of your purchase");
   - the purchase email and the yearly reminder **as they actually render** (use the fixture/tests or the Sent emails page to see
     real output; the figures in the §525 walk answers — e.g. C7's trial preview carrying tax lines, E4's Premium→Club credit —
     are evidence, not assumptions);
   - the Québec refusal wording (Terms §17) against the registration facts.
   Check what the Terms promise against what the code does, not against what a plan says.

**2. `/legal`** — read its index first. Review the v1.0 texts, the accept step (what is collected, what a customer agrees to,
   the record kept, terms versioning), and **every new customer email** from 6.2–6.4 (purchase details, yearly reminder, the
   existing billing emails now sent to every owner). Cover CASL for each email (transactional vs. promotional), PIPEDA/Law 25 for
   what the product collects, and whether the privacy policy promises anything the product doesn't do (a defect to route to
   `/plan`, not wording to soften). Known open privacy findings from 6.1 (retention purge, a club deleting a child, MFA,
   self-serve correction) are separate `/plan` items — confirm the policy states them truthfully; don't build them here.

**3. `/docs`** — after 1 and 2 have been applied or recorded. Add the help passage for the accept step and where the legal
   pages live; make the billing articles' cancellation and refund lines match Terms §8; fix any article the 6.4 emails or the
   Québec refusal made out of date. Help describes the product; the Terms must agree with it, not the other way round.

**4. Demos check** — the build's tour check must pass **with the legal-pages switch on** (the demo exemption). Run the
   existing check only. **Do not curate the demos story** (that is `/demos`, once per release cycle) and **do not re-seed
   anything** (owner ruling 2026-09-13).

## Rules for the session
- **Disagree out loud** (AGENCY_RULES). If a review finds the Terms promise something the product doesn't do, say so plainly and
  give a recommendation: change the words or build the thing — and say which is cheaper and which the evidence favours.
- **Apply or record.** Each finding is either applied now (copy and draft-text fixes; small, safe code fixes) or recorded as an
  **owner question** with a recommendation. Anything that would change what the product charges, collects or sends beyond a
  wording fix goes to `/plan`, not into this session.
- **Don't re-litigate settled rulings** — if a finding contradicts one, quote the ruling and ask whether it still stands.
- **Facts go to their homes:** new legal facts → `docs/agents/legal/LEGAL_FACTS.md` / `LEGAL_INDEX.md`; new accounting facts →
  `docs/agents/accounting/` and its index. Prose only; no perishable "uncommitted/not on prod" claims (status-wording rule).
- **One spelling:** run `npm run check:spelling` on anything customer-facing you touch (`installment`, the "8:00 a.m." clock).
- **Verification:** use `npm run verify:changed` and focused lint; run `npm run typecheck` only if you touch shared code. If a
  check fails on files you did not touch (other sessions share this tree), report it and don't fix it.
- **Commits:** stage explicit paths only, `dev` branch only, and **ask before committing** (owner rule). Docs/drafts in one
  commit, any code fix in its own.
- **Product-owner voice** in the hand-over: what changed in the words and the product, what the owner must decide, in plain
  language — no file paths in the summary.

## What to hand back
1. A short **per-pass verdict** (accounting / legal / docs / demos): clean, applied, or open — with counts.
2. **The owner-question list**, each with a recommendation and the cost of each answer. Keep it to real decisions.
3. **What blocks 6.7**, honestly: against the plan's prerequisites (L-a/L-b/L-c answered and in §6/§10 — the owner still reads
   the two Stripe dashboard settings, ~2 minutes; taxed checkout on production or the Terms say less; 6.3/6.4 walked — done;
   6.5 on production — built, awaiting a release).
4. Update `TODO.md` (one line), the plan's §5 6.6 block with the outcome, and `OWNER_QA_LEDGER.md` only if a walk is created.
   If an owner walk is needed (e.g. for new help passages), say so and propose it — don't publish one unasked.

## Out of scope
Publishing the Terms, deleting the draft files, flipping the legal-pages switch, any release or promote, pushing `dev`, and
clearing the 6.4 test-mode charge records — all owner calls, and 6.7 or `/release` work.
