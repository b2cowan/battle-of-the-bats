# Club Tier Stage 4e · a club's own web address — the hosting spike (result)

> **Run 2026-10-23** from `CLUB_TIER_STAGE4E_HOSTING_SPIKE_PROMPT.md`, on `dev`. No product code, migration or help article
> changed. AWS writes made with the owner's yes in that chat: one quota-increase request and one temporary domain on the
> Amplify app (both listed in §5, with what was removed). **Owner page (the recommendation and the five asks):**
> https://claude.ai/artifact/7PXZEvQexJnUZ8J4d1BnsY
> **Check AWS's answer:** `aws service-quotas get-requested-service-quota-change --request-id 3cf4d5a0e00041faa1a671c4e4b4136cDiAVWLwq --region us-east-2`

## The answer

**Yes — Amplify carries it natively, on one condition that is now in AWS's hands.** One Amplify app can hold many custom
domains, each added and removed by API, each with a free certificate Amplify issues and renews itself, served by the same
shared edge that already serves www, with the club's address reaching Next.js unchanged. The proof attached a real domain in
seconds and served a club page on it with a valid certificate (§4). **Per-club running cost: $0.** The one condition is the
quota: **5 domains per app** by default (we use 2), documented as adjustable with **no published maximum**. A request for
**500** was filed 2026-10-23 (§5) — **what AWS grants is the last fact this answer needs.** If AWS grants hundreds, 4e is a
Settings screen, an API call and the app learning to answer to more than one address. If AWS caps it low, the fallback is a
front (AWS CloudFront SaaS Manager first, Cloudflare for SaaS second, §2), both workable on paper, both unproven in front of
Amplify, both a new moving part. **The apex (bare `club.ca`) is the same problem on every affordable path** (§3): the club
connects `www` and forwards the bare name, unless its DNS host offers ALIAS/ANAME — which is a real step down from what
TeamSnap, SportsEngine and TeamLinkt ask (an A record), and the drawing must say so plainly.

**Confidence:** *proven* — Amplify adds a domain by API, hands back the club's DNS records in seconds, issues a certificate
and serves the app on the new name without touching www (§4); the edge refuses unknown names (§1.4). *Read, not proven* — the
quota ceiling (pending), certificate behaviour on a third-party DNS host (the proof's DNS was in our own account, which
Amplify wrote to itself), apex handling, both fronts and their prices.

---

## 1 · Amplify natively

Sources read 2026-10-23. Account facts from read-only CLI the same day (account 859850635274, app `d3ld0l2bgmmlga`, us-east-2).

