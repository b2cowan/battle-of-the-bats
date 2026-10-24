# Club Tier Readiness, Stage 4e: a club's own web address (build prompt)

> **Written 2026-10-23**, the day the drawings were ruled. **Paste this into a new chat on `dev` and re-verify every lead
> first**: the leads below come from the hosting spike's code census and the drawing session's helpers, so this prompt names
> **files, not lines**. Other sessions share this working copy (TODO, the Club plan, the PM brief, the ledger and the design log
> carry their edits): stage explicit paths only and commit only your own hunks.
>
> 4e is **one large stage** (spike §6), mostly routing and links; the hosting part is small. It is built in **parts, each
> committed locally after its own checks**, in the order below. Parts 1 and 5 are safe on their own; Parts 2–4 and 6 only make
> sense together and ship with the Club release.

## What 4e makes true

A club owner connects an address the club already owns, like `www.lakeshorelynx.ca`, **once**, from a new **Web address** row
on the Public site page. About ten seconds later the row shows **two records** to copy to wherever the club bought the address
(or to send, as one message, to whoever holds that sign-in). Once the records are in, the club's public pages, **tournament
pages included**, answer at its own address. Every link the product hands out uses that address, and the old
`fieldlogichq.ca/lakeshore-lynx` forwards there, so posters keep working. The owner is emailed when it goes live. Months later,
if a volunteer deletes the padlock record, the owner gets a **dated warning** before the site breaks. Sign-in, the admin and the
coaches portal stay on FieldLogicHQ. **No support ticket at any step; every peer has one.** No extra charge on any plan that has
the public site.

## The rulings (do not reopen; record nothing they did not rule)

- **2026-10-19:** true hosting through the club's DNS with automatic certificates, never a frame; every plan with the public
  site carries it **at no extra charge** (re-affirmed 2026-10-23: a $5 add-on was raised and declined).
- **2026-10-23, the spike's five asks (all as recommended, `CLUB_TIER_STAGE4E_HOSTING_SPIKE.md` §7):** (1) Amplify natively,
  nothing built on a front; (2) the club connects **www** and forwards the bare name at its registrar, ALIAS where its DNS host
  supports it; (3) the club's **tournament pages** ride its address; (4) the old address **forwards** (301) to the club's, with a
  canonical; (5) on the club's address the **signed-in pieces are hidden**, with one "Sign in" link to FieldLogicHQ. The AWS
  domain limit is not a blocker (3 free slots carry the first clubs; a raise to 500 is with AWS).
- **2026-10-23, the drawings' seven asks (owner: "I agree with your recommendations"):**
  1. **Its own row, "Web address", on Public site, above Visibility.** Visibility loses its "Web address · Change it in
     Settings" line (it moves into the new row). Not on Settings.
  2. **The owner connects and stops;** admins see every state, can **copy the records** and press **Check now**, and read one
     sentence on who connects. No Cancel, Try again or Stop for an admin (absent, not faded).
  3. **Forwarding advice + three registrar links + a check of the bare name:** the connected row says "Forwards to www" or "Not
     forwarding yet · How".
  4. **Any name under the club's own domain, www first:** `www.` is fixed in the field (below); one quiet link, **"Use a name
     other than www"**, makes that part typeable (`teams.`, `register.`) for a club that keeps its own site at www. The
     forwarding box and the bare-name check show **only for www**.
  5. **One row called "Web address" holds both addresses;** the new one is "your own address" in sentences. The Settings field
     keeps its name "Web address"; its hint learns the club's address while connected.
  6. **The owner is emailed at four moments:** it goes live; the padlock record goes missing (on the day, then again two weeks
     before the padlock date if still missing); checking gives up after two days; the club's address stops working. Admins see
     the row only.
  7. **Forward everyone except signed-in visitors.** A signed-in visitor at `fieldlogichq.ca/lakeshore-lynx…` stays there, with
     Follow, alerts and My team; everyone else is forwarded. "Sign in" on the club's address returns them to the same page on
     FieldLogicHQ, signed in.
