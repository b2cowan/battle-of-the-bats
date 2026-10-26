# Platform admin support console · Stage 3, Money (drawings prompt)

> Paste into a new chat on `dev`. Written 2026-10-26, the day the owner passed the Stage 4 walk (ledger §379, 53 of 53 + 14 calls accepted).
> **This session draws and asks. It builds nothing.** The output is a drawings Artifact, the owner's rulings on it, and
> then a Stage 3 build prompt (written last, like Stages 2 and 4). **Re-verify every lead against the code before you
> draw on it:** this prompt is a lead, not evidence, and so is any helper's summary. The working copy is shared with Club
> Tier and Bookkeeping sessions: stage explicit paths only, check the branch before every commit, `git show --stat HEAD`
> after it. Commit nothing without the owner's OK.

## 1 · What Stage 3 makes true (the objective)

Support can answer **"was this customer charged twice, and can you fix it?"** from inside the console, in a few clicks,
with no trip to Stripe's dashboard. Today the kickoff measured that path at about 14 clicks and a trip out. Stage 3 makes
it one idea: **the money truth is shown, never remembered (R7).**

1. **Stripe beside ours.** On the club record's Money tab: the charges, invoices and subscription events Stripe holds,
   next to the plan, status and period end we hold. Read live from Stripe when the tab opens (never stored, never
   cached past the visit). Where the two disagree, the screen says so in plain words.
2. **Duplicate-charge help.** Two charges for one period, a charge with no matching plan change, a failed payment that
   then succeeded: the screen names these patterns, it does not make the person hunt.
3. **Refund from the console (Q7, ruled).** Full or partial, to the original card only, with a confirm sentence (R3) and
   a reason (R4). Credits stay in Stripe (ruled). A refund reaches Stripe, so it can never be "put back" (R5): the screen
   says so before it is confirmed, and the Story records it as a fact, not an undoable row.
4. **A reason in the audit log, in its own column.** `platform_audit_log` has none today: the reason is stuffed into
   `new_value`, and override revoke and the add-on toggle record none. This is the stage's **one migration**.
5. **Charge numbers findable (A10, ruled).** Find learns a Stripe charge/invoice/subscription id and the last four digits
   of a card **only if the code can honestly serve it** (see §4: the plan says subscription charge ids are stored nowhere).
   If it cannot be served without storing card data we should not store, say so on the drawings and draw the honest
   version.
6. **The Story gains its purchases (A4, ruled: "purchases come with S3").** The "not in it yet" line in the club's Story
   goes away for purchases; charges and refunds become Story rows (facts, never offered a Put it back).
7. **Duplicate labels** cleaned up (the kickoff found places where the console calls the same money thing by two names;
   find them, do not trust this line), and **M6**: it is named in the plan's ladder row and the end-state artifact but
   **defined nowhere I could find**. Find where it came from (the kickoff walk
   `PLATFORM_ADMIN_SUPPORT_CONSOLE_WALK.html`, the earlier audit it cites) and say what it is **before** you draw it. If
   you cannot find it, say so on the drawings page and ask the owner; do not invent a meaning.

**Not Stage 3** (later stages; do not draw them as if built):
- Status and the health line, the sent-email log, Feedback reply (S5);
- club web addresses and quota (S6);
- anything on the family-facing payments rail (Club Tier Stage 12, a different session) or the company's own books
  (Bookkeeping): this stage is **a customer's subscription money**, seen from the console.

## 2 · Standing rulings (do not reopen)

- Plan "Owner rulings 2026-10-24", "2026-10-25" (Stage 2 and Stage 4 drawings), and the standing rules **R1–R8**.
  Especially **R5** (undo is Put it back, never for anything that reached Stripe or an inbox) and **R7**.
- **Q7:** refund from the console; credits stay in Stripe. **A2:** Stripe numbers for **Super admin, Billing, Support**
  (read). Who may *refund* is **not ruled**: it is an ask (§6-1), and Stage 4's pattern (Super admin + Billing, with a
  cap that scales by role) is the starting point to argue from, not a ruling.
