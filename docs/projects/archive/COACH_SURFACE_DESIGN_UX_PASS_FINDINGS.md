# Combined Coach-Surface Design/UX Pass — Findings & Specs

> **Status:** SPECS COMPLETE 2026-06-14 — eval/spec pass, **not built.** Awaiting owner approval + the open-decision rulings (§7). Plan: [COACH_SURFACE_DESIGN_UX_PASS_PLAN.md](COACH_SURFACE_DESIGN_UX_PASS_PLAN.md) · PM brief: [COACH_SURFACE_DESIGN_UX_PASS_PM_BRIEF.md](COACH_SURFACE_DESIGN_UX_PASS_PM_BRIEF.md).
> **Method:** holistic `/design` + `/ux` review of the assembled coach surface (standalone Basic floor + tournament-coach experience on the shared `TeamHQ` shell + the seam) run as a 13-agent workflow — 6 grounded theme/seam reviewers → 6 adversarial design-coherence critics (de-dup compliance · grounded-in-committed-code · design-system fidelity) → 1 cross-theme synthesis. Every spec is grounded in the **committed surface** (branch `feat/free-tier-coaches`) with `file:line` citations; every critic correction is folded in.
> **Companion deliverable:** the reusable design-system rules live in [docs/agents/design/COACH_SURFACE_DESIGN_ADDENDUM.md](../../agents/design/COACH_SURFACE_DESIGN_ADDENDUM.md) (the living reference the `/design` agent loads). **This doc** = the per-state findings + comps + route-back + residual. **That doc** = the locked rules.
> **Finding source:** `journeys/JOURNEY_J2_REP_HEAD_COACH.md` + `journeys/JOURNEY_J5_TOURNAMENT_COACH.md` (cited by ID throughout). The visual answer to those findings — not a re-list of them.

---

## ⚠️ This is a SPEC pass — read the de-dup boundary first

The journey audit already routed every coach finding. **This pass produces the visual/interaction SPEC; the owning plan keeps the IMPLEMENTATION.** Where a finding is shared (e.g. J5-032 "four phases, one template" — Phase-5 builds the hero, this pass specs *what each phase looks like*), the spec stops at the visual boundary and references the owner. **Verified clean by the adversarial critics: all six themes are de-dup-clean — no functional/security/email/IA/lifecycle finding was re-owned.**

**Out of scope (owned elsewhere — referenced, never re-homed):** security/correctness → **FP-1** (J5-026, J5-035, J5-012, J2-035); the UTC date-bug family + functional build → **Phase-5 slices** (J5-018/025/030/031/039/040/042/043, J5-027, J5-050/051/054/058/059); email voice → **5e** (J5-056/057/060/062/063/064, J2-026); marketing flip → **free-tier-strategy** Phase 8/9 (J2-001/002/003/024); org-context IA → **FP-7** (J5-019, J2-012); lifecycle notifications → **Phase-5** (J2-025, J5-058). Specs in those areas design *on top of assumed-corrected behavior* — the fix itself is the owner's.

---

## 0. Two facts the critics nailed down (use these — they recur)

