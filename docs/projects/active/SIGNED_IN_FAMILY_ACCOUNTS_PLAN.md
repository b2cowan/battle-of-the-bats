# Signed-in family accounts — Implementation Plan

**Status:** Planned, nothing built (owner rulings 2026-10-31).
**Decision of record:** `docs/agents/strategy/BUSINESS_DECISIONS.md` — 2026-10-31 "A family gets an account when their child
is PLACED ON A TEAM…" (amends 2026-10-29 "The end state is an app where everyone signs in").
**PM brief:** `SIGNED_IN_FAMILY_ACCOUNTS_PM_BRIEF.md`
**Inputs:** the census `SIGNED_IN_FAMILY_CENSUS.md` (every door, with its `path:line`) · the findings page
https://claude.ai/artifact/89YK6LSVhBxPnzFnrRZtpo · the journeys page https://claude.ai/artifact/QmPoKvcyF3Bg1xpjCWw54C
(source `SIGNED_IN_FAMILY_JOURNEYS.html`: who gets an account when, each journey after these fixes and in the end state).

## The rule this plan builds

An account arrives when there is something in it for the person:

| Who | Account | When |
|---|---|---|
| House-league parent | yes | when the child is **placed on a team** — the placement email is the invitation |
| Rep parent | yes | when the child is on the roster (the existing guardian invite) |
| Tournament coach | yes | at registration (already built; unchanged) |
| House-league volunteer coach | yes | at the coach invite (already built) |
| Tournament parent, fan | never needed | optional, only so follows and alerts carry across devices |
| Tryout volunteer scorer | never | the 48-hour scoring link stays |

**Sent links that stay:** the family's "Your sign-up" pay link (hardened), the family unsubscribe link, a tournament team's
pay link, the tryout scoring link. **No other link is ever sent to a family.** RSVP is answered in the app; a calendar feed is
made inside the app.

## Stages, in dependency order

Sequenced by dependency and rework risk, not by date. Each stage that changes what someone sees is **drawn first**
(an HTML drawings page through `/design`, owner asks answered) and built to the approved drawing.

### Stage 1 — Harden the "Your sign-up" door (house league) · no prerequisite

> **Built 2026-11-01.** Session 1 (Parts 1–4) committed `d79603110` (mig 419, dev only). Session 2 (Parts 5–8) built
> 2026-11-01, walk §437 PASSED 17/17, committed `0e8294ddf` 2026-11-01, no new migration. Before the promote that carries
> Stage 1: mig 419 to prod, UNSUBSCRIBE_SECRET confirmed in Amplify, prod's customised family templates checked. What shipped, and the differences from the items below (no
> separate family secret; a second address leak in the pay block masked; marketing sends refused without the unsubscribe
> secret): the build prompt's ▶ Progress block, `SIGNED_IN_FAMILY_STAGE1_BUILD_PROMPT.md`.

The status / pay / withdraw page (census F3, F4, F5) becomes the permanent pre-team door.

1. **One name.** Every house-league family email carries one button, "Your sign-up", in place of "Check your registration",
   "Pay now" and "View your receipt" (`lib/email.ts:907-911`, `lib/house-league-placement-mail.ts:42-44` and the other senders
   listed in census F4).
2. **First names only** on the page opened by the link.
3. **The link ends when the season ends.** Today it is an HMAC over the registration id, never stored, never expiring
   (`lib/league-pay-link.ts:2,24,64`). Ending it and resetting it one family at a time needs **per-registration state** — a
   stored hashed token (the `lib/no-login-token.ts` pattern) or a version number folded into the HMAC. **A migration:**
   dictionary + snapshots in the same unit of work. The tournament team pay link (N2) shares the secret today; separate them
   so a reset never touches a tournament.
4. **The club can reset one family's link** from the registration (a new link is emailed; the old one stops).
5. **No pay button when nothing is owed** — the placement email and the moved-team email stop sending a pay link to a family
   that owes nothing (census F4: "sent even when nothing is owed").
6. **"Email me my link"** replaces the email + 8-character reference lookup (`status-lookup/route.ts:37`, match :84). The
   family types their email; if a sign-up exists the link goes **to that inbox only**; the screen says the same thing either
   way (no "no such email" disclosure). The reference stays on every email as a number to quote to the club; it unlocks
   nothing. The withdraw request (F5) accepts the link only, no longer the code (:40).
7. **Unsubscribe secret fix** (census §6): `lib/unsubscribe-token.ts:13-20` refuses to sign or verify without the secret
   instead of falling back to a fixed string. Confirm the secret is set on production before the release that carries it.

Draw first: the "Your sign-up" page with first names, "Email me my link", the expired-link screen, the club's Reset link door.

**Drawn 2026-11-01** (through `/design`, round 2 applied): source `SIGNED_IN_FAMILY_STAGE1_DRAWINGS.html`, page
https://claude.ai/artifact/P1FrRZ9cyLU1oCUpptCEim.

