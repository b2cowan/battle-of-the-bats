# PM Brief — Tournament Seam Phase 3 ("cohesion & polish")

**Status:** Owner-approved scope 2026-07-22 · **Plan:** `TOURNAMENT_SEAM_P3_PLAN.md` · **Prior phases:** P1 + P2 committed on dev

## What this phase is
The polish tail of the coach/admin/scorekeeper seam review — four small "the door isn't there" fixes. No new product surfaces; we add missing doors and a safety net.

## What users see and do differently
1. **A dead field connection no longer looks broken.** A coach, admin, or scorekeeper who opens the app with no signal now sees a branded "You're offline — Try again" screen (with a retry that reloads what they wanted) instead of the browser's raw error page. *Today: only the public tournament pages have this; signed-in screens don't.*
2. **A run-it-and-coach-it operator can reach their coach view from admin.** Small-club owners who both run the tournament and coach a team get a direct coach door inside admin. *Today: only paid Rep-Teams orgs have that door; a free coach has to leave to the public page.*
3. **A phone admin can reach their own chat and account from admin.** The mobile admin menu gains Chat, Account, and Home doors. *Today: a single-org admin on mobile can't reach either from inside admin.*
4. **A coach who's also an admin can get back to admin.** The coach portal gains a "Back to admin" door (shown only to admins). *Today: the only way out is "All workspaces."*

## Why it matters
These are the review's remaining confirmed seam gaps after the higher-severity P1/P2 fixes: a game-day resilience hole (no offline story on the screens volunteers actually use at fields) and three missing doors that force the platform's *default* customer — the single-org, run-it-and-coach-it operator — to leave and re-enter to switch hats.

## Tradeoffs / decisions
- **Offline shell shows a fixed generic page, never cached private data.** That's deliberate: private screens must never be stored and replayed to the next person on a shared device. So the offline screen is a safety net + retry, not a cached copy of your data.
- **Three lower-value items were deferred** (owner call): auto-redirecting signed-in users off the marketing root (arguably intentional), filtering mobile admin tabs by permission (low impact), and unifying an internal "primary identity" rule (invisible refactor).

## Who's affected
- **Volunteer scorekeepers, coaches, admins at patchy-signal venues** — the offline shell.
- **Free-tier owners who also coach** — the admin coach door + the portal→admin backlink.
- **Single-org admins on mobile** — the chat/account doors.

## Success criteria
1. Offline on a signed-in screen shows the branded shell + working retry; online behavior is unchanged; no private data is ever served offline.
2. A free coach who's an admin sees a working coach door in admin; a non-coach admin does not.
3. A mobile admin reaches Chat and Account from the admin menu.
4. An admin-coach sees "Back to admin" in the portal; a non-admin coach does not.

## Handoff note
Shipping the offline change updates the installed app's background worker, so devices need a one-time refresh after deploy (normal for offline changes). No database change.
