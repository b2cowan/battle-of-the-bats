# One Window — implementation plan

**Status:** all sixteen asks ruled as recommended 2026-10-18 (owner paste-back; hub version 1). Plan written
2026-10-18. Stage 1 width audit published 2026-10-18 (hub version 3); its five calls S1–S5 ruled as recommended the
same day. Stage 1 built 2026-10-18 (not committed; owner walk owed, hub QA tab).
**Hub (walk, proposal, rulings):** https://claude.ai/artifact/RDo1NhB9QmoMMKWCiADp48 · source
`docs/projects/active/ONE_WINDOW_HUB.html`
**PM brief:** `docs/projects/active/ONE_WINDOW_PM_BRIEF.md`
**Stage 1 build prompt:** `docs/projects/active/ONE_WINDOW_STAGE1_BUILD_PROMPT.md` (written 2026-10-18)
**Design log:** `memory/design_decisions.md`, entry "2026-10-18 — ONE WINDOW FOR THE WHOLE PRODUCT".
**Origin:** the Feedback window hub's F08 (https://claude.ai/artifact/6GmRQkQ6HgdCKKwEPMwGmU). That project builds
the feedback window on each portal's window, so it follows this one.

## 1. Problem

The admin's form window (`components/admin/kit/club/KitDialog.tsx`, built for Club Tier Stage 1 and adopted by the
tournament admin redesign) and the coaches portal's form window (`components/coaches/QuestionShell.tsx` over the
`.modal*` recipe in `app/[orgSlug]/coaches/coaches.module.css`) were built separately. The 2026-09-27 ruling put both
on the portal's `useDialogFloor`, which unified behaviour but not look. An older confirm (`components/FeedbackModal.tsx`
via `components/coaches/ConfirmProvider.tsx`) serves the coaches' asks, three tournament screens and thirteen club
notices. ⚠ It takes the COACH skin inside the admin, because `adminKitAttr` (`lib/admin-kit-marker.ts`) carries
`data-coach-warm-enabled` as well as `data-admin-kit`. House league and a few others were never moved onto either.

## 2. Census (2026-10-18, read from the code)

| Family | Club | Tournament | Coaches |
|---|---:|---:|---:|
| KitDialog `form` | 57 | 27 (8 record-style) | — |
| KitDialog `question` | 29 | 25 | — |
| QuestionShell | — | — | 32 |
| Hand-built `.modalOverlay` + `.modal` | — | — | ~44 (~17 without `useDialogFloor`) |
| FeedbackModal (via useConfirm or direct) | 13 (mostly notices) | 3 screens (~20 messages) | ~43 asks + 6 direct |
| House league bespoke modals | 17 | — | — |
| Global `.modal` / `.modal-overlay` | — | 4 | — |
| `window.confirm` | 3 | — | — |
| Other one-offs | LeagueCapUpgrade, 2 onboarding | NewRoomDialog | CloseSeason / StartNextSeason inline colours |

The admin has no `ConfirmProvider`; `useConfirm()` there would resolve true. Sheets (BottomSheet, SheetFrame), side
panels (Help, chat, plan) and menus are not windows here (Sheet Frame governs them).

## 3. Rulings (2026-10-18, all as recommended)

| # | Ruling |
|---|---|
| Q1 | Field labels are **sentence case everywhere a field is labelled** — windows and pages, both portals (ClubKit label: 12px, 650, secondary ink). |
| Q2 | Fields: paper tone (`--white-05`, which is `--home-paper` in Warm and a 5% white wash in Dark), 36px on a computer, 6px corners. |
| Q3 | Widths: 520 a form · 640 with side-by-side fields · 800 holding a table. |
| Q4 | 24px inside the window. |
| Q5 | The dimmed page is `--home-scrim` everywhere (not black at 60%). |
| Q6 | A tinted edge (`rgba(var(--blueprint-blue-rgb), .3)`), no shadow. |
| Q7 | No form closes on a stray tap; with something typed, ×, Cancel, the scrim or Back asks in the foot first (Keep writing / Discard). |
| Q8 | A sentence slot at the foot's left in every window (`footerStart`). |
| Q9 | A refusal line beside the button in every window (`.footReason`). |
| Q10 | 44px fields and foot buttons in every window on a phone, **measured** before and after (the 2026-08-19 rule). The windows' half of the owed tap-floor ruling only. |
| Q11 | One "are you sure" window: title, one sentence naming what happens, the answers; no icon, no ×. Three answers, a typed confirmation or a reason field use the same window. |
| Q12 | On a phone the question is a small centred card. |
| Q13 | Notices stop being windows: a bare Saved / Done → the save pill (`NoticePill`); news → the page notice (`PageNotice`, fades after 8s); an error stays until read. |
| Q14 | The strays join in stage 4. |
| Q15 | Rooms (`RoomShell`) and record windows (KitDialog `record` / `steps`) are out; they take the one window's fields and foot later. |
| Q16 | Coaches get their changes in the same release as the admin. |