- **Stage 4 rule that matters here:** every billing ACTION reads the plan the customer *pays for* (`ownPlanOf`), never
  the free one (a club on free time is not "on" the free plan for refund or cancel purposes). Check the same for refunds.
- Stages 1, 2 and 4 are done and walked (§371, §377, §379). Shell, Find, menu by job, Today, Story, Put it back, free
  time: as built. Do not redraw them; draw Stage 3's parts **on** them.
- Warm is the default; Dark follows the account setting. Draw both. Desktop only for the console (Q4).
- **A refund is a money write.** Draw it, review it, and plan its tests as one (§5-H).

## 3 · Read first

- The plan (`PLATFORM_ADMIN_SUPPORT_CONSOLE_PLAN.md`: ladder row S3, "Kickoff findings" Task 1, the Stage 2 and Stage 4
  findings), the PM brief, and the index https://claude.ai/artifact/TLP8d5Zec4xVkTSYrQU8tp (news goes in as an
  `ArtifactData` write to `stages/s3` and `log/…`; never republish it).
- The end state https://claude.ai/artifact/RCpPoxNNxGDfiC4FFo4m1g: its **Money screen (screen 4)** was drawn before
  Stages 1–4 existed. **Redraw it on the real shell and the real club record**, do not copy it.
- The Stage 4 drawings https://claude.ai/artifact/5eawvGUPwQVPoWiAV7vQY5 and walk https://claude.ai/artifact/4nqZcj52DpjYoQSEBWMUVZ for
  the format the owner approved (true size, Warm and Dark, before = a capture from dev, NEW / RESTYLED / UNCHANGED /
  LATER tags, each clickable with its reason, a checkable paste-back with a recommendation beside every ask).
  **Draw every screen FROM its capture, part by part** (the Stage 4 lesson: drawing from memory of the kit invented a
  chip, a band look and a tab).