- **2026-10-23, owner on the drawing:** the field starts with **`www.` already written and unable to be deleted** (the
  tournament Web address window's fixed-prefix shape); the club types only the rest. A pasted link is cleaned as it lands
  (`https://`, a leading `www.`, capitals, a trailing path), so it never reads `www.www.`.

## Read first

- **The drawings, ruled:** https://claude.ai/artifact/QiwFeccoRW5XmAnPwfDuVa (source
  `docs/projects/active/CLUB_TIER_STAGE4E_DRAWINGS.html`). Frames a–h are the screen spec: (a) the door, (b) typing and its
  refusals, (c·d) the two records and waiting, (e) connected, (f) the padlock warning, (g1–g3) the three failures, (h) stop;
  then "What changes elsewhere" (the share census), the rules table, the flow check, **the build notes** and the design check.
- **The spike:** `docs/projects/active/CLUB_TIER_STAGE4E_HOSTING_SPIKE.md`, §1 (Amplify facts), §3 (the apex), §4 (the proof
  timeline), **§6 (what the app must learn, sized)**.
- `memory/design_decisions.md`: "Edit autosaves, create asks", "A record reads first", "One window", "A window's foot", "A rare
  door ends the body", "A disabled .btn fades", the callout ("tinted panels retired 2026-09-21"), "a status is said once, by a
  chip", the phone secondary-action rule.
- `AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md`. **Broad reading goes to a helper agent, and a helper's summary is a lead, not
  evidence.** Schema = dictionary, same unit of work; decide columns from the snapshots, never migration files. **Shared
  automation and anything that runs by itself or against production changes only with the owner's yes in your chat, in its own
  commit** (Part 6).

## Verified state (leads; re-check each)

