# Top Nav Consistency Audit — PM Brief (2026-08-01)

**What this was:** the audit you asked for after spotting the header differences yourself — every
top bar on every surface, measured (not eyeballed), judged surface by surface: drift or design?
Findings doc: `TOP_NAV_CONSISTENCY_FINDINGS.md`. Nothing was changed; this is the map before the
repairs.

## The one-paragraph answer

The navigation unification worked: crossing between the app, a tournament page, admin and the
coaches portal now feels like one product — same bar height, same doors in the same corners,
each place in its own skin, and the differences you'd notice (the taller branded club bar, the
centred club column) are the deliberate ones. What still doesn't feel like the same product is the
**marketing site** (its own height, its own tablet behavior — which is actually broken between
iPad-portrait and 900px — and it treats signed-in customers as strangers), and the **unhappy
paths**: two navigation links in the product can land a real person on a 404, and a coach who
loses access sees a black screen with no way out.

## The three things most worth fixing

1. **Links that lead to a dead page.** If an org turns off its public page (an ordinary settings
   checkbox), every one of its event pages still shows "‹Org name› ›" up top — and it 404s. The
   same missing check strands a coach on the "not assigned to any teams" screen, which has no
   navigation at all: no logo, no account, no sign-out, just one link that can itself be dead.
   Confirmed end-to-end. Cheap to fix (one shared rule), and it's the kind of break that makes the
   product feel untrustworthy exactly when someone is lost.
2. **The marketing seam.** On tablets between iPad-portrait and 900px the marketing pages show the
   same five links twice while the logo collides with the menu. And any signed-in customer who
   taps "Pricing" from inside the app lands on a page telling them to "Sign In" / "Get Started" —
   as if they'd been logged out. First impressions and upgrade moments both cross this seam.
3. **The new club-site tabs don't line up with the pages under them.** The section tabs we just
   shipped for League/Club orgs align perfectly with the club's name — but the League pages
   underneath centre themselves on a different, narrower column, ~250–300px off at laptop widths.
   It's the paying tier's newest surface, and it visibly doesn't sit on its own grid.

## Also found, needs a product call (not code)

- **Pricing is unreachable from a club's public pages on phones** — the phone header hides it on
  the theory the bottom bar covers it, but the bottom bar never carried it. Whether Pricing even
  belongs on a customer's branded page is a packaging question → `/strategy`.
- **One corner disagrees with the grammar:** on a club's public page, the operator's own door
  (Admin/Workspaces) sits *inside* Account instead of outermost like everywhere else — and the two
  written rules that should settle it have never been reconciled → `/design`, likely a one-line fix
  after the ruling.
- A handful of judged-deliberate-but-unwritten differences (day-of volunteer shells, the phone
  wordmark bar, the admin phone "Chat" door) each need one recorded sentence so the next pass
  doesn't "fix" them → `/design`.

## What was confirmed healthy

Bar heights, widths, door order, the chat/bell rules, the phone-only club frame, the tab-row tier
gate, and the anonymous-page guarantees — all measured or test-verified green (33/33 standing
guard checks). Two suspected problems were positively cleared as already-decided design (the
"Run a tournament" chrome shown to signed-in users, and the two page-spacing mechanisms).

## Housekeeping flagged along the way

The UAT coach test account currently has no team assignment, so coach test suites are likely
failing for environment reasons, not product ones. And a batch of stale internal notes/fallback
values still describe pre-unification chrome — harmless today, but they're exactly how removed
elements get re-added; a cheap sweep retires the risk.
