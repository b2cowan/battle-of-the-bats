# Club Tier Readiness, Stage 4c-2 Part B: build the coach's side

> **Written 2026-10-22**, right after walk A (Owner QA Ledger §360) passed 66/66. **Paste this into a new chat on `dev`.**
> It is a thin layer over `CLUB_TIER_STAGE4C2_BUILD_PROMPT.md`: that file's **"The ruled spec"** (the coach's side, the head coach's
> tryout address, the setup line), **"What to build, Part B"**, **"Definition of done"** and **"Do not"** are the spec and still
> hold. Read them first. **This file only says what changed since that one was written.** Where the two disagree, this one wins.
> The drawings are ruled (all 13 asks as recommended): https://claude.ai/artifact/2HDwoGLtFS8ACuq2CuSbNn plus the Stage 4 frames
> https://claude.ai/artifact/QhdgL1QnfRndu4ZAoTB67k (End state › 7 the coach's door, › 3 the team page's Coaches).

## What Part B makes true

- A head coach shares the team's public page from Team settings (address, Copy link, Open) and chooses whether their own name
  and role appear on it. Each coach decides for themselves, off by default, and it ends when their role ends.
- A head coach can give the team's tryout page their own address for families' questions. It ends by itself with their head-coach
  role. The club sees it on the team's Tryouts page and can put the club's address back.
- A family writing about a tryout reaches the person running that team's tryouts, only on that team's own tryout page.
- A coach is told, under their tryout days, that anyone can see those days before sign-ups open.

## What has changed since the long prompt was written (re-check each; other sessions share this tree)

| Fact | Now |
|---|---|
| Part 0 (the words) | **Done.** `CLUB_TIER_STAGE4C2_COPY.md` already holds Part B's words. **Two lines wait for the owner and are asked first, before any code:** **F7** (the name switch's hint: ruled as "Your name and role only. Families' questions go to the club.", but that becomes untrue on a tryout page once a head coach sets an address; `/marketing` proposes "Your name and role only. Never your email or phone.") and **H7** (the role-address nudge: the drawing put it *in place of* the hint; the copy keeps the hint and adds the nudge beneath it). |
| Part A | Built and committed (`2fcf5efdd`, the words `1339b4bb1`), walk §360 passed 66/66. Migration **349** (birth years, the cut-off, the blurb cap) is **dev only**. Part B's migration takes the **next free number after the latest in `supabase/migrations/`** (349 today; check). Both go in `MANUAL_PROD_STEPS`, applied before the code ships. |
| Public team page | **Owner ruling 2026-10-20: the public team page shows games only**, never practices or team events, in the page and the feed; the coach's setting is named "Public". The door's sentence in the long prompt says "the schedule"; **use the corrected F4 wording in the copy doc (HR-11), not the drawing's.** |
| Settings | The "When birthdays count from" card is owner only. Not Part B's concern, except that no coach-side door may link a coach to it. |
| Coach portal | Stage 7d (the coach's Tournaments) was committed after the long prompt was written (`427a4b215`) and changed many coach-portal files, plus `lib/coach-registration-access.ts`. Re-read any coach file before editing it. |
| The coach's tryout page | Part A's blurb already shows on the family tryout page while open and not open yet. Part B adds the contact line beside it; do not disturb the blurb. |
| Another session | The tryout blurb's "How families see it" preview (admin side) is being edited in a separate chat; leave its files alone. |

The long prompt's "Verified state" table rows for **Coach Sharing, Staff, Coach tryout setup, Existing "never a player" guards,
Contact pieces and Guards that fail by design** are Part B's; **re-verify them against the code** (line numbers have moved).
The rows for birth years, the blurb, the past-year hint and the public born lines are now Part A as built.

## Before any code (the gate)

1. **Ask the owner F7 and H7** (above). One short question each, with the proposal, as the copy doc words them. Do not build the
   name switch or the questions row until both are answered.
2. **Present the product-manager UX summary** for Part B (AGENCY_RULES; blocking): what a head coach, an assistant coach, the club
   admin and a parent each see and do differently, and who can do what.
3. **Schema through `/db` (and `/dba` for shapes).** The long prompt proposes two Part B pieces; the agent decides and records why:
   `rep_team_staff_memberships.show_name_public` (boolean, default false), and the team's tryout address (per team, across
   seasons): address, the setting membership, set-at, plus the club's reset date and person. Then `DATA_DICTIONARY.md` in the same
   unit, `npm run refresh:snapshots`, `MANUAL_PROD_STEPS`.
4. **Check the head coach's rules in code, not the plan:** which role a "head coach" is (`coach_role`, not the tryouts capability),
   and what removal and demotion do today (`removeStaffMember`, `setStaffMemberRole` in `lib/coach-membership.ts`). A team may
   have several head coaches; the address belongs to whoever set it.

## What to build

Exactly the long prompt's **"Part B — the coach's side"** items 1–6: the door; the name switch and Coaches on the team page; the
tryout address (coach route, questions row with its seven drawn states, the admin line and its window, the club's reset noted on
the coach's row); ends-with-the-role twice over (public read plus clearing on removal and demotion, a test per path); the family
page by state (Copy built like Directions, the phone guard extended, a new guard keeping the coach's address off the footer, the
club Tryouts page, the team page, the sign-up form, every share card, JSON-LD and the link preview); the setup line and the new
empty text.

## Fixtures (ask the owner before changing any seed; never seed mid-sweep)

Rebuilding the main fixture club resets every saved sign-in, so Part B's coaches go on **UAT Lakeshore Lynx**, the rep-only club
(`buildRepOnlyClub` in `scripts/seed-club-fixture.mjs`). Needed: a team with a head coach and an active assistant (one name switch
on, one off); one open team with a head coach's tryout address and one without. Birth years and the blurbs already exist from
Part A. Propose the smallest set, get a yes, then seed.

## Definition of done

As the long prompt, with this addition: **`npm test` currently has one failure that is not Part B's** (the tournament Teams
page's "one side for search" check in `tests/unit/tournament-stage3-part7-guard.test.ts`, failing at the time of writing). Confirm
whether it is still red before you start, and report it rather than fixing it inside Part B. Walk B is its own checkable Artifact
(the door, names, the tryout address, the setup line), with a phone pass of the family pages. **Sign each walk step in as the
role the step needs and name that role in the step**: walk A's House league section said "admin" where only the owner or a league
admin sees Edit division. Records: the plan's Stage 4 ladder, the TODO 4c-2 line, a new Owner QA Ledger § for walk B, memory
`project_club_tier_readiness`.

## Do not

As the long prompt: no re-deciding the ruled spec (disagree out loud first); no 4d or 4e; no §356 c2 wording pass on the sign-up
flow; no coach email on any public page except the team's own tryout page as ruled; no player on any public page; no navigation
change; no copy without `/marketing`; no writes to prod; no change to shared agent automation or the database checks.

## Git

One shared branch, `dev`. Stage explicit paths only; other sessions' edits sit in TODO, the plan, the ledger and the design log,
so commit your hunks only. Check `git show --stat HEAD` after each commit. No push without the owner's word.
