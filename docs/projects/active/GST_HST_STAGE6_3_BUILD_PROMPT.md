# GST/HST Stage 6 · step 6.3 — acceptance at every door, built dark (build prompt)

> Written 2026-11-09 by the 6.3 planning session (`/plan`, Opus) from
> [GST_HST_STAGE6_3_KICKOFF_PROMPT.md](GST_HST_STAGE6_3_KICKOFF_PROMPT.md). **Run as Sonnet build sessions, three chunks, in
> order.** Plan of record: [GST_HST_STAGE6_TERMS_PLAN.md](GST_HST_STAGE6_TERMS_PLAN.md) — §3's RULED block (O5, O7, O8) and the
> **§5 6.3 RULED block (R1–R10, 2026-11-09)** are binding. PM brief: [GST_HST_STAGE6_TERMS_PM_BRIEF.md](GST_HST_STAGE6_TERMS_PM_BRIEF.md).
> **Customer words:** the Terms draft `docs/agents/legal/drafts/TERMS_OF_SERVICE.md` §20 "The words the product shows", items
> (1)–(3), copied exactly; anything else is `/legal`'s, from the drawing round.
> **Drawings:** [GST_HST_STAGE6_3_DRAWING_PROMPT.md](GST_HST_STAGE6_3_DRAWING_PROMPT.md) — **Chunk A does not wait for them;
> Chunks B and C are built to the approved drawings.** **APPROVED 2026-11-09, all ten asks as recommended** (owner: "looks good,
> i agree with your recommendations") — Artifact https://claude.ai/artifact/FmTh8vmm39qY4N9Z6TAj7c, source
> [GST_HST_STAGE6_3_DRAWINGS.html](GST_HST_STAGE6_3_DRAWINGS.html); its tab 8 holds the build notes. Rulings: **1A** the box after
> the last field, above the main button · **2A** a sign-up card's button stays on; pressing without the tick shows (5b), nothing
> sent (the screen and the window stay off-until-ticked, §20) · **3A** FieldLogicHQ's lockup on the screen, portal colours · **4A**
> window title "Before you continue" · **5A** the window opens over whatever is there (over the move window, kept underneath) ·
> **6A** the paid line is read before the button (a window's body end; above the button on a column; under the billing table after
> the tax line) · **7A** Sign out in the foot row with "Signed in as {email}" · **8A** the cancel door is built in Chunk B with the
> "updated" screen · **9A** no legal foot line on the screen · **10A** the nudge's box at 13.6 px in a 44 px row. The `/legal`
> words are in the Terms draft §20 item (5) (2026-11-09).
> Marks: **[V]** opened by the planning session 2026-11-09; **[H]** a helper's census that day — open the line before relying on it.

## What this builds (owner's view)
Once the legal pages' switch is on (dev preview now; everyone at 6.7), **every door that makes an account carries one required
box** — "I'm 18 or older (or the age of majority where I live). I agree to the Terms of Service and have read the Privacy
Policy." — and the server refuses without it. **Everyone who already has an account** meets one full screen, "We've published
our Terms", before their portal opens. **Nobody starts an organization or a paid plan** without having accepted the current
Terms, and the line about renewal and cancelling sits beside every paid button. FieldLogicHQ staff and the two demo accounts
never see any of it. **With the switch off — production until 6.7 — nothing renders, records or refuses, anywhere.**

## The rulings this build implements (owner, 2026-11-09, "as recommended")
1. **R1 — the record.** One append-only table, **one row per tick**: the person (link cleared if the account is deleted),
   their email as text, the Terms version, the Privacy Policy version, **the exact sentence they ticked** (text, like the
   family consent record — `lib/family-guardian-consent.ts:91` `guardianConsentText` [V]), which door, and when. **No IP
   address, no device.** The age promise is recorded by the sentence, not by a separate always-true flag. The accepted Terms
   version is also mirrored onto the auth user's `app_metadata` (service-role only — the Founding Season start-door lock is the
   precedent, `lib/founding-season.ts:41` [V]), so the check costs no query: every layout already calls `supabase.auth.getUser()`
   (`lib/supabase-server.ts:43–47` [V]), which returns fresh `app_metadata` from the auth server.
