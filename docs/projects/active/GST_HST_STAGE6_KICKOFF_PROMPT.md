# GST/HST · Stage 6 kickoff: Terms of Service, privacy policy, signup acceptance (PLANNING session, not a build)

> Written 2026-11-08, right after GST/HST Stage 4 (the books) was walked (ledger §494). Recommended model: **Opus** for this session (it judges whether each sentence of a legal text is true of the product). A later build session for the signup step and the legal links can run on Sonnet.
> Plan of record: [GST_HST_COLLECTION_PLAN.md](GST_HST_COLLECTION_PLAN.md) §4 Stage 6. Agent: `/legal` (`.claude/commands/legal.md`); read `docs/agents/legal/LEGAL_INDEX.md` and `LEGAL_FACTS.md` first and open a topic file only when a question needs it.
> Mark every fact [V] (you opened it this session) or [H] (handed over). No lawyer gate (owner 2026-11-04): `/legal` flags what a lawyer should look at, the owner decides when.

## What this session produces

A **Stage 6 plan with its PM brief** (per AGENCY_RULES) that a fresh session can execute, plus the **owner decision sheet** (O1–O6 and P1–P6 below) put to the owner in one sitting. No product code, and the drafts stay drafts until the owner approves them.

## Say this out loud first (disagree by default)

The plan lists Stage 6 as "NOT STARTED, `/legal` drafts it". **That is out of date.** Terms of Service v0.1 (2026-11-05) and the privacy policy v0.1 (updated 2026-11-07) already exist under `docs/agents/legal/drafts/`. The drafting is not the work left. Three things are:

1. **The drafts promise what production does not do yet.** The Terms describe cancelling at the renewal date (§8); the owner's 2026-10-31 ruling is built on dev, and the Terms' own list says production still ends a plan at once. A policy that promises what the product does not do is a defect to route to `/plan`, not wording to soften (CLAUDE.md, legal section). Verify against the code, not the draft's claim.
2. **The drafts are four to six days older than the product.** Since 2026-11-05 the product gained signed-in family accounts, Stage 14 (one player across seasons), the per-invoice tax records, the Bookkeeping sales sheets and the accountant package, and the staff cross-club billing lists. The privacy policy's retention and "what we hold" sections must be re-read against each.
3. **The Terms bind nobody until signup records acceptance.** That is product work (the draft's "Product must do first" list), and it is the part with a visible change for every new customer.

Open the drafts and the code before believing this paragraph or the plan line. If any of the three is already settled, say so and drop it.

## Step 1: audit (read, don't build). Delegate the reading to a helper; verify the lines you rely on yourself

1. **Truth table for the Terms.** For every sentence in `drafts/TERMS_OF_SERVICE.md` that states what the product does (renewal, cancellation, refunds, taxes, the confirmation email, account closing, data export), find the code that does it, or mark it "not true today". Return a table, not a dump.
2. **The same for `drafts/PRIVACY_POLICY.md`** §3 (what we collect), §5/§6 (roles and providers), §9 (retention), §10 (security), against the changes listed in point 2 above. The policy's own "Product findings" list (two High: files left after an organization is deleted, no automatic purge) says where it already knows it is thin.
3. **Signup acceptance.** The payout set-up already records a payments-terms version, who, their email and when, and refuses a version that changed mid-window (`lib/platform-online-payments.ts`, `app/api/admin/payouts/route.ts`). Confirm that shape, and list every place an account or organization is created or a plan is bought (public signup, organization creation, coach checkout, club checkout, invitations, comped and Founding accounts) so no path skips the step. Existing accounts accept on next sign-in: find the cleanest place for that.
4. **Legal links.** Terms and Privacy in the site footer and on the account page were deliberately omitted until the pages exist (owner 2026-07-20). List every footer and account surface that gets them (public site, tournament sites, coach portal, club admin, platform emails).
5. **Payments terms (backlog L3).** Online payments stay off in production until the owner switches them on. Check whether the club's payout set-up placeholder terms can ship as they are for now, and what L3 and L4 (money-services status) would need before the switch. Do not draft them here unless the owner says so.

## Step 2: put the owner decisions in one sitting (a sheet, each with a recommendation)

Terms: **O1** legal name, contact email, telephone, mailing address (consumer law asks for a phone and an address; a PO box is common) · **O2** the yearly-renewal reminder: build it or delete the paragraph · **O3** refund when we end a plan · **O4** Québec: "not offered" now, or the L7 work first · **O5** minimum age 18 for account holders · **O6** liability cap: 12 months' fees or $100.
Privacy: **P1** privacy contact and address (PIPEDA wants the accountable person's name or title and address) · **P2** the Supabase region · **P3** data-processing terms with Supabase, AWS and Resend · **P4** the business inbox: move it or list it · **P5** encryption at rest on the Supabase plan in use · **P6** a one-page breach procedure and register.
Do not ask what the audit can settle (P2 and P5 are facts to look up, not preferences). Ask the rest as one question with a recommendation each.

## Step 3: write the Stage 6 plan. It must carry these

- **Sequence by dependency and rework risk, never by calendar** (house rule). Draft order is probably: owner decisions → refresh both drafts against the truth table → the product pieces → publish.
- **The product pieces, as their own build prompts** (route to `/plan`): signup acceptance with version, person and time; existing accounts accepting on next sign-in; the legal links; the purchase-confirmation email the Terms' §16 describes; and the renewal-date cancel reaching production (it rides a release, not this stage).
- **Publishing.** Where the pages live, how a version is bumped, what a version bump does to people who accepted the last one (§18 pairs notice with a re-accept for significant changes). The drafts' "Before this can be published" sections are deleted on publication, and the draft's home becomes a pointer in the legal index.
- **Reviews before hand-off:** `/legal` on the final texts and the signup step (what the product collects, what it emails, what a customer agrees to) and `/accounting` on anything that states a price, a tax or a refund. Apply what they find or record it as an owner question.
- **Help and demos:** a `/docs` pass for the new signup step; the demo sandboxes still pass the build's tour check.
- **Stage 9 needs this stage's wording** for the Terms; say what Stage 9 can and cannot start until publication.

## What not to do

- Do not re-research a topic the legal index shows as fresh; re-verify only when its trigger fired (Bill C-36 passing, a first Québec customer, the Consumer Protection Act 2023 proclaimed).
- Do not write customer-facing copy outside the legal drafts; brand copy goes through `/marketing`, gates through `/billing`.
- Do not mark anything published or approved: the owner approves, and the drafts say "not owner-approved" until then.
