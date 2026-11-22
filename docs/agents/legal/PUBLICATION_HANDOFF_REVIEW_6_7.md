# Publication hand-off review — Terms of Service and Privacy Policy, version 2026-11-17 (GST/HST Stage 6, step 6.7)
**Last verified:** 2026-11-17
**Re-verify by:** the promote that carries `LEGAL_PAGES_PUBLISHED = true`; or any edit to a published version
**Depends on facts:** `LEGAL_FACTS.md` (business, roles, suppliers); production = `origin/master` `f12aad4d9` (the 2026-11-15 promote), read from git on 2026-11-17

## Question(s) this answers
The owner's six hand-off questions for commits `b891e6bbb`..`da5e0c407` (frozen texts, features the Privacy Policy describes,
Terms §6, help and support@, the effective date, the existing-accounts screen). Report and recommend only; nothing changed except this record.

## Finding
1. **Frozen texts = approved 0.3 text. Pass.** The real draft filter was run on the last approved drafts (blobs at `b891e6bbb`, unchanged
   through `ce2aee441`); the output equals both frozen files word for word (only double blank lines squeezed). No leftover owner marker,
   no blank fact, no bracket that is not a link, both sha256 values in the registry match the files. Contact is email only: Terms §1
   (support@), Privacy §2 and §15 (privacy@); the only phone number is the Privacy Commissioner's. The texts carry no date at all: the
   page shows "Effective <date>" from the version name.
2. **The "dev-only" list is partly wrong, and one item is missing.** Read from git (`origin/master` against `da5e0c407`) and from
   `MANUAL_PROD_STEPS.json`:
   | Policy sentence | On production today | Needed for the release |
   |---|---|---|
   | House-league friend requests (§5, §9) | **Yes** — code, tables and the nightly clean-up (mig 472) shipped 2026-11-15. Reachable only by a club with house league (Club not on sale) that turns it on | Nothing |
   | Families' answers and notes + reminder (§5, §9) | **Yes in code and database** (migs 476–485 applied 2026-11-15), but **inert**: every entry point refuses while `GUARDIAN_TIER_ENABLED` is not `'true'` (default off). Whether the live Amplify setting is unset was not read (unconfirmed) | Nothing; keep the tier off until the guardian-consent conditions in `GUARDIAN_CONSENT_STAGE4.md` are met |
   | Bell lines (§9, last bullet) | **Yes** (in-app notes); dev only reworded how they open. "No end date today" is true on both | Nothing |
   | Deleting an organization removes its files (§9) | **No** — `45c134bea` is dev only; code only, no migration | **Must ship in the same release**, or §9's "and the files uploaded to it" is untrue |
   | **Not on the owner's list:** a club's emails to coaches and the board, the Communications place, and the nightly clearing at 12 and 24 months (§5 "Emails a club sends", §9 "Emails a club sends") | **No** — `95cac82d6`, `684ee0b38`, `817c95523` are dev only; migs **492 and 493 are pending** on production | Ship with 492 and 493 applied first and the nightly job read back as active (the spec's own release gate, `CLUB_COMMUNICATIONS_STAGE1.md`), **or** cut the coach/board sentences and the 12/24-month bullet. Today production keeps club email words with no clearing |
3. **Terms §6 "shown before you pay": holds today — the plan is out of date.** Taxed checkout is on production since 2026-11-15: every
   plan-checkout route carries automatic tax, the address step and the tax lines (`lib/billing-tax.ts` on `origin/master`), and the
   Québec refusal (6.4) is there too. Live Stripe Tax was re-checked read-only on 2026-11-17 (`bb24b860a`). Read from code, not walked on
   live (nothing has been sold). **What §6, §7, §8 and §16 rest on that is NOT on production** is the 6.6 fixes: the yearly reminder that keeps its
   date, amount and cancel line (`a9d559062`, **mig 490 pending**) — §8's 30-day promise depends on it; the purchase email's "The Terms of
   Service for this purchase" line (`b7dcab3ea`); the move-up-during-a-trial email (`873fc7c76`). Mig **455 is already applied** to production (2026-11-15); the commit message's "455/490 first" should read "490 first".
4. **Help answers and support@ match the Terms.** Both answers agree with Terms §16, §18, §20 and Privacy §3, §9 (version at its own address,
   the box at sign-up, the one-time screen, 30 days' notice to every owner, "Before you continue", six years, no IP address, an owner of a
   paid plan may cancel instead). support@ is named at Terms §1, §3, §12 and §19; the product's one contact constant is support@, and walk
   §533 confirmed support@, hello@ and privacy@ all receive mail. One soft tension, approved text, leave: §1 "We reply to each message" against §12 "we do not promise a response time".
5. **Effective date = release day: sound, if the rename is a checked step.** Nobody can accept on production before the promote (the
   switch is off there), so a version named for the promote day is clean. Date-bound things: the six date strings in `lib/legal-documents.ts` and
   the two file names (the sha256 does not change); the page's "Effective" line and every link a purchase email carries (so: **never rename after
   production serves it**); dev-side acceptance rows and fixtures hold the old name (dev only, re-seed). Not obvious: **Terms §18's 30-day notice for a
   later significant change needs the `upcoming` field that `lib/legal-documents.ts` defers** — until it is built, the first change after release can only be
   a small one.