2. **R2 — the dev preview.** A row recorded in the preview carries the literal `'draft'`; it satisfies the check while the mode
   is `preview` and **never** satisfies a dated version. At 6.7 the publication constant flips everywhere, dev included, so
   every dev account accepts again (a rehearsal of the real switch-over). Production records nothing while the mode is `off`,
   and a `'draft'` row could never satisfy anything there anyway.
3. **R3 — the screen.** The sign-in screen **replaces the signed-in shell at the same address** — no redirect, no route of its
   own, no nav (the `CoachTeamSeasonGate` pattern: decided server-side, nothing else mounts). Slow network: the button reads
   "Saving…" and stays off. Failed save: the box stays ticked, a line and the button come back. Version moved while open: the
   §20 line, the box un-ticked, the page re-reads. **Sign out is always on the screen.**
4. **R4 — who is exempt.** One home, exactly two kinds: **FieldLogicHQ staff** and **the demo accounts**. Fixture and seed
   accounts are **not** exempt — they record acceptance. A test fails if a third kind is added.
5. **R5 — accounts nobody ticks for.** Every door where a person sets a password on a page we render gets the box (the four
   invitation doors included). Accounts made with nobody present are covered three ways: scripts and dev seed routes record
   acceptance, the demo accounts are exempt, and anything else meets the sign-in screen at first sign-in.
6. **R6 — the paid-button line belongs to 6.3.** A stopped purchase opens a small window with the box over the purchase; after
   one tick **the purchase continues by itself with the same choices** (replay the click — never make the person start again).
7. **R7 — three chunks:** A the engine (invisible), B the account doors and the sign-in screen, C the organization and plan
   gates, the line, the window and the full census. Fixtures ride in A, before any screen exists.
8. **R8 — words for `/legal`** (listed at the end; settled in the drawing round before B).
9. **R9 — drawn first.** B and C wait on the drawing round; A does not.
10. **R10 — only the Terms bring the screen back.** The Privacy Policy version is recorded (what the person was shown) and never
    blocks. `/legal` confirms at 6.6.

**Also settled in the planning session (disagreements with the plan, argued from the code):**
- **Six signed-in shells, not five**, and platform admin is not one of them: the scorekeeper and check-in layouts are signed-in
  shells the plan missed; platform admin is staff-only, so it is listed as exempt and does not call the check.
- **A layout check runs on a full page load only.** Next 16 layouts do not re-render on in-app navigation
  (`node_modules/next/dist/docs/01-app/02-guides/authentication.md:1350` [V]). An installed app left open across the flip shows
  the screen at its next full load. Accepted: the organization and purchase routes carry their own check, so nobody becomes a
  customer in that gap. Do **not** add polling or a visibility-change probe.
- **Cancelling is never gated.** Cancel, downgrade, "keep my current plan" and the billing portal are deliberately left
  unchecked (§18: "If you do not agree, you can cancel"), and the census test lists them as **never gated** so nobody "fixes"
  them later. Whether the sign-in screen also offers a cancel door is `/legal`'s (R8).
- **The staff invitation sets its password in the browser** (`AcceptInviteForm.tsx:135` `supabase.auth.updateUser` [V]) before the
  server sees anything; the server refusal sits on the join (`/api/auth/accept-invite`, called at `:93` [V]). Anyone who goes
  around it meets the sign-in screen.

## Read first (only these)
- `AGENTS.md` (Next 16; `proxy.ts`); the Next docs on layouts and `router.refresh()` for the screen.
- `lib/legal-documents.ts` and `lib/legal-pages-switch.ts` [V] — `currentVersion`, `oldestAcceptedVersion`, `legalPagesMode`.
- `tests/unit/legal-pages-switch.test.ts` [V] (extend its shape) and `tests/unit/coach-history-endpoint-guard.test.ts` [V] (the
  census shape: key on **named functions**, assert the list exactly, fail loudly when blind).
