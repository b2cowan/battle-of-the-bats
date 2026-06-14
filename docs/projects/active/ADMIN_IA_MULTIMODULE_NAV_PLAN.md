# Admin IA & Multi-Module Navigation — Implementation Plan

> **Status:** SCOPED 2026-06-13 — spun out of the User Journey Audit (Phase 5, FP-7). **NEW project.** Coordinates with ADMIN_ROLE_PARITY (orientation) and the design system. Awaiting owner go-ahead.
> **Branch:** dev. **Companion:** [ADMIN_IA_MULTIMODULE_NAV_PM_BRIEF.md](ADMIN_IA_MULTIMODULE_NAV_PM_BRIEF.md)
> **Source of truth:** J3/J4/J7/J8 reports + [USER_JOURNEY_AUDIT_SYNTHESIS.md](USER_JOURNEY_AUDIT_SYNTHESIS.md) §4 FP-7 (theme T7).

## Goal

The admin product still thinks it's a tournament tool. On league and club orgs the dashboard, nav, public homepage, and `/home` copy all lead with tournaments — the cross-persona "tournament-first skew" that reproduced as cross-refs in 4 club variants + 3 league variants. This project makes the org-level IA **plan-aware**: nav, dashboards, and public surfaces order themselves by what the org actually runs, and the operator-speak `/home` switcher speaks like a product. (This is the cross-cutting IA theme no single-module project owns. If the owner prefers fewer projects, it can fold into FP-4/FP-5/FP-6 per surface.)

## Scope

Org-level IA + multi-module navigation that spans personas. Module-internal IA stays with the module's project.

### Workstreams (finding IDs)
- **Tournament-first skew on league/club orgs:** J4-041 (doors-only dashboard, only CTA is tournament setup), J4-043 (public homepage tournament-first by hardcode), J4-045 (mobile bottom-nav is tournament-scoped), J4-049 (/home tournament-first copy), J3-016 (org-level mobile bottom nav tournament-scoped), J3-078 (org homepage leads with empty tournaments), J7-002 (empty-tournament negative lead for a league parent). Order sections by what the org runs; suppress empty modules; plan-aware bottom-nav.
- **`/home` & switcher voice:** J3-017 (operator-speak switcher copy + unlabeled arrow CTA), the /home copy slips (J4-049), J5-019 (extra /home hop — coordinate with coaches plans).
- **Buried module nav:** J4-029 (Accounting one-item sidebar; Budget/BvA reachable only mid-page), J3-063 (orphaned league composer), J3-076 (season Ledger invisible in nav + raw Forbidden), J4-044 (public-site editor only governs tournaments), J4-048 (AGM-grade club homepage opportunity), J4-042 (rep teams publicly invisible + tryouts CTA loop), J4-006 (no cross-team oversight rollup — franchise health board; data behind admin GETs).
- **Volunteer wrong-door (shared with FP-3):** J8-019/020/021 — referenced; FP-3 owns the volunteer-shell half, this project owns the org-level routing decision (plan-aware redirect for capability-only members).
- **Plan-aware safety:** J3-079 (reserved-slug guard — a tournament slugged 'league'/'teams' shadows org routes).
- **Design-system debt cross-cut:** J4-050 (rep-teams cluster + portal-links predate the locked admin design system), J3-038 (house-league module has zero responsive CSS). Best handled as a `/design` conventions pass per surface — tracked here, executed via /design.

## Phases

- **Phase A — plan-aware org dashboards + nav:** J4-041/045, J3-016, J4-049, J3-017.
- **Phase B — plan-aware public homepage + section ordering:** J4-043/044/048/042, J3-078, J7-002.
- **Phase C — buried nav + safety:** J4-029, J3-063/076, J3-079.
- **Phase D — design-system debt:** J4-050, J3-038 (via /design).

## Key decisions

- **Foldable:** if the owner prefers fewer projects, Phase A/B can split into FP-4 (league) / FP-5 (tournament) / FP-6 (club) and the design-debt into ad-hoc /design. Kept standalone here because the skew is one coherent platform-IA theme.
- **ADMIN_ROLE_PARITY owns day-one orientation** (J10-015/016) — not re-homed; this project handles the *navigation* half, that plan the *orientation* half.
- **Franchise health board (J4-006)** overlaps FP-6's oversight wow — coordinate so the rollup ships once.

## Success criteria

1. A league/club org's dashboard, nav, and public homepage lead with what the org actually runs, not tournaments.
2. The `/home` switcher speaks to a user, not an operator.
3. Buried module surfaces (Accounting budget, league ledger) are reachable from their sidebars.
4. A tournament can't be slugged to shadow an org-level route.
