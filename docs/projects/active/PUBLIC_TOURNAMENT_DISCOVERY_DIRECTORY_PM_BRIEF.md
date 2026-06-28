# Public Tournament Discovery Directory (Web) — PM Brief

> **Created:** 2026-06-28 · **Status:** Planning · **Plan:** `docs/projects/active/PUBLIC_TOURNAMENT_DISCOVERY_DIRECTORY_PLAN.md`
> **Strategy source:** Business Decisions Log, 2026-06-28 "Mobile app + public tournament discovery" (Proposed). This is the **first concrete piece** — the web directory. Native store-wrap, surface-unification, and the notification-reliability pass are later, separate phases.

**What it does:** A single public web page on FieldLogicHQ where anyone — no login — can browse tournaments from across the whole platform, search and filter them (sport, location, date), and tap straight through to that tournament's existing live public page (scores, schedule, standings). Organizers choose, per tournament, whether to be listed; nothing appears unless they deliberately switch it on (default off).

**Why it matters:** This is the marketing flywheel from the 2026-06-28 strategy decision — the more tournaments are discoverable in one place, the more fans browse, the more organizers want in. It's also the future mobile app's logged-out front door. It must be web-first so it's findable on Google and shareable as a plain link; an app-only directory would throw away the marketing value.

**Who benefits:**
- **Fans / parents / players** — one place to find tournaments instead of needing a direct link from an organizer.
- **Organizers** — free top-of-funnel exposure for their event; a reason on its own to run it on FieldLogicHQ.
- **The platform** — an SEO + network-effect growth asset that pays off whether or not the native app ever ships.

**Expected impact:**
- *Organizers* get a new "List this tournament in the public directory" on/off switch in Event Settings (default **off**), with a plain note about exactly what becomes visible (event name, dates, sport, live scores) and a reminder that player information always stays private.
- *Anyone* visiting the directory sees a searchable, filterable list of opted-in tournaments and can click into the existing public pages.
- **Privacy guarantee, unchanged:** the directory only ever links to pages that are already public; everything with player personal information stays behind login. Listing is opt-in by design (a youth-sport / PIPEDA safeguard).

**Heads-up — this re-bases an existing page.** A `/discover` page already exists (linked in the marketing nav/footer), but it's built on the wrong basis: it lists *organizations* whose whole profile is public, shows one tournament per org, links to the org home rather than the tournament, has no sport/location/date filters, and loads its content in the browser so search engines can't read it. This work moves it onto the per-tournament opt-in model and makes it genuinely discoverable.

**Priority:** High — highest-leverage first piece of the mobile/discovery strategy; helps the platform independently of the app.

**Success criteria:**
- Organizers can opt a tournament in/out from Event Settings.
- The public directory shows only opted-in, already-public tournaments, with working search + filter (sport / location / date / timeframe).
- Each entry links to the correct tournament's existing public page.
- The directory page and every listed tournament are crawlable and appear in a sitemap (SEO).
- No player personal information is ever exposed.
- No pricing change.

**Owner decisions needed before build (see plan's Open Questions):** whether listing is open to every tier or reserved for Tournament Plus+; how location filtering works (province dropdown vs. city text vs. none in V1); the exact filter set; the default timeframe shown; route name; and confirmation that all existing tournaments default to **not listed** with no backfill. Recommendations are noted in the plan — these are flagged, not assumed.
