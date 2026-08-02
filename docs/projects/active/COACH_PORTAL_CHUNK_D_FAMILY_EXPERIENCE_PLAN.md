# Chunk D — The family experience: IMPLEMENTATION PLAN (build-ready)

> **Created 2026-08-01; finalized 2026-08-01 after owner rulings.** Companion to
> `COACH_PORTAL_CHUNK_D_FAMILY_EXPERIENCE_DISCOVERY.md` (evaluation; §10 = the binding rulings)
> and `COACH_PORTAL_CHUNK_D_FAMILY_EXPERIENCE_PM_BRIEF.md`.
> **Status: DIRECTION APPROVED — mockups v3 approved 2026-08-01 (artifact
> `2b0cbcab-9848-4a69-a0e6-a8c90cc85eb2`, the BINDING visual spec).** Strategy entry logged
> 2026-08-01 in `BUSINESS_DECISIONS.md` (premium-only · two-tier · parent-initiated · visibility
> setting). **STATUS 2026-08-01: Slices 0, 1 and 2 are BUILT on dev (uncommitted). The GUARDIAN
> tier is shipped SWITCHED OFF — turning it on is gated on the PIPEDA/CASL counsel review. The
> FOLLOWER tier carries no child data and is not gated. SLICE 4 (family chat) IS CUT.
> **STATUS 2026-08-01 (later): SLICE 3 IS ALSO BUILT on dev (uncommitted) — see §9.4. Its
> coach-side half (postgame draft, recap preview, certificates, engagement + org counts) works
> today; the family-delivered half (recap, keepsake) rides the same guardian switch.**

---

## 0 · The model in one paragraph

Families connect to a premium team through one coach-shared **team family link**. Whoever opens
it declares a tier: **guardian** (player-linked, ≤2/player, the money/registration contact; gets
recap + keepsake + announcements archive) or **family follower** (team-level, never
tied to a player, uncapped; gets schedule/results/game pages/calendar/game-update alerts). Both
land in the coach's approval queue. A per-team **Schedule visibility** setting (Staff / Families
default / Public link) governs every family/public schedule surface. Everything is
**premium-portals-only**. Parent surfaces live in the consumer app.

**Out of scope (binding):** RSVP/availability (G3-deferred; decision scheduled post-Slice-2),
photo sharing, athlete accounts, public player pages, any new SKU/price, pitch-by-pitch anything,
Basic-team family surfaces, public team/child search, **and family chat (Slice 4, CUT 2026-08-01 —
chat stays coaches/admins only).**

---

## 1 · Slice 0 — Substrate + legal packet (parallel track; small)

Independent of every other slice; the counsel packet is the guardian tier's gate.