- `app/api/admin/payouts/route.ts:193–249` [V] — the acceptance shape, and the defect A fixes.
- `docs/agents/db/DATA_DICTIONARY.md` maintenance rules (L10–48) and rule 7 (grants: nothing to `anon`/`authenticated`).
- ⚠ **Another session has uncommitted edits in the sign-up and sign-in cards** (seen 2026-11-09: `StartFoot legal` replacing
  `LegalFootLinks` in ~10 forms). Re-read every form from disk at build time; never overwrite another session's hunk.

---

## Chunk A — the engine (no visible surface; does not wait for drawings)

### A1. The migration (first task) — next free number at build time (455 was free on 2026-11-09)
`legal_acceptances`:
| column | type | notes |
|---|---|---|
| `id` | uuid pk default `gen_random_uuid()` | |
| `user_id` | uuid null, FK `auth.users(id)` **on delete set null** | the email below outlives it (the payouts shape) |
| `user_email` | text not null | the email at the moment of the tick |
| `terms_version` | text not null | `'draft'` or `YYYY-MM-DD` |
| `privacy_version` | text not null | the version shown, R10 |
| `box_text` | text not null | the exact sentence ticked (both promises) |
| `door` | text not null, CHECK in the door list (A3) | |
| `accepted_at` | timestamptz not null default `now()` | |
- Index `(user_id, accepted_at desc)`.
- **Append-only:** a trigger refuses UPDATE and DELETE, **except** an UPDATE whose only change is `user_id` → null (the FK's
  set-null on account deletion). Test it in the migration's own probe.
- **Grants (dictionary rule 7):** nothing to `anon`/`authenticated`; service role only. No RLS policy needed beyond enabling RLS.
- No `org_id` — an acceptance is a person's, not an organization's.

### A2. Dictionary + snapshots (same unit of work)
`docs/agents/db/DATA_DICTIONARY.md`: the table and every column with `dict:` anchors, the append-only rule, the `'draft'` meaning,
the `app_metadata` mirror key, and "no IP by design (R1)". Then `npm run refresh:snapshots` (dev **and** prod — the migration is
applied to dev only in this build; prod apply rides the 6.7 release) and `npm run check:dictionary`.

### A3. The record and the check — `lib/legal-acceptance.ts` (new, server-only) + `lib/legal-acceptance-rules.ts` (pure, testable)
- `ACCEPTANCE_DOORS` — the door ids, one per row of the census below (B1) plus `'sign_in_screen'`, `'purchase_window'`,
  `'fixture'`. The CHECK constraint and this list must match (a unit test reads the migration).
- `ACCEPTANCE_BOX_TEXT` — §20 (1)'s sentence as plain text (no link markup), the one string every door stores.
- **`isAccepted(recorded, oldest)`** (pure): `oldest === null` → *not applicable* (the caller does nothing); both `'draft'` →
  accepted; both dates and `recorded >= oldest` → accepted; anything else → not accepted. A `'draft'` never satisfies a date and
  a date never satisfies `'draft'`.
