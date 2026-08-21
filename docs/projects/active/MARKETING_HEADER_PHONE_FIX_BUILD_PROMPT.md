# Build prompt — the marketing header clips "Get Started" on most phones (QA §68)

Paste into a **fresh session**. This is deliberately standalone: it needs no pitch-library context
and shares no files with the two projects running alongside it.

## The defect, already measured

The site's shared marketing top bar **does not respond to width at all.** "Get Started" sits at the
same fixed position on every screen, so below 390px it runs off the right edge — and the page does
not scroll sideways, so **there is no way to reach it.**

| Screen | "Get Started" |
|---|---|
| 390px — iPhone 12–15 | fits, **by 4 pixels** |
| 375px — iPhone SE 2/3, 6/7/8 | clipped 11px |
| 360px — most Android | clipped 26px |
| 320px — iPhone SE 1st gen | clipped 66px |

**Every marketing page carries it** — homepage, all four persona pages, pricing, `/demos`, both
walkthroughs. On a common Android a fifth of the site's primary call to action is silently
unreachable. Full writeup: `docs/projects/active/OWNER_QA_LEDGER.md` §68.

⚠ **It predates the slide library and is unrelated to it.** Do not let a pitch-slide file into this
diff.

## Why it survived, and the question that matters more than the fix

`npm run check:layout` renders **28 coach-portal screens and not one marketing page.** The marketing
site is the only public surface with no layout gate at all — and at 390px, the width everyone tests
at, this clears by four pixels. That is why a defect on every public page lived through a launch.

⚠⚠ **So the real deliverable is arguably the gate, not the button.** The owner has an open ruling to
make (§68, last line): *should the marketing pages join the automated rendered check?* Put that in
front of him early rather than fixing the button and moving on — a second header defect will
otherwise be found the same way, by a person, months later.

## Scope

1. **Fix the bar** so "Get Started" and "Sign In" are both fully visible and tappable at 320px and
   up. ⚠ It is SHARED CHROME: the blast radius is every marketing page at once, including desktop.
2. **Raise the gate question** with the owner and, if he says yes, add the marketing pages to the
   rendered layout check.

## Hard rules

- **This is a phone layout problem, so measure it rather than eyeballing it.** Read computed
  positions with Playwright at 320/360/375/390px on the homepage, `/pricing`, `/for-coaches`,
  `/for-clubs`, `/demos` and both walkthroughs — before and after. A screenshot at one width is how
  this shipped in the first place.
- **Nothing may scroll sideways** at any of those widths. That is half the defect: the button is not
  merely off-screen, it is unreachable.
- ⚠ **44px tap floor.** The coach portal has standing touch-target debt (TODO.md); do not add more
  to the marketing side. If the fix shrinks the button, check the tap target, not just the label.
- Read `AGENTS.md` before writing code — this is not the Next.js in your training data.
- **Do not restart the shared dev server casually**; other sessions are using it.

## Wire up

Owner QA row (extend §68's existing walk rather than opening a new number) · `TODO.md` pointer ·
memory if the gate changes. Then `/simplify` → `/review` → `npm run verify:changed`.

⚠ **Schema parity is RED with pre-existing dev-only drift from other sessions** — confirm it is not
yours, then run the post-parity checks individually. `npx next typegen` before `npm run typecheck`.

## Commit

Explicit pathspecs only. **⚠ Several sessions are working in this tree** — check `git status` before
staging and **filter foreign hunks out of shared documents** (`TODO.md`, the QA ledger,
`memory/MEMORY.md`) rather than sweeping another session's work in. `git show --stat HEAD` after.
Commit only on explicit owner OK.
