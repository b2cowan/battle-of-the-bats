# Plans & pricing + Stripe from our own admin · the opening design session, FIRST PASS (prompt for Codex)

> Written 2026-10-30 for a Codex session. **This is a first pass. A second session on a stronger model (Claude Opus) will
> read what you write, find the gaps and the weak reasoning, and produce its own proposals and Artifact.** Write so that
> session can check your work fast: every claim is tagged with how you know it (§5), and you end by listing what you are
> least sure of. A first pass that is honest about its holes is worth more than a polished one that hides them.
> **This session reads and writes ONE document. It changes no code, no schema, no settings, and calls no external
> service.** Another agent shares this working copy: do not stage, commit, or touch any file except the one you create.

## 1 · What the owner asked for (his words, ruled 2026-10-30)

The program is **Support console Stage 10, "Plans & pricing", combined with "our own invoices and Stripe run from our own
platform admin"** (one program, one foundation). The owner's rulings, which you do not reopen:

1. **Design starts now; building waits** for the Stripe end-to-end walks and the Plan & billing stages. Nothing you write
   is built from this pass.
2. **The opening design session is a full review of the staff experience of managing plans and pricing: many real use
   cases walked end to end, ending in simple, easy-to-understand paths for the Super admin and the other staff roles to
   do their jobs.** That sentence is your whole assignment.
3. **No full plan builder.** Adding a plan stays a code change, protected by a checklist that a build check enforces.
4. **No second approver for this first go.** The owner is the only admin. Anyone who may change something does not wait
   for another person; instead **every change is logged: who did what, when, and why.**
5. The program also wants: our own branded invoice list inside the product (built from Stripe's *facts*, not Stripe's
   documents); a way to run routine Stripe jobs from our admin instead of Stripe's dashboards; and a price change that can
   be dated, announced to customers by our own email, and applied on that date. The owner asked specifically: can we
   rename a plan, change a price with an effective date and email customers about it, update trials, and pull the data an
   invoice needs, all without leaving our app?

**Who reads the result.** The owner is a product owner, not an engineer. Your top section is written for him (§6). The rest
is for the next model.

## 2 · Read these first, in this order

Every file name in this prompt is a **lead, not a fact.** Plans in this repo have been wrong before, including a plan row
that would have led to building the opposite of a standing ruling. Argue from what the code does.

1. `AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md` (the standing rulings, the one-spelling rule, the shared-automation rule).
2. `docs/projects/active/STRIPE_FROM_OUR_OWN_ADMIN_PLAN.md` and its `_PM_BRIEF.md`: the owner's asks as recorded, a census of
   what the app already calls in Stripe, and the planning questions.
3. `docs/projects/active/PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE10_DRAWINGS_PROMPT.md`: an earlier, **drawings-first** brief for
   the Plans & pricing half. Its §4 census, §5 verify-first table and §7 asks are valuable; its drawing list (A–K) is
   *not* your assignment (you are not drawing). Treat its census claims marked ✔ as re-checked on 2026-10-27 and the rest
   as unchecked.
4. `docs/projects/active/PLATFORM_ADMIN_SUPPORT_CONSOLE_PLAN.md`, section **"Stage 10 findings"** (search for it) and the
   Stage 3, Stage 4 and Stage 4b sections for what the console already does about refunds, free time and the Coaches Portal.
5. `docs/agents/strategy/PLAN_PRICING_FACTS.md` (**the canonical plan names, prices, bands and gating**; its drift
   checklist is at the bottom) and `docs/agents/strategy/BUSINESS_DECISIONS.md` (the 2026-10-30 entry on this program).
6. Code, to verify and to walk: `lib/plan-config.ts`, `lib/plan-config-db.ts`, `lib/plan-features.ts`,
   `lib/plan-gating-server.ts`, `lib/stripe.ts`, `lib/stripe-prices.ts`, `lib/stripe-price-validation.ts`,
   `lib/stripe-billing-state.ts`, `lib/platform-areas.ts` (`PLATFORM_POWERS`: who may do what), the billing webhook
   (`app/api/billing/webhook/route.ts`), the screens `app/platform-admin/plans-pricing/`, `app/platform-admin/plans/`,
   `app/platform-admin/stripe-prices/`, the change-request (approval queue) screens and routes, `scripts/audit-stripe-billing.mjs`
   (read it, **do not run it**), and `docs/agents/ops/stripe-setup-guide.md` (reportedly stale).
7. The customer side, because a price change lands there: the Plan & billing pages (`docs/projects/active/PLAN_AND_BILLING_ONE_EXPERIENCE_PLAN.md`
   for the why; `lib/plan-billing-words.ts` for the words) and the public pricing page (`app/pricing/`).

## 3 · Standing rulings and constraints (do not reopen; cite them, do not argue with them)

- **Plan names, prices, bands and gating have one home:** `PLAN_PRICING_FACTS.md`, kept matched to `lib/plan-config.ts`.
  **Never type a plan price as fresh copy.** Any example number you use is labelled "example" and is not a real price. If the
  Facts doc and the plan config disagree anywhere you read, **list the disagreement; do not pick one.**
