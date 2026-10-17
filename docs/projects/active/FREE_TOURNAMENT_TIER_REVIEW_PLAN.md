# The free tournament tier — what it has, what it shows locked, what it hides — plan

**Status:** session 1 (the deep review) done 2026-10-12: findings, counts and the question sheet published on the
project hub (v1 2026-10-12). **⚖ RULED by the owner the same day (§6, R1–R10)**: free is the invite-only plan; the
packaging rulings went to `/strategy`; the mockup session's prompt is `FREE_TOURNAMENT_TIER_MOCKUP_PROMPT.md`. F11's
fix (the unused email route removed) is its own change, made 2026-10-12. **Session 2 (the drawings) published
2026-10-12 on the hub's Mockups tab (v4; v5 after `/design`), §11; ⚖ the owner ruled all twelve asks as recommended the
same day (M1–M12). The build prompt is `FREE_TOURNAMENT_TIER_BUILD_PROMPT.md`.** **Session 3 (the build) 2026-10-16,
§12: committed `d82c4118` (the product) and `2157eae6` (help) the same day; the owner's walk is QA §320, on the hub's
QA walk tab.**
**Hub:** `FREE_TOURNAMENT_TIER_REVIEW_HUB.html`, published as one artifact for the project's life at
https://claude.ai/artifact/VEXd9cimTQaSN9jmXfK6hU (Findings · Questions · Plan · Brief; Decisions joins at the
first ruling). Republish the same path; captures ride along as `captures/*.jpg`.
**Starts / builds:** the analysis started early (owner, 2026-10-12); **the build waits for the tournament admin
redesign's close-out** (its final walk §306, 6c's calendar findings, the close-out), because it changes locks on the
same screens. It may run while Club Tier finishes (owner, 2026-10-10).
**PM brief:** `FREE_TOURNAMENT_TIER_REVIEW_PM_BRIEF.md`. Session 1 prompt: `FREE_TOURNAMENT_TIER_REVIEW_PROMPT.md`.
**A packaging decision:** every ruling here goes through `/strategy` (`BUSINESS_DECISIONS.md`), and the Facts doc
(`PLAN_PRICING_FACTS.md`) and `lib/plan-config.ts` / `lib/plan-features.ts` change in the same unit of work as the
build. This session writes neither the decisions log nor the Facts doc.

## 1. The owner's ask (2026-10-10)

*"reviewing and updating the functionality of the free tournament subscription tier, most notably the amount of
functionality visible in the application and what should be available, visible with a subscription lock, and not
visible at all. I expect the free tier to only be used by those running small exhibition tournaments, including the
coaches with coach portals, and we need to think of the differences between those and premium tournaments (i.e. there
should be no public or internal registration management, no payment tracking, no staff kits, etc.). do a deep review of
these, provide your findings to me, ask questions for me to answer, and then update accordingly."*

Every feature ends with exactly one of three answers: **included**, **visible with a lock**, or **not visible**.

## 2. The method (the owner's order)

