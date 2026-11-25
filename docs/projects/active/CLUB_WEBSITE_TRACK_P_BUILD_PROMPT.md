# Club Website Enhancements — Track P build prompt (a prospect's own club, built before the meeting)

> Written 2026-11-25, after the Track P drawing and its rulings (commit `2ce4cc003`), on the owner's "write the track p
> build prompt". **Four sessions, in order**, each pasted into a fresh chat (`/clear` first):
> - **P1** (Opus): *"Read and follow docs/projects/active/CLUB_WEBSITE_TRACK_P_BUILD_PROMPT.md — Session P1"*
> - **P2**, **P3**, **P4** (Opus): the same line with their session name.
>
> Plan: `CLUB_WEBSITE_ENHANCEMENTS_PLAN.md` (§4 F7, §6 Track P, §7 C3a/C3b and T1–T16, the Progress block's "Track P
> Part 1" census with file and line, and "Parts 2 and 3" for what each review changed). Strategy: BUSINESS_DECISIONS
> 2026-11-24 "A prospect's own club website (Track P)…" (Decided; runs in parallel with the website stages). Legal:
> `docs/agents/legal/CLUB_WEBSITE_TRACK_P_REVIEW.md`. Status lives on the board (project `club-website`).
> **The drawing is the spec:** `CLUB_WEBSITE_TRACK_P_DRAWINGS.html`, published
> https://claude.ai/artifact/Tx3So1rUqL6shn7CzM93Zr (tab 1 the census table, tabs 2–8 the screens, tab 9 the order).
> Where this prompt and the plan differ, the plan wins; where the plan and the CODE differ, the code wins — say so out
> loud before building on it.

## ⛔ Start conditions (every session)

1. T1–T16 are in plan §7, ticked (commit `2ce4cc003`). If not, stop and tell the owner.
2. **Track P runs beside Club Website Stage 1** (`CLUB_WEBSITE_STAGE1_BUILD_PROMPT.md`) and other sessions (Board Ready).
   The one shared screen is the **public club frame**: Track P marks every page of a preview, Stage 1 changes the home.
   Re-read `app/[orgSlug]/layout.tsx` and `components/public/ClubSiteHome.tsx` from disk before editing either, and say
   in the plan which session owns which part. Both write the plan's Progress block and the board line. Commit your
   lines through a private index (`reference_partial_commit_shared_tree.md` in auto-memory), never `git add -A`.
3. Migrations number after the highest in `supabase/migrations/` at commit time (other sessions add them). Every
   migration updates `docs/agents/db/DATA_DICTIONARY.md` and the snapshots in the same unit (`check:dictionary`).
4. **Production reads are counts and schema only** (AGENCY_RULES 2026-11-18). A preview has no people by design (T3),
   but the census of real clubs is still counts.
5. Today's prospect seed (`scripts/seed-prospect-demo.mjs`, Milton on staging) **is not touched** by this track. It
   refuses production by design and stays that way. A preview is made by the product, on production, not by a script.

## What the owner ruled (plan §7, all A, 2026-11-25; build exactly this)

- **T1** one preview marker, read by every count, list, search and email, held by a build check.
- **T2** only the owner makes one. **T3** the public site only, no people: nobody signs in to a preview.
- **T4** one fixed sample, every name made up (a house league season of 3 divisions and 12 teams, 4 rep teams, a
  one-day tournament on the meeting day, 3 sample sponsors; "Sample" in the event names).
- **T5** one tournament game live at the meeting time; the owner types its score from the room window.
- **T6** at most 5 open at once. **T7** the claim code is on the room card, never emailed.
- **T8** a claim keeps the name, web address, logo (with its source), colours, sport and the club's line, and clears all
  of the sample in one all-or-nothing step. **T14** cleared at the press of Claim.
- **T15** the claimant shows masked, with an undo until a plan starts.
- **T16** the Terms §3 paragraph and the Privacy sentence ride the next Terms version; the claim's own lines carry the
  meaning until then (no Terms version of its own, no gate).
- **T9** the claim uses exactly Start a club's plans, trial and checkout. **T10** a customer from the claim day
  ("Came from a preview" is a line on the row, never a figure in Business numbers).
- **T11** removed by itself nightly 30 days after the meeting, a removal record kept; moving the meeting moves it.
  **The production job is shared automation: built only on the owner's word in the session that builds it (P4).**
- **T12** the old link says "This preview has ended" for 90 days, then the ordinary not-found page.
- **T13** one email, to the person met only. **It cannot send until FieldLogicHQ has a mailing address**
  (`FIELDLOGICHQ_SELLER_MAILING_ADDRESS` is blank by the owner's 2026-11-17 ruling). Owed from the owner, not an ask.

Safety rules written on the drawing with no ask (build them): every form in a preview is closed on the server too (a
crafted request writes nothing and logs no body); share images, posters and the calendar feed are refused for a
preview; "don't index" on every page and in its header and no sitemap entry, **never a robots.txt line** (public, it
would list our prospects); the directory and "discoverable" switches are off and not shown; error alerts stay ON for a
preview; the make window refuses Québec, a club already on FieldLogicHQ, a logo with no source, a meeting in the past or
more than 60 days out, and a sixth open preview.

## Read first (delegate broad reading to a helper; open the lines a conclusion turns on yourself)

- The plan's Track P census (Progress, "Track P Part 1", items 1–6) and the drawing's tab 1 table. Re-check each cited
  line; they were traced on 2026-11-25 and other sessions commit daily.
- `/billing`'s shape (Progress, "Parts 2 and 3", item 2): the marker is folded in **at the entitlement door** and grants
  only the site parts a preview shows; `plan_id` stays at the free start; **never** `club` + `active`, **never** free
  time (a whole-plan grant refuses checkout; any grant is a customer grant); cleared in the claim's own write.
- `lib/demo-org.ts` and why the demo list is the wrong tool (tab 1, "Why the demo list is the wrong tool"): a preview
  is "not a customer, silent, unindexed" without being "read-only shared sandbox with a banner and a no-login door".
- The look-back list pattern (`HISTORY_ENDPOINTS` in `tests/unit/coach-history-endpoint-guard.test.ts`) for T1's check.

---

## Session P1 — the preview marker and its build check (T1). Nothing a visitor sees.

Nothing else in Track P is safe on production without this, so it ships first and alone.

1. **The marker** (migration): one column or table that says "this organization is a preview", with the meeting time,
   the removal date, who made it, the logo's source, and the claim state. Its shape is the session's to propose to
   `/db` before writing; what it must answer is the drawing's tabs 2, 4, 6 and 7.
2. **The entitlement door** reads it (`/billing`'s shape above): a preview shows its public site parts and nothing is
   billed, gated as paid, or counted as a plan.
3. **Every surface on tab 1's table reads the one "not a customer" rule**, extended to previews: Business numbers
   (customers, revenue, snapshot, AND people, registrations, accounting, subscription events), Clubs & portals, Bulk
   changes, Plans & pricing impact, Find (still finds a preview by name), People, Leads, Renewals, Free time, online
   payments, Stripe watch, plan ending, retention, sign-up and activity events (not written for a preview), the
   marketing sender, the bell and push, fan alerts. **The main sender refuses any email for a preview organization,
   failing closed.** Sitemap and "don't index" (page and header) leave previews out. Directory and discoverable read
   false for a preview whatever is stored. Error alerts stay on.
4. **The build check:** a test that lists every count, list, search and send that reads organizations, and fails when a
   new one appears without the preview rule (the look-back list pattern). This is a unit test, not shared automation.
5. Reviews: `/db` (the migration and that no surface was missed), `/billing` (the door), `/review`. Typecheck, the unit
   tests, `verify:changed`. Offer the commit; commit at the owner's word. The migration joins the production steps list.

## Session P2 — Prospect clubs, Make one, the sample, and the marking (T2–T6; tabs 2, 3, 5)

Start condition: P1 committed.

1. **Prospect clubs** under Growth in platform admin, owner only (T2): the list (computer table, phone cards ≥ 60 px,
   empty state), counts "N open · N claimed · N removed", Search, Make a club for a meeting. Clubs & portals leaves
   previews out; a claimed one moves there and keeps one row here.
2. **Make one** (tab 3): the window and every refusal it draws, all or nothing ("Nothing was made. Try again."), the
   logo upload with its required source address, colours from the logo, the meeting date and time, the 5-open cap
   (T6). It makes an organization **with no owner and no member** (a new creation path: the only one today needs a
   signed-in non-staff person, `app/api/org/create/route.ts`). Then the fixed sample (T4), with the tournament's first
   game at the meeting time (T5) and the tournament's listing switch off.
3. **The marking** (tab 5): the band above the club's own bar on every page of a preview (in the frame every club page
   shares, so a deep link carries it), not pinned, repeated in the footer with the removal route; "(preview)" in the
   page title and link preview; "Registration isn't open on this preview" for every form, closed on the server (every
   public sign-up, tryout and registration POST refuses a preview: P1's sections open those pages).
   **Refused for a preview (owner 2026-11-25, in place of an `X-Robots-Tag` header, which P1 did not build):** every
   non-page route it could serve — share images, posters, the calendar feed, PDFs. Make the club with `is_preview` set
   in the one creation step (mig 535 refuses people, Stripe ids and a moved record); seed no dues. P1's other hand-offs
   are in the plan's Progress block, "Track P Session P1".
4. Words: one `/marketing` pass (tab 5's and tab 3's strings; the 16 already passed are in the Progress block).
   `/design` on the shipped screens, `/review`, `/docs` (a platform-admin-only page needs no customer help; say so).
5. One walk (checkable Artifact, exact logins), on dev. Commit at the owner's word.

## Session P3 — the room and the claim (T5, T7–T10, T14–T16; tabs 4, 6, 8)

Start condition: P2 committed.

1. **The room window** (tab 4): Copy link, the QR full screen (wide quiet border, medium error correction), the room
   card PDF (half letter), New code (the old one stops working), the live game's score and Mark final (staff write this
   one thing in a preview, through the window, not a club seat), "Not saved. Check your signal and save again" with the
   numbers kept, Change the meeting (moves the live game and the removal date together), Remove now (red, the club's
   name typed back, as platform admin's Delete), Email the link (T13: shown; its send refused while the mailing address
   is blank, saying why).
2. **The claim code:** no 0, O, 1 or I; five wrong tries in an hour rests the door for an hour; never in an email (T7).
3. **The claim** (tab 6): code first, then Start a club's own Account step (the Terms tick where it is today), the claim
   step with its authority tick and /legal's paragraph (T16), then today's plan step, trial, billing address and
   checkout word for word (T9). The claim re-checks Club is on sale, the one-club rule and the current Terms; records
   the plan they came for; and **in one all-or-nothing write** hands over the owner seat, clears the marker and the
   whole sample, and keeps T8's list (T14). Every failure leaves the preview as it was or the club theirs and cleared,
   never a third state; error alerts fire on "didn't finish". The claimed club lands on Set up your club.
4. **After the claim:** the row's masked claimant and an undo until a plan starts (T15); a customer from the claim day
   in every count (T10); "Came from a preview" on the row, never a figure.
5. **A forwarded link** (tab 8): the board member sees the preview and the code page; nothing else.
6. Reviews before hand-off, **not optional**: `/legal` (what a customer agrees to changes), `/billing` (checkout and the
   counts), `/accounting` only if the plan, trial or price differs from Start a club's (it must not, T9), `/design`,
   `/review`, `/docs` (a club's owner can now claim a club: one help line on Start a club). One walk. Commit at the
   owner's word.

## Session P4 — the removal, the ended page, and the one email (T11–T13; tab 7)

Start condition: P3 committed. **Ask the owner, in this session, before building the nightly job** (shared automation,
AGENCY_RULES 2026-09-26; T11 rules the behaviour, not the job). If he says no, build T11 B's by-hand list instead and
record that he did.

1. **The removal:** every row and every file of a preview 30 days past its meeting, as platform admin's Delete does
   today, plus the removal record in the audit log (name, address, who made it, meeting date, logo source, made and
   removed; no sample rows, no files). The owner's Today page shows "Removed tomorrow (N)" the day before. Nothing
   emails the club.
2. **The ended page** (T12): reads the record for 90 days, then the ordinary not-found page; never shows the meeting,
   the maker or the logo.
3. **The one email** (T13): /legal's CASL words, the consent record (date, role, send; no name), the unsubscribe keyed to
   the address so it outlives the preview. Built and tested; **it stays refused until the mailing address exists.**
4. `/legal` (the email), `/review`. One walk. Commit at the owner's word.

**Before the first real preview is made on production,** P4's removal must be live there, or the owner removes each
one by hand from Prospect clubs. Say this in the hand-off of P2 and P3.

## Hard limits (every session)

No person's information in a preview (T3); no sign-in to a preview; no robots.txt line; no change to Start a club's
plans, prices, trial or checkout; no "keep 30 more days" button (it would change the 30-day rule); no new Terms version
(T16 A); the existing prospect seed and the shared demos untouched; times only through `formatTime()`.

## Done means

On production after a release: the owner makes a preview from Prospect clubs, takes it into the room with a live score,
the club claims it into a real Club trial with the sample cleared, or it removes itself on day 30 and says so for 90
days; no count, list, search or email anywhere treats a preview as a customer, held by a build check.
