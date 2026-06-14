# House-League In-Season Trust — Implementation Plan

> **Status:** SCOPED 2026-06-13 — spun out of the User Journey Audit (Phase 5, FP-4). **NEW project.** Coordinates with FREE_TIER_STRATEGY (which owns league *acquisition*, not in-season trust). Awaiting owner go-ahead.
> **Branch:** dev. **Companion:** [HOUSE_LEAGUE_INSEASON_TRUST_PM_BRIEF.md](HOUSE_LEAGUE_INSEASON_TRUST_PM_BRIEF.md)
> **Source of truth:** [journeys/JOURNEY_J3_HOUSE_LEAGUE_ADMIN.md](journeys/JOURNEY_J3_HOUSE_LEAGUE_ADMIN.md), [journeys/JOURNEY_J7_HOUSE_LEAGUE_PARENT.md](journeys/JOURNEY_J7_HOUSE_LEAGUE_PARENT.md), [journeys/JOURNEY_J9_HOUSE_LEAGUE_COACH.md](journeys/JOURNEY_J9_HOUSE_LEAGUE_COACH.md) + [USER_JOURNEY_AUDIT_SYNTHESIS.md](USER_JOURNEY_AUDIT_SYNTHESIS.md) §4 FP-4.

## Goal

The house-league admin product is genuinely good; the **shell around it is broken** — the public face is an unbranded stub telling parents the wrong thing, the comms spine lies about delivery, and the in-season half of the parent experience can vanish from navigation. This project ships the league's "safe to share before anyone shares it" package: public-surface honesty, a working comms spine, the parent payment loop, and the schedule the generator should produce. It is the league module's promotion gate (parallel to FP-1 for tournaments).

## Scope boundary with FREE_TIER_STRATEGY

FTS §16 owns league **acquisition** (the express-interest funnel, pricing, the marketing flip, and the League-Starter free-floor feature set including the J7/J9 items already routed there: J7-006/008/009/016/017/022/023, J9-001/009/010). **This project owns the in-season *operate* trust** — the surfaces a parent and coach use after registration. Where they meet (e.g. payment instructions: FTS owns the schema field, this project owns the render across the five surfaces), the boundary is noted per finding.

### Fix-now (carried here)
- **J3-067 / J7-001** — **Blocker**: the in-progress season vanishes from the league index + org home the moment next season's registration opens. Render every non-draft, non-archived season. Two-file fix; escalate the J3-067 ticket to Blocker.
- **J7-025** — all six league email templates interpolate user input unescaped (unauthenticated phishing vector from the verified domain); no rate limit on the public register endpoint. Wrap in `escapeEmailHtml` + rate-limit. Natural companion to FP-1's J3-068/069 batch on the same public surface.

### Workstreams (finding IDs)
- **Public-surface honesty:** J3-070 (cancelled vanish / postponed render as live), J3-071/J9-001 (schedule never says WHERE), J6-style schedule truth, J3-074/J7-002 (unbranded stub + OG card), J3-078 (org home leads with empty tournaments), J3-080 (GF/GA vs RF/RA), J7-018/J9-005 (mobile standings clip), J3-073 (parent can't see their kid's team), J9-007 (season-home buries coach links).
- **Comms spine:** J3-058 (Waitlist/Pending audiences silently email nobody, green "0 delivered" success), J3-059 (provider failures counted as sent; no guardian dedupe), J3-060/J7-012/J9-004 (no reply path; platform Gmail as contact; dead `contact_email` column), J3-062 (rainouts/reschedules notify no one), J3-063 (orphaned composer), J3-064 (team placement never announced), J3-065 (HTML escaping), J7-011 (fire-and-forget confirmation), J7-021 (no unsubscribe/footer), J7-026 (auto-promote fee gap).
- **Parent payment loop:** J3-072 (no instructions/payee/deadline — render half; FTS owns the field), J3-034 (no unpaid filter/rollup), J3-077 (no expense tracking — Club-upsell moment).
- **Practices visible to humans:** J3-052/J9-012 (practices invisible to parents/coaches/public/exports), J9-013 (rainout notify wire).
- **A schedule, not pairings:** J3-045 (rounds stacked onto the same night), J3-046 (no diamonds/slots/conflict detection), J3-048 (regenerate silently appends), J3-049 (score inputs hidden), J3-050/J3-051 (rainout path undiscoverable / Cancel-Game misclick).
- **Lifecycle & weeknight scale:** J3-028 (one-way unconfirmed lifecycle), J3-031 (200 blocking modals), J3-030 (medical/carpool notes invisible), J3-032 (Withdraw emails "not approved"), J3-029 (capacity ignored on approve), J3-054 (Past Seasons 404), J3-055 (no rollover), J3-041/042/043 (draft defects), J3-040 (waitlist position), J3-079 (reserved-slug).
- **Coach-facing defects (J9):** J9-002 (dead-end "No team assignments yet" promise), J9-006 (blank void empty state). *(J9-003 PII over-grant → FP-1; the coach-portal extension itself → coaches plans / FTS §16.)*

## Phases

- **Phase A — make it safe to share (fix-now):** J3-067/J7-001 (vanishing season), J7-025 (email injection + rate-limit), J3-070/071 (schedule honesty), J3-047 timezone (owned by FP-1 — coordinate). Ship before any League org is promoted.
- **Phase B — comms spine:** J3-058/059 (honest counts) → J3-060/J7-012 (reply path + contact) → J3-062/064 (notify-on-change + placement).
- **Phase C — parent payment + practices:** J3-072 render + J7-026, J3-034, J3-052/J9-012/J9-013.
- **Phase D — generator + weeknight scale:** J3-045/046/048/049, J3-031/030/032, lifecycle confirms.
- **Phase E — public polish + coach defects:** J3-074/075/078/080, J9-002/006/007.

## Key decisions

- **Boundary with FTS** is explicit per finding (acquisition = FTS, operate = here). Document it in both plans so there's one source of truth per surface.
- **Schema changes** (payment_instructions field is FTS's; any contact_email/timezone column) update DATA_DICTIONARY + snapshots per the schema-dictionary rule.
- **J3-067 escalates to Blocker** (parent-lens consequence per J7-001) — do not double-file.

## Success criteria

1. The in-progress season stays navigable when next season's registration opens.
2. The comms composer never reports "0 delivered" as success; replies reach the league, not the platform Gmail.
3. A parent can see how to pay, what team their kid is on, and where games are played.
4. The generator produces a real schedule (diamonds + time slots), not simultaneous pairings.
5. The public league site carries org branding and tells parents the truth about cancelled/postponed games.
