# /marketing: the free Tournament plan's words, after the invite-only build

> Paste into a fresh session on `dev` and run it as **`/marketing`** (`.claude/commands/marketing.md`). Written
> 2026-10-16 from the owner's task list (Wave 1, item 3). **It must land before the next production release**: the
> release carries the invite-only build (`d82c4118`), and production must not ship a product that does one thing under
> a website that promises another.
>
> This is the follow-through the free tier plan lists as step 6's "Then `/marketing` (the free card, the organizer
> page, the start page, the coach page, the brand promise)" (`FREE_TOURNAMENT_TIER_REVIEW_PLAN.md` §9, and the TODO
> line's "NEXT: `/marketing`'s R9 repositioning"). The urgent false claims were already fixed on 2026-10-12
> (`b794d20b`); this is the repositioning that waited for the build.

## What changed in the product (the facts you write from)

**The one source is `docs/agents/strategy/PLAN_PRICING_FACTS.md`, "The free Tournament plan's inclusions", its "As
built 2026-10-16" paragraph.** Copy from it, never from another page and never from this prompt. In short (verify there):

- **Free = the invite-only event.**
  - The host adds every team; the coach's email is the invitation, and the coach claims the team.
  - Also on free: one event at a time, 3 staff seats, the schedule and bracket by hand, results, announcements, the
    public site with live scores and following, Excel/CSV of the schedule and results, and the Powered-by badge.
- **Moved to Tournament Plus:** public registration, the review queue, the waitlist, Select many, fees and payment
  tracking, check-in, the Staff kit and every volunteer job. Tournament Chat is not on free.
- **A Premium Coaches Portal's included event follows the free plan, plus PDFs**, with the free badge.
- **The ruling behind the words** (decisions log 2026-10-12, "The free Tournament plan is the INVITE-ONLY event", R9):
  registration, fees and payments **lead** Tournament Plus; the Premium portal says it includes one hosted event.

## Surfaces to sweep (a starting list, read 2026-10-16; grep for more)

Each line is a place a visitor or a free organizer reads what free includes. **Read every claim against the Facts doc
list.** Some lines below were already true when this was written, and the home page's free card says in its own comment
that its lines were chosen to stay true. Change only what is now false or now leads with the wrong thing.

- `app/for-tournament-organizers/page.tsx`: the `FREE_FEATURES` list still carries "Standard team registration with
  waitlist collection" and "3 staff / admin seats — volunteers are free and unlimited". The hero says "Register teams,
  build your schedule…" and the meta description says "registration all in one place. Free to start".
- `app/pricing/page.tsx`: the Tournament card, the Tournament Plus card (registration, fees and payments should
  **lead** it, R9), and the FAQ.
- `app/page.tsx`: the Tournament card's tagline "From team registration to final standings" sits under "Free to
  start". Is that still honest for the free floor?
- `app/for-coaches/page.tsx`: "Tournament is free to start — brackets, scheduling, team registration, and live…", and
  wherever the Premium portal's included tournament is described (it is now the invite-only event, plus PDFs).
- `app/(consumer)/start/tournament/page.tsx`: "a dashboard with registration, schedule, brackets, and a public site".
- `components/marketing/TournamentAcquisitionBanner.tsx` (on public tournament pages): "Run an event — free".
- The upgrade email `tournament_plus_upsell` in `lib/email.ts` ("What you're missing on the free plan"): its list
  should now lead with what moved (registration, payments, check-in, volunteers).
- `docs/agents/brand/PRICING_PAGE_COPY.md` (the copy record), and the brand promise in `BRAND_STRATEGY.md` /
  `BRAND_FOUNDATIONS.md`, if either describes the free floor as an open-registration product.
- The pitch slide library and walkthrough pages (platform admin's Pitch Deck Studio and `/pitch`): any slide caption
  or walkthrough line that sells free registration.
- In-product upgrade panels ("what the plan includes", opened from every lock line) were written by the build and
  /docs on 2026-10-16. Read them for consistency with your words; don't rewrite them unless one is false.

Not yours: in-app help (done by `/docs` on 2026-10-16, commit `2157eae6`), the Facts doc and the decisions log (`/strategy`
owns them; if the Facts doc and a page disagree, flag the drift to `/strategy`, never write a new fact), and the demos (the
tournament demo is comped to Tournament Plus, so it is unaffected; if the coach demo's narration describes its hosted
event as having registration, note it for `/demos`).

## Rules that bind the words

- The brand canon in `docs/agents/brand/` (voice, positioning, "community sport", never claiming Canadian identity), and
  the house spellings (`npm run check:spelling`; "8:00 a.m."; one spelling everywhere).
- **Never restate a price or a cap as a fresh number.** Read it from the plan config the page already uses, or point at
  the Facts doc.
- **Say what free IS before what it lacks.** The invite-only event is a real product for a small exhibition event: the
  owner's own framing. Don't write free as a crippled Plus.
- Lock lines and upgrade doors inside the product are the build's; do not move a gate.

## Order of work

1. **Inventory first:** every claim about the free plan or a Premium coach's hosted event, as a table: surface ·
   current words · true / false / leads wrong · proposed words. Grep wider than the list above (`free`, `Free to
   start`, `registration`, `waitlist`, `volunteers`, `check-in`, `payments` across `app/`, `components/marketing/`,
   `lib/email*`, `docs/agents/brand/`).
2. **Publish it as a decision sheet** (a Claude Artifact, owner-voice; load `artifact-design` first). Put each change
   as before and after, grouped by page, with one recommendation each, and include the brand-promise line if it moves.
3. **Owner approves**, then apply the approved words only.
4. Gates: `npm run check:spelling`, `node scripts/capture-marketing-shots.mjs --check` (and recapture any marketing
   shot whose words changed, if the check says so), `npm run lint:focused` on the touched files, `npm run typecheck` if
   any email template changed.
5. **A release-note line for `/release`:** one or two sentences a free organizer understands ("The free Tournament plan
   is now the invite-only event…"). Put it in the hand-off; don't edit the changelog yourself.

## Ship

- Stage explicit paths only; other sessions hold uncommitted changes (notifications, the QA ledger, plans). **Commit
  only on the owner's word**, as its own commit (`copy(free-tier): …`).
- Record it in the free tier plan §12 (a "/marketing" line naming the commit) and on the TODO free-tier line (strike
  "NEXT: /marketing's R9 repositioning"). If `PRICING_PAGE_COPY.md` changed, it rides in the same commit.
- Tell the release session (or the owner) that the release's precondition is met.