- **`acceptanceState(user)`** → `'off' | 'exempt' | 'accepted' | 'needed'`. Order: mode off → `'off'`; exempt (A4) →
  `'exempt'`; mirror says accepted → `'accepted'`; **otherwise confirm against the table** (latest row's `terms_version`) and, if
  the table says accepted, repair the mirror. The table is the truth; the mirror is a cache that can only ever say "not yet".
- **`recordAcceptance({ user, door, shownTermsVersion })`**: `currentVersion('terms')` null → do nothing and return; if
  `shownTermsVersion !== currentVersion('terms')` → return `{ ok: false, code: 'terms_changed' }` (the payouts rule); else insert
  the row (both versions, `ACCEPTANCE_BOX_TEXT`), **then** write the mirror (insert first, so the mirror never claims what the
  table lacks).
- **`requireAcceptance(user)`** for routes: `'off' | 'exempt' | 'accepted'` → ok; `'needed'` → a 409
  `{ code: 'terms_required', termsVersion: currentVersion('terms') }` the client turns into the window (C).

### A4. The exemption — `lib/legal-acceptance-exempt.ts` (new, the one home)
`acceptanceExemption(user)` → `'staff' | 'demo' | null`. Staff = `isBootstrapAdmin(email)` or an active `platform_users` row
(reuse `lib/platform-auth.ts:31/54` [V]; do not re-implement). Demo = `isDemoOrganizerEmail(email)` (`lib/demo-org.ts:227` [V] —
the demo door signs in only those two accounts, `attachDemoSession(…, demo.organizerEmail)` [V]). Export
`ACCEPTANCE_EXEMPT_KINDS = ['staff', 'demo'] as const`; a unit test pins it to exactly those two with the R4 message.

### A5. Fixtures and seeds record acceptance (before any screen exists)
One shared script helper (e.g. `scripts/lib/record-legal-acceptance.mjs`) that inserts a `door: 'fixture'` row and the mirror for
a user, **using the version the running environment would record** (`'draft'` on dev in preview). Call it wherever a script or
dev seed route makes a login [H — the census]: `seed-club-fixture`, `seed-families-fixture`, `seed-free-coach-fixture`,
`seed-uat-coach-fixture`, `seed-free-tier-org`, `seed-fp5-cluster4/5`, `seed-qa-day-fixtures`, `seed-botb-admin`,
`validate-chat-slice`, `seed-plan-move-walk`, `seed-plan-ending-walk`, `rehearse-plan-ending`, `scripts/lib/billing-walk-fixture`,
`scripts/lib/plan-ending-rehearsal`, and `app/api/dev/seed/{users,org,team-workspace}`. **Not** `seed-platform-staff` or
`app/api/dev/seed/platform-user` (staff, exempt) and **not** the two demo seeds (exempt). UAT specs that `createUser`
(~20 under `tests/uat/scenarios/`) call the same helper through their fixture setup. Note in the helper's header: **after 6.7,
re-run a fixture to re-accept** (its `'draft'` rows stop counting).

### A6. Fix the payouts `connect` defect (plan §5 6.3, kickoff)
`connect` (`payouts/route.ts:197` [V]) checks only that the box was ticked and stamps whatever version is current. Make it send
and compare `termsVersion` exactly as `agree_terms` does at `:239` [V] (`PayoutsCard.tsx:475` [H] sends it; same 409
`terms_changed` and the same words). This is the **payments** terms, not the site Terms — it does not touch the new table.

### A7. Tests (Chunk A)
- `tests/unit/legal-acceptance.test.ts`: `isAccepted`'s truth table (off, draft/draft, draft/date, date/draft, older/newer date);
  `recordAcceptance` records nothing when off; `terms_changed` on a mismatched version; the door list = the migration's CHECK;
  the box text = §20 (1) with the links stripped (read from the Terms draft until 6.7, so a `/legal` edit fails loudly).
- The exempt-kinds pin (A4). The payouts `connect` version check.
- `npm run verify:changed`, `npm run typecheck` (shared module + API contract).

---

## Chunk B — the account doors and the sign-in screen (built to the drawings)

### B1. The census of account doors (verify each line at build time)
**The box and the server refusal land together, door by door** — a refusal without its box breaks the dev preview sign-up.
Every form sends `acceptTerms: true` and `termsVersion` (the version it rendered); every server door calls `recordAcceptance`
**after** the account exists and **refuses before creating anything** when the box is missing or the version moved. With the
mode off, no form renders the box and no route reads the fields.

| door id | the form (box) | the server door (refusal + record) |
|---|---|---|
| `signup` | `app/(consumer)/start/StartDoorForm.tsx:144` (organization door) [H]; `app/(consumer)/auth/signup/AccountOnlySignup.tsx:58` [H] | `app/api/auth/signup/route.ts` (POST :51; creates at :157/:179 [V]) |
| `follow` | `components/public/FollowAccountNudge.tsx:116` [H] | same signup route (pass the door id through) |
| `coach_signup` | `StartDoorForm.tsx:144` (team and league doors); `app/coaches/join/page.tsx:234` [H] | `app/api/auth/coach-signup/route.ts` (POST :44; :112/:140 [V]) |
| `registration` | `components/public/RegisterContent.tsx:655` (verification on) and `:726` (verification off → coach-signup) [H] | `app/api/register/route.ts:676` → `lib/registration-account.ts:31` [H]; the `:726` path through coach-signup |
| `team_signup` | `app/team/TeamSignupClient.tsx:246`, mounted by `app/coaches/start/page.tsx` [H] | `app/api/auth/team-signup/route.ts` (POST :39; :109/:128 [V]) |
| `assistant_invite` | `app/(consumer)/auth/accept-assistant-invite/page.tsx:85` [H] | coach-signup with `inviteToken` (`:36–41` [V]) |
| `league_coach_invite` | `app/(consumer)/auth/accept-league-coach/page.tsx:86` [H] | coach-signup with `inviteToken` |
| `staff_invite` | `app/(consumer)/auth/accept-invite/AcceptInviteForm.tsx` (password at `:135`, join at `:93` [V]) | `app/api/auth/accept-invite/route.ts` (the join; refuse the join without the box) |
| `family_accept` | `app/(consumer)/family/claim/[token]/ClaimClient.tsx:182/193`, a **third** box beside the two at `:275/:279` [H] | `app/api/family/claim/[token]/route.ts:50` → `lib/family-invitation.ts:766` [H/V] |
- The family page shows the Terms box **only when the person has not accepted** (a new account, or a signed-in account in
  `'needed'`). Its guardian and consent boxes, their words and their consent record are **unchanged**.
- **Not doors** [H]: `family/signup/[registrationId]` (read-only), resend-verification, forgot-password, the attach-only
  invitation routes (they need a session — the signed-in shell already ran the check), platform-admin "give free time".
- **Exempt**: `app/api/platform-admin/company-users/route.ts:29` [H] (staff); the demo session (`lib/demo-session.ts:77`).
- The registration that makes an account and the follow nudge are the two doors whose person **may never open a signed-in
  shell** — they are the reason the box must be right, not merely backed by the screen.

### B2. The sign-in screen — one shared server component + one accept route
- `components/legal/TermsAcceptGate.tsx` (server): `acceptanceState(user)`; `'needed'` → render `TermsAcceptScreen` **instead
  of** the shell (no nav, no children); otherwise render children. Off/exempt/accepted renders children untouched.
- `TermsAcceptScreen` (client): §20 (2) words — "We've published our Terms" when the person has **no** row, "We've updated our
  Terms" when they have an older one; the box; Continue off until ticked; Sign out always. POSTs `{ termsVersion }` to
  `app/api/legal/accept/route.ts` (new; `door: 'sign_in_screen'`), then `router.refresh()`. Failed save / slow / version-moved
  behaviour exactly as R3 and the drawings.
- **The cancel door (drawing Ask 8A, `/legal` §20 (5e)) is built here**, on the "We've updated our Terms" variant only, shown only
  to a person who owns a paid plan: one line under the box, above Continue, whose link reaches a cancel that works **without**
  agreeing (cancel is never gated, C1). Several paid plans → a short list. Never on "We've published our Terms". A test proves it
  is absent on first publication and present, and reachable without accepting, on "updated".
- **Sign-up cards (Ask 2A):** the main button stays on; the form checks the box before it sends and shows (5b) in its error
  callout; the server refusal stays as the backstop.
- **Mount it in the six shells** [H — open each]: `app/(consumer)/layout.tsx:38` (covers `/account`, `/family`, `/chat`,
  `/following`; only when a user is signed in — it never redirects a visitor); `app/[orgSlug]/admin/layout.tsx:61`;
  `app/[orgSlug]/coaches/layout.tsx:63`; `app/coaches/layout.tsx:31`; `app/[orgSlug]/scorekeeper/layout.tsx:59`;
  `app/[orgSlug]/check-in/layout.tsx:54`. **Not** `app/platform-admin/layout.tsx` (staff). Mount it **outside** the sandbox
  chrome's demo-only providers, and inside whatever sets the portal theme (the screen wears the host's look).
