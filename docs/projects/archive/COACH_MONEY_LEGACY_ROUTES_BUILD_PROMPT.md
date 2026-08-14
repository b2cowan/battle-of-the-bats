# Kickoff prompt — the Money hub's old one-way doors are still standing (paste into a fresh chat)

The coach portal's seven Money screens were unified into **one tabbed hub** (commit `95068bce`, "Money
becomes one tabbed hub — the seven screens stop being one-way doors"). The tabs work. **The seven
standalone pages they replaced were never removed, still resolve, and are still linked to from at
least six places** — including the public demo's own guided tour.

A coach who follows one of those links lands on a Money screen **with no tab bar**: the hub's
navigation is simply absent, and the only way back is the browser button or a lone "← Back to Money"
link. They have been dropped out of the hub without being told.

## The trigger, in the owner's words

Owner, 2026-08-13, after generating dues and following the sheet's own success link:

> *"After setting the dues and clicking 'view player dues' it brings me to this page that does not
> have the header links, this is incorrect. Do we have any other navigation to these old pages? The
> links and old pages need to be removed, this is not a good UX."*

The link that triggered it is already fixed. **Everything below is what that one fix revealed.**

## The inventory (taken 2026-08-13 — verify before trusting)

### The legacy pages, all still routable

Under `app/[orgSlug]/coaches/teams/[teamId]/accounting/`:

| Page | Hub equivalent |
|---|---|
| `budget/page.tsx` | `?section=budget` |
| `dues/page.tsx` | `?section=dues` |
| `fundraisers/page.tsx` | `?section=fundraisers` |
| `expenses/page.tsx` | `?section=expenses` |
| `allocations/page.tsx` | `?section=allocations` |
| `payment-requests/page.tsx` | `?section=payment-requests` |
| `budget-vs-actual/page.tsx` | `?section=budget-vs-actual` |

⚠ **`fundraisers/[fundraiserId]/page.tsx` is NOT one of these.** A single fundraiser's detail screen
is a genuine sub-page with no hub tab of its own — it stays. Only its *back link* is in scope.

⚠ Each tab's `panel.tsx` is the real UI and is shared by the hub. Only the thin `page.tsx` route
shells are candidates for removal — deleting a panel would delete the feature.

### Coach-side links still pointing at them

| Where | Points at |
|---|---|
| `teams/[teamId]/page.tsx:1237` — team Overview | `/accounting/budget-vs-actual` |
| `roster/[playerId]/page.tsx:726` — "Manage dues →" | `/accounting/dues` |
| `components/coaches/MoneyMonthGrid.tsx:112` | `/accounting/expenses` and `?tab=schedule` |
| `accounting/fundraisers/[fundraiserId]/page.tsx:240` — back link | `/accounting/fundraisers` |
| `lib/sandbox-chrome.ts:157` — **demo moments dock** | `/accounting/budget-vs-actual` |
| `lib/sandbox-chrome.ts:509` — **demo guided tour** | `/accounting/budget-vs-actual` |

**The last two are the sharpest.** They are the public sandbox's own narration, so a prospect on a
guided tour is walked onto a page the product no longer navigates by. That is precisely the
demo-drift `CLAUDE.md` warns about, and no automated check can catch it.

⚠ `lib/export/catalog.ts` mentions these paths as **documentation strings**, not links. Leave them
unless the file they name moves.

⚠ The hub already publishes one canonical destination map (`moneyHrefs` in `accounting/page.tsx`,
built from `sectionHref`). Its own comment says every Money link should come from there "and nowhere
else; a second hand-built `sectionHref(...)` beside a consumer is how the two fall out of step."
**Consider whether that map should be exported and reused rather than each caller re-building a
query string** — the fix that triggered this work was exactly such a hand-built string sitting one
line below a correct one.

## The work

**Phase A — confirm the inventory**, and extend it. The lists above were gathered by grep and are a
starting point, not gospel. Search for the string forms the above may have missed (template literals
split across lines, `router.push`, redirects, help content, tour steps, seeders, tests, docs).

**Phase B — decide what "removed" means, and get it ruled on.** Two options, and they are not
equivalent:
- **Delete the route shells.** Cleanest, but every existing bookmark, every link a coach emailed
  themselves, and anything in the wild 404s.
- **Replace each with a redirect to its hub tab.** Old links keep working and land somewhere correct;
  costs seven tiny files that must not rot.

Present both with a recommendation. **This is the owner's call, not yours.**

**Phase C — repoint every link, then apply Phase B's ruling.** The demo's tour and moments dock are
part of this unit of work, not a follow-up.

## The traps, stated so you don't rediscover them

- ⚠ **Deleting a `page.tsx` does not delete its `panel.tsx`** — and must not. The hub imports the
  panels directly.
- ⚠ **The hub keeps every visited panel MOUNTED** (`display:none`) and its section is a query
  parameter, not a path. A link that used to be a page navigation becomes a same-page state change;
  check that anything relying on a fresh mount (a form, a fetch-on-mount) still behaves.
- ⚠ **Query keys collide.** The hub uses `?section=`; the Expenses panel already owns `?tab=`, and
  Budget Plan uses `?generate=1` / `?starter=1`. `sectionHref` deliberately drops stale extras — read
  its comment before hand-building any URL.
- ⚠ **The rendered layout sweep is the only gate that sees this class of defect.** Run it sliced
  (`--only=coach-accounting,coach-budget,coach-dues`), **on a freshly restarted dev server**. It
  widens to all 28 screens whenever a shared stylesheet is dirty, and an aborted sweep **exits 0
  through a pipe — read the output, never the exit code.**
- ⚠ **`npm run check:demos` proves the demo world is intact; it cannot tell you the tour is pointing
  somewhere the product abandoned.** That judgement is why the demo links are called out above.
- ⚠ **Money panels must not remount** on a tab switch — a half-filled form surviving is deliberate.

## House rules that have bitten this repo before

- Branch `dev`. Stage **explicit pathspecs** — never `git add -A`; bracketed dirs need
  `":(literal)app/[orgSlug]/…"`. Commit only on explicit owner OK. After every commit run
  `git show --stat HEAD` — **this working copy is shared with other agents and currently holds
  substantial unrelated in-flight work**, including an active project rewriting shared dues code.
- **Never `Get-Content | Set-Content` a source file** (ANSI mojibake). Use the Edit tool.
- Deleting files ⇒ **restart the dev server before handoff**: stop it, delete `.next`, `npm run dev`,
  wait for Ready.
- After the build: `/simplify`, then `/review`, then `npm run typecheck` + `npm test` +
  `npm run verify:changed`. ⚠ `verify:changed` fails on **schema parity** (prod behind dev) —
  pre-existing, not yours.
- **`/docs`** — the in-app Money guide may name these screens or describe navigating between them.
- **Plan + PM brief pair required** if this grows beyond a mechanical sweep; otherwise a TODO line
  and the owner-QA ledger entry are enough.

## Before you write code

1. **Show the confirmed inventory** (Phase A) — every link and every page, with what each becomes.
2. **Put the delete-vs-redirect choice to the owner** (Phase B) before touching a route file.
3. Then the plain-language UX summary `AGENCY_RULES.md` requires.

## Scope discipline

**The coach team Money hub only.** The org-side admin accounting area
(`app/[orgSlug]/admin/accounting/…`) has a similar shape and is **out of scope** — it was never
unified into a hub, so its standalone pages are correct. Note anything you see there; change nothing.