- **A Stripe price's amount cannot be edited.** A "price change" is a new price, then moving subscriptions to it, and the old
  price stays alive for everyone still on it. Never describe a price change as an edit.
- **The webhook finds a plan by its Stripe price ID alone** (verify this): swapping an ID in a slot orphans subscribers on
  the old price. Any workflow you propose must not be able to do that.
- **Free time (Stage 4/4b) and refunds (Stage 3) are as built.** Billing actions read the plan a club PAYS for, never the
  effective plan. A price change must not touch free time.
- **The Coaches Portal bills on the club's own Stripe customer as a second subscription.** Never call it "shared".
- **Founding Season:** its dates, dormant lock-in price and end are decided elsewhere; say how a price change treats it, as
  a question, never as a given.
- **Shared automation, hooks, settings and the database checks change only on the owner's word.** Nothing here may assume a
  new scheduled job; if a design seems to need one, say so as a question.
- **Warm is the default look, Dark follows the account setting; the console is desktop only.** (You are not drawing, but a
  path that cannot work on a desktop console is wrong.)
- One spelling everywhere (`installment`, "fiscal year" club-side only, "8:00 a.m."). Sport-neutral words.
- Roles are exactly those in `PLATFORM_POWERS` (Super admin, Billing, Support, Product, Growth, Read only; confirm in code).
  There is **no** "marketing" role today.

## 4 · The assignment

Produce **one document** with these parts, in this order.

### Part A · A verified map of what exists (a census)
What can staff do today about plans and prices, and what cannot they? Be concrete: screen, button, route, the role that may,
what happens next, what is logged. Cover at least: the Plans & pricing screen and approval queue (what each request type
really does), price slots and the Stripe price check, config overrides (tournament limit, seats, trial days), the add-on
catalogue, promotions, gating switches, the Stripe calls the app already makes (read and write), the webhook's handling of
subscription and invoice events, and where each customer-visible price appears. Then **verify every claim in the Stage 10
drawings prompt's §4 and §5 table**, one by one: *confirmed / refuted / could not tell*, with the evidence.

### Part B · The use cases, walked end to end (the core of the work)
Write **at least 25** real jobs a person running plans and pricing would have, **each walked as a short table** with these
columns: *who (role) · trigger · what they do today (screens and clicks, or "cannot") · what goes wrong today · the
proposed path (numbered steps, aim for five or fewer) · what the customer sees · what is logged (who, what, when, why) ·
what cannot be undone · how a mistake is stopped or reversed.* Start from this list and **add what you find missing**:

1. Change the price of a plan for **new** customers only. 2. Change a price for **existing** customers on a chosen date,
with notice. 3. Rename a plan or product (display text only). 4. Add a trial; change a trial's length; remove a trial.
5. Give one customer a longer trial or free time (the existing free-time door, Stage 4, is the answer; check it is enough).
6. Run a promotion or coupon (and say honestly what the Promotions screen does today). 7. Add an add-on; change an add-on's
price. 8. Retire a plan: what happens to its subscribers. 9. Add a new plan (the checklist; not a builder). 10. Monthly and
annual prices for one plan. 11. A customer asks "what will I be charged on the 1st, and why": the billing story on one page.
12. A card fails: what staff see and do. 13. Refund or credit a customer (Stage 3 built refunds: check what staff still
cannot do). 14. A customer upgrades or downgrades mid-period: what they are charged and told. 15. Find every customer on a
given price or plan. 16. See renewals due this month and trials ending. 17. Notice that our records and Stripe disagree
(someone edited in Stripe's dashboard by hand). 18. Test a dated change without waiting for the date (Stripe test clocks).
19. A customer asks for an invoice for a date range, or for one payment, in our own branding (the invoice-list ask).
20. Stop a scheduled price change before it applies. 21. Undo a price change that has already applied. 22. A mistaken or
wrong-plan Stripe price ID is pasted into a slot. 23. A new staff member needs to do pricing work: which role, what they
see. 24. The owner is away: who can do what, and who cannot do damage. 25. The accountant asks what a customer paid and
when (the link to the bookkeeping work; do not design bookkeeping).

### Part C · Simple paths, by role
A matrix: **role × job** (may / may not / reads only), then for each role **the three to six jobs they do most, as the
shortest path you can justify.** Where a role has no good path today, say so. Flag any job a role can do today that it should
not, and any it cannot do that it plainly should. Do not propose a new role; if you think one is needed, say why as a question.

### Part D · What Stripe lets us do (a capability map)
For each of the owner's questions (rename, dated price change, trial update, invoice facts, credit/refund/coupon, pause, cancel
at period end, resend a receipt) say: **possible through the API: yes / no / partly**, which Stripe objects and calls, what the
app already does, what is new, and the risk of the write. **If you can reach Stripe's current documentation, use it and cite
the page; if you cannot, mark every Stripe-behaviour claim as unverified and say so at the top.** Never call Stripe yourself.