## 4. Stages

### Stage 1 · One look
What changes on screen: every admin form and question takes the paper-tone fields, the narrower widths, 24px spacing
and the tinted edge; every labelled field in the coaches portal (pages included) takes sentence case; coach windows dim
the page in the themed tone.

- `KitDialog.module.css`: `.form` max-width 40rem → 32.5rem (520); a new medium size 40rem (640) for side-by-side
  fields; `wide` stays 50rem (800, "a form whose body is a table" — already its documented meaning). Head, body and
  foot side padding 1.25rem → 1.5rem. Panel border → `rgba(var(--blueprint-blue-rgb), .3)`; drop `--shadow-lg`. Scrim
  unchanged (`--home-scrim`). Question kind keeps 26rem.
- `ClubKit.module.css` fields: `.input/.select/.textarea` → `--white-05` fill, `--home-line-strong` border, 6px radius,
  36px min-height on a computer (44 at ≤768 stays). `.label` unchanged (already the ruled label).
- `coaches.module.css`: `.label` → sentence case (no uppercase, no tracking), 650, `--text-secondary`;
  `.modalOverlay` background → `var(--home-scrim)`.
- House league's `.label` (uppercase) and any other field-label class found in the build's census follow Q1.
- **Per-window width audit:** every KitDialog form caller is checked at 520; those with side-by-side fields take 640,
  those holding a table keep `wide`. The audit list goes in this plan when done.
- ⚠ The club kit's `.required` paints the asterisk red (`--home-live`), against the 2026-08-25 ruling (feedback hub
  F06). Bringing it in line belongs here; **confirm with the owner at stage start** (it touches page forms too).

#### Stage 1 width audit — ruled 2026-10-18 (calls S1–S5, all as recommended; hub "Stage 1 · widths")
- **S1** The twelve red `ck.required` stars go plain (`color: inherit`), like the ~71 `repKit.req` stars already were.
  Reach: Invite someone 3, Message a family 2, Settings 2, tournament Teams 3, Web address 1, a question's choices 1.
  The families' sign-up forms (`register.module.css`) and the platform console keep their own red star unless ruled.
