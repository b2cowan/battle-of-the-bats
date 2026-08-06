# Club Shared Book — PM Brief

**One-liner:** teams in the same club can choose to share their opponent scouting books
with each other — so the 12U A coach's read on Oakville Thunder is already there when the
12U B team draws Thunder next weekend.

**Status:** Proposed (scoped 2026-08-04). Waiting on five owner rulings (plan §8) — most
importantly who flips the switches, and whether this is the Club plan's headline
coaches-portal exclusive. Plan: `COACH_CLUB_SHARED_BOOK_PLAN.md`.

## What a coach sees and does differently

- A head coach gets one new switch: **"Share our book with the club."** Plain-language
  copy explains exactly what becomes visible (their book line and observations, with names
  attached) and that they can stop any time.
- On an opted-in team, an opponent's page grows a **"From your club"** section: each
  sibling team's record against that opponent, their one-sentence book line, and their
  recent observations — clearly labelled ("— Coach Dana · 12U A"), read-only.
- On a game's Scouting tab, one quiet line: *"Your club has 5 more observations on
  Thunder ›"* — a tap away, never in the way.
- Nothing about writing changes. Every coach still keeps their own book, curates their own
  observations, and can't touch — or be touched by — another team's.

## Why it matters

- **It compounds the book's value with club size.** A solo team's book grows one game at a
  time; a six-team club's collective book grows six times faster, and every new coach in
  the club inherits it on day one. No competitor's notes app can do this because no notes
  app knows the club exists.
- **It's the cleanest Club-plan story the coaches portal has** (if gated there — owner
  call): "your club's collective scouting memory" is a sentence a club president
  understands instantly, and it's an upgrade reason that gets *stronger* every season the
  club uses the platform.
- **It costs coaches nothing.** No new capture, no new habit — it's a read-time layer over
  books that already exist.

## Customer impact / risks

- Trust is the design constraint: sharing is opt-in per team, labelled everywhere,
  revocable instantly, and never crosses the club's walls. A coach's candid notes never go
  club-visible by surprise.
- The "numbers, not names" house rule matters more once notes travel — the switch copy and
  guide say so.
- Sharing exposes opponent scouting only — never rosters, families, or money.

## Priority & sequencing

After Game-Day Mode P1 (in flight). Small build (one phase) once the rulings land; needs
a mockup round and, if Club-gated, a `/strategy` log + pricing-facts update first.

## Success criteria

- In a two-team test club: both teams opted in see each other's content labelled
  correctly; opting out hides a team's content immediately; a non-opted team and a
  Team-plan org see nothing anywhere.
- Owner QA passes the cross-org leakage check (the non-negotiable): no path shows any
  book content across organization lines.
- Post-launch signal worth watching: share of multi-team orgs with ≥2 teams opted in.
