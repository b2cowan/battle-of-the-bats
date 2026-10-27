# Platform admin support console · Stage 7, Growth (drawings prompt)

> Paste into a new chat on `dev`. Written 2026-10-27, the day the owner finished walking Stage 5 (ledger §391 31/32,
> §392 25/30, §393 37/44; 13 steps Held to the release) and said S4's walk was done. The owner chose S7 next and ruled its job.
> **This session draws and asks. It builds nothing.** The output is a drawings Artifact, the owner's rulings on it, and
> then a Stage 7 build prompt (written last, like Stages 2 to 5). **Re-verify every lead against the code before you
> draw on it:** this prompt is a lead, not evidence, and so is any helper's summary (the census below came from one; the
> four claims marked ✔ were re-checked by hand on 2026-10-27, the rest were not). The working copy is shared with Club
> Tier and Bookkeeping sessions: stage explicit paths only, check the branch before every commit, `git show --stat HEAD`
> after it. Commit nothing without the owner's OK.

## 1 · What Stage 7 makes true (the objective, in the owner's words)

**A growth person can see where every lead lands, gets metrics on historical conversions, and can input information to
track and improve future growth opportunities.** (Owner, 2026-10-27; ruled as the stage's one job.)

Three questions the screens must answer without a spreadsheet:

1. **Where does every lead land?** One view of the pipeline: how many leads are at each step, which are stuck, which
   are due a follow-up, and what became of each one (a club, a not-a-fit, nothing yet).
2. **What has converted, historically?** Of the leads we have had, how many became clubs, how many of those clubs pay,
   how long it took, and which entry path or plan interest converted best, over time and not only today.
3. **What can they put in?** A growth person records what they know (where a lead came from, what they said, what
   they did about it, why a lead was lost) so next quarter's numbers are better than this quarter's guesses.

## 2 · Push back on the plan before drawing (disagree out loud)

The plan's S7 row lumps eight screens: Leads, Campaigns, Pitch decks, Plans & pricing, Approval queue, Templates, Export
registry (and H1). **Only the first three-ish serve the job above.** Plans & pricing, the Approval queue, Email templates
and the Export registry are the *product catalogue's* work (a different reader: product, with billing reading), and
Campaigns today is outbound email to existing Founding Season customers, not acquisition. Draw the job, not the row:
- **Growth** (this stage's drawings): Leads, the conversion numbers, Campaigns (named honestly), Pitch decks.
- **Catalogue** (Plans & pricing, Approval queue, Templates, Export registry): put to the owner as ask 1. Recommend they
  stay as built, get only the menu placement and naming, and are **not** redrawn here. Say what redrawing them would cost.

## 3 · Standing rulings (do not reopen)

- The plan's "Owner rulings" sections and the standing rules **R1–R8**; **R7** (shown, not remembered) matters most here.
- **Q4:** desktop only, but anything on Today stays readable on a phone.
- Stages 1–5 are as built: the shell, Find, the menu by job, Today, the record and Story, one pencil, free time, the Money
  tab, Status, the sent-email log. Draw on them; do not redraw them.
- Warm is the default; Dark follows the account setting. Draw both.
- **A reason on every change to a customer's club, person, plan, money or retention.** A lead is *not yet a customer*;
  say whether lead edits need one (ask 6) rather than assuming.
- **Demos ask a visitor for nothing** (owner ruling; `/demos` is ungated). Nothing in this stage may propose capturing an
  email at a demo. Any new capture on the *public* site is a customer-facing change and needs its own ask (ask 4).
- **Shared automation changes only on the owner's word, in the conversation, in their own commit** (`AGENCY_RULES.md`). A
  scheduled job that writes a daily snapshot is exactly that kind of change. Draw the option that needs none (below) first.
- One spelling everywhere a customer reads it (`npm run check:spelling`); "8:00 a.m." clock; sport-neutral words.

## 4 · What the code does today (census; ✔ = re-checked by hand 2026-10-27)

Screens (menu label → route). Roles are in `lib/platform-areas.ts`; `growth` power = Super admin, Product, Growth.

| Screen | Route | What it is |
|---|---|---|
| Leads | `/platform-admin/early-access` | The one lead table, a detail pane, filters, a CSV export (capped at 1,000 rows), conversion-by-plan and by-feature mini-tables. On the kit. |
| Campaigns | `/platform-admin/email` | **Not acquisition.** Marketing email to existing Founding Season accounts: a planned-date calendar, send history, opt-outs. |
| Pitch decks | `/platform-admin/pitch-deck-studio` | Slide library and composer; unlisted prospect links at `/pitch/<slug>`. The only growth screen **not on the kit** (its own stylesheet). No record of who opened a deck. |
| Business numbers | `/platform-admin/business-numbers` | The old Overview tabs, reached only from a link on Today. Live figures: new clubs, leads, conversion rate, top 5 source paths, MRR estimate. **Not in the menu.** |
| (catalogue) | Plans & pricing, Approval queue, Email templates, Export registry, Bulk changes | See §2. |

Leads, as a table `early_access_leads`:
- **Every entry path writes it:** the public early-access form (club and league plans only), a signed-in coach's
  "interest" button, and `/coaches/start`. Nothing else is a lead: there is no contact form, no Founding Season
  application, no demo capture, and coach trials are not leads.
- **Staff fields exist:** a status (`new, qualified, contacted, pilot_candidate, waiting_for_launch, converted,
  not_a_fit, do_not_contact`), free notes, last contacted (when and by whom), a follow-up date, a next action, and the
  club it became. **There is no "lost, and why".** A legacy `status` column is always "new"; staff use `internal_status`.
  A `metadata` column exists with no writer.
- ✔ **The lead → club link is typed in by a staff member** (a picker on the lead), never matched automatically. Setting
  "converted" requires picking the club. Nothing watches a new signup's email against the leads.
- **There is no history on a lead.** Only the audit log records each edit; the lead itself has no timeline.
- **There is no source or campaign:** only `source_path`, the raw page the form was on. ✔ No UTM or referrer capture
  exists anywhere in the app, lib, components or scripts. The club record has no origin column either.
- "Campaigns" names **two unrelated things**: the outbound-email screen and `platform_catalog_campaigns` (pricing promos
  edited inside Plans & pricing, linked to nothing). Draw a name that does not collide.

Metrics today:
- ✔ **The Leads screen's "Converted" and its conversion mini-tables count only the 100 leads loaded on the page**; Business
  numbers counts the first 5,000; the CSV caps at 1,000. Three screens give three answers (inferred for the mini-tables'
  exact inputs; the page-100 size is confirmed).
- Conversion is **leads with a hand-typed club ÷ all leads**. It never asks whether that club pays, what plan it is on,
  or how long it took. No cohort, no time-to-convert, no lead-to-paid.
- ✔ **There is no historical trend.** The only history store, `platform_metric_snapshots`, is written only by a manual
  button that the Growth role cannot press, and nothing reads past rows. Raw dated facts do exist and could be read live
  (R7) with **no new job**: a lead's created and converted dates, a club's created date, and `platform_events` (billing
  lifecycle events). Verify this is true and complete before drawing a trend from it.
- Today's growth rows are counts only: New leads, Campaigns past due and due soon, Approval queue.
- `getCommandCenterStats()` is shared by Business numbers, Today and the snapshot writer: changing its shape touches all three.

Roles: Growth cannot see Plans & pricing, the Approval queue, Templates or Export registry and cannot press the snapshot.
If the owner wants Growth to read conversion beside plan pricing, that is a rulebook change (draw it, ask 7).

## 5 · Verify these leads first (the plan has been wrong before)

| Claim | Check against |
|---|---|
| A lead's email can be matched to the owner of a club that signed up | How a club's owner is stored (`organization_members`, auth email), whether the lead's `email_normalized` can be joined to it, and **how often a lead's email differs from the owner's** (look at the dev data; say what fraction would match). This decides whether auto-matching is honest or a guess |
| "Paying" is knowable per converted club | `organizations.subscription_status`, plan, free time (Stage 4's door: a club on free time is **not** paying), comped Founding. Define "paying" in words before any number is drawn on it |
| Time-to-convert and trends can be read live from dated facts | Whether `converted_at` is reliably stamped, how many converted leads have it, and whether `platform_events` carries a signup or a first payment (the census says it records downgrades, cancels and recoveries, not purchases: **re-verify**) |
| Retention, Free time and Bulk changes are not growth | The census says Retention is data-retention (cancelled clubs' kept data), not churn. Confirm, and say whether "churn" belongs on this stage's numbers |
| Pitch decks cannot show opens | The pitch route and `pitch_page_pulls` (mig 257): whether a view is recorded anywhere. A view record is a **new public write**; draw it as an option only |
| The menu names and routes disagree | `console-menu.ts`, `PLATFORM_AREAS`, `platform-waiting.ts` hrefs and Today's links all carry `early-access`, `email`, `pitch-deck-studio`. A route rename moves all of them: state whether it is worth it (recommend: rename labels only) |
| Dead ends | Redirect stubs `plans`, `stripe-prices`, `founding-season`; stale repo copies under `.claude/worktrees/` and `.probe/` double every search: exclude them |

## 6 · The drawings (blocking: no code in this session at all)

Published as one Artifact from `PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE7_DRAWINGS.html`, linked from the index's `stages/s7`.
True size, 1440 wide, Warm and Dark. Whole-screen before → after, every part drawn **from a capture of dev** (the Stage 4
lesson), **one example lead followed all the way through** (the Stage 3 lesson), every highlight clickable with its
reason, example data labelled "example" and no real person's name or address.

- **A · The pipeline ("where every lead lands").** Leads as a pipeline: the counts at each step, the stuck ones, the
  due follow-ups, and a lead's page with a **timeline** of what happened to it. Draw the step list honestly, including
  "lost, and why". Draw the empty state and a lead whose club was matched automatically versus typed by hand.
- **B · The numbers ("what has converted").** Leads → clubs → paying clubs, with time-to-convert, by entry path and by
  plan interest, over a chosen period, and a trend. Show the **same number on every screen** (one definition). Draw
  the version that needs **no new job** (read live from dated facts) first and, beside it, what a daily snapshot would
  add and what it would cost (automation change: ask 3). Say in words what each figure counts and what it cannot know.
- **C · What a growth person can input.** The lead's source and campaign, notes, next action, follow-up date, lost reason;
  what they type, what is required, what is optional (mark required, not optional), whether an edit asks for a reason.
  Draw how a lead gets a source when the form cannot supply one today (ask 4).
- **D · Campaigns, named honestly.** Whatever the outbound-email screen and the pricing promo records are called, drawn
  so a growth person is never unsure which is which, and (ask 5) whether a campaign should ever link to leads.
- **E · Pitch decks on the kit.** The same screen restyled onto the kit, nothing new. Draw "sent versus opened" only as
  the option of ask 8.
- **F · Business numbers' place.** Where the old Overview tabs go once the numbers live with the pipeline: a menu entry,
  a tab, or retired. Today's growth rows after.
- **G · When it cannot work.** A lead with two emails; the same lead filed twice; an automatically matched club that is
  the wrong one; a club on free time (converted, not paying); a lead with no source; a role that may read but not edit
  (draw each role); a period with no leads; a figure that cannot be read (never drawn as zero).
- **H · The threat list and test plan.** Over the design: a lead is a stranger's personal data (what each role may read
  and export, and a CSV that leaves the building), a new public capture (a field a visitor can fill with anything: size,
  markup, a flood), an automatic match that links a stranger to someone else's club, and anything that reaches the
  browser it should not. Run **`/review`**'s security lens over the design. State the tests the build must carry.
- **I · The boundary.** One page marking every part NEW / RESTYLED / UNCHANGED / LATER. Nothing may imply S6, S8 or the
  catalogue screens are changed.
- Run **`/design`** on the drawings before the hand-off, apply its fixes, and list any written-rule conflict for the owner.

## 7 · Asks for the owner (one recommendation each, beside the drawing it decides)

Draft these, reword to the drawings: **do not decide for the owner.**
1. **What S7 covers.** (A) the growth screens only, the catalogue four stay as built apart from menu placement; (B) all
   eight redrawn. Recommend A, with the cost of B stated.
2. **What "converted" means.** Hand-typed link as today, matched automatically by email, or matched automatically and
   confirmed by a person. And what **"paying"** means (excludes free time and comped Founding?). Recommend a person
   confirms, with the match offered, because a wrong automatic link is worse than a missing one.
3. **How history is kept.** (A) read live from dated facts, no new job, a trend only as far back as the dates go;
   (B) a daily snapshot, which is a scheduled job (a shared automation change: its own commit, only on the owner's word).
   Recommend A first; say what A cannot show that B could.
4. **Where a lead's source comes from.** Today only the page the form was on. Options: nothing new; staff type the
   source on the lead; a source or campaign tag captured on the public form (a customer-facing change). Recommend staff
   input now, public capture only if A/B show it is worth a release item.
5. **The two "Campaigns".** Rename one, and whether a campaign links to leads. 
6. **Does a lead edit need a reason**, and may Growth export every lead's email (the CSV)? A lead is not a customer.
7. **Roles.** Should Growth read conversion beside plan pricing (a `PLATFORM_AREAS` rule change), and who may press or
   schedule a snapshot if ask 3 = B?
8. **Pitch decks: opened or not.** Draw sent-versus-opened only as an option; it is a new public write.
9. **Anything the drawings surface** that the census found.

## 8 · Hand-off

- Restate the **PM summary in five lines** (`AGENCY_RULES`): what a growth person sees and does, what changes for
  leads (does any visitor see a new field?), what is left for S6/S8/the catalogue, Warm and Dark, roles.
- Update the index (`stages/s7` state + anchor + a `log/` row), the plan's S7 row and Status, the PM brief, and the
  auto-memory file `project_platform_admin_support_console.md`. A ruling is recorded exactly as ruled; add nothing it
  did not rule.
- When the owner has ruled: write `PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE7_BUILD_PROMPT.md` in Stage 3's shape (verified
  state, scope is / is not, parts, gate, guards, verify, hand-off, do not). A migration or a public route ruled in is a
  release item: say so. Prod already owes migrations 365, 367, 373, 380 and 389.

## 9 · Do not

- Write or change code, schema, `proxy.ts`, hooks, env settings or any watched script. Never email, create or change a
  lead, or run a write against either database from a probe. Do not run `apply-migration-api` for a read query.
- Redraw what Stages 1–5 ruled, or the catalogue screens (unless ask 1 = B).
- Draw S6 or S8 as if they exist, or invent a demo email capture.
- Draw a screen from memory of the kit: capture it from dev first (never overwrite `tests/uat/.auth/platform-admin.json`;
  one page at a time, Warm first).
- Decide an ask for the owner, or tick a box for them.