- **S2** A short table that fits at 640 keeps 640 (not the rule's 800): Manage a member, Ask the coaches, Payees, a
  sent email, New tournament in steps.
- **S3** Two panes side by side keep 800 with no table: both schedule generators, Close the year.
- **S4** Record windows (`steps` / `record`, and the read-first pencil `edit`) keep today's width on every path they
  open from: `medium` (640), or `wide` where they are today. Their edge, spacing and fields change with the rest.
  Guarded: `tests/unit/one-window-stage1-guard.test.ts`.
- **S5** The rest as listed. Totals — club 58: 520 ×23, 640 ×20, 800 ×9, kept ×6 (the Families record, found in /review); tournament 32: 520 ×13, 640 ×8,
  800 ×2, kept ×9. The per-window list with reasons lives on the hub (`S1CLUB` / `S1TOUR` in the hub's script).
  - **640 (`medium`):** Add a team · Manage a member · Add a permit, and the permit's loading / failed frames · Start
    the next season · The first season · Add an applicant · Add venue · Ask the coaches · Add an entry · Transfer · An
    entry (editing and read-only) · Payees · Add a line, and a budget line's loading / not-found frames · A payment
    received · Confirm received / Approve and pay · New message / Edit post · A sent email · Add division · Add game ·
    Rain delay · Import teams / games · New tournament from a past one · New tournament in steps.
  - **800 (`wide`):** Words your teams use (grows: its 620px table scrolled sideways at 640) · Close the year · New
    allocation · An allocation and its frames · New schedule · A bill (both) · Round-robin and playoff generators.
  - **Kept (records, `medium` unless already `wide`):** a permit, a venue (club and tournament), a team's bill, a budget
    line, the fiscal year, a game, a division (and New tournament's), a team, a link or file, a section, a question, a
    tournament.
  - **520:** every other form window (one column).
- **Found on the way.** Nothing reacts to a window's own width (every two-across row collapses by viewport), which is
  why side-by-side forms must say `medium`. Words your teams use carries its page spacing into the window (~56px and a
  rule above its first sentence): drawn as built, not changed. Seven fields have rules of their own; in the build only
  the web address box drew its own colour and corners, and it now takes the kit field (paper, 36px, 6px; 44 at ≤768).
  The other six already wear `ck.input` / `ck.select` and only size it (the rain delay note, Import's toolbar select,
  `shareInput`, `countInput`, the tie-breaker cap, a hint styled as a label), so they took the paper tone with it.

#### Stage 1 — as built 2026-10-18
- **After /simplify and /review (same day):** the width is ONE prop, `size?: 'medium' | 'wide'` (the `wide` boolean
  retired with it, ~54 callers; BillRoom `size={wide ? 'wide' : 'medium'}`); the label recipe lives once, in
  `components/shared/FieldLabel.module.css`, composed by every single-class label (ClubKit, coaches, rep-teams, house
  league, onboarding, branding, bracket Home / Away, the handout's next step, the public site editor; the practice
  `.ppFieldLabel` composes it DIRECTLY — `composes` is not transitive under Turbopack); child-selector / `legend` /
  global labels and the coach budget's `.label` (re-inked by `.labelBad`) restate it. /review caught the Families
  record window, whose props come from a spread `shell` (`wide: true`, missed by the census and the guard): now
  `size: 'wide'`, and the S4 guard reads spread objects. Also brought to the 36px field: the permit window's multi-pick
  button, its remove ✕, and RepKit's read-only value box; the club toolbar select keeps the card fill (a toolbar
  control, not a form field); the aside's reserve and the save pill follow the 24px. Three more Title Case labels fixed
  (Contact email, Category & item, Period breakdown); the guard now fails on any Title Case label in either portal.
  Shared test helpers `filesUnder` / `openingTags` / `parseProps` in `tests/unit/_source-code.ts`.
- **Open, for the owner:** two flows widen on a click, as the ruled list has them — a payment request (520) → Approve
  (640) in place, and New tournament's chooser (520) → its create or reuse step (640).
- `KitDialog`: `.form` 32.5rem; `size` prop (`medium` 40rem, `wide` 50rem); `--kit-dialog-side` 1.5rem on a computer and
  the 1.25rem it had at ≤640 (a phone form already fills the screen; the ruled drawing does not widen it); `.progress`
  shares the variable; tinted edge, no shadow on the panel and on the `aside` preview card.
- `ClubKit` fields: `--white-05`, `--home-line-strong`, 6px, 36px (44 at ≤768 kept); `.required` plain.
- Coaches: `.label` sentence case (650, secondary); `.modalOverlay` `var(--home-scrim, rgba(0,0,0,0.6))` (the
  fallback covers a missing theme attribute, where the token is undefined).
- **Q1 label census — changed:** house league `.label` (its kit layer folded into the base rule), rep-teams `.label`,
  branding `.label`, onboarding `.fieldLabel`, the bracket editor's Home / Away (`.teamLabel`, folded; column 35px →
  2.5rem), the admin `.form-label` re-skin (PDF settings), coaches `.ppFieldLabel`, `.lineupControlLabel > span`,
  `.gdMomentTag > span`, the development handout's legend and next step. **Copy:** 45 field labels written in Title Case
  in those classes were rewritten to sentence case (House league 23, team rename 1, coaches portal 21), plus one help
  answer that quoted "Best Position". Labels whose words come from a constant were not swept (the walk checks them).
- **Q1 census — left, with the reason:** the award window's field headings (`.formSectionTitle`, shared with twelve
  real section headings; the window moves in Stage 2); the bill room's facts (`.commitFields dt`, a room — Q15); chat's
  New room (paused; Stage 4); the feedback window (its own project); `TournamentAdminUI` `.label` (never rendered); the
  mock billing portal (a stand-in for Stripe's page); branding's Dark / Light group heading; every section label, table
  heading, eyebrow and stat caption; and outside the two portals — sign-in, sign-up, public registration, marketing,
  the platform console.

### Stage 2 · One behaviour
What changes on screen: coach forms stop closing on a stray tap, gain the foot sentence and refusal line, and get 44px
fields and foot buttons on a phone.

- `KitDialog` becomes the one window piece for both portals; its admin-only convention ends (a guard says so).
- `QuestionShell` becomes a thin wrapper over it. ⚠ The move must keep what the coach shell does today: its discard
  guard (`useDiscardGuard`, 24 callers), hiding the phone bar and locking scroll (`useOverlayOpen`). KitDialog renders
  in place (not portalled); check every coach mount for a containing-block ancestor.
- The ~44 hand-built coach windows move onto the shell (the ~17 without `useDialogFloor` first: they lack the Tab trap
  and the phone Back step).
- Tap floor (Q10): measure every window's fields and foot buttons at 390 before and after (`check:layout --changed`),
  record the figures here.
- ⚠ Naming: "Question" already names the coach FORM shell; the yes/no window takes another name in code.
- A foot sentence must be short at 520px, or it takes its own line above the buttons (drawn on the hub).

### Stage 3 · One question
What changes on screen: every "are you sure" in all three areas looks the same; no browser grey boxes; Saved / Done
fade on their own.

- `ConfirmProvider` renders the question window; the coaches' ~43 `confirm()` calls keep their wording.
- Tournament: Schedule (~12 messages), Results, the bracket editor → questions, pills or page notices.
- Club: the 13 FeedbackModal mounts → `NoticePill` (bare saves) or `PageNotice` (news, e.g. `planUpdatedMessage`),
  the house-league delete-game confirm → question.
- `window.confirm` ×3 (rep-teams assistant coaches; shared library ×2) → question.
- Delete `FeedbackModal.tsx` + `.module.css`.

### Stage 4 · Strays join
- House league's 17 windows → KitDialog (forms and questions), losing the banded head and foot, the grey Cancel and the
  stray-tap close.
- Tournament: Registrations' two global-modal forms, Resolve facilities, Resolve locations (→ `wide`), chat's New room.
- LeagueCapUpgrade → question; the onboarding windows → KitDialog (the wizard chrome is not a window);
  Close season / Start next season inline colours → tokens; `PlayerDocumentsSection` gets a real dialog.
- The volunteer score sheet's desk card is checked against the one window.

## 5. Guards
- No `window.confirm(` anywhere (after stage 3).
- No import of `FeedbackModal` (after stage 3).
- `modal-overlay` / bespoke overlay class names only on an allow-list that shrinks to zero by stage 4.
- The coaches' `.label` carries no `text-transform` (stage 1).
- Existing guards stay: `kit-dialog-foot-text-guard`, `kit-dialog-floor-guard`, `admin-overlay-guard` (rows updated).

## 6. Verification
Per stage: `npm run verify:changed`, `npm run typecheck` (shared components change), `check:layout --changed` on the
screens the stage touched (the whole-product sweep runs on staging, per the dev-server rule). An owner walk per stage
(Warm and Dark, computer and phone), published as a checkable QA walk on the hub.

## 7. Rollout
- Ships with the Club release; coach-visible changes ride the same release (Q16). Coaches have no switch.
- No database change. Help articles describe what windows ask, not how they look; a help change is needed only if a
  window's words change (none planned). Demo tours point at screens; the build's demo-anchor check covers them.

## 8. Out of scope
Rooms and record windows (Q15). Sheets, side panels, menus. In-place foot confirms (the coaches' guarded delete row).
What any window asks, says or does.
