# Chunk D — The family experience: PM BRIEF

> **Created 2026-08-01.** Plain-language companion to the discovery report and implementation
> plan. Status: awaiting owner decisions — nothing here is built.

## What this is

The last Coaches Portal chunk, and the one with commercial upside. It gives the families attached
to a team a real window into the season — and it does it without asking the coach for a single
extra evening. Every family-facing screen is generated from work the coach already does: taking
attendance, entering scores, giving awards, running development sessions.

## What a family sees and does differently

- **A parent asks; the coach approves** (owner ruling 2026-08-01 — the GameChanger model). The
  coach shares one team "family link" into the channels the team already uses; anyone opening it
  picks what they are (owner ruling, second pass): **the player's parent/guardian** — names their
  player, and the request lands in the coach's queue with a helpful hint when their email matches
  the roster contact — or **a family member following the team**, who doesn't name a player at
  all. The coach approves or declines in a tap and can change someone's tier later; direct
  invites and automatic connection for registered league/club families still work. There is
  deliberately no way to search for a team or a child — the link only travels where the team
  sends it.
- **Two kinds of family connection** (owner ruling 2026-08-01): the **guardian** — one per player
  (with room for the other household) — is the accountable adult who'll get money reminders and
  registration-related things, and who receives the player-specific payloads like the season
  recap. **Family followers** — grandparents, aunts, anyone the coach approves, as many as the
  team wants — get exactly what they came for: the schedule, results, game pages, the calendar
  subscription, and game updates. Followers are never tied to a child, which also means that tier
  carries no child data and can ship sooner.
- **This is a Premium-portal experience** (owner ruling 2026-08-01) — free teams don't get family
  surfaces in this chunk, which makes the family layer one of the clearest parent-visible answers
  to "what does Premium get me."
- **Their home screen gains a "Your players" section**, and the team view is **one scrolling
  schedule** (owner ruling): games and practices in a single list that opens at the next upcoming
  event — finished games show the score, upcoming ones just the time and place — plus every
  announcement the coach has sent. No more "what time is Saturday?" texts. A connected guardian
  can add the other household's parent as the second guardian, and point grandparents at the
  follower path — the coach always sees and can disconnect anyone, so separated households aren't
  an afterthought and the extended family isn't squeezed through a cap.
- **The coach decides who sees the schedule** (owner ruling): staff only, families, or a public
  link. "Families" is the recommended default — connected families see everything, and sharing a
  single game page with grandma is still always a deliberate coach action. Flipping on the public
  link is what makes the standing no-login team page exist.
- **The team calendar lands in their phone's own calendar:** subscribe once and every practice
  and game stays current automatically — probably the single most-used thing in the chunk.
- **Grandma gets a game link.** Any game gets a clean page — opponent, time, directions, then the
  final score — that the coach can share once and anyone can open with no app and no account. It
  never shows a child's name, so it's safe to travel.
- **At season's end, each family gets their player's Season Recap:** attendance, what their kid
  worked on and how they improved, awards, playing time, and the team's season story — with a
  save-able keepsake card (first name and jersey number only) the family can share if *they*
  choose to. We don't have game statistics and we don't pretend to — this is the "how they grew"
  recap no other app can write, because the coach's real work lives here.
- **Award night gets certificates:** two clicks, print-ready, in team colors.

## What the coach sees and does differently

- A **Family access** panel on each player: invite, see who's connected, revoke anytime.
- After entering a score: **"Draft the family email"** — a pre-written result message into the
  existing Email families tool. Edit, send, done.
- A recap preview per player before families see anything.
- ~~Later: a team family chat~~ — **CUT 2026-08-01 (owner).** Chat stays coaches-and-admins
  only. Not deferred, not sequenced later: removed from this project.

## Why it matters (the business case)

This is a **retention play**. GameChanger's lesson is that families stay for the emotional archive
— but it charges parents to see their own kid and treats kids' data as effectively public.
TeamSnap owns the parent logistics habit but shows families ads and hides club pricing behind a
sales call. TeamLinkt is free because it sells sports parents' attention to advertisers. Our
position is the one none of them can copy: **the family layer is a byproduct of the coach's real
work, in a product with no ads on families, no paywall between a parent and their own child, and
Canadian-grade privacy by default.** It gives a coach a parent-visible reason to keep the premium
portal, and a club a families-love-it reason to stay.

