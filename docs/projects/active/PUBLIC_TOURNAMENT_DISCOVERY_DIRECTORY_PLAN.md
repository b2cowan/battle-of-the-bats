# Public Tournament Discovery Directory (Web) — Implementation Plan

> **Status:** Planning
> **Created:** 2026-06-28
> **Branch:** dev
> **Strategy source:** `docs/agents/strategy/BUSINESS_DECISIONS.md` — entry **2026-06-28 "Mobile app + public tournament discovery"** (Status: Proposed). This plan is the **first concrete piece** of that direction: the opt-in public discovery directory on web. Native store-wrap, surface-unification, and the notification-reliability pass are **later, separate phases — out of scope here** (noted at the bottom only).

## Goal

Ship a public, SEO-indexable, shareable **web directory** that lists tournaments from across the whole platform — searchable/filterable by sport, location, and date — with every entry linking to that tournament's **existing** public page. Listing is **opt-in per tournament, default OFF** (youth-sport / PIPEDA safeguard). The directory is an **index over what already exists**, reusing the platform's current public-tournament visibility and PII rules — not a second visibility model and not a rebuild of tournament pages. It is the marketing flywheel and the future app's logged-out front door, so it must work as plain web first.

## PM Brief

**What it does:** A single public web page where anyone (no login) can browse opted-in tournaments from across the platform, search/filter by sport/location/date, and tap through to that tournament's existing live public page. Organizers choose, per tournament, whether to be listed; nothing appears unless deliberately switched on.

**Why it matters:** The marketing flywheel from the 2026-06-28 strategy decision — more discoverable tournaments → more fans browsing → more organizers wanting in. Also the future app's logged-out front door. Web-first so it's Google-findable and link-shareable.

**Who benefits:** Fans/parents/players (one place to find tournaments); organizers (free top-of-funnel exposure); the platform (SEO + network-effect growth asset, valuable whether or not the native app ships).

**Expected impact:** Organizers get a new opt-in switch in Event Settings (default off) with a plain "what becomes visible" note. Anyone can browse a searchable directory and click into existing public pages. Privacy rules unchanged — directory only links to already-public pages; player PII stays behind login.

**Priority:** High — highest-leverage first piece of the mobile/discovery strategy; helps the platform independently of the app.

**Success criteria:** Organizers can opt a tournament in/out; the directory shows only opted-in + already-public tournaments with working search/filter; each entry links to the correct tournament page; the directory and every listed tournament are crawlable and in a sitemap; no PII exposure; no pricing change.

---

## Current-state findings (what we reuse, what's wrong today)

This is **not greenfield** — a partial surface already exists and is linked in the marketing nav/footer. The work re-bases it onto the opt-in model.

