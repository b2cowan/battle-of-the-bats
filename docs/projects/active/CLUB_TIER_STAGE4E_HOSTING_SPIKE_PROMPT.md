# Club Tier Readiness, Stage 4e: a club's own web address — the hosting spike (prompt)

> **Written 2026-10-23**, after Stage 4d (sponsors) was committed `29bc543d4` and walked (§366 ✅ 30/30). **Paste this into a
> new chat on `dev`.** The leads below were gathered by a helper on 2026-10-23 and spot-checked; re-verify any you build on.
> Other sessions share this working copy (TODO, the Club plan, the ledger carry their edits): stage explicit paths only.
>
> **This is a spike, not a build.** It answers one question with evidence and a small proof, and hands the owner a
> recommendation. It writes **no product code, no migration, no help article**. 4e's drawing and build prompt come after it,
> and both depend on its answer.

## The question

**Can our host serve hundreds of club domains, each with its own automatically renewed certificate, and if not, what goes in
front of it?** Everything else in 4e (the Settings screen, the words a volunteer reads, the build size, the per-club cost) turns
on that answer. A build prompt written before it would be guessing which of two very different builds it is:

- **Yes, natively:** 4e is a Settings screen, a call to the host's API to attach the domain, and the app learning to answer to
  more than one address.
- **No:** a new outside layer sits in front of the site to terminate the club's domains and certificates. A new vendor, a new
  bill, new failure modes, and a different connect flow for the club.

## What is ruled (do not re-open)

- **The ruling:** `docs/projects/active/CLUB_TIER_PRODUCTION_READINESS_PLAN.md` §6 Stage 4, "4e · a club's own web address
  (ruled 2026-10-19)": the club owner connects their own domain once in Settings; the club's pages, shared links, previews and
  sitemap use it; **sign-in and the admin stay on FieldLogicHQ**; a hosting spike first. Forwarding a domain needs no build and
  gets a help article; **masking (framing) is not offered**.
- **Packaging:** `docs/agents/strategy/BUSINESS_DECISIONS.md`, the 2026-10-19 entry, item 4: included at **no extra charge** in
  every plan that carries the public site, riding the public-site gate. So **per-club running cost is a first-class finding**:
  we eat it.
- **True hosting on the club's domain, not a frame.** The evidence (Stage 4 drawings, "Ten club sites"): 8 of 10 real club sites
  run on their own domain; every platform that documents it (TeamSnap, SportsEngine, TeamLinkt, PlayHQ) does it through the
  club's DNS with certificates handled for them; none frames.

## Verified state (leads, 2026-10-23)

| What | Then |
|---|---|
| The host | AWS Amplify Hosting with compute (SSR), one app for `dev` and `master` branches; app id and region in `RELEASE_CONFIG.md` and `.claude/commands/release.md`. `amplify.yml` builds with `next build --webpack`; no `output: 'standalone'`. **No CDN or proxy config in the repo**: Amplify's own managed CloudFront is the only edge |
| Our addresses | Canonical `https://www.fieldlogichq.ca`. `next.config.ts` redirects `.com`, `www.com` and the `.ca` apex to it with `has: [{ type: 'host' }]` — the **only** host-aware routing in the repo |
| The proxy | `proxy.ts` **never reads the Host header**. The org is the first path segment. Its matcher does **not** cover public club pages for normal visitors (only admin, scorekeeper, check-in, api, auth, my, coaches, platform-admin, and a sandbox-cookie catch-all) |
| Absolute addresses | `metadataBase` is hard-coded to www in `app/layout.tsx`. `NEXT_PUBLIC_APP_URL` with a www fallback in ~100 places (mostly email, billing, invites). `lib/app-origin.ts`: `resolveTrustedAppOrigin`, `resolveSameHostOrigin`, and `isTrustedAppOrigin`, which trusts only `fieldlogichq.ca` and its subdomains, **with a comment saying to revisit it if custom domains ship** |
| Search and previews | `app/sitemap.ts` and `app/robots.ts` build from the env var; club paths from `lib/club-share.ts` (`clubSitemapPaths`, `shareCardPath`, `sportsTeamJsonLd`); `lib/club-page-meta.ts` `clubPageMetadata()` on ~17 public club pages, link-preview images relative to `metadataBase`. No club page sets a canonical |
| Links inside the pages | ~33 `` href={`/${orgSlug}/…`} `` links in public pages and components; ~22 files read `window.location.origin` (copy-link and share, unaudited) |
| The public pages | home, about, teams (+ team, calendar feed, tryouts and their registration), club tryouts, league (+ season, register, schedule, standings, status), archives; the shortcut forwards (schedule, results, register, rules, news, standings); **and the tournament pages under the org** |
| Sign-in | Supabase cookies are **host-only** (no `domain` set anywhere). A signed-in person is a stranger on the club's domain |
| Security headers | `next.config.ts` `headers()`: `frame-ancestors 'self'`, `X-Frame-Options: SAMEORIGIN`, HSTS on this host only (no `includeSubDomains`, pinned by `tests/unit/security-headers.test.ts`). Its comment already expects a club domain to serve as `'self'` |
| Storage | No custom-domain column, type or migration exists. The likely home is `org_public_site_content` |

## Part 1 · The hosting question (the core of the spike)

Answer from **official, dated vendor documentation**, the AWS account itself (read-only), and the proof in Part 3. Cite every
claim with a link and the date read. Do not answer from memory: these limits change.

