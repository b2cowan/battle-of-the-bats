# Club Tier Stage 12a: schema review (/dba, review only, 2026-10-25)

Scope: the five new tables and three altered ones in the 12a draft (next migration 358). Nothing was written to any database
and no migration exists yet. Columns were decided from the dev snapshots (`docs/agents/db/schema-snapshots/`, watermark 357),
not from migration files; migration files were read only for lock order, function bodies and seeds.

Verdict: **sound with changes.** The shape is right (one side table per concern, org-scoped, server-only). Eleven changes below
are needed before 358 is written; the four that would have shipped a defect are marked **FIX**.

## 0 · Findings that change the draft

1. **FIX: `online_payments.team_id` / `tournament_id` with "SET NULL" cannot carry a `CHECK (flow='tournament_team' -> both NOT
   NULL)`.** The FK action would violate the check and block the team delete. Use SET NULL and no such check; the creating
   function validates, and a frozen `description` keeps the receipt readable after the link is gone.
2. **FIX: a refund can start in Stripe's own dashboard** (Express dashboard is on, A1/§0c). `charge.refunded` then arrives
   with no `online_payment_refunds` row of ours. Add `origin text CHECK ('app','stripe_dashboard')` and make `created_by`
   nullable; the refund-landing function handles both origins identically.
3. **FIX: `online_payment_refunds.created_by NOT NULL` + FK to `auth.users` is a trap.** It forces NO ACTION and blocks deleting
   a user. Mig 345's idiom is nullable + ON DELETE SET NULL. Use that.
4. **FIX: a landing that cannot complete must not lose the fact that Stripe took the money.** Examples: the team was linked as
   "our team" after the session opened (`tournament_team_payment_record` raises "Our team has no entry fee"), the day is
   inside a closed fiscal year (see (b)), the team was deleted. A throw makes the webhook 500, Stripe retries for days, and
   the log shows nothing useful. Add `landed_at timestamptz` and `land_error text` on `online_payments`; the webhook handler
   marks `paid` + `land_error` in its own step when the landing function throws, and raises a Needs attention item. (Landed =
   a `tournament_team_payments` row points at it; `landed_at` is the cheap read.)
5. Drop `online_payments.application_fee_amount`: the draft's own CHECK makes it equal to `fee_amount`, so it is one fact in
   two homes. Keep `fee_amount` (the all-in fee, which is the application fee).
6. Drop `online_payments.team_payment_id`. It would form an FK cycle with `tournament_team_payments.online_payment_id`. The
   pointer lives on the destination row (below, and it is the pattern 12b needs).
7. `receipt_no`: a global identity column numbers every open or expired Checkout session across all tenants, so a family sees
   gaps and a club sees the platform's volume. Make it a nullable `bigint` taken from a plain sequence **at landing** (paid
   payments only), `UNIQUE`; display formatted in TS.
8. `online_payments.org_id` is the only tenant key and is fine (direct `org_id`, FK to `organizations`, indexed).
   `stripe_account_id` is deliberately not an FK (the account row may be gone after a disconnect; the payment keeps the id it
   was taken on).
9. `stripe_connect_events` as drafted does not stop two concurrent deliveries (second sees `processed_at` still null).
   Correctness must live in the landing functions' row locks; the log is a short-circuit plus an audit trail.
10. Add `currency char(3) NOT NULL DEFAULT 'CAD' CHECK (currency='CAD')` to `online_payments` (ledgers are CAD-only; a later
    currency is then a visible, deliberate change).
11. A partial unique index `(team_id) WHERE status='open'` makes a double press reuse one session instead of opening two that
    could both be paid (12d's "paid twice" then needs no 12a help). Duty on the pay route: expire a stale open session (older
    than the session lifetime) before creating a new one, or the team is blocked if the expiry webhook is missed.

## 1 · Corrected table list

