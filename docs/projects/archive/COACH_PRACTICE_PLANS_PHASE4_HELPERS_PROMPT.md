# Practice Plans — Phase 4 "Helpers" (the CLOSING phase) — paste into a FRESH chat

> **Created 2026-08-03**, at the close of the Phase 3 session.
> **Phases 1a, 1b, 2 and 3 are all BUILT. Phase 3 is COMMITTED (`28f3f6dc`).** Phase 4 is the last
> phase of this project — and the only one that **must not start with code**.
>
> ⚠ **THIS PHASE IS GATED. Two gates, neither of which is a screen.** Read §1 before anything else.
> If you open this prompt and start building, you have already broken it.

---

## 1 · ⚠ THE TWO GATES — clear these BEFORE any build, in this order

D30 says Phase 4 is *"built as the CLOSING PHASE of this project, gated on (a) a privacy sign-off
and (b) a reconcile against the 2026-07-11 verified-family/practice-visibility decision."*
The plan doc adds, in as many words: **"in scope, but not shipping on momentum."**

### Gate 1 — the privacy sign-off (route via `/strategy`)

**A non-coach adult reading minors' first names is a NEW CATEGORY OF ACCESS.** Today every human
who can see a practice plan is a coach on that team's staff. A helper is not. That is a decision
about children's data, not a permission toggle, and it is the owner's to make.

The precedent to argue from is Player Development's D2 — existing tryout consent was accepted as
covering coach-authored records, and that acceptance is logged in `BUSINESS_DECISIONS.md`. Phase 4
needs the equivalent finding for a **non-coach volunteer**, and it may well come back narrower
(e.g. "first names and a jersey number only, never a focus area, never a full name").

⚠ **Do not assume the answer.** Present the question, the precedent, the narrowest workable scope,
and let the owner rule. Log the ruling via `/strategy` before writing a line.

### Gate 2 — the reconcile: **a parent must not have TWO doors into a team's practice**

This is the subtler gate and the one most likely to be fumbled, because **the ground moved after
this phase was planned**. When D29/D30 were written (2026-07-31), the family layer did not exist.
It does now. A parent can already reach a team, and Phase 4 is about to add a second way.

What shipped in between (all on `dev`, none on prod):

| Route in | What it is | State |
|---|---|---|
| **Family follower** | team-level, no child link — schedule, results, game pages, calendar | **BUILT** (Chunk D) |
| **Guardian** | player-linked, max 2 per player, the accountable adult | **BUILT but SWITCHED OFF** — `GUARDIAN_TIER_ENABLED` is false pending PIPEDA/CASL counsel |
| **Helper** (this phase) | a non-coach adult who runs a station | **NOT BUILT** |

Plus: **schedule visibility is now a per-team coach setting** — `staff` / `families` (default) /
`public_link` — and the whole family layer is **PREMIUM-ONLY and two-tiered** (`BUSINESS_DECISIONS.md`
2026-08-01).

**The questions the reconcile must answer, out loud, before the build:**

1. A parent who is **already a family follower** on this team is asked to help at Tuesday's
   practice. Do they become a Helper as well? Are they now two things at once? What does the coach
   see in their staff list?