These were verified against `app/globals.css` during the pass (two reviewers initially got the first one backwards; the critics corrected it — it's now definitive):

1. **`var(--text-secondary)` and `var(--text-tertiary)` are REAL shipped globals**, defined at `globals.css:58-59` (dark) and `:166-167` (light) as aliases for `var(--white-60)` and `var(--white-40)`. They are **NOT ghost tokens** and resolve correctly everywhere the coach surface uses them (e.g. the afterglow card inline styles at `app/coaches/tournaments/[teamId]/page.tsx:407,419,481,492`). No visual defect exists. The design-system *preference* is to use the `--white-N` scale directly in new coach code; migrating the existing inline uses is an optional hygiene pass, **not a fix** (listed in §6 as residual).
2. **`--text-2` / `--text-3` / `--text-muted` / `--surface-3` are banned ghost tokens** (absent from `globals.css`). A scan of the coach surface (`app/coaches/**`, `components/coaches/**`) found **zero actual usages** — only "we avoided ghost tokens" comments. The Phase 1–5 remediation held; ghost-token cleanup is *not* on the residual list.

A third recurring fact, folded into the specs below: **`--team-color` is a single colour value set inline, NOT an rgb triplet.** There is no `--team-color-rgb`. Any tint of the team hue must use `color-mix(in srgb, var(--team-color, var(--logic-lime)) N%, transparent)` — never `rgba(var(--team-color-rgb), …)` (Theme 5 originally invented that token; corrected here).

---

## 1. The assembled diagnosis (what "one whole" revealed)

Reviewed as one product, the coach surface is two modes on a shared shell — the **org-less Basic floor** (`/coaches/team/[basicTeamId]` + the Roster/Schedule/Fee/Announcement editors + the `StandaloneTeamHQ` strip) and the **tournament-coach experience** (`TournamentTeamHQ` phase hero + `TournamentStatusBlock` + `CoachLiveSchedule` + `TournamentRosterSubmit` + `HeadCoachEditor` + afterglow) — plus the **seam** between them (the hub, the nav, the two "my team" routes). Five design failures cut across both modes:

- **The phase hero doesn't adapt** (`TeamHQ.tsx:164-307`). Six lifecycle phases render from one near-identical `.hero`; the only variation is the headline string and a fixed 9% team wash that never changes. Prep / fee-owed / game-day / complete are indistinguishable at a glance. Game day is the *flattest* state — one `<strong>Event underway</strong>` line — while the public page's broadcast scorebug sits below the fold, so the coach's own HQ is out-gamed by the public site. The champion gets three lines of grey text and a link.
- **The shell's vocabulary is applied inconsistently** — `btn-outline`/`btn-sm`/`btn-primary` mixed against the locked `btn-lime`/`btn-ghost` convention, and the **most journey-critical button (Claim team) is the quietest** (`btn-outline btn-sm`, `app/coaches/page.tsx:93`), while the upsell card is as loud as the coach's own team. There's no chip system: every accepted card wears the same green badge, no LIVE signal anywhere.
- **It's polished for a demo, strained for a real team** — the standalone home is a single 960px centre column of stacked sections (wastes desktop, 2,000–3,000px of scroll at 14 players), the stat-strip numbers and the tournament checklist values render too dim/small to read.
- **The free path gets the flattest team identity** — `--team-color` is available, but the standalone strip has no wash/monogram at all and the tournament hero runs a faint 9% wash vs the public team page's 18% wash + 9rem watermark + record strip. The org-less coach — the persona the free tier exists to win — gets the least identity on *her own* team's home.
- **Empty/first-run states read as broken pages** — no shared empty-state component; bare `<p>`s, raw cards with inline `var(--text-secondary)`, a ghost-icon void on the premium BvA, an off-accent blue Add button on the premium schedule. Several look like load failures or errors.

---

## 2. Theme 1 — The phase-adaptive hero *(highest-value output)*

**The problem:** `TournamentTeamHQ` (`TeamHQ.tsx:164-307`) is one `.hero` with a headline swap (`:193-204`) and a two-line `.afterglow` appended in the result phase (`:275-288`). The wash is a fixed 9% team gradient (`TeamHQ.module.css:102-107`). **Acceptance test (J5-032):** after this spec is built, the prep / fee-owed / game-day / complete heroes must be unmistakable for one another at a glance.

**The mechanism (one component, six differentiated phases):** the hero stays ONE component. Differentiation comes from four layers — (1) a **phase-keyed left-border accent + phase chip**, (2) a **phase-keyed background wash**, (3) **swapped inner content zones** (fee strip / today card / result card), (4) the **checklist collapses** in the result phase. Each phase has a locked `(accent, wash, chip)` tuple — see the addendum §i for the table; the per-state comps follow.

> **Glance-vs-detail (J5-028, owner-flagged):** the hero **fee strip** is the GLANCE layer (amber/danger, amount + due + contact, at a glance); the `TournamentStatusBlock` **Fee row** is the DETAIL layer (amount, due date, "organizer records payment manually" process note). The owner ruled this dual display *intentional and reads fine* — the spec makes them a coherent glance→detail pair. **The strip must NOT carry the process note** (that lives in the detail block only).

### 2a. Pending / waitlist — `badge-info`, info-7% wash *(J5-029)*

The current pending state is two checklist rows; no entry-fee preview, no waitlist position, no contact. Target — an information-holding state ("we got you, waiting"):

```
┌─────────────────────────────────────────────┐
│ ▌(info-blue left edge)                      │
│  [AB] Registration submitted   [Pending]    │
│       Northfield Cup · SportsOrg            │
│                                             │
│  Jun 14 – Jun 16, 2025                      │
│  ┌──────────────────────────────────────┐   │
│  │ ENTRY FEE PREVIEW                    │   │
│  │ $450 CAD · due if accepted           │   │  ← only when status.fee.hasSchedule
│  └──────────────────────────────────────┘   │
│  ─────────────────────────────────────────  │
│  ✓ Registered        Jun 14, 2025           │
│  ◷ Decision          Awaiting organizer     │
│  Questions? organizer@email.com             │  ← extend heroContact to the pending phase
└─────────────────────────────────────────────┘
```

Left border `border-left: 3px solid var(--info)`; wash `color-mix(in srgb, var(--info) 7%, transparent)`. Entry-fee preview box `rgba(var(--info-rgb),0.07)` bg + `rgba(var(--info-rgb),0.2)` border + `--radius-sm`; label `--font-data` 0.64rem 800 uppercase `--white-40`; amount `--font-data` 0.95rem 800 `--white-80`. Waitlist-position row (new optional `waitlistPosition?: number` prop) renders above the preview: "Waitlist position: **#3**" in `--white-60`/`--font-data`. **ROUTE:** coaches-eval (visual) / phase5:ref(5h) (build). *Data note for the build: `waitlistPosition` has no current column — owner/Phase-5 confirms the source.*

### 2b. Accepted-prep — `badge-success`, team-hue 18% wash, three fee sub-states *(J5-028, J5-034)*

The celebration state, with the money signal surfaced. Three sub-states keyed on `status.fee`:

```
Sub-state B — FEE OWED (not past due)          Sub-state C — FEE PAST DUE
┌─────────────────────────────────────────┐    ┌─────────────────────────────────────────┐
│ ▌(lime)  [AB] You're in!     [Accepted] │    │ ▌(lime)  [AB] You're in!     [Accepted] │
│  ┌────────────────────────────────────┐ │    │  ┌────────────────────────────────────┐ │
│  │ ⚠ Fee owed · $450 · due Jun 30    │ │    │  │ ⊘ Fee past due · $450             │ │
│  │   Contact organizer@email.com      │ │    │  │   Was due Jun 30 · Contact org…    │ │
│  └────────────────────────────────────┘ │    │  └────────────────────────────────────┘ │
│  First game in 14 days                  │    │  First game in 14 days                  │
│  ✓ Registered  ✓ Accepted               │    │  ✓ Registered  ✓ Accepted               │
│  ◯ Fee  Owed   ◯ Roster Not submitted   │    │  ◯ Fee [Past due]  ◯ Roster Not subm.   │
└─────────────────────────────────────────┘    └─────────────────────────────────────────┘
  (Sub-state A — no fee / paid: no strip; checklist Fee row reads "✓ Paid")
```

**Fee glance strip** (`.heroFeeStrip`, between heroHead and heroDates, only when `status.fee.hasSchedule && !status.fee.isPaid`):
- Owed: `rgba(var(--warning-rgb),0.08)` bg + `rgba(var(--warning-rgb),0.3)` border + `--radius-sm`; `TriangleAlert` 15px `--warning`; "Fee owed · [amount] · due [date]" in `--warning`/`--font-data`/700; contact sub-row `--white-60`. No `role="alert"`.
- Past-due: `rgba(var(--danger-rgb),0.08)` bg + `rgba(var(--danger-rgb),0.35)` border; `XCircle` 15px `--danger`; "Fee past due · [amount]" in `--danger`; "Was due [date]" sub-row; **`role="alert"`** (status changed, coach must act).

**Past-due checklist badge (J5-034):** when `status.fee.state === 'past-due'`, the Fee row's `.checkState` renders `<span class="badge badge-danger">Past due</span>` + "Was due [date]" micro-text (`--danger`/`--font-data`/0.72rem). When merely owed, plain "Owed" in `--white-40` mono (current behavior). The `past-due` state is already computed (`registration-attention.ts:186-187`, surfaced via `coach-status-model.ts` `status.fee.state`) — this is the visual branch only. **Binary by design** (Owed vs Past Due — no third state, per the locked fee vocabulary). **ROUTE:** coaches-eval (visual) / phase5:ref(5h) (build).

### 2c. Schedule-live — `badge-success`, team-hue 18% wash, countdown promoted *(J5-032)*

Same lime as accepted-prep; differentiated by a "● Schedule published" signal line (`--success` dot + `--white-70`) and the countdown promoted to 1.05rem/800 (dominant data point). The hero points *downward* to the now-populated `CoachLiveSchedule` section — it does not replicate it. **ROUTE:** coaches-eval (visual) / phase5:ref(5i) (build).

### 2d. Game day — `badge-success "Game Day"`, success-8% wash, the Today spotlight *(J5-041)*

The flattest state today becomes the loudest. Headline changes to **"Game Day"** (the single biggest differentiator); the wash flips to green; a **`.heroTodayCard`** sits in the hero as a summary/shortcut into the schedule below:

```
Between games:                                  Live game in progress:
┌─────────────────────────────────────────┐    ┌─────────────────────────────────────────┐
│ ▌(green) [AB] Game Day       [Game Day] │    │ ▌(green) [AB] Game Day       [Game Day] │
│  ┌──────── TODAY ─────────────────────┐ │    │  ┌──────── LIVE ──────────────────────┐ │
│  │ 2 games today                     │ │    │  │ ● LIVE   [AB] 3 – 1 [RV]          │ │
│  │ Next: 10:00 AM · Diamond 4        │ │    │  │   Team A vs Riverside · Diamond 4 │ │
│  │ vs Riverside (Home)               │ │    │  └────────────────────────────────────┘ │
│  └────────────────────────────────────┘ │    │  (entire card → Link to game.href)      │
│  ✓ Registered ✓ Accepted ✓ Check-in     │    └─────────────────────────────────────────┘
└─────────────────────────────────────────┘
```

`.heroTodayCard`: `rgba(var(--success-rgb),0.07)` bg + `rgba(var(--success-rgb),0.25)` border + `--radius-sm`. "TODAY" label `--font-data` 0.64rem 800 uppercase `--success`. Live sub-state uses `RollingNumber` (already imported in `CoachLiveSchedule`) for scores + a **`.heroLivePill`** (critic correction — do NOT cross-import `CoachLiveSchedule.module.css`'s `.liveBadge`; define a new `.heroLivePill` in `TeamHQ.module.css`: `rgba(var(--danger-rgb),0.15)` bg + `rgba(var(--danger-rgb),0.35)` border + `--radius-sm` + 6px pulsing dot + "LIVE" in `--danger`/`--font-data`/800/uppercase). `aria-live="polite"` on the score row. **The card does NOT start its own poll** — it receives a server-derived `todayGames` prop (`initialGames.filter(g => g.date === today)`) + live patches from the existing `CoachLiveSchedule` poll. Checklist collapses to 3 rows (Registered, Accepted, Check-in) — open fees move to the status block, killing the "open problem checklist" feel. **ROUTE:** coaches-eval (visual) / phase5:ref(5i) (build).

### 2e. Result / complete — `badge` context-aware, lime-7% wash, the trophy card *(J5-049, J5-052)*

"The screenshot a coach texts 14 parents." Replaces the three-grey-line `.afterglow` with a **`.heroResultCard`** and a champion-aware headline:

```
CHAMPION (placement === 1):                     NON-WINNER:
┌─────────────────────────────────────────┐    ┌─────────────────────────────────────────┐
│ ▌(lime) [AB] Champions!     [Champions] │    │ ▌(lime) [AB] That's a wrap!  [Complete] │
│  ┌────────────────────────────────────┐ │    │  ┌────────────────────────────────────┐ │
│  │ 🏆 1st Place                       │ │    │  │ Event complete · Jun 14–16, 2025  │ │
│  │ Jun 14 – 16, 2025                  │ │    │  │ Final record   3 – 2 – 1          │ │
│  │ Final record   5 – 1 – 0           │ │    │  │ Division: U14 Open                │ │
│  │ Division: U14 Open                 │ │    │  └────────────────────────────────────┘ │
│  └────────────────────────────────────┘ │    │  [View final standings →] [Share team↗]│
│  [View final standings →] [Share team↗] │    └─────────────────────────────────────────┘
└─────────────────────────────────────────┘
  (No games played: card reads "No completed game scores recorded …" — no record line)
```

`.heroResultCard`: `rgba(var(--logic-lime-rgb),0.05)` bg + `rgba(var(--logic-lime-rgb),0.2)` border + `--radius-sm`. Placement row: `Trophy` 18px `--logic-lime` + "1st Place" `--white`/1rem/800 when `placement === 1`; else "Event complete · [dateRange]" `--white-60`/0.86rem. Record row: "Final record" label `--font-data` uppercase 0.64rem 800 `--white-40` + W–L–T in `--logic-lime`/`--font-data`/1.1rem/800 (champion); non-champion uses the W=`--success` / L=`--white-60` / T=`--white-40` colour split. **Action row:** `<a class="btn-ghost">View final standings →</a>` + `<SharePageButton url={shareUrl} className="btn-lime" label="Share team" />` — **critic correction: `SharePageButton` does NOT render lime by default** (`SharePageButton.tsx:47` falls back to its neutral `styles.trigger`); the caller MUST pass `className="btn-lime"` explicitly. Share is louder (lime), standings quieter (ghost) — correct hierarchy.

**J5-052 — no permanent open-problem checklist:** the result phase REMOVES the checklist from the hero, and `TournamentStatusBlock` gains a new **`isResult?: boolean`** prop: when true, suppress the Fee and Check-in rows, show Roster only if positive ("Submitted"/"Confirmed"), and if all rows suppress, render a single "Event complete — thank you for participating." closure note in `--white-40`. **ROUTE:** coaches-eval (visual) / phase5:ref(5m) (build). *Data note: `placement` has no current source — Phase-5/5m derives it from final standings/results.*

> **Theme-1 routing:** 2a→phase5:ref(5h); 2b→phase5:ref(5h); 2c→phase5:ref(5i); 2d→phase5:ref(5i); 2e→phase5:ref(5m). The visual specs themselves are design-only-residual (the locked rules in the addendum); the *build* is the Phase-5 refinement slices.

---

## 3. Theme 2 — Shell coherence & button/chip hierarchy

**The problem:** the locked `btn-lime`/`btn-ghost` convention (design-decisions 2026-06-05) is applied inconsistently; the most journey-critical button is the quietest; there's no chip system; the upsell competes with the coach's own content.

### 3a. Coach button hierarchy *(the rule — J5-023, J5-006, J2-019, J2-032)*

One hard rule for every surface inside `isCoachPortalShellPath()`:

```
TIER 1 — btn-lime   : the ONE most-important action per surface (Claim team · Create account · Save roster · Submit)
TIER 2 — btn-ghost  : secondary/destructive actions, "View all", cancel
        — btn-ghost btn-sm : low-prominence secondary links (section-header "View all") ONLY
BANNED — btn-outline (all coach-portal uses) · btn-primary (gradient) · btn-sm as a primary CTA size · circle buttons · gradient on functional elements
```

**ROUTE:** design-only-residual (the rule) → published to the addendum + flagged for `CLAUDE.md`/`AGENTS.md` so build owners don't default to `btn-outline` on new surfaces (cross-theme dependency #4).

### 3b. Hub — claim-button promotion + persona-conditional pitch *(J2-032, J5-013, J5-023, J2-029)*

`app/coaches/page.tsx:93` renders "Claim team" as `btn btn-outline btn-sm`; the premium upsell card (`:185-218`) is at the same visual weight as the coach's own data.

```
┌─────────────────────────────────────────────┐
│  Your Coaches Portal · you@email.com        │
│  CLAIM YOUR TEAM            (lime sectionTitle — highest priority)
│ ┌─────────────────────────────────────────┐ │
│ │ Ontario Cup 2025 · Org · organizer      │ │
│ │ [        Claim team        ]            │ │  ← btn-lime, full-width, margin-top:auto
│ └─────────────────────────────────────────┘ │      (was btn-outline btn-sm)
│  YOUR TEAMS                                 │
│ ┌──[Users] OPEN TEAM HOME →  Raptors U14 ─┐ │  ← entire card is the Link affordance
│ └─────────────────────────────────────────┘ │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │  ← border-top: 1px var(--border-2)
│  PREMIUM  Take your team further. …  [Express interest →]   ← DEMOTED to compact banner,
└─────────────────────────────────────────────┘      btn-ghost btn-sm — NOT a card
```

Claim card CTA → `btn btn-lime; width:100%; margin-top:auto`; hover `border-color: rgba(var(--logic-lime-rgb),0.4)`. The "Claim your team(s)" `sectionTitle` earns the `--logic-lime` accent (it's the highest-priority section); all other sectionTitles stay `--white-40`. **Upsell demotion:** no `styles.card`, no `min-height`/`box-shadow`/`border-radius` — a ruled inline banner below a `border-top` divider; "Express interest" → `btn-ghost btn-sm`. **Persona-conditional pitch (Rule CP-10):** standalone-only coach → "Take your team further" banner; tournament-only → "Start free team home" btn-lime; both/workspace → no pitch; empty → empty-state with btn-lime. **ROUTE:** coaches-eval (the component) / design-only-residual (the weight rule).

### 3c. Lifecycle chip system *(J5-014)*

`app/coaches/tournaments/page.tsx:216` gives every accepted card the same `badge-success`; no LIVE signal, no phase chip. A distinct chip component (`--radius-sm` 6px, `--font-data`, 0.62rem, 700, 0.1em, uppercase — *not* the `999px` `.badge`):

| State | Label | Colour | When |
|---|---|---|---|
| LIVE | `● LIVE` | `--logic-lime` fill + `#0f1123` text, pulse-dot | tournament dates straddle today |
| GAME DAY | `● GAME DAY` | `--logic-lime` 0.85 opacity | start_date = today |
| UPCOMING | `In N days` | `rgba(var(--info-rgb),0.1)` bg + `rgba(var(--info-rgb),0.45)` border + `--info` text | 1–14 days |
| FUTURE | `[Month Year]` | `--white-40` text, no container | > 14 days |
| COMPLETE | `Complete` | `--white-30` text + `--border-2` border | end_date < today |

Registration-status badges demote to trailing meta when a lifecycle chip is present; hidden entirely on LIVE rows. The chip is the visual signal of the live-first sort. **ROUTE:** design-only-residual (the chip vocabulary + CSS) → phase5:ref(5h) (the sort derivation + rendering). *Dependency #5: the chip CSS lands with/before the sort.*

### 3d. Claim-wall inversion + dense rows *(J5-013)*

The live fixture renders ~16,000px of identical claim cards with "YOUR TEAMS" buried below, on a page still headed "CLAIM YOUR TEAMS." Spec: **claimed teams + next game FIRST**, lifecycle-sorted; group claimable registrations **by tournament** with a count header + claim-all; collapse the rest into a disclosure after 3 visible rows. Dense row (50+ items): `min-height:48px`, 32×32 rounded-square monogram, `border-bottom: 1px var(--border-2)`, "Show all" in `--logic-lime`/0.8rem. **ROUTE:** coaches-a-e (the data-scan + ordering) / coaches-eval (the dense-row layout). *(The data-scan logic is owned; this is the layout/hierarchy spec.)*

### 3e. Rail / nav active accent + active-tab gap *(J5-022)*

`app/coaches/team` (singular) vs `/coaches/teams` (plural) collide, so no nav tab activates on the standalone home. The active accent on the desktop rail (`railLinkActive::before`) and mobile bottom-tab must be **`var(--logic-lime)`, not `var(--primary)` / `var(--primary-light)`** (both org-overrideable; the mobile tab currently shows lime *accidentally* via the `--primary-light` fallback — that breaks in any org-scoped shell). Widen the Home match fn to cover `/coaches/team/*`. **ROUTE:** coaches-a-e (the brand mark + rail + match fn) / design-only-residual (the accent-token rule).

---

## 4. Theme 3 — Real-team density vs demo polish

**The problem:** built for a 2-player demo. The standalone home is a single 960px centre column (`coaches-portal.module.css:6-9`) — equal-width stacked sections, 2,000–3,000px scroll at 14 players; the stat-strip label is 0.64rem (~10px); the tournament checklist values are dim mono right-aligned across a full-width card. *(Bulk-entry features — J2-016 paste roster, J2-022 split fees — are owned by unified-plan; this theme specs how a FULL list LOOKS + reflows, not the bulk-add feature.)*

### 4a. Free team home — desktop 2-col reflow *(J2-019)*

```
Mobile (≤700px — unchanged)          Desktop (≥961px — target, max-width 1200px)
┌───────────────────┐                ┌──────────────────────┬──────────────────────┐
│ [TeamHQ strip 1c] │                │ [TeamHQ stat strip — 5 col]                 │
│ ROSTER     14     │                ├──────────────────────┼──────────────────────┤
│ SCHEDULE   20     │                │ ROSTER       14       │ SCHEDULE      20      │
│ FEES       3      │                │ [player rows…]        │ [event rows…]         │
│ ANNOUNCE   8      │                │ FEES         3        │ ANNOUNCEMENTS 8       │
└───────────────────┘                │ [fee ledger…]         │ [send form + history] │
                                     ├──────────────────────┴──────────────────────┤
                                     │ [Tournament history — full width]            │
                                     │ [ScopeCeilingInterest — full width]          │
                                     └───────────────────────────────────────────────┘
```

`.page` max-width 960px → **1200px**; new `.contentGrid` wraps the four editors `@media (min-width:961px){ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:1.5rem; align-items:start }`. Pairing by data affinity: Roster+Schedule (primary objects) row 1; Fees+Announcements (derivatives) row 2. Tournament history + ScopeCeilingInterest stay full-width outside the grid. 700–960px stays single-column. **ROUTE:** coaches-eval.

### 4b. Stat-strip legibility floor *(J2-019)*

```
@media (max-width: 700px) {
  .hqLabel        { font-size: 0.7rem; }   /* ≥11.2px — was 0.64rem */
  .hqItem strong  { font-size: 1.25rem; }  /* ≥20px — was 1.08rem */
}
.hqItem p { overflow-wrap: anywhere; }      /* missing today (line 64-73) — long "Next event" labels clip */
```

Hard floors (no coach component drops below): stat value ≥1.25rem, label ≥0.7rem on mobile. Desktop 5-col tiles keep the current sizes (adequate in the narrow tile). **ROUTE:** coaches-eval.

### 4c. Tournament checklist legibility + 2-col desktop *(J5-037)*

The `.checkState` values are `--white-40` mono right-aligned — "Owed" is the dimmest text on the page. Spec: colour-code by state — Done→`--success`, Needs-action→`--warning` ("PENDING"/"NOT SUBMITTED"), Overdue→`--danger` + `badge-danger`, Not-started→`--white-60`. **Never `--white-40` for a value the coach must read and act on.** Desktop ≥720px: checklist becomes `grid-template-columns: repeat(2,minmax(0,1fr)); gap:0.5rem 1.5rem` (drop `margin-left:auto`, restore in 1-col via media query). **ROUTE:** coaches-eval / phase5:ref(5h) (interacts with the per-phase checklist row counts — dependency #8).

### 4d. Premium lineup grid — mobile containment *(J2-031)*

> **De-dup:** the lineup builder's **nav presence + false checklist** are owned by coaches-eval; this is the **grid's mobile layout spec only.** This is the org-attached Premium portal (`/{orgSlug}/coaches/`), a different shell.

Any data table inside a modal/slide-over wider than the modal's max-width wraps in `overflow-x:auto; -webkit-overflow-scrolling:touch` (modal adds `overflow-x:hidden` to avoid a double scrollbar). The slide-over uses a **tab strip** (Details / Attendance / Lineup) rather than stacking all three; active tab `--logic-lime` border-bottom (not blueprint-blue). ≤600px: bottom-sheet (`max-width:100%; border-radius:0 0 var(--radius-lg) var(--radius-lg)`). **ROUTE:** coaches-eval. *(If the build can't locate the exact grid, this is the mobile-first principle to apply.)*

---

## 5. Themes 4 & 5 — Team identity + empty states

These two are tightly coupled (both touch card identity/borders) and were reconciled in synthesis. **Theme 4 = the team-colour wash on the hero header; Theme 5 = the empty-state component inside section bodies.** They never conflict: hero wrappers carry the team-hue wash; empty-state cards always carry the lime glow.

### 5a. Theme 4 — Team-colour-wash rule *(J2-023, J5-038)*

The public team-profile page is the bar (`team-profile.module.css`): `.heroCard` = **18% team-hue wash** (`color-mix(in srgb, var(--team-color) 18%, var(--surface) 82%)`), 40% team-hue border, a **9rem opacity-0.07 watermark monogram**, a 64px display-font avatar, a W-L-T record strip. The coach surface gets the flattest variant: the standalone strip has **no** wash/monogram; the tournament hero runs a faint **9%** gradient with **no** watermark.

**Standalone hero (NEW — replaces the plain `shared.header` H1 at `page.tsx:117-124`):**
```
┌─────────────────────────────────────────────┐
│ .standaloneHero  (18% team-hue wash, 30%     │
│  team-hue border, --radius, overflow:hidden) │
│   [WATERMARK 7rem/900/0.07 team-color, abs.] │
│   ┌────┐  Team Name (--font-display? 1.75rem)│
│   │ HH │  Coach · Sport · Age Group          │
│   └────┘  (52px monogram, --team-color bg)   │
└─────────────────────────────────────────────┘
   [hqStrip 5-col — stays --surface, NO wash below]
```

**Tournament hero (UPGRADE):** wash 9% → **18%** for celebration phases (accepted/prep/schedule-live); border plain blueprint → **30% team-hue mix**; add the **watermark** (9rem desktop / 6rem mobile, opacity 0.07); monogram **44px → 52px**. *Non-celebration phases keep the phase-semantic washes from Theme 1 (info/danger/success/lime) — they override the 18% team wash.*

**Wash-intensity tiers:** Hero (standalone header + tournament celebration) = 18% wash / 30% border / 0.07 watermark / 52px monogram. Phase-override (pending/rejected/game-day/result) = phase-semantic %. Strip/card (hqStrip tiles, editor cards) = 0% (`--surface`), no watermark. Light mode: wash 18%→12%, border 30%→25%. **Token rules:** `--team-color` set inline via `teamColor(name)` on the outermost wrapper; always `var(--team-color, var(--logic-lime))` with fallback. **`--team-accent` is excluded from the coach portal** (unlike the public bar) — `--logic-lime` is the permanent accent for all interactive elements; `--team-color` is scoped to wash/watermark/monogram fill only. Monogram is always a rounded-square `--radius-sm`, never a circle; `teamInitials(name)` from `lib/team-color.ts`. **ROUTE:** coaches-eval. *(Border uses 30% not the public bar's 40% — deliberately lower for the dense operational context vs the public showcase.)*

### 5b. Theme 5 — The CoachEmptyState component *(J2-037, J2-036, J2-015, J5-029, J5-046)*

No shared empty-state pattern today — bare `<p>`s (RosterEditor:158, ScheduleEditor:145, FeeEditor:257/305, AnnouncementEditor:139/198), raw cards with inline `var(--text-secondary)` (tournament empties), a ghost-icon void on the premium BvA, an off-accent blue Add button on the premium schedule. Borrow the public `PublicTournamentState` pattern (medallion + soft glow), org-less so the hue is `--logic-lime` not `--primary`:

```
┌─────────────────────────────────────────────────────────┐
│  [soft lime glow, radial from top, 7% opacity]          │
│       [medallion 52px, lime-tinted, --radius]           │
│              [ icon ]                                    │
│       EYEBROW (DATA FONT, 0.7rem, --white-40)           │
│       Headline (1.1rem, 800, --white)                   │
│       One or two benefit sentences. (--white-60,        │
│       0.88rem, max 42ch)                                │
│       [ btn-lime — Primary action ]                     │
│       [ btn-ghost — Secondary (optional) ]              │
└─────────────────────────────────────────────────────────┘
```

**Token rules (critic-corrected — no `--team-color-rgb`):** container `radial-gradient(110% 80% at 50% 0%, rgba(217,249,157,0.07), transparent 55%), var(--surface)` + `1px var(--border)` + `--radius` + `--highlight-top`; medallion `--radius` (12px, **NOT 50%** — circles banned, the public component's circle is a public-shell choice), `--logic-lime` icon on `rgba(217,249,157,0.10)` + `0 0 24px rgba(217,249,157,0.15)`; eyebrow `--font-data`; primary CTA **always `btn-lime`** (never `.inlineLink`, blueprint-blue `.btnPrimary`, or a bare hex anchor); `compact` variant = 40px medallion + 1.25rem padding. **Tournament-mode glow option:** `color-mix(in srgb, var(--team-color, var(--logic-lime)) 8%, transparent)` for the radial only — medallion stays lime-accented always. Mobile ≤640px left-aligns.

**The full-card vs text-note decision rule:**
- **Full card** when the section IS the content and the coach CAN fix it: new-team first-run banner (J2-015, 3-step checklist, dismiss on first player), roster/schedule/fee empties, the premium BvA empty (J2-037 — replaces the void + blue link with `btn-lime`), the premium schedule empty (J2-036 — + restyle the Add Event button blueprint-blue → `btn-lime`).
- **Compact card** when it's one of several recoverable empties (the editor section empties; the tournament pending/no-schedule states J5-029).
- **Text-only `<p>` note** when the coach CANNOT act from this surface: organizer announcements ("No announcements from the organizer yet."), team-wide-charges sub-block, announcement-log "No history", and the **`CoachLiveSchedule` static-mode banner** (J5-046 — `rgba(var(--info-rgb),0.07)` bg + `rgba(var(--info-rgb),0.18)` border, "Live scores unlock when the organizer takes the event site live.", critic-corrected to `--info-rgb` not hardcoded `rgba(59,130,246,…)`).

**ROUTE:** coaches-eval (the component + all standalone/tournament instances + the first-run banner) / phase5:ref(5i) (the static-mode banner copy + row muting). *Per-instance routing in §8.*

---

## 6. The Seam — standalone ⇄ tournament as one product

The seam reviewer's lens: does the surface read as one product as a coach moves between the org-less team home and the tournament experience? The unifying rules (most reference owned findings — they are **seam-coherence rules**, not re-fixes):

- **Shell accent token (Rule CP-5):** `--logic-lime` is the coach portal's permanent accent everywhere (rail bar, mobile tab, brand mark, CTAs). `--primary`/`--primary-light` are org-overrideable and must not appear in coach-portal accent positions. *(Refs J5-021/022; the brand-mark/rail/tab fixes are coaches-a-e.)*
- **Breadcrumb context badge (Rule CP-6):** every coach detail page gets a one-word context badge — `badge-neutral` "Team home" (standalone), `badge-info` "Tournament" (tournament detail). *Correction: the tournament breadcrumb link reads "Tournament Records" → `/coaches/tournaments` (the committed file links there, not `/coaches`).*
- **Page h1 discipline (Rule CP-7):** inside the shell, no h1 repeats "Coaches Portal" (the shell brandText owns the name). The tournament list h1 → "Tournament Records" (J5-021); inner pages use the team name.
- **Mobile account surface (Rule CP-8, J5-020):** the mobile topbar gets a 30×30 lime account chip → bottom-sheet (email, All workspaces, Send feedback, Sign out). *(Owned by coaches-a-e — the seam need is that mobile has *any* account/sign-out surface.)*
- **Nav "My Teams" rename + match fn (Rule CP-9):** "Teams" → "My Teams"; match fn covers `/coaches/team/*` so standalone homes activate the tab. *(Owned by coaches-a-e; J5-015's "Teams tab = upsell" content fix is theirs.)*
- **The central seam question — converge or stay distinct?** See §7 Decision 1. **Recommendation: stay distinct** — standalone gets a wash-*header* (identity) above the 5-col stat strip (the data layer); tournament gets the phase-*hero* (narrative). They're unified by the shared monogram system + wash formula + watermark — **the monogram is the seam bridge** — but serve different information architectures. The standalone strip IS the content; wrapping it in a narrative phase-hero ("You're in!") would misrepresent a tool as an emotional journey.

**ROUTE:** coaches-a-e (shell/nav/account) / coaches-eval (breadcrumb badges, h1 copy) / design-only-residual (the rules).

---

## 7. Owner decisions — RESOLVED 2026-06-14

All four ruled by the owner (via grounded AskUserQuestion with per-page comps). The specs in §2–§6 + the addendum were written against these, so **no rework is needed** — they are now locked.

| # | Decision | Ruling | What it means for the build |
|---|----------|--------|------------------------------|
| **1** | The central seam question — do the two TeamHQ variants converge or stay distinct? | **DISTINCT** | Standalone team home gets a **team-colour identity band** (name + monogram + 18% wash) ABOVE its 5-col stat strip; the **phase hero stays tournament-only** (no "You're in!"-style narrative on an org-less team). The two "my team" screens unify via the shared monogram + colour, NOT a shared shell. The strip stays the operational data layer. *(Per the recommendation — smaller change, doesn't impose an event/narrative frame on a tool surface.)* |
| **2** | Tournament/standalone hero wash intensity | **18% — match the public page** | The coach hero + the standalone band both step from the faint 9% to **18%** (+ watermark monogram + result-phase record strip), matching the public team page. Celebration phases use 18%; non-celebration phases keep their phase-semantic washes (Section i of the addendum). Light mode 18%→12%. |
| **3** | `/coaches/join` `submitBtn` `border-radius:0` (imports `auth.module.css`) | **Migrate to `btn btn-lime`** | The join-screen Submit button drops the borrowed square-cornered `auth.module.css` `.submitBtn` and uses the standard rounded `btn btn-lime` (full-width) like the rest of the portal. Owned by coaches-a-e. |
| **4** | TeamHQ monogram font at ≥52px | **`--font-display`** | The 52px monogram renders initials in Barlow Condensed (`--font-display`), matching the public bar's sporty identity. (≤44px stays `--font-data`.) |

*(Synthesis Conflicts 2–5 needed no owner input — already resolved in the addendum. Conflict 1 = Decision 1; wash intensity = Decision 2.)*

---

## 8. Route-back — specs by owning plan

Each spec routes to the plan that **builds** it. The visual rules themselves are published to the [design addendum](../../agents/design/COACH_SURFACE_DESIGN_ADDENDUM.md); the rows below are what each plan implements against that comp instead of inventing one.

### → phase5:ref(5h) *(tournament hero — pending/prep)*
- Phase identity bar (left-border accent + chip per phase) + per-phase background wash *(J5-032)*
- Pending phase: entry-fee preview box, waitlist-position row, contact link *(J5-029)*
- Fee glance strip (`.heroFeeStrip`) — owed + past-due variants; the glance→detail pair contract with `TournamentStatusBlock` *(J5-028)*
- Checklist past-due badge (`badge-danger` + "Was due" micro-text) vs plain "Owed" binary *(J5-034)*
- Live-first sort derivation for the tournament-list cards *(J5-014)*

### → phase5:ref(5i) *(game-day bridge)*
- Game-day phase: green wash, "Game Day" headline/chip, `.heroTodayCard` (between-games + live sub-states with `.heroLivePill` defined in `TeamHQ.module.css`), checklist collapse to 3 rows *(J5-041)*
- Schedule-live phase: countdown promotion + "● Schedule published" signal line *(J5-032)*
- `CoachLiveSchedule` static-mode info banner (`rgba(var(--info-rgb),0.07/0.18)`, NOT hardcoded RGB) + row muting when `live=false` *(J5-046)*

### → phase5:ref(5m) *(afterglow)*
- Result phase: `.heroResultCard` (placement / W-L-T / division), Champions vs That's-a-wrap sub-states, btn-lime Share (`className="btn-lime"` passed explicitly) + btn-ghost Standings action row *(J5-049)*
- Result phase: remove the hero checklist; `TournamentStatusBlock` `isResult` prop suppresses Fee/Check-in, shows a closure note *(J5-052)*
- *(Hygiene, optional)* migrate the afterglow card's inline `var(--text-secondary/tertiary)` to `var(--white-60/40)` — tokens are real, **no visual defect** *(J5-049)*

### → coaches-eval *(standalone home, hub, tournament-hero visual upgrades, empty states)*
- Hub: "Claim team" → btn-lime full-width; upsell → compact inline banner; persona-conditional pitch; empty-state CTA btn-lime *(J2-032, J5-013, J2-029)*
- Standalone home: 2-col desktop reflow (max-width 1200px); stat-strip legibility floor (`strong`≥1.25rem, label≥0.7rem, `overflow-wrap:anywhere` on `p`) *(J2-019)*
- Standalone wash-header with monogram + watermark replacing the plain H1 *(J2-023)*
- Tournament hero wash upgrade 9%→18%, team-hue border, watermark, monogram 44px→52px *(J5-038)*; checklist 2-col desktop grid + colour-coded `.checkState` *(J5-037)*
- Claim-wall dense grouped/collapsed layout *(J5-013)*; premium lineup mobile containment + tab strip *(J2-031)*; fee-ledger density at 14-player scale *(J2-019)*
- **CoachEmptyState component** + all instances (Roster/Schedule/Fee/Announcement editors, tournament history, tournament pending/no-schedule, BvA, premium schedule); first-run banner; BvA void→btn-lime; premium Add Event blueprint-blue→btn-lime *(J2-037, J2-036, J2-015, J5-029)*
- Tournament-list h1 "Coaches Portal"→"Tournament Records" *(J5-021)*; breadcrumb context badges *(J5-022, J2-013)*

### → coaches-a-e *(shell, nav, account)*
- Brand mark + `railLinkActive::before` + `bottomTabActive` → `var(--logic-lime)` not `var(--primary)`/`--primary-light` *(J5-022)*
- "Teams"→"My Teams" rename + match fn covering `/coaches/team/*` *(J5-015, J2-013, J5-022)*
- Mobile account chip + bottom-sheet (sign-out / email / switcher) ≤1023px *(J5-020)*
- `/coaches/join` `submitBtn` border-radius override / migrate to btn-lime *(J5-009, J5-024 — Decision 3)*
- Claim-wall ordering (claimed first, lifecycle sort, group by tournament) *(J5-013)*
- Interest widgets (`CoachStartInterest`/`ScopeCeilingInterest`) `.button` class → btn-lime values *(J5-023)*

### → unified-plan
- Standalone Tournaments-cell empty: `latestHistoryLabel = "No tournaments yet"` in `--white-40` *(J2-037)*
- Standalone hero seam rule: standalone stays wash-header + strip; phase-hero is tournament-only *(J2-037 — Decision 1)*

### → free-tier-strategy
- `/start` Coach card recommended-door visual: lime border `rgba(var(--logic-lime-rgb),0.35)` + "Free to start" lime label (NOT badge-success, no check icon) *(J2-007)*

---

## 9. Design-only residual *(unowned polish — no functional plan picks these up)*

These are pure className/token/CSS fixes no build plan will otherwise own. Each is a `/design` follow-up; none touches data, auth, or APIs.

**Button/CTA className swaps:**
- [ ] `app/coaches/page.tsx:93` — "Claim team": `btn btn-outline btn-sm` → `btn btn-lime` + `width:100%` + `margin-top:auto` *(J5-023, J2-032)*
- [ ] `app/coaches/page.tsx:198` + `app/coaches/tournaments/page.tsx:39` — "Express interest": → `btn-ghost btn-sm` *(J2-032)*
- [ ] `app/auth/auth.module.css:162` `.submitBtn { border-radius:0 }` — override to `var(--radius)` in coach-portal context, or migrate the join CTA to `btn btn-lime` *(Decision 3)*
- [ ] `CoachStartInterest.tsx:119` + `ScopeCeilingInterest.tsx:92` — verify the `.button` module class resolves to btn-lime values (`background:var(--logic-lime); color:#0f1123; --radius-sm; padding:0.625rem 1.25rem`) *(J5-023)*

**Token/copy hygiene (no visual defect — preference-only):**
- [ ] Migrate inline `var(--text-secondary/tertiary)` → `var(--white-60/40)` in coach pages when next touched (`page.tsx:407,419,481,492`; `tournaments/page.tsx:74,91,92`; `coaches/page.tsx:73`; `join/page.tsx:374`) — **tokens are real; this is style-guide consistency, deferred to a CSS-module refactor opportunity.**
- [ ] Tournament-list h1 "Coaches Portal" → "Tournament Records" + "{N} registrations across {M} tournaments" sub *(J5-021)*
- [ ] Remove any residual "Basic"/"Premium" tier labels from coach-portal surfaces (locked: kill that framing) *(J5-021)*
- [ ] Standardize the two-label gated destination ("Explore the Coaches Portal" vs "Express interest") on "Express interest" *(J2-029)*

**New CSS-only additions (no JS):**
- [ ] Define the `.coachLifecycleChip` base + LIVE/UPCOMING/COMPLETE/FUTURE modifiers (Theme 3c table) *(J5-014)*
- [ ] Add a code comment at `TeamHQ.module.css` `.hero` documenting the 18%-celebration / phase-semantic-override / 30%-border rule
- [ ] `/start` Coach card recommended-door visual *(J2-007 — also routed to free-tier-strategy if the marketing flip touches `/start`)*
- [ ] Breadcrumb context-badge spans on the standalone + tournament detail breadcrumbs *(J5-022, J2-013)*
- [ ] Join-screen segmented-control type polish (confirm the 5i as-we-go fix held; tighten any remaining wraps) *(J5-009, J5-024)*

---

## 10. Build-order dependencies *(when specs are implemented)*

1. **Team-colour-wash base [Theme 4] before per-phase hero [Theme 1]** — both restyle `.hero`; Theme 4 upgrades the base (9%→18% bg, team-hue border, `position:relative; overflow:hidden`), Theme 1's per-phase overrides sit on top. Ship Theme 1 first and its phase washes fight the old gradient.
2. **CoachEmptyState component before any instance** — extract the shared component, then migrate each surface; otherwise each reinvents the pattern (as they do today).
3. **Shell nav match fn [coaches-a-e] before section ghost-pill Add buttons [coaches-eval]** — a verification dependency (can't QA "does +Add focus the right input" if the nav shows no active tab).
4. **Button hierarchy rule [Theme 2] documented before new coach surfaces** — publish Rule CP-1 to `CLAUDE.md`/`AGENTS.md` before Phase-5/coaches-a-e build new pages, or they default to `btn-outline`.
5. **Lifecycle chip CSS before the tournament-list sort** — the chip is the visual signal of the sort; sort-without-chip leaves coaches unable to read the ordering.
6. **`TournamentStatusBlock isResult` prop ships WITH `.heroResultCard`** (same 5m slice) — suppress-before-celebration leaves the result phase blank.
7. **Per-phase checklist row counts [Theme 1] before the desktop 2-col checklist grid [Theme 3]** — the grid on a 3-item list orphans a cell; stabilize row counts first.

---

## Appendix — workflow provenance

13 agents · ~790K tokens · all 6 themes **accept-with-fixes**, all **dedup-clean**. Reviewers: 5 themes (phase-hero / shell-hierarchy / density / team-colour / empty-state) + the seam, each grounded in the committed surface (`Explore` agents reading the real files). Critics: 6 adversarial design-coherence verifiers (de-dup compliance · grounded-in-committed-code · design-system fidelity) — they caught and corrected the inverted ghost-token ruling (2 reviewers), the invented `--team-color-rgb` (Theme 5), the `SharePageButton` className gap + the `.liveBadge` cross-module reference (Theme 1), and the rail-accent-token nuance (Theme 2). Synthesis: 1 agent reconciling the five themes into one coherent addendum + this route-back + the open decisions. Run ID `wf_c94669d9-843`; per-theme spec detail (the full ASCII comp set + every token rule) is preserved in the workflow transcript.
