# PM Brief — Unified App: Consumer Layer ("One Door, Many Rooms")

**Status:** Ready to build — all five decisions below were made by the owner on 2026-07-11 (recommended options across the board) and are logged in the Business Decisions Log. Phase 4 still requires the Canadian privacy review before build.
**Full plan:** `UNIFIED_APP_CONSUMER_LAYER_PLAN.md` · **Mockups:** https://claude.ai/code/artifact/c5bb7403-57fe-4b87-ac84-c17382fe60c7

## What we're building, in one paragraph

Today FieldLogicHQ ships three separate installable apps (admin, per-tournament fan app, scorekeeper), fans have no login anywhere, and a family in three tournaments ends up with three dead-end icons. This project collapses everything into **one FieldLogicHQ app** with one account: anyone can browse everything public with zero login; tapping "Follow" creates a free account that belongs to nothing; a coach-approved (or registration-matched) family link unlocks team chat and practice schedules; coaches — including coaches at events that pay us nothing — get one home; and organizers keep their full admin world, unchanged, behind the same front door. The admin side already exists and is untouched; every new dollar of effort goes to the consumer layer.

## What each person sees differently

- **A grandparent** searches the tournament directory, watches live scores and standings — no account, ever. That never changes.
- **A parent** taps Follow → one-field sign-up → one follow list covering every tournament and season their kids play, on every device, with score/schedule alerts where the organizer's plan includes them. Later, once approved as family on a team, they get team chat and the practice schedule — in a channel coaches and all parents can see (never private adult-to-minor messages), which is our safeguarding pitch against WhatsApp groups.
- **A coach** gets one home for all their hats: free tournament teams, a paid club workspace, and the teams they follow as a parent — plus a one-tap flip inside any tournament between "what parents see" and "what I manage." The two-app juggle at the field ends.
- **An organizer/club admin** keeps the exact admin experience they have today (dense, dark, field-ready — accounting and season scheduling stay desktop-strength). What they gain: their tournament or league becomes a branded *space inside* the app every family already has, a QR sign that deep-links straight into it, and a visible "fans following" number.

## Why it matters

- **It fixes every named pain at the root:** multiple apps per team, no directory, no login on the public side, coach/admin app-juggling, and no path for parents to see private team info.
- **It's the only shape the app stores will ever accept** — per-tournament apps are explicitly against Apple/Google policy; one directory app is Apple's own textbook example of compliance. We're building toward store presence, not away from it.
- **It compounds the funnel we already bet on:** tournaments acquire families → families keep the app all season for house league → clubs buying the Club tier inherit a parent network that's already installed. A separate "tournaments-only" app would cut that loop in half.
- **The timing is free:** with no paying customers, retiring the per-tournament icon costs nothing today and gets expensive later.

## What we're deliberately NOT doing

- Not rebuilding or restyling the admin/ops world, and not promising phone-first accounting — day-of tools shine on mobile, deep back-office stays desktop-leaning.
- Not two apps (ops app + consumer app): doubles what a solo founder maintains and recreates app-juggling for admins who also coach.
- Not a native rewrite — web-first, thin store wrapper later, on evidence.
- Not silently building parent accounts — that was formally deferred on 2026-06-30 and needs a conscious reopening (below).

## Decisions you own (each gets logged before its phase builds)

1. **Ratify the one-app direction + retire per-tournament icons** (branded *space* + QR on-ramp replaces branded *icon*). Unblocks Phases 0–1.
2. **Reconfirm fan push stays Tournament Plus**, with the gate visible in the UI ("alerts not offered by this event"). Unblocks Phase 2.
3. **Reopen the parent-account deferral, narrowed** to verified family + chat + practice visibility. Unblocks Phase 4 (brings the Canadian privacy review with it).
4. **Where the family features monetize** — lean: chat basics free with any coach portal; practice schedule + richer family features ride the Premium Coaches Portal ($29/mo reason-to-buy).
5. **Pre-agree the store-wrap triggers** (credibility ask, iOS push complaints, daily-use coaches) so the store step is a checklist, not a debate.

## Rough sequence and priority

Directory-as-front-door and the one-install identity ship first (small, mostly plumbing/IA). Fan accounts + follows are the first real build. The coach/admin view-flip is navigation work. Verified family is the biggest and most sensitive piece and waits for decisions 3–4. League/club season features then reuse all of it (registration becomes the account-creation moment, and league parents are auto-verified because we already know who registered). Store wrap comes last, on trigger.

## Success looks like

- One icon, one login, one follow list for a three-tournament family.
- A coach flips fan/coach view at the field without switching apps.
- New sign-ups with no team land on a follows feed, never an "are you an organizer?" picker.
- Chat and practice schedules are reachable only through an approved family link, and a privacy audit finds no signed-in content cached on shared devices.
- Free events read as "alerts not offered" — making fan alerts a visible reason for organizers to buy Tournament Plus.
