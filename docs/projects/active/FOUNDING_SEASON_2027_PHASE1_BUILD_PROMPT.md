# Founding Season 2027 — Phase 1 build prompt (the autumn acquisition push)

Paste the block below into a fresh chat. It is self-contained. Written 2026-09-07 after Owner QA §150
passed (73/73) and the owner ruled the comparison table off `/pricing`. Runs in PARALLEL with the
Phase 2 chat (`FOUNDING_SEASON_2027_PHASE2_BUILD_PROMPT.md`) — the ownership boundary inside the
prompt is what keeps the two from colliding in the one shared working copy.

```
Build Phase 1 of Founding Season 2027 — the autumn acquisition push: the campaign emails, the
demos, the help, and one walk of the offer bar inside a demo.

CONTEXT (do not re-derive; argue from the code if you think any of it is wrong):
- Ruling 2026-09-07 (BUSINESS_DECISIONS.md, same date): the free season for Tournament Plus and
  the Premium Coaches Portal runs THROUGH SEPTEMBER 30, 2027 for everyone who SIGNS UP BY
  DECEMBER 31, 2026. Two dates, and they are separate: the signup window closes Dec 31, the
  free period ends Sept 30. No second promotion after the window. The September ask is a 2028
  plan choice, annual first. The card ask opens June 1, 2027.
- Phase 0 is built, reviewed, walked (Owner QA §150, 73/73) and committed (2f02a949, 0b399e74,
  69ebe04a). Every offer surface derives its words from lib/plan-config.ts — the instants,
  the labels (FOUNDING_SEASON_END_LABEL, _SIGNUP_CLOSE_LABEL, _FIRST_CHARGE_LABEL,
  _DECISION_MONTH_LABEL, _CARD_WINDOW_OPEN …) and the offer sentence helpers. NEVER hand-type a
  Founding Season date; the old world had two dozen hand-typed "January 1, 2027"s and that is
  the defect this project exists to end.
- Plan: docs/projects/active/FOUNDING_SEASON_2027_PLAN.md (§3 Phase 1 is your scope; read §1,
  §2 and §3b too). Copy canon: FOUNDING_SEASON_2027_OFFER_COPY.md (approved; append, never
  contradict). Stripe is LIVE in production and smoke-tested (owner-confirmed 2026-09-07).
- The pricing comparison table was REMOVED 2026-09-07 by owner ruling. If any email, demo line
  or help article says "compare all plans" or points at /pricing#compare, that is now wrong.

SCOPE — four things, in this order:

1. THE TEN CAMPAIGN EMAILS. Their defaults live in lib/marketing-email-defaults.ts; the LIVE
   send copy is the platform_email_templates row seeded by migration 179 (planned dates in 180),
   re-seeded by the migration-198 pattern (data-only; touches a row only while it is NOT
   operator-customised — a saved override always wins). They still describe the January 1, 2027
   cliff. Rewrite them against the summer-2027 calendar:
   - welcome + check-in: dates from the labels, the offer sentence from the helper;
   - a NEW three-step sequence: JUNE 1 "your free season ends September 30 — choose your 2028
     plan" (the card window opens the same day), AUGUST 1 nudge, MID-SEPTEMBER final notice;
   - RETIRE the Club and League spotlights (parked products) and "Club last chance";
   - welcome-email polish per the plan.
   Every date and price reads from config. Planned send dates (the 180 table) move with them.
   ⚠ /marketing writes the copy FIRST and the owner approves it in a Claude Artifact BEFORE you
   write the reseed migration — copy is a mockup gate here, not an afterthought. Brand voice
   canon applies (no "unlock", no superlatives; full plan names). ⚠ Do NOT send anything.
   The renewal and final-notice campaigns are hand-sent and must not go out this autumn.

2. THE DEMOS. Both sandboxes (riverdale-minor-ball, riverdale-ridge) run the real product, so the
   offer bar already renders on the marketing pages a prospect walks through to reach them.
   Establish from lib/demo-moments.ts and the tour data whether either demo has a pricing or
   offer moment (none was found 2026-09-07 — verify, don't trust). If a tour has one, add ONE
   arrival line on it from the canon. Otherwise say so and add nothing. Do not touch the coach
   demo's money narration — it is stale for other reasons and is its own job.

3. HELP. The platform-admin "batch marketing email" article describes the founding sends; check
   it after the rewrite. Then grep every help article (lib/help-content/*.tsx, keywords and
   searchText included) and every customer-visible string for "January 1, 2027", "Dec 31",
   "December 31, 2026", "Founding Season" and "compare all plans" — anything that hand-types a
   date or describes the old cliff or the removed table gets fixed in this unit of work.

4. THE OFFER BAR INSIDE A DEMO. The bar is marketing-path-only and a sandbox is an org, so by
   construction they never share a screen — but the sandbox banner and the bar publish sibling
   layout variables. Walk it in the browser: enter each demo from /demos and confirm no bar, no
   double chrome, no gap where the bar's height is still being reserved. Record the result.

OWNERSHIP — a Phase 2 chat is building the platform-admin Founding Season desk in the SAME
working copy at the same time. You own: lib/marketing-email-defaults.ts, the reseed migration,
lib/email.ts campaign copy, lib/demo-*.ts and the seeders' narration, lib/help-content/*.tsx,
and copy on marketing pages. You do NOT touch: anything under app/platform-admin/, app/api/admin/,
app/api/billing/, lib/email-sender.ts (audiences — Phase 2's), lib/plan-config.ts constants,
lib/db.ts, or the schema. If your work needs one of those, stop and say so. Claim your migration
number at the moment you write the file (ls supabase/migrations | tail) and re-check it right
before you commit — Phase 2 may claim one too. Stage EXPLICIT PATHSPECS ONLY; never git add -A;
before staging a shared file (TODO.md, the ledger, the decisions log) diff it against HEAD and
stage only your own hunk. Confirm with the owner before committing. Do not push. Never master.

REQUIRED:
- PM UX summary in the chat before any code (AGENCY_RULES). Update FOUNDING_SEASON_2027_PLAN.md
  Phase 1 + the PM brief + the TODO line as you go; positive facts with hashes, never "uncommitted".
- Verification: npm test · npm run typecheck (lib/ changed) · npm run verify:changed (spelling,
  contrast, CSS, dictionary, demos) · npm run check:migrations · a rendered check of any
  marketing page you touched (npm run check:layout -- --only=<screens>, dev server up — run
  npm run check:layout -- --list to name them). State any check you skipped and why.
- Offer /review after the build, then /docs if a help article changed.
- Owner QA: claim the next free § at the TAIL of docs/projects/active/OWNER_QA_LEDGER.md (never
  renumber) and build the walk as a checkable Claude Artifact (checkboxes, saved state, verdict +
  notes per step, Copy findings, the Sign-in-as card — dev credentials only, never a prod
  account). Pin the FULL date strings in every step. Include a rendered specimen of each rewritten
  email (the repo has an email preview route/script — find it), because a walk over a template's
  source is a walk over nothing.

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

Step E1:
  e1a  Email copy approved by the owner (artifact)      ⚠ ONLY after I have approved it
  e1b  Ten campaigns rewritten · reseed migration applied to dev · nothing sent
  e1c  Demos checked · help swept · offer bar walked inside both demos
  e1d  Gates green · /review run · walk artifact written · § claimed
  e1e  Committed

⚠ e1f ("Walked, findings fixed, section closed") IS NOT YOURS — that is my walk. Leave it, and
remind me the walk itself is mine to do.
```
