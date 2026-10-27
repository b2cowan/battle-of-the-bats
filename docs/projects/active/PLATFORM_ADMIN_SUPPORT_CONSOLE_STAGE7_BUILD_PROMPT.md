# Platform admin support console · Stage 7, Growth (build prompt)

> Paste into a new chat on `dev`. Written 2026-10-27, the day the owner ruled the Stage 7 drawings (every recommended
> box ticked, plus question 4's **C and D as well**). **Re-verify every lead against the code before you build on it:**
> this prompt is a lead, not evidence, and so is any helper's summary. The working copy is shared with Club Tier and
> Bookkeeping sessions: stage explicit paths only, check the branch before every commit, `git show --stat HEAD` after it.
> Commit nothing without the owner's OK. **Part 0 ships on its own and goes first:** it fixes a leak that is live today.

## 1 · What Stage 7 makes true

The owner's job for the stage: **a growth person can see where every lead lands, gets metrics on historical
conversions, and can input information to track and improve future growth opportunities.**

1. **The Audit log stops showing strangers' details to every staff role** (Part 0, on its own, first).
2. **Leads becomes a pipeline:** seven steps in the order the work happens, "Needs you" first, stuck leads named, a lead
   page that reads first and edits whole, with a timeline of everything that happened to the lead.
3. **One definition of "signed up" and "pays"**, computed in one place over every lead, read by Leads, Today and
   Business numbers alike. A club that signs up with a lead's address is **offered** to staff, never linked by itself.
4. **A Numbers view** beside the pipeline: how many came, how many signed up, how many of those pay, how long it took,
   by page, plan, source and link tag, month by month. Read live; nothing stored, nothing scheduled.
5. **Staff input:** a source (short list) and their words, a required reason when a lead is lost, dated signed notes,
   a club picker that searches.
6. **Where a lead came from, from the visitor too:** a "How did you hear about us?" question on the public forms (C)
   and a tag on the links we hand out, kept with the lead (D). **Both are customer-facing and release items.**
7. **The public form stops letting a stranger rewrite a lead**; Copy emails and the export move to the server, audited.
8. **Words and places:** Today's campaign rows count live campaigns only; the catalogue's promo list becomes
   **Promotions**; Campaigns gains its one line; Business numbers joins the Growth menu; Pitch decks moves onto the kit.

## 2 · Rulings. Do not reopen them

Plan "Owner rulings 2026-10-27 (Stage 7 drawings)" and `memory/design_decisions.md` 2026-10-27, recorded as ruled:
- **Q1 A** The growth screens only. The catalogue four (Plans & pricing, Approval queue, Templates, Export registry) stay
  as built, apart from their menu place and the Promotions name.
- **Q2** *Signed up* = an offered match a person confirms, or a link made by hand; the match is an owner or admin who has
  joined, with an address they confirmed themselves. *Pays* = own plan not Tournament, billing active, a real
  subscription; a trial, free time and a Founding Season comp are not paying.
- **Q3 A** Read live from dated facts. **No new job, no snapshot table.**
- **Q4 B + C + D** Staff record a source (short list) and their words on the lead; **and** a "How did you hear about
  us?" question on the public form; **and** a tag on the links we hand out, kept with the lead.
- **Q5** Campaigns keeps its name and gains one line; the catalogue list becomes Promotions; no campaign links to leads.
- **Q6** No reason on a lead edit. No confirm window: the ✓ saves a lead at once.
- **Q7** No rulebook change: Super admin, Product, Growth read and edit leads; other roles see counts only.
- **Q8** Pitch decks: restyle only; staff note "sent the deck" on the lead. **No open counting.**
- **Q9** (a) Seven steps; Lost with a required reason; Not a fit and Do not contact become reasons. (b) Notes become
  dated, signed timeline entries (one migration). (c) Stuck = 30 days with no step change, note or follow-up; Waiting for
  launch excluded; not a Today queue. (d) Today's growth rows: New leads, Follow-ups due, Sign-up to confirm, Campaigns
  past due, Campaigns due soon.
- **Q10** Audit log: lead entries keep field names only; old entries' details shown only to Super admin, Product,
  Growth: **fix now, on its own**. Public form: a known address never turns a no into a yes nor overwrites a worked
  lead; Copy emails moves to the server (rides S7). Today's campaign rows count live campaigns only (rides S7). The
  export audited, uncapped, formula-safe (rides S7). **Findings, not S7's work:** the coaches page's interest form
  (fix before the Coaches Portal is ever gated); the public form's rate limit and captcha (a later public-route pass:
  but see §6-4); the "9 AM / 9 PM" slides (to `/marketing`; the spelling gate misses a time with no minutes); deleting a
  lead on request (Stage 8); the snapshot button nothing reads (Business numbers' own pass).
- **Q11** S7-D1 to S7-D6 as recommended: the scope picker is rounded and carries the amber pill; Numbers has no Search
  (period picker left; Filter and Tools right); two left pickers, view switch first, the scope picker only in Pipeline;
  Time to sign up counts to the day the club or portal was **created**, not the link; Tools' Export opens the one
  export window, Excel first; Business numbers in the Growth menu for every role, Today's foot link kept.

Standing: R1–R8; the toolbar rule (one line: which list left; Search · Filter · Tools right); the view switch is one
white track; figures in one joined band; a record reads first and edits whole; absent beats disabled; one lime per
screen; mark required, not optional; a waiting count is the amber pill; "9:42 a.m."; `possessive()`. Warm default, Dark
on the setting; desktop first, the phone frame for Today's rows.

## 3 · Read first

- **The drawings:** https://claude.ai/artifact/QTrwrgyGqgBZugpGfvpJHM (source
  `PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE7_DRAWINGS.html`). Build **from the drawings**, part by part: A (pipeline, Tools,
  empty state, the lead page, after the link), B (Numbers), C (edit, Lost, the note window, the club picker, the public
  options), D (Campaigns, Promotions), E (Pitch decks on the kit), F (Today's growth rows, Business numbers, phone),
  G (every case and state; G5 the role rails), H (threats, 16, in the page's first `<script>`, and the tests), I (the
  boundary). The example (Cedar Hollow Youth Sports, Morgan Ellis, Riley) and every figure are invented: **dev has no
  leads**.
- ⚠ **C and D were drawn as options, not as built screens.** Their place on the lead page, in Numbers and on the public
  form is specified in §7 Part 8 in the drawn rows' shape. §6-3 says what must exist before Part 8 is built.
- **The plan:** "Stage 7 findings" (the code facts with lines), "Owner rulings 2026-10-27 (Stage 7 drawings)", the S7
  ladder row.
- `AGENTS.md` (Next 16; `proxy.ts` untouched here), `AGENCY_RULES.md` (one spelling; the clock), `docs/agents/design/`
  standards, the kit window (`components/admin/kit/club/KitDialog.*`), the club record's pencil pattern
  (`ClubRecord.tsx`), `lib/platform-areas.ts` (`PLATFORM_POWERS`), `lib/public-form-throttle.ts`,
  `PLAN_PRICING_FACTS.md` (restate nothing), `docs/agents/db/DATA_DICTIONARY.md`.

## 4 · Verified state (2026-10-27, re-verify)

| Fact | Where |
|---|---|
| Lead edit writes the **whole lead, before and after**, with `org_id` null and the lead id as Field | `app/api/platform-admin/early-access/[leadId]/route.ts` ~113-120 |
| The Audit log area is open to every role; its export too | `lib/platform-areas.ts` ~156; `app/api/platform-admin/audit/export/route.ts` |
| Audit readers to census: the page, the export, the Story builders, free time, plan change, retention | `app/platform-admin/audit/page.tsx`; `lib/platform-story*.ts`; `lib/free-time-writes.ts`; `lib/operator-plan-change.ts`; `lib/billing-retention.ts` |
| Refund entries already hide details from roles without the power: the pattern to copy | Stage 3's audit filter (find it; the plan's "Stage 3 build") |
| Eight stored statuses: new, qualified, contacted, pilot_candidate, waiting_for_launch, converted, not_a_fit, do_not_contact | `lib/early-access-admin.ts:1-23` |
| "Converted" refuses without a club; `converted_at` stamped once; a club can be linked without the step | `[leadId]/route.ts` ~76-99 |
| `email_normalized` unique; a resubmission **updates the whole row**, consent `!== false` | `app/api/early-access/route.ts` ~42-111 |
| The form sends `pathname + hash`, **never the query string**; the coach start form sends a fixed path | `components/EarlyAccessForm.tsx:60`; `components/coaches/CoachStartInterest.tsx:51` |
| No rate limit on the early-access route; the repo's public-form throttle exists and is unused there | `lib/public-form-throttle.ts`; `app/api/early-access/route.ts` |
| `metadata` jsonb has no writer; legacy `status` always 'new' | snapshots |
| Today's campaign rows read every `marketing` template; the board filters to live keys | `lib/platform-waiting.ts:80`; `lib/marketing-email-defaults.ts:429-435` |
| Three lead definitions and limits (band over ≤100 rows; 5,000 newest; export 1,000, no audit row) | `EarlyAccessClient.tsx:126,182`; `lib/platform-metrics.ts:182,304`; `early-access/export/route.ts:48` |
| "Paying" rule already exists | `lib/plan-growth.ts:43-52` |
| Purchases in `platform_events` only since `6de082f2f` (2026-10-25); leads and their edit log since 2026-05-20 | `lib/platform-events.ts:7` |
| Copy emails runs in the browser over the page's rows and ignores Do not contact | `EarlyAccessClient.tsx` |
| Outreach templates (copy-to-clipboard) live in the client | `EarlyAccessClient.tsx` ~105, ~751-769 |
| Pitch decks: own stylesheet; `/pitch/[slug]` records nothing | `app/platform-admin/pitch-deck-studio/page.tsx` ~226-300 |
| Business numbers: open to every role, not in the menu; "top source paths" shown to all | `app/platform-admin/business-numbers/` |
| League Plus trial = 30 days (the example's Nov 25) | `lib/plan-config.ts:90` |
| Highest migration on disk: 395 (other sessions are numbering too) | `supabase/migrations/` |

## 5 · Scope

**Is:** Part 0; the nine parts in §7; the migration; the guards in §8; help for the console screens; the customer copy
of C (through `/marketing`).
**Is not:** the catalogue four's redraw (Q1); automatic linking; a snapshot table or any scheduled job (Q3); deck open
counting (Q8); emailing leads from Campaigns or linking campaigns to leads (Q5); merging two leads; a churn figure;
deleting a lead (Stage 8); the coaches page interest-form bug (a TODO finding); a captcha; the slide clock (`/marketing`);
the snapshot button; route renames (labels only); club web addresses or setting up a club from a lead (S6); staff and
roles (S8).

## 6 · Blocking gate: before any code (Part 0 excepted, see §7)

1. **Re-run §4** and note every row that moved.
2. **Censuses** (delegate; reopen every row that decides anything):
   a. every reader of `platform_audit_log` and how each would show a lead entry (page, table, entry window, Same
      moment, export, every Story); this is Part 0's list;
   b. every reader of `early_access_leads` and of `internal_status` / `converted_org_id` / `converted_at` (screens,
      metrics, Today, Business numbers, exports, help); this is Part 2's "one definition" list;
   c. how an account's address can become confirmed **without** its owner (an admin create with confirm, a platform
      action, an invite flow) and how to tell it apart from a self-confirmed one. **If it cannot be told apart, say so
      to the owner before Part 4:** the match rule (Q2) depends on it;
   d. every customer- and console-visible "Converted", "Not a fit", "Do not contact", "Campaign tracking" label
      (pages, help, `keywords`/`searchText`, `data-label`).