1. **Amplify natively.** Can one Amplify app carry many custom domains, added and removed **by API** (no console clicks per
   club), each with a managed, auto-renewed certificate?
   - The quota on domains per app, whether it can be raised and how far (check the account's service quotas, read-only).
   - What a domain association does to the app: does adding or removing one redeploy, rebuild, or interrupt traffic for every
     other club? How long until it serves?
   - What the club must put in its DNS (verification record, the CNAME, the apex), and whether that can be shown to the club
     before the domain is live.
   - **Does Amplify's edge refuse a request whose Host it does not know?** This decides whether any layer can sit in front.
2. **If Amplify cannot carry it,** compare **at most three** fronts, not a survey: (a) a managed custom-hostname service in front
   of Amplify (e.g. Cloudflare for SaaS); (b) our own CloudFront distribution with ACM certificates; (c) one other the evidence
   points to. For each: how a domain is added by API, certificate issue and renewal, what the club's DNS must say, whether the
   original Host reaches Next.js (or a forwarded-host header we can trust), cost per connected club per month **and at 50 and
   500 clubs**, the new failure modes, and what it does to our own www traffic (must it go through the front too?). **Moving off
   Amplify is out of scope**; name it only if every option fails, as a finding for the owner.
3. **The apex.** Most clubs will type `miltongirlssoftball.ca`, not `www.`. A CNAME cannot sit on an apex at most registrars.
   What does each path ask of a volunteer for the apex, and what do the platforms in the drawings' research tell clubs?

**Stop when the answer is clear.** If Amplify carries it cleanly, do not research fronts beyond confirming one fallback exists.

## Part 2 · What the app must learn (size it, do not build it)

The build prompt will need these sized. List each with the files involved and a rough size; do not change them.

- **Host → club:** the club's domain must reach the right org's pages without the slug in the address. The proxy does not see
  public pages today. Rewrite in the proxy (new matcher) vs. in `next.config.ts`, and the cost of a lookup on every public
  request (a cache, an edge-readable list).
- **Links:** the ~33 slug-prefixed links, the share and copy-link code, the sitemap, robots, link previews, JSON-LD and
  `metadataBase` must all speak the club's address on the club's domain and ours on ours.
- **What stays on FieldLogicHQ:** sign-in, the admin, the coaches portal, and any page that needs a session must send the
  visitor to www by an absolute link. Which public pages show signed-in state today and would quietly lose it?
- **Forms that post from a public page** (tryout, league, tournament registration) against `isTrustedAppOrigin`: what widens,
  and how it stays safe (trust only a domain the platform has verified for that club, never a tenant-typed string).
- **Duplicate pages:** the same page at `www.fieldlogichq.ca/{slug}` and at the club's domain. Redirect, canonical, or both?
  (Search engines, and the links already printed on posters.)
- **Tournament pages under the club:** in or out of the club's domain? The ruling says "the club's pages"; flag it as an ask.
- **Never on a custom domain:** demo and sandbox orgs (their cookies and the sandbox matcher are host-only).
- **Headers:** HSTS and frame rules per host; the security-headers test must still pass.

## Part 3 · The proof (smallest that settles Part 1)

One real domain served by the chosen path with a valid certificate, showing one club page. **This needs the owner:**

- **Ask before any write to AWS, DNS or a vendor account.** Adding a domain to the Amplify app touches the app that serves
  production. Read-only CLI calls are fine without asking; anything that creates, changes or costs money is the owner's yes, in
  that chat.
- **The owner supplies the test domain** (or a subdomain of one they own, if the subdomain answers the question honestly; say
  whether it does). Never buy one.
- Prefer the `dev` branch. Record exactly what was created so it can be removed, and remove it at the end unless the owner says
  keep it.
- If the owner declines the proof, the spike ends on documentation alone and says so in its confidence line.

## Deliverables

1. **`docs/projects/active/CLUB_TIER_STAGE4E_HOSTING_SPIKE.md`**: the answer in one paragraph first; then Part 1 with citations,
   Part 2's sizing table, Part 3's result, per-club cost, and **a confidence line** (what was proven vs. read).
2. **An owner-facing page (a Claude Artifact)**, product-owner voice: the recommendation, what a club volunteer will have to do
   in their DNS, what it costs us per club, and the asks, each with a recommendation. Expected asks: the path (if more than one
   is viable), the apex, tournament pages on the club's domain, redirect vs. canonical for the old address.
3. **Records:** a dated paragraph under 4e in the Club plan (§6 Stage 4), a line in the PM brief, and the 4e line in `TODO.md`
   pointing at the spike doc. No QA ledger section: a spike has no walk.
4. **The next step named, not done:** the 4e drawing (the Settings "connect your address" screen: the steps, checking,
   connected, and the error state; the words through `/marketing`), then the build prompt.

## Do not

- Change `proxy.ts`, `next.config.ts`, `lib/app-origin.ts`, the security-headers test, or any product file. Part 2 sizes them.
- Change shared automation, hooks, or the database checks (`AGENCY_RULES.md`, 2026-09-26).
- Re-open packaging or the "no masking" ruling. A cost finding that threatens "no extra charge" is a finding for `/strategy`,
  not a change.
- Promise anything in customer copy.

## Read first

`AGENTS.md`, `AGENCY_RULES.md`, `CLAUDE.md` (broad reading goes to a helper agent; a helper's summary is a lead, not evidence;
disagree out loud). The Stage 4 drawings, https://claude.ai/artifact/QhdgL1QnfRndu4ZAoTB67k (source
`docs/projects/active/CLUB_TIER_STAGE4_DRAWINGS.html`), its research on club sites and on search and previews.
`RELEASE_CONFIG.md` for the Amplify app.