6. **The existing-accounts screen.** (a) It reaches every existing account except staff and the two demo accounts, at the next sign-in; the
   box includes "I'm 18 or older", so it is retroactive for follow-nudge and registration-made accounts that may belong to under-18s (census O5) — the
   untrue tick binds no one and Privacy §8 says "do not knowingly", so accept, and revisit before the follow nudge is promoted. (b) The cancel
   door shows only on "We've updated our Terms", never on "We've published our Terms": fine while nothing is sold; **if any paid owner exists at the
   promote, they meet a gate with no way to cancel from it** — check for paid, comped or Founding owners at the promote. (c) Dev acceptances
   do not travel; but `LEGAL_PAGES_PUBLISHED` is now a source constant true in every environment, so a fixture script pointed at production writes a
   `door = 'fixture'` row claiming a tick nobody made. Count `fixture` rows out of any evidence. (d) Six-year retention is a conservative choice (Ontario's
   basic limitation period is two years, the ultimate fifteen; not re-researched).
7. **Standing exposure, unchanged by publication:** email-only contact means an individual coach buyer can cancel within 7 days of the copy and be
   refunded until the phone and premises address are given (O. Reg. 17/05 s. 32 item 2; see `ONTARIO_CONSUMER_INTERNET_AGREEMENTS.md`). Coach Premium is already purchasable on production.

## Owner rulings (2026-11-17)
- **Club Communications ships in the same release** (with migs 492 and 493 applied first and the nightly clearing read back as active), so the coach/board sentences and the 12/24-month bullet stay. `45c134bea` and the 6.6 fixes with mig 490 ship in the same release too.
- **No paid, comped or Founding owner exists** at the promote, so the published screen's missing cancel door is not an exposure; the release session still confirms it on the day.
- **Records corrected:** Stage 6 plan §2 row 6 and §6.7 "release carries", and `LEGAL_FACTS.md` (friend-request note, family-answers migs line). Still open, owner's later call: the next-draft preview workflow, the retroactive age tick, the 30-day `upcoming` field.

## What the product does today
Checked against git (`origin/master` and `da5e0c407`), `MANUAL_PROD_STEPS.json`, the frozen files, `lib/legal-acceptance-rules.ts`,
`lib/legal-pages-switch.ts`, the help diffs. Not checked: live Amplify settings, a live checkout, any browser behaviour.

## Recommendation
- Ship in the same release: `45c134bea`; the 6.6 fixes with mig 490; Club Communications Sessions 1–2 with migs 492 and 493 (or cut the named sentences).
- Release-day gates, as checklist lines: rename-if-not-today; no paid owner without a cancel door; read `GUARDIAN_TIER_ENABLED` unset on production.
- Records to correct once the owner rules: Stage 6 plan §2 row 6 and §6.7 "release carries" (taxed checkout and mig 455 are already on production); `LEGAL_FACTS.md` lines 49, 66–70 and 109–113.

## Sources
Repo only (git history, migration record, product files named above) — read 2026-11-17. No external source was opened.

## Lawyer's eye needed?
Not as a gate. When the owner chooses: the §1 reply promise against §12; §11 refusing a refund where a chargeback is a dispute; the retroactive age tick; the 6-year acceptance record.