| What | Then |
|---|---|
| The Public site page | `app/[orgSlug]/admin/public-site/page.tsx`: a header ("Public site" + Online/Offline chip; "Families see it at" + the address in a pill, built from the browser's own origin + `/{slug}`; Copy link, Open), the notice strip, the set-up card ("N of 4 ready"), then `BuilderRow` rows: Look, Home page, About the club, Contacts documents and sponsors, Coaches on team pages (rep clubs only), Visibility; the preview beside them at ≥1200 px (rows column 380–440 px). Owner check is `userRole === 'owner'`; admins write everything but Visibility and Coaches. Words in `lib/public-site-words.ts` |
| BuilderRow | `public-site/BuilderRow.tsx`: title, one-line summary, chevron, opens in place one at a time, autosaves with the page's one floating pill. **It has no chip slot**; the drawings need one at the row's end (Waiting, Needs attention, Not connected, Not working). The only shared-part change this stage asks for |
| Visibility | `public-site/VisibilityPanel.tsx`: owner switches + a "Web address" line with "Change it in Settings"; admin reads text ("The owner turns the site on and off and changes its address.") |
| The fixed-prefix field | `app/[orgSlug]/admin/tournaments/settings/WebAddressWindow.tsx` + `settings-access.module.css` (`addressBox` / `addressPrefix` / `addressInput`): one box, the prefix in the tertiary colour, an input after it, input cleaned on every change. Reuse the shape for `www.` (promote it to a shared part if a second caller makes that cheaper than a copy) |
| Settings' address field | `components/admin/kit/club/SettingsKit.tsx` "Web address*" (the slug), words in `lib/web-address-words.ts` (incl. the tournament `publicUrlLead`, and `askBody` "Nothing redirects to …"). Settings is owner-only |
| Host handling today | `proxy.ts` reads the path only (`x-org-slug` from the first segment); **nothing reads the Host**. Its matcher must widen to public pages **on club hosts only** — www's public pages must not start paying for the proxy |
| The shortcut collision (proven live) | `next.config.ts` redirects `/schedule`, `/teams`, `/register` … to `/milton-bats/…` on **every** host: on a club's address `/teams` opens another club. Scope them to our hosts (`has: host`) |
| Absolute addresses | `metadataBase` hard-coded in `app/layout.tsx`; `app/sitemap.ts` and `app/robots.ts` from the site-URL env var (the proof's robots on a club host advertised `dev.fieldlogichq.ca/sitemap.xml`); `lib/club-share.ts` (share cards, `clubSitemapPaths`), `lib/club-page-meta.ts` (`clubPageMetadata()` on ~17 pages, no canonical), the JSON-LD caller |
| Links inside pages | ~90 slug-prefixed links (41 in 17 public pages, 49 in 24 components) + path helpers (`lib/public-tryout-links.ts`, `lib/public-team-schedule.ts`, `lib/flip-twins.ts`, `lib/event-recap.ts`, `lib/club-share.ts`, `lib/share-card.ts`). One helper that drops the slug on the club's own host; a guard test keeps it |
| Signed-in pieces on public pages | ~11 surfaces: the club bar's Sign in / account menu, Follow buttons and alerts, the tournament banner, MyTeamDock, registration's coach team list. Sign-in and coach links are relative today (`/auth/login`, `/coaches/…`): on a club host they would 404 or show an empty session — make them absolute to www. Cookies are host-only, so every visitor on a club host is signed out |
| Trust rule | `lib/app-origin.ts` `isTrustedAppOrigin` guards email links carrying a live one-time token: **it must NOT widen** (a test pins it). `resolveSameHostOrigin` (public calendar feed) falls back to www — fine. Public forms post same-origin to `/api` and work on a club host unchanged |
| The share census (2026-10-23) | 11 admin/coach screens build their link from `window.location.origin` (or `.host`) + their own path: the Public site header; Rep teams › a team › Tryouts "Copy link"; a tournament draft's Activate "Public link"; finished/Summary "Copy champions/standings link"; Summary's printed foot; the tournaments Public site door; the New tournament wizard's Public link field and its live preview; Event settings' "Public URL" (**hand-typed** `fieldlogichq.ca/…`); Coach › Team settings › Sharing (`CoachPublicPageDoor.tsx`); a coach's tournament "Share this tournament"; the coach welcome banner via `SharePageButton`. Plus `WebAddressWindow.tsx`'s fixed `fieldlogichq.ca/` text. **Stay on FieldLogicHQ on purpose:** the staff kit (scorekeeper, check-in, QR), the tryout evaluator link, the chat invite, the coach's private calendar feed. The public share buttons read the visitor's own origin and are right already |
| Demo clubs | A hard-coded slug list in `lib/demo-org.ts`; refuse a demo slug at connect time |
| Scheduled work | A pg_cron → pg_net scheduler (migration 183) POSTs to platform-admin trigger routes with `x-cron-secret`; `lib/cron-auth.ts` (fail-closed; a super-admin session also passes). Examples: `app/api/platform-admin/dues-reminders/route.ts`, `…/schedule-change-notices/route.ts`. History: `docs/projects/archive/SCHEDULED_JOBS_WIRING_PLAN.md` |
| Headers | `frame-ancestors 'self'` / SAMEORIGIN already mean "this host"; HSTS on a club's host lasts two years (the Stop window says so). `tests/unit/security-headers.test.ts` needs no change |
| AWS | Account 859850635274, Amplify app `d3ld0l2bgmmlga`, us-east-2, domains `fieldlogichq.ca` + `fieldlogichq.com`. Quota `Domains per app` 5; request id `3cf4d5a0e00041faa1a671c4e4b4136cDiAVWLwq` for 500 (check it, read-only, at the start). API: `CreateDomainAssociation` / `GetDomainAssociation` / `UpdateDomainAssociation` / `DeleteDomainAssociation`; over quota = `LimitExceededException`; a name held elsewhere = `CNAMEAlreadyExistsException` |
| Migrations | 354 is the latest at write time. Take the **next free number** (check). Dev only until the Club release; add a `MANUAL_PROD_STEPS.json` entry |

## Before any code (owner steps and proofs; each needs the owner's yes in your chat)

1. **Check AWS's quota answer** (read-only). Report it; do not wait on it (owner: not a blocker).
2. **The safeguard proof (five minutes, on the owner's test domain, as in spike §4):** create `sites.fieldlogichq.ca` in our
   Route 53 zone pointing at the app's Amplify target; attach a test club domain whose `www` points at `sites.fieldlogichq.ca`;
   confirm Amplify verifies and serves it. **Pass:** record 2 is our own name, as drawn. **Fail:** record 2 is Amplify's own
   target (`d….cloudfront.net`) and the "value provisional" note comes off the drawing; nothing else changes. Remove the test
   domain the same afternoon; keep `sites.fieldlogichq.ca` only if it passed.
3. **The apex proof (same session):** with the bare name added to the same association but never verified, does the `www`
   connection still reach AVAILABLE? **If yes,** every connection adds the bare name too, so an ALIAS club gets it for free. **If
   no,** the bare name is added only when the owner says the club uses ALIAS (the help article's route) — a small extra control
   the drawings do not show; bring it to the owner drawn, before building it.
4. **The app's AWS access:** an IAM user (or role) limited to the four domain-association calls on this one app, its keys in
   the Amplify console env (production and dev branches) and `.env.local`. The owner creates or approves it.
5. **The words, through `/marketing`, before any screen code** → `docs/projects/active/CLUB_TIER_STAGE4E_COPY.md`: every
   string on frames a–h, the share census's two fixed-text screens, the four emails, the Settings hint, the public "Sign in"
   link, the "Copy both as a message" text. House rules: sentence case, "8:00 a.m.", the bare possessive, never "DNS" without
   saying where ("where you bought your address"), `npm run check:spelling`. Never promise timing beyond: "often minutes once both
   records are in; it can take up to two days".

## What to build, in parts

**Part 1 · The correctness fixes (safe alone; commit first).** Scope the `next.config.ts` shortcut redirects to our own hosts.
Make robots and the sitemap answer for the host they are served on (a club host lists only its own pages; www unchanged). Unit
tests for both.

**Part 2 · Storage, the host and the connect API.**
- A table (recommended over more columns on `org_public_site_content`: it has its own lifecycle) holding, per org, at most one
  live connection: the full name (`www.lakeshorelynx.ca`), the domain, the prefix, the status (`waiting`, `connected`,
  `needs_attention`, `not_connected`, `not_working`), the two records as Amplify returned them, the padlock date, last checked,
  when each email was sent (so none repeats), who connected it and when. A name is **unique across orgs**. RLS: read for the
  org's owner and admins; writes only through the routes. Dictionary + snapshots in the same unit of work. `/db` reviews it.
- An Amplify client (`lib/` module, server only) for the four calls, mapping Amplify's statuses and errors to ours. Branch
  `master` in production, `dev` on dev.
- Routes (owner-only writes, admin reads, `module_public_site` like the page): **connect** (validate → refuse demo, our own
  domains, not-a-domain, taken by another club → create the association → return the records; ~10 s, the row shows the loading
  line), **check now** (our own DNS lookup of both records with `node:dns`: Not seen yet / Found / Points elsewhere + what we
  see; never claims "live"), **try again** (same records), **stop** (delete the association, clear the row, the forward and the
  handed-out address revert at once). The refusal words come from the copy doc.

**Part 3 · The Web address row (frames a–h, desk and phone).** The BuilderRow chip slot. The row's states exactly as drawn,
including the admin's read-only view, the fixed `www.` field with "Use a name other than www" (ask 4), the record cards with
Copy (34 px at a desk; on a phone the symbol alone, each with its own accessible name, "Copy record 1 value"), "Copy both as a
message" (keeps its words on a phone: named exception), the forwarding callout (www only), Check now, the dated warning, the
three failures (amber for g1/g2, red only for g3), the rare doors ending the body, the Stop question window (no ×, buttons only,
416 px). Visibility loses its address line. The page header says the club's address while **connected or needs attention**,
the old one otherwise. The preview gains the padlock address strip while connected. The Settings hint learns the club's address.
Words from the copy doc only.

**Part 4 · The club's address serves the club.**
- `proxy.ts`: a known club host + `/about` → `/{slug}/about` (tournament pages too). A **cross-request host → club cache**
  (an in-process map refreshed every few minutes, or `unstable_cache`); **never a database read per request**. www's public
  pages must not start running through the proxy.
- One link helper that drops the slug on the club's own host; convert the ~90 links and the path helpers; a guard test.
- Absolute addresses per host: `metadataBase`, canonical on every club page (the club's address while connected), sitemap,
  robots, share cards, JSON-LD.
- Sign-in and coach links absolute to www; on a club host the signed-in pieces are hidden and the bar shows one "Sign in" link
  that lands on the **same page at `fieldlogichq.ca/{slug}/…`** (ruling 7).
- **The forward:** `fieldlogichq.ca/{slug}/…` → the club's address with a 301, **only while connected or needs attention, and
  never for a signed-in visitor** (ruling 7). While the club's address is broken (`not_working`), the forward stops.

**Part 5 · The share census.** One server-and-client helper that answers "the club's public origin" (the club's address while
connected or needs attention, else www) and is used by all 11 screens above; the two fixed-text tournament screens get the copy
doc's words. The stay-on-FieldLogicHQ screens are not touched; a test lists both groups so a new copy-link screen has to choose.

**Part 6 · The status check and the four emails (watched automation: its own commit, the owner's yes in your chat, a message
that says what now runs by itself).** One platform-admin trigger route behind `lib/cron-auth.ts`, and one new pg_cron job
calling it **every 15 minutes**: waiting connections are read from Amplify each tick (→ connected sends the "live" email; past
two days → `not_connected` and the "gave up" email); connected ones are checked on two clocks (**owner ruling 2026-10-23**): **record 2 every hour** (still pointing at us? → else
a miss is confirmed at the next 15-minute tick, then `not_working` and the email; one DNS lookup per club) and **everything
else once a day** (record 1 present? → else `needs_attention`, email that day and again 14 days before the padlock date; the
bare name forwarding to www? → the connected row's line; the padlock date from the live certificate). Emails through the
existing email stack to the **owner only**. Reads only: no writes to AWS from the tick. Check the load (per connected club:
24 DNS lookups a day for record 2, plus once a day one DNS lookup, one certificate read and one HTTP request) and say so in
the commit.

**Part 7 · Help and the demos.** `/docs`: a help article "Use your club's own address" (the two records, keeping record 1,
forwarding the bare name at GoDaddy, Namecheap and Hover — confirm the three by looking — the ALIAS route, email not affected,
Stop and the two-year padlock rule); the "Copy both as a message" text links to it. Demo clubs show the row and refuse on Next;
`/demos` decides at its next pass whether the shop window shows a connected example.

## Definition of done

- Every frame a–h behaves as drawn at 1440 and 390, owner and admin, in Warm and Dark; `check:layout --changed` on the Public
  site page and Settings.
- A real connection on the owner's test domain end to end on dev: connect → records → Found → live → the club's pages and a
  tournament page on the club's address → the old address forwards (signed out) and does not (signed in) → copy-link lines hand
  out the club's address → remove record 1 → the warning and its email → put it back → it clears → Stop → everything reverts.
- Unit tests: the refusals; the prefix cleaner; the state machine (every transition and every email at most once); the host
  cache; the link helper's guard; the forward rules (signed in, broken); the shortcut scope; robots/sitemap per host;
  `isTrustedAppOrigin` unchanged.
- Migration on dev, dictionary + snapshots, `MANUAL_PROD_STEPS.json` entry; `npm run verify:changed`, `npm run typecheck`.
- `/simplify` then `/review` (high-risk: routing, auth surface, automation); `/docs` done.
- **A QA walk** as a checkable Artifact (one purpose per walk; likely two: the owner's row journey, and what families and
  coaches see once connected), Owner QA Ledger sections taken at write time.
- Records: the Club plan §6 Stage 4 under 4e (built, commits, the walk), TODO's 4e line, the PM brief, release history at the
  promote (the Amplify keys, `sites.fieldlogichq.ca`, the pg_cron job and the migration are all prod steps).

## Do not

- Reopen packaging, the no-frame ruling, the spike's five rulings or the drawings' seven.
- Widen `isTrustedAppOrigin`, share the session across hosts, or put sign-in on a club's address.
- Read the database per request to resolve a host.
- Write to AWS or DNS without the owner's yes in your chat; leave anything attached that a proof created.
- Add a navigation change (Stage 13), a plan gate or a price.
- Draw or build anything for the bare name beyond the forwarding advice, the check and (if the apex proof says so) the ALIAS
  control brought to the owner first.

## Git

`dev` only. Explicit pathspecs; check `git show --stat HEAD` after every commit. One local commit per part after its checks;
**Part 6 in its own commit**, its message naming what now runs by itself and how often. No push and no promote without the
owner.
