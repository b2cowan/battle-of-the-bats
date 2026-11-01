# Retire the old tournament-only menu and the duplicate tournaments-list address

**Status:** NOTE ONLY — nothing built. Opened 2026-10-30 (owner, during the Plan & billing Stage 3 walk, step 2).
**Why this exists:** the owner ruled the account-level menu ("Tournaments" row + "Account" group: Staff & access,
Audit log, Settings, PDF settings) is **an old nav the product no longer navigates to**, and asked for it to be
retired so nobody builds a link to it again.

## What happened (the mistake this note prevents)

The Stage 3 "Tournaments you run" door, and the older "host a tournament" buttons in the coaches portal, pointed at
`/{org}/admin/org/tournaments`. That address renders the same page as `/{org}/admin/tournaments/manage`
(`tournaments/manage/page.tsx` re-exports it), but the menu decides "am I inside the tournaments area?" from the
address starting with `/admin/tournaments`. So the duplicate address fell through to the old account-level menu
instead of the tournament menu (Operations / Setup / Admin). Fixed 2026-10-30: all three coach doors now use
`/admin/tournaments/manage`; the unit tests and the coach-wall-doors UAT scenario were moved with them.

## Two pieces of debt

1. **The duplicate address `/admin/org/tournaments`.** Make `/admin/tournaments/manage` the page's real home, turn
   the old address into a redirect (keeping `?create=1` and `source=`), and update the places that still name the
   old path: the page's own header comment, the layout-sweep screen list, the old-look and public-token checks that
   list the page's folder, and the two tests that read the page file by path.
2. **The account-level menu for a tournament-only workspace** (the `tournamentOnly` branch of the desktop rail and
   its phone-bar counterpart). Retire it once nothing lands on it.

## First step when this is picked up — a census, not a build

Find every page that still renders under the account-level menu for a tournament-only or standalone-team
workspace. Suspects (unverified): the Admin hub, `/admin/org` and its Staff & access, Audit log, Settings and PDF
settings pages, and billing. Each needs a home inside the tournament menu (or the coaches portal) **before** the
old menu can go. Do not delete the menu first: that would strand whichever of those pages turns out to depend on it.

## Rules until it is retired

- Never link to `/admin/org/tournaments`; use `/admin/tournaments/manage`.
- Check where a new door lands in a **browser** (the menu on arrival), not only that the page loads.

## Done when

- One address for the tournaments list; the old one redirects.
- No page renders the account-level tournament-only menu; its code and its phone counterpart are deleted.
- A build-time guard fails if a link to the old address is added.