All: RLS enabled, `REVOKE ALL ... FROM anon, authenticated`, `GRANT SELECT, INSERT, UPDATE, DELETE ... TO service_role` in
the same migration (Finding #43), explicit constraint names, `IF NOT EXISTS`. Every new function: `SECURITY DEFINER SET
search_path = public`, `REVOKE ALL ... FROM PUBLIC, anon, authenticated`, `GRANT EXECUTE ... TO service_role`.

### 1.1 `org_payment_accounts` (1:1 with organizations; PK `org_id`)
As drafted, plus:
- `country char(2)` (Stripe account country; read from Stripe, never typed).
- `terms_agreed_by_email text`: `terms_agreed_by` is ON DELETE SET NULL, which would erase who agreed; counsel will want the
  evidence to outlive the user. CHECK `terms_version`, `terms_agreed_at`, `terms_agreed_by_email` all null or all set.
- `connected_by` / `disconnected_by` / `terms_agreed_by` FK `auth.users` ON DELETE SET NULL.
- CHECK `fee_payer IN ('family','club')`, `refund_policy IS NULL OR char_length(refund_policy) <= 300`.
- `stripe_account_id` UNIQUE NOT NULL (the unique index serves the `account.updated` lookup).
- A live/test switch is a new account id: replace the row through one function; payments keep their own `livemode`.
- Write connect, disconnect, fee-payer change and terms agreement to `org_audit_log` (exists: id, org_id, actor_id,
  target_id, action, payload, created_at). The row holds only the current state; the fee-payer history matters because it
  decides what a family was charged.
- Derived card state in TS is fine (not set up = no row).

### 1.2 `online_payments`
Columns: `id uuid PK`; `org_id` FK organizations CASCADE (indexed); `stripe_account_id text NOT NULL`;
`flow text NOT NULL CHECK ('tournament_team')`; `tournament_id` FK tournaments **SET NULL**; `team_id` FK teams **SET NULL**;
`scope text CHECK ('deposit','balance','full')`; `description text NOT NULL` (frozen line: event, team, what it paid, so the
receipt and the Stripe line survive a deleted team); `payer_email text`; `base_amount numeric(12,2) CHECK (>0 and <=1000000)`;
`fee_amount numeric(12,2) CHECK (>=0)`; `total_amount numeric(12,2) CHECK (>0)`; `fee_payer CHECK ('family','club')`;
`fee_pct numeric(6,4)`, `fee_flat numeric(12,2)` (the rate used; stored data, not a restated rate); `currency` (above);
`rail text CHECK ('card')`; `status CHECK ('open','paid','expired','refunded')`; `livemode boolean NOT NULL`;
`stripe_checkout_session_id` UNIQUE; `stripe_payment_intent_id` UNIQUE; `stripe_charge_id`; `card_brand`; `card_last4`;
`receipt_no bigint UNIQUE` (item 7); `paid_on date`; `paid_at timestamptz`; `landed_at`; `land_error`; `receipt_emailed_at`;
`created_at`, `updated_at`.
Checks: `(fee_payer='family' AND total_amount = base_amount + fee_amount) OR (fee_payer='club' AND total_amount = base_amount)`;
`status IN ('paid','refunded') -> paid_at IS NOT NULL AND stripe_payment_intent_id IS NOT NULL`.
Indexes: `(org_id, created_at DESC)`; `(team_id) WHERE team_id IS NOT NULL`; `(tournament_id) WHERE tournament_id IS NOT NULL`;
`(created_at) WHERE status='open'` (expiry sweep); unique `(team_id) WHERE status='open'` (item 11).

**`online_payment_items`: defer to 12b. Recommendation: do not build it at all unless 12b proves it needs it.** In 12a every
payment pays exactly one team, so an items table would hold one row per payment, with an invariant (sum of items = base) nobody
reads or tests. The destination row already is the item: `tournament_team_payments.online_payment_id` points back at the
payment. House league families paying several children is the same pattern, many destination rows carrying one
`online_payment_id` (a plain FK, not unique, on the 9b-2 fee row). If 12b finds it needs a per-child amount that the fee row
cannot hold, the table is additive then. This corrects the plan's §4 line, which lists it in 12a and says 12b needs no
migration.

### 1.3 `online_payment_refunds`
As drafted, plus `origin text NOT NULL CHECK ('app','stripe_dashboard')`; `failure_reason text`; `created_by` nullable SET NULL
(item 3); `amount > 0`, `application_fee_refunded >= 0`, `processor_kept >= 0` (defaults 0); `succeeded_at IS NOT NULL <->
status='succeeded'`. FK `online_payment_id` ON DELETE RESTRICT (a refund record is never cascaded away by deleting a payment);
`org_id` CASCADE; both entry FKs to `accounting_entries` NO ACTION (the repo idiom), ON DELETE SET NULL is not needed because
lines are voided, never deleted. Indexes: `(online_payment_id)`, `(org_id)`, `stripe_refund_id` UNIQUE.
One live refund per payment: `UNIQUE (online_payment_id) WHERE status IN ('pending','succeeded')`. 12b's partial refunds will
drop and recreate that index; name it so the change is obvious. The checks that tie `application_fee_refunded` to the payment's
`fee_amount` need the other table, so they belong in the landing function, not a CHECK.

### 1.4 `stripe_connect_events`
`id text PK`, `type text NOT NULL`, `account text`, `livemode boolean`, `org_id uuid` (no FK; the log outlives the org),
`received_at timestamptz NOT NULL DEFAULT now()`, `processed_at`, `attempts integer NOT NULL DEFAULT 1`, `error text`.
Index `(received_at)` for pruning (keep ~90 days; there is no payload, so no personal data) and a partial index
`(received_at) WHERE processed_at IS NULL`. Handler: INSERT ... ON CONFLICT DO NOTHING, then `SELECT ... FOR UPDATE`, skip if
`processed_at` set. On `account.updated`, re-fetch the account from Stripe rather than trust the payload (events arrive out
of order; the fetch makes order irrelevant).

### 1.5 `tournament_team_payments` (alter)
- `ADD online_payment_id uuid REFERENCES online_payments(id) ON DELETE RESTRICT`, partial UNIQUE `WHERE online_payment_id IS
  NOT NULL`.
- Method CHECK adds `'online_card'`; status CHECK adds `'refunded'`. Names in the snapshot are `tournament_team_payments_method_chk`
  and `_status_chk` (the dump lists no CHECKs; take the names from mig 345).
- **Every reader already filters `status='posted'`** (`team_payments_refresh`, `listTeamPayments`,
  `listPaymentsByTournament`, the check-in undo, mig 346's guard). So a `refunded` row is invisible to the paid figure, which is
  the ruling. It is also invisible to the team record's payment list: the code must read `posted` and `refunded` there to show
  "Refunded to card", or the row disappears instead.
- Hand-path functions: `tournament_team_payment_pay_due` re-derives "due" from `posted` rows, so Mark paid after a refund
  correctly asks for the full amount again.

### 1.6 `teams` (alter)
`pay_link_sent_at timestamptz`. Fine: teams already carries the payment cache, and this is a per-team "last sent" fact. No
token column: derive the pay token by HMAC of the team id with a server secret (no schema, nothing to leak or rotate per row).

### 1.7 `notifications`
No table change (no CHECK on `event_type`; the snapshot has FKs and the pkey only). See section 3.

## 2 · Item 5: trigger or replace change/remove?

**Use the trigger. Do not CREATE OR REPLACE `_change` / `_remove`.**
- Replacing them means copying two long mig-345 bodies; any other session's edit to them is silently lost, and a
  function-only change is invisible to the drift check (the "ALTER FUNCTION blind spot" in the release record).
- A function guard protects only those functions. The app holds the service role, which has UPDATE on the table; the trigger
  closes every path, which is the point of a money row that came from Stripe.
- Transaction-local setting is sound with these rules:
  1. `set_config('flhq.online_payment_write','on', true)` (local), and **reset to `'off'` before the function returns**, so a
     caller wrapping the function in a larger transaction does not leave the door open.
  2. The trigger is `BEFORE INSERT OR UPDATE`, **never DELETE**. `teams`, `tournaments` and `organizations` cascade into
     this table; a DELETE guard would block deleting a team. (Team and tournament deletes of paid online payments should be
     refused in the delete routes, `app/api/admin/teams/route.ts` lines ~380 and ~817 and `lib/db.ts` ~343, until refunded.)
  3. Without the flag, refuse: INSERT of a row with `online_payment_id` or `method='online_card'`; UPDATE that sets either on a
     row that lacked it (so nobody forges an "Online, card" row by hand); any UPDATE of `amount`, `paid_on`, `method`,
     `team_id`, `online_payment_id`, `entry_id` or a status change on a row where `OLD.online_payment_id IS NOT NULL`;
     any move out of `'refunded'`. Key off `online_payment_id`, not `method`, so the landing's own stamp UPDATE (method null
     -> online_card) is the one allowed transition.
  4. Trigger function: SECURITY INVOKER, `SET search_path = public`, EXECUTE revoked. The route also pre-checks and answers
     in words ("Refund this to the card instead"); the trigger is the backstop, not the message.
  5. Keep `tournament_team_payment_record`'s hand-only method validation (as the draft says). The landing passes method NULL,
     then stamps.
- **Lock order.** Mig 345's header: tournament row (`club_tournament_fee_word`, only when the fee book is on) -> team rows (id
  order) -> ledger line; the payment row is inserted last. Both new functions must take: unlocked read of the online payment
  (for team and tournament ids) -> tournament (when the book is on) -> team `FOR UPDATE` -> **online_payments row `FOR UPDATE`
  (re-check status)** -> refund row -> ledger lines. **Never lock the online payment before the team**: the refund path and
  the landing path would then take the two locks in opposite orders. The `_change` / `_remove` pair take team -> ledger line
  with no tournament lock and never touch online rows (trigger), so they cannot collide with this order. The pay route's
  `INSERT INTO online_payments` takes `FOR KEY SHARE` on the tournament and team rows, which a `FOR UPDATE` blocks briefly;
  it holds nothing else, so it cannot deadlock.
- Refund landing must not call `_remove` / `_change` (they void the receipt line; the ruling is that the book keeps the
  receipt and gains a money-out line). It sets `status='refunded'` itself under the flag, then `team_payments_refresh`.

## 3 · Item 7: the two new Needs attention kinds

Confirmed. There is **no CHECK on `notifications.event_type`**, so the only database requirement is the two partial indexes,
because their predicate lists every Needs-attention kind. Currently 12 kinds (snapshot `notifications_user_needs_attention_idx`
and `_org_`); with the two new ones 14. Precedent is **mig 338** (drop and re-create both, same columns, one-plus kinds), which
itself followed mig 332. Required in the same unit of work:
1. Add both kinds to `NotificationEventType` and to `NOTIFICATION_CATEGORY` as `'act'` in `lib/notification-labels.ts`; add a
   resolver for each in `lib/needs-attention.ts` (a kind with no resolver never clears).
2. Mig 358: `drop index if exists` + `create index` for both, predicate = the 14 kinds, built inside the transaction like 338.
3. `tests/unit/needs-attention-clears-itself.test.ts` hardcodes **mig 338** as "the newest definition" (line ~97) and a sorted
   kind list (line ~26): point it at 358 and add the kinds, or the build fails.
4. The indexes are invisible to the drift check: declare 358 in `supabase/migrations/MANUAL_PROD_STEPS.json`.
5. Insert-once per (org, user, kind) is an app duty (webhook handler, under the event row lock); PostgREST cannot upsert
   against a partial unique index, so do not add one. `payment_failed` (subscription billing) already exists as a kind: the
   new names do not collide, but keep the labels clearly different on the bell.

## 4 · Answers

### (a) Book filing
- **A platform out-word that fits the cost exists:** `League & Fees > Bank & payment fees` (seeded by mig 241 with
  `org_id NULL`, direction `out` by mig 243/246; platform categories scope `both`). There is **no** "Refunds" word and **no**
  "Payment processing" word. The hosted-event shelf (mig 344, `club_hosted_event_add_words`) has money-out words Permits &
  fields, Officials, Awards, Supplies only, and applies to new events only (old shelves are deliberately not healed).
- `club_fee_post` writes income only, hard-coded `category='registration_fee'`; there is no money-out poster. The money-out
  line needs a new small poster (or an inline INSERT) with `entry_type='expense'`, `category NULL`, a budget word on the
  line's own side (gotcha 9: money out files under an `out` word).
- **Recommendation: add two standard words in mig 358 with FIXED ids, exactly like mig 317's "Team support" (fixed uuids,
  a TS constant, `scope='org'` so no coach picker offers them): a platform category "Online payments" (`scope='org'`) holding
  `Payment processing` (out) and `Refunds to payers` (out).** Reasons: (1) the plan already calls the cost line "Payment
  processing"; "Bank & payment fees" lives under League & Fees, whose `both` scope would also put the new word in every
  coach's picker; (2) a name lookup of a platform word is fragile, fixed ids are not; (3) a line left "Not filed" shows as
  an unfiled line on the Statement and nags the treasurer on every online payment. Filing it keeps it out of that list.
  Resolvability is not a risk: `resolveOrgBudgetItem` accepts a standard word on a club book.
- **Refund as an expense line: yes, correct under the standing rulings**, not negative income. The 7a ruling
  (`memory/design_decisions.md` ~L266, "a refund is a separate typed money-out line") and the §0c ruling say it, and it is
  forced by the ledger: `amount > 0` always (gotcha 1) and the original receipt stays posted. House league **voids** the fee
  line on end (`club_league_fee_end`), a different convention; 12a tournaments follow 7a, not that. The coach side nets
  refunds inside dues statements (`rep_season_refund_adjustments`), a separate world. No tournament money-out poster exists in
  code yet (grep found none), so this is new, not reused.
- Dates and direction: the refund line is dated **today (Toronto)**, `entry_type='expense'`, amount = what went back to the
  payer; the processing cost line is `expense`, dated the day it is incurred (landing day in club-pays mode; refund day for
  the kept share). Both only when `tournament_fee_book_on` is true; otherwise the facts live in `online_payments` /
  `online_payment_refunds` (`processor_kept`, `fee_amount`) and the entry id columns stay NULL. Who bears `processor_kept`
  (club vs FieldLogicHQ, given §0c says FLHQ pays Stripe's fee from the all-in fee) is a `/billing` call; the schema stores the
  figure either way and posts a cost line only when it is above zero.

### (b) Fiscal-year lock (mig 318)
It does not block refunds, and it protects the receipt: the trigger refuses insert/edit/void of a line on a club-owned book
(tournament books included) dated on or before `club_books_closed_through(org)`. Because the refund is a new line dated today
and the original is never voided, a refund of a closed-year payment works. **It does interfere in two places:**
1. **The landing.** If the webhook arrives after the year closed (a payment taken on the last day, webhook late or retried),
   `paid_on` would sit in the closed stretch and `tournament_team_payment_record` raises `year_closed`. Landing must
   compare the real paid day to `club_books_closed_through` and, when inside it, land dated today (the same idea as the
   pending-line `written_on` exception); the real time stays in `online_payments.paid_at`. Also clamp to today (record refuses a
   future date).
2. **The stamp UPDATE of `accounting_entries.payment_method`** after `record()` is an edit of a posted line; it is only safe
   because the line is dated today/open year by the rule above. Do not stamp an older line.
`_remove` / `_change` (voiding) would trip the lock for an old online row, which is another reason refunds must not use them.

### (c) `teams` ON DELETE for `online_payments`
**SET NULL on `team_id` and `tournament_id`; keep `org_id` CASCADE; freeze `description`.** CASCADE would erase real payment
records that Stripe and the connected account still hold. Note that `tournament_team_payments` already cascades with its
team (mig 345), so a deleted team's payment rows and its ledger-line link go; the receipt line stays in the book. Combine with an
application refusal: a team (or tournament) with a `paid` online payment is not deletable until refunded, so the SET NULL
should be rare. The refund-landing function must tolerate a null `team_id` (no payment row to flip, still post the book
lines). Org deletion: CASCADE is the repo idiom, but "Delete organization" should refuse while any `online_payments` row is
`paid` or `open`; a Stripe-liable connected account cannot simply vanish, and webhooks for an unknown account must be
acknowledged and ignored.

### (d) Conflicts with the dictionary and snapshots
- No name collisions: no table matches `online_payments`, `org_payment_accounts`, `online_payment_refunds`,
  `stripe_connect_events`; no `pay_link_sent_at`, `online_payment_id`, `receipt_no` column exists; `stripe_*` columns exist
  only on `organizations` (customer, subscription), `team_workspaces`, `team_entitlements`, plus the table `stripe_prices`.
- The dictionary's `tournament_team_payments` method list reads `etransfer/cash/cheque/card/other`: `card` is a hand-recorded
  card. `online_card` beside it is distinct, but the two labels must be worded apart on screen ("Card", "Online, card").
- The dictionary line on `accounting_entries.payment_method` says free text up to 100 chars; use a house word, not the
  database value (`Online, card`).
- `teams.fee_book_baseline` / retired receipt tables are untouched.
- Dictionary + snapshots in the same unit of work (`npm run check:dictionary`), including `status` gaining `refunded`, the
  `method` list, and `accounting_entries.source_module` gaining the values the refund and processing lines use
  (suggest `'online_payment'` for both, `source_entity_id` = the online payment or refund id).

## 5 · Findings to log in `DB_ARCHITECTURE_REVIEW.md` once the owner accepts

(Not appended here; this was a review-only pass.)
- Medium: the landing must survive a function failure after Stripe has taken the money (item 4).
- Medium: a refund can originate outside the app (item 2).
- Low: global identity receipt numbers across tenants (item 7).
- Advisory: `org_payment_accounts` terms evidence must outlive the user row.