**Reuse as-is (do not reinvent):**
- **Public tournament pages** live at `app/[orgSlug]/[tournamentSlug]/` (home, schedule, standings, teams, results, rules, news). The directory links *into* these.
- **Visibility model = `tournaments.status`.** `lib/public-tournament-data.ts` defines `PUBLIC_STATUSES = {'active','completed'}`; `getPublicTournamentBySlug` (`lib/db.ts`) only returns `status IN ('active','completed')`. `draft`/`archived` have **no public page**. There is **no** separate `published`/`is_public` flag on tournaments — making a tournament `active` *is* publishing. **The directory ANDs the new opt-in flag with this existing status gate** — a flagged-but-draft tournament still never appears.
- **PII model.** Public pages already strip player PII: `PublicTeam` (`lib/types.ts`) deliberately excludes roster players, coach email, payment status, admin notes, check-in data; coach names show only when `tournaments.coach_names_show_on_public = true`. The directory surfaces only event-level metadata (name, org, dates, sport, division/team counts, location), so it introduces **no new PII surface**.
- **Sport field.** `tournaments.sport text NOT NULL DEFAULT 'softball'` exists; `lib/sports.ts` (`SportId`, `getSportPack`, `DEFAULT_SPORT`, `OFFERED_SPORT_IDS = ['softball','baseball']`). Multi-sport picker is paused, so most live data is `softball` today — sport filter is built but low-variance until more sports ship (acceptable).
- **Plan gating helpers.** `lib/plan-features.ts` (`hasPlanFeature`, `FEATURE_MIN_PLAN`, `PLAN_RANK`), `lib/plan-config.ts`. Used only **if** the owner gates listing (Open Question #1) — no pricing change either way.
- **Event Settings page** `app/[orgSlug]/admin/tournaments/settings/event/page.tsx` (Card 1 "Tournament Overview") — where the opt-in toggle lives. Saves via `POST /api/admin/tournaments` `action:'update'` (top-level columns) with the existing debounced-autosave pattern.

**Exists but on the WRONG model — to be re-based (`app/discover/page.tsx` + `app/api/public/tournaments/route.ts`):**
- Inclusion = **`organizations.is_public = true`** (org-level), not per-tournament opt-in. ❌ Must become per-tournament opt-in.
- **Org-keyed**: one tournament per org (`tournamentByOrg[org.id] = t` — last active wins), cards link to **`/{org.slug}`** (org home), not the tournament. ❌ Must become tournament-keyed, linking to `/{orgSlug}/{tournamentSlug}`.
- **Active-only**; no sport/location/date filters; **search + filtering are client-side over the loaded batch only** (the "more results may appear after loading more" hint is the tell). ❌ Move to server-side filtering + pagination.
- **`'use client'` page that fetches in the browser** → search engines get an empty shell. ❌ The central SEO fix: server-render the initial list.
- **No `app/sitemap.ts` / `app/robots.ts` anywhere** — must be built from scratch.

---

## Architectural Decisions

- **Opt-in storage = a real boolean column, not JSONB.** Add `tournaments.list_in_directory boolean NOT NULL DEFAULT false` with a **partial index**. **Rationale:** the directory query filters this across *all* tournaments platform-wide with pagination; a dedicated indexed column is clean and fast, whereas `settings->>'list_in_directory'` JSONB filtering is unindexed/awkward and isn't surfaced in `mapTournament`. Default `false` is the privacy-safe default the strategy requires.
- **Opt-in is ANDed with the existing public-status gate** (`status IN ('active','completed')`). Reuses one visibility model; a draft/archived tournament with the flag on never surfaces. No second model.
- **Tournament-centric entity.** The directory lists *tournaments*, not orgs. Each card = one tournament, linking to `/{orgSlug}/{tournamentSlug}`. Org name/slug/logo are joined for display.
- **Server-side filtering + SSR-first page.** API does the filtering/pagination; the page server-renders the initial result set (crawlable) and hydrates a client child for interactivity. This is what makes the directory an SEO asset rather than a dead client shell.
- **No pricing/plan change; listing open to all tiers (LOCKED 2026-06-28).** Browsing is open to everyone unconditionally, and the listing toggle is available on **every plan, free Tournament included** — no `lib/plan-features.ts` / `lib/plan-config.ts` change. Rationale: gating throttles the supply that makes the flywheel work; the directory monetizes via funnel/credibility, not a listing fee. (A future *premium placement*/"featured" angle stays open without gating listing itself.)
- **Location filtering = organizer-entered province (LOCKED 2026-06-28).** `tournaments`/`organizations` have **no** city/province column today (venue data lives in the separate `venues` table, multiple rows per tournament, not always set). V1 adds a lightweight optional `directory_province`, captured at opt-in time, powering a **province dropdown** filter. City-level free-text was rejected (messy/low-trust); city is a deferred fast-follow.

---

## Phases

### Phase 1 — Opt-in foundation (data + organizer toggle)

- [ ] **Migration `158_tournament_directory_listing.sql`** (FIRST task — migration-first). Next free number confirmed = **158** (highest existing = 157). Additive + `IF NOT EXISTS`:
  ```sql
  ALTER TABLE tournaments
    ADD COLUMN IF NOT EXISTS list_in_directory boolean NOT NULL DEFAULT false;

  -- Province for the directory location filter (LOCKED — province dropdown V1).
  -- City-level free-text rejected; city is a deferred fast-follow (no column yet).
  ALTER TABLE tournaments
    ADD COLUMN IF NOT EXISTS directory_province text;

  -- Partial index for the cross-platform directory query.
  CREATE INDEX IF NOT EXISTS tournaments_list_in_directory_idx
    ON tournaments (list_in_directory)
    WHERE list_in_directory = true;
  ```
  Apply to **dev** first (`node scripts/apply-migration-api.mjs` per repo convention); apply to **prod** at release time (migrations never auto-apply; `check:migrations` is blind to indexes/CHECKs so verify the index against live `pg_indexes`).
- [ ] **Schema = dictionary, same unit of work.** Update `docs/agents/db/DATA_DICTIONARY.md` with the new column(s) + index, then `npm run refresh:snapshots` (dev + prod). `npm run check:dictionary` (part of `verify:changed`) must pass.
- [ ] **Type + mapper.** Add `listInDirectory` (+ `directoryProvince`/`directoryCity` if kept) to the `Tournament` type (`lib/types.ts`) and `mapTournament` (`lib/db.ts`). ⚠ `mapTournament` reads `r.organization_id`/`r.org_id` carefully — match the existing select aliasing so the field isn't silently `undefined`.
- [ ] **Organizer opt-in toggle** in Event Settings Card 1 "Tournament Overview" (`app/[orgSlug]/admin/tournaments/settings/event/page.tsx`) — a `segmentedControl` On/Off, default Off, mirroring the existing status/visibility toggles. Persist via the existing `POST /api/admin/tournaments` `action:'update'` payload (`app/api/admin/tournaments/route.ts`).
- [ ] **Privacy explainer copy** beside the toggle: what becomes visible (event name, dates, sport, live scores) + "Player information always stays private" + a note that the listing only appears once the tournament is **published/active** (flag on a draft is stored but dormant).
- [ ] **Province capture** (LOCKED — province dropdown): a "Province (for directory search)" select shown when the toggle is On, writing `directory_province`. (City free-text rejected; city-level deferred.)
- [ ] **Listing gate: NOT NEEDED** (LOCKED — open to all tiers). No `lib/plan-features.ts` / `lib/plan-config.ts` change; the toggle is available on every plan including free Tournament. Browsing is unconditionally public.

### Phase 2 — Directory surface re-based on opt-in (page + API + filters)

- [ ] **Rewrite `app/api/public/tournaments/route.ts` to be tournament-centric.** Select `tournaments WHERE list_in_directory = true AND status IN ('active','completed')`, join `organizations` for `name/slug/logo_url` (and exclude `subscription_status = 'canceled'`), return `sport`, dates, location, division/team counts, and the org slug + tournament slug for the link. Add **server-side** query params: `q` (name search across tournament + org), `sport`, `province`, `status`/timeframe (`upcoming|active|completed`), `dateFrom`/`dateTo`, `limit`, `offset`. Keep `withObservability` wrapping.
- [ ] **Rebuild `app/discover/page.tsx` entity model** from "org card" → "tournament listing." Cards link to `/{orgSlug}/{tournamentSlug}`. Add sport + province + date filters alongside the existing status filter; move search server-side (debounced query param). Keep the existing grid/list toggle + `page.module.css` styling.
- [ ] **Empty / zero-state** ("No tournaments listed yet — check back soon").
- [ ] Keep `withObservability` + the existing pagination contract (`{ items, total, hasMore }`).

### Phase 3 — SEO & shareability

- [ ] **SSR-first directory.** Convert `/discover` so the initial result set is **server-rendered** (server component fetches page 1; a client child owns filtering/pagination). This is the load-bearing SEO change — crawlers must see real listings, not a spinner.
- [ ] **`generateMetadata` for `/discover`** (title/description/canonical + OG). Add a directory OG image if cheap (reuse the `next/og` `ImageResponse` pattern already used by tournament/team/game OG images).
- [ ] **`app/sitemap.ts`** (none exists) — dynamically enumerate: the `/discover` page + every **opted-in, public** tournament URL (`/{orgSlug}/{tournamentSlug}`). This is the discoverability engine; it must read live from the DB and only include `list_in_directory = true AND status IN ('active','completed')`.
- [ ] **`app/robots.ts`** — allow crawling + reference the sitemap.
- [ ] **Confirm each listed tournament page** keeps its existing `generateMetadata` + OG card (already present in `app/[orgSlug]/[tournamentSlug]/layout.tsx` + `opengraph-image.tsx`). Plain `<Link>` targets are already shareable.

### Phase 4 — Polish & navigation

- [ ] **Nav/footer placement** — `/discover` already appears in `components/Navbar.tsx` + `components/Footer.tsx`; confirm copy/position fits the directory framing (final discovery-surface copy is a later `/marketing` handoff per the strategy entry — wire the link, don't author marketing copy here).
- [ ] **Sort options** (soonest-first default recommended), result counts, loading skeletons, full keyboard/`aria` accessibility on filters.
- [ ] **Instrumentation (optional, no migration):** reuse `platform_events` to log directory views + listing opt-in/opt-out for the funnel story.
- [ ] **Help docs (`/docs`)** — organizer opt-in is a user-facing flow; add/update the in-app help guide ("How to list your tournament in the public directory") in `lib/help-content/*.tsx`.

---

## Process gates (per CLAUDE.md / AGENCY_RULES)

- [x] **Owner sign-off on the 7 decisions (locked 2026-06-28)** — all ratified at the recommended slate; schema/migration finalized below.
- [ ] **`/review`** after the Phase 1 data/auth change and after the Phase 2 API rewrite (substantive logic + new public endpoint behavior).
- [ ] **`/docs`** offer after Phase 1 (organizer-facing flow change).
- [ ] **Restart the dev server** after Phase 1 (new shared-module + type changes) and before browser testing; batch restart-required changes near handoff.
- [ ] **Strategy log:** the parent decision is already logged (2026-06-28, Proposed). If the owner ratifies tier-gating or any packaging-flavored answer here, route it through `/strategy` rather than asserting it in this plan.

## Decisions (locked 2026-06-28 — owner ratified the recommended slate)

1. **Listing tier-gating → OPEN TO ALL TIERS** (free Tournament included). Browsing is unconditionally public; the opt-in toggle is available on every plan. No plan-config/plan-features change, no pricing change. (Future premium-placement/"featured" angle stays open without gating listing itself.)
2. **Location filter → PROVINCE DROPDOWN.** Lightweight optional `directory_province` captured at opt-in. City-level free-text rejected (messy/low-trust); city is a deferred fast-follow.
3. **Filter set → the proposed V1 set, nothing more:** search (tournament + org name), sport, timeframe (upcoming/active/completed), date range, province. Age-group/fee filters deferred until those fields are structured.
4. **Default timeframe → UPCOMING + ACTIVE** by default; completed reachable behind a filter (still indexed/SEO-visible, just not the headline).
5. **Route name → KEEP `/discover`** for the build (already in nav/footer, styled). Public-facing name/copy is a later `/marketing` decision near launch.
6. **Existing tournaments → UNLISTED by default, NO backfill.** Never auto-surface a tournament an organizer didn't deliberately list. (If launch-emptiness is a concern, address via an opt-in *prompt* to organizers, not silent auto-listing.)
7. **Scope → PER-TOURNAMENT opt-in only** for V1. Org-level "list my tournaments by default" convenience deferred (would muddy the deliberate-choice guarantee).

*Fast-follows parked by these decisions: city-level location filter; age-group/entry-fee filters (once structured); org-level listing default; premium/featured placement.*

## Launch checklist (HOLD until production launch)

The build is on `dev` and uncommitted. Before/at the production release that ships the directory:

- [ ] **Apply migration 158 to PROD** (`--prod`) + refresh snapshots + re-run `check:migrations` GREEN, **before** promoting any directory-reading code (else prod 500s).
- [ ] Promote the directory code to `master`/production.
- [ ] **Publish the marketing messaging** (drafted by `/marketing` 2026-06-28, held until launch — brand rule: no marketing of unshipped features). Honest framing locked: "get discovered" not "we put you on Google"; "discoverable" not "top of Google"; opt-in + privacy stated; free on every plan; no pricing claim. Three pieces:
  - **`/changelog` (New):** *"A public tournament directory — get your event found"* — "There's now one place for families, players, and visiting teams to find tournaments running on FieldLogicHQ. Switch on directory listing for any tournament and people can find it by sport, region, and date, then go straight to your live scores, schedule, and standings. You decide when to list — it's off until you turn it on — it's free on every plan, and player information always stays private." (Runs through the changelog draft-then-approve flow.)
  - **`/for-tournament-organizers` section — heading "Get your tournament found":** "List your event in the public FieldLogicHQ tournament directory and families, players, and visiting teams can discover it by sport, region, and date — and land right on your live scores and schedule. It's free on every plan, you choose when to list, and there's nothing extra to build: the public page you already have does the work." + optional free-tier line: "Even on the free Tournament plan, your event can be found online — no upgrade required."
  - **In-product nudge (Event Settings, beside the toggle, shown when off):** "**Want more teams and fans to find this event?** List it in the public tournament directory so families can discover it by sport, region, and date. Your choice, free, and player information always stays private." + optional always-visible caption: "*Free exposure for your event — you decide when to list.*"
- [ ] **Decide top-nav placement at launch.** `/discover` is linked in the **footer** ("Discover") today but is **not** in the visible top nav (Tournaments / Leagues / Clubs / Coaches / Pricing). As the growth/front-door surface, `/marketing` + `/design` should decide whether to elevate it into the top nav and what to call it ("Discover" vs "Browse tournaments") with the launch push.
- [ ] Post-launch: confirm the page is being indexed (search-console / `site:` check) once crawlers have had time — do **not** promise ranking.

## Out of scope (later phases — noted only, do not build here)

- **Native store-wrapper** (thin Capacitor-style shell → App Store + Google Play) — trigger-gated later phase per the strategy entry.
- **Unifying the four mobile surfaces** (fan / coach / admin-volunteer / premium-coach) into one role-routed app.
- **Notification-reliability pass** (iOS push reliability — the real PWA gap).

These are scoped by the strategy decision but explicitly sequenced **behind** the directory.