- The accept route: signed-in only; `requireAcceptance` not used (this is the door that satisfies it); refuses with
  `terms_changed` per A3.

### B3. Tests (Chunk B)
- **The account-door census** (`tests/unit/legal-acceptance-doors.test.ts`, the history-guard shape): every file that calls
  `auth.admin.createUser`, `auth.admin.generateLink({ type: 'signup' | 'invite' })`, or `supabase.auth.updateUser({ password })`
  is either a listed door that calls `recordAcceptance`/refuses, or on the listed **exempt** or **not-a-door** list with its reason
  (staff, demo, recovery, scripts that call the A5 helper). Key on the named calls; assert the lists exactly; a blind-spot
  assertion fails if a route delegates to something the scan cannot follow.
- **The shells census:** every `layout.tsx` that resolves a signed-in user (`getAuthUserCached`, `getAuthContextWithRole`,
  `getCoachPortalAuth`, `getPlatformAdminContext`, `getUser(`) mounts `TermsAcceptGate`, or is listed exempt with its reason
  (platform admin; `app/[orgSlug]/layout.tsx` reads the user for demo orgs only).
- **Dark means invisible:** with the mode off, each door's form renders no box and each server door accepts a body with no
  `acceptTerms` (the production path, unchanged); the gate renders children.