3. **C and D need a drawn frame before Part 8 is built.** Ask the owner whether the drawings session already added
   frame J (the public form's question as it will read, the lead page's Source row with the form's answer and the link
   tag, Numbers' By link tag table). If not, draw it on the drawings page in the drawn rows' shape and get the owner's OK.
   Parts 0–7 do not wait for it.
4. **Ask the owner (Q10 vs threat 10).** The drawings' threat 10 says the public-route pass comes first if C or D is
   chosen; the owner chose C and D and ruled the rate limit and captcha "a later pass". Recommended: the repo's
   existing public-form throttle goes on the early-access route inside Part 8 (it is already the house-league and
   tryout forms' limit, no new machinery); the captcha stays later. Record the answer as given.
5. **Ask the owner (Q6's third box was not ticked).** Who may export, and whether a lead marked "Asked not to be
   contacted" has an empty email cell. Q7 gives the readers (Super admin, Product, Growth) and Q10 the export's audit,
   no cap and formula safety; drawing C's reason line says the empty cell. Recommended: confirm both as drawn.
6. **`/marketing`:** the visitor's question and its choices (C), each mapping to exactly one staff source; the Campaigns
   line; "Promotions"; "Signed up", "Lost", the six reasons; the timeline's fixed sentences.
7. **The migration, written but not applied until the gate is through** (Part 1). Take the next free number at the
   time (≥396; check git and other sessions' work). Dictionary + snapshots in the same unit of work. Count, read-only,
   how many dev rows each data move touches (dev has 0 leads; never `apply-migration-api` for a read).
8. **Restate the PM summary in five lines** (`AGENCY_RULES`).

## 7 · Build, in parts

**Part 0 · The Audit log stops showing leads (on its own, first, its own commit; no migration, no gate beyond §6-1
and census 2a).** From now on `update_early_access_lead` writes **which fields changed, never their values** (no
name, email, organization, words or notes). Old entries keep their stored rows, but their values reach only the growth
power (Super admin, Product, Growth): filtered on the server before anything is sent, in the page, the table, the entry
window, Same moment and the export, the way refund entries are filtered. Other roles see the entry, its action, actor
and time, and one line: "Lead details are shown to the roles that work leads." Guard 1. This part can reach prod at the
next release by itself.

**Part 1 · The migration.** Apply to dev only. On the lead: the source (the short list: Not set · Referral from a club ·
A tournament on FieldLogicHQ · Search · Social media · An event or conference · A pitch deck · Other) and its words; the
lost reason (Not a fit · Chose another tool · Price · Not this season · No reply after three tries · Asked not to be
contacted); how the club was linked (offered match · by hand), by whom and when; the visitor's answer (C) and the link
tag (D). A notes store: lead, text, author, time, removed-by and removed-at (a removed note keeps no text). Dismissed
offers: lead and club, by whom, when ("Not this club" is never offered again). The step move: `not_a_fit` → lost with
reason Not a fit; `do_not_contact` → lost with Asked not to be contacted; the old notes box becomes each lead's first
note, signed "from the old notes box". **Stored values keep their spelling** (`converted` reads "Signed up"); a rename of
a value is not a spelling fix. RLS on, no policies, server-only, as the lead table.

**Part 2 · One definition.** One server module computes, over **every** lead, with every read checked (a failed read
says "Not read", never 0, never 0%; a rate with nothing behind it is a dash): leads arrived (first form in the period;
`created_at`); signed up (Q2: linked by a person, offered or by hand; a demo club never; a deleted club stays counted as
"Signed up, club since deleted"); pays now (Q2, from `lib/plan-growth.ts`'s rule, not a copy of it); time to sign up
(first form to the club's or portal's **creation**, S7-D4; the middle lead, quickest, slowest); new accounts and how
many came without a lead; stuck (Q9 c). Leads, Today and Business numbers all read it; the band over ≤100 rows, the
5,000-row read and the "converted_at or org" test are retired. "Paying by month starts on Oct 25, 2026" is said where
the trend shows it.

**Part 3 · Leads: Pipeline.** Drawing A. The toolbar: view switch (Pipeline · Numbers), the rounded scope picker with
the amber pill. **Needs you** = new leads nobody has answered, follow-ups come due, leads stuck 30 days, a sign-up
to confirm; the other choice is every lead. Only those two were drawn: propose any other list to the owner, never invent
one. Then Search, Filter, Tools (Copy emails; Export, which opens the one export window, Excel first). The band: New · Contacted · Qualified · Pilot ·
Waiting for launch · Signed up · Lost, a cell selects its step. The table: Lead · Interest · Step (days on it under the
chip) · Next action · Follow-up (due in amber) · Source · Arrived. The empty state. The menu's Leads pill counts
"Needs you". The growth power is asked on the server before any lead is read.

**Part 4 · The lead page.** Drawing A and C. It reads first (Details, the contact, the step, source and its words, next
action, follow-up, the club) and edits whole (pencil → ✓ ✕ with its caption; **no confirm window**, Q6). Lost needs a
reason; the ✓ refuses until one is picked and says so under the field. **Email {first name}** holds the existing three
templates, Mark contacted and Last contacted, unchanged in behaviour. **Add a note** opens the kit window (required,
dated and signed, cannot be edited; a Super admin can remove one, leaving "a note was removed"). The club picker
searches by name like Find, demo and staff test clubs never offered, and a hand link passes the same exclusions as an
offer. **The offered match** (Q2, threats 5–6): computed only when the growth power opens a lead or Today, never in the
public form; an owner or admin who has joined the club or portal, signed in with an address they confirmed themselves;
never an invited coach or volunteer, a staff-confirmed address, a staff account, a demo club (the check that **refuses
when it cannot tell**) or a club a staff address owns; one normalising of addresses on both sides; several clubs on
one address offers each, none picked. "Link the club" and "Not this club". Unlinking puts the step back; the timeline
keeps both. **The timeline:** fixed sentences only (moved, set the source, linked, filled the form again, a note), read
from the notes store and the edit log, matched on the exact action and lead id, read by the growth power only.
**After the link** (drawing A's last frame): "Signed up on {date}, {n} days after it arrived. Linked by {name} on
{date}", the plan and trial line; follow-up and next action cleared.

**Part 5 · Numbers.** Drawing B. Period picker left; Filter (plan, page, source, link tag) and Tools (export the
numbers) right; no Search (S7-D2). The joined band: Leads arrived · Signed up (n, % of the leads) · Pay now (of those
who signed up) · Time to sign up (the middle lead; quickest, slowest) · New accounts (how many came without a lead).
Tables by page, by plan ("a lead may pick two"), by source (Not set first, counted, never hidden), **by link tag** (D,
Part 8), each Leads · Signed up · Rate · Pay now (· Days). The month-by-month trend by the month a lead arrived. The
definitions block, word for word from the drawing, with "how a lead heard of us unless staff record it" rewritten once C
exists. Business numbers' Growth tab reads the same module (drawing F); its "top source paths" go for roles without the
growth power, who get three counts and no door.

**Part 6 · Today.** Drawing F. The growth rows: New leads · Follow-ups due · Sign-up to confirm · Campaigns past due ·
Campaigns due soon, for the roles whose Today shows growth (the rulebook decides, `queuesFor`); the campaign rows count
**live** campaigns only (`LIVE_MARKETING_EMAIL_KEYS`). The phone frame. Stuck is not a row.

**Part 7 · Words and places.** The Growth menu: Leads (pill) · Campaigns · Pitch decks · Business numbers (every role,
S7-D6; Today's foot link stays). Campaigns' one line (drawing D). The catalogue list "Campaign tracking" → **Promotions**,
labels only (routes, tables and ids keep their names). Pitch decks on the kit (drawing E): head and rule, deck cards,
Your decks as today's card with the "Opened" option line as drawn, the library band and its slide cards, New deck a door
that opens a window, Publish only when there is something to publish. No new behaviour on any of them.

**Part 8 · The public form (a release item; after §6-3, §6-4, §6-6).**
- **The overwrite fix (Q10):** a second form from a known address never turns a "no" into a "yes" and never overwrites
  a lead staff have worked (any step past New, a note, a source, a link): its words land on the timeline as "filled the
  form again". A lead still at New with no staff work takes the visitor's new words, but never their "yes" over a "no".
  The response is the same for a known and an unknown address.
- **C:** one optional question, "How did you hear about us?" (no star), on the early-access form and the coach start
  form, choices in `/marketing`'s words, each mapping to one staff source. The answer is kept as the visitor gave it and
  fills the lead's Source when staff have set none; staff can change it, and the lead page shows "From the form: …"
  under it. Never overwrites a source staff set.
- **D:** a `ref` tag on the address the visitor arrived on, kept in that browser tab's session storage (no cookie, no
  new consent) and sent with the form. **Only tags on a short list kept in code** are stored (a commit adds one, with its
  label); anything else is dropped, never shown raw, cut to a fixed length (threat 16). A known address keeps its first
  tag. Shown as "Link: {label}" on the lead page, filterable, and its own table in Numbers.
- The throttle per §6-4's answer. The form answers a database error with a fixed sentence, never its own words.

**Part 9 · Copy emails and the export, on the server (Q10, threats 2–3).** Both are growth-power routes. Copy emails:
only leads in the current list who said yes to release emails, never "Asked not to be contacted", an audit entry (who,
when, how many, which list), no addresses in the entry. The export: every row (no 1,000 cap; a ceiling said on screen if
one is ever reached), the audit entry written **before** the file is sent (if it cannot be written, nothing is sent),
every cell starting with `=` `+` `-` `@`, a tab or a return made safe in every column, the email cell empty for "Asked
not to be contacted" (per §6-5). The Audit log's own export gets the same formula safety.

## 8 · Guards (new unit tests)

1. **Part 0:** a lead edit's audit entry holds field names and no values; an old full-row entry read by Support,
   Billing and Read only (page, window, Same moment, export) carries no name, email, organization, words or notes, and
   by Super admin, Product and Growth carries them.
2. **Server rules:** every lead, Numbers, timeline, offer, Copy emails and export route refuses a role without the
   growth power **before any read**; a malformed lead id or body is refused.
3. **One definition:** a fixture of leads gives the drawn band; a demo club never counts; a deleted club stays counted;
   a trial, free time and a Founding comp are not paying; time to sign up counts to creation, not the link; a failed read
   gives "Not read", never 0 or 0%.
4. **The match:** an invited coach, a staff-confirmed address, a staff account, a demo club, an unclear demo check, and
   a club a staff address owns are never offered; a dismissed club never returns; the public POST computes no match and
   answers known and unknown addresses alike.
5. **The public form:** a resubmission never flips no → yes; a worked lead keeps its fields and gains a timeline entry;
   an unknown tag is dropped; a long tag is cut; the form's answer never overwrites a staff source.
6. **Rendering:** a script tag in every public field renders as text in the list, the page, the timeline, Numbers and the
   export; no link is built from a lead's words.
7. **The export and Copy emails:** formula cells made safe in every column (an address starting with `=`); no audit
   entry → no file; Do not contact → empty email cell and never in Copy emails.
8. **Notes:** cannot be edited; a Super admin's removal leaves "a note was removed" and no text.
9. **The Story:** a club's "arrived as a lead" line is filtered in the database read for roles without the growth power.
10. **Today:** retired campaigns are not counted; the growth rows follow the rulebook per role.
11. **Spelling:** the new labels pass `check:spelling`; times in the timeline use `formatTime()`.
12. **The threat list (16):** each has a guard or a named reason it cannot (threat 15, deck opens, is not built).

## 9 · Verify

- `npx next typegen` then `npm run typecheck` (shared modules change); `lint:focused` on changed files; the guards
  directly with `node --import ./tests/ts-resolver.mjs --test <files>`; `check:spelling`; `check:dictionary`.
- ⚠ `npm test` / `verify:changed` clear `test-results/` for every session: run them only when no other session is
  mid-walk, and say so. Report your reds apart from other sessions'.
- **Restart the dev server** at hand-off (new files, shared modules), via `npm run dev` only, before the layout check.
- `check:layout -- --changed` on Leads (both views), a lead, Today, Business numbers, Campaigns, Promotions, Pitch decks,
  the Audit log, the public early-access and coach start forms; Warm and Dark.
- Read-only probes only (`.probe/pasc/`, abort non-GET); never overwrite `tests/uat/.auth/*.json`. **Dev has no
  leads:** the walk needs seeded test leads, made with the owner on dev, never from a probe and never on prod. No probe
  submits the public form.

## 10 · Hand-off

- **Part 0's walk first, alone** (one purpose: the Audit log as each role sees a lead entry), as a checkable Artifact
  with its Owner QA Ledger section (never sort the §).
- **Then two walks, one purpose each:** (1) **a lead followed from the form to paying** (the form's question and a
  tagged link, the pipeline, the lead page, a note, Lost and its reason, the offer and the link, Numbers, Today);
  (2) **the guard rails** (each role's view, the resubmission rule, Copy emails and the export, Promotions and Campaigns'
  line, Pitch decks on the kit).
- **Prod steps, named not run:** Stage 7's migration joins **365, 367, 373, 380 and 389** at the next release; the public
  form change (C, D, the overwrite fix, the throttle if ruled) is a release item with its customer copy. No scheduled
  job, no env change.
- **The index:** `stages/s7` state + anchor ("Built `<hash>` <date>"), a `log/` row, the walks' links.
- **Records:** the plan's S7 row and Status (+ a "Stage 7 threats → guards" list), TODO, the PM brief, the auto-memory
  `project_platform_admin_support_console.md`.
- **The finish pass is a step of the build:** `/simplify`, then `/review` with the privacy lens (Part 0, the match, the
  public form, the export), `/docs` (console help for Leads, Numbers, the Audit log; the public form's help if any),
  `/strategy` only if a business decision moved.
- No commit without the owner's OK.

## 11 · Do not

- Link a club to a lead without a person's press, or compute a match inside the public form.
- Show a lead's words to a role without the growth power anywhere, including the Audit log, the Story and an export.
- Store a link tag that is not on the list, a referrer, an IP address, a device or a cookie.
- Add a scheduled job, a snapshot table or deck-open counting; email leads from the console.
- Redraw the catalogue four, rename routes or stored values, or fix the coaches-page form here (a TODO finding).
- Submit the public form, email anyone, or write either database from a probe; touch production.
- Restate a price, plan name or limit; edit shared automation or watched scripts; change `proxy.ts`.

## 12 · Git

On `dev` only. Explicit pathspecs. Branch check before every commit, `git show --stat HEAD` after. Separate commits:
- Part 0 (the Audit log), its guard, its help line: **alone, first**;
- the migration, the dictionary and snapshots;
- the one definition and its readers (Leads band, Today, Business numbers);
- Leads: Pipeline, the lead page, notes, the match, Numbers;
- Copy emails and the export on the server;
- the public form (overwrite fix, C, D, throttle);
- words and places (menu, Campaigns' line, Promotions, Pitch decks on the kit);
- docs and help.

## 13 · Context you would otherwise miss

- The drawings' figures, Cedar Hollow, Morgan, Riley, Lakeview's registrar and Brookside are invented; dev has 0 leads.
- The drawings page was assembled from Stage 5's head and scripts by a scratch assembler; the `.html` in
  `docs/projects/active/` is the source.
- "Signed up" replaced "Became a club" everywhere: a coach lead becomes a Coaches Portal, not a club.
- The match rate on production was never measured (Q2's recommendation does not depend on it); a counts-only prod read
  is the owner's to allow and was not asked again.
- `.probe/pasc/capture-s7.mjs` and `render-s7.mjs` are the drawings' capture and render scripts.
