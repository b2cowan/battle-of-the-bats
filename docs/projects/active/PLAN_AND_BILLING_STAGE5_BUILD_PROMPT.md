# Plan & billing Stage 5 + Plans end at renewal Stage 4 — the one words-and-help pass (build prompt)

> **Rewritten 2026-11-16** on the owner's request. It replaces the 2026-10-28 Codex draft, which predated:
> - the merge with renewal Stage 4;
> - Stage 4b's docs-check inputs;
> - "plus applicable taxes";
> - the two-step Start your club window.
>
> Paste into a **fresh Claude chat on `dev`**: `execute @docs/projects/active/PLAN_AND_BILLING_STAGE5_BUILD_PROMPT.md`.
> Recommended model: Opus.
>
> **Gate: met.** Re-read 2026-11-16 and recorded at the top of the plan's Stage list:
> - 4b Part 4 is committed;
> - renewal Stages 1–2 have been on production since 2026-11-05, and Stage 3 has run;
> - "plus applicable taxes" is built;
> - GST/HST Stage 2 is walked (§471);
> - the owner asked for this prompt.
>
> **Plans of record:**
> - [PLAN_AND_BILLING_ONE_EXPERIENCE_PLAN.md](PLAN_AND_BILLING_ONE_EXPERIENCE_PLAN.md): the "Stage list of record" (Stage 5 items a–e) and §5.
> - [PLAN_ENDS_AT_RENEWAL_PLAN.md](PLAN_ENDS_AT_RENEWAL_PLAN.md): Stage 4, and finding F2 in §4 item 3.
> - [PLAN_AND_BILLING_STAGE4B_PLAN.md](PLAN_AND_BILLING_STAGE4B_PLAN.md): "Stage 5 inputs from the Part 4 docs check".
> - [START_YOUR_CLUB_TWO_STEPS_PLAN.md](START_YOUR_CLUB_TWO_STEPS_PLAN.md).
>
> Working rules: [PLAN_AND_BILLING_CODEX_RULES.md](PLAN_AND_BILLING_CODEX_RULES.md). ⚠ Its §3 line saying the owner may
> delegate `billing` is **stale**: `8d579da29` (owner ruling 2026-10-29) made `billing` and `org_settings` owner-only. The
> help ("Only the owner sees it") is right. Do not "fix" it.
>
> Mark each fact **[V]** (you opened it this session, with file:line) or **[H]** (handed to you here). Everything below is
> [H] until you open it. Branch `dev`; explicit pathspecs; **stop for the owner's yes before every commit**; never push.

## What this pass makes true

Every plan's billing screens, windows, emails and help say the same thing in the same words. They are now the screens as
they are:
- one Plan & billing for every plan;
- a plan that ends or steps down **on the renewal date**;
- prices "plus applicable taxes";
- a Premium coach who becomes a club in place, through the **two-step** window.

A coach finds Plan & billing in the coach help; an organizer finds it in theirs. Nothing a customer reads promises what
the product doesn't do.

## Run it as four parts, one commit each (stop after each for the owner's yes)

### Part A · The three small code fixes
1. **The failed payer read (RULED 2026-11-16: degrade).** When the payer or role read fails, team settings still loads
   and the card reads as "no card". Today the whole settings request returns an error.
   - Find the test that pins today's throw (plan §9, Stage 4 review) and re-pin it to the degraded answer.
   - Log the failure server-side. Don't swallow it silently.