1. **Quota.** Account Service Quotas: `Domains per app` = **5, adjustable** (L-AD277529); `Subdomains per domain` = 50, not
   adjustable; we use 2 (`fieldlogichq.ca`, `fieldlogichq.com`). AWS docs: "Domains per app | Each supported Region: 5 | Yes"
   — no maximum stated (https://docs.aws.amazon.com/amplify/latest/userguide/quotas-chapter.html). No AWS statement, and no
   credible report, of how high it has been raised; old GitHub issues (#927 2020, #1471 2021) show users told to "request a limit
   increase" or to split across apps. **One club = one domain** (its `www` and apex are subdomains of one association), so 500
   clubs = 500 domains. Splitting clubs across several Amplify apps is **not** a fallback: every app builds and deploys separately.
2. **By API.** `CreateDomainAssociation` / `UpdateDomainAssociation` / `DeleteDomainAssociation`
   (https://docs.aws.amazon.com/amplify/latest/APIReference/API_CreateDomainAssociation.html); certificate type defaults to
   Amplify-managed; over-quota returns `LimitExceededException` (HTTP 429). No documented API rate limit. **Does it disturb other
   domains?** Not documented; the proof watched www and dev every 5 s through the whole add and remove (§4). No rebuild was
   triggered (neither branch's job list changed).
3. **What the club's DNS must say.** Two CNAMEs: a certificate-check record (`_xxxx.club.ca → _yyyy.acm-validations.aws`) and the
   address (`www → dxxxx.cloudfront.net`) (https://docs.aws.amazon.com/amplify/latest/userguide/to-add-a-custom-domain-managed-by-a-third-party-dns-provider.html).
   **Both are known within seconds of the API call** (proof: 10 s), so the Settings screen can show them before anything is live.
   AWS: verification "can take up to 48 hours"; checks run "every few minutes", then "every few hours" after the first hour
   (https://docs.aws.amazon.com/amplify/latest/userguide/troubleshooting-custom-domains.html). Certificates are "valid for 13 months
   and renew automatically" (the proof's certificate was actually ~198 days, §4) — **but "Amplify can't renew the certificate if the CNAME verification record has been modified or
   deleted ... You must delete and add the domain again"** (https://docs.aws.amazon.com/amplify/latest/userguide/using-certificates.html).
   ⚠ A volunteer who tidies away "that odd record" breaks the site at the next renewal (months, not years). **The build must watch each club's domain and
   warn the owner** (it is one read per club per day).
   Edge cases for the error state: a domain still attached to another AWS account's CloudFront/Amplify fails with
   `CNAMEAlreadyExistsException` or needs AWS Support (https://docs.aws.amazon.com/amplify/latest/userguide/custom-domains.html).
4. **Does Amplify's edge refuse an unknown Host?** **Yes — proven** by read-only probes of our own edge 2026-10-23:
   unknown name in both TLS and Host → the connection does not open (no certificate); our certificate but an unknown Host →
   **403 from CloudFront**; the `amplifyapp.com` default address with an unknown Host → 403. Extra headers (e.g.
   `X-Forwarded-Host`) pass the edge (200). Also observed: our two domains' edge targets are **interchangeable** (each serves both
   certificates) — Amplify fronts every domain from one shared layer, so the quota is a policy limit, not an architectural one.
   **Consequence for any front:** it must present itself to Amplify as `www.fieldlogichq.ca` (or the `amplifyapp.com` address)
   and carry the club's name in a separate header.
5. **The Host reaches Next.js.** Already true in production: `next.config.ts` redirects `fieldlogichq.com` by matching the
   Host, and it works. The proof confirms it on a new domain (§4).

## 2 · If Amplify cannot carry it — two fronts, compared

Only needed if AWS refuses a useful quota. Neither is proven in front of Amplify.

| | (a) CloudFront SaaS Manager (AWS) | (b) Cloudflare for SaaS |
|---|---|---|
| Add a club | `CreateDistributionTenant`, one tenant per club, up to 100 names each; 1,000,000 tenants/account (https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cloudfront-limits.html) | Create Custom Hostname API |
| Certificate | CloudFront-managed, HTTP-validated, auto-renewed (https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/managed-cloudfront-certificates.html) | HTTP validation, 90-day certs, auto-renewed while the CNAME stays (https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/security/certificate-management/issue-and-validate/renew-certificates/) |
| Club's DNS | **one** CNAME (no certificate record) | **one** CNAME |
| Apex | ALIAS (Route 53 recommended), else `www` + forward | CNAME flattening at their host, else `www` + forward; A-record "apex proxying" is **Enterprise, paid add-on** (plans page, updated 2026-08-14) |
| Host to Amplify | CloudFront sends the origin's name as Host; a viewer-request Function copies the club's name into a header. ⚠ Chains our distribution into Amplify's: CloudFront allows **2** in a chain and "doesn't recommend" it — we would be at the limit | Sends the club's name as Host by default, which **Amplify refuses (§1.4)**. "Override Host header" is **Enterprise only** (https://developers.cloudflare.com/rules/origin-rules/, updated 2026-08-14); a Worker that re-fetches www is the likely way round (not verified) |
| Our own www | Stays on Amplify directly | Fallback origin must be a proxied record in a Cloudflare zone; **our DNS is Route 53** — a zone move or a dedicated zone |
| Cost / month | Not on the official pricing page (FAQ: "charges based on the number of Distribution Tenant resources"). AWS Builder article: 10 free, $20 to 200, then $0.10 (or $0.01 — it contradicts itself) per tenant → **~$20 at 50, ~$50 at 500**, plus requests and traffic. ⚠ Confirm in the AWS calculator | 100 free, then **$0.10** each (plans page, 2026-08-14) → **$0 at 50, $40 at 500**, plus Workers ($5 + per request) if needed |
| New failure modes | A second edge to configure and watch; the chain limit; a header we must trust only from our own distribution | A new vendor and bill; a Worker on every club request; a zone move |

Recommendation if needed: **(a)** — same vendor, same bill, no zone move, one CNAME for the club. Verify the chain on a test
domain first (one hour). Moving off Amplify is not needed on any evidence.

## 3 · The apex

- **Amplify:** ANAME/ALIAS at the club's DNS host; "For DNS providers that don't have ANAME/ALIAS support, we strongly recommend
  migrating your DNS to Route 53" (third-party DNS page above). Amplify's default is apex → `www` redirect.
- **Both fronts:** the same, unless Cloudflare Enterprise.
- **What the platforms tell clubs** (read 2026-10-23): SportsEngine — A records on `@` + CNAME `www`, then contact support
  (help article updated 2026-08-06); TeamSnap — two A records on `@` + CNAME `www`, then a mapping-request form (2025-05-15);
  TeamLinkt — one A record + CNAME `www`, then email support, SSL added by hand (2026-05-22); Squarespace — four A records +
  CNAME `www` + a verification CNAME. PlayHQ: could not read. **Every one gives the apex fixed IP addresses**, which needs a static
  IP edge — not available to us on any affordable path.
- **Recommendation:** the club connects **`www`** (two records, automatic after that), and the screen tells them to forward the
  bare name to `www` at their registrar (most offer it free); if their DNS host supports ALIAS/ANAME, the screen offers that as
  the better option. A club on Route 53 or Cloudflare DNS gets the bare name directly. **Our advantage to say out loud: no
  support ticket, no email, no form — every peer above has one.**

## 4 · The proof (2026-10-23)

Owner's yes and owner-supplied domain in the spike chat: **`club.b2cowan.com`** (the owner's own domain, DNS in Route 53 in the
same account), attached to the Amplify app on the **`dev`** branch, then removed. **Does a subdomain answer honestly?** For the
`www`-style connection, yes: Amplify treats `b2cowan.com` as one new domain (a fresh association, its own certificate) exactly as it
would `miltongirlssoftball.ca` with prefix `www`. It does **not** test the apex, nor a third-party DNS host (see below).

| Step | Time (UTC) | Result |
|---|---|---|
| `create-domain-association b2cowan.com`, prefix `club` → `dev` | 19:11:10 | `CREATING` |
| Records the club would copy | 19:11:21 | Both known: certificate CNAME + `club CNAME d3huwmeoybfwrl.cloudfront.net` — **10 s** |
| DNS | 19:11:21 | ⚠ **Amplify wrote the `club` CNAME into Route 53 itself** (same-account zone). The certificate CNAME it asked for was **identical** to one already in the zone from an earlier attempt — ACM reuses it per domain. So the club-side typing step was not exercised |
| Certificate verified | 19:12:04 | `AWAITING_APP_CNAME` — under a minute (record pre-existing; a fresh third-party record is "up to 48 hours") |
| Address verified | 19:14:35 | `PENDING_DEPLOYMENT` |
| **Live** | 19:15:40 | `AVAILABLE` — **4 min 30 s end to end** |
| Certificate | — | `CN=*.b2cowan.com`, SAN `*.b2cowan.com, b2cowan.com`, issued by Amazon RSA 2048 S21, **valid 2026-10-23 → 2027-05-09 (~198 days, not the 13 months AWS's page still says)** — renewal comes twice a year, which makes the "do not delete the record" warning more pressing, not less |
| A club page | 19:16 | `https://club.b2cowan.com/riverdale-minor-ball` → **200 under strict TLS**, title "Riverdale Minor Ball Association"; `/` → 200 (our home page); HSTS sent |
| The Host reaches Next.js | 19:16 | `/teams` on the club domain → **308 to `/milton-bats/teams`** — Next's own redirect ran on the new host, and it **proves the §6 collision live** |
| What the page advertises | 19:16 | `robots.txt` on the club's domain says `Sitemap: https://dev.fieldlogichq.ca/sitemap.xml` — the env-var address leaks onto the club's host, as §6 predicts |
| Other domains during add + remove | 19:11–19:18 | www and dev polled every 5 s — **138 of 138 checks returned 200**, 19:11:09–19:17:55, slowest 0.81 s: no interruption |
| Rebuilds | — | None: last jobs on both branches are from 2026-10-20/21, unchanged |
| `delete-domain-association` | 19:16:20 | Gone by 19:16:28 (8 s); Amplify **removed its own Route 53 record** too; the name stopped resolving; app back to its two domains |

**What the proof did not settle:** a club typing two records at GoDaddy-class DNS and how long a fresh certificate takes there
(AWS: up to 48 h, usually minutes); the apex; the ceiling (§5). The first real club connection is the place to time the
third-party path — or a second proof on a domain held elsewhere, if the owner wants it before the build.

## 5 · What was created in AWS (and removed)

| What | When (UTC) | State at the end |
|---|---|---|
| Service Quotas request `3cf4d5a0e00041faa1a671c4e4b4136cDiAVWLwq`: Amplify `Domains per app` → 500, us-east-2 | 19:10 | `CASE_OPENED` at 19:13 (AWS routed it to a person) — left open on purpose (the answer we need) |
| Amplify domain association `b2cowan.com`, subdomain `club` → branch `dev` | 19:11 | **Removed** 19:16:28 — the app lists only fieldlogichq.ca and fieldlogichq.com |
| Route 53 CNAME `club.b2cowan.com → d3huwmeoybfwrl.cloudfront.net` (TTL 500) — **written by Amplify itself** (the zone is in the same account); nothing was added by hand | 19:11 | **Removed by Amplify** with the association; the zone is back to its original 6 records |
| The certificate-check CNAME `_525aac…b2cowan.com` | pre-existing | untouched — it was already in the zone; Amplify asked for the identical record |

## 6 · What the app must learn (sized, not built)

Leads from a code census 2026-10-23, spot-checked where marked ✓.

| Area | What changes | Files | Size |
|---|---|---|---|
| **Host → club** | Nothing reads the Host today ✓ (`proxy.ts`: path only; `x-org-slug` from the first segment). A rewrite in the proxy: known club host + `/about` → `/{slug}/about`. The matcher must widen to public pages **on club hosts only** (www's public pages must not start paying for the proxy). A host→club lookup on every club request: **no cross-request cache exists**; needs one (an in-process map refreshed every few minutes, or `unstable_cache`) — a database read per request is not acceptable | `proxy.ts`, new `lib/club-host.ts` | M |
| **Old shortcut collision** ✓ | `next.config.ts:86-93` sends `/schedule`, `/teams`, `/register`… to `/milton-bats/…` on **every** host. On a club's domain `/teams` would open another club. Scope them to our hosts (`has: host`) — a correctness bug the day 4e ships | `next.config.ts` | S |
| **Links inside pages** | ~90 slug-prefixed links (41 in 17 public pages, 49 in 24 components, plus 6 link helpers in `lib/`). One helper `clubPath(slug, path)` that drops the slug on the club's own host; mostly mechanical, a guard test to keep it | ~45 files | M–L |
| **Absolute addresses** | `metadataBase` hard-coded (`app/layout.tsx:40`); sitemap and robots from the env var; `sportsTeamJsonLd`'s caller builds www URLs; `clubPageMetadata()` on 17 pages sets no canonical. Per host: the club's sitemap lists its own pages; previews and JSON-LD speak the club's address | `app/layout.tsx`, `app/sitemap.ts`, `app/robots.ts`, `lib/club-share.ts`, `lib/club-page-meta.ts` | M |
| **Share / copy-link** | 6 public share buttons read `window.location.origin` (right on the club's host by accident); **11 admin/coach copy-link screens hand out www** — they should hand out the club's address once connected | 17 files | S–M |
| **What stays on www** | Sign-in and coach links are relative today (`/auth/login` in 3 public components, `/coaches/…` in registration) — on a club host they would 404 or show an empty session. Make them absolute to www. **11 public surfaces show signed-in state** (ClubBar's Sign in / account menu, follow buttons and alerts, the tournament banner, MyTeamDock, registration's coach team list): on the club's host every visitor is signed out (cookies are host-only, ✓). Recommendation: on a club host, hide the follow/account pieces and show a plain "Sign in" link to www; do not try to share the session | ~12 files | M |
| **Trust rule** ✓ | `isTrustedAppOrigin` guards email links that carry a live one-time token; **it must NOT widen.** A club-host origin falls back to www, which is right (sign-in lives there). Public forms (tryout, league registration) post same-origin to `/api` with no origin check, so they work on the club's host unchanged. `resolveSameHostOrigin` (public calendar feed) falls back to www — fine | none (a test pins it) | S |
| **Duplicates** | Same page at `www…/{slug}` and the club's domain. Recommendation: **301 from www to the club's domain** for that club's public pages once connected (posters and old links keep working; search moves over), plus a canonical as belt-and-braces | `proxy.ts` or `next.config.ts` | S |
| **Tournament pages** | Under the org today. In or out of the club's domain is an owner ask (§7) | — | S if in (same rewrite) |
| **Never on a custom domain** | Demo orgs are a hard-coded slug list (`lib/demo-org.ts`), the sandbox cookie host-only — refuse a domain for a demo slug at connect time | `lib/demo-org.ts` caller | S |
| **Headers** | `frame-ancestors 'self'` / SAMEORIGIN already mean "this host" on a club's domain; HSTS on a club's domain forces HTTPS on **their** host for 2 years — acceptable (their site is HTTPS-only with us), but it outlives a disconnect: say so on the disconnect step. The security-headers test needs no change | none | — |
| **Storage + connect flow** | A domain column (likely `org_public_site_content`), status, last check; the Settings screen; owner-only API calling Amplify; a daily status check; disconnect | migration, route, screen | M |

**Rough total: one large stage** — the routing and link work is the bulk; the hosting part itself is small.

## 7 · Asks for the owner (each with a recommendation)

> **⚖ RULED 2026-10-23 (owner, from the spike page): all five as recommended** — (1) our host, wait for AWS's answer, nothing
> built on a front; (2) connect `www`, forward the bare name, offer ALIAS where the host supports it; (3) tournament pages ride
> the club's address; (4) the old address forwards to the club's (and search engines are told); (5) signed-in pieces hidden on
> the club's address, one "Sign in" link to FieldLogicHQ.
>
> **Also 2026-10-23 (owner):** a $5/month add-on for the address was raised and **declined — it stays included at no extra
> charge** (the 2026-10-19 decision stands unchanged; reasons: ~2% of a Club plan, a gate + billing line + copy to build, a peer
> includes it free, and the address is a retention asset). **The quota is not a blocker** (owner): raises in small steps are
> fine, and the 3 free slots carry the first three clubs.
> **Build recommendation added (the ceiling's safety net):** clubs point `www` at **a name we own** (e.g.
> `sites.fieldlogichq.ca`, which points on to Amplify), never at Amplify's own target. If AWS ever caps us and a front becomes
> necessary, we change one record and no club touches its DNS. Plausible because Amplify's edge targets proved interchangeable
> (§1.4); **unproven** whether Amplify's address check accepts the extra hop — a five-minute test at the start of the build.

1. **The path** — Amplify natively, if AWS grants ≥ a few hundred; front (a) only if refused. *Rec: wait for AWS's answer; no
   build starts on the front.*
2. **The apex** — connect `www`, forward the bare name at the registrar; ALIAS where offered. *Rec: yes.*
3. **Tournament pages on the club's domain** — *Rec: in.* They are the club's pages to a family, and the same rewrite carries them.
4. **The old address** — *Rec: 301 to the club's domain + canonical*; posters keep working.
5. **Signed-in pieces on the club's host** — *Rec: hidden, with one "Sign in" link to FieldLogicHQ.*

## 8 · Next step (named, not done)

The 4e drawing — the Settings "connect your address" screen: the two records to copy, checking, connected, the forwarding
advice for the bare name, the error states (record missing, another host still holds the name, the certificate record
removed), disconnect; the words through `/marketing`. Then the build prompt, sized by §6.
