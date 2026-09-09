# Coach fundraising — one way in · build prompt

Paste the block below into a fresh chat. It is self-contained. Written 2026-09-08 after the owner
approved the model on mockup artifact `8aa1e633` ("this is much better, simpler, and basically
covers all functionality"). The design conversation that produced it is long; this prompt carries
its conclusions so the build does not re-derive them.

```
Build "Coach fundraising — one way in": the category a budget word sits in decides who fills its
number in and where it reports. Plan: docs/projects/active/COACH_FUNDRAISING_ONE_WAY_IN_PLAN.md
(read it in full first — §1 is the ruling, §2 the verified facts, §3 the build in order). PM brief
beside it. Mockup, OWNER-APPROVED 2026-09-08, final version "Sponsorship words symmetric":
https://claude.ai/code/artifact/8aa1e633-af41-47af-b312-d852aae462a3 (source copy:
docs/projects/active/COACH_FUNDRAISING_ONE_WAY_IN_MOCKUP.html).

CONTEXT (do not re-derive; argue from the code if you think any of it is wrong):
- THE RULE (owner, binding): Fundraising and Sponsorship words are ALWAYS filled in from the
  Fundraising tab — a fundraiser says which Fundraising line it is "raising for" (pre-filled
  Fundraising drive), a sponsor which Sponsorship line (pre-filled Team sponsorship), each picker
  filtered to its own shelf including the team's/club's own words. "Other money in" holds only
  typed words — the four Fundraising/Sponsorship words are REMOVED from its picker, not blocked.
  Tournaments reports as other income (settled). A line reports under its category's shelf. A word
  a coach adds to Fundraising is a fundraising word from birth. Team-raised money is a drive entry
  for "The whole team" — no player, no family share — and it is LOAD-BEARING: it ships in this
  build or the model is dishonest.
- Settled, do not re-open: no sponsor-or-grant switch ("Raising for" IS the difference; three
  labels say "grant"); the budget picker's "From a drive" note comes OFF with nothing in its place;
  "Raising for" is pre-filled, neither required nor nudged; a coach-invented category reports as
  other income, stated on the create panel's existing footer sentence, never asked.
- One thing the owner has NOT confirmed: whole-team entries on a drive that has a family-share %
  set. Build it ALLOWED as drawn (dash in the Credit column, facts line "N of M players · plus K
  team entries") and put it to the owner as the §157 walk's one open question.
- Verified facts you can rely on (plan §2): rep_fundraisers has NO budget item column;
  rep_fundraiser_entries.player_id is ALREADY nullable and UNIQUE(fundraiser_id, player_id) does
  not cap NULLs (mig 268 depends on it) — the whole-team entry is a write-path + reader change,
  not a schema change; the register book keys arrivals on parent.kind === 'sponsor', never on a
  null player — copy that pattern everywhere; "A new sponsor…" already exists in "Which sponsor?";
  coach item creation never sets actual_source (default 'typed') and the coach POST allows a
  platform category; mig 280 measured ZERO club/coach-created money-in words on either database.
- Migrations 274, 280 and 282 are on prod 2026-09-08 (job 262), as is this one (285) — all shipped together. Next free number is
  285 at writing — re-check the folder.

BLOCKING GATE — before any code:
1. THE MOCKUP IS THE SPEC. Open the artifact at its final version and read every "Proposed"
   exhibit as a build target; every "Today" exhibit is the running product. The whole-screen
   before/after is already there (finding 4/5 tables vs screen G). Do NOT redraw it. If you must
   deviate from any drawn surface (a shared component's constraints, a phone shape the mockup
   does not show), stop and put the deviation to the owner as a question with a picture — never a
   silent judgment call. Tag NEW / RESTYLED / UNCHANGED in your hand-off per surface.
2. Plan §3.8 FIRST, read-only, on BOTH databases: count rep_team_money_in rows of entry_kind
   'income' whose budget item's actual_source <> 'typed'. Expected: the demo's $480 hoodie record
   on both and nothing else. Report the numbers before writing the migration. Legacy typed rows
   stay readable and counted as today unless the owner rules otherwise.
3. Present the implementation plan and the PM-style UX summary in the chat (AGENCY_RULES), then
   build the WHOLE thing in one pass (owner rule: no bare first cut, handle the obvious polish).

SCOPE — plan §3, in this order:
1. Migration 285: budget_categories.income_source ('typed'|'fundraiser'|'sponsor', default typed;
   platform Fundraising→fundraiser, Sponsorship→sponsor, set ONCE by name in the migration);
   rep_fundraisers.budget_item_id + budget_category_id (nullable FKs, category stored alongside
   and re-derived on write — mig 282 part 2's rule). BACKFILL PRESERVES TODAY'S REPORT: link a
   record only when its program year has exactly one budget line of its kind; otherwise NULL.
   Never blanket-default to the standard word. DATA_DICTIONARY.md + refresh:snapshots in the
   same unit of work.
2. Words born on their shelf: coach AND club item-create paths set actual_source from the
   category's income_source for direction 'in' (never from the body). Unit test. The section rule
   then needs NO new mechanism (budgetLineKindForItem → LINE_KIND_SECTION). Create-panel footer
   gains "Will report under Expected other income." only for a typed-source category.
3. Fundraiser rooms: "Raising for" as the second field on New fundraiser, Edit fundraiser and Edit
   sponsor, filtered to the record's shelf, pre-filled; server resolves the item AND checks the
   category's income_source matches the record's kind. Room facts line "Raising for X"; legacy
   NULL records get a quiet nudge. Whole-team entry: POST allows playerId null on kind
   'fundraiser' (rebate 0, no credit, ledger income row still written); GET maps "The whole
   team"; board dash in Credit; Edit/Remove work; driveFacts counts team entries separately.
   AUDIT EVERY READER in plan §3.5's list for a null player on a fundraiser-kind row — db.ts
   playerCount must exclude null; sponsor-arrivals must filter by kind; exports and seeds.
4. Placement: Budget vs. Actual lands each fundraiser/sponsor WITH an item on that item's row;
   records WITHOUT one fall back to today's placeDerivedActual over the NULL subset only. "Not
   itemized" survives for the honest cases. Tests gain per-record cases; pool cases stay as the
   legacy fallback.
5. Record money: three CONV_BRANCH sub-lines (plan §3.4, exact words); other-in picker filtered
   to typed items with empty categories dropped, placeholder e.g. “interest”, “rebate”, empty-
   state sentence; the derived warning + derivedKeys DELETED; server refusal becomes structural
   (any typed income on a non-typed item, POST and PATCH, money_back exempt); sponsor labels ×3
   in both sites + SponsorRoom; sponsor cold branch gains Raising for; drive branch "Who raised
   it *" with "The whole team" first. This ships LAST inside the build, after 3 and 4 exist.
6. The budget picker's note: delete ACTUAL_SOURCE_TAG and the rowTag pass; /simplify decides
   whether the shared prop and .optSource CSS go with it.
7. Demo + help + docs: seed-demo-coach.mjs — OS-IN-MERCH (a TYPED $480 on Merchandise sales,
   seeded on PROD) becomes a "Team hoodie order" drive raising for Merchandise sales with one
   whole-team entry; bottle drive → Fundraising drive; sponsor → Team sponsorship; re-read every
   dock line and tour step about recording money / the hoodie order / Other money in in
   lib/demo-coach.ts and true them up; check-demo-coach.mjs widens its no-typed-income assertion
   and pins the hoodie drive; npm run check:demos green. Help: the Record money and fundraising
   articles in lib/help-content/coaches.tsx (~1620–1680, ~1880–1900, ~2185) via /docs, keywords
   "whole team", "raising for", "sponsor or grant". TODO.md line; plan status line; auto-memory.
   ⚠ Prod's demo is reseeded only by hand — say so in the hand-off for the release runbook.

WHAT NOT TO BUILD (plan §4): no sponsor/grant type; no question at category creation; no auto
re-pointing when a budget line is deleted; no separate "drive result" entry; no year parameter
anywhere (HISTORY_ENDPOINTS guard stands); nothing on the closed-season page.

VERIFY (plan §5): npx next typegen → npm run typecheck; npm run verify:changed (dictionary,
spelling, demos); unit suites coach-money-derived, budget-line-kind-from-item, coach-budget-totals;
layout sweep --only= the fundraiser forms and the drive Record window (reseed first); UAT
coach-sponsor-money-lifecycle plus a new whole-team scenario; /simplify then /review naming the
migration body explicitly; clean dev restart before hand-off.

HAND-OFF: product-owner voice; NEW/RESTYLED/UNCHANGED per surface; the §3.8 numbers; Owner QA
§157 written into OWNER_QA_LEDGER.md and published as a CHECKABLE Artifact walk (checkboxes,
localStorage, paste-back; a Sign-in-as card; PIN IDENTITIES not as-of-today figures) with the
whole-team-on-a-rebated-drive question as its one open item. Do not commit without the owner's
word; stage explicit pathspecs only; confirm the branch is dev.
```