2. **The red usage test** (`tests/unit/plan-billing-usage.test.ts` ~L112: 503 instead of 200). Find out whether it is
   still red. If it is, fix the cause (this project's count-only usage route), not the assertion.
3. **The tournament-tier rail double highlight** (item e). On a Tournament and a Tournament Plus owner's rail, check
   whether Plan & billing and another row both read as current.
   - Fix it if it does.
   - If it's already gone, record that with the evidence.

`verify:changed` and `npm run typecheck` (this touches a route). Offer `/review`.

### Part B · The words: windows, billing page and emails (renewal Stage 4)
- **Both cancel windows and the downgrade windows** (to free, and to a lower paid plan). Also the billing-page copy in
  `PLAN_AND_BILLING_COPY.md`. Each states the date the plan ends or steps down, and that nothing is taken away early.
- **F2 (owner, 2026-11-05):** a past-due account's waiting cancel must not promise a date that Stripe's retries can bring
  forward. The rehearsal's case 5 ended four weeks early. Word both the email and the window so they stay true.
- **The five emails:** ends-on, ended, downgrade scheduled, kept, and the seven-day reminder.
  - Register each where template keys live: the platform-admin email list and `/dev/email-preview`.
  - Show each in the preview with real values.
- **The Support Console walk row D3 answer** (renewal plan §1): the operator's side says the same thing.
- **T1, the trial sentence** (item a): one `/marketing` pass on the shared trial sentence and the public trial line, so
  the billing words and the public page agree.
- **Before hand-off, `/legal`** (CLAUDE.md: this changes what we email customers and what a window promises). It checks:
  - CASL: these are transactional, with no offer in them;
  - "nothing taken away early" against what the code does.

  Also run **`/accounting`** if any sentence about a charge, a refund or tax changes. Apply what they find, or record it as
  an owner question.

`npm run check:spelling`, `verify:changed`. Offer `/review`.

### Part C · The help (`/docs`; read `.claude/commands/docs.md` and apply it)
Write in the scannable format the existing articles use. Every fix also reaches `keywords`, `searchText` and `answerText`
(`npm run check:spelling`). Link only to screens that exist.
- **Plan & billing for every plan:** one article, with plan-specific lines only where a plan differs. Plus the articles on
  subscription ends, cancelling, Stripe fees, and the tournament help that links to the subscription settings.
- **Ending and stepping down at the renewal date:** cancel, downgrade to free, and downgrade to a lower paid plan. Cover
  what stays live until then and how to keep the plan. Also the **platform-admin** (operator) help.
- **A coach article:**
  - where Plan & billing is;
  - what the owner can do;
  - that only the owner sees it;
  - what "Covered by {Club}" means;
  - how to reactivate.
- **Becoming a club in place:** the seven new-coverage items in the 4b plan's "Stage 5 inputs". Draw from the screens as they
  are now, which means **the two steps**:
  - Step 1 "Your club"; Next appears only once the name and address pass;
  - Step 2 "Review the charge": the read-back, Monthly / Yearly, the tax by name, Due today, the renewal line, the terms;
  - Start my club, or Continue to checkout when there is free time or a trial;
  - an address we can't sell to yet stays on step 1 with the reason.
- **The misleading sentences** listed in that same section. Reword them; none is false today. Also the "plus applicable
  taxes" form wherever help quotes a price.

`check:spelling`, `verify:changed`.

### Part D · Demos, tests and the walk list
- **Demos follow the product and never gate it** (owner, 2026-09-13). Do not add notes to demo files. Run
  `node scripts/check-demos.mjs` and `node scripts/capture-marketing-shots.mjs --check`. Repair a missing tour destination or
  anchor. Report anything the story would now say differently; curation is a `/demos` session.
- **UAT:** the billing specs (`plan-gating`, `marketing-seam`, `coach-wall-doors`, `premium-to-club-path`) and the fixtures
  that seed billing states match the final screens. Add coverage for:
  - a standalone coach reaching Plan & billing from the rail and the sheet, with no admin screen;
  - a non-owner's locked card on every plan;
  - each wall's owner door;
  - team settings loading with a failed payer read (Part A).
- **Layout baselines** are refreshed on staging, never the dev server. Baseline cleanup (item d) still waits on other
  projects' drift: check, and say whether it has cleared.
- **The walk list** (hand-off only; a Claude session writes the checkable walk, one purpose per walk). List the plan × state ×
  role × host × width combinations, and mark the ones that don't exist:
  - plan: 6 plans;
  - state: active, trial, past due, free time ×3, founding, set to end, stepping down, cancelled;
  - role: owner, admin, non-owner;
  - host: admin, portal;
  - width: desktop, 390.

  Include the two items Stage 4b left over:
  - **§433 walk 5:** a Premium coach whose plan is set to end tries to start a club. It is reachable now and should be refused
    with "Your plan ends on {date}";
  - **the real Stripe portal Renew / resume check** for a Premium plan that is set to end.

## Done when

`check:spelling`, `verify:changed` and `typecheck` are green; the help matches the screens word for word; `/legal` (and
`/accounting` if needed) are applied; the walk list is written.

Then:
- record each part's commit in both plans and the TODO line;
- tick renewal Stage 4;
- mark Plan & billing Stage 5 done.

**Owed after:**
- the owner walk;
- Plan & billing Stage 6 (release and close);
- renewal Stage 5's live checks (the customer-portal settings re-read and the F2 retry setting). These belong to that
  plan's release step, not this pass;
- the release truth-up (`.claude/commands/release.md` Phase 2b) when promoted.

## Do not

- Change a price, a gate or what a plan includes. That is `/strategy` and the Facts doc.
- Mention a `billing` delegate.
- Add a "come back from Club to Premium" path; the help says there is none.
- Write help for a screen that doesn't exist yet, such as Stripe-from-our-admin's price changes, trials or credits.
- Re-seed a shared fixture mid-session (a seed's password reset signs everyone out).
