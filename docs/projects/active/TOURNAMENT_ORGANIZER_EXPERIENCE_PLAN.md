# Tournament Organizer Experience — Implementation Plan

> **Status:** SCOPED 2026-06-13 — spun out of the User Journey Audit (Phase 5, FP-5). **NEW project.** Coordinates with DASHBOARD_SUMMARY_IA (owns completed/summary IA). Awaiting owner go-ahead.
> **Branch:** dev. **Companion:** [TOURNAMENT_ORGANIZER_EXPERIENCE_PM_BRIEF.md](TOURNAMENT_ORGANIZER_EXPERIENCE_PM_BRIEF.md)
> **Source of truth:** [journeys/JOURNEY_J1_TOURNAMENT_ORGANIZER.md](journeys/JOURNEY_J1_TOURNAMENT_ORGANIZER.md) + [USER_JOURNEY_AUDIT_SYNTHESIS.md](USER_JOURNEY_AUDIT_SYNTHESIS.md) §4 FP-5.

## Goal

J1 (the tournament organizer, "Dana") produced 118 findings — the largest single block — and routed 103 to backlog. The middle of her journey is genuinely good; it stalls at its two emotional bookends (first impression, trophy moment) and in a cluster of trust-critical strings that are simply wrong. This project owns the J1 backlog remainder: make Sunday's bracket math trustworthy, fix the falsest strings, hand Dana the right mental model on day one, and make game day actually live.

## Scope

The J1 backlog (everything not already routed to DASHBOARD_SUMMARY_IA, FREE_TIER_STRATEGY, the coaches plans, or phase5). The J1 "Top 5 moves" are the spine.

### Bracket correctness (owner-assigned here, 2026-06-13)
- **J1-083** — a tied playoff score silently advances the AWAY team (`home > away ? home : away`). Reject ties for `isPlayoff` games at the service level + inline validation in both scoring UIs.
- **J1-084** — recording a coin toss doesn't re-seed already-filled playoff games. Re-resolve unstarted placeholders after recording; pause seed-fill while `needsCoinToss`.
- **J1-091** — no forfeit handling (invented scores count into RF/RA/RD, swing tie-breakers).
- **J1-076** — publish vanishes in the Playoffs stage / unreachable for playoff-only tournaments.
> These are fix-now-worthy correctness; sequence them first within this project (or batch with FP-1 if the owner reverses the §Decisions call — currently they stay here).

### Workstreams (finding IDs)
- **The five false strings:** J1-043 (activate modal shows a 404 public URL), J1-065 (single accept/reject/paid emails say literal "Division"/"Tournament" + route to ADMIN_EMAIL), J1-045 (contact-privacy toggle bypassed on home/news/rules), J1-103 (archive confirm wrong twice + omits the public-site-offline consequence), J1-087 (Results empty state's two false promises). Plus J1-075 (confirm always claims an email sends), J1-037/081 (contradictory subtitles/labels), J1-049/059/061/118 (copy hygiene).
- **Day-one mental model:** J1-028 (wizard hides the field/diamond model → one-lane schedules), J1-029 (Event Settings wall + untargeted deep-links), J1-030 (fees absent from wizard but required by checklist), J1-032 (three definitions of "ready"), J1-031/038/039 (wizard polish), J1-040/041/042 (divisions).
- **Live game day:** J1-085 (dashboard never shows the live game), J1-086 (game-day surfaces don't live-update), J1-047 (public home leads with "Registration closed"), J1-097 (mobile schedule lacks an operating view), J1-089 (no bulk rain-delay), J1-088/090 (playoff builder buried / coin-toss recorder hidden), J1-096/099 (thumb-zone action / empty desktop panels), J1-098 (truncated health labels).
- **Registrations & money:** J1-066 (accepting a waitlisted team makes it vanish), J1-067 (deep links ignored), J1-068 (money roll-up computed never rendered), J1-069 (reminder ignores saved instructions), J1-070 (dead targeting hint), J1-071/073 (mobile slot board / glyph status).
- **Public face:** J1-044 (register preview dead-ends on drafts), J1-046 (Public Site page never links the public site), J1-048 (register form open during closed event — coordinate with FP-2's J6-035), J1-050 (org landing denies completed events), J1-051/052/053/054/055/056/057/058/062/063/064 (public polish, contact banner, schedule/standings rendering).
- **Discovery & marketing (tournament side):** J1-001 (footer dead links → /docs /status /contact), J1-002 (landing blank voids on mobile), J1-003 (retired brand + tagline — shared with D2/FP-7), J1-004 (zero product proof), J1-005–016 (pricing/landing polish), J1-017/018/022 (verification resend + workspace email), J1-025/027 (signup form).
- **Staffing & comms:** J1-077 (gate volunteers no product path to /check-in — coordinate with FP-3), J1-079 (timeline drag no undo), J1-080 (day-of staff QR kit — wow), J1-082 (modal CSS debt).
- **Close:** J1-100 (crown champion on the game-day board), J1-104 (free-tier renewal dead-ends history), J1-111/113 (completion moment buried / Founding $0 hidden), J1-112 (shared final-results page never crowns champion — coordinate with FP-2's J6-052).

### Routed elsewhere (NOT here, referenced)
DASHBOARD_SUMMARY_IA: J1-105/106/107/108/109/110/114/115/116/117/118. FTS: J1-072/078. phase5: J1-074. UNIFIED: J1-024.

## Phases

- **Phase A — bracket correctness (fix-now-worthy):** J1-083/084/091/076.
- **Phase B — the five false strings:** J1-043/065/045/103/087 (+ the copy-hygiene cluster).
- **Phase C — day-one mental model:** J1-028/029/030/032.
- **Phase D — live game day:** J1-085/086/047/097/089/088/090.
- **Phase E — registrations, public face, discovery, close:** the remainder, by surface.

## Key decisions

- **Bracket math stays here** (owner, 2026-06-13), sequenced first. If priority shifts, it can batch with FP-1.
- **Overlaps with FP-2** (J1-048 ↔ J6-035 register lifecycle; J1-112 ↔ J6-052 champion on completed standings) — coordinate so the public surfaces land once.
- **DASHBOARD_SUMMARY_IA** owns the completed-dashboard/summary cluster — do not re-home.

## Success criteria

1. A tied or coin-toss-decided playoff can no longer crown the wrong team; publish is reachable in every stage.
2. The five false strings (go-live URL, acceptance email, contact toggle, archive confirm, Results empty state) are all true.
3. The wizard hands Dana the field/diamond model and the fee decision before the checklist blocks on them.
4. The live dashboard shows the live game with a score; game-day surfaces live-update.
