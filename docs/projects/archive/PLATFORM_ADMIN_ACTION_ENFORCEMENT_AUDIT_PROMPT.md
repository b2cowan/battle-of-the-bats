# BUILD PROMPT — Platform-admin actions that don't actually do what they say

> Paste this whole file into a fresh chat. It is self-contained.
> Origin: found 2026-08-05 during the retrospective `/review` of the Club Shared Book
> (QA ledger §1.16). The club book itself was clean — this came out of it sideways.

---

## 1. The confirmed defect

**A platform admin cancels an org's subscription. The org keeps every paid feature, forever.**

The cancellation writes `subscription_status: 'canceled'`, `is_public: false`,
`billing_suspended_at`, and a suspension reason. It **never touches `plan_id`**. And every feature
gate in the product is `hasPlanFeature(planId, feature)` — a pure plan-rank lookup that **never**
consults `subscription_status` or `billing_suspended_at`. (Verified: the only reader of
`billing_suspended_at` anywhere in `lib/` or `app/` is `lib/team-checkout.ts`.)

So after cancellation the org still reads `plan_id = 'club'`, and all ~40 gated features — exports,
chat, the shared book, branding, automation — stay open. Retention/archival of tournaments runs
correctly; **entitlement does not.**

The in-app self-serve downgrade path does this correctly (`app/api/billing/downgrade/confirm/route.ts`
writes `plan_id: targetPlan`). The platform-admin cancellation does not. That asymmetry is the tell.

⚠ **Do not "fix" this by guessing.** What cancellation *should* do is a business decision, not an
implementation detail — see §4.

---

## 2. The defect CLASS — this is the actual assignment

> **An admin action whose UI promises a consequence that the data model never enforces.**

The write lands in a column, an audit row is written, the screen says it worked — and nothing that
gates behaviour ever reads that column. The action is *recorded* rather than *applied*. It is
invisible precisely because every surface reports success.

**Sweep all 51 routes under `app/api/platform-admin/**` plus their admin screens for this class.**
For each state-changing action, answer one question:

> *What does this write, and who reads that as a gate?*

If the answer to the second half is "nobody," you have found another one.

**Highest-suspicion cluster** (lifecycle / entitlement / access revocation — do these first):
`orgs/[id]/plan`, `orgs/[id]/cancel-subscription`, `orgs/[id]/delete`, `orgs/[id]/addons`,
`orgs/[id]/overrides`, `orgs/[id]/identity`, `orgs/[id]/transfer-ownership`,
`users/[id]/ban`, `users/[id]/delete`, `users/[id]/reset`, `users/[id]/revoke-sessions`,
`users/[id]/update`, `retention/process`, `retention/[recordId]/extend`,
`team-ownership-transfers/[linkId]/complete`, `plan-gating`, `plan-config`,
`product-catalog/feature-matrix/publish`.

Lower suspicion but still sweep: email templates, feedback, early-access, observability,
company-users, bulk-operations, the sandbox tick routes.

### Two live leads already found — verify or refute these first, they are not conclusions

1. **Ban may not evict a signed-in user.** `users/[id]/ban` sets Supabase's `ban_duration` (which
   blocks *new* sign-ins) but does **not** revoke existing sessions — and a separate
   `users/[id]/revoke-sessions` route exists, implying they are independent. Determine whether a
   banned user with a live session keeps working until their token expires, and for how long.
   Nothing outside one admin *display* page reads banned state, so the app itself never re-checks.
2. **`billing_suspended_at` gates only checkout.** A "suspended" org can still use the whole
   product; suspension currently prevents buying, not using. Confirm whether that is deliberate.

### What is NOT this class (don't pad the report with these)

- An action that deliberately only records something (notes, audit entries, feedback status).
- A setting whose reader exists but is plan-gated or feature-flagged off — that is a gate working.
- Anything where the consequence is enforced by an external system (Stripe, Supabase auth token
  issuance) rather than by our own column. **Say so explicitly** rather than reporting it — the ban
  case above is exactly this shape and needs the distinction drawn carefully.

