# Account sheet on a phone — build prompt

**Status:** drawn and ruled 2026-11-01; built 2026-11-01 (all six parts); owner walk §441 complete 2026-11-01 ([walk](https://claude.ai/artifact/24JTb4uvhDmFJd3hce8wNM)). This file is the plan of record AND the build prompt (one session). One deliberate deviation: Part 4's `@media not all and (display-mode: standalone) and (max-width: 900px)` negates the whole query (it would hide the door on every desk), so the rule nests the two conditions instead; the guard pins it.
**Drawings (binding):** https://claude.ai/artifact/ScXydWMxExZ2kGfJF8mH5C (source `docs/projects/active/ACCOUNT_SHEET_PHONE_DRAWINGS.html`, v3). Build to them; any deviation is an owner question, not a judgment call.
**Rulings:** the owner answered "looks good, go ahead" to the five asks on the Asks tab, read as **all five as recommended** (A1 A, A2 A, A3 A, A4 A, A5 A). If the owner meant otherwise they will say so; do not reopen them.

---

## PM brief (plain language)

**What the person sees and does differently.** On a phone, tapping the person icon on a public page no longer opens a small floating menu. It opens a sheet from the bottom, like the app's other phone sheets. The sheet shows who is signed in, then a **Go to** block with the way to their own side (Admin, Coach, Scorekeeper), then Notification settings, Send feedback, Account settings and Sign out. The separate building icon beside the person icon is gone on phones; its job lives in the sheet, named in words.

**Why it matters.** The floating menu is as wide as the signed-in address (about 380 px) and hangs from the icon's right edge, so on a 390 px phone it runs off the left of the screen. The building icon never said where it went, and with three icons in the band the event name wraps and its dates are cut to "Dec 4…". After: two icons, the name column goes from 162 px to 210 px at 390 px, and the dates read whole.

**Who is affected.** Four bars: the tournament page band, the club's public bar, the marketing bar, the support console. Only the first two have the building door. Fans and signed-out visitors see no difference (a fan has no door; "Sign in" stays a word). Desk widths (901 px and up) are untouched.

**The cost, accepted by the owner (Ask 5).** Going to your own side from a public page becomes two taps (open the sheet, tap the row) instead of one. Admin, coach and scorekeeper screens keep their corner icon, so the way back to the public side is still one tap.

**Success.** Open the sheet on a 390 px phone from each of the four bars; nothing runs off-screen; the dates show whole on the tournament band; an operator reaches their side in two taps; a fan sees an unchanged band; the installed app and every desk width are unchanged.

---

## Blocking gate (before any code)

1. Present the owner a plain-language UX summary (the PM brief above is the source). AGENCY_RULES makes this a blocking step.
2. The mockup gate is met: the drawings above are binding. Do not redraw.
3. Re-read `memory/design_decisions.md` entries 2026-07-22 ("The Flip RATIFIED"), 2026-10-18 (pick-one pill opens the phone sheet), 2026-10-20 (the side door's icon names where it goes) before touching the door. This build **amends the 07-22 "one corner door on every surface" rule on two public phone bars only**; say so in the design-log entry you write at the end.

## What to build

### Part 1 — plumbing
1. **Share the door's row logic.** `components/shared/FlipPill.tsx` owns how a `FlipResolution` becomes destinations: the single-target return-memory (a fresh remembered origin becomes the one row, labelled by destination, never "Back to"), the multi chooser (same named rows every time, return memory ignored — ruling 2026-07-28), and `stampReturn` on click. Extract that into one hook or helper that both FlipPill and the sheet call. Do **not** copy the logic: two copies drift, and the return-memory rules are subtle. FlipPill's own look and behaviour must not change.
2. **Let the shared bottom sheet attach somewhere other than the body.** `components/admin/BottomSheet.tsx` portals into `[data-public-frame="light"]` when present, else `document.body`. The marketing bar and the support console are not inside a light frame, and their colours (`--home-*`, the warm set) are scoped to their own elements, so a sheet on `<body>` would paint in the dark HUD colours. Add one optional prop (for example `portalTo`) so a host can name the element the sheet attaches inside. Default behaviour, and the other five users of the sheet (check-in board, Teams view settings, reschedule sheet, the two follow sheets), must be byte-identical. **This is the one real unknown in the build:** measure on each of the four hosts that the sheet's colours are right and that `position: fixed` still covers the screen (an ancestor with a transform, filter or backdrop-filter breaks fixed positioning). If attaching inside a bar's element does not work for one host, stop and tell the owner; do not invent a fifth skin.
3. Use the existing `useIsPhoneNav` (`lib/hooks/useIsPhoneNav.ts`, live ≤900 px, `useSyncExternalStore`). Do not write a new media-query hook and do not use `useIsPhone` (that is ≤640).

### Part 2 — `components/shared/AccountMenu.tsx`
- At ≤900 px the trigger opens the shared bottom sheet; above it the popover is exactly as today.
- Decide popover vs sheet from the live hook, so rotating or resizing while open swaps cleanly.
- New optional prop for the door (a `FlipResolution | null`). Absent or null means no "Go to" block, no empty caption.
- **Sheet content, in order (Asks 1–3):** head = "Account" with the signed-in address under it; the "Go to" block (caption "Go to", rows labelled by the target's own label, building icon, sublabel only where the target carries one); the club's "My teams" rows (existing `teams` prop) after Go to; the Appearance Warm/Dark control when `showTheme`; Notification settings, Send feedback, Account settings (each still honouring `showAccount` and `showFeedback`); a separator; Sign out in the danger colour.
- Rows are 48 px tall, the × is the sheet's own 44 px plain glyph. The Appearance control is a full-width two-option track 44 px tall (the drawing; the popover's strip is smaller and stays so on desk).
- Row content is the popover's own copy, unchanged: "Notification settings", "Send feedback", "Account settings", "Sign out", "Signing out…", "My team" / "My teams". Do not reword.
- The signed-in address: data face, 12 px, `overflow-wrap: anywhere` (the sheet's subtitle has no wrap rule; add it in AccountMenu's own CSS on a span inside the subtitle, not in the shared sheet). Still resolved lazily on open as today (`getSession`, never on mount); show "…" until it arrives.
- Closing: tap the dim, ×, Esc (the shared sheet provides these), any row tap, and **any route change** (keep the existing `lastPath` render-time pattern). Return focus to the trigger when it closes.
- **The feedback window outlives the sheet.** `FeedbackWidget` stays mounted in the menu's wrapper, outside the sheet, and the "Send feedback" row closes the sheet then opens it (as the popover row does).
- **Accessibility:** on phone the trigger is `aria-haspopup="dialog"` (the sheet is a dialog); on desk it stays `"menu"`. Rows inside the sheet are plain links/buttons, **not** `role="menuitem"` (menuitems must sit in a menu). Destination rows are real links (`next/link`), so a modified-click still works.
- Sign out keeps its behaviour (`signOutTo`: here → reload, sign-in → `/auth/login`, platform → console login), full navigation.

### Part 3 — the four hosts
| Host | What changes |
|---|---|
| `components/public/TournamentBand.tsx` | Resolve the door **once** (`usePublicFlip`), in one small child rendered only when `!inSandbox && !preview` (never in the focused or preview band: those ask nobody who they are). Pass the resolution to both `AccountMenu` and the existing door. `TournamentFlipPill` gains an optional `resolution` prop so the Navbar's older event header, which also mounts it, keeps working untouched. Two `usePublicFlip` calls would double the identity fetch; do not. |
| `components/public/ClubBar.tsx` | Pass the existing `door` to `AccountMenu`, alongside `teams`. A club staff member who also coaches gets Go to first, then My teams. |
| `components/Navbar.tsx` (marketing bar) | Sheet, no door. Delete the ≤900 px re-anchoring workaround in `Navbar.module.css` (`.marketingActions .marketingAccount { position: static }`), which existed only because the popover clipped at 320 px. Keep the ≤375 px "label becomes a person icon" trigger rule. |
| `app/platform-admin/PlatformShell.tsx` (support console) | Sheet, no door, with Appearance, without the settings and feedback rows (existing `showAccount={false}`, `showFeedback={false}`). |

**Do not touch** the Coaches Portal, club/tournament admin, or consumer-app bars. Their top strip is hidden at ≤900 px and Account is a bottom-bar tab on a phone, by an existing ruling (a tab marks where you are). Also untouched: scorekeeper and check-in (their own account sheet and event-specific door), and the Navbar's older event header (door only, no account icon).

### Part 4 — hiding the door on a phone (two traps, both easy to get wrong)
- **Hide the door only where the sheet carries it.** In the tournament band, the demo sandbox shows no account menu but does render the door; hide the door at ≤900 px **only when the account menu is mounted** (`!inSandbox && !preview`, which is also the only time there is a signed-in hat-holder to show it to). In the club bar, a demo club shows no account menu (`isDemoOrgSlug`); hide the door only when the menu is mounted.
- **The installed app on a phone must keep the door.** The tournament band's account trigger lives in `.browserOnly`, which is `display: none` under `display-mode: standalone` at every width, while the door's own standalone rule hides it only at ≥901 px. So the ≤900 hide must be `@media not all and (display-mode: standalone) and (max-width: 900px)`. Without the `not all and (display-mode: standalone)` an installed-app operator loses the door entirely (no icon, and no account menu to carry it). The club bar has no standalone rule at all, so its rule is plain ≤900 px.
- Use a class on the door's wrapper, in the host's own stylesheet. Do not hide it with a global selector and do not touch `FlipPill.module.css`'s icon-only rule (`≤900`), which other bars rely on.

### Part 5 — tests
- New guard `tests/unit/account-sheet-phone-guard.test.ts` (source-level, the repo's usual shape): AccountMenu uses `useIsPhoneNav` and the shared sheet; the two door-hiding rules exist with the standalone exception on the tournament band; neither host hides the door without mounting the menu; the sheet rows are links, not `role="menuitem"`; Navbar's re-anchoring rule is gone.
- Run the existing guards that touch the menu or the door: `tests/unit/club-frame-guard.test.ts`, `tests/unit/platform-admin-stage1-guard.test.ts`, plus whatever `grep -l FlipPill tests` finds. Fix real failures; do not loosen a guard.
- A component test for the extracted door-rows logic: single, single with a fresh return memory, multi (memory ignored), none.
- `npm run verify:changed`, then `npm run typecheck` (a shared component changed). `npm run check:spelling` is part of verify; "Go to" and the row labels use the product's existing spellings.

### Part 6 — docs and records
- Update `docs/agents/design/` or the design log only as below; no schema change, so no data-dictionary work.
- Append **one** entry to `memory/design_decisions.md` (newest first, the file's format): the sheet on a phone at ≤900 px, the door's move into it, the two-tap cost accepted, and the explicit amendment of the 2026-07-22 corner-door rule on two public phone bars. Record only what the owner ruled.
- Check help content for any article that describes the account menu or the building icon on a phone (`lib/help-content/*.tsx`, including `keywords`/`searchText`); offer `/docs` per the repo rule.
- One line in `TODO.md` (already added) points here; tick it when the walk passes.

## Verification (the owner does browser checks)
Do not run a whole-product layout sweep on the dev server. Run `npm run check:layout -- --changed` only on the few screens touched (a tournament page and a club home at 390 px). Restart the dev server before hand-off: a shared module changed (`AccountMenu`, `BottomSheet`) and files were added. Then offer `/simplify` (a shared hook was extracted, which is new abstraction), then `/review`, then `/docs`.

Write the owner's walk as a checkable Artifact (paste-back, one purpose: the account sheet), numbered with the next free section in `docs/projects/active/OWNER_QA_LEDGER.md` (never re-sort existing numbers). Cover, at 390 px unless stated:
1. Tournament page, signed in as an operator: person icon opens the sheet; Go to shows the right row(s); the building icon is gone; the dates show whole; the row lands on the matching admin screen; two roles show two rows.
2. The same page as a fan with an account: sheet has no Go to block; the band is unchanged.
3. Signed out: "Sign in" is a word, nothing changed.
4. Club public bar: staff gets Go to, then My teams; a coach of two teams gets My teams; one team shows "My team"; the building icon is gone.
5. Marketing bar at 320 px and 390 px: sheet fits, no Go to, right colours.
6. Support console: Appearance works at 44 px, no settings or feedback rows, Sign out lands on the console's sign-in.
7. Close paths: tap outside, ×, Esc, a row, browser Back; the page behind does not scroll while open and scrolls after.
8. Send feedback opens its window after the sheet closes.
9. Installed app on a phone (standalone): the tournament band still shows its door; nothing else changed.
10. 900 px and 901 px: the swap happens at exactly that edge; a desk shows the popover and the labelled door as today.
11. The demo sandbox: no account menu, the door still there on a tournament page, nothing broken.
12. Dark phone settings: the club frame and warm bars keep their own colours.

## Out of scope — do not do on the way past
- No drag-to-close on the sheet (the shared sheet's grab line is a mark only; changing it changes five other users).
- No change to the bottom-bar Account tab on the coach, admin or consumer phones.
- Do not move Share into the sheet (Ask 4 A) and do not remove the door on admin, coach or scorekeeper screens.
- No new colour or type tokens. If the sheet needs one, that is a design-system extension to flag, not to add.
- No commit unless the owner asks. The working tree is shared with other sessions and already holds their uncommitted files: stage explicit paths only, never `git add -A`, and confirm with `git show --stat HEAD` afterwards.
