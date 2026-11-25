# Club Website Enhancements — Track P drawing prompt (a prospect's own club website, made before the meeting)

> Paste this whole file into a FRESH session. Written 2026-11-25. Plan: `CLUB_WEBSITE_ENHANCEMENTS_PLAN.md` (read §3, §4
> F7, §5 idea 1, §6 Track P, §7 C3a/C3b, Progress item 5 of Stage 0 Part 1, §9). Status lives on the board (project
> `club-website`). The business decision is `docs/agents/strategy/BUSINESS_DECISIONS.md`, entry 2026-11-24 "A prospect's
> own club website (Track P) starts now…" — read its Decision, "Not ruled" and Handoff lines; they are this session's
> brief.
>
> **This session can run beside the Stage 1 drawing session** (`CLUB_WEBSITE_STAGE1_DRAWING_PROMPT.md`). The two share no
> screens. Both edit the plan's Progress block and the board line, so re-read those before you write to them.

## What this session is for

Track P is idea 1: before a first sales meeting, we build the prospect club's own website on the product, in their logo
and colours, with a sample season in it. In the room they scan a code, their club opens on their phone, and "Claim it"
hands the club to them. It is the one item in the project aimed at a club signing up, and Club has been on sale since
2026-11-23.

**Already ruled (2026-11-24; do not re-open):**
- **C3a = A:** Track P runs alongside the stages, starting now.
- **C3b = A:** a prospect's club is made **on production**, **unlisted**, marked as ours, and **removed 30 days after the
  meeting unless it is claimed in place** (no copying between databases).
- Stage 0 `/legal` (plan Progress, Stage 0 Part 3 item 5): a visible "Prepared by FieldLogicHQ for {club}. Not their site
  yet." on every page; noindex; only the club's own published logo; no copied names or photos of people; fictional
  sponsors. A link emailed to a club's board is a commercial message (a reason to write, our identity, an unsubscribe).

**What is NOT ruled and comes back as asks:** what a claim costs and starts (plan, trial, checkout), whether a claimed
preview counts as a sale anywhere, and everything this session's census turns up.

**This session is about half census and half drawing.** Stage 0 gave Track P one frame (tab 12 of
`CLUB_WEBSITE_STAGE0_DRAWINGS.html`: the "Make a club for a meeting" window and the claim moment on a phone). Most of
Track P's real questions are not visual. Answer them from the code first, then draw.

**Nothing is built here.** No code, no migration, no gate. The output is one published page and the owner's rulings.

## Read first (delegate the broad reading to helpers; open the lines a conclusion turns on yourself)

- The plan sections named above, and tab 12 of the Stage 0 drawings (its frame is the starting point, not the answer).
- `scripts/seed-prospect-demo.mjs` and `scripts/lib/prospect-demo-rep.mjs`: what today's prospect seed makes, and its
  four guards (dev host only, the config slug, a marker on the organization, a dry run; Stage 0 cited
  `seed-prospect-demo.mjs:54-59,84-88,135-138`). The Milton demo world is the one real use of it.
- Auto-memory: `project_demo_process_decoupling.md`, `project_demo_sandbox_self_contained.md`,
  `reference_demo_number_needs_a_gate.md`, `project_club_on_sale_pages.md` (the self-serve Club start), and the UI
  conventions in the memory index before drawing any control.
- `docs/agents/strategy/PLAN_PRICING_FACTS.md` before any word about a plan, a price or a trial. Never write a fresh number.
- `docs/agents/legal/LEGAL_INDEX.md` for what is already researched (Terms acceptance at every door; the deletion request;
  CASL for club emails).

## Part 1 — The census (answer from the code, with file and line)

1. **What the seed makes and what it touches.** Organization, programs, teams, people, games, a tournament, sponsors,
   sign-ins, storage files. Which of those are fictional people with addresses, and where they live.
2. **Making one on production.** What creating an organization requires today (an owner, a plan or trial state, the
   module gates the public site rides: League Plus and Club). What a preview would run on: it has no subscription and must
   not look like a free plan. Who makes it: a platform admin screen (the frame) or a script, and what that changes.
