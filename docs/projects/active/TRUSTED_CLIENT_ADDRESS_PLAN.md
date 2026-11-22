# One trusted visitor address for every rate limit — Implementation Plan

> **Status:** Planning (owner ruled 2026-11-18: "not now, its own small item"; sequenced by dependency, no date)
> **Created:** 2026-11-18
> **Branch:** dev
> **Found by:** the Stage 10 printable-rules `/review` (`PUBLIC_TOURNAMENT_STAGE10_BUILD_PROMPT.md`, "Left to the owner")
> **PM brief:** [TRUSTED_CLIENT_ADDRESS_PM_BRIEF.md](TRUSTED_CLIENT_ADDRESS_PM_BRIEF.md)

## Goal

Every per-visitor limit in the product tells visitors apart by the address in the `x-forwarded-for` header, and reads
the **first** entry of it (`clientIpFrom`, `lib/rate-limit.ts`). A caller chooses the first entry, so anyone who sends a
different made-up address on each request gets a fresh allowance every time and the per-visitor limit never bites. The
site-wide limit behind each one still caps total load, so this is a weakness in fairness and in abuse control (sign-up,
password reset, resend, registration), not an open door.

**The fix already exists and is already proven on one route.** `lib/trusted-client-ip.ts` (`trustedClientIp`) reads the
address the edge itself wrote (`cloudfront-viewer-address`, else the **last** `x-forwarded-for` entry, else `x-real-ip`)
and is used by the feedback route only (`app/api/feedback/route.ts`; test `board-ready-w2-fix-d-smalls.test.ts`). This item
moves the rest of the product onto it.

## What the code shows (read 2026-11-18)

- **22 files read `clientIpFrom`**, in three kinds of use:
  1. **Limit keys (the weakness):** `lib/public-form-throttle.ts` (three limiters, used by the public forms), the
     Rules download (`app/[orgSlug]/[tournamentSlug]/rules/pdf/route.ts`), and the auth routes (`signup`, `coach-signup`,
     `team-signup`, `forgot-password`, `resend-invite`, `resend-verification`), `league/create`, `register/account-check`,
     `coaches/registration-account-status`, `client/error-capture`, `client/nav-beacon`, `events/consumer`,
     `see-it-live` (two), `sandbox/switch` (two).
  2. **A recorded value, not a limit:** `family/claim/[token]` and the rep-team tryout register route store it as the
     consent address; `register/route.ts` passes it into account opening. Today they record what the caller declared;
     after the fix they record what the edge saw — more truthful, and nothing new is collected.
  3. **A second copy of the same reader:** `lib/no-login-token.ts` (`subjectKey`) reads the first entry too, and its limit
     is database-backed (hashed address), the strongest limit in the product, so forging there matters most.
- **Several tests pin the text `clientIpFrom(req)`** in callers (`register-form-throttle`, `sign-in-words-and-no-tell-guard`,
  and others). So the least disruptive fix keeps the NAME and changes what it returns, instead of renaming at 22 call sites.
- **Failure mode is safe, by the helper's own design:** with no proxy (the dev server) every caller reads `unknown`, one
  bucket, as today. If an extra hop ever sits after CloudFront, visitors share the edge's address and the limit tightens
  for everyone — a safe failure, never an open one.

## ⚠ The one thing the code cannot tell us

`trustedClientIp` assumes CloudFront's header reaches the app on Amplify Hosting, and that the last list entry really is
the edge's. The helper's comment says so; **nothing in the repo proves it on the hosted site.** If neither holds (an extra
Amplify hop appended after CloudFront), the "trusted" address would be the hop's address for everyone and every visitor
would share one bucket — a real outage of sign-up and password reset for legitimate people. So Phase 1 measures before
anything is switched.

## Phases

### Phase 1 — Measure what the hosted site really sends (no behaviour change)
- [ ] Decide how to see the headers on staging without exposing them: a temporary platform-admin-only read that returns
      only (a) whether `cloudfront-viewer-address` is present, (b) the number of `x-forwarded-for` entries, (c) whether the
      first and last entries differ — never the addresses themselves. Remove it after reading. (Owner runs it on staging; I
      do not read production.)
- [ ] Record the finding in this plan (which source is the edge's): header present, or last entry, or neither.
- [ ] If neither is trustworthy: stop and bring the owner the alternative (a signed edge header, or leave the limits as
      best-effort and lean on the site-wide caps). Do not ship Phase 2.

### Phase 2 — One reader (the fix)
- [ ] `lib/rate-limit.ts`: `clientIpFrom` returns `trustedClientIp(req)` (import from `lib/trusted-client-ip.ts`, which is
      pure); fix its comment, which now says "spoofable".
- [ ] `lib/no-login-token.ts` `subjectKey`: use the same reader (keep the hashing).
- [ ] Update the two route comments that say `x-forwarded-for` is forgeable and lean on the global ceiling
      (`client/error-capture`, `client/nav-beacon`) so they describe the new reality (the global ceiling stays).
- [ ] `app/api/feedback/route.ts`: switch to `clientIpFrom` so there is one reader, or keep `trustedClientIp` and have the
      shim delegate — one name at the call sites, one body.
- [ ] Tests: turn `board-ready-w2-fix-d-smalls.test.ts`'s forged-first-entry case into a test of `clientIpFrom`; add: a forged
      first entry is ignored; the CloudFront header wins and an IPv6 `[addr]:port` parses; no headers reads `unknown`.
      Re-run the tests that pin `clientIpFrom(req)` text (they should pass unchanged).
- [ ] `npm run lint:focused` on the changed files; `npm run typecheck` (shared module).

### Phase 3 — Prove it on staging, then release with the next promote
- [ ] Owner walk (short, ≈6 steps): on staging, request a password reset or resend ten times with a different made-up
      forwarding address each time → refused after the limit; then the same from a normal browser and a phone on another
      network → each gets its own allowance (nobody is locked out by a neighbour). The dev server cannot show this: it reads
      `unknown` for everyone.
- [ ] `/release` carries it; no migration, no switch, no plan gate (every plan).

## Architectural decisions
- **Keep the name `clientIpFrom`, change the body.** 22 call sites and several source-pattern tests name it; a rename is
  churn with no safety gain, and a new caller that reaches for the old name gets the safe reader by default.
- **Do not build a shared store for limits here.** The in-memory limiters are per-instance by design (header comment);
  a store is a different, larger decision. This item only stops the key from being forgeable.
- **Measure first.** A wrong guess about the hosted header could lock out real visitors; a one-time read is cheap.

## Checks owed with the change
- `/legal`: nothing new is collected or promised; the consent address recorded on the family claim and the tryout form
  becomes the edge-observed one. Confirm the privacy wording says "address" generally and not "the address you entered".
- `/accounting`: not touched.
- `/docs`: no user-facing flow changes; no help edit expected.

## Words for /marketing
- None. The refusal wording each route already shows is unchanged.

## Open Questions
- [ ] Phase 1: does the hosted site send `cloudfront-viewer-address`, and is the last `x-forwarded-for` entry the edge's?
- [ ] Should the (rare, lawful) visitor behind one office address who now shares a bucket with colleagues be a concern? It is
      the same as today for honest callers; only forgers lose, so recommended: no.
