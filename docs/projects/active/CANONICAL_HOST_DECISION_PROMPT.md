# Prompt — canonical host decision (one address for the site)

**How to use this:** paste everything below the line into a fresh session. It is self-contained.
The facts in it were verified against the live site on 2026-08-07; ask the agent to re-verify rather
than trust them, because the whole point of this exercise is that stale assumptions caused the bug.

---

## The task

FieldLogicHQ currently answers on **two addresses**, and I need to decide whether to collapse that to
one. Explain the benefits and trade-offs clearly enough for me to make the call, then be ready to
implement whichever option I pick.

**Do not implement anything until I choose.** Investigate, explain, recommend, wait.

## What is true today (verified 2026-08-07 — re-verify before advising)

- `https://fieldlogichq.ca/pricing` → **200**. `https://www.fieldlogichq.ca/pricing` → **200**.
  Neither redirects to the other. **Both addresses serve the entire application.**
- Login sessions are stored in host-scoped cookies, so a session created on one address **does not
  work on the other**.
- There are **no canonical tags** and no `metadataBase` in the root layout, so nothing tells a search
  engine which address is authoritative.
- The canonical address used for links the app generates comes from `NEXT_PUBLIC_APP_URL`, which is
  **not set in production** and therefore falls back to a hardcoded `https://www.fieldlogichq.ca`.
  That value is referenced in ~30 places in the codebase.
- Hosting is AWS Amplify. Production database is Supabase.

## The defect this came from (already fixed — context only)

The no-login product demos mint a shared session and redirect in the same response. They used to
redirect to the *canonical* address regardless of where the visitor was, so a visitor on the short
address had their session written for the short address and was then sent to `www`, where the
browser correctly refused to send it. They landed on a login page — on a product whose entire promise
is that there isn't one.

**That instance is fixed**: those redirects now keep the visitor on the host they arrived at, with
the host still validated against an allow-list. The fix is real and shipped-ready.

**The open question is whether to remove the underlying condition** — two live addresses — instead of
handling it case by case forever.

## What I want from you

### 1. Verify the current state yourself
Re-check both addresses, how the domain is configured in Amplify, and whether anything (DNS records,
certificates, external integrations, previously issued links) depends on the short address answering
directly. Report what you actually find, including anything that contradicts the notes above.

### 2. Lay out the realistic options
At minimum consider: redirect the short address to `www`; redirect `www` to the short address; keep
both and add canonical tags only; keep both and rely on per-route care. There may be others.

For each option give me, in plain language:
- **What changes for a visitor** who has an old link, a bookmark, or an installed app icon
- **What changes for search ranking** — including whether we currently split ranking across two
  addresses, and what a redirect does to that
- **What breaks, and for whom**, including anyone currently signed in
- **Where it is configured** — hosting setting, DNS, or code — and who has to do it
- **How reversible it is**, and how fast

### 3. Name the traps
Specifically check and report on:
- **Anyone signed in on the losing address** — do they get logged out? Is that acceptable?
- **The installed app (PWA)** — its scope and start URL are tied to an address. Does redirecting
  break an existing installed icon on someone's phone, and can that be avoided?
- **Authentication redirect allow-lists** — Supabase holds a list of permitted redirect URLs. If one
  address is missing, sign-in or password reset breaks *after* the change, not during it.
- **Emails already sent** — password resets, invitations and family links carry absolute URLs. Do any
  point at the address that would start redirecting, and do they still work?
- **Anything with a hardcoded address** — the fallback mentioned above, and any others you find.
- **Whether a redirect can break the demo fix** that already shipped, or make it redundant.

### 4. Recommend one, and say what would change your mind
Give me a clear recommendation with the reasoning, and tell me what evidence would make you pick
differently. If the honest answer is "the code fix is enough and this is not worth doing", say that —
I would rather hear it than have work done because it was proposed.

### 5. Give me a plan I can actually run
If I pick a change: the exact steps in order, what to verify after each, how to tell quickly if it
went wrong, and how to undo it. Include how to prove it worked on the **live** site, on **both**
addresses — not just that a test suite is green.

## The standard I care about