3. **Every production surface that counts, lists or contacts organizations.** This is the census that matters most: a
   preview that a report counts as a customer is a defect. At least: platform admin figures and lists, the owner's
   Bookkeeping, the Owner Morning Brief and the board, `npm run health`, the demo checks, Stripe sync, any public list of
   clubs or tournaments (**a preview's tournament in flight must never appear in a public tournament list or search**),
   the sitemap and search indexing, the installable app, and **every email path** (a preview must never send an email to
   anyone; sample addresses must not be deliverable). Name each with file and line, and say how it would leave a preview
   out (one marker read everywhere is the shape to test, not to assume).
4. **The claim.** The self-serve Club start (on-sale pages S1–S4): how an organization gets its owner, where the Terms are
   accepted, where the trial and checkout start. Can a new owner be attached to an organization someone else made, and
   what does that break. What "the sample teams, games and sponsors are cleared, so you start with your own" means in
   rows: what is cleared, what is kept (name, logo, colours, words), and what a half-cleared club looks like if it fails.
5. **The removal.** What deleting an organization does today (Settings S1's deletion request; organization deletion
   removes files) and whether anything runs by itself on a schedule. What a visitor sees on an expired link.
6. **A live score in a preview.** The frame shows "Live now" with a score. §3: "a demo sandbox is never live" (owner
   2026-09-02) is about a read-only sandbox faking a scoreboard. Say which this is: a writable world where the owner
   enters a real score in the room, or times shifted so games are "on" whenever the link is opened. Each has a cost; the
   census says what the product does today, the ask lets the owner choose.

Stop and tell the owner what the census found before drawing, in a few plain lines. A `/clear` between Part 1 and Part 2
is fine; put the findings in the plan's Progress block first.

## Part 2 — The drawing

Whole-screen before (a capture of today, where one exists) beside after, true size, phone first, built from the shipped
components. Owed:
- **Platform admin › Prospect clubs:** the list (club, meeting date, days left, made by, state: preview · claimed ·
  removed), and the empty state.
- **Make a club for a meeting:** the window, refined from tab 12, with what it asks and what it refuses (a logo the club
  did not publish; a person's name).
- **What we take into the room:** the link and the QR card.
- **The preview's marking on every page,** phone and computer, and what a page that is not ready to show says.
- **The claim, every step:** "Claim it" → sign up → the Terms → the plan and trial → landing in their club with the sample
  cleared. Draw what they keep and what is gone, and the failure state.
- **After 30 days:** the expired link, and what the owner's list shows.
- **A board member who forwards the link:** what they see.

Hard limits: nothing that names a real person; no copied photos; nothing of ours advertised on the preview beyond the
marking and the credit; words go to `/marketing` in ONE pass before hand-off; times "8:00 a.m."

## Part 3 — Reviews, then hand off

1. `/ux`, then `/design`, on the page before the owner sees it.
2. `/legal` reads: the claim (Terms accepted on a club we built; who answers for what the preview showed before the
   claim), the marking against Stage 0's list, the link sent to a board (CASL), the removal record. `/billing` reads what
   a preview runs on and what a claim starts, against `PLAN_PRICING_FACTS.md`. `/accounting` only if a claim changes what
   we charge or record.
3. **Publish ONE page** (a Claude Artifact, an HTML page, the house layout; never the canvas): the census, the drawings,
   and the asks with a paste-back line. Every highlighted thing is clickable to its ask.
4. **The asks,** a recommendation on each, option A first. Expected at least: who may make a preview; how much sample it
   holds and whether the club's real team names may be typed in; a live score (writable or shifted); what the claim
   keeps and clears; what a claim starts (plan, trial, card); whether a preview may be shown signed in (the admin side) or
   only the public site; how many may exist at once; the board-forward email. Do not ask what to do first; recommend an
   order.
5. Records: plan Progress block and §7, the PM brief if scope moved, the board line (phase and next). No commit without
   the owner's word.

## Done means

One published page the owner can rule from; every census question answered from code with file and line; every
production surface that counts, lists or emails an organization named, with how a preview stays out of it; the claim
drawn end to end; the asks waiting; nothing built.