1. **A deep review** — done 2026-10-12 (§3–§5).
2. **Findings to the owner** — on the hub's Findings tab.
3. **Questions for the owner** — §6, on the hub's Questions tab with a paste-back.
4. **Rulings, logged by `/strategy`;** the Facts doc and the plan config change with the build.
5. **Mockups** of what a free organizer and a coach host see, screen by screen.
6. **The build** (after the redesign's close-out), then `/marketing`, `/docs` and the demos.

## 3. What exists (re-verified in code 2026-10-12)

The 2026-10-10 version of this section was right on the gates and wrong in four places, corrected here:
- **Founding Season does not give Tournament Plus by itself.** A sign-up lands on the free plan with a comp marker;
  it becomes Tournament Plus only when the owner picks Plus on the plan screen. A comped **coach** stays on the free
  plan's rules (no path flips a coach to Plus). Nothing turns a comp off on 2027-10-01 yet (F03).
- **A coach already on the platform is found by email, not by name** (Add team asks the coach's email; there is no
  directory search, by the 2026-09-13 ruling that rejected one).
- **The Staff kit has no gate of any kind** — it is a page of two links with QR codes (Scorekeeper, Gate) plus an
  invite door (F06).
- **"Announcements free, communications workflow paid"** is enforced as: free emails every accepted team, capped at
  100 recipients a send and 10 email announcements a day per event; Plus removes the caps and adds targeting. The
  templates / scheduling / delivery-tracking "workflow" the Facts doc names does not exist.

**The gates.** One list in code (`lib/plan-features.ts`) decides every paid feature by the org's plan; a platform
admin **cannot** change it at run time (F15). The Premium Coaches Portal (`team`) sits beside the free plan on that
list, with grants for PDF exports, PDF settings and its staff room — so its hosted event runs on the free plan's rules
plus PDFs.

**Free today (every one of these is open to a free organizer, and to a Premium coach's event):**
- public registration (the form, the page, per-division close), accept and decline, the waitlist (a full division
  waitlists by itself), Select many (accept, decline, waitlist, deposit paid, paid in full), pools;
- payment tracking: the Payment column, Mark paid / unpaid, amounts paid, the Fees & payments card, the "Payment
  recorded" email;
- Add team (with or without the coach's email), Roster requirements, six automatic coach emails;
- building the schedule and the playoff bracket by hand, publishing it, results, check-in;
- the Staff kit and volunteers (scorekeeper and gate jobs; never counted as seats; unlimited);
- announcements to every accepted team (capped), Excel/CSV of the schedule and results;
- the public site with live scores, following and the installable app; the Powered-by badge and banner.

**Tournament Plus today:** the round-robin and playoff generators, the rain delay, imports, custom registration
questions, the registration export, waitlist promote/place, payment reminders and payment dashboards, the
schedule-published email, targeted announcements and fan push, Tournament Chat, Summary and the post-event email,
sealed archives, Reuse, advanced branding, PDF exports, unlimited events and seats.

**The redesign's "free tier review" list** (Stage 5 left each as it was; this project owns them): the New tournament
window's "Start blank, or reuse" step; the draft board's "Start from a past tournament"; the finished board's Reuse
and Summary lock lines; "More tournament slots"; the Registration questions lock card; Public site's "Unlock Advanced
Branding" and six Locked cards (and J1-063, J1-053); Chat's full-page wall and its phone tab; the free view of imports
beyond the Tools row. The prompt's "lock line on Chat's title" does not exist in code — Chat on free has no title band
at all, only the wall.

## 4. The counts (read-only, 2026-10-12)

**Production** (`.probe/ftr-counts.mjs`; the demo sandbox excluded):

| | Accounts | Events | What they used |
|---|---|---|---|
| Free Tournament plan | 1 (a Founding Season sign-up that never picked Plus) | 0 — **no free event has ever run on production** | — |
| Premium Coaches Portal | 1 (Founding Season) | 1 draft, no teams (its start date passed 2026-09-19) | nothing yet |
| Tournament Plus, comped (Founding Season) | 1 | 2 finished: 9 and 12 teams, one division each, 25 and 28 games | public registration (both), check-in (4 teams), Chat (6 messages), fan score alerts (13 followers), one announcement each, hand-entered scores; **no** fees, payment tracking, custom questions, volunteers or sealed archives |
| Tournament Plus, paying | 0 | — | — |

So nobody on production loses anything from a free-tier change today. The one real "small" event (9–12 teams, one
division) ran **open registration on Plus** — which is the customer the proposed line puts on Plus (F04).

**Dev** is test data only (5 free orgs, all test fixtures; 6 coach workspaces; 7 Tournament Plus): the counts there
measure the fixtures, not customers, and carry no weight.

## 5. Findings

Numbered so the hub's rows can point here. Product-owner voice; the code anchors sit in the hub's row notes.

**F01 — The free plan today is a registration-and-payments product.** Everything the owner's starting view would take
away is open to a free organizer now: the public registration form and page, the review queue, the waitlist, Select
many, payment tracking, the Fees & payments card, the Staff kit and volunteers. Only the *tools around* them are Plus
(custom questions, the export, reminders, dashboards, promote/place). So the starting view is not a tidy-up of locks —
it redraws the free floor.

**F02 — Every surface sells registration as free.** The pricing card ("Basic standard team registration", "Waitlist
management and team status tracking"), the organizer page ("Standard team registration with waitlist collection"),
`/start` ("registration, schedule, brackets, and a public site"), the coach page, the home page, the brand's Segment 1
promise ("From first team registration to final standings"), the persona article ("You review applications, approve
teams, record what has been paid, and manage the waitlist"), and help ("The free Tournament plan supports standard
registration fields, payment tracking, and waitlist collection"). Each would change with the line.

**F03 — Founding Season works differently from how this plan and the Facts doc read.** A sign-up starts on free with a
comp marker and becomes Tournament Plus only when its owner picks Plus (one of the three real accounts never did). A
comped coach's event stays on free rules all season. On 2027-10-01 nothing happens by itself: the turn-off is the
Founding Season plan's own Phase 3 (manual or automatic, decided by May 2027). So "what happens on 2027-10-01" needs a
rule this project writes and that phase carries out.

**F04 — Production has nobody to grandfather, and its one real small event used open registration.** See §4.

**F05 — The coach's tournament is the free plan plus PDFs, and the product barely says it exists.** A Premium coach
opens "Tournaments you run" in the portal, which leads to the same tournament admin a free organizer uses, with the
same locks. It has no Tournament Chat (the most coach-flavoured feature), and on the Teams export its PDF row looks open
and then refuses. The only places that say the portal includes an event are the billing page ("one free-tier tournament
slot for scrimmages or local events") and one help answer; the shared plan content says the opposite ("a coach ENTERS
tournaments here, never hosts one"). A Basic coach can host only by creating a separate free Tournament organization
from the "Run your own event" banner — which a Premium coach can do too, giving them two places to run an event.

**F06 — The Staff kit is a thin page; the substance is volunteers.** The page shows two QR codes and links (Scorekeeper,
Gate), a Print button and "Invite a volunteer". Volunteers are invited from Settings & access with a job (scoring, gate
or both), sign in, and see only their job; they never count against the three seats. Hiding the page alone changes
nothing; removing volunteers means the organizer (or one of two staff seats) enters every score. Scorekeeping is what
makes the free plan's shop window — live scores on a public site carrying "Powered by FieldLogicHQ" — work. No
production event has used a volunteer yet.

**F07 — Teams can get in without registration, and the path is nearly complete.** The organizer adds each team (accepted
at once). With the coach's email, the coach gets an email with a link and claims the team into their Coaches Portal
(the claim works even without the email, once the coach signs in with that address); then the coach sees the schedule,
scores, announcements and any roster request. The host coach adds their own team in one click. Gaps: no bulk add on free
(imports are Plus: 24 teams is 24 forms); a team added with no email can never be claimed; there is no accept step for
the coach (the team is "in" the moment it's added).

**F08 — Nothing in the product defines "small" or "exhibition-only".** All three styles (round robin + playoffs,
bracket only, exhibition) are open to every plan; no plan limits teams, divisions or days.

**F09 — One boundary, seven lock shapes.** The padlock line with the plan's name (most screens); the same line inside a
Tools menu; a toast that appears after the click; a callout with a "Review Tournament Plus" button (Event settings); a
full-page wall (Chat); "Locked" badge cards under an "Unlock" box (Public site — the dashed-box pattern the 2026-09-30
ruling retired); simply absent (payment tools, promote/place in the list, the theme row); and an unmarked link (the
board's payment follow-ups). Lock links also differ: some open the Tournament Plus panel, some the bare plan page.

**F10 — Controls that look free and then refuse.** The Teams Export's Excel and CSV rows (unmarked; a warning appears
after the click); a Premium coach's Teams PDF row (open, then refused); Coach emails' "Schedule published" switch (on,
but sends nothing on free); the board's payment follow-up rows (look like doors, lead to the plan page); Chat, which is a
**primary phone tab** once a free event is live and opens a paywall.

**F11 — ⚠ Security, separate from this project: an unused email route with no limits.** An older send-message route
that nothing in the product calls any more still accepts any list of addresses, any subject and any message body from
any signed-in organizer with the communications permission — on every plan, including a brand-new free sign-up — and
sends it from FieldLogicHQ's address with no cap. That is a spam and phishing risk to the sending domain. Recommended:
remove the route in its own small fix in another session, now (`app/api/send-message/route.ts`; no caller found in app,
components, lib, scripts or tests).

**F12 — The free email limit is only explained after it bites.** 100 recipients a send and 10 email announcements a
day per event; the composer says nothing beforehand, and the only customer-facing statement is one help answer.

**F13 — Locks the server does not hold (low risk, noted for the build).** PDFs are made in the browser (no server
gate); payment data is sent to free accounts and only the screen hides the Plus tools; the playoff generator's
server check trusts a flag the browser sends; waitlist "Place" has no server check of its own.

**F14 — Gate keys with nothing behind them.** "Online tournament payments" and the "operational workbook" are Plus keys
with no product; "calendar file" is a free key, but the tournament admin has no calendar export; six free keys are
never checked anywhere (harmless). Remove or rename at the build so the list says what the product does.

**F15 — The platform admin cannot change what a plan includes.** The feature list is code only. Plans & Pricing's
module matrix is recorded but not live; its seat-limit override has no reader; its tournament-limit override reaches
only new checkouts and cannot raise the free plan's one event. So every ruling here is a code change plus the Facts
doc. (Route the misleading matrix to the platform admin support console project.)

**F16 — Marketing already disagrees with the product, before any change.**
- The home page lists three Plus tools under the free plan's "Free to start" badge: custom team registration, the
  round-robin generator, and tournament archives.
- The Tournament Plus card still says "no FieldLogicHQ badge"; paid events carry the quiet "Built on FieldLogicHQ"
  credit (corrected elsewhere on 2026-08-20).
- The billing page gives the Premium portal "3 staff / coach seats"; coaching staff are unlimited and only the event's
  admin side has three seats.
- "Unlimited volunteers" is sold as a Plus upgrade; volunteers are already free and unlimited.
- "Brackets" are listed as a Plus addition in the FAQ; hand-built brackets are free.
- "Free plan", "free tier" and "starter" appear on the pricing FAQ, the billing page and many help answers; the brand
  canon forbids all three.
- The email split promises Plus templates, scheduling and delivery tracking that do not exist.

**F17 — The Facts doc has no free inclusion list,** so four hand-copies (the pricing card, the organizer page, the
billing page, the copy canon) drift independently, and its own drift check doesn't cover them.

**F18 — Product copy that misdescribes itself.** The post-event results switch's lock sentence describes the Summary
page, not the email; Reuse has two wordings ("Reuse this setup" / "… for next year"); Public site's App Icon card and
two help answers still describe per-event install identities that were retired 2026-07-11.

**F19 — The redesign's list is all here.** Every "free tier review" item from Stage 5 is a row on the hub's inventory.

## 6. Rulings (owner, 2026-10-12)

The owner answered the whole sheet the same day (the hub's paste-back, then three follow-ups). Ruled as written below;
the packaging rulings are logged by `/strategy`, and the Facts doc and the plan config change with the build.

- **R1 (Q1) — A coach's event follows the free plan, whatever free becomes, and keeps PDFs** (PDF exports and PDF
  settings: today's grant). Nothing else is granted.
- **R2 (Q2) — Founding Season organizations on 2027-10-01: nothing is deleted.** Finished events stay online with their
  records. On an event still open, public registration closes, teams already in stay, recorded payments stay readable
  but not editable, and Plus tools show their lock. This project writes the rule; the Founding Season plan's Phase 3
  carries out the turn-off. **The offer itself stays exactly as sold** (follow-up answer).
- **R3 (Q3) — Free is invite-only:** the host adds the teams; no public registration, fees or review queue on free;
  any style; no size cap.
- **R4 (Q4) — Teams get in by today's path:** the organizer adds each team with the coach's email; that email is the
  invitation; the coach claims the team into their Coaches Portal.
- **R5 (Q5) — Lock where a free organizer reaches for a paid tool; hide whole areas an invite-only event never uses.**
  One lock shape everywhere: the padlock line with the plan's name, opening the Tournament Plus panel. Never a wall
  reached from the nav; never a control that works and then refuses. Each area's answer is the table below: as
  recommended, except **the Staff kit and scorekeepers → hidden** and **Tournament Chat → hidden** (the owner's
  changes).
- **R6 (Q6) — A free event's public pages:** everything a fan needs stays; the Registration page is absent; the
  Powered-by badge and banner stay. **A Premium coach's event carries the free badge and banner too**, not the quiet
  "Built on FieldLogicHQ" credit (follow-up answer).
- **R7 (Q7) — All volunteers leave free** (the owner, against the recommendation): the organizer and up to two staff
  seats enter every score. No Staff kit, scorekeeper or gate job on a free event or a coach's event.
- **R8 (Q8) — Events created before the build keep today's tools until they finish;** new events follow the new rules.
- **R9 (Q9) — Free becomes the invite-only plan;** registration, fees and payments lead Tournament Plus; the Premium
  portal says it includes one hosted event; `/marketing` writes the words. **Fix today's false claims now, before the
  build** (the home page's three Plus tools under the free badge, the Plus card's "no FieldLogicHQ badge", the Premium
  portal's "3 staff / coach seats"). **The Facts doc gets the free plan's inclusion list,** the one source every card
  copies.
- **R10 (Q10) — all six yes:**
  - remove the unused email route now, in its own change (**done 2026-10-12**: the route is deleted; the type check and
    the route-coverage gate pass; the running server answers "not found");
  - show the free email limit in the composer before Send;
  - remove the gate keys with nothing behind them at the build;
  - a Founding Season organization still on free sees its locks say Tournament Plus is free for it through September
    30, 2027;
  - hand the Plans & Pricing matrix that looks live but isn't to the platform admin console project;
  - leave a coach's two ways to host for a later coach-portal pass.

**Each area's answer (R5) — a free event, and a coach's event (R1):**

| Area | Answer |
|---|---|
| Public registration (the form, the page, "Registration open") | Hidden |
| The review queue: accept, decline, pending | Hidden |
| Waitlist, and Select many's registration actions | Hidden |
| Registration questions card | Hidden |
| Fees & payments card, the Payment column, Mark paid | Hidden |
| Payment tools (reminders, dashboards, filters) | Hidden |
| Check-in and the gate job | Hidden |
| Staff kit, scorekeepers and every volunteer job | Hidden (owner's change) |
| Tournament Chat: the nav entry, the phone tab, the board's coaches card | Hidden (owner's change) |
| Roster requirements | Included |
| Add team, Add my team, pools | Included |
| Announcements to every team, with the limit shown before Send | Included |
| Coach emails: only what applies (game-day reminder; the publish email as a lock line) | Included |
| Public site, live scores, following, the app | Included |
| Targeting and fan push in the composer | Lock line |
| Teams export (Excel, CSV, PDF) | Lock line |
| Spreadsheet imports | Lock line |
| Round-robin and playoff generators | Lock line |
| Rain delay (a whole day at once) | Lock line |
| Email the teams when you publish | Lock line |
| Summary: no nav row; one line on the finished board | Lock line |
| Reuse a past event | Lock line |
| Sealed archives | Lock line |
| Advanced branding: one line instead of six cards | Lock line |
| More events at once | Lock line |
| PDF exports (schedule, results) | Lock line on free; open on a coach's event (R1) |

**What the rulings change in earlier decisions** (bookkeeping for `/strategy`, not a cost to weigh):
- The volunteers' seat exemption (2026-06-22; extended to the Premium portal 2026-08-10) now applies only to paid
  plans, because free and a coach's event have no volunteers. "Volunteers are free and unlimited" leaves the free pages;
  "unlimited volunteers" becomes a real Tournament Plus benefit.
- The free/paid presentation split (2026-07-30: paid pages carry the quiet credit) gains one named exception: a
  Premium coach's event carries the free badge and banner (R6).
- The 2026-06 free-tier strategy's Tournament floor ("tournament core is universal"; manual fee tracking stays free)
  no longer holds; the free floor is the invite-only event.
- The brand's Segment 1 promise ("From first team registration to final standings") becomes Tournament Plus's story.

**Details the mockup session settles (not new rulings)** — *settled 2026-10-12, §11 M1–M12:*
- what Select many keeps on free once its registration actions go (pools? remove?);
- a coach's Teams export: its PDF row opens (R1 keeps PDFs) while Excel and CSV take the lock line;
- how the host enters scores from the field on a phone with no scorekeeper job (Results on a phone, or the scorekeeper
  screen opened to staff seats);
- what an event created before the build shows while it keeps today's tools (R8), and what a Founding Season
  organization's locks say (R10);
- the Coach emails card on free, reduced to what applies.

## 7. The questions as asked (2026-10-12, kept for the record)

Order as the prompt set it. **Q1–Q3 decide the change; answer them together** — the coach's answer (Q1) depends on
what free becomes (Q3), and Q2 decides who it reaches in a year. Q4–Q10 refine.

**The re-frame behind the recommendations.** The owner's examples (no public registration, no payment tracking) and
the one real small event on production point to one line, and it is not size or format: **how teams get in.** A free
event is one the host fills by adding teams (invite-only). Tournament Plus is for events teams register and pay to
enter. Under that line, registration management and payment tracking leave free as the owner expects — but the Staff
kit should **not** all go: scorekeeping is what makes live scores, and live scores are the free plan's shop window.

**Q1 — The coach's tournament.** Does a Premium coach's event get the free plan's rules, or more?
- **A (recommended).** It follows the free plan, whatever free becomes, and keeps PDFs. The portal's own billing line
  already sells it for "scrimmages or local events". Tradeoff: a coach who runs an open, fee-paying event needs Plus.
- B. Free plus Tournament Chat for the coach's event. Tradeoff: one more grant; little use at 4–6 teams.
- C. Free plus registration and payment tracking for the coach. Tradeoff: a $29 Plus for one-event-a-year hosts.
- D. Full Tournament Plus for its one event. Tradeoff: undercuts the $39 plan for any once-a-year host.

**Q2 — Founding Season, on 2027-10-01.** What happens to the registrations, payments and Staff kit a comped
organization set up?
- **A (recommended).** Nothing is deleted. Finished events stay online with their records. On an event still open,
  public registration closes, teams already in stay, recorded payments stay readable but not editable, Plus tools show
  their lock. This project writes the rule; the Founding Season's Phase 3 carries out the turn-off.
- B. As A, but an event already open on Sept 30 keeps its Plus tools until it finishes.
- C. Hide everything Plus set up. Not recommended: the organizer loses sight of who paid.
- And: the Founding Season offer itself does not change (recommended).

**Q3 — Exhibition only, or small?**
- **A (recommended).** Invite-only: no public registration, fees or review queue; any style; no size cap — adding
  teams one at a time is the natural limit.
- B. The Exhibition style only. Tradeoff: takes away the free brackets the organizer page advertises.
- C. Any style, capped (up to __ teams, __ divisions, __ days). Tradeoff: new limits to enforce, explain and lock.
- D. Keep registration on free; only payments and the Staff kit move.

**Q4 — How teams get in.**
- **A (recommended).** Today's path: the organizer adds each team with the coach's email; that email is the
  invitation; the coach claims the team and sees the schedule, scores and announcements.
- B. Add an accept step for the coach (an "invited" state the organizer sees). New build.
- C. A, plus a light "paste a list of teams" on free.

**Q5 — Lock or hide.**
- **A (recommended).** Lock where a free organizer reaches for a paid tool; hide whole areas an invite-only event never
  uses. One lock shape everywhere: the padlock line with the plan's name, opening the Tournament Plus panel. Never a
  wall reached from the nav; never a control that works and then refuses.
- B. Lock everything (maximum upsell, maximum clutter). C. Hide everything paid.
- Then each area's answer (the hub's table; recommended answers): public registration, the review queue, waitlist,
  Registration questions, Fees & payments and payment tracking, payment tools, check-in → **hidden**; the Teams export,
  imports, generators, rain delay, the schedule-published email, targeting and fan push, Summary, Reuse, sealed archives,
  advanced branding (one line, not six cards), more events, PDFs → **one lock line**; Tournament Chat → **no nav entry,
  one lock line on the board's coaches card**; Roster requirements, the Staff kit's Scorekeeper card, announcements,
  manual schedule and bracket, results, public site → **included**; Coach emails → only what applies to an
  invite-only event.

**Q6 — The public pages of a free event.**
- **A (recommended).** Everything a fan needs stays (schedule, standings, scores, teams, news, rules, champions, live
  scores, following, the app); the Registration page is absent; the Powered-by badge and banner stay.
- B. A, plus the host's own logo on the public site (J1-053). Tradeoff: gives away one piece of Plus branding.
- C. Fewer public pages on free. Not recommended.
- And: a Premium coach's event keeps the quiet "Built on" credit (recommended).

**Q7 — Volunteers.**
- **A (recommended).** Scorekeeping volunteers stay free; the Staff kit shows the Scorekeeper card only; the gate job
  goes with check-in.
- B. All volunteers leave free; the organizer and up to two staff enter scores.
- C. As today.

**Q8 — Existing free events.** Production has none.
- **A (recommended).** Events created before the build keep today's tools until they finish; new events follow the new
  rules.
- B. The new rules apply to every free event at the build. C. Free organizations before the build keep today's plan.

**Q9 — The marketing promise.**
- **A (recommended).** Reposition free as the invite-only plan ("host a small event: add your teams, build the
  schedule, post live scores"); registration, fees and payments lead Tournament Plus; say the Premium portal includes
  one hosted event. `/marketing` writes the words.
- B. Keep "free to start" and list only what's included.
- And (recommended, regardless of the rulings): fix today's false claims now (F16), and give the Facts doc the free
  plan's inclusion list as the one source every card copies (F17).

**Q10 — What the review found that the list missed** (each recommended yes):
- remove the unused email route now, in its own fix (F11);
- say the free email limit in the composer before Send (F12);
- remove the gate keys with nothing behind them at the build (F14);
- a Founding Season organization still on free sees its locks say Plus is free for it through September 30, 2027;
- route the Plans & Pricing matrix that looks live but isn't to the platform admin console project (F15);
- leave the coach's two ways to host (F05/F19) for a later coach-portal pass.

## 8. Who loses what, as ruled

- **A free organizer** loses public registration, the review queue, the waitlist, fees and payment tracking, check-in,
  the Staff kit and every volunteer job, and Tournament Chat's door. Keeps: adding teams with an invitation email,
  pools, roster requests, the schedule and bracket by hand, results (entered by the host and up to two staff),
  announcements to every team, the public site with live scores, Excel/CSV of the schedule and results.
- **A Premium coach** loses the same (their event follows free), keeps PDFs and "Add my team", and their event's
  public pages now carry the Powered-by badge and the sign-up banner. Nobody on production today: the one coach event is
  an empty draft.
- **A Founding Season organization** loses nothing until 2027-10-01; then it lands on the new free plan with its records
  kept and its Plus tools locked (R2). One organization on production today (it used registration, check-in, Chat and
  fan alerts).
- **Nobody on production loses an event today** — no free event has ever run there; events made before the build keep
  today's tools until they finish (R8).

## 9. Next steps

1. ~~The owner answers the question sheet~~ — answered 2026-10-12 (§6).
2. ~~Record the rulings here, in the brief and on the hub's Decisions tab~~ — recorded 2026-10-12.
3. **`/strategy` logs the packaging rulings** in the decisions log (2026-10-12); the Facts doc's free inclusion list
   and the plan config change with the build. This project writes neither document.
4. ~~**Fix today's false claims now** (R9): a `/marketing` pass on the home page's free card, the Tournament Plus card's
   badge line and the Premium portal's seats line, ahead of the build.~~ — written 2026-10-12 by `/marketing`, with the
   same badge line in the two plan emails (owner: include them), the upsell email's two other false lines and
   `/pricing`'s "brackets" (F16). Words and reasons: `PRICING_PAGE_COPY.md`, "Today's false free-plan claims, corrected".
5. ~~The mockup session~~ — drawn 2026-10-12 on the hub's Mockups tab (v4, v5 after `/design`), §11; the twelve asks
   ruled as recommended the same day (M1–M12); the build prompt written: `FREE_TOURNAMENT_TIER_BUILD_PROMPT.md`.
6. **The build** (`FREE_TOURNAMENT_TIER_BUILD_PROMPT.md`), after the tournament redesign's close-out. Then `/marketing` (the free card, the organizer page, the
   start page, the coach page, the brand promise), `/docs` (help), the demos, and the Facts doc + plan config with
   `/strategy`'s drift check.

**Captures** of today's screens (evidence, not mockups) were taken 2026-10-12 on the free test club's upcoming event,
desk 1280 px and phone 390 px, read-only: `.probe/ftr-capture.mjs` (regenerates them into `.probe/shots-ftr/`); they
are published with the hub.

## 10. Not in scope

Prices; the Club or League plans; the coach portal's own features outside its tournament; the Founding Season offer
(unchanged, R2); the security fix in F11 (made 2026-10-12 as its own change, not part of this build).

## 11. The mockups (session 2, drawn 2026-10-12)

Published on the hub's **Mockups** tab (v4, 2026-10-12; after `/design`, v5; same artifact). Fourteen drawings at true size (desk 1280 px,
phone 390 px), each with NEW / RESTYLED / UNCHANGED / GONE tags that open their explanation: seven whole screens before
(the 12 Oct captures) and after (drawn) — Teams (with Tools, Export and a coach's Teams), a team's record, Event
settings, the board before the event, the navigation (rail, the phone bar live and draft, the More sheet), Public site
(admin), the public event page (with a coach's event) — then seven specimens: the one lock line in every place and its
Founding Season variant, Add team's three cases, scores from the field, the composer's limit, the finished board, the
2027-10-01 state, an event made before the build. Tournament Plus screens are not drawn (they do not change). The
drawings' source partials live in `.probe/ftr-mk/` and are spliced into the hub by `node .probe/ftr-mk/splice.cjs`;
`node .probe/ftr-mk-render.mjs` dry-renders every screen and view from disk (errors, sideways scroll, a screenshot of
each frame).

**What the drawings show, in one breath:** on free, Teams is a list of who is in by pool (no At a glance, Payment
column, Filter, review or waitlist bands); the team export and the import wear the Tools-menu lock up front; the
record keeps Team, Placement, notes and Delete; Event settings keeps five cards and Coach emails keeps one switch and two
lock lines; the board keeps Teams (was Registration), Schedule and Messages; the nav loses Check-in, Staff kit, Chat and
the finished event's Summary row; Public site's six Locked cards become one lock line; a fan's page loses only
registration, and a coach's event gains the free badge and banner.

**⚖ The asks — RULED by the owner 2026-10-12, all twelve as recommended** (*"I agree with your recommendations"*; on
the Mockups tab's Asks screen, recorded on the hub's Decisions tab as M1–M12). As ruled:
1. Select many on free — *rec:* only on a division with pools, offering only Move to pool; no bulk remove.
2. The two Teams Export menus — *rec (changed by `/design`):* free = one locked row, "Export the team list"; a coach's
   event = PDF report open and one locked row for Excel and CSV. *Alternative:* one locked row per format.
3. The host's score path on a phone — *rec:* Field scores (the scorekeeper screen) stays open to the host and the two
   staff seats; Results stays too.
4. An event made before the build — *rec:* nothing on that event; one sentence on the next New tournament window's
   reuse step about how teams join.
5. Coach emails on free — *rec:* one switch (Game-day reminder, no master switch) and two lock lines (the publish
   email, the final results email).
6. The phone bar on a live free event — *rec:* Results · Dashboard · Schedule · Messages · More (the draft bar is
   unchanged). **Revised by the owner 2026-10-16, during the walk:** Dashboard · Results · Schedule · Messages · More —
   "dashboard should be first if it is in the menu", as More is always last.
7. *(revealed)* The Teams list on free — *rec:* no At a glance panel; a team with no coach email says "No email" in its
   row; no band on a division without pools.
8. *(revealed)* The words for an invited team — *rec:* "Add team" as the window's title and button, "Added" (not
   "Registered"), "Resend the invitation", no status chip, the invitation box ticked whenever there is an email.
9. *(revealed)* The Founding Season lock — *rec:* a quiet second line under the words, "Free for you through
   September 30, 2027", in the lock's own grey; said once at the foot of a Tools menu.
10. *(revealed)* A team still waiting on 2027-10-01 — *rec:* it stays listed and can be accepted or declined; nothing
    new comes in; Chat, check-in and volunteers follow the free rules from that day.
11. *(revealed)* The composer's limit — *rec:* say the limit always, and say before Send when a send would break it.
12. *(revealed)* Add team's account check — *rec:* keep it, and confirm at the build that it is rate-limited.

**Facts the drawing session verified in code (2026-10-12), for the build prompt:**
- **The nav is not plan-gated anywhere today:** Check-in, Staff kit, Chat and Communications show on every plan and
  role; Summary's row appears for any completed or archived event; Chat's page is the paywall. The phone bar is one
  rule by status: Draft = Setup · Teams · Schedule · Site; Active, Completed and Archived = Results · Check-in ·
  Schedule · Chat (it never reads game day). Staff kit always sits in the More sheet.
- **The Teams export is gated twice:** every format needs the registration-export key (Tournament Plus), and PDF also
  needs the PDF key. A Premium coach holds the PDF key but not the export key, so all three rows refuse after the click
  (the PDF row looks open). R1's "PDF open on a coach's event" needs the build to let the PDF row through for a coach.
- **Field scores admits the host today:** the scorekeeper screen checks the score-entry capability, which owner, admin,
  staff and volunteer all hold; Results already has a Scorekeeper button that opens it. A wrinkle to fix at the build:
  with score review on, an owner or admin there is shown "Submit for review" and the review note, but the score saves
  final (only staff and volunteers are held).
- **A Premium coach's event counts as paid on its public pages:** the badge, banner and quiet credit are decided by one
  free-plan check that a coach's plan fails, so today it shows the quiet "Built on FieldLogicHQ" credit (R6 changes it).
- **Event settings' Contact card** holds the public contact and "Registration alert routing" (All registrations /
  Assigned only); the routing goes on free and the summary drops "All registrations ·".
- **Select many** today offers Accept, Waitlist, Reject, Deposit paid, Paid in full, Send a reminder (Plus) and, on a pool
  division without slots, Move to pool. No bulk remove exists.
- **Add team** today: "Add Team Manually" with Team name, Coach, Email, Division, Payment status and a Notify box; when
  the email field is left it says whether the address already has an account (the basis of ask 12). The coach's email
  says "has been registered" and mentions payment instructions — `/marketing` rewrites it at the build.
- **Registration health** on free can only count missing emails (review, spots, required info and payments do not apply
  or are Plus) — the basis of ask 7.
- **The demo's tour anchor `registration-health`** sits on the Teams glance; the demo runs on an unlimited plan, so the
  free change does not reach it, but the build should confirm the anchor still exists for paid plans.

**`/design` review (2026-10-12, before the hand-off; hub v5):** twelve findings, ten applied to the drawings, two
noted; recorded on the Mockups tab's "Design check" screen. Two changed a recommendation: **ask 2** now recommends ONE
locked row on free ("Export the team list"; a coach's event keeps PDF report open with Excel and CSV in one locked row),
because three identical locked rows added nothing; **ask 9**'s Founding Season line is drawn in the lock's own grey
(not olive) and said once at a Tools menu's foot. The rest: the over-limit Send button keeps its name ("Post and email
112", switched-off face) with the reason at the foot's left; the composer keeps "Pin it at the top"; open menus sit below
their buttons; a locked row's chip wraps only when its name is long; one wording for reuse ("Reuse a past tournament's
setup" in the New tournament window and on the draft board; the finished board keeps "Reuse this setup for next
year"); the public page keeps its tab icons, its one-card banner and the sport's word ("First pitch in"); ask 6 now
names the Messages / Communications split; the board's Teams card drops its repeating count. Noted: the coach banner's
"Free to start" is today's copy for `/marketing` at the build (R9); the Oct 2027 drawing's registration and payment
locks exist because that event was made on Plus (R2). The asks above are listed as they now stand.

## 12. The build (session 3, 2026-10-16; committed `d82c4118` and help `2157eae6`)

**Preconditions, checked at the start.** The tournament admin redesign closed 2026-10-13. Everything this build sits on
is on production: the fix-now copy (`b794d20b`, release 2026-10-13); Event settings in the kit's look (`ae9bdd45`),
imports in Tools only and "one at a time" (release 2026-10-13); "Not tracked here" shows no payments (`a9432400`) and
one team, one entry (`2b1fe65a`, release 2026-10-16). Add team's account check is rate-limited (M12): 60 checks per
person per 10 minutes, a limited call reading as "unknown" (the in-memory limiter every route here uses).

**⚖ The build-start rulings (owner, 2026-10-16).** Each was asked with a recommendation; the answers as given:
- **B1 — no mechanism for older events.** Owner: *"there shouldn't be any free tier events in prod at this moment so this
  should not be a concern. feel free to validate if you wish."* Validated read-only on production the same day: one
  free organization and one Premium coach organization; **no event on the free plan**; the coach's one event is a draft
  with no teams (created 2026-09-14). So R8 needs no stamp and no migration: **every free and coach event follows the
  invite-only rules from the build.** The promote re-counts production first (a free sign-up could start an event
  before then). R2's state (an event that holds registration-era records on a free or coach organization) is still
  built, read from the event's own data.
- **B2 — the server refuses too** (as recommended): on an invite-only event the server refuses each hidden area's writes;
  reads stay; the hidden pages send the host to the dashboard.
- **Coach emails — three lock lines** (as recommended; a delta found at the build start). M5 drew the game-day reminder
  as the one open switch on free, but `/strategy` ruled the same day (`BUSINESS_DECISIONS.md` 2026-10-16, A46) that it
  stays Tournament Plus, and the product schedules it only through the publish email (Tournament Plus). An open switch
  would do nothing (R5). On free the card holds no switch: three lock lines (the publish email, the game-day reminder,
  the final results email). **Revised by the owner 2026-10-16, during the walk:** no Coach emails card on free at all —
  "if everything is locked here, I don't think we need this coach emails section". Q5's "only what applies" read
  literally: nothing applies, so the card is absent. The publish email keeps its lock in the Publish window, where the
  host reaches for it; the game-day reminder rides on that email; the final results email has no lock anywhere on free.
- **One team, one entry at the claim — on every plan** (as recommended; a delta: the build prompt asked for it, while §14
  of `COACH_REGISTER_EXISTING_TEAM_PLAN.md` had left the claim as "an owner call if it is ever seen"). In the claim
  window a team already in the tournament is greyed and cannot be chosen, and the server refuses the link. **Add team by
  hand keeps the name rule only** (§14: an organizer may enter one team twice on purpose).
- **B3 — today's "team added" email becomes the invitation** on an invite-only event, in `/marketing`'s words; paid events
  keep today's email.
- **Spots — none on free** (as recommended; a delta: no drawing covers Divisions). On an invite-only event the Divisions
  screen and New tournament's divisions step drop the capacity box and count teams ("8 teams"), as the public page and
  the board's Teams card do. Nothing enforces capacity when the host adds a team. Paid events are unchanged.

**Found at the build start, handled without a ruling:**
- Free hides the Fees card, so a new invite-only event is created as "Not tracked here": the prompt's "reuse that state"
  (its list item 1) — every screen that already hides payments for "Not tracked here" hides them on free with no second
  path. (First read at the build start as an activation trap; it is not one: activation needs dates, a division and a
  contact only, and the fee model is a step on the draft board's checklist, which goes on free.) An invite-only event
  whose fee model was never chosen (made before the build) shows no payments either: `eventPayments` reads it as none.
- The public home page's Register button ignored the switch that hides the Registration page (the nav pill and the
  other pages honoured it). Hiding registration on free closes it for every plan.
- Dev's registration test events sit on the free test club (`uat-test-org`): after the build they follow the free
  rules, so registration testing on dev moves to a Tournament Plus club (several have open events), and the UAT specs
  that exercise registration, payments or check-in on the free club move to the Plus club.

**Words.** `/marketing` approved every word for the build the same day (`docs/agents/brand/PRICING_PAGE_COPY.md`, the top
entry), changing three drafts: no product sentence says "free plan"; Add team says "claim", not "accept"; the reminder's
lock reads "Email every team a game-day reminder". They live in `lib/invite-only-words.ts` (the composer's targeting
lock and "To each team's coach" stay in `lib/communication-words.ts`, their one home).

### 12.1 As built (2026-10-16)

**The rule.** `lib/invite-only-event.ts` answers, per plan and per event: `runsInviteOnlyEvents`, `eventAreas` (which
areas an event shows), `eventPayments` (`edit` on a plan with payment tracking; `read` on an invite-only event whose fee
model was set under one — R2; `none` otherwise, including an invite-only event whose fee model was never chosen),
`statusChangeAllowed` and `teamUpdateAllowed` (the server's holds), `holdsRegistrationRecords` (R2), `volunteerShut`.
Unit-tested across free new, free with records, coach new, coach with records, Tournament Plus and a Founding Season
comp still on free (`tests/unit/invite-only-event.test.ts`).

**The gate (`/billing`).** Four new Tournament Plus keys — `open_registration`, `payment_tracking`, `team_check_in`,
`tournament_volunteers`; `bulk_registration_actions` and `waitlist_collection` moved to Tournament Plus; eight keys with
nothing behind them removed (F14). `team` keeps only its PDF grants. `foundingSeasonLockUntil` (plan-config) is the one
rule for the Founding Season line; `useFoundingSeasonLock` asks the status route once per organization, only on free.

**Part by part.**
- **Server (B2):** public registration submit, status changes (only a waiting team's answer on an invite-only event,
  M10), payment and check-in writes, Select many's registration and payment actions, the check-in route's writes, the
  volunteer role (no longer offered or assignable on free; a volunteer on free meets a wall at the scorekeeper and the
  gate, and the score write refuses them), and the hidden pages (Check-in, Staff kit, Chat, Summary → the dashboard; the
  public Register page → the event's home). A new invite-only event is created "Not tracked here".
- **Nav (M6):** no Check-in, Staff kit or Chat; no Summary row on a plan without Summary; the live phone bar is Dashboard
  · Results · Schedule · Messages (Dashboard first, owner 10-16); no "Open dashboard" in More where Dashboard is a tab; no Chat count; the context strip
  never offers "N teams to review" on an invite-only event.
- **Teams (M1, M2, M7, M8):** a clean invite-only event — no At a glance, Filter, Payment column, review or waitlist bands;
  pool bands only, no band without pools; "No email" in amber; Select many only on a pool division (Move to pool only);
  the Export menu one locked row (a coach's event: PDF open, Excel and CSV one locked row, the PDF made in the browser on
  the plan's PDF grant); Add team in invitation words, the box ticked whenever there is an email; the record with no
  chip or Registration section, "Added", "Resend the invitation". An event carrying registration-era records (R2) keeps
  today's bands and Filter, its payments read-only with "Record payments" as the lock, its waiting teams answerable, and
  "Registration closed" (dateless — Founding Season Phase 3 can pass the date) with "Reopen registration" as the lock.
- **The invitation (B3):** today's team-added email, reworded, on an invite-only event (Add team and Resend).
- **The claim (every plan):** a team already in the tournament is not offered and the server refuses the link.
- **Event settings (screen 3, M5 as ruled):** no Registration questions or Fees & payments card; Contact without alert
  routing ("Contact public"); no Coach emails card (owner, the walk 10-16 — it was three lock lines, "No auto emails";
  the words were retired with it). Registration emails never fire on an
  invite-only event (a waiting team's coach is told by the bell).
- **No spots:** Divisions (list, window, foot), New tournament's divisions step and its preview.
- **Boards (screen 4):** the Teams card ("8 teams · 2 pools"); no Payments or Coaches card; the draft board's reuse as
  the one lock line, no fees step. The finished board's foot has no money because a free event tracks none.
- **Public site (screens 6–7, R6):** no Registration switch; one branding lock line; no registration words, Register
  button or Register page; Teams as a count; the free badge and banner on a Premium coach's event. The home page's
  Register button now honours a hidden Registration page on every plan (a gap found at the build start).
- **Locks (specimen 8, M9):** Schedule and Results PDFs as the Tools-menu lock; New tournament's reuse step as one lock
  line with M4's sentence; the Founding Season line under a lock line and once at a Tools menu's foot.
- **Composer (M11):** the limit line; the day's emails used (the box off, with the time the next may go); over 100
  people (Send switched off, the reason at the foot's left). The send's refusals say the same words. **Revised in the
  walk (owner, 2026-10-16):** the composer's three lock lines start at the window's left edge — Show under and choose
  teams no longer step in with their choice's options — and, product-wide, **every upgrade link opens the plan's panel
  as a drawer over the page it is on, never navigating away** (a message half-written stays; Ctrl/⌘-click still opens
  Plan & billing). The owner first asked for the composer's locks to be plain words, then reversed that to this.
  Recorded as an amendment to the 2026-09-30 lock-line decision.
- **Scores (M3):** Field scores stays for the host, admins and staff; one rule (`scoreHeldForReview`) decides both the
  hold and the screen's words, so the host sees "Finalize score" when the score saves final.

**Verified (2026-10-16, after /simplify and /review):** typecheck clean; focused lint 0 errors and no warning on an added
line; unit 7,541 of 7,543 — the two failures are other sessions' files, already failing (the coach portal's colour tier,
Club 6c's rail scrollbar); five guards moved here to the ruled behaviour (Public site, Chat, the volunteer shells, the
create insert, the payments census); spelling, CSS purity, contrast, dates, dictionary,
snapshots, schema parity, observability, demos (the tour anchors stand) and the export catalog green; CSS selectors and
the admin-old-look check fail only on other sessions' files (GuidanceRail `.context`, house league).

**/simplify (2026-10-16, four lenses: reuse, simplification, efficiency, altitude).** Applied: the claim loads the
coach's teams once and hands them to the link; the composer's preview reads its count and its email day at once; the
lock hook's status read skips the billing facts (`compOnly`); one named predicate for the free credit
(`showsFreeCredit`, plan-config); `pluralize` for "8 teams · 2 pools"; one amber rule for "No email" and an amount owed,
one type rule for the composer's limit lines; `CompactUpsell` deleted (its last caller went; the old-look baseline
locked in its drop); the rule's record trimmed to what is read (no `registration`, `waitlist`, `spots`); `useAbsentArea`
asks the rule by the area's name, as the nav does; one lock-name markup (`PlanLockName`) for every menu's locked row and
Tournament Plus as the lock's default plan; ExportMenu's lock decided once with no fragment spanning the menu; one
invite state (`clean` · `carried`) passed whole to the record; `guardExport` reads the export lock; `divisionsLine`
says "no spots" itself. Skipped (followups): deleting `UpgradeGate` (the `/billing` and `/marketing` agent files name
it — the owner's call); one plan-aware public tournament loader in `lib/db` (wider than this build); a shared
Founding Season status fetcher for the billing page and /pricing (outside the diff).

**/review (2026-10-16, high-risk tier, four lenses: correctness, security and gating, contracts, regression).** No
Critical. Verified and fixed: **High** — a volunteer on a free or coach plan could still score, forfeit or revert through
the admin games route (only the scorekeeper's route held them); now refused there too. **Medium** — fee settings and a
division's fees could still be written on a free event by a direct request (the screens hid them), which would have
faked an R2 state: on a plan without payment tracking the stored values now stay (the settings page saves its whole
form, so they are kept rather than refused); a division made in New tournament stored the wizard's hidden default of 8
spots (now none on an invite-only event); opening or closing registration is refused on an invite-only event; posting
in a tournament chat room whose organization no longer carries Chat is refused ("This conversation is closed."), the
history readable; "0 teams" in New tournament's divisions step on a phone (a division with no count now says only its
ages). **Low** — the claim asks an entry's tournament only for that entry's own coach; no export before the
organization is known; the Founding Season foot only under a locked row; the check-in family's other columns count as
check-in writes; League and Club now guarded to keep every area. Accepted or noted: a team added on free is stored
`pending` (its host's own team `paid`, as always) — nothing shows either on a "Not tracked here" event; Accept on a
carried event does not raise the context strip's "to review" (ruled: never on an invite-only event); brief layout
flashes while an organization loads (the admin frame hands the organization in from the server, so the window is a
first render at most). **Pre-existing, found and reported, not fixed here:** the team update route writes any column
it is sent (no allow-list), so an admin who knows another organization's tournament id could move a team into it —
recommended as its own small security fix, like F11. **Fixed as its own change 2026-10-16:** the update writes only
what the Teams screen edits, and the same route's promote and swap were closed too (TEAM_UPDATE_ALLOWLIST_FIX_PROMPT.md
§ Outcome; the commit and release are recorded there and on its TODO line). Production on 2026-10-16 (read-only, after the build): no free or
coach event, no free League floor, no unknown plan id, no volunteer on a free or coach plan.

**/docs (2026-10-16):** the in-app help says what the invite-only event does — Teams and registration (a new
"Free plan: teams join by invitation" topic; Add team, the invitation, "No email", Resend, one team one entry on the
claim), divisions without spots, Event settings' five cards and Coach emails' three lock lines, the board's Teams
card, scores on Field scores for the host and up to two admins or staff, the composer's limit line, no Chat, the
Public site's Pages, the Teams export's one locked row, the volunteer and seat answers on Settings & access, and a
Premium coach's invite-only event and claim. Tournament Plus descriptions are kept beside each plan line. Spelling
and the help tests pass (19 of 19). **QA:** the walk is the hub's QA walk tab (hub v7), Owner QA Ledger §320.

### 12.3 The website’s words (/marketing, 2026-10-16)

**Committed `c064ea4c` 2026-10-16** (owner: all 43 as recommended, on the hub’s Words tab, hub v11). Every surface that
described the old free plan now says free is the invite-only event: the plan cards (home, `/pricing`, onboarding’s plan
choice), `/for-tournament-organizers`, `/for-coaches`, `/start`, the header menu, `/start/tournament`, the Premium sign-up
page, Plan & billing and the two Tournament Plus emails. Tournament Plus leads with public registration, fees and payment
tracking, then check-in and volunteers (R9); the Premium Coaches Portal says it includes one hosted tournament at a time.
The Tournament Plus article’s list is also the panel every padlock opens, so the panel changed with the organizer page
(the marketing prompt said the build had written that panel; it had not). Brand canon: Segment 1’s promise is Tournament
Plus’s story, and the free line is “Host an invite-only event free: add your teams, build the schedule, post live
scores.” Words and reasons: `PRICING_PAGE_COPY.md`, “The free Tournament plan on every page”. Gates: spelling, lint,
typecheck, the marketing screenshots check and 253 related unit tests. Closed the same day on the owner’s word (“update those 2 open items to your recommendations”): the brand docs’ 2026
Founding Season date and six “carries over” bridge lines, and `/for-coaches`’ “No org account required” (now “Your club
doesn’t need to be on FieldLogicHQ.”). **The release’s
precondition is met**; the release-note line is in the copy record.
