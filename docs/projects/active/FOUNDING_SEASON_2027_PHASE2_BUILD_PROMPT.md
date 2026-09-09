# Founding Season 2027 — Phase 2 build prompt (the platform-admin Founding Season desk)

Paste the block below into a fresh chat. It is self-contained. Written 2026-09-07 after Owner QA §150
passed (73/73). Runs in PARALLEL with the Phase 1 chat (`FOUNDING_SEASON_2027_PHASE1_BUILD_PROMPT.md`)
— the ownership boundary inside the prompt is what keeps the two from colliding in the one shared
working copy. The Stripe production smoke test the plan listed as item 5 is DONE (owner-confirmed
2026-09-07; Stripe is live in production), so it is not in this prompt.

```
Plan and build Phase 2 of Founding Season 2027 — the platform-admin Founding Season desk: the
mechanism that lets the owner see every free account next summer, remind the ones with no card,
and convert or turn off each one on October 1, 2027 without a spreadsheet.

CONTEXT (do not re-derive; argue from the code if you think any of it is wrong):
- Ruling 2026-09-07 (BUSINESS_DECISIONS.md, same date): the free season for Tournament Plus and
  the Premium Coaches Portal runs THROUGH SEPTEMBER 30, 2027 for everyone who SIGNS UP BY
  DECEMBER 31, 2026. No second promotion. The September ask is a 2028 PLAN CHOICE, annual first,
  monthly available. Orgs that choose nothing drop to the free Tournament plan; coach workspaces
  that choose nothing are cancelled (a read-only window for them is ratified in principle, NOT
  built — decision D4 below). The card window opens JUNE 1, 2027. Unsettled money WARNS, never
  blocks. Under ~50 accounts the October turn-off is a hand-run runbook; over it, a job (that
  is Phase 3, decided by May 1, 2027 — you are building the desk the runbook will use either way).
- Phase 0 is built, walked (Owner QA §150, 73/73) and committed (2f02a949, 0b399e74, 69ebe04a).
  Read docs/projects/active/FOUNDING_SEASON_2027_PLAN.md in full — §2 has the verified facts
  (three live founding accounts on prod; nothing turns a comp off by itself; card-on-file lives
  ONLY in Stripe today; the January runbook was never written) and §3 Phase 2 is your scope.
- Stripe is LIVE in production and smoke-tested (owner-confirmed 2026-09-07).
- The recognition rules are in lib/plan-config.ts and lib/founding-season.ts: an org is founding
  when it holds an unrevoked comp_period override expiring on the Founding Season date (either
  the current or the legacy instant — FOUNDING_SEASON_COMP_EXPIRIES); a coach workspace when it
  is platform_override with that period end. The founding-season-status endpoint and the
  batch-email audience already read them — reuse, never re-derive. NEVER hand-type a Founding
  Season date; every label comes from plan-config.

SCOPE — five things. Plan first, then mockups, then build.

1. THE DESK — one platform-admin page listing EVERY founding account, orgs AND coach workspaces
   in one list: name, kind, free-period end, CARD ON FILE (yes/no/date), last activity, what they
   have done with it (events run / roster size), the billing contact, and their 2028 choice once
   made. Filters for "no card yet" and "no choice yet". Export. Establish from the live dev schema
   (npm run refresh:snapshots; never the migration folder) what already exists — org_overrides,
   team_workspaces billing fields, organizations.current_period_end, the retention queue and
   bulk-operations pages under app/platform-admin/ — before proposing anything new.

2. CARD ON FILE, RECORDED IN THE APP. Today it lives only in Stripe. Record it at webhook time
   (the setup-mode checkout / setup_intent path in app/api/billing/webhook/route.ts and
   lib/billing-setup.ts) so the desk can read it without a Stripe round-trip. Schema change =
   migration + DATA_DICTIONARY.md + refreshed snapshots in the same unit of work. Backfill what
   Stripe already knows for the existing accounts (read-only Stripe call; present the plan
   before running anything against prod).

3. CARD SAVING FOR COACH WORKSPACES. The "Add payment method" path (setup-mode Checkout, charges
   nothing) exists for orgs only (app/api/billing/setup-payment-method). Coach workspaces need the
   same door, gated to the card window (isFoundingSeasonCardWindowOpen) exactly as the org billing
   page is.

4. THE 2028 PLAN-CHOICE CHECKOUT. From June 1, 2027 a founding org or coach picks their 2028 plan
   — annual first, monthly available — using the saved card, and NOTHING IS CHARGED BEFORE
   OCTOBER 1, 2027. Propose the Stripe mechanics (a subscription with a deferred start, a trial
   ending on the first-charge instant, or a schedule) with the trade-offs, and say how a choice
   is recorded so the desk shows it. This replaces "add a payment method" as the summer ask on the
   billing page; the card-save door stays for accounts that want to save a card without choosing.

5. THE "NO CARD YET" REMINDER. A new audience for the batch-email tool (lib/email-sender.ts,
   app/platform-admin/email) — founding accounts with no card on file — with the account-notice
   framing the plan describes. You own the AUDIENCE and the tool; the Phase 1 chat owns the
   campaign COPY (lib/marketing-email-defaults.ts) — coordinate through the template KEY, not
   the file. ⚠ Nothing sends this autumn.

DECISIONS TO BRING ME (do not build them):
- D4: when does the coach read-only window get built, and what does a lapsed coach see until
  it is? Present the options; until it exists the coach copy stays on its fallback line.
- Whether account notices to founding accounts honour the MARKETING opt-out or bypass it as
  service messages. Argue it from what the code does today and from the customer's side.
- Anything in 4 that would charge, or could charge, before October 1, 2027.

OWNERSHIP — a Phase 1 chat is rewriting the campaign emails, the demos and help in the SAME
working copy at the same time. You own: app/platform-admin/** (a new desk page + nav entry),
app/api/admin/**, app/api/billing/**, lib/billing-setup.ts, lib/founding-season.ts,
lib/email-sender.ts (audiences only), lib/db.ts, the schema, and the org/coach billing pages'
summer ask. You do NOT touch: lib/marketing-email-defaults.ts, campaign copy in lib/email.ts,
the reseed migration, lib/demo-*.ts, lib/help-content/*.tsx, marketing pages. If your work needs
one of those, stop and say so. Claim your migration number at the moment you write the file
(ls supabase/migrations | tail) and re-check it right before you commit — Phase 1 claims one
too. Stage EXPLICIT PATHSPECS ONLY; never git add -A; before staging a shared file (TODO.md,
the ledger, the decisions log, DATA_DICTIONARY.md) diff it against HEAD and stage only your own
hunk. Confirm with the owner before committing. Do not push. Never master. Production data is
read-only through scripts/db-query.mjs --prod unless the owner approves a specific write.

REQUIRED:
- Plan + PM brief pair (FOUNDING_SEASON_2027_DESK_PLAN.md + _PM_BRIEF.md) and a TODO line, then
  the PM UX summary in the chat (AGENCY_RULES). Then MOCKUPS as a Claude Artifact — the desk at
  desktop width, the "no card yet" filter, the billing page's summer ask and the plan-choice
  checkout at TRUE SIZE, before AND after — and wait for approval before code. Form selects are
  dropdowns; required fields wear a plain asterisk; every table on the ladder (TABLE_AND_LIST
  _STANDARD.md) — a platform-admin table is on the standard, not exempt.
- Verification: npm test · npm run typecheck · npm run verify:changed · npm run check:migrations
  · npm run check:dictionary · a rendered check of every screen you touched that the sweep
  knows (npm run check:layout -- --list). Platform-admin screens are NOT in the sweep — say so,
  and measure the desk's phone shape by hand. State any check you skipped and why.
- Offer /simplify (new abstractions likely) then /review (high-risk: billing, webhook, admin).
- Owner QA: claim the next free § at the TAIL of docs/projects/active/OWNER_QA_LEDGER.md (never
  renumber) and build the walk as a checkable Claude Artifact (checkboxes, saved state, verdict +
  notes per step, Copy findings, the Sign-in-as card — the dev platform-admin account only,
  never a prod account). Seed the fixture so the walk has a founding org WITH a card, one
  WITHOUT, and a founding coach workspace — a walk over an empty list reports coverage it lacks.

TICK YOUR OWN BOXES AS THE WORK LANDS — do not ask me to, and do not wait for me.
This step lives on the run order at
https://claude.ai/code/artifact/5ef0163e-376a-48b1-834b-6c5bdd198546
To tick: Artifact tool, action "read", that url. Read the saved file it hands you IN FULL, add
the word checked to the input tag with the id below, and republish passing the same url. The
page's script only ever turns a box ON, so a checked written into the HTML sticks. Tick once
near the end of your session rather than after every box — and while you are in the file, true
up that step's own paragraph too: a positive fact with a commit hash, never "uncommitted". If
the publish is refused because somebody republished first, re-read and merge onto their
version. Never force.

⚠ Tick a box only when the thing it NAMES has actually happened, verified — not when you
believe it will. A box is a claim about the product, and this page is the only place I read
those claims back.

Step E2:
  e2a  Plan + PM brief written · mockups approved by the owner   ⚠ ONLY after I have approved
  e2b  Desk built · card on file recorded at the webhook · backfill plan presented
  e2c  Coach card-save · 2028 plan-choice checkout · "no card yet" audience — built, nothing charged, nothing sent
  e2d  D4 and the opt-out question brought to me                  ⚠ presented, not decided by you
  e2e  Gates green · /simplify + /review run · walk artifact written · § claimed
  e2f  Committed

⚠ e2g ("Walked, findings fixed, section closed") IS NOT YOURS — that is my walk. Leave it, and
remind me the walk itself is mine to do.
```