- The demo tour check passes **with the switch on** (the build's gate; `npm run check:demos` or the tour-anchor test).

---

## Chunk C — organizations, plans, the line, the window, the full census (built to the drawings)

### C1. The gate on organizations and plans — `requireAcceptance(user)` **at the top of the handler, before any branch**
(the Founding Season and comp branches write a plan without Stripe — a check placed after them misses them [H]):
| route | note |
|---|---|
| `app/api/org/create/route.ts:40` [H] | creates the org (`createOrganization`, `lib/db.ts:1731` [V]) and the Founding comp |
| `app/api/league/create/route.ts:53` [H] | a league is an org |
| `app/api/coaches/teams/route.ts:43` [H] | the free Basic coach team (no org row, but a workspace a person owns) |
| `app/api/billing/create-checkout/route.ts:71` [H] | before the dev mock (:199) and the Founding upgrade (:290) branches |
| `app/api/billing/create-team-checkout/route.ts:41` [H] | before the comp path (:117); the webhook provisions from it |
| `app/api/billing/move/route.ts:51` (POST only) [H] | DELETE (keep the current plan) is **never gated** |
| `app/api/billing/choose-next-season/route.ts:49` [H] | |
| `app/api/billing/setup-payment-method/route.ts:20` [H] | |
- **Never gated, on purpose (census lists them so):** `billing/portal`, `billing/downgrade/confirm`, `billing/cancel/confirm`,
  `billing/cancel/keep`, `billing/move` DELETE, `billing/move/preview` (read-only), `billing/mock-apply` (dev).
- **Exempt (staff, not a customer's agreement):** `platform-admin/orgs/[id]/plan`, `platform-admin/bulk-operations`,
  `platform-admin/orgs/[id]/overrides`, `platform-admin/people/[id]/portal-free-time` (`lib/portal-free-time-give.ts:232`), the
  dev seed routes. Their owners accept at their next sign-in.
- `lib/team-org-billing.ts:716` `startOrgTeamAddonCheckout` has **no callers** [H] — the census lists it; if it gains one, that
  caller is gated.

### C2. The line beside paid buttons — §20 (3), exactly; the trial sentence before it where a trial applies
One component (`components/legal/PlanTermsLine.tsx`), rendered only when the mode is on and a **price is shown** (§20 note 3: a
comped or Founding button carries no line). At [H]: `components/billing/BillingBody.tsx` (change/reactivate, next-season
choice), `components/billing/PlanMoveDialog.tsx`, `components/billing/PlanPanelDrawer.tsx` (via `lib/plan-upgrade.ts:64`),
`app/[orgSlug]/admin/onboarding/page.tsx:573`, `app/team/TeamSignupClient.tsx:296`. Placement per the drawings.

### C3. The window — a stopped purchase or organization create
A shared client helper wraps the calls above: on `409 terms_required` or `terms_changed` it opens `TermsAcceptWindow` (the
house window; §20 (2) words as the drawings settle them; `door: 'purchase_window'`, same accept route), and on success
**re-sends the original request with the same body** — the person never re-chooses. Closing the window leaves the page as it
was, choices intact. Fallback text (no window available): `/legal`'s refusal line.

### C4. Tests (Chunk C) — the full census, the plan's "done when"
- **Organization census:** every caller of `createOrganization` (and the dev seed's direct insert) is a gated route, an exempt
  staff/dev route, or a lib function whose callers are all one of those (follow `provisionStandaloneTeamWorkspace` →
  `team-checkout` → its routes and the webhook). Fail on an unlisted caller.
- **Plan census:** every file that calls `checkout.sessions.create`, `subscriptions.update`, `subscriptionSchedules.create/update`,
  `createCardSetupSession`, or `billingPortal.sessions.create` is reached only from a gated, never-gated or exempt route, each
  with its reason. Fail on an unlisted file.
- **Placement:** in every gated handler, `requireAcceptance(` appears before the first `if` that returns a success (a source
  check like the history guard's handler-body extraction).
- Dark: with the mode off, every gated route behaves exactly as today and no line renders.

---

## Words for `/legal` (settled in the drawing round, before Chunk B) — **all written 2026-11-09, Terms draft §20 item (5)**
- [x] The failed-save line on the sign-in screen and in the window — (5a).
- [x] The server refusal when the box is not ticked — (5b), plus its "terms changed" twin for a sign-up page.
- [x] The refusal shown when an organization create or a purchase is stopped and the window cannot open — (5c). ⚠ True only if
  every page that can call a gated route sits in a shell that mounts the screen; C4's census names each caller page's shell.
- [x] The purchase window gets its own title and first line — (5d), "Before you continue".
- [x] A cancel door on the "updated" screen, for a paid-plan owner only — (5e); build timing is drawing Ask 8 (rec: Chunk B).
- [x] Kept six years after the account closes — (5f); Privacy Policy §3 and §9 say so. ⚠ The append-only trigger (A1) will need
  a named exception when the six-year end is built (a `/plan` item with the tax-record step; first expiry after 2032).
- [x] R10 confirmed — (5g).
- [x] The family page's third box: no wording conflict — (5h).
Existing words reused, no `/legal` call: "Continue" (§20), "Sign out", "Saving…" (house pattern), "The terms changed while this
window was open. Read them again." (§20).

## Rules that bind every chunk
- **Dark means invisible.** Mode off: no box, no screen, no line, no window, no row, no refusal. Each chunk's tests prove it.
- **Customer words from §20 exactly**; new ones from `/legal`. "Privacy Policy" is the one constant; `npm run check:spelling`.
- **No personal name or home address anywhere (O1′).**
- **Disagree out loud**: a door that no longer exists, or one the census missed, is said before the chunk rests on it.
- Explicit pathspecs only, on `dev`; **ask before committing** — other sessions share this working copy.
- After each chunk: offer `/simplify` (A adds new shared modules), then `/review`. `/legal` reviews what is collected, stored
  and promised **before hand-off** of Chunk C (the record, the box text kept, the email kept as text). `/accounting` is not
  needed (nothing is priced). `/docs`: the help line is written at 6.7.
- Restart the dev server before hand-off (new files, shared modules, layouts).

## The walk (after Chunk C) — one checkable Artifact, one purpose
Every door with the switch on (dev preview), then the switch off. Each account door: the box shows, the button refuses without
it, an account made with it shows a row. The sign-in screen on a phone-sized window in the family app and the coach portal, the
admin, scorekeeper and check-in: first publication words, failed save (go offline), terms changed (edit nothing — the walk
simulates with a fixture whose row is older). A purchase stopped mid-way resumes with the same choices. Cancel works without
accepting. The demo tours with the switch on. Then switch off and repeat a sample: nothing shows. **Fixture teardown listed at
the end** (the walk's accounts and their rows).

## Progress
- [x] Drawing round ([GST_HST_STAGE6_3_DRAWING_PROMPT.md](GST_HST_STAGE6_3_DRAWING_PROMPT.md)) — `/legal` words written
  2026-11-09; drawings **approved 2026-11-09, all ten asks as recommended** (https://claude.ai/artifact/FmTh8vmm39qY4N9Z6TAj7c)
- [x] Chunk A — engine, BUILT 2026-11-09 (commit owed). Migration 455 applied to DEV (lock probe
  `scripts/legal-acceptances-lock-check.sql` 9/9; prod apply rides 6.7, `MANUAL_PROD_STEPS.json`); dictionary + snapshots;
  `lib/legal-acceptance{,-rules,-exempt}.ts`; fixtures record through `scripts/lib/record-legal-acceptance.mjs` (13 scripts),
  `recordFixtureAcceptance` (3 dev seed routes) and `tests/uat/helpers/legal-acceptance.ts` (18 specs + every long-lived role
  in `auth.setup.ts`); payouts `connect` version check (A6); `tests/unit/legal-acceptance.test.ts` 30/30, typecheck clean.
  **Departures, argued:** (1) `PayoutsCard` did **not** send `termsVersion` on `connect` (the [H] at A6 was wrong) — it does now.
  (2) `checkAcceptance` reads the mirror **before** the exemption: same outcome, but the prompt's order cost a `platform_users`
  read on every page load for every customer. (3) `scripts/lib/plan-ending-rehearsal.mjs` makes no login — nothing to wire;
  its callers go through `billing-walk-fixture`'s `ensureUser`, which records. (4) The long-lived UAT roles (made by
  `create-uat-accounts.sql`, not by a spec) record in `auth.setup.ts` — the prompt's list missed them. (5) The legal modules
  import with `.ts` specifiers so plain-Node scripts share the one version rule and box sentence. **For Chunk B:**
  `checkAcceptance` returns `hadEarlier` (published vs updated, the window's (5d) line, the cancel door); `ACCEPTANCE_BOX_PARTS`
  renders the box; `ACCEPTANCE_WORDS` holds (5b)/(5c)/(2)'s refusals; `tournament-scorekeeper-invite.spec.ts` drives an
  invitation door and will need the box ticked once B lands.
  **/simplify DONE 2026-11-09 (uncommitted, rides the Chunk A commit):** one row builder `acceptanceRow` in
  `lib/legal-acceptance-rules.ts`, used by `recordAcceptance` and by the one fixture writer `writeFixtureAcceptance` in
  `scripts/lib/record-legal-acceptance.mjs` (throws; `recordLegalAcceptance` = the scripts' warn-and-carry-on form, now `void`);
  `tests/uat/helpers/legal-acceptance.ts` is a wrapper over it; `auth.setup.ts` finds its roles with `findAuthUserByEmail`
  (`lib/auth-account-lookup.ts`) and skips the scan when off (kept out of the shared helper so the 18 specs don't load
  `supabase-admin`); `fixtureAcceptanceVersions` and `recordLegalAcceptanceByEmail` removed; payouts wording →
  `TERMS_WORDS.refuseChanged` / `refuseSetup` (`lib/online-payment-words.ts`, joins the commit list). **Rejected, argued:**
  running the exemption and table reads in parallel. Staff and demo never carry a mirror and take that path on every load, so it
  would add a table read to every demo-tour page. `after()` for the mirror repair rejected because it drops on Amplify.
  **Follow-up (not this chunk):** there is no shared fixture-account creator, so the acceptance call sits by hand at ~32
  creation paths, and a new seed can forget it silently until 6.7. Proposed: one `ensureFixtureUser` for scripts and one
  `createFixtureUser` for UAT. Verified after simplify: unit tests 133/133, typecheck clean, spelling/dictionary/snapshot OK,
  Playwright lists 16/18 helper specs. `team-attendance-smoke` and `team-lineup-smoke` fail on a pre-existing `server-only`
  import through `team-workspace-provisioning` → `coach-membership`, with no legal file in the chain.
- [ ] Chunk B — account doors + sign-in screen
- [ ] Chunk C — organization and plan gates, line, window, census
- [ ] `/legal` review before hand-off · walk · ledger entry
