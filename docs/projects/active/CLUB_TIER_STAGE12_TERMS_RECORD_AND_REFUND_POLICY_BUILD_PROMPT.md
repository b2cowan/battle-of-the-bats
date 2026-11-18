# Club Stage 12 — the payments-terms record and the required refund policy: build prompt

Paste into a fresh session. Written 2026-11-17 by the `/legal` payments-terms session (owner: "what do we do next? build the
refund policy or the keeping of agreement records?" → `/legal` recommended both in one session, because they meet in the
same window).

---

You are building **two small parts of Club Stage 12 (Families pay online)** that the owner-approved payments terms
(`docs/agents/legal/drafts/PAYMENTS_TERMS.md` v0.1, approved 2026-11-17) rest on. The terms cannot be published until both
are true. Plan of record: `docs/projects/active/CLUB_TIER_STAGE12_PAYMENTS_PLAN.md` (the 2026-11-17 owner block near the
top). Status lives on the board (`docs/agents/strategy/OWNER_BRIEF_PROJECTS.json`, project `payments`). Online payments stay
off in production throughout.

**Repo rules first:** an implementation plan and a **plain-language UX summary for the owner before any code**
(AGENCY_RULES). Re-read the code before relying on anything below; it is from a census of 2026-11-17.

## Part A — the refund policy is required (owner ruling 2026-11-17)

**What the terms promise (§6):** "Your owners write your refund policy on the Payouts card before online payments start,
and payers see it beside the Pay button before they pay."

**Today:** optional (ruling A9). It is edited on the Payouts card (up to 300 characters; the payouts route's
`refundPolicy` update; `lib/online-payment-words.ts` `policyLabel` / `policyHint` / `policyPlaceholder`). Pay shows without
it, and the "Refund policy" link beside Pay is absent when it is blank (`lib/team-pay-view.ts`, `lib/league-pay-view.ts`).

**To build (propose, then confirm in the UX summary):**
1. The policy is asked for in **"Before you set up payouts"**, beside the terms tick. You cannot continue to Stripe with it
   blank. It is still editable on the Payouts card afterwards, but cannot be cleared.
2. **No pay page opens without a policy.** A connected club with none, which today is only dev and walk clubs, sees "How to
   pay" instead of Pay, plus a Needs-attention item for the owner, until it writes one. Reuse the existing "paused" pattern,
   not a new one.
3. The "Refund policy" link beside Pay is always present once payments are on.
4. Where the policy's words sit in the payer's flow before they pay (the pay page, and whether Stripe Checkout shows it):
   state what is true in the UX summary.
5. ⚠ **The full payout test runs on or after 2026-11-25 on UAT Rep Club** (payments made 2026-11-17). Give that club a
   policy, or make sure the new gate does not disturb the test's landed payouts. Say which in the summary.

## Part B — the payments-terms agreement record is kept, every version, for six years

**What the terms promise (§15):** "We record who agreed, when, and to which version, and keep that record for at least six
years after your account closes."

**Today:** the agreement is four columns on the club's one payouts row (mig 358:50-53: `terms_version`, `terms_agreed_by`,
`terms_agreed_by_email`, `terms_agreed_at`). Agreeing again **overwrites** the earlier agreement, and the row is **deleted
with the organization** (`ON DELETE CASCADE`, mig 358:61). The audit-log row (`payouts_connected` /
`payouts_terms_agreed`) is the only history.

**To build:**
1. An **append-only** record of every payments-terms agreement: the organization's id and its name as text at the time;
   the account id and email as text; the version; the exact checkbox sentence shown; the time; and which action it came
   with (setting up, agreeing again, reconnecting, changing who pays). **No IP address**, matching the Terms of Service
   acceptance record. It must **outlive the organization**: no cascade, and organization deletion leaves it in place.
2. Model it on the Terms of Service acceptance record (mig 455, "every tick is kept"). Read that migration and its tests
   first, and decide with `/dba` whether to extend that table or add a sibling. Say which in the plan, and why.
3. The payouts row may keep its columns as the current standing (the "Agreed by … version of …" row reads them), but the
   append-only record is the evidence. Backfill it from existing rows (dev and walk clubs only).
4. A record of the **six-year** rule: no purge exists, so none is needed now. Note it in the data dictionary with the
   retention.
5. Also check `GST_HST_STAGE6_TERMS_PLAN.md` ~L247-249, which said `connect` checks the tick but not the version. Confirm
   that the version shown is the version recorded, and fix it if not.

## Part C (small, same window) — Québec

Setting up payouts does not check for a Québec billing address (`lib/billing-location-server.ts:277-280`). The terms
(§14, and Terms of Service §17) say online payments are not offered in Québec. Refuse setting up payouts with a Québec
billing address, in the same words and pattern as the plan-purchase refusal.

## Close-out

- **Schema = dictionary, same unit of work:** `docs/agents/db/DATA_DICTIONARY.md` + `npm run refresh:snapshots`. Apply the
  migration to dev only; the production apply rides the release (`MANUAL_PROD_STEPS.json`).
- **`/legal` light review before hand-off:** the Before window's new words, the paused state's words, the record's fields
  against §15.
- `/review` offered; `/docs` offered (the Payouts help mentions the refund policy as optional).
- Update the board line and the Stage 12 plan in the same commit. Stage explicit pathspecs only (shared working copy).
- Mark the payments terms draft's "Before this can be published" items 3 and 5 done, with the commit hash.
