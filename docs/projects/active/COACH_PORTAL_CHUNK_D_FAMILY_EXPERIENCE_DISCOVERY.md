# Chunk D — The family experience: DISCOVERY & EVALUATION

> **Written 2026-08-01** by the Chunk D discovery session, per the owner-mandated process in
> `COACH_PORTAL_CHUNK_D_FAMILY_EXPERIENCE_DISCOVERY_PROMPT.md`. This is the written assessment that
> precedes the plan. Inputs: a 15-agent ground-truth sweep of the codebase (every claim cited to
> file:line), independent adversarial verification of the three load-bearing claims, and a
> four-track incumbent study (GameChanger, TeamSnap, TeamLinkt, wider landscape + Canadian privacy
> law). Companion files: `COACH_PORTAL_CHUNK_D_FAMILY_EXPERIENCE_PLAN.md` (implementation plan),
> `COACH_PORTAL_CHUNK_D_FAMILY_EXPERIENCE_PM_BRIEF.md` (PM brief).

---

## 1 · Executive summary

**The question the owner asked — "what would actually entice a coach or an organization to choose
us?" — has a one-sentence answer: we are the only platform where the family layer is a *byproduct*
of work the coach already did, in a product that never sells the family's attention or paywalls a
parent's view of their own child.**

Everything else in this document supports, qualifies, or operationalizes that sentence:

