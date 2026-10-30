# Census: every place a family acts or is identified without a sign-in (prompt)

> **Written 2026-10-29. PARKED until the weekly usage refreshes** (the weekend of 2026-11-01, the same window as the other parked
> TODO item). **Paste this into a new chat on `dev`.** Read-only: no code, migration, seed or doc change except the one report
> named below. Other sessions share this working copy: stage explicit paths only; commit only when the owner says.

## Why

On 2026-10-29 the owner set the end state: a mobile app where **everyone signs in**, with only tournaments and team public pages
public (memory: `project_end_state_signed_in_family_app.md`). Anything built or planned that lets a family act, or be recognised,
**without a sign-in** is either a public page that stays, a screen that becomes part of the signed-in app, or a stop-gap that would
be reversed. The owner wants to find the third kind **before** building more of them. This census finds them. It decides nothing.

## What counts as a "no-login family door"

Any place a parent, guardian or player can **read private information, act, pay, sign or be identified** without an account:
- A link in an email that carries a secret (a token), for example a placement or claim link, an offer or acceptance link, a pay link,
  a waiver link, a calendar link, an unsubscribe link.
- A public form a family fills in (sign-up, tryout registration, a waiver, a request) where the family has no account afterwards.
- A "family" screen reached by a token rather than a sign-in.
- A planned stage or drawing that adds one. Read the plans as well as the code: Stage 9 (house league), Stage 12 (families pay
  online), Stage 14 (one player across seasons), tryouts, the Families book, the rep family view, 9d-3 (already withdrawn).

**Not a door:** a public tournament page or a public team page (these stay public), and a staff or coach screen behind a sign-in.

## How to run it

Broad searching goes to helper agents (`Explore`, in parallel), one per area: (1) emails and their links (`lib/*email*`,
`lib/email.ts`, the family, placement and notice mailers), (2) tokens (`lib/no-login-token.ts` and everything that uses it, every
`*_token_hash` column in `docs/agents/db/schema-snapshots`), (3) public forms and routes outside `/admin` and `/coaches`, (4) the
plans and drawings. **A helper's summary is a lead, not evidence: open every cited line yourself** before it goes in the report.
Decide from the code, not from what a plan claims.

## What to produce

One file, `docs/projects/active/SIGNED_IN_FAMILY_CENSUS.md`, a table with one row per door:
**Door · who uses it · what it lets them see or do · how it is secured · built, planned or drawn · where (path and line) · verdict.**
The verdict is exactly one of: **Stays public** · **Becomes signed-in (app)** · **Stop-gap, retire** · **Undecided, needs the
owner**. Then:
- A short paragraph on **where the rework risk is concentrated** (the doors that hold the most family behaviour or data).
- The doors that hold **a child's information**, flagged separately: these are the ones counsel will care about.
- Anything the **Stage 14 child record** would have to anchor for a parent-to-child link to survive a season.
- A line in `TODO.md` pointing at the report when it is done. **Report only: do not change shared automation, hooks or settings.**

## Definition of done

The report exists, every row has a verified path, nothing is marked "retire" without the code or plan line that shows why, and the
undecided rows are written as questions the owner can answer in one line each.