---

## 3. Method — evidence, not inference

For every finding, the report must carry:

- **The promise** — what the admin UI (button label, confirm dialog, success toast, the
  "what this shuts down" summary) tells the operator will happen.
- **The write** — what actually changes in the database.
- **The reader** — the grep that proves nothing gates on it. *A finding without this grep is a
  guess.* Trace to the actual enforcement point, not to a type definition or a mapping function.
- **The blast radius** — who is affected and for how long (until token expiry? forever? until a
  nightly job runs?).
- **Severity** — weight by whether it costs revenue (entitlement kept after payment stops), leaks
  access (someone still in who should be out), or is merely cosmetic.

Be adversarial about your own findings: try to refute each one by finding the enforcement you
missed. Default to "not a finding" when you cannot prove the negative. **A false alarm here is
expensive** — it sends someone to change billing code that was already correct.

---

## 4. What you must NOT decide alone

The fix for the cancellation defect is a **business decision**, and there are at least four
defensible answers:

- demote to the free floor immediately;
- keep the plan but hard-block on `subscription_status` at the gate;
- grace period, then demote;
- read-only retention window matching the existing tournament-retention behaviour.

These differ in what a customer loses, when, and whether they can come back — that is pricing and
packaging territory. **Present the options with a recommendation and get the owner's ruling before
building.** Once ruled, offer `/strategy` to log it (there is a binding Business Decisions Log), and
reconcile anything you write against `docs/agents/strategy/PLAN_PRICING_FACTS.md`, which is the
canonical source for plan names, prices and gating — never restate a plan fact from memory.

Same rule for anything else the sweep turns up: **report first, rule second, build third.**

---

## 5. Deliverables

1. **A findings report** — the confirmed cancellation defect plus everything else the sweep finds,
   ranked by severity, each with the five pieces of evidence from §3. Include an explicit
   **"swept and clean"** list so coverage is provable, and name anything you deliberately did not
   examine.
2. **A plan doc + PM brief pair** in `docs/projects/active/` per the repo's documentation rule, once
   the owner has ruled on the fix. One-line summary in `TODO.md` linking to the plan — TODO stays
   high-level.
3. **A QA ledger section** in `docs/projects/active/OWNER_QA_LEDGER.md` if you build anything.
   ⚠ Note that entitlement changes are **hard to QA by clicking** — a cancelled org that still works
   looks identical to a working org. Say in the ledger *how* the owner can actually see the
   difference, or the section is theatre.

---

## 6. House rules (read before touching anything)

- Branch is **`dev`** — one shared branch for every agent. Confirm before committing; another
  session may have switched it.
- ⚠ **~65 files are uncommitted from four other sessions.** Stage **explicit pathspecs only**, never
  `git add -A`. Split mixed files hunk-level. After committing, `git show --stat HEAD` to confirm
  only your changes landed. **Commit only with the owner's explicit per-action OK.**
- ⚠ **The shared gate is currently RED through no fault of yours** — `npm run typecheck` fails on one
  unrelated in-flight file, and one sandbox unit test fails (1425/1426 pass). Both belong to another
  session. Establish that baseline before you start so you can tell your breakage from theirs.
- ⚠ **NEVER round-trip a source file through PowerShell `Get-Content | Set-Content`** — the ANSI read
  re-encodes every non-ASCII character and mojibakes the whole file. Use the Edit tool or bash, and
  check `git diff --stat` after any scripted rewrite.
- Bracketed route directories need `:(literal)` pathspecs (`[id]`, `[orgSlug]`) or git stages nothing.
- Billing/plan/auth code is **high-risk tier** — run `/review` on anything you build here, and expect
  the deterministic gate (`npm run typecheck`, `npm run verify:changed`) to run first.
- Don't restart the dev server without saying so; the owner has QA sessions queued against it.

**Report to the owner in product-owner voice**: what an admin believes they did, what actually
happened to the customer, what it costs, and what you recommend — not a tour of the code.
