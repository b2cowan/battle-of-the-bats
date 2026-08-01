# Chunk D — The family experience: DISCOVERY + STRATEGY brief (paste into a fresh chat)

> **Created 2026-08-01**, at the close of the Chunk F session (committed `8b415b57`). Chunk D is the
> **last** Coaches Portal chunk and the one with commercial upside.
> **This is NOT a build prompt.** The owner has asked for a **deep evaluation** first: assess the
> five features already on the ledger, **propose your own**, study how the incumbents solve the
> parent/guardian problem, and answer *what would actually entice a coach or an organization to
> choose us*. Code comes later, after a plan, a PM brief and approved mockups.

---

## The brief, in the owner's words (2026-08-01)

> *"Do a full evaluation of these features and propose some of their own, take a deep dive. For
> parents/guardians, evaluate the GameChanger / TeamSnap / TeamLinkt models where parents can use
> the app for chat, follow games, see results, etc. — with the exception that we do not intend to
> replace the GameChanger pitch-by-pitch analytics at this time. What options should we consider in
> order to entice coaches/organizations to use our product?"*

### Owner rulings that BOUND this work (decided 2026-08-01 — do not re-litigate, do verify feasibility)

1. **This is a RETENTION play, not an acquisition play.** It exists to make coaches and clubs *keep
   using* FieldLogicHQ, by making the coach's work visible to the families already attached to the
   team. It is **not** a growth-hacking surface aimed at strangers.
2. **No public sharing at this stage.** Nothing that names a child leaves the authenticated product.
   Public sharing is **deferred, not cancelled** — say so in anything you write, so a future session
   doesn't re-propose it as though it were never considered.
3. **We are NOT competing with GameChanger on pitch-by-pitch analytics.** Do not scope live
   play-by-play scoring, spray charts, pitch counts by batter, or an in-game scorer app. If your
   evaluation concludes some *thin* slice of in-game capture is unavoidable to make the rest work,
   say so explicitly as a finding with its cost — don't smuggle it in.
4. **The open question the owner asked you to answer:** what would make a coach or an org *choose*
   us. Treat that as the actual deliverable, not a footnote under a feature list.

---

## Ground truth — VERIFIED 2026-08-01. Re-verify anyway.

The Chunk F session was handed three confidently-stated facts that were **false**, and two of them
were load-bearing. Assume the same here. Everything below was checked against the code on
2026-08-01; check it again before you build a plan on it.

### ⚠ THE FINDING THAT RESHAPES THE CHUNK: there is no such thing as a parent account

| Claim | Verified state |
|---|---|
| **A guardian is an identity in this product** | ❌ **FALSE, and this is the crux.** `OrgRole` is `owner \| admin \| staff \| official \| league_admin \| league_registrar \| treasurer \| coach`. **There is no parent/guardian role.** A guardian is *roster data* — a name, an email and a phone on a player row — not an account, not a login, not a person the system can authenticate. |
| A fan account exists | ✅ TRUE. The consumer app (`app/(consumer)`: home · scores · following · chat · discover · account · start · auth) ships fan accounts, team follows and score alerts. **But a fan is linked to a TEAM, never to a PLAYER.** |
| So the gap is… | **Nothing connects "this signed-in adult" to "that child on the roster."** Every TeamSnap/GameChanger-style parent feature — my kid's schedule, my kid's stats, RSVP for my kid, pay my kid's fees, a team chat that is actually the parents — depends on that link. It does not exist. |

**Consequence: the first question of this chunk is not "which features" — it is "does FieldLogicHQ
need a guardian identity, and what does that cost?"** That is a platform decision with privacy,
consent and support consequences, not a presentation task. Answer it first; the feature list falls
out of the answer. ⚠ `memory/MEMORY.md` flags that the family layer needs **PIPEDA/CASL** work —
find that constraint and read it before proposing anything that emails or identifies a minor.

### The rest of the ground truth