**Ruled 2026-11-01 (owner, all seven asks A).** Where these differ from items 3–5 above, these win; build to the drawing.
1. **When a link stops:** 30 days after the season is finished (`finished_at`; `season_end_date` is informational and
   nullable), but a family still owing keeps theirs until paid.
2. **Button words:** "Your sign-up" on every email, including the ones asking for money.
3. **Which emails carry the button:** the sign-up confirmation always; every later email only when money is owed.
4. **The club's door:** its own row, "Send a new link", for anyone who can change registrations.
5. **Two ended screens:** "season has finished" with no form; "no longer works" with "Email me my link" right there.
6. **A reset covers the whole sign-up:** it stops every link on that sign-up and sends one new one (the token page shows every
   child sharing `signup_ref` + guardian email, `signupRowsForLink`, so the per-link state in item 3 hangs on the sign-up,
   not one registration — item 4's "one family's link" means the whole sign-up).
7. **Emails keep full names** (first names only applies to the page the link opens).

**Build prompt:** `SIGNED_IN_FAMILY_STAGE1_BUILD_PROMPT.md` (two sessions). It recommends folding a per-registration version
into the existing signed link instead of a stored token, which also makes item 3's "separate the secrets" unnecessary (a reset
never rotates the secret).

### Stage 2 — Tournament registration tidy-up · no prerequisite

Coaches keep their account at registration (unchanged). What changes:

1. **One email, not two**, for a coach whose registration also makes their account (today: a registration email and
   "Your free FieldLogicHQ Coaches Portal account is ready", `lib/email.ts:333`).
2. **An honest finish screen** — it no longer offers to create the account the coach has just made
   (`components/public/RegisterContent.tsx`, the "Create a Password" step).
3. **No email address inside portal links.**
4. **A throttle on the form** (`app/api/register/route.ts:221`), reusing `lib/public-form-throttle.ts`.
5. **Delete the dormant tournament-team claim link** (census N4: `app/coaches/claim/[token]/page.tsx`, the dev seed route
   `app/api/dev/seed/team-claim/route.ts`, its token code). Grep for the table/column; dropping a column is a migration with
   dictionary + snapshots.

Re-verify items 1–3 against the code when the stage starts: they come from the 2026-10-31 trace, not a fresh read.

Draw first: the finish screen and the one email. **Drawing prompt written 2026-11-01:** `SIGNED_IN_FAMILY_STAGE2_DRAWING_PROMPT.md`.

### Stage 3 — An optional second guardian email (house league) · no prerequisite

An optional "Second parent's email" on the house-league sign-up form (F1). Both addresses receive the sign-up emails and,
from Stage 4, the team invitation. Throttle and consent rules apply per address. Migration if the registration has no place
for it (decide from the snapshots, never from migration files).

Draw first: the form field and how the club sees two guardians on a registration.

### Stage 4 — The invitation at team placement; "Your sign-up" inside the app · needs counsel AND Stage 14

1. **Placing a child on a team invites the guardian(s)** — the placement email is the invitation; never a separate
   "create an account" email. Accepting signs the parent in (new or existing account) and links them to the child.
2. The parent's app holds the team's schedule (practices included), team chat, In / Out / Maybe, and a calendar feed made
   inside the app (census F8 pattern: minted signed-in, revocable).
3. **"Your sign-up" also shows inside the app** — the same page, so a grandparent paying from email and a parent in the app
   see one thing.
4. Rewrite `COACH_AVAILABILITY_RSVP_PLAN.md` to the app channel (its emailed-link door is ruled out; banner added
   2026-10-31).

**Blocked by:** the PIPEDA / CASL counsel review (the guardian tier, `GUARDIAN_TIER_ENABLED`, stays off until it clears) and
**Stage 14** (one player across seasons): today the guardian link hangs on a per-season rep roster row (census §4), and house
league has no child record at all. The parent account is a person, not an organization member (10-29 P3 — not yet ruled).

### Stage 5 — Next season pre-filled for a signed-in parent · needs Stage 4

A returning parent who is signed in gets next season's form filled in; the public form stays for everyone else. Never a sent
pre-fill link. This is House League 9f's "returning families" item (`HOUSE_LEAGUE_STAGE9_PLAN.md`, 9f row).

## Not in this plan

- Native app vs installed web app, what the app shares with the public site, which plan the family app belongs to — all
  **open** in the 10-29 entry.
- The per-team unsubscribe for free coaches' families (census D3) — its own open call in `CLUB_FAMILIES_BOOK_PLAN.md`.
- Tryout sign-ups (F2) keep their shape: no account at sign-up; the rep guardian invite at roster is the account moment.

## Verification per stage

`npm run verify:changed`; `npm run typecheck` for Stages 1, 2 and 4 (API and auth contracts); unit tests for the token
changes (expiry, per-family reset, a reset leaves tournament pay links working, "Email me my link" says the same thing for
an unknown email); owner browser walk from a checkable QA page; `/docs` for family and registrar help; `/marketing` for the
email and screen words.
