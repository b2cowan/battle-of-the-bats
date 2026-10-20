# Club Tier Stage 4a: one rule, one refusal (build prompt)

> **Written 2026-10-19** by the Stage 4 drawing session, after the owner ruled all 17 asks as recommended. **Paste this into a new
> chat on `dev`.** 4a is the first of five Stage 4 builds (4a → 4b → 4c → 4d sponsors, plus 4e a club's own web address; Ask 12).
> It is mostly server work plus one new page. 4b (the new look) and 4c (the editor, the coach's door) come after it with their own
> prompts; do not build their parts here.

## What 4a makes true

A family who opens any public page of a club that has turned its site off, has been cancelled, or whose plan no longer carries that
page gets **the same plain refusal on every page**, instead of a system error on the home page and a working team page beside it.
A tryout sign-up can no longer be filled in for a club that refuses it. The closed tryout's "Contact us" finally shows the club's real
address. The shortcut addresses stop sending families to the wrong place. A coach who shares their team's page is told when the club's
site is off, so they don't find out from a parent.

## Read first

- **The drawings and the rulings:** https://claude.ai/artifact/QhdgL1QnfRndu4ZAoTB67k (round 2, ruled 2026-10-19: "all 17 asks as
  recommended"). For 4a read: Start here, Today stations 3, 4 and 6, End state section 5 (Refusals) and section 7's second frame
  (the coach's site-off notice), and Asks 5 and 9.
- `CLUB_TIER_PRODUCTION_READINESS_PLAN.md` §6 Stage 4 (the ruled note, the ladder: 4a's row) and §4F (F06, F07, F09).
- `memory/design_decisions.md`, top entry 2026-10-19 "A club's public site…" (the refusal, the names).
- `docs/agents/strategy/BUSINESS_DECISIONS.md`: 2026-10-19 entries (no date for the Club release; customer pages advertise nothing),
  2026-07-22 (the site switch does not gate tournament pages: keep that).
- `AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md`. **CLAUDE.md binds you: broad reading goes to a helper agent, and a helper's summary is
  a lead, not evidence.** Every file:line below was verified on 2026-10-19 at HEAD `74d57373`; re-read before you rely on one.
- This is Next.js 16: read the relevant guide in `node_modules/next/dist/docs/` before writing routing or not-found code. `proxy.ts`
  is the request hook (never a root `middleware.ts`), and **`proxy.ts` deliberately does not run on public org routes**.

## Verified state (leads; re-check)

| What | Today | Where |
|---|---|---|
| Club home | Refuses a cancelled club and a club whose site is off, with `notFound()` → the platform's root not-found page ("[DIAGNOSTIC]: ROUTE_NOT_FOUND · Requested resource is outside the current system scope · Return to Root Node") | `app/[orgSlug]/page.tsx:82-83` · `app/not-found.tsx:18-27` |
| Team page | Checks only that the club and team exist; an unknown team slug silently redirects to a tournament team or the club home | `app/[orgSlug]/teams/[teamSlug]/page.tsx:33-55` |
| Team schedule + feed | One rule (`getPublicTeamSchedule`): Public link, not cancelled, family layer, live season, not archived. No site-switch check. A refused feed returns an empty calendar | `lib/public-team-schedule.ts:28-37` · `teams/[teamSlug]/calendar/route.ts:27-33` |
| Tryout page + its sign-up form | `resolvePublicTryout` checks only that club and team exist. Neither cancelled, site switch nor plan | `lib/public-tryout.ts:28-39` · `components/rep-teams/TryoutLandingView.tsx` · `TryoutRegisterView.tsx` |
| Tryout sign-up (submit) | Refuses a cancelled club (404 "Organization not found") only after the form is filled; accepts a site-off club's sign-ups; no plan check | `app/api/rep-teams/[orgSlug]/[teamSlug]/tryouts/[yearId]/register/route.ts:39-66` |
| League pages | Check cancelled, site switch and the house-league plan (the model to follow); a Club org with no published season shows "No seasons have been published yet. Check back soon." | `lib/public-league.ts:17-22` · `app/[orgSlug]/league/page.tsx:151` |
| Archives index + archive | Check cancelled (and the archive's own club), not the site switch | `archives/page.tsx:14-16` · `archives/[archiveId]/page.tsx:69-73` |
| Closed tryout "Contact us" | Reads `org.contactEmail`, mapped from an `organizations.contact_email` column that does not exist, so it never shows. The real address is `org_public_site_content.contact_email` | `TryoutLandingView.tsx:154-156` · `TryoutRegisterView.tsx:~109` · `lib/server-organizations.ts:60` · `lib/db.ts:~1375` · DATA_DICTIONARY :76, :445 |
| Shortcut addresses | `/teams`, `/news`, `/schedule`, `/standings`, `/rules`, `/register` forward to the club's active tournament, else silently to the club home; `/results` forwards to the tournament's **standings** | `app/[orgSlug]/{teams,news,results,rules,schedule,standings,register}/page.tsx:9-13` |
| The owner's site switch | Settings › "Your public site" (owner only). Its hint promises families "see that the page isn't available"; the offline dialog says turning it off takes "the home page and league pages offline" (its own comment admits team and tryout pages don't check yet) | `components/admin/kit/club/SettingsKit.tsx:407-450, ~416, ~679-681` |
| Coach's Sharing | Team settings › Sharing › Schedule visibility (Staff only / Families / Public link). No word about the club's site switch | `app/[orgSlug]/coaches/teams/[teamId]/settings/page.tsx:64-76, 910-1004` |
| Columns | `organizations.is_public` gates the org home and league; does NOT gate tournament pages or registration; force-cleared on cancel/suspend. `rep_teams.schedule_visibility` lives on the team | DATA_DICTIONARY :115, :2360 |

**Fixtures on dev** (public pages need no sign-in): `uat-rep-club` (Club, public, tryouts open on `15u-aaa`), `qa-cancel-lab` (site off,
billing suspended, a team `qa-lab-u13`), `riverdale-ridge` (**the live coach demo org: site off, active subscription, an OPEN 2027
tryout on `ridge-11u` whose sign-up form accepts sign-ups today**). Credentials: `.env.local` `UAT_REP_CLUB_*`.

## What to build

1. **One question, asked in one place.** A single server helper decides whether a club's public page may render: the club exists, is
   not cancelled, its site is on (`is_public`), and its plan carries what the page shows (rep teams for team and tryout pages, house
   league for league pages, the public site where the page needs it; follow `lib/public-league.ts`'s pattern and the plan-config
   entitlement helpers). Every public club page and route calls it **before rendering anything**: the home, the team page, the team
   feed, every tryout address (including the old season-numbered ones that redirect), the sign-up form, **the sign-up submit**, the
   league pages, the archives index and each archive. `getPublicTeamSchedule` keeps its own Public link / live season rules on top.
   **Tournament pages are out of scope on purpose** (the switch does not gate them, 2026-07-22). A tournament-only org without the
   public-site module keeps its basic home.
2. **One refusal, the same words everywhere.** Club offline, cancelled, or the page not in its plan → a neutral page (End state 5,
   first frame): the club's name said once, one heading, two short sentences, a quiet link to find a club or event. It does not say
   which reason applies. It must be a **real 404 to search engines**. No club page ever again shows the diagnostic screen.
   ⚠ App Router `not-found` does not receive route params, and `proxy.ts` does not run here: read the Next 16 docs for the cleanest
   way to render the club's name on a 404 (a segment `not-found.tsx` under `app/[orgSlug]/` and how `notFound()` thrown from a
   layout bubbles, or rendering the refusal from the page with the correct status). Decide from the docs, and write the reason in a
   comment.
3. **A page the club does not have stays inside its site** (End state 5, second frame): an unknown team address, `/league` for a club
   that runs no house league, Archives with none → "we couldn't find that page" with a way to the club's home (and, once 4b ships,
   the Teams page). An unknown team slug no longer silently redirects. In 4a it wears today's club chrome; 4b restyles it.
4. **The shortcut addresses (Ask 9):** keep forwarding to a running tournament (printed links and QR codes rely on them); with none
   running, show the club's "not found" page instead of going home silently. Find out whether `/results` → standings is intended
   (does the tournament have its own results page?) and fix it if not. `/teams` follows the same rule until 4b turns it into the
   Teams page.
5. **The closed tryout's "Contact us" reads the real address** (`org_public_site_content.contact_email`) on the tryout page and the
   sign-up page. Fix it at the source rather than per page: the nonexistent column mapping is the defect (check every other reader of
   `org.contactEmail`, e.g. `app/api/register/route.ts:~586` already knows).
6. **The coach is told (End state 7, second frame).** In the coach's Team settings › Sharing, when the club's public site is off, one
   sentence under Schedule visibility says the team's public page does not open for anyone right now and that the club's owner turns
   it back on. Read the switch on the server; no new setting. (4c later moves it into the "Your team's public page" door.)
7. **The owner's switch says what it now does.** The Settings hint and the offline dialog: turning the site off takes **every** public
   club page offline (home, teams, tryouts and their sign-up, league, archives, the team calendar feed), never the tournaments.
8. **Words:** every new sentence (the refusal, the not-found, the coach's notice, the switch's hint and dialog) goes through
   `/marketing` **before** you write it into code. The drawings carry placement text; start from it. House rules: "8:00 a.m.", the
   bare possessive, sentence case, `npm run check:spelling`.

## Before shipping: the demo

The coach demo club (`riverdale-ridge`) has its site off and a live public tryout. After 4a its team and tryout pages refuse.
Find out whether the demo tour (or its dock lines) visits them: `npm run check:demos` and the tour files under the demo code
(`lib/demo-org.ts` and what it imports). The build already fails if a tour destination stops existing. If one breaks, do **not**
re-seed production by hand (owner 2026-09-13); the fix is the demo's seed (turn its site on, if that is right for the demo) or the
tour, and the demo rebuilds itself on the next master build. Report what you found to the owner either way.

## Definition of done

- **Tests that fail on today's code, written first and run red before the fix** (record the red run in your hand-off):
  - every public club page and route refuses a cancelled club, a site-off club and a plan that does not carry it, before rendering
    (unit tests on the helper + a source-scan guard that every route under `app/[orgSlug]` outside tournaments, admin, coaches and
    the volunteer tools calls it, so a future page cannot skip it), **including the sign-up submit and the team feed** (F06);
  - the archives index and an archive refuse a site-off club (F07);
  - the closed tryout's Contact us reads the public-site contact address (F09);
  - no club route renders the diagnostic not-found text;
  - the shortcut addresses' rule.
- Tournament pages still render for a site-off club (a test, so the carve-out cannot drift).
- `npm run typecheck` (run `npx next typegen` first), `npm run verify:changed`, the full `npm test` before the commit.
- The dev server restarted once at hand-off (new files, a shared helper), then `npm run check:layout --changed` on the touched public
  pages, Warm and Dark where applicable.
- `/review` offered (security-adjacent: an access rule across every public route). `/docs` offered for the "Your public site" help
  article (the switch now takes every public club page offline).
- The demo check above, reported.
- **No walk for 4a alone:** the owner ruled one Stage 4 walk after 4c (Ask 12). Hand the owner a short "try it" list instead (three
  addresses on dev: a live club's team, `qa-cancel-lab`'s team, an unknown team slug).
- Records: the Club plan's Stage 4 ladder row for 4a (with the commit), the TODO Club line, the project index
  (https://claude.ai/artifact/MBKRySURVFu3V9cZJvmjVr, `stages/s4` anchor + one `log` row, read first, `if_version` on every write),
  memory `project_club_tier_readiness`.

## Before any code

Per `AGENCY_RULES.md`: a short task list, then the product-manager summary (what a family, a coach and an owner see differently;
roles: only the owner turns the site on and off; admins see the same pages as everyone). Then build.

## Do not

- Build 4b, 4c, 4d or 4e: the new look, the Teams page, the club Tryouts page, the editor, the coach's door, sponsors, the club notice,
  born-in years, custom domains. 4a's pages keep today's look.
- Touch tournament public pages, the admin editor, or the platform's own root not-found page beyond what club routes need.
- Change a price, a plan or a gate's meaning; write customer copy without `/marketing`; seed or reseed without the owner's yes;
  write to production.
- Change shared agent automation or the database checks (`AGENCY_RULES.md`).

## Git

`git rev-parse --abbrev-ref HEAD` is `dev`. The tree is shared: other sessions leave files modified **and staged**. Stage explicit
paths only; if anyone else's files are staged, commit through a private index (`GIT_INDEX_FILE`) holding only yours, then reset
just your paths in the shared index. Confirm with `git show --stat HEAD`. **Commit only when the owner says**, locally; do not push.