No new pricing: the family layer rides the existing Premium portal — already decided, no new fees
for families, ever. *(The earlier line here promised "family chat basics with any coach portal";
that is void — family chat was cut on 2026-08-01 and no tier gets it.)*

**What the club administrator sees:** a simple adoption number per team — "340 of 400 guardians
connected across your 18 teams" — so the board hears a fact, not anecdotes. And the coach sees
proof too: how many families opened the recap or Saturday's update (counts only, never
who-read-what).

**Being straight about January 2027** (when the free coach promo ends): what's live by then is
practice visibility, the family reads, and the season recap — a real answer to "what am I paying
for," led by practice visibility. **Family chat is no longer part of that story** (cut 2026-08-01),
so the January pitch rests on practice visibility, the schedule families can finally see, and the
recap. That is a narrower claim than the original plan assumed, and it is the honest one.

## Tradeoffs made deliberately

- **No game stats and no live play-by-play** — we won't compete with GameChanger there, so the
  recap is honestly built from attendance, development, and awards instead.
- **No public sharing of anything naming a child** — deferred, not cancelled. The only thing that
  leaves the app with a child's identity on it is the keepsake image a family chooses to save.
- **RSVP stays out for now** (a prior ruling) — it's the most-requested next piece and is queued
  for its own decision right after this ships.
- **Chat is last, not first** — it's the highest-liability piece and it waits for the identity
  foundation, better moderation tools, and the legal review.

## Success criteria

- A meaningful share of a team's families request and get connected — measured from day one
  (requests, approvals, time-to-approval, and how many connect automatically via registration),
  so we learn where the friction is rather than guessing.
- Coaches send the drafted postgame email more often than they wrote family emails before — and
  skipping it never leaves a visible hole for families.
- Premium coaches cite family features at renewal; the January 2027 conversion is answered by
  practice visibility + the recap (chat arrives after, by design).
- Zero incidents of a family surface exposing another child's data (probes enforce this before
  every release).

## What we need from the owner

Fifteen decisions (listed in the discovery report §9 and in chat) — headline three: approve the
verified-family foundation and how families get verified, approve the growth-recap direction
(including that recaps stay readable after the season ends), and confirm chat waits for its own
phase. Mockups are ready for review alongside the decisions; then the legal review, then build.

---

## BUILD UPDATE — 2026-08-01: the follower experience is built

**Where it stands:** the substrate and the whole follower experience are built on the
development environment, not yet committed, and not yet on the live site. The guardian tier —
the part that connects a parent to their own child — is designed and ready but deliberately not
built, because it is waiting on the privacy counsel review. A packet for that review is written
and sits with the owner.

**What a coach can now do (premium teams only):**

- Copy one **family link** from their Roster page and paste it wherever their team already
  talks. Resetting it kills every copy of the old link at once.
- Choose **who can see games and practices** — staff only, connected families (the default), or
  anyone with the team's public page.
- **Approve or decline** the family members who ask, and remove anyone later. Requests wait
  quietly on that one page as a "3 waiting" count; nothing chases the coach.
- **Share one game** from the schedule, which creates a clean no-account page for it. Sharing is
  always its own deliberate tap.

**What a family member can now do:**

- Open the coach's link, say they're following the team, sign in or create an account, and wait
  for approval. They are shown nothing about the team's players at any point.
- Once approved, see the team in their Following, and behind it one scrolling schedule — games
  and practices together, opened at what's next, finished games carrying their score.
- Subscribe the schedule to their own phone calendar, where it stays current on its own.
- Get an in-app alert and an email when a game moves, is cancelled, or gets a final score.

**Two things we deliberately did not do:**

- **No push notifications.** Delivery on Android has never been confirmed on the live site, so
  promising a family a push we cannot prove arrives would be dishonest. Email and in-app only,
  until that is proven.
- **No guardian tier yet.** A parent who picks "I'm a parent or guardian" is told plainly that
  it isn't open yet and offered the follower path instead — rather than being hidden (which
  would suggest we hadn't thought of them) or quietly accepted (which would create a consent
  record we couldn't stand behind).

**A quiet fix worth knowing about:** the tryout-offer page used to show a child's full name to
anyone holding the emailed link. It now shows a first name and a last initial. Separately, the
coach's "Email families" now carries a real unsubscribe that we honour on every send — the coach
sees how many families have opted out, never which ones.

**What the owner needs to do next:** walk the flow on a phone (share a link, request as a
family member, approve, check the schedule and calendar, open a shared game on a second
device), and decide when to send the counsel packet.