1. **The guardian-identity question is already decided in principle — scope and safeguards, not
   mechanism.** The 2026-07-11 G3 ruling (Business Decisions Log) approved a narrow verified-family
   slice — verified family relationships (approval-gated, ~5 accounts/player cap, no self-claim for
   young age groups), team chat membership, and practice-schedule visibility — with binding
   safeguarding preconditions. Chunk D is not "should we build a guardian identity"; it is "G3
   finally has its build vehicle." **The verification *mechanism* this document designs (§3) goes
   one step beyond what prior rulings settled and is put to the owner as its own decision (#14).**
   The ground-truth sweep confirms G3's foundation is real but not free: registrations are
   account-less by design, so verification is an email-match-and-claim flow that must be built
   (the invite-reconciliation pattern is the proven template), not a join to a column that exists.
2. **Three of the five ledger items survive, one is reshaped into another, and one is reshaped into
   honesty.** Season Recap (#6) is the anchor — reframed from a stats recap (impossible; we capture
   no per-player game stats, verified exhaustively) to a **growth recap**: attendance, development
   before/after, awards, playing time. Postgame recap draft (#3) and printable certificates (#8)
   are cheap, high-frequency coach-delight items — keep. Follow-this-game (#4) is kept but
   reshaped: for tournaments the page already exists; the real gap is that a **rep team's own
   Saturday game has no shareable surface at all**. Trading card (#5) is cut as a standalone and
   folded into the recap as a save-able card image on the already-shipped, adversarially-reviewed
   share-card rail (first name + jersey only, OS share sheet, no public URL).
3. **Family chat is real, wanted, and last.** The chat engine is genuinely ready (a `coach_parent`
   surface has been reserved in the schema since migration 141), but the moderation toolkit was
   built for small trusted coach rooms — there is **no ban/remove capability anywhere in chat** —
   and G3's safeguarding preconditions (no 1:1 adult–minor DMs, delete-with-visible-notice,
   PIPEDA/CASL review before build) are not yet met. Sequence it as its own phase behind the
   identity foundation, not in the first build.
4. **The incumbents confirm the lane.** GameChanger monetizes the emotional archive, not the live
   analytics — and its parents' loudest complaint is paying to see their own kid. TeamSnap's moat is
   the parent logistics loop plus Hockey Canada incumbency; its club tier is opaque and regressing.
   TeamLinkt is free because the parents' attention and data are the product (its ad deck sells
   "32% of families earn $100k+"). None of the three treats "who may see and consent for this
   child" as a first-class data model. Canadian law does — and so, uniquely among them, can we.

---

## 2 · Ground truth — verified 2026-08-01, with corrections to the brief

Every row below was verified against code by the sweep and the load-bearing rows were independently
re-attacked by adversarial verifiers instructed to refute them. Two of the brief's claims needed
correction — flagged ⚠️.

| # | Claim | Verdict | What is actually true |
|---|---|---|---|
| G1 | No mechanism links a signed-in account to a player row; a guardian is contact data only | ✅ **CONFIRMED** (verifier: not refuted) | `OrgRole` has no family value. Guardian data = free-text columns on 4 player-carrying tables (`basic_coach_team_players`, `rep_roster_players`, `rep_tryout_registrations`, `league_registrations`); none has a guardian-linked `user_id`. Nuance: `created_by_user_id` on two tables is a **staff** audit column, never a guardian; `rep_player_continuity_links` links player-to-player across seasons, never user-to-player. `fan_follows` allows only team/tournament/org entities — 'player' is not a valid follow. |
| G2 | No per-player in-game performance data exists anywhere | ✅ **CONFIRMED** (verifier: not refuted) | All three game tables (`games`, `league_games`, `rep_team_events`) carry team-level scores only. No player_id on any game row, no box scores, no scoresheets, in any sport including house league. `rep_team_lineup_entries` is planning data (innings fairness), not results. **A stats-based recap is structurally impossible without new capture — which ruling 3 forbids.** |
| G3 | No public surface renders a child's name | ⚠️ **REFUTED — one exception** | The public org/tournament/team/champions surfaces are genuinely player-free (`toPublicTeam()` is the enforced choke point). **But the no-login tryout-offer page (`app/tryout-response/[token]`) renders the child's full name to anyone holding the URL** — it's guardian-facing by intent but technically unauthenticated (256-bit token is the only credential; forwarded email or shared browser history leaks it). See §9, hardening item. |
| G4 | The no-login tokenized link rail exists and is reusable | ✅ CONFIRMED, stronger than claimed | Four surfaces share the identical pattern (random 32 bytes → base64url, SHA-256 hash stored, expiry + revocation checked per request). It is a convention, not a library — a 4th copy is trivial; a shared `lib/no-login-token.ts` is warranted at next use. Note: neither existing no-login **write** rail has rate limiting; abuse resistance is entropy + DB scoping only. |
| G5 | Parents are in no chat today | ✅ CONFIRMED | Membership derives exclusively from coach/staff resolution. The consumer Chat tab shows fans a static pitch that (in-code comment) "NEVER implies fans/parents get team chat." **A `coach_parent` room surface is reserved in the schema (mig 141) with zero implementation** — the engine is waiting for the identity layer. |
| G6 | "The ingredients already exist server-side" | ⚠️ Half-true, now precisely mapped | TRUE for team-level: public game detail page with 30s live refresh exists (tournaments), score share-cards exist, **Season Wrapped exists** (coach-facing, wow #7, Batch 3) including a share-safe card generator. FALSE for player-level: no stats (G2), no photos (no image column anywhere), no guardian identity (G1). |
| G7 | Registration flows could seed the guardian link | ✅ CONFIRMED, with real cost | Registrations are deliberately account-less; `guardian_email` is "the de-facto family identity" (data dictionary) but is non-unique, unverified, and inconsistently cased between entry paths. The email-match-then-hard-link pattern exists and is proven (`lib/invite-reconciliation.ts` heals invited_email → user_id), but every player-carrying table lacks the target FK column — a migration plus a normalization pass are required first. |
| G8 | Consent capture exists | ✅ Partial — one strong trail, one weak | The tryout form captures PIPEDA data-collection + guardian/eligibility consent (required) and CASL marketing consent (optional, unbundled 2026-07-30) with timestamp + server-captured IP. **"Email families" has no consent trail of its own** — its lawful basis is relational (your email is on the roster), which is defensible for transactional sends but weaker than the tryout trail, and there is no per-guardian unsubscribe on it today. Doc drift found: the data dictionary still claims all three tryout consents are required. |
| G9 | Push alerts could be promised to parents | ⚠️ **NOT honestly, today** | The Android/prod VAPID delivery diagnosis was never closed: the confirmation runbook is still open in `docs/projects/active/`, no owner-verified delivery is on record. Family notifications must lead with email + in-app; push is a bonus once the runbook passes. |
| G10 | Prior decisions constrain this chunk | ✅ CONFIRMED — and they *are* the skeleton | G3 (2026-07-11): verified family + chat membership + practice visibility approved; RSVP/portfolio/self-report/broader comms **remain deferred**; safeguards bind. G4 (2026-07-11): chat basics with ANY coach portal; practice visibility + richer family features ride Premium; **no new SKU, no per-family fee**; org "fan pass" is Proposed only. 2026-08-01: retention play, no public sharing (deferred not cancelled), no pitch-by-pitch. |

### 2b · Walking the product (the mandated walk, done as a route walk of the rendered surfaces)

**As the coach:** Roster → player page shows the guardian fields the coach typed — and nothing to
do with them: no invite, no "does this parent see anything?" answer (the readiness review's P1
finding, still true). Email families sends to those addresses blind — no delivery insight, no
opt-out. Schedule → score entry ends the coach's game-day with the score saved and nobody told.
Season's End computes a season wrap the coach can share as an image — the one place the product
already turns coach work into a family-shaped artifact, and the pattern this chunk generalizes.

**As the parent with no account and only an email address:** the only doors that exist today are
(1) a tryout offer email — whose landing page shows my child's full name to whoever holds the link
(§2 G3), (2) the org's public site — team-level only, where I can follow the team and, on paid
tiers with an account, get score alerts, and (3) the coach's announcement emails — one-way, no
archive, no unsubscribe. I cannot see practices anywhere. I cannot see my own child anywhere.
Mid-season, if I joined late, the announcement history doesn't exist for me. That wall — felt in
one walk — is the chunk.

**Also verified because the plan depends on them:** the archive is opt-in and build-enforced (two
allow-lists fail the build); the coaches nav already has a "Communication" group organized by
audience (Chat = staff, Email families = guardians) — the structural home for family features on
the coach side; the two-shell ruling means the **parent-facing surface belongs in the consumer
app**, not a new shell; the SW cache denylist must list any new authed top-level route (the
/coaches PII-leak lesson); the premium gate a family feature would use is the per-team entitlement
check (`getTeamScopedRepTeamAccess`), with founding-season comp handled at the org layer.

---

## 3 · The crux: the guardian identity — answered

The brief ordered: *"the first question of this chunk is not 'which features' — it is 'does
FieldLogicHQ need a guardian identity, and what does that cost?'"*

**Answer: yes — and the owner already decided it, seven weeks before this brief was written.** The
G3 ruling approved exactly the identity this chunk needs. What discovery adds is the verified cost
and the verified design, which G3 could only assume:

**The design (G3's two on-ramps, made concrete against the real schema):**

- **The link object** is new: guardian account ↔ specific player roster row, with status
  (pending / verified / revoked), how it was verified, and a consent record. Roster rows are
  season-scoped by design, so the link is season-scoped too — it fails closed on a new season and
  renews when the coach confirms player continuity (the continuity-links machinery already models
  "same kid, new season" conservatively — never on email alone). This gives the archive rule for
  free: a family sees a past season because their link to *that season's roster row* existed.
- **On-ramp A — coach-initiated (the primary path):** the coach opens a player, sees the guardian
  contact they already entered, and taps "Invite family." An unguessable, revocable, expiring link
  (the proven 4×-used token rail) goes to the guardian's email. They create/sign into the normal
  consumer account. **Verification mechanism — a NEW decision (#14), because the prior unified-app
  plan ruled email-match is "an assist… discovery only, never live authz" for the coach-approved
  on-ramp.** The recommended three-case model, consistent with that ruling's intent: (a) when the
  **coach themselves sent the invite** to a specific email, a claim from a session verified as that
  exact email needs no second approval — the invite *was* the approval (the assistant-invite flow's
  established trust model); (b) any **unsolicited request** goes to the coach's approval queue,
  always — email match shown as an assist, never granting access by itself; (c) **registration
  auto-verify applies only where G3 granted it** — league/club contexts where the org itself holds
  the family's registration. No self-serve search for a child, ever (G3: no self-claim for young
  age groups).
- **On-ramp B — registration auto-verify (league/club):** same email match run against what the org
  already knows (`league_registrations.guardian_email` — indexed and described in the data
  dictionary as the de-facto family identity). The org took this family's registration and money;
  the match is the verification. **Honest expectation-setting:** roster emails are hand-entered,
  per-tryout, single-parent, and go stale — auto-verify will likely catch a third to a half of
  claims, not "most"; the approval queue is a primary path, not an edge case, so it gets batched
  digest treatment ("3 waiting"), never per-event interruptions. Instrument
  invited → auto-verified → approved → abandoned from the first release.
- **Two-household families, first-class:** the roster carries one guardian email, but a verified
  parent can invite a co-guardian from their own claim/family view (within the 5-cap; the coach
  sees and can revoke every link). Without this, the second household silently never learns the
  feature exists — a common family shape treated as a design input, not an afterthought.
- **The cost, honestly:** one new table + claim/approval flows + a guardian-email normalization
  pass (casing is inconsistent between entry paths today, verified) + consent capture at link
  time + the counsel review G3 made a binding precondition. This is a real foundation slice — 
  roughly the size of the tryouts offer flow — not a presentation task. There is no cheaper honest
  version: every feature families actually want (my kid's schedule, my kid's recap, parents' chat)
  sits on this link, and the incumbents that do family well (Spond, SportsEngine) all made the
  guardian-child link the unit of their data model.

**The privacy design rules that bind it (from the Canadian-law track — carried into the plan):**

1. Every minor profile needs a determinable age band at link time, because the consent flow
   branches on it: under 13 → guardian consents (OPC); **under 14 for Quebec orgs** (Law 25); 14+
   Quebec / 13+ rest-of-Canada may self-consent only via age-appropriate language (not built now —
   we have no athlete accounts — but the age band must be stored so it never needs a rebuild).
2. CASL implied consent from membership is real but **time-boxed** (24 months; 6 for a bare
   inquiry) and message-level. The link record should carry the consent basis + start date, and
   family-facing email needs identification + working per-guardian unsubscribe. Express opt-in at
   link creation is the design move that makes the clock irrelevant.
3. Data minimization by default: a verified family link grants the *family view* (schedule,
   recap, announcements) — it never grants the coach's view (medical notes, admin notes, dues
   detail, other children's data). New surfaces default to the most protective setting.
4. COPPA is a future contingency, not a current requirement — store a jurisdiction signal per
   family so a US-grade consent flow could be switched on later without a data-model rebuild.

---

## 4 · The five ledger items — judged

**#6 Per-player Season Recap — KEEP; it is the anchor. Reshaped from stats to growth.**
The readiness review called it "the single thing every parent actually wants at season's end" —
true, but its imagined content (season stats) does not exist and cannot exist under ruling 3. What
we can populate today, verified field by field: attendance rate and counts, development focus
areas with before/after test readings (when the coach used them), awards with names and emoji,
field/bench innings from the fairness engine, the team's season arc. That is not a consolation
prize — **it is the differentiated version.** GameChanger can tell a parent what their kid's
batting average was; only the coach's actual tooling can tell them what their kid worked on and
how they grew, because we are where that work was recorded. The team-level Season Wrapped engine
(already shipped) provides the assembly pattern and the season-scoped queries; the recap is its
per-player sibling. Premium inclusion per G4. Delivered to verified family accounts; **stays
readable after the season closes** — an end-of-season artifact that vanished at season's end would
be self-defeating (this is a deliberate archive-rule decision, put to the owner in the plan).

**#4 No-login "follow this game" link — KEEP, reshaped to where the gap actually is.**
The owner leaned toward keeping it because a grandparent in another province is a retention story.
Discovery confirms the reasoning and sharpens it: for **tournament** games the page already exists
(public game detail, live 30s refresh, follow stars, share button — built, shipped). The gap is
that a **rep team's own game — the actual Chunk D audience — has no public surface at all**:
`rep_team_events` scores live only inside the coach portal. The honest version of "follow the
game" for a team not capturing pitch-by-pitch is a **team-level game card**: opponent, time,
location + directions before; final score after; live only to the extent the coach updates it. No
child's name anywhere on it (team-level by construction, satisfying ruling 2 — this is the one
family feature that needs no guardian link at all). Reuse the tournament game-detail pattern and
the share-link rail. A coach shares it once to the team's families; the grandparent bookmark does
the rest.

**#3 Postgame recap draft — KEEP; cheapest item with the highest frequency.**
The moment a coach enters a final score on the schedule, offer "Draft the family email" — a
pre-written result message into the existing Email families compose (rate-limited, deduped,
audit-logged — all shipped). Team-level content; the coach edits and sends. It converts the most
routine coach action into visible family value at zero extra evenings — the retention thesis in
one button. Its lawful basis is the same relational basis Email families uses today, strengthened
by the unsubscribe fix in §9.

**#8 Printable certificates — KEEP; the pizza-party moment.**
Awards and award types exist with season scoping; PDF export infrastructure exists. A two-click
print-ready certificate in team colors is a bounded, delightful build with zero new data capture
and zero sharing surface (paper is the medium). The only design work is making it feel like an
award and not a spreadsheet export.

**#5 Player trading card — CUT as a standalone; FOLD its best 20% into the recap.**
Judged honestly: its imagined payload was "number, position, season stats" — and season stats do
not exist. What remains (number, position, awards, a test improvement) is the recap's header, not
a product. Standing infrastructure for sharing a named child's image also collides with ruling 2.
But the **share-card rail already shipped for Season Wrapped** with an adversarially-reviewed
posture — client-drawn PNG, first name + jersey only, handed to the OS share sheet, no public
URL, the human decides where it goes. The recap gets a "Save a keepsake card" that rides exactly
that rail, and the family (not the platform) decides if it leaves the house. Nothing else of #5
survives, and nothing of value is lost.

---

## 5 · Proposals of our own

**P1 — The family home (the G3 slice, made concrete).** A verified guardian opens the same
consumer app every fan uses (two-family ruling: parents are consumers, not operators) and sees a
"Your players" band: the child's team, the next event — including practices, the G4 premium
unlock — the last result, and the coach's announcements. This is deliberately TeamSnap's daily
loop *minus* RSVP (still deferred per G3) and it reuses the consumer shell, follows, and scores
surfaces wholesale. The one screen a parent judges us by (§7) is this screen.

**P2 — The no-login family team link (serving the parent who won't install anything).** BenchApp's
sharpest lesson: design for the guardian who will never create an account. A tokenized, revocable
team link (the 4×-proven rail) showing the team-level view only — schedule, results, announcements
digest. No child's name, no PII, weaker by design than the signed-in experience — the honest
bridge that keeps the 80% who never make accounts inside the retention loop, and the top of the
funnel to on-ramp A. (This also is the delivery answer for the "grandparent in another province.")
**The account-vs-link split is deliberate and must be stated plainly, or the link cannibalizes the
identity investment:** the team link carries the *team's* story (schedule, results, coach's
updates); a verified account is the only place the *child's* story lives (season recap, keepsake,
and eventually chat). If a family only ever uses the link, that is a retention win, not a failure
— the identity layer is priced for the families who want the per-child payload, and adoption of
both paths is instrumented from day one.

**P2b — Calendar subscription (the quiet winner).** A tokenized ICS feed for the team schedule —
subscribe once from the team link or family view, and practices/games appear in the family's own
phone calendar and stay current. Zero identity requirement, rides the same token, and probably
beats every headline feature for day-to-day value ("the calendar is just right, always"). Client-
side ICS export already exists; the feed variant is the missing half.

**P4 — The org-admin rollup (what the club buyer actually sees).** The club pitch in §7 needs a
number, not a vibe: a per-team invited/verified family count on the org side ("340 of 400
guardians connected across your 18 teams"), so a board hears adoption, not anecdotes. Without
this, the family layer is coach-level candy wearing club-tier language — the commercial-skeptic
review's sharpest finding, adopted.

**P5 — Engagement proof for the payer.** The parent sees value; the paying coach must see
evidence: lightweight aggregate counts ("12 families opened Maya's recap · 9 opened Saturday's
update") on the coach side. Retention features that are invisible to the person renewing don't
retain.

**P3 — The guardian consent ledger (the substrate everything legal rides on).** Normalize
guardian_email at the edges, record consent basis + date per guardian per org (express at link
time; implied-by-registration with its 24-month clock; tryout-form express where it exists), give
Email families a per-guardian unsubscribe, and surface "who can this send legally reach" to the
coach as a count, not a burden. Invisible feature; it is what makes every other feature safe to
ship, and it is the CASL/PIPEDA-native posture no US incumbent has.

**Explicitly proposed AGAINST, so a future session doesn't re-propose them innocently:**
- **Photo sharing** — no image storage exists for people; it is the single biggest moderation and
  PII surface in the incumbent set (GameChanger treats posted photos as effectively public — their
  policy disclaims confidentiality). Not in this chunk; needs its own decision with counsel.
- **RSVP / availability** — TeamSnap's stickiest loop and the most-requested next slice, but G3
  explicitly kept it deferred. Recommendation recorded here: schedule its decision immediately
  after Chunk D's first slices ship, because without it we do not fully replace TeamSnap for
  logistics-heavy teams — and we should say that plainly rather than imply otherwise.
- **Public sharing of anything naming a child** — deferred, not cancelled (owner ruling 2026-08-01,
  recorded so it is not re-proposed as new).
- **A parent-facing paid SKU** — G4 already ruled: no new SKU, no per-family fee. The family layer
  sells the coach's $29 upgrade and the club's tier; the parent is never the payer here.

---

## 6 · The incumbent study — what each is actually for, and where each fails our club

*Sourcing note: competitor business figures below are **reported**, single-source where marked —
GameChanger revenue/users per Sportico's 2024 CEO interview; TeamLinkt funding/pricing per BetaKit
and TeamLinkt's own published pricing/advertising pages; TeamSnap Canadian penetration per Hockey
Canada partnership announcements. Full URL list preserved in the discovery session's research
journal; treat exact figures as directional, not audited.*

**GameChanger (Dick's Sporting Goods; reported ~$150M/yr, ~10M users — Sportico).** A scorekeeping-and-broadcasting
app: a volunteer in the dugout live-scores, everyone else follows. Staff tools are free (supply);
monetization is entirely on the family side ($9.99/mo → $99.99/yr; Team Pass for whole rosters).
The retention engine is not the live feed — it is the **emotional archive** ("look back and
celebrate"). Fails our club on: no registration/payments/admin layer at all; baseball/softball-
first depth; USD/US-centric; privacy policy treats a kid's name/stats/photos as effectively
public once posted and shares with ad partners; parents' loudest complaint is **paying to see
their own kid**. Lesson taken: build the free-daily-habit → treasured-archive loop on data we
already hold; never charge the parent for their own child's record.

**TeamSnap.** The parent logistics loop (invite code → roster → availability → schedule → chat) —
the thing Canadian hockey parents have muscle memory for (official Hockey Canada partner; ~⅔ of
minor hockey). Free tier is ad-laden and caps at ~15 people with RSVP paywalled; club tier
("TeamSnap ONE") is sales-gated, opaque, and its 2026 migration reviews report regressed desktop
admin. Treasurer/registrar depth is thin (generic Stripe, no e-transfer culture, no visible
reconciliation story, no CASL tooling found). Fails our club on: admin/money depth, pricing
transparency, ads-on-parents, and platform-transition trust. Lesson taken: we must match the
*simplicity* of the parent loop (P1), and our wedge with the org is the layer TeamSnap never
built — registration, money, CASL-native comms, transparent pricing.

**TeamLinkt (Saskatoon; free-at-the-door; CA$9.7M raised).** The direct pricing threat — and the
easiest honest answer. Free is real, but the business is transaction take-rate + a first-party-
data **ad operation aimed at sports parents** (their sales deck: "32% of families earn $100k+",
splash-screen takeovers, email sendouts) + a $4.99/mo ad-removal subscription sold to those same
parents + $425–795/yr org bundles. Parent reviews cluster on ad/paywall creep and reliability;
B2B reviews flag no admin app, weak multi-division scheduling, poor imports. Fails our club on:
the structural trade — an org that does not want its families' attention sold cannot stay. Our
counter-position (validated, not invented): **"you get what TeamLinkt cannot structurally afford
to give you for free — no ads against your families, an admin-first product, and reliable
multi-division operations."** Where free is genuinely good enough (one small team, ad-tolerant),
we should not pretend price wins — the pitch is for orgs that care.

**The wider landscape, one idea each:** Spond — the guardian-linked account as the *unit of the
data model* (co-guardians notified of each other's actions; our ~5-cap anticipates this).
BenchApp (Canadian) — serve the no-app parent (SMS-grade simplicity; our P2). Heja — light
gamification and photos-as-communication (noted; photos deferred). Stack Team App — broadcast vs
chat separation by audience group (adopted in the chat phase design). SportsEngine — household
accounts + the only incumbent selling a *separate* family product (streaming); their SaaS+fee
stack is the cautionary tale our transparent pricing answers.

**The "sixth app" test the owner set:** a rep family today juggles TeamSnap (logistics) +
GameChanger (games) + e-transfer + a group chat + the club website. Chunk D's slices replace the
website and the games-follow surface immediately, and the logistics loop for reading purposes;
it does not yet replace RSVP (deferred, §5) or capture stats (never, by ruling). The claim "one
place" is strengthened but must be voiced honestly: *one place for everything the club and coach
actually run* — which is the part the incumbents don't have.

---

## 7 · The actual deliverable — what entices whom, and where they conflict

**The volunteer coach** (did not ask for software; counts evenings). Enticement: *the work you
already did becomes what families see — you never type anything twice.* Score entered → family
email drafted. Attendance taken all season → recap written. Awards given → certificates print.
Practices scheduled → families can finally see them (and stop texting you). Every family surface
in this chunk is a byproduct; **the design rule this chunk adopts, stated honestly: no family
surface may *depend* on new recurring coach input to stay truthful.** The postgame recap draft is
the one deliberate exception-shaped item — it invites a weekly action — and it is safe precisely
because skipping it breaks nothing: the draft is coach-side and ephemeral, families never see a
"missing recap" hole, and sends stay opt-in per write (the D-E9 rule; no auto-send to families,
ever). The recap preview is a bounded once-a-season chore (~20–30 minutes) riding the awards-night
ritual that already exists. Everything else is genuinely zero-touch. This is the direct counter to
TeamSnap-fatigue (where the coach feeds the app) and GameChanger (where someone must score every
pitch).

**The club administrator** (buys for twenty teams; measures phone calls not features). Enticement:
one platform runs registration → rosters → schedules → money, and now the families those twenty
teams serve get a clean, ad-free, Canadian-privacy-native experience the org never has to
apologize for — with transparent flat pricing a treasurer can put in a budget line, against
TeamSnap ONE's "contact sales" and TeamLinkt's ads-on-your-families. The family layer converts
the org's biggest support surface (parents asking coaches asking admins) into self-serve.

**The parent** (chose nothing; judges the platform by one screen). That screen must answer: where
does my kid need to be next, how did the last game go, how is the season going — with their own
child never behind an ad or a paywall (G4 guarantees chat basics free on any portal; the premium
gate sits on the *coach's* tooling, never between a parent and their child's information — this is
the exact inversion of GameChanger's model and should someday be said that plainly in marketing).

**The conflicts, named rather than smoothed over:**
- *Parent wants stats; we don't capture them.* Answer honestly with the growth recap — and note
  the trade openly in positioning: families who primarily want box scores will keep GameChanger
  alongside us; families who want "what did my kid work on" cannot get it anywhere else.
- *A parent chat is work for the coach.* It is — moderation, expectations, liability. Which is why
  chat ships last, behind the identity layer, broadcast-first, with the safeguarding preconditions
  met, and per G4 its basics cost the coach nothing so the network effect isn't starved.
- *The strongest pay-driver misses the commercial moment.* Ranked honestly for the January 2027
  conversion: practice visibility converts best (weekly, visible, already premium-gated), the
  recap second (season-timing dependent), the recap draft and game card are supporting cast — and
  family chat, the single most plausible daily-habit driver of $29/mo willingness, is deliberately
  sequenced after January for safety reasons. The January story must therefore be sold on practice
  visibility + recap + momentum, not on chat; if the owner wants chat closer to the conversion,
  the lever is starting the counsel review and moderation upgrade now (flagged as decision #7b).
- *Retention ruling vs "entice to choose us."* The owner asked both for a retention play and for
  what would entice a choice. The resolution: nothing in this chunk reaches strangers — the
  enticement operates at the moment a coach or club is already evaluating us, as the story our
  existing customers embody. Marketing copy must keep that discipline when this ships.
- *The org wants families reached; the family controls consent.* The consent ledger (P3) makes
  that tension mechanical instead of legal: the coach sees reach, the guardian holds the switch.

---

## 8 · Constraints that bind the build (so the plan inherits them explicitly)

1. Retention play, not acquisition (owner 2026-08-01). No growth-hack surfaces at strangers.
2. No public sharing of anything naming a child — deferred, not cancelled. The share-card rail
   (family-initiated, first-name+jersey, no public URL) is the approved boundary case. **Two
   readings of ruling 2 are put to the owner rather than assumed:** the keepsake card (a file
   saved to the family's own phone) and the printed certificate (paper, full name, handed over by
   the coach) both technically "leave the authenticated product" — this document reads the ruling
   as targeting *digital/public exposure the platform hosts*, and flags that reading in decisions
   #5 and #6.
3. No pitch-by-pitch / live scoring capture. Finding per ruling 3's escape hatch: **no thin slice
   of in-game capture is needed** for any kept item — the honest game card runs on the team-level
   scores coaches already enter.
4. G3 safeguards bind the chat phase: family-visible channels only, no unsupervised 1:1
   adult–minor DMs, staff delete-with-visible-notice, PIPEDA/CASL review + consent capture
   before build. Chat additionally needs a ban/remove capability that does not exist today.
5. G4 packaging binds: chat basics on ANY portal; practice visibility + richer family features on
   Premium; no new SKU, no per-family fee.
6. The archive is opt-in (owner 2026-08-01, build-enforced). Family surfaces are season-scoped by
   construction (the link is to a season's roster row); the recap is deliberately proposed as
   readable post-season — that is a decision, listed as one.
7. Any new authed top-level route joins the SW cache denylist (the /coaches PII-leak lesson);
   family routes must also honor the anonymous-public invariant (no identity in SSR HTML).
8. Push may not be promised to families until the open Android VAPID runbook passes (G9). Email +
   in-app first.
9. Premium-first: Chunk D builds on the rep (premium) model. Basic coaches join at the chat-basics
   slice per G4 when chat ships; their guardian columns are compatible.
10. Free/premium two-shell ruling: parent surfaces live in the consumer app. No third shell.

---

## 9 · Recommendations at a glance (the decision list the owner receives)

| # | Item | Recommendation |
|---|---|---|
| 1 | Verified-family foundation (G3's link, on-ramps A+B, consent ledger, counsel gate) | **BUILD — it is the chunk.** Nothing player-level ships without it |
| 2 | Season Recap as growth recap (premium, family-visible, **readable post-season — an explicit exemption: family-side historical reads become a new data class outside the coach-archive allow-lists**) | **KEEP — anchor artifact; approve the exemption knowingly** |
| 3 | Rep-team game card + share link (team-level; the honest follow-the-game) | **KEEP — reshaped** |
| 4 | Postgame recap draft into Email families | **KEEP — cheapest, highest-frequency** |
| 5 | Printable certificates (full name on paper — requires the §8.2 reading of ruling 2: paper handed over by the coach ≠ platform-hosted exposure) | **KEEP — bounded delight; approve the reading** |
| 6 | Trading card → keepsake card inside the recap (file saved to the family's phone; first name + jersey only; same §8.2 reading) | **CUT standalone; FOLD into recap** on the shipped share-card rail |
| 7 | Family chat (`coach_parent`) | **DEFER to its own phase** behind identity + moderation upgrade + counsel |
| 8 | No-login family team link (P2) | **BUILD — small; serves the no-account majority** |
| 9 | Tryout-offer page hardening (child's full name → first name + last initial) | **DO — one-line class of fix, closes the one refuted claim** |
| 10 | RSVP | **STAYS DEFERRED (G3); schedule its decision after slices 1–2 ship** |
| 11 | Calendar subscription feed (tokenized ICS, team-level) | **BUILD with the team link — likely the highest day-to-day family value per unit of work** |
| 12 | Org-admin family-adoption rollup (per-team invited/verified counts) | **BUILD — the club buyer needs a number; without it the org pitch is unbacked** |
| 13 | Extend the no-login team link to Basic teams (schedule + announcements; no scores by policy) | **YES at slice 2 — identity-free, keeps free-tier families from seeing nothing until chat ships** |
| 14 | Verification mechanism (§3): coach-sent invite + exact-email claim = verified; unsolicited requests always queue (email match = assist only); registration auto-verify only in league/club contexts | **ADOPT — new decision; consistent with the "never live authz" ruling's intent** |
| 15 | Game-card URL form: plain public URL (noindex, unlinked) vs tokenized | **PLAIN PUBLIC — it shows only what the scoreboard at the field shows; tokenizing adds friction without protecting anything** |

---

## 10 · Owner rulings — 2026-08-01 (BINDING; supersede §9's recommendations where they differ)

The owner reviewed the decision list + mockups v1 and ruled ("everything else looks good" = all
other recommendations accepted as-is):

1. **#13 REVERSED — the family experience is PREMIUM PORTALS ONLY.** No Basic-team extension of
   the team link, the family schedule, or any family surface in this chunk. (Note for the chat
   slice, recorded not re-litigated: G4's "family chat basics with ANY portal" still stands in the
   Business Decisions Log — when chat ships, reconcile it against this ruling with the owner.)
2. **The family schedule is ONE scrollable list, no sections** — chronological, initial position
   anchored at the next upcoming game; completed games show scores, upcoming games don't. Since
   the whole surface is now premium-only, practices simply appear in the list (no per-row premium
   badge).
3. **#14 AMENDED — parent-initiated, coach-approved (the GameChanger model) is the primary
   on-ramp.** The coach shares one revocable **team family link** (to the team's existing group
   chat / email list); a parent opens it, names their player + relationship, consents, creates an
   account, and the request lands in the coach's approval queue (email-match shown as an assist:
   "matches Maya's guardian contact"). Coach-sent per-player invites remain as a secondary path;
   league/club registration auto-verify stands as G3 granted it. **G3's safeguard holds: there is
   still no public search for a team or child — the link is handed out by the team, never
   discoverable.**
4. **NEW #16 (supersedes #15): a per-team Schedule visibility setting**, coach-controlled —
   **Staff only / Families / Public link.** Families = verified family accounts see the full
   schedule (games + practices). Public link = additionally, the standing no-login team link
   exists. Sharing an individual game page is always an explicit per-game coach act (available at
   Families or Public — each share is its own opt-in; a standing public schedule with weekly
   practice locations only exists when the coach chooses Public). **Recommended default:
   Families** — privacy-first, and the grandparent story still works because the coach shares
   game links deliberately.
5. **NEW #17 — TWO TIERS of family connection (owner, 2026-08-01, second pass):** the
   player-linked identity splits from team-level following.
   - **Guardian (the relationship owner):** tied to a specific player; the accountable adult for
     money reminders, registration-related matters, and the player-specific payloads (season
     recap, keepsake, announcements archive, chat later). Kept deliberately scarce — one per
     player, with room for a second household (recommended cap: 2).
   - **Family member follower:** approved by the coach but **not tied to any player** — they get
     the schedule, results, game pages, calendar subscription, and game-update notifications.
     Many allowed per team (coach approves and can remove anyone; a generous safety ceiling, not
     a product cap). Structurally this is a coach-approved team follow riding the existing
     follows machinery — it carries **no child data at all**, which means the follower tier has a
     much lighter privacy surface than the guardian tier and can ship ahead of it.
   - One flow serves both: the team family link's request form asks "are you this player's
     parent/guardian, or a family member following the team?" — the guardian path collects the
     player name + consents; the follower path skips the player questions entirely. Both land in
     the same coach queue; the coach can change someone's tier later. G3's ~5-accounts-per-player
     cap is superseded by this structure (guardians ≤2 per player; followers are team-scoped).

---

*Provenance: 15-agent discovery workflow + two independent adversarial verification passes + a
two-critic review (faithfulness + commercial skeptic) whose confirmed findings were folded back in.
Ground-truth rows in §2 were verified against code with file:line evidence during the sweep; the
full evidence and incumbent source-URL record lives in the discovery session's transcript, not in
this repo — where a §2 claim matters to a build decision, re-verify it in code at build time
rather than citing this document as authority. Incumbent figures are reported, per the §6 sourcing
note. Recency: 2026-08-01.*
