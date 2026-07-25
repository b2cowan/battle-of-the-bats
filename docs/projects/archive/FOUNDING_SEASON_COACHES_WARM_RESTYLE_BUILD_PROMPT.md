# Build Prompt — Coaches Portal sign-up journey: WARM restyle + app-chrome continuity (S1-2)

**For a NEW chat.** This is the ratified-but-unbuilt visual layer that rides on top of the
already-shipped Founding Season Coaches launch. The *functional* $0 launch is committed
(`dev` @ `26380896`); this build makes the sign-up journey **look** like a first-class part of
the warm mobile app, per the owner's "both — warm look + continuity" decision.

---

## ⚠ SEQUENCING — do not start until this is true

**Start only AFTER the Unified Home Phase 6 "follows" project has committed and its uncommitted
files have left the tree.** That project is (as of 2026-07-20) being built in a parallel session
and edits the **same shared consumer-shell + warm-token surfaces** this restyle must touch
(`components/consumer/ConsumerShell.module.css`, `ConsumerNav.tsx`, `warmTheme.module.css`,
`HomePersonalization*`, `ScoresClient*`, `FollowingList*`). Running both at once **will collide**
on the shell and the warm tokens — exactly what the one-shared-`dev`-branch rule forbids.

On kickoff: `git rev-parse --abbrev-ref HEAD` (must be `dev`), `git log --oneline -8`, and
`git status --short`. If follows files are still uncommitted/modified, **stop and tell the owner**
— do not proceed in parallel. Stage **explicit pathspecs only**; never `git add -A`.

---

## READ FIRST (in order)

1. `memory/design_decisions.md` — the **S1-2** entry (2026-07-20) is the binding decision for this
   build. Also read **S1-1** (the /start warm restyle it pulls forward), **R1-4** (warm token
   system; consumer-shell scope), and **R1-2** (the deliberate warm→branded theme handoff).
2. The **ratified mockups** (binding visual spec, rev 2 warm):
   `https://claude.ai/code/artifact/b3444f13-71a2-47c2-abac-9f0037e7f4fc` — fetch with WebFetch to
   re-read. Every element the build produces should be labelled NEW / RESTYLED / UNCHANGED against it.
3. `memory/project_founding_season_coaches_free.md` — current state; the "⚠ STILL OPEN" block lists
   this restyle + the other coordination items.
4. `docs/projects/active/FOUNDING_SEASON_COACHES_FREE_PLAN.md` — the Phase 3 plan + build logs.
5. The warm token system: `components/consumer/warmTheme.module.css` (the additive `--home-*` props;
   the `.warmVars` token-only vs `.warm` ground split from Phase 5). **Never redefine a global dark
   token — only `--home-*`.**

---

## What this build delivers (owner-ratified S1-2)

**The seam is drawn around the in-app acquisition JOURNEY, not the coaches shell.**

| Surface | Treatment |
|---|---|
| `/start` "Coach a team" card + the `/start` family (chooser, tournament heads-up, team/league/club sub-pages) | **Fully warm** — pulls S1-1 forward: `start.module.css` warm rewrite (paper ground, white 14px cards, ink/olive, mono kickers, olive-tint Free pills). Structure/copy/routes unchanged. |
| `/coaches/start` signup (`app/team/TeamSignupClient.tsx` + `app/team/page.module.css`) | **Fully warm** — the signup IS the "$0 confirm" moment; warm inputs (paper field, ink text, olive focus ring), ink-on-lime primary CTA, olive-tint promo pill, mono `$0`/price. |
| Premium **success** state (post-provision landing) | **Fully warm**, then hands off into the operating portal. |
| In-portal upgrade prompts (Explore tab / per-page nudges / plan-detail panel) | **Bounded warm INSERT** — the upsell *card* goes warm; the operating portal around it keeps its own theme. |
| `/for-coaches` | **NOT warmed** — stays the marketing dark theme (copy/CTA flip already shipped). Warming one `/for-*` page would seam the marketing set. |
| Operating coaches portal (roster / schedule / fees / dues) | **UNCHANGED** — deliberately not warmed (avoids the half-warm interactive-chrome trap that deferred `/account/notifications`). |

**App-chrome continuity:** the warm journey wears the **consumer shell's warm chrome** (bottom tab
bar Home/Scores/Chat/Account on mobile, warm top strip on desktop) instead of the coaches portal's
chrome — a coach entering from the app never loses the back-to-app anchor. Nav shape never varies by
auth state (R1). The success screen's "Open your season workspace →" is the **deliberate handoff**
into the operating portal's own theme (same "walking into the venue" seam as entering a tournament).

**Token guidance (no new primitives):** paper `#F8F4ED` ground, ink `#241E15`, dim `#8A8177`, olive
`#57651E` accents, **ink-on-lime** pillOn for the primary CTA, olive-tint promo/Free pills, mono data
face for kickers + price + the `$0` figure (raw `--logic-lime` never renders as text on warm — E3/R1-4
rule), live `#D9482B`, amber `#A16207`, 14px card radius.

**Seam-avoidance (the `/account/notifications` lesson):** no paper-tint-over-dark. Every warm surface
warms ground + cards + form inputs + status banners + CTA together, or not at all.

---

## GATE before building — one design-verify (flagged in S1-2)

Confirm the **operating coaches portal's current theme tokens** (is it a light/clean shell or does it
share another theme?). This fixes exactly where the warm-INSERT boundary sits and how the success →
portal handoff lands. Cheap to check; do it first so the insert doesn't read as a half-warm seam.

The **mockups are already ratified (rev 2)** — no new mockup round is required unless the design-verify
forces a boundary change. If it does, refresh the artifact and get owner ratification before code
(build-to-approved-mockups rule).

---

## Discipline

- **No new PM brief needed** (design is ratified via the mockups) — but present a short plain-language
  UX summary before coding (what a coach sees change), per AGENCY_RULES.
- **Build the full ratified scope in one pass** + obvious UX polish (the owner's build-first-pass rule).
- Per-phase: `npm run verify:changed`; `npm run typecheck` when touching shared modules
  (`warmTheme.module.css`, `ConsumerNav`, `ConsumerShell`); the **public-token ratchet** matters here —
  no new literal hex in public `*.module.css` (use `--home-*`).
- `/design` fidelity check against the mockups; `/review` (standard tier — this is CSS/layout, not
  billing) on the cross-shell chrome (the highest-risk piece: mounting the app nav across shells).
- **Dev-server restart rule:** the `/start` sub-pages are file moves/new surfaces and the chrome change
  touches shared shell modules → stop → `rm -rf .next` → `npm run dev` → verify 200 + clean log before
  handoff. (Coordinate with any parallel session's server.)
- **No commit/push without the owner's per-action OK.** Explicit pathspecs only; `git show --stat HEAD`
  after committing to confirm no foreign files landed.

---

## Not in this build (tracked elsewhere)

- One-per-owner comp safeguard (migration) — owner decision pending.
- Email DB re-seed to match the flipped campaign copy (likely a migration) — flag before writing.
- `/docs` coach-help sync + `/marketing` final copy polish on `/for-coaches` + emails.
- Prod gate reopen (`scripts/set-team-plan-gating.mjs --prod --set live`) — owner launch step.
- Phase 4 January manual runbook doc.