### Part E · The foundation, as options with costs (do not decide)
Lay out the choices the program has to make and what each costs, with a recommendation and your reasons:
**(1)** where the dollar amounts live (code plus the Facts doc, as today; or a price book in the database with effective
dates), and what moving them touches (the earlier census says about 65 files read the plan config: verify);
**(2)** a local copy of Stripe's billing facts written as webhooks arrive, and what it would power (invoices, a customer's
billing story, renewals, drift);
**(3)** how a dated price change should work (Stripe subscription schedules are already used in the app: verify where),
including a **preview** ("this changes N subscriptions by $X a month"), a **waiting period**, a **one-click stop**, and the
audit record the owner asked for in place of a second approver;
**(4)** test clocks;
**(5)** what the console's Stripe key would need to be able to do, and what the safest way to write to live Stripe from a
browser-driven admin is (the console's key was kept at full strength in Stage 3 only because Stripe bundles refunds with
other writes);
**(6)** the checklist-plus-build-check for adding a plan: list the items a plan needs today (the plan config, the type, the
gating row, price slots in both environments, the Facts doc, the pricing card, help content, the demo, tests), and say which
the build can verify automatically;
**(7)** the customer notice: who sends it, from where, when, what it must say, and how it avoids being sent twice or to the
wrong people.

### Part F · Questions for the owner
Every decision that is the owner's, one recommendation each, in the order he must answer them. **Do not decide for him.**
Business-policy questions (what existing customers keep when a price changes, how much notice, what a customer's notice
says, whether prices become dated data) are flagged **for `/strategy`**, because they are business decisions and must be logged
once ruled. Tell him to check Canadian consumer and tax rules with the person who advises him: **do not assert the law.**

### Part G · Risks and threats
What could go wrong in this program, ordered by harm: a write to live Stripe by mistake, a notice sent twice or to the wrong
audience, a price flipped that orphans subscribers, a mistaken bulk change, a role doing something it should not, a record that
disagrees with Stripe, an action with no log. For each, the control that would stop it. Say what a test would look like.

### Part H · Coverage and honesty
- A **coverage table** answering: *which of the owner's asks (§1, point 5) and which of the 25 jobs does each proposal serve,
  and which are still unserved.*
- **"Where I disagree with the earlier documents."** If the plan, the drawings prompt or a ruling's reasoning looks wrong or
  incomplete to you, say so plainly, with evidence. (The house rule is to disagree out loud before work starts, not defend it
  afterwards. Do not manufacture disagreement; if the direction is right, say so and say where the risk actually sits.)
- **"What I could not verify."** A list, with why.
- **"Where I am least confident."** The three to five places the next model should attack first.

## 5 · How to tag every claim (this is what makes the pass checkable)

End each factual claim with one tag:
- **[V path:line]**: you read it in the code or a document and are citing the line. The next model will open it.
- **[D file]**: it comes only from a plan or a prior summary and you did not check it against the code.
- **[S]**: Stripe's behaviour from documentation you read this session (cite the page) or from memory (say "memory").
- **[A]**: your assumption or inference.

Untagged claims are treated as unverified. **A claim a helper or an earlier document made is a lead, not a fact, until you
have tagged it [V].**

## 6 · The document's shape and where it goes

Create exactly one file: `docs/projects/active/STAGE10_PLANS_PRICING_STAFF_REVIEW_FIRST_PASS.md`.

Its **first section, "For the owner" (one page at most)**, is plain language for a product owner and contains: what you found
about how staff manage plans and prices today, in five or six sentences; the three biggest problems; the shape of the simplest
path you propose for the five jobs that matter most; the five decisions he must make, each with your recommendation; and what
is still unknown. **No file paths, function names or code in that section.** Everything after it is for the next model and may
be as technical as it needs to be.

Length: as long as the work needs, but each use case is one table, not an essay, and every part starts with a three-line
summary. Do not pad. Do not reproduce the source documents; cite them.

## 7 · Do not

- Change, create or delete any file except the one above. Do not stage or commit anything. Do not edit `TODO.md`, any plan, the
  Facts doc, the help content, memory, settings, hooks or scripts.
- Run anything that calls Stripe, sends an email, or reads or writes either database (no probes, no `audit-stripe-billing.mjs`,
  no migration tooling, no dev server). **Reading source files is the whole method.**
- Draw screens or produce a design Artifact. Visual drawings come after the owner has read this and ruled, and go through the
  design review. Name screens and describe steps; do not mock them up.
- Decide an owner's question, tick a box for him, or state a plan price, a notice length or a policy as settled.
- Propose a plan builder, a price box that edits a Stripe price in place, a second approver, or a new scheduled job as a given.
- Restate a real plan price. Example figures are labelled "example".
- Pad a thin finding into a confident one. "I could not tell" is an acceptable and useful answer.