- What earlier stages leave that Stage 3 stands on: the club record and its tabs (`app/platform-admin/…/ClubRecord.tsx`),
  `lib/platform-story.ts` (Story rows), `lib/club-record-changes.ts`, `PLATFORM_POWERS` in `lib/platform-areas.ts`,
  `lib/platform-audit.ts` (the audit writer; the reason column's one home), `lib/platform-find.ts`, the billing code
  (`app/api/billing/**`, the Stripe webhook, `lib/stripe*`), and `lib/operator-plan-change.ts`.
- `docs/agents/strategy/PLAN_PRICING_FACTS.md` (**never restate a price or gate; reconcile against it**),
  `BUSINESS_DECISIONS.md`, `PROGRAM_BILLING_AND_ENTITLEMENTS.md`, `docs/agents/design/` standards, `AGENTS.md`,
  `AGENCY_RULES.md` (PM UX summary before code; disagree out loud). **Stripe: check Stripe's current docs for every
  API you draw on, not memory** (the owner's standing rule for Stripe work).

## 4 · Verify these leads first (the plan has been wrong before)

| Claim | Check against |
|---|---|
| The org record makes no Stripe read anywhere in the platform admin | Every `stripe` import under `app/platform-admin` and `app/api/platform-admin`. What Stripe client exists, which key (live vs test per environment), and what the console may call |
| Subscription charge ids are stored nowhere | The webhook route and every table that holds `ch_`, `pi_`, `in_`, `sub_`, `cus_`. What would a Stripe read return that we cannot reconstruct locally, and what is the **cheapest honest Find** (customer id? invoice number? the last four of a card cannot be searched without a Stripe search call: is that call allowed and rate-limited?) |
| `platform_events` has no purchase/upgrade event | That table and its writers; the Story's source rows. What would "purchases in the Story" read from: Stripe live, our webhook, or a new event written by the webhook (a write path = migration + a prod webhook change: draw the cost) |
| A refund happens in Stripe and leaves no trace on our side | The webhook's `charge.refunded` / `refund.*` handling today; what a console refund must write **and what the webhook will write when Stripe echoes it back** (a double record is the obvious bug: say how the design prevents it) |
| `platform_audit_log` has no reason column | `lib/platform-audit.ts` and the table in the dev snapshot (`docs/agents/db`), **not** the migration files. How many writers pass a reason in `new_value` today, and how a reader (the audit screen, the trail, the Story) must change so old rows still read |
| Bulk plan change drifted from the single-org path | Fixed 2026-10-24 (`lib/operator-plan-change.ts`, guarded). Confirm the guard still holds, and whether S3 owes anything more here or it is just a closed line in the ladder |
| Refund rules | Stripe's current docs: partial refunds, refund windows, what a refund does to a subscription invoice (credit note vs refund), what happens to a plan after a refund (nothing, by default: say what the console tells the person). The webhook overwrites `plan_id`, both limits and status on every subscription event: a refund must not cause a surprise plan change |
| Who may do what | `PLATFORM_POWERS`: which powers exist for money today, which staff roles hold them, whether a `refund` power exists. A new power is a rulebook change: draw it |
| Duplicate labels | Grep the console for the same money idea named two ways (Renews / Period end / Next billing; Comp / Free; Subscription / Plan). Census them; the one spelling rule applies |

## 5 · The drawings (blocking: no code in this session at all)

Published as one Artifact from `PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE3_DRAWINGS.html`, linked from the index's `stages/s3`.
True size, 1440 wide, Warm and Dark. Whole-screen before → after. Every highlight clickable with its reason.

- **A · The Money tab, read.** What Stripe holds beside what we hold: customer, subscription, the last N charges and
  invoices, status, next charge, card brand and last four. A plain "they agree" / "they disagree, here is how" line (R7).
  What shows when the club has no Stripe customer (free, comped, free time), when Stripe is unreachable, and when the
  club pays through the Facilitated Payments rail (check what that is before drawing it).
- **B · "Was this charged twice?"** The duplicate patterns, named in plain words, each with the evidence and the next
  step. Draw the case where there is a real duplicate and the case where it only looks like one (two different periods).
- **C · The refund window.** Pick a charge · full or partial amount · why · the confirm sentence with the **plain
  consequence** ("Refund $39.00 to the Visa ending 4242. This cannot be undone. The club's plan does not change."). What
  the person sees after, and what the customer receives (does Stripe email them? is that a send we do not control?).
  **An email or notice to the customer is a customer-facing send and needs its own ask.**
- **D · The Story with purchases.** Charges, refunds and plan purchases as rows; which are facts (no Put it back, ever)
  and which stay undoable; how the "not in it yet" line is retired.
- **E · The reason column.** The audit log screen and the record's trail showing a Reason; old rows that have none read
  honestly ("recorded before reasons were kept"). Include the two actions that record no reason today.
- **F · Find.** What a charge/invoice/subscription search returns and for whom (A2: Super admin, Billing, Support), and
  the honest limit on card digits. Findings of a Stripe id must not be written to the access trail as words (A3: records
  opened, not the words).
- **G · When it cannot work.** Stripe down; a refund that Stripe refuses (already refunded, too old, exceeds the charge);
  a double click; a refund Stripe accepted but our write missed (and the reverse); two staff refunding the same charge at
  once; a staff role that may read but not refund (draw each role); the test-mode key in a non-prod environment.
- **H · The refund's threat list and test plan.** A written threat list over the *design*: who may refund and how much,
  a cap that scales by role (is there one? what does Stage 4's "Billing 6 months, Super admin 12" suggest here?),
  self-refund or a friend's club, an idempotency key so a retry cannot refund twice, the amount trusted from the browser
  (it must not be), the reason required, the audit row written even when Stripe fails, and what is logged without
  storing card data. Run **`/review`**'s security lens over the design. State the tests the build must carry, including
  a mocked-Stripe suite that proves a retry cannot double-refund.
- **I · The boundary.** One page marking every part NEW / RESTYLED / UNCHANGED / LATER so the owner sees what Stage 3
  will and will not deliver. Nothing may imply S5 or S6 is built. Example data labelled "example", and **no real
  customer's name or card digits** on a drawing.
- Run **`/design`** on the drawings before the hand-off, apply its fixes, and list any written-rule conflict for the owner.

## 6 · Asks for the owner (one recommendation each, beside the drawing it decides)

Draft these, reword to the drawings: **do not decide for the owner.**
1. **Who may refund**, and is there a cap by role (a refund over $N needs the super admin)? Also: who may *read* Stripe's
   side (A2 says Super admin, Billing, Support: confirm that holds for charge detail, not only for Find).
2. **Refund scope:** full only, or partial too? To the original card only (recommended by Stripe's own rules), or is any
   other destination in play (it should not be)?
3. **Does the customer hear about it?** Stripe's own receipt email only, a notice from us, or nothing? (A send needs its
   own ruling; draw the options.)
4. **Where do purchases and refunds come from for the Story:** a live Stripe read every time, or the webhook writing an
   event we keep (a migration plus a prod webhook change)? State the cost of each; the recommendation should weigh a
   Story that works when Stripe is down.
5. **Find and card digits:** search by Stripe ids only, or also by card last four (needs a Stripe search call, rate
   limits, and a decision on what the access trail records)?
6. **The reason column:** required on every new audit write, or optional with a UI that asks? And what do old rows show?
7. **Bulk changes' Subscription status override** (left open from Stage 4, call 14): follow free time's rules (an end and
   the cap), or stay as is? It is a bulk way to keep clubs open without an end. This is a Stage 4 leftover riding here
   because both are about who may keep a club open for free; ask it plainly, with the Stage 4 rule as the recommendation.
8. **The double plan grant race** (Stage 4 finish review: two staff giving a plan grant at once can write two rows; the
   fix is a partial unique index = a migration). Ride this stage's migration, or wait?
9. **M6** if you could not find it: what was meant.
10. **Still open from the kickoff, ask again where it bears:** the morning check on Status (Q6, decided at S5).

## 7 · Hand-off

- Restate the **PM summary in five lines** (`AGENCY_RULES`): what support sees and does, what the customer sees, what is
  deliberately left for S5/S6, Warm/Dark, roles.
- Update the index (`stages/s3` state + anchor + a `log/` row), the plan's S3 row and Status, TODO, the PM brief, and the
  auto-memory file `project_platform_admin_support_console.md`. A ruling is recorded exactly as ruled; add nothing it did
  not rule.
- When the owner has ruled: write `PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE3_BUILD_PROMPT.md`, in Stage 4's shape (verified
  state, scope is / is not, parts, **gate = census + `/billing` + a Stripe docs check**, guards, verify, hand-off, do
  not). The build needs a migration (the audit reason, and maybe a webhook event table): say so then; this session
  writes none. Plan the finish pass (`/simplify`, a high-risk `/review` with the money lens, `/docs`, `/strategy`) as a
  step of the build, not an afterthought.
- Prod owes migrations 365, 367 and 373 at the next release: say in the build prompt that Stage 3's migration joins that
  list, and **any change to the Stripe webhook is a prod-release step that needs the release manager (`/release`)**.

## 8 · Do not

- Write or change code, schema, `proxy.ts`, hooks, env settings or any watched script.
- Call Stripe with a **live** key, or call it with any key at all except read-only calls on the dev/test key to learn
  response shapes. Never create, refund or cancel anything, even in test mode, from a probe.
- Redraw what Stages 1, 2 and 4 ruled (the shell, Find, the menu, Today's frame, the Story, the one pencil, free time).
- Draw Status, the sent-email log, club web addresses or the family payments rail as if they exist.
- Restate or change a price, plan name or gate (`/strategy` decides; `PLAN_PRICING_FACTS.md` is the record).
- Send any email or touch a real customer's record: probes are read-only, non-GET aborted, and never overwrite
  `tests/uat/.auth/platform-admin.json`.
- Decide an ask for the owner, or tick a box for them.