| Claim | Verified state |
|---|---|
| **"The ingredients already exist server-side, so this is presentation work"** (the readiness review's judgement on Chunk D) | ⚠️ **HALF TRUE — the dangerous half.** True for TEAM-level items. **False for anything player-level:** no public surface anywhere carries a player's name today. The public site is entirely team-level (schedule · standings · results · teams · playoffs · champions). A player card or per-player recap would be the **first** time a named child's data left the authenticated product. **Verify what per-player season stats we actually compute** before promising a recap — attendance and awards exist; game-by-game player performance largely does not, because we don't capture it (see ruling 3). |
| A no-login private link pattern exists | ✅ TRUE and **reuse it**: tryout **offer** links to families and **evaluator** links both work this way — unguessable, revocable, no account. This is very likely the delivery rail for reaching a parent who has no login, and it stays inside ruling 2. |
| Chat exists | ✅ Coach staff rooms + a tournament surface. **Parents are not in any chat today.** Whether they should be is a core question of this brief — it is also the single biggest support-and-moderation liability in it. |
| The five ledger items | Wow #4 no-login "follow this game" · #5 player trading card · #6 per-player season recap · #3 postgame recap draft · #8 printable certificates. See `PROGRAM_COACH_PORTAL.md` §1.1 chunk D. |

---

## What the owner wants evaluated

### 1. The five on the ledger — judge them, don't just cost them
For each: what problem does it actually solve, for whom, how often, and what does it depend on that
we don't have? **Recommend keep / cut / reshape.** A confident "cut this, here's why" is worth more
than five features delivered thinly. Note especially: the **follow-a-game link** is the one item the
owner leaned toward keeping *despite* it reading as acquisition, because a grandparent watching from
another province is a retention story, not a growth story — it is team-level, so it exposes nothing
new. Test that reasoning; don't inherit it.

### 2. Propose your own
The five came from a readiness review, not from a study of what families need. You are expected to
add to them — and to say which of your own proposals beats the incumbents' equivalents.

### 3. The incumbent study — GameChanger, TeamSnap, TeamLinkt
Not a feature checklist. Work out **what each one is actually for**, who pays, who the daily user is,
and where each *fails* the Canadian community club we serve. Specifically:
- **GameChanger** — the parent-facing draw is live game following and stats. We are explicitly not
  matching the pitch-by-pitch depth (ruling 3). **So what is the honest version of "follow the
  game" for a team that isn't capturing every pitch?** That question is the heart of this chunk.
- **TeamSnap** — availability, RSVPs, payments, team chat. Closest to what a *club* already asks us
  for. Where does it leave a treasurer or a registrar unserved?
- **TeamLinkt** — the free/ad-supported Canadian competitor, and therefore the most direct threat to
  our pricing story. **Read `docs/agents/strategy/PLAN_PRICING_FACTS.md` (canonical) before saying
  anything about price.**
- The comparison that matters: a coach or club today is often running **several** of these plus a
  spreadsheet. Our claim is one place. Test whether the family layer strengthens that claim or
  merely adds a sixth app to somebody's phone.

### 4. The actual deliverable — what entices a coach or an org to choose us
Answer it in the language of the person deciding:
- **The volunteer coach**, who did not ask for software and measures everything in evenings lost.
- **The club administrator**, who is buying for twenty teams and cares about registration, money and
  not fielding phone calls.
- **The parent**, who did not choose us at all and will judge the whole platform by one screen.
Where do the three conflict? A parent-facing app is *work* for the coach — who does that work, and
what do they get for it? If the answer is "nothing", the feature will not survive contact with a
real season, however good the mockup looks.

---

## Process — non-negotiable, owner-mandated

1. **Discovery + evaluation first.** Produce the assessment above as a written deliverable before any
   plan. Walk the product as a coach, and as a parent who has no account and only an email address.
2. **Implementation plan + PM brief** → `docs/projects/active/COACH_PORTAL_CHUNK_D_*`.
3. **Mockups as an artifact** — label every region NEW / RESTYLED / UNCHANGED; approved mockups are
   the binding visual spec.
4. 🛑 **STOP. A BLOCKING WAIT on the owner.** Post the link and the decision list (each with your
   recommendation), then **end your turn**. You may not proceed on your own approval.
5. Only then build → `/simplify` → `/review` (**high-risk — a family layer touches minors' data**)
   → `/docs` → probes → fresh dev restart → owner QA → commit on `dev` with per-action OK.

**"Execute this prompt" means run the PROCESS, not write code.**

---

## Landmines from the sessions before you

- ⚠ **VERIFY, DON'T TRUST.** Three claims in Chunk F's handoff were false. The two above marked ❌/⚠️
  are the ones most likely to mislead you here.
- ⚠ **"The ingredients already exist" is the specific sentence that has been wrong twice.** When you
  read it, go and look.
- ⚠ **The archive is OPT-IN** (owner ruling 2026-08-01, build-enforced). Anything you add to the
  coaches portal is **not** visible in past seasons unless you explicitly add it to the two
  allow-lists in `tests/unit/coach-season-write-guard.test.ts`. The build fails otherwise, on
  purpose. See `CLAUDE.md` and `memory/design_decisions.md` (2026-08-01).
- ⚠ **A container is only as true as its deepest room.** Chunk F opened eleven doors and made only
  the first room of each honest; money sub-pages resolved the LIVE season with write controls one
  click inside a 2025 view. If you add a family-facing section, the unit of work is every screen
  reachable from it.
- ⚠ **A minor's data is the highest-stakes payload in this product.** Chunk F's review found a
  capability leak and a write that hit the wrong season; both were invisible to passing tests. Probe
  as the *unauthorised* persona, not just the happy one.
- **Probes:** copy `tests/uat/scenarios/coach-frozen-season-smoke.spec.ts` (newest exemplar —
  service-role self-provisioning with a marker prefix, asserted teardown, computed styles never
  screenshots, rules walked from the RENDERED UI, vacuous-pass guards, and — learned the hard way —
  **drive real in-app controls, not just `page.goto()`**, or client-state bugs stay invisible).
- **Git: ONE shared `dev`, busy tree.** Other agents work in this same working copy and leave files
  uncommitted. Stage explicit `:(literal)` pathspecs, audit `git show --stat HEAD` every time, and if
  a shared file (`lib/db.ts`, `lib/types.ts`) contains someone else's in-flight work, commit only
  your own lines — see the Chunk F session for how.
- **Read first:** `PROGRAM_COACH_PORTAL.md` §1.1 (chunk D) · `memory/design_decisions.md` (top three
  entries) · `docs/agents/strategy/PLAN_PRICING_FACTS.md` (canonical pricing) ·
  `memory/marketing_brand_strategy.md` (the four segments) · the PIPEDA/CASL note behind the family
  layer.

---

## Program state at handoff

- **Chunks A · G · H · E · I · C · B are live on prod.** **F is committed on `dev` (`8b415b57`) and
  NOT yet released** — it made every past season readable, read-only, with the archive opt-in rule
  above. `dev` is ~3 commits ahead of `origin/master`.
- **D is the last chunk.** ⚠ Chunk B shipped without owner phone QA; a phone pass on it is
  outstanding.
- **A concurrent session is building practice plans** (uncommitted; migration 213 dev-only; a closing
  task about archived seasons is written into its plan §11.1). Do not touch its files.
- **A pattern worth carrying:** every chunk since A found its most serious defect *after* the owner
  looked at it on a real phone. Budget for that.