2. Does a Helper see the practice PLAN (blocks, stations, children's names) while a family follower
   sees only the schedule ENTRY? That is the whole distinction — state it explicitly and make the
   product show it.
3. ⚠ Does adding a Helper **change what the family layer shows**? It must not. A helper grant is a
   staff act; it must not silently widen a family's view or vice versa.
4. When the **guardian tier is switched on** (whenever counsel clears), does a parent who is BOTH a
   guardian and a Helper end up with a coherent single account, or two overlapping doors?
5. Is Helper **Premium-only**, like the family layer? (Almost certainly yes — it hangs off the
   premium staff machinery — but say so rather than inheriting it by accident.)

⚠ **If the reconcile produces a conflict, route it; do not resolve it in the build.** The
"two doors" failure is the one this gate exists to catch.

---

## 2 · ⚠ THE ONE RULE THAT IS NOT NEGOTIABLE

**NEVER a shareable link. Not now, not "just for helpers", not "with a hard-to-guess URL".**

The owner's original ask was *"like how we share google docs with each other."* **The Google-Docs
mechanism specifically is the one thing this project cannot copy**, and the plan doc says why in a
sentence worth quoting verbatim to anyone who reopens it:

> An unauthenticated share link to a practice plan is a **public page naming ten children alongside
> a date, a start time and a street address.** Forwarded once, it is public permanently.

A practice plan is **the most sensitive document in the coaching product** — more so than the
development records — because it combines minors' names with a location and a time.

**The answer is an INVITATION and a SIGN-IN** (D29). **The printed sheet remains the no-account
option** for a helper who won't accept an invitation — that door already exists and already works,
and it is a perfectly good answer for the grandparent running the tee station.

⚠ If the owner pushes back on the friction of sign-in, **route it back to them with the risk stated
plainly** — do not soften the mechanism to close the gap.

---

## 3 · What Phase 4 actually builds (small screens, big decisions)

Per §8.1 and D30 — **the permission machinery already exists; do not build a new one.**

- **A "Helper" preset on the staff invite path.** A named bundle of the per-assistant capability
  grants that already ship: **schedule visibility ON, everything else OFF, all writes OFF.**
  ⚠ **NOT a third `coach_role`.** Not a new permission model. `CoachStaffPanel` already renders
  grouped capability controls with sensitive-grant confirms — this adds a friendly preset beside
  "Assistant coach", nothing more.
- **The helper's one-screen portal:** the practice, their station, the group in front of them.
  This is close to the run screen's **"My station"** view (D28), which slice 1b already shipped —
  reuse it rather than building a second one.
- **Focus areas stay `notes`-gated**, so a parent volunteer never reads coaching notes about other
  people's children. That gate already exists and already works; do not widen it.

**Storage: NONE expected.** The ladder in §9.2 lists Phase 4's storage as "None". If you find
yourself writing a migration, stop and re-read §8.1 — it probably means the preset has drifted into
being a role.

---

## 4 · ⚠ The trap this phase is uniquely exposed to

**A "preset" that quietly becomes a role.** The moment Helper needs its own column, its own
`coach_role`, its own branch in a capability predicate, or its own row in a nav switch, it has
stopped being a preset and become a permission model — and every surface that asks "is this person
a coach?" now has a third answer it doesn't know about. The whole reason D30 chose a preset is that
the answer to "what can this person see?" stays in ONE place.

**The tell:** if `resolveCoachCapabilities` or `isCoachNavItemVisible` needs to learn a new word,
you are off the rails.

---

## 5 · Traps from 1a/1b/2/3 — do not rediscover them

- **⚠ THE WORKING COPY IS SHARED WITH OTHER CHATS.** Five sessions committed *during* the Phase 3
  session, and one of them swept up an edit from that session's own files. Re-check
  `git rev-parse --abbrev-ref HEAD` before committing, stage **explicit `:(literal)` pathspecs**
  (bracketed route dirs are glob-hostile), and run `git show --stat HEAD` afterwards. **Diff a
  shared file before staging it** — `lib/db.ts`, `lib/types.ts` and `lib/help-content/coaches.tsx`
  routinely carry two sessions' work at once. If they do, **ask the owner** rather than deciding
  unilaterally whose work ships.
- **Capability parity is the bug class that has bitten SIX chunks running.** Probe as the
  **read-only assistant**, and check what the server *SENDS*, not what the client renders — Phase 3's
  `/review` found the practice-plan GET shipping every child's name to a coach with roster access
  OFF, because the redaction helper strips PII *fields* and never consults `caps.roster`. For a
  HELPER this matters more than it ever has.
- **A door a persona can SEE but not USE is a bug** wearing a politer face.
- **Sub-components go at MODULE level, never in a render body** — a form loses focus every
  keystroke otherwise. **Six times now.**
- **A CSS-module import path is invisible to TypeScript.** Copy the depth from a verified sibling
  and *check it resolves*; only a Playwright probe catches a wrong one.
- **⚠ Do not use `perl -0pi -e` for multi-line edits** — it has mangled em-dashes and matched the
  wrong occurrence in this repo. Use the Edit tool, or a small `node -e` script that asserts the
  match before writing.
- **⚠ Check `error` on every supabase-js select** before believing an empty result.
- **Prevent invalid states; don't report them.** A control that exists only to refuse should not
  exist — it must be ABSENT, not disabled.
- **`<system-reminder>` file snapshots go stale.** Verify from a fresh read or `git show`.

---

## 6 · Ground truth to verify FIRST (don't trust this doc)

- `docs/projects/active/COACH_PRACTICE_PLANS_PLAN.md` — **§8.1** (helpers, the two gates), **D29 +
  D30** in the decisions table, **§9.2** (the ladder), and **§10.9** (Phase 3's build record and the
  five build-time decisions).
- `docs/agents/strategy/BUSINESS_DECISIONS.md` — the **2026-07-11 G3/G4** entries (verified family,
  practice visibility) and the **2026-08-01** family-layer entry that partly supersedes them. ⚠ Read
  the supersession notes; G4's chat clause is moot, its practice-visibility half stands.
- `memory/design_decisions.md` — the three **2026-08-02** entries (template-vs-drill, the coverage
  rules, the recap guardrail). The no-ranking and planned-vs-done rules bind Phase 4 too.
- `lib/coach-capabilities.ts` — the predicates. `lib/family-guardian.ts` — the tier switch.
- `docs/projects/active/OWNER_QA_LEDGER.md` **§1.9** — Phase 3's QA steps, **possibly still
  unticked**. ⚠ If the owner has not yet QA'd Phase 3, say so and ask whether to proceed regardless.

---

## 7 · Process (non-negotiable)

**Gate 1 + Gate 2 CLEARED and logged** → **PM UX summary + confirm scope** → **mockups via
`/design`** (owner-mandated, non-negotiable; round 5 drew the helper-access *decision*, not the
helper's portal — judge whether new frames are needed and route it) → build the whole approved
scope in one pass → `/simplify` → `/review` (high-risk tier; add: **capability parity probed as the
HELPER and as the read-only assistant**, the **no-shareable-link audit**, and **what the server
sends to a helper**) → `/docs` → **Playwright computed-style probes at 361 / 390 / desktop** →
clean dev restart → **owner QA** → add a section to `OWNER_QA_LEDGER.md` → commit on `dev` with
**explicit per-action OK**.

✅ **The UAT probe harness WORKS.** `node scripts/seed-uat-coach-fixture.mjs` is idempotent and
prints `PROBE_EVENT_ID`.
⚠ A coach-portal spec **must** declare `test.use({ storageState: …/.auth/coach.json })` or it
silently authenticates as the org owner, who coaches nothing.
⚠ **Run a new spec by FILE PATH, not `-g`** — unrelated specs fail at collection with
`Cannot find module 'server-only'` and will drown your run.
⚠ **Do not add a shared primitive to a tap-floor probe.** `.ppSuggestChip` ships at ~21px and four
committed surfaces depend on it; Phase 3 recorded that decision after making the mistake.

---

## 8 · ⚠ Release context — this phase closes the project, and a big release is waiting on it

Production is on the **2026-07-29** commit. Sitting unpromoted on `dev`: the family experience, the
frozen past season, the drill library, **all four Practice Plans phases**, the desktop work, tryout
insights — and **six dev-only migrations (211, 213, 218–223)**.

⚠ **Two of those change FUNCTIONS or POLICIES only, and `check:migrations` is a KNOWN FALSE GREEN
for both** — migration **211** (function-only) and migration **222** (policy-only). Their presence
on prod must be verified from `pg_proc` / `pg_policies` directly, never trusted to the drift gate.

The owner's stated sequence: **finish Phase 4, then release.** So this phase is the last thing
between a large, aging batch and production — which is an argument for finishing it *carefully*,
not quickly. **Do not let release pressure collapse Gate 1.**

---

## 9 · Definition of done

Both gates cleared and **logged in `BUSINESS_DECISIONS.md`** · the Helper preset + the one-screen
portal built to approved mockups · `/simplify` + `/review` + `/docs` · typecheck / `npm test` /
focused lint green · `verify:changed` green with **all colour baselines still ZERO** · probes
passing · clean dev restart · owner QA passed · committed on `dev` · `memory/design_decisions.md`
entry · the plan doc's status header + §9.2 + §8.1 updated · a QA-ledger section added ·
**`ACTIVE_PROJECTS_INDEX.md` updated and the project moved toward archive** — Phase 4 closes
Practice Plans.

## 10 · Explicitly NOT in Phase 4

A shareable link of any kind (**cut forever**) · a third `coach_role` · a new permission model ·
drill videos / hosted drill content / seeded sport-specific drills (permanent cut list, §11) ·
photos or diagrams of a practice (**images of a practice contain children**) · per-block ✓ran ticks ·
per-child commentary in the recap (D17's hard guardrail) · auto-generated plans · any "these N kids
need the most work" surface (**cut forever**) · a seventh Insights tile · club-wide plan templates ·
family-visible practice plans (that is the family layer's question, not this one).