This defect existed for months while every automated check reported green, because nothing ever
walked the real product on the real address. **Treat "the tests pass" as insufficient evidence.** If
you cannot verify something directly, say so plainly rather than implying it was checked.

Prices, plan names and gating facts are governed by `docs/agents/strategy/PLAN_PRICING_FACTS.md` and
customer-facing wording goes through the `/marketing` process — do not invent either.

---

# Ruling — 2026-08-08: Option A (apex → www)

Owner approved forwarding `fieldlogichq.ca` → `https://www.fieldlogichq.ca`, implemented as an
in-app host rule beside the existing `.com` rules in `next.config.ts`, shipped **temporary (307)
first** and flipped to permanent after a quiet validation window on live.

**Verified before shipping (2026-08-08):** Supabase Site URL = www with BOTH hosts allow-listed (no
change needed) · prod Vault `app_cron_base_url` = www (no change needed) · neither host indexed by
Google yet (no ranking to migrate) · the `.com` in-app host redirect preserves path + query on the
live stack (tested with a query string) · production `NEXT_PUBLIC_APP_URL` IS set, to www (the
prompt's "not set" premise was stale) · Stripe TEST-mode hosted webhook already targets
dev.fieldlogichq.ca (nothing to repoint) · PWA icons installed from the apex keep opening through
the 307 but show browser chrome and lose their offline/push binding until reinstalled from www —
analyzed and accepted in the ruling.

**Executed 2026-08-08:**
- [x] **Stripe LIVE webhook repointed** `fieldlogichq.ca/api/billing/webhook` →
      `www.fieldlogichq.ca/api/billing/webhook` (endpoint `we_1TdhfjCM7adId42DqZlBE4Jm`; a URL edit
      keeps the signing secret and event list — verified after the edit: enabled, livemode, all 7
      events). Deliveries keep working immediately since www serves the same app today. Both hosts'
      webhook routes re-checked reachable (matching 400 signature-failure responses).
- [x] Demo host-preserving fix committed (separate commit, same push) — the redirect makes the apex
      door unreachable, the fix guards every other host and any future config drift.
- [x] Apex → www rule ships in the commit carrying this note, as `permanent: false` (307).
- [x] Adversarial review (4 lenses) run on the two commits; confirmed follow-ups applied in a third
      commit: the billing audit script's hardcoded webhook host apex → www (it exact-matches the
      live endpoint and would have false-FAILed every future run), sturdier door test pins
      (call-shape match + comment-stripped resolver body), the origin module's orphaned doc-comment
      re-seated, and this doc's precision fixes. The Host-header-fidelity question (does the
      platform hand the app the visitor's true host?) is refuted-in-practice by the live `.com`
      host rule and becomes moot once the apex forwards — the post-promote matrix is the final word.

**Open (in order):**
- [x] **Promoted 2026-08-08 (`725e4b38`, Amplify master job 248 SUCCEED) — live matrix PASSED:**
      apex 307 → www with path + query intact · plain-http chain ends on https://www in 2 hops ·
      www unchanged (200, no redirect) · .com still 308 → www.ca · deep app paths preserved ·
      **the demo door pressed via the apex lands on www WITH the session cookie scoped to www —
      the traced defect's death certificate** · prod cron heartbeats all ok on the first
      post-deploy tick (16:20Z) · CloudWatch master stream: 0 ERROR events in the deploy window.
      Not separately walked: a credentialed browser sign-in on www (cookie+redirect mechanics are
      proven by the door; auth URL config verified in the dashboard API) — falls to normal owner
      browser QA. Stripe deliveries: endpoint verified enabled on www; the dashboard deliveries
      panel is the async check when the next billing event fires.
- [ ] After a quiet 24–48h: flip `permanent: true`; add `metadataBase` + per-page canonical tags;
      consider registering Search Console on www before any marketing push.
- [ ] With the permanent flip: align the nine dormant bare-apex `NEXT_PUBLIC_APP_URL` fallbacks to
      www (env is set in prod so they never fire today — policy hygiene, found in review).
- [ ] Update the stale CLAUDE.md demo paragraph (demo stream owns it — prod now has the door live,
      the tournament org seeded, and the sandbox crons ticking; the coach org is still unseeded).