| # | Work item | Notes |
|---|---|---|
| 0.1 | Guardian-email normalization | Lowercase/trim on all write paths (public tryout submit is the unnormalized one — verified); one-time backfill migration across `rep_roster_players`, `rep_tryout_registrations`, `league_registrations` |
| 0.2 | Consent ledger | `family_consents` (or link-table columns if counsel prefers): who, org, basis (`express_link` \| `tryout_form` \| `registration_implied`), basis_started_at, withdrawn_at, source pointer. Backfill from tryout consents |
| 0.3 | Email-families unsubscribe | Per-guardian suppression honored by the announcements send path (guardian-scoped HMAC variant of the existing unsubscribe rail; footer link in announcement emails). Ships standalone — closes discovery G8 |
| 0.4 | Tryout-response name minimization (decision #9) | Offer page renders first name + last initial |
| 0.5 | Counsel packet (owner action; we prepare) | Guardian consent flow + wording (mirrors approved tryout-form text), age-band model (under-13 OPC / under-14 Quebec Law 25), CASL posture for family email (express at link; implied-by-registration 24-month clock), transactional-vs-commercial classification of announcements, the #14 verification mechanism |
| 0.6 | Data-dictionary sync | Same unit of work as each migration; fixes the known drift at DATA_DICTIONARY.md:2563 |

**Exit:** counsel sign-off recorded in `BUSINESS_DECISIONS.md` (gates Slice 2 only); 0.1–0.4
shipped whenever ready.

## 2 · Slice 1 — The follower experience (no child data; can start immediately)

The fastest shippable family value: "grandma knows where the game is."

**Migration `21x_family_links.sql`:**

```
family_links (
  id uuid pk,
  org_id uuid fk organizations,
  rep_team_id uuid fk rep_teams,            -- team scope (both tiers)
  role text check ('guardian'|'follower'),
  player_id uuid fk rep_roster_players null on delete cascade,
                                            -- guardian: required (season-scoped roster row)
                                            -- follower: ALWAYS NULL (no child data)
  user_id uuid fk auth.users null,          -- null until claimed
  invited_email text not null,              -- normalized match key
  relationship text null,                   -- display label only ('Mom','Grandpa')
  status text check ('requested'|'invited'|'pending_approval'|'verified'|'declined'|'revoked'),
  verified_via text null check ('email_match'|'coach_approved'|'registration_match'),
  requested_player_name text null,          -- guardian requests only; matched at approval
  claim_token_hash text unique null,        -- token rail (32B random → sha256)
  claim_expires_at timestamptz,
  invited_by_user_id uuid,
  consent_recorded_at timestamptz null,     -- + consent_ip (guardian tier; ledger row same tx)
  created_at / updated_at
)
-- CHECK: (role='guardian' AND player_id IS NOT NULL) OR (role='follower' AND player_id IS NULL)
-- Partial UNIQUE: one non-revoked link per (rep_team_id, invited_email, role)
-- RLS: service-role only (mig-212 posture; the browser never queries this table)
```

Plus: `team_family_link_token_hash` (+ reset) and `schedule_visibility`
(`staff`|`families`|`public_link`, default `families`) on the team scope.

| # | Work item | Mockup | Notes |
|---|---|---|---|
| 1.1 | `lib/no-login-token.ts` | — | Factor the 4×-duplicated token convention into one helper; add basic rate limiting on token-resolving GETs (closes the rail's no-rate-limit gap) |
| 1.2 | Team family link + reset | S5 top card | One revocable link per team; coach copies/shares; reset invalidates |
| 1.3 | Request page (`app/family/join/[token]`) — follower path | S2 | Tier choice; follower path = relationship only, no player questions, no child-data consent (adult self-consent + standard ToS). Shows the requester NOTHING from the roster. Sign-in/create → request |
| 1.4 | Coach approval queue + Family access panel (team card) | S5 | Followers list ("Family followers · 6 · Manage"), request rows, approve/decline/remove; batched digest ("3 waiting"), approve-several; capability: `rosterPii` |
| 1.5 | Schedule visibility setting | S5 | Three levels, default `families`; enforced server-side in EVERY family/public schedule read; flipping to `staff` hides all family schedule surfaces (links stay, quiet "not available" state) |
| 1.6 | Family team view — one-list schedule | S3 | Chronological, no sections, initial scroll anchored at next upcoming; completed rows scored, upcoming rows not; practices inline. Follower + (later) guardian shared view. New `app/api/family/...` namespace resolving links from session |
| 1.7 | Consumer integration | S1 note | A verified follower's team plants a normal account team-follow (`fan_follows`) → appears in Following with the family team view behind it |
| 1.8 | Rep-team game page + share | S4 | `/{org}/teams/{teamSlug}/games/{eventId}`, tournament game-detail pattern, noindex, team-level only, `toPublicTeam`-grade DTO discipline; minted by explicit per-game "Share game link" (event slide-over); available at `families`/`public_link`, never `staff` |
| 1.9 | Standing no-login team page | S4 note | Only at `public_link`; team-level schedule/results; carries the "Connect your account" footer pitch |
| 1.10 | ICS calendar feed | S3 row | Feed route on revocable tokens: per-family token at `families` (from the family view), team-wide token at `public_link`; reuses `lib/export/ics.ts` composition |
| 1.11 | Game-update notifications (followers + guardians) | — | Schedule-change + final-score events for the family-linked team via the account-routed fan-notify path; in-app + email only (G9 — push waits for the VAPID runbook) |
| 1.12 | SW + invariant | — | `/family` into `NEVER_CACHE_PREFIXES` same commit; anonymous-public-invariant assertions extended to game page + team page (no identity in SSR, no PII) |
| 1.13 | Adoption metrics | — | Requested → approved/declined/abandoned, per team + org, from day one (existing observability counters) |

**Exit / QA walk:** coach shares link → grandparent requests as follower → coach approves from
the digest → follower sees the one-list schedule in Following, subscribes the calendar, opens a
shared game page with no account on a second device. Visibility probe: flip
staff/families/public_link and verify every surface appears/disappears **server-side**. Probes as
the unauthorized personas: stranger with a guessed URL, declined requester, revoked follower,
follower of team A probing team B, expired/reset token.

## 3 · Slice 2 — The guardian tier (BUILT + SWITCHED OFF; turning it on is blocked by counsel)

> **Status change 2026-08-01 (owner decision).** Originally "do not build until counsel signs
> off." The owner challenged that framing and was **right about half of it**: a coach INVITING
> the guardian address already on the roster row is not a new trust decision — that address is
> already on the player, already receives team email, and already receives tryout-offer links
> naming the child. What IS new is (a) the standing view of a child's records a connected
> guardian receives, and (b) an unsolicited requester **asserting** a parental relationship the
> coach cannot truly verify. Only those two are what the counsel questions cover.
>
> Ruling: **build it now, ship it switched off.** `GUARDIAN_TIER_ENABLED` (server-side,
> default off — the `ENTITLEMENT_GRANTS_ENABLED` convention) refuses every guardian request,
> invite, claim and coach route while off, so **no guardian link and no consent record can be
> created**, by the UI or by a direct API call. `tests/uat/scenarios/family-guardian-tier-boundary.spec.ts`
> asserts the switch actually holds AND that the follower tier stays walled off — the latter
> written to pass in both switch states, so it remains the standing guard once it is on.
>
> **Turning it on still requires counsel sign-off recorded in `BUSINESS_DECISIONS.md`.** The
> consent wording shipped is an explicitly-marked placeholder (one constant,
> `GUARDIAN_CONSENT_TEXT`, kept identical to the on-screen copy and visibly labelled a draft),
> so sign-off is a copy change plus a flag flip rather than a build.
>
> **Deliberately still NOT built:** 2.7 season renewal (depends on the continuity-confirm
> flow) and the recap/keepsake byproducts, which are Slice 3.
>
> **Migration 216** was required: mig 215's CHECK demanded a player on every guardian row,
> which the ruled-on flow cannot satisfy — the parent types a first name into a form that shows
> no roster and the COACH attaches the row at approval. The constraint now requires a player
> only once a guardian is `verified`. **The follower half — `role='follower' ⇒ player_id IS
> NULL`, the tier boundary itself — is byte-identical and was not touched.**

| # | Work item | Mockup | Notes |
|---|---|---|---|
| 2.1 | Guardian request path | S2 | Player first name + relationship + the child-data consents (0.5 wording) + age-band question; writes consent ledger row same tx |
| 2.2 | Verification (#14 as amended §10.3) | S5 | Coach-sent per-player invite claimed at that exact email ⇒ verified (`email_match`); unsolicited request ⇒ queue always (email-match assist chip only); registration auto-verify (`registration_match`) in league/club contexts at claim + sign-in reconciliation |
| 2.3 | Per-player guardians panel | S5 bottom card | "Maya's guardians · max 2"; approve attaches player row; revoke; direct-invite secondary path |
| 2.4 | Co-guardian invite | — | A verified guardian invites the second household's adult (within cap 2); followers pointed at the follower path |
| 2.5 | "Your players" band | S1 | Guardian home band: next event, last result, announcements pill |
| 2.6 | Announcements archive | S3 bottom card | Guardian-only (v1 recommendation, mockup-approved); requires the new per-team announcement-body read model (store bodies, not just counts — small schema addition) |
| 2.7 | Season renewal | — | On coach continuity-confirm, offer "carry family access forward" (guardians re-linked to the new roster row; followers are team-scoped and simply persist). Old-season links stay = the archive rule (decision #2 exemption) |
| 2.8 | Metrics split | — | Auto-verified vs approved vs abandoned, guardian vs follower |

**Exit / QA:** two-household walk (guardian + co-guardian in different households); the
**tier-boundary probe: an approved FOLLOWER requesting any guardian payload (Your players,
announcements archive, recap route) must fail closed** — this is the standing security invariant
of the two-tier model. Cap probe: third guardian request refused cleanly.

## 4 · Slice 3 — Coach byproducts (the retention artifacts)

| # | Work item | Mockup | Notes |
|---|---|---|---|
| 3.1 | Postgame recap draft | S6 | Score entered → "Draft family email" → prefilled Email families compose; opt-in per send (D-E9; no auto-send ever); skipping leaves no visible hole |
| 3.2 | Player season recap | S7 | `assemblePlayerSeasonRecap` sibling of the shipped Season Wrapped engine: attendance, development before/after, awards, fair-play innings, team arc; degrades honestly (absent data = absent block, never fabricated); coach preview before family release; guardian-delivered; readable post-season (decision #2 exemption — family reads via their own season link, outside the coach-archive allow-lists, approved knowingly) |
| 3.3 | Keepsake card | S7 | Canvas share-card rail (wrapped pattern): first name + jersey only, OS share sheet, no public URL, family-triggered |
| 3.4 | Printable certificates | S8 | Print-CSS off `rep_player_awards`, team colors, full name on paper (§8.2 reading, approved); two clicks from awards history |
| 3.5 | Engagement counts | — | Coach-side aggregates ("12 families opened the recap") — counts only, never per-person read receipts |
| 3.6 | Org-admin rollup | — | Per-team connected-family counts on the org side ("340 of 400 guardians connected across 18 teams"); read-only aggregates, no new PII surface |

## 5 · Slice 4 — Family chat — **CUT (owner, 2026-08-01)**

**Removed from this project. Chat stays coaches-and-admins-only for the foreseeable future.**

> Owner ruling: *"you can remove slice 4 from the project, I don't intend to introduce family
> chats any time soon, we can limit chats to coaches and admins for now."*

This also **closes the open G4 reconciliation** this plan had been carrying. The 2026-07-11 G4
entry said "family team-chat basics with ANY Coaches Portal", which sat unresolved against the
2026-08-01 premium-only ruling — the plan flagged it as needing an owner decision at chat
scoping time. There is now no chat slice to scope, so the conflict is moot: **no portal tier
gets family chat, because family chat is not being built.**

What this saves, recorded so a future session understands the cut was substantive rather than
cosmetic: the chat engine has **no remove/ban capability anywhere** (verified in discovery),
which the G3 safeguarding preconditions require before any adult–minor-adjacent room could
open. Family chat was therefore never one slice — it was a moderation-toolkit build plus a
counsel re-check plus the room itself. Cutting it removes the single largest liability surface
in the chunk.

**What the schema keeps:** the `coach_parent` room surface reserved in migration 141 stays
where it is. It costs nothing, and leaving it is not a commitment to use it.

**If this is ever revisited** it needs a new Business Decisions entry, not a revival of this
section — the preconditions above have not been met and would all still apply.

## 6 · Cross-cutting engineering rules

1. **Fail-closed identity:** every family API resolves link → team → (player) → season
   server-side from the session; no client-supplied ids trusted; service-role reads only — the
   family namespace never opens PostgREST access to roster tables.
2. **Tier boundary is a security boundary:** follower-scoped DTOs are team-level allow-lists
   (schedule/results only); guardian DTOs add the player allow-list (name, number, position,
   attendance %, development summaries, awards) and structurally exclude medical/admin
   notes, dues detail, and other guardians' contacts. Probes cover the boundary before every
   release; any new family payload extends the probes first.
3. **Visibility setting is enforced at the API**, never by hiding UI; `staff` hides surfaces
   server-side with quiet states, not errors.
4. **Archive/season:** guardian links are season-row-scoped (renewal at continuity-confirm);
   follower links are team-scoped and persist; coach-side family management is live-season-only;
   the coach archive allow-lists are untouched. Family-side historical recap reads are the
   approved decision-#2 exemption.
5. **Caps:** guardians ≤2/player, followers safety-ceiling 50/team — app-side transactional
   count checks (the partial unique index handles duplicates, not counts).
6. **Concurrent sessions:** don't touch the practice-plans file set (mig 213) or the
   nav-unification set. Stage with `:(literal)` pathspecs; audit `git show --stat HEAD`.
7. **Verification order per slice:** `npm run verify:changed` + focused lint; `npm run
   typecheck` on shared-module touches; probe suites per the frozen-season exemplar
   (service-role self-provisioning, marker prefix, asserted teardown, real in-app controls,
   computed styles); fresh dev restart before owner QA (new routes + shared modules).
8. **Docs:** `/docs` pass per user-facing slice (coach Family access + family request flow +
   visibility setting; the family-facing views). Dictionary + snapshots per migration.
   `/billing` wiring per the 2026-08-01 strategy entry handoff (premium gate + Facts-doc
   reconciliation + drift check). `/simplify` then `/review` (high-risk — minors' data) per
   slice before owner QA.

## 7 · Sequencing

| Order | Slice | Gate | Size |
|---|---|---|---|
| 1 (now) | 0 substrate (0.1–0.4, 0.6) + counsel packet (0.5) | none | S–M |
| 2 (now) | 1 follower experience | mockups ✅ (approved v3) | M–L |
| 3 | 2 guardian tier | ✅ BUILT, switched OFF — counsel sign-off to turn ON | M |
| 4 | 3 coach byproducts | coach-side parts need nothing; family DELIVERY of the recap needs the guardian switch on | M–L |
| ~~5~~ | ~~4 family chat~~ | **CUT 2026-08-01 (owner)** — chat stays coaches/admins only | — |

**January 2027 story:** what's live by the conversion = the follower experience + practice
visibility + (if counsel closes in time) guardians + the recap. Chat is after, by design
(flagged to the owner as #7b; not accelerated).

## 8 · Risks (updated for the final model)

- **Counsel reshapes the guardian consent flow** → guardian tier is isolated in Slice 2; the
  follower tier and all of Slice 1 are structurally unaffected.
- **Follower tier cannibalizes guardian sign-ups** → deliberate and priced in: the follower path
  is the retention surface; guardian value (recap, announcements, chat later) is the stated
  pitch at request time (the tier chooser names it). Metrics from day one tell us if the
  guardian tier needs more pull.
- **Coach adoption** (nobody shares the link) → the share prompt rides moments the coach already
  visits (season start, roster, schedule); org rollup makes non-adoption visible to the club.
- **A follower reaches child data** → the tier boundary probes are the standing guard; DTO
  allow-lists structural, not filtered.
- **Guardian-email quality** (stale/typo'd) → normalization first; queue is the human fallback;
  bounce surfaced to the coach, never silent.
- ~~Chat liability~~ → **retired as a risk: Slice 4 was CUT** (owner, 2026-08-01). The chunk delivers its thesis without it, which was always the plan's own claim — now it is simply the whole scope.

---

## 9 · BUILD RECORD — Slices 0 + 1 (2026-08-01)

**Status: BUILT on `dev`, UNCOMMITTED, owner QA pending.** Migrations **214** and **215** are
applied to **DEV ONLY** — they must be applied to prod before any of this code is promoted to
`master`. Schema parity therefore reports dev/prod divergence; that is the correct state, not a
defect (same posture as mig 213).

**Delivered — Slice 0:** 0.1 guardian-email normalization (one write-path rule in
`lib/guardian-email.ts`, funnelled through `lib/db.ts`'s four write sites, plus a backfill across
all three tables) · 0.2 `family_consents` ledger, backfilled from the tryout form's existing
express consents as two separately-scoped rows · 0.3 per-family unsubscribe on "Email families"
(new HMAC token family, suppression list honoured on every send, coach sees a COUNT not the
addresses) · 0.4 tryout-offer page shows first name + last initial (route and page) ·
0.5 `COACH_PORTAL_CHUNK_D_COUNSEL_PACKET.md` · 0.6 dictionary + snapshots synced, and the known
drift at the `rep_tryout_registrations` consent columns corrected.

**Delivered — Slice 1:** all of 1.1–1.13 for the FOLLOWER path. The guardian tier renders in the
tier chooser and routes to an honest hold state; the API refuses `role='guardian'` outright.

**Verification:** `npm run typecheck` clean · `verify:changed` — 0 lint errors, every colour-token
ratchet at ZERO, date-correctness ratchet at ZERO, dictionary coverage OK, snapshot freshness OK.
New probe suite `tests/uat/scenarios/family-access-boundary.spec.ts` (stranger / declined /
revoked / cross-team / reset-link / visibility-flip / share-gate / tier-boundary).

### 9.1 Deviations from the plan and the approved mockups

Recorded here rather than absorbed silently, per the mockup rule.

1. **`fan_follows` needed a new entity type — the handoff's claim was wrong.** The build prompt
   stated a verified follower's team could be planted "through the existing consumer follow path"
   as an ordinary `team` follow. Verified against code and mig 186: `entity_type` carries a CHECK
   limited to `(tournament|team|org)`, and `entity_id` for `team` is documented AND resolved as
   `teams.id` — the TOURNAMENT team table. A rep-team id written there would violate the contract
   and be silently dropped by the Following reader, so the family's team would simply never
   appear. Mig 215 adds a fourth member, `rep_team`, with its own resolver. **Cost: one extra
   constraint change; no behaviour compromise.**
2. **The coach's "Team family access" card is on the ROSTER INDEX, not the player page** the
   mockup drew it on. In Slice 1 every control on that card is team-level (the link, the
   visibility setting, the followers, who are tied to no player), so a coach looking at one child
   is the wrong context. When Slice 2 adds the per-player **guardians** card, that one goes on the
   player page exactly as mocked and this card stays where it is.
3. **The family surfaces sit inside the consumer shell**, so `/family/join/[token]` carries the
   app's bottom navigation, which the S2 phone frame does not draw. The two-family ruling (parent
   surfaces live in the consumer app, no third shell) outranks a mockup frame detail, and a family
   member arriving from a group chat is better served by having the app around them.
4. **The guardian tier's request path is a hold state, not a hidden option.** The mockup shows the
   guardian path as the selected default. Since it is counsel-gated, it renders, explains plainly
   that it is not open yet, and points at the follower path — rather than being removed (which
   would tell a parent the product does not know they exist) or accepted-and-parked (which would
   write a consent record we could not defend).
5. **Per-guardian unsubscribe covers the PREMIUM path only.** `basic_coach_teams` has no
   organization to key an opt-out against, so the free-tier "Email families" still has no
   unsubscribe. Recorded as a known gap and raised as question 6 in the counsel packet — not
   solved by inventing an org for free teams.
6. **The four existing no-login token rails were not retro-fitted with rate limiting.** The shared
   helper carries it and every NEW rail gets it by construction; retro-fitting shipped flows is a
   behaviour change (evaluators sharing a tryout-weekend wifi would start seeing 429s) that
   deserves its own change and its own QA.

### 9.2 `/simplify` + `/review` record (2026-08-01, same session)

**`/simplify`** (4 lenses) — 8 applied, 2 skipped. Applied: the public team page no longer pays
extra DB round-trips for a feature ~all teams never enable (it short-circuits on the visibility
it already holds); family email compliance (suppression + unsubscribe footer) moved behind ONE
guarded sender that cannot mail an opted-out address; schedule-row labelling factored so the
two schedule surfaces cannot drift; three byte-identical coach auth chains collapsed into one
that carries the premium gate; the `staff` predicate exported instead of hand-written four
times; the calendar-subscribe route stopped building a whole season to test one setting;
independent queries parallelized in the team view and the game view; the platform's existing
monogram helper reused. Skipped: parameterizing approve/decline/revoke (explicitness wins in
the most security-sensitive functions here) and hoisting the panel's availability check to the
page (correct as-is; deferred to a slice that already touches that page's data loading).

**`/review`** at **high-risk**, 5 adversarial lenses. Deterministic gate green (typecheck,
lint, every colour/date ratchet at ZERO, dictionary coverage, snapshot freshness); the only red
is prod-migration drift, which is the intended dev-ahead state.

*Confirmed and FIXED:*

| Sev | Finding |
|---|---|
| **Critical** | **`family` was missing from `RESERVED_ORG_SLUGS`.** Adding the `/family` route without reserving the slug meant an org could register `family` and have its ENTIRE public site shadowed by the new static route — the exact collision that file exists to prevent, and the one thing in this build that could break an unrelated paying customer. Verified in the main loop; no org holds that slug on dev (**re-check prod before promoting**). |
| High | The family notification compared only OUR score, so a 4–2 corrected to **4–3** (opponent's number only) told nobody. Now all three score fields. |
| High | **Recurring "this & future" edits notified nobody at all** — that path returned before the notifier. Moving a season of practices from Tuesdays to Wednesdays was silent. Now fires ONE notification for the series (not one per occurrence). |
| High | A game with a result but no scores (a forfeit mirrored from a tournament) rendered a literal **"null–null"** on the shared public page, and read as finished on one surface and upcoming on another. "Over" and "has a score" are now two separate server-computed facts on the DTO, so no surface can hold a second opinion. |
| High | A double-submitted follow request escaped as a raw **500** instead of the friendly "already with the coach" — the check and the insert are two statements. Now translated to the same 409. |
| Medium | **Un-cancelling** a game notified nobody, so families told a game was off never learned it was back on. New "is back on" message. |
| Medium | An announcement where everyone opted out mid-send logged as **"Sent"** with zero recipients. Suppressed sends are now a third outcome, and a send that reached nobody says so. |
| Medium | The join page showed a waiting family the whole request form again, as if they had never asked; they only learned otherwise by submitting. It now says their request is with the coach. |
| Medium | The coach's save awaited **sequential** per-recipient emails — a full team could add tens of seconds to a button press. Now bounded-parallel. |
| Medium | Practices could skew the family-facing win/loss record (no server-side type guard). Record now counts result-bearing event types only. |
| Medium | The rate-limit table grew forever. Opportunistic sampled cleanup added. |
| Low | The calendar feed ignored the coach's actual end time and used a fixed default. |
| Low | The new notification had no bell icon (fell back to a generic one). |
| Advisory | A completed shared game lost its link through to the shared page — the score was inline but the page a grandparent was sent no longer reachable from the list. |

*Confirmed, NOT fixed (recorded):*
- **Rate-limit subject is a spoofable `X-Forwarded-For`.** Pre-existing platform-wide pattern
  (`lib/rate-limit.ts` documents the same caveat); fixing it properly needs trusted-proxy
  configuration and belongs in its own change. Token entropy still makes guessing infeasible.
- **Announcement double-send race** (rate gate and log row both land after the send loop) —
  pre-existing in the announcements path, not introduced here.
- **A pre-v10 service worker can cache `/family` before it updates** — the same accepted
  tradeoff already made for `/chat`, `/following`, `/account`. Release-runbook note.
- **`fan_follows` CHECK re-validates on ADD** — a table scan under lock at promotion time.
  Prod table size unknown; run during low traffic.
- **Follower-ceiling TOCTOU** — bounded overshoot by genuine concurrent submitters, matching
  the code's own "abuse ceiling, not a cap" framing.

*Refuted:* one concurrency claim that the suppression list re-queries per recipient — it does
not when a preloaded set is passed, which is exactly why the narrower snapshot-window finding
from the security lens is the accurate one. The comment overstating the guarantee was corrected.

### 9.2b Slice 2 `/simplify` + `/review` record (2026-08-01)

**`/simplify`** found a **compliance defect**, not a cleanup nit: the coach-invite on-ramp
never wrote a consent record, so a guardian verified that way had none — the exact evidence
this packet promises. Fixed by moving consent capture to the CLAIM (the parent's own act;
a coach's invite is not the parent agreeing). Also: the consent wording now lives in one
client-importable module both the screen and the stored record read, so they cannot drift —
the constant written to prevent that drift was itself unused while the screen hand-typed its
copy. Plus the duplicated tier-boundary condition became one shared resolver, the age bands
one list, and lookups were parallelized.

**`/review`** at high-risk, 2 lenses, both of which found a **Critical**:

| Sev | Finding | Fix |
|---|---|---|
| **Critical** | **The follower-approve endpoint was role-blind** and could verify a GUARDIAN row — skipping the consent record, the two-per-player cap AND the guardian feature switch. A coach already sees guardian link ids, so this was reachable. It defeats the exact guarantee ("verified guardian ⇒ provable consent") the switch exists to protect. | Every shared link mutator now takes a required `role` and filters on it, so neither tier's endpoint can touch the other's rows. |
| **Critical** | **Parent-initiated guardian requests were invisible to every coach screen.** Mig 216 deliberately allowed a request with no player attached; the reader still skipped those rows as "structurally impossible" — true under mig 215, false the moment I relaxed the CHECK *for this very flow*. The primary on-ramp could never be approved. **I changed the constraint and not the reader.** | Unattached requests are returned separately and shown on every player's card, with the typed name and an explicit **"Approve as {player}"** so the coach's assertion is visible. |
| High | Approving an unclaimed **invite** minted a verified guardian with no account attached — unusable, consuming a cap slot forever, and it bricked the genuine claim. | Approve no longer accepts `invited`; those rows show "invite sent — waiting for them to accept" with a cancel. |
| Medium-High | A mismatched claim downgraded to "pending approval" but the coach saw only the address **they** typed — the mismatch it exists to flag was invisible, so approval was blind. | Recorded as a follow-up: needs the claimant's address surfaced beside the invited one. |
| Medium/High | **The two-per-player cap had no database backstop** — count-then-insert, so concurrent approvals both passed. A named owner ruling enforced only by a racing read. | Mig 217 adds a trigger; the app check stays for the friendly message and the route translates the trigger's refusal. |
| Medium | **A second child's consent was silently dropped** — the uniqueness key had no player dimension, so a parent of siblings had their second consent no-op, leaving the first looking like evidence for both while the younger child's age band was never captured. | Mig 217 keys consent per consent ACT (`source_id`). |

*Confirmed, not fixed:* `revokeFamilyLink` has no status precondition (Low — revoke is terminal
either way, and both reachable paths are coach-gated).

*Verified clean by the security lens:* the tier boundary (follower → guardian is structurally
impossible), IDOR/tenancy on every guardian path, PII scoping of the guardian payload, claim
replay, and the switch itself apart from the Critical above.

## 9.4 · BUILD RECORD — Slice 3, the coach byproducts (2026-08-01)

**Status: BUILT on `dev`, UNCOMMITTED, owner QA pending.** Migration **219** is applied to
**DEV ONLY** (renumbered from 218 mid-build — see deviation 4). Migrations **214–219** must all
reach prod before any of this promotes.

**Delivered — all of 3.1–3.6.** 3.1 postgame draft (score saved → prefilled Email-families
compose, opt-in per send, no auto-send anywhere) · 3.2 player season recap (pure engine +
server assembly + one shared view rendered on BOTH the family page and the coach preview) ·
3.3 keepsake card on the shipped canvas share-card rail (first name + jersey, OS share sheet,
no public URL) · 3.4 printable certificates off the awards report (Letter landscape, team
colour, full name — the approved paper exception) · 3.5 recap engagement counts on Season's End
· 3.6 per-team + club-wide family counts on the org's Rep Teams list.

**Verification:** `typecheck` clean in scope · `verify:changed` — 0 lint errors, every
colour-token ratchet at ZERO, date-correctness ratchet at ZERO, dictionary coverage OK,
snapshot freshness OK at #219. 29 new unit tests (`player-season-recap`, `postgame-draft`).
New probe suite `tests/uat/scenarios/family-recap-boundary.spec.ts` (anonymous / follower /
guardian-of-another-child / under-granted assistant ×2 / archive-one-way ×2 / no-read-receipts ×2).

### 9.4.1 Deviations from the plan and the approved mockups

1. **The recap never labels a measurable an IMPROVEMENT.** Mockup S7 reads "sprint test 8.2s →
   7.6s" as growth. A coach's test type carries a name and a free-text unit and nothing else —
   there is no direction field, so the product cannot know whether lower is better for
   "seconds", "reps" or "mph". The recap states **first reading → latest reading as a fact**,
   with no arrow and no colour. Inventing a direction is exactly the fabrication this screen
   exists to prevent.
2. **The certificate carries a SIGNATURE LINE, not a printed coach name.** The mockup prints
   "Coach R. Alvarez". Any coach with awards access can print one and is not necessarily the
   coach of record; printing someone else's name under someone else's award is worse than a
   rule the presenting coach signs.
3. **There is no "release recaps" button — closing the season IS the release.** The plan said
   "coach previews before family release". Once a season closes, every write to it is refused
   platform-wide, so a coach could not act on anything a post-close preview showed them. The
   preview therefore lives on the LIVE season (where they can still log a reading or give an
   award) and closing the season hands recaps over. This also avoided a write to a closed
   season, which the build-enforced archive guard forbids outright.
4. **Migration renumbered 218 → 219.** A concurrent session took 218 for a drills change while
   this was in flight. Two files sharing one number is how a migration gets silently skipped at
   promotion; the other session's file was left untouched.
5. **The coach's recap preview is LIVE-SEASON ONLY, and the archive allow-lists were NOT
   touched.** Under the opt-in rule this is the fail-closed default. **Open question for the
   owner:** should a coach be able to re-open a PAST season's recap to see what a family is
   reading? It passes all three archive questions (record not instrument; single read-only
   route; shows what was true at the time) but adding it is a decision, not a formality.
6. **The recap is gated on the schedule-visibility setting.** That setting is named for the
   schedule, but a coach who sets a team to "Staff only" means "families see nothing right
   now"; leaving a child's recap open behind it would be a surprise.
7. **Engagement counts landed on Season's End, not the live family panel.** A family cannot
   open a recap before the season closes, so the live panel could only ever have shown a zero.

### 9.4.2 `/simplify` + `/review` record (2026-08-01, same session)

**`/simplify`** (4 lenses) — 11 applied, 3 skipped. Applied: the postgame draft now uses the
family schedule's own date/time/"vs–at" helpers so the email and the list a parent opens next
cannot disagree; recap trend values go through the shared measurable formatter (float noise);
the org family rollup moved to the module that owns "who is connected"; `connected` is summed
server-side once instead of re-derived in three client expressions; the recap gate now takes
the already-verified link and premium-gate result instead of re-deriving both (removed a
duplicate link query and an entitlement round-trip per family page load); recap assembly
switched from the hydrated whole-team awards read to a player-scoped one (2 fewer queries, and
it stops fetching other children's full names in a module whose discipline is first-name-only);
the roster fetch joined the parallel batch; the admin route runs its two independent reads
concurrently; two near-identical "Not available" blocks collapsed to one. **Most consequential:
`resolveFamilyRecap` — a function named like a read that also wrote — was deleted; the recap
page now does gate → assemble → record as three explicit steps, so a future reuse for a digest
or export cannot stamp a phantom view.** Skipped: a per-player attendance query (needs new
data-layer plumbing for a marginal gain), and two documented-deliberate duplications.

**`/review`** at **high-risk**, 5 adversarial lenses. Deterministic gate green; the only red is
prod-migration drift, which is the intended dev-ahead state.

*Confirmed and FIXED:*

| Sev | Finding |
|---|---|
| **High** | **Two migrations both numbered 218.** A concurrent session took the number mid-build. At promotion "apply 218" is ambiguous and one of the two gets silently skipped — the failure mode migration 040 already cost us. Renumbered to 219 + dictionary + snapshot watermark re-synced. |
| Medium | **The coach could be shown "3 of 2 families opened it".** Revoking a guardian is a status change, not a delete, so their view record outlives their link — the numerator counted every view for the season while the denominator counted only currently-verified guardians. A mid-season guardian swap makes viewers exceed eligible. The numerator is now resolved FROM the denominator, so it cannot exceed its own total. |
| Medium | **Two different tests sharing a name were merged into one fabricated trend.** Test names are unique only among ACTIVE types, so a retired "Sprint" and a new "Sprint" are two tests wearing one label — splicing them invents a season-long change from unrelated measurements. Separately, a coach can edit a test's unit mid-season and each reading stores the unit it was logged with, so "30 → 110" could be a metres-to-feet conversion shown to a parent as progress. Now grouped by test identity, and a trend whose two ends were measured in different units is DROPPED. |
| Medium | **"Next up" could name a game that already happened.** The platform has no "completed" status — a played game stays "scheduled" and is marked done by having a score. A coach backfilling both halves of a Saturday double-header on Sunday night got game 1's draft announcing game 2 as upcoming: a false claim placed INTO the coach's email, not merely a missing one. Candidates now exclude anything already carrying a result or a score. |
| Medium | **The "we drafted this" note went stale.** It was a captured constant: after a successful send it kept claiming a draft was present over an empty box, and after reusing a past announcement it attributed someone else's words to the score just saved. Now real state, cleared on both flows. |

*Confirmed, NOT fixed (recorded):*
- **Family-adoption reads have no row cap** — would under-count for a very large, long-lived
  club. Mirrors the pre-existing sibling function beside it exactly; fixing one and not the
  other is worse than fixing neither. Its own change.
- **The club-wide "connected families" number counts links across all seasons**, so a
  rolled-over team includes prior-season guardian links. Counts only, no identity — recorded as
  a known nuance of what the number means.
- **A default assistant coach can print certificates carrying full names.** The awards report
  they already have lists those same full names to the same people, so the certificate adds no
  new exposure. Pre-existing permission predicate, out of scope.

*Verified clean under attack:* follower reaching a recap; guardian of one child reaching
another's; declined/revoked/pending links; signed-in stranger; cross-org and cross-team;
bypassing the premium gate through the new parameter; an under-permissioned assistant reaching
the preview or the counts. Also clean: no surname, contact, medical or admin note escapes into
the recap or the keepsake image; the engagement table exposes no per-person receipt and is
service-role only; the coach preview cannot address a past season, leaving the archive rule
intact.

### 9.4.3 Known follow-ups (Slice 3)

- **Owner decision wanted:** should the coach's recap preview be openable on a PAST season?
  (deviation 5). Live-season-only ships today; adding it later is small.
- **Apply migs 214–219 to prod before promoting.** Migration 219 is DEV-ONLY.
- **The family half stays dark until the guardian switch flips.** The recap and keepsake are
  DELIVERED to guardians; the coach preview, the certificates, the postgame draft and both
  count surfaces need no flag and work today.

### 9.3 Known follow-ups

- ~~**Before the guardian switch is turned on:** surface the CLAIMANT's email beside the invited
  one on a `pending_approval` row.~~ ✅ **RESOLVED 2026-08-01** (mig **220**, DEV-ONLY). Every
  claim now records the address the claimant actually holds (`family_links.claimed_email`),
  captured at claim time rather than resolved live — it is evidence behind an approval decision
  about a minor's data, and sits beside `consent_recorded_at`/`consent_ip` which are captured
  the same way. The waiting row now leads with the CLAIMANT (they are the person in front of the
  coach) and states plainly which invited address they don't match and that the mismatch is why
  it is waiting. The roster-contact assist chip is suppressed on a mismatched row so two
  different "about the address" claims never sit side by side. **QA note: this path cannot be
  exercised until the guardian switch is on — verify it in the same sitting as the switch.**
- **Before promoting, confirm no PROD org holds the slug `family`.** The reserved-slug list is
  checked at creation time only, so adding the word does not rescue an org that already has it.
  Verified clear on dev; prod not checked from this session.
- **Apply migs 214 + 215 to prod before promoting.** Mig 215 contains a FUNCTION, and
  `check:migrations` gives a **false green** for function-only changes (mig 211's lesson) —
  confirm `bump_no_login_rate_limit` exists in prod by querying `pg_proc` directly.
- **Push is still not honest.** Family game-update alerts are bell + email only until the Android
  VAPID runbook passes. The event type is deliberately absent from the push defaults.
- **`sw.js` bumped to v10** — the first load after deploy refreshes the service worker.
