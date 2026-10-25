# Platform admin support console · Stage 1, the warm foundation (build prompt)

> Paste into a new chat on `dev`. Written 2026-10-24, the day the owner ruled the kickoff. **Re-verify every lead
> against the code before you build on it:** this prompt is a lead, not evidence, and so is any helper's summary. The
> working copy is shared with Club Tier and Bookkeeping sessions: stage explicit paths only, check the branch before
> every commit, `git show --stat HEAD` after it. Commit nothing without the owner's OK.

## 1 · What Stage 1 makes true

The platform admin stops being the last screen in the old dark look. Every console screen, the sign-in page and the
help pages wear the product's admin kit and follow the one Warm / Dark setting (warm by default). The console gets the
navigation standard in full: top strip, folding menu with icons, Help and Collapse at the foot, and the account menu
with Appearance and Sign out. Every page takes the portal's frame (960 reading, 1200 tables, centred), the page header,
the type ladder, the body face, and sentence case.

**No screen changes its job.**
- Every menu entry stays where it is, under today's seven group names, set in sentence case.
- Regrouping by job, Find, Today, the customer record's Story, the Money tab, free time and Status are Stages 2–5.
- A support person who knew the console yesterday finds every button where it was. It just looks like the rest of
  FieldLogicHQ.

## 2 · Rulings (owner, 2026-10-24). Do not reopen them

From the kickoff paste-back:
- Plan "Owner rulings 2026-10-24".
- `memory/design_decisions.md` entry 2026-10-24, "THE PLATFORM ADMIN TAKES THE HOUSE LOOK".

**F1.** Three written exceptions retire, and the sign-in page follows:
- K-10, the console's data face;
- the design log's "operator shells / platform-admin login stay dark" clause;
- `NAV_STANDARD.md`'s "Platform admin keeps its own look".

**D1–D5**, for the console:
- **D1:** a section heading sits above its card (the club kit), not inside it.
- **D2:** a white button for every action, lime for the one main action, olive text for a door.
- **D3:** no log-table exception. Rows are compact or comfortable by content. Times take the body face. The data
  face is only for codes: routes, web addresses, Stripe ids, error fingerprints.
- **D4:** the navigation standard applies in full.
- **D5:** a one-of-several form choice is a dropdown, or radio rows with a line each. Never a segmented row.

**Q4.** Desktop only. Status and Today are readable on a phone, but they are Stages 2 and 5. Stage 1 needs only
"nothing scrolls sideways, and the menu still opens" below tablet width.

**Q3.** The order after this stage is S2 → S4 → S3 → … Do not start any of them here.

## 3 · Read first

- **The end state:** https://claude.ai/artifact/RCpPoxNNxGDfiC4FFo4m1g (source
  `PLATFORM_ADMIN_SUPPORT_CONSOLE_END_STATE.html`). Screens 1–7 are the destination. Stage 1 delivers only their
  **S1 · RESTYLED** tags. The Formatting check and the design-review list on that page are this stage's checklist.
- **The walk:** https://claude.ai/artifact/2sNNCtRUJWi9PSE1QDmCDq, for the "before" captures.
  `.probe/pasc/` holds the capture and render scripts. It signs in read-only and aborts every non-GET.
- **The project index:** https://claude.ai/artifact/TLP8d5Zec4xVkTSYrQU8tp. News goes there as an `ArtifactData`
  write to `stages/s1` and `log/…`. Never republish it.
- `PLATFORM_ADMIN_SUPPORT_CONSOLE_PLAN.md` (rulings, ladder row S1, standing rules R1–R8) and the PM brief.
- `docs/agents/design/NAV_STANDARD.md` (N1–N10), `TABLE_AND_LIST_STANDARD.md`, `TABLE_EXCEPTION_REGISTER.md`.
- The head of `memory/design_decisions.md`. Read the 2026-10-24 entry and the 2026-10-19 admin-type rulings A1/A2.
- `AGENTS.md` and `AGENCY_RULES.md`: the PM UX summary before code, status wording, the shared-automation rule.

## 4 · Verified state (2026-10-24, re-verify)

| What | Then |
|---|---|
| Shell | `app/platform-admin/layout.tsx` has three branches: login returns bare children; Help is a bare `<main>`; everything else is `.shell` → `PlatformAdminNav` + `<main>`. All pin `CoachThemeColor fixed="dark"`. A "RULED EXCEPTION … Do not unify" comment (~44-48) is now overruled by F1. There is no kit marker, no provider and no strip. |
| Nav | `PlatformAdminNav.tsx`: 7 Title Case groups, 15 px icons, a "PLATFORM ADMIN" badge, an "ACTIVE SESSION" email + Sign out at the foot. Nothing folds and there is no Collapse row. Dev Tools is env-gated. Bookkeeping is its own last group behind an email allowlist (`canAccessBookkeeping`), not a role. **Keep that rule exactly.** |
| Look | `platform-admin.module.css` (271 lines): K-10 at ~7-15 (`.shell table { font-family: var(--font-data) }`), a 220 px sidebar, a lime-grid dark `.main`, and a 920 px collapse to a horizontal nav. 22 console stylesheets, ~12,000 lines: plans-pricing 1428, orgDetail 1062, dev 1020, pitch-deck-studio 694, email 685, change-requests 660, customer-users 627, overview 627, observability 614, email-templates 598, orgs 593, early-access 579, playbook 534, users 461, bulk-operations 445, audit 348, founding-season 293, feedback 286, exports 241, platform-login 184, bookkeeping 180, plus MetricCard 47 and RequiresAccess 8. |
| Club shell | `app/[orgSlug]/admin/layout.tsx:116-123`: `<AdminKitProvider on><div style={{display:'contents'}} {...adminKitAttr}>`. `adminKitAttr` (`lib/admin-kit-marker.ts`) = `data-coach-warm-enabled` + `data-admin-kit`. The warm palette is in `globals.css` ~784, the dark gate ~1113, the kit layer from ~1205. |
| Reusable as-is | `BrandLockup`, `AccountMenu` (`showTheme`; `signOutTo` is only `'sign-in' \| 'here'`, and `'sign-in'` goes to `/auth/login`), `SidebarStrip` (`CollapseSidebarRow`), `AdminPageHeader` (no subtitle slot by design), `CoachTopStrip.module.css`, `AdminKitFrame.module.css` (rail skin), `CoachThemeColor` (no `fixed`). |
| Org-bound (do not reuse) | `AdminTopStrip`, `AdminKitRail`, `AdminKitBottomNav`, `CoachesSidebar`, `NotificationBell`. There is no platform bell scope, and `WORKSPACE_KIND_LABEL` has no platform kind. |
| Theme | Appearance lives in the account menu (`showTheme`). `/api/account/theme` needs only a signed-in user, and `user_preferences` is keyed by user. **A platform user with no org can use it unchanged.** |
| Kit guard | `tests/unit/admin-kit-switch-guard.test.ts:101-117`: `MARKER_DOORS` = the club admin layout + `AdminKitProvider.tsx`. Any other file using `adminKitAttr` fails. |
| Gates | **check:old-look:** a file outside its baseline may hold no `[data-admin-kit]` selector, so console CSS is written as **plain rules**. **check-public-tokens:** the operator scope covers the console, baseline `{}`. **`.tsx-token-baseline.json`:** 6 console files with hex. **`.css-selector-baseline.json`:** dead console classes (orgs `addon*`, users `linkRow` / `pageLabel`, …). **check:admin-type** does **not** scan the console. **check:layout** has a `platformAdmin` session profile but **no console screens** in `scripts/layout-screens.mjs`. **public-face-s4-identity** only pins that the login page mounts `BrandLockup` (not dark, not `tone="mono"`). **sign-in-words-and-no-tell-guard:70-73** pins the forgot-password code shape. |
| Shared CSS the console wears | ExportMenu (7 console pages), CollapsibleCard (1) and the help components (`help.module.css`). Their **base rules are the console's look**, and their `[data-admin-kit]` layer is the club's (`scripts/lib/admin-old-look.mjs` `SHARED_SURFACE`). Wearing the marker gives the console the kit layer. **Never edit those base rules.** It would restyle club screens. |
| Others' work in flight | Bookkeeping (`app/platform-admin/bookkeeping/**`) belongs to `BOOKKEEPING_OWNER_EXPERIENCE_PLAN.md`'s session. On 2026-10-24 its stylesheet failed three gates (off-ladder sizes, 89 hex, duplicate selectors) and its page threw a ReferenceError on dev. **Stage 1 gives it the shell, frame and header only. Its internals are that session's.** |

## 5 · Scope: what Stage 1 is and is not

**Is:**
- The shell: marker, theme, strip, rail, foot, account menu.
- The sign-in page and the help pages.
- Every console screen onto the frame, header, ladder, faces, sentence case and D1–D5.

**Is not:**
- **Two screens Stage 2 rebuilds get only the shell, frame, header and type, never a full internal restyle:**
  - Overview, which becomes Today;
  - the org record, which becomes the record with Story.

  Restyling their insides now is work thrown away a stage later. Customer Users and Organizations do get the full
  restyle: Stage 2 adds Find and renames them, it does not rebuild them.
- No new screens.
- No menu regrouping, and no renames beyond sentence case. "Customer users" stays; it becomes "People" in S2.
- No Find box in the strip. That is S2. Leave the strip's middle empty, not a disabled box.
- **No bell.** The console has no notifications behind it (absent beats disabled). The end-state drawing shows one,
  so say so in the drawings.
- No phone design. Q4: below tablet width, nothing scrolls sideways and the menu opens.

## 6 · Blocking gate: no code before all four are done

1. **Confirm the plan against the code.** Re-run the verified-state table and note every row that moved.

2. **Drawings, published as an Artifact, before any code.**
   - Source: `PLATFORM_ADMIN_SUPPORT_CONSOLE_STAGE1_DRAWINGS.html`, linked from the index's `stages/s1`.
   - True size, **Warm and Dark**.
   - Before = a capture from dev (use `.probe/pasc/capture.mjs`), after = drawn. NEW / RESTYLED / UNCHANGED tags,
     each clickable with its reason.
   - Specimens:
     - **A · Three whole screens, before → after, at 1440:**
       - Organizations, a list: toolbar, table and name links;
       - Observability, dense: figures, a log table, codes in the data face;
       - Plans & Pricing, the largest: tabs, forms, D5 choices.

       This is the cumulative check. The thing each screen exists for must not have dropped below the fold.
     - **B · The shell:**
       - the strip (lockup, portal name, account menu open with Appearance);
       - the rail (groups folding, the current group open, 14 px icons, Bookkeeping's private group last, Dev Tools
         where the env shows it);
       - the foot (Help, Collapse sidebar);
       - the collapsed 64 px rail.
     - **C · A form screen:** Email template editor or Bulk Operations, showing D2 buttons, D5 choices, kit fields,
       the required marker and a window if the screen has one.
     - **D · The sign-in page,** Warm and Dark.
     - **E · The two S2 screens** (Overview, the org record) with the shell, frame, header and type only, internals
       untouched, so the owner sees the boundary on purpose.
     - **F · Below tablet width:** what the menu does, and that nothing scrolls sideways.
   - Run **`/design`** on the drawings, apply its fixes, and list any rule conflict for the owner. Its proposals stay
     on the drawings page, never in the design log.

3. **Ask the owner these, beside the drawing each decides,** with a recommendation each:
   - **(a) The portal's name in the strip and the tab title.** The end state drew "Support console". Staff and the
     code say "Platform admin". *Recommend "Support console",* the job it does, but it is the owner's word.
   - **(b) Help in the foot:** open the console's help in place, as every portal does, or in a new tab, as today.
     *Recommend in place.*
   - **(c) The account menu's Sign out returns to the console's sign-in page.** That needs a third `signOutTo` value on
     the shared `AccountMenu`. Name it as a shared change.

4. **Restate the PM summary in five lines** (`AGENCY_RULES`): what staff see, that nothing moves, Warm/Dark, the
   sign-in page, what is deliberately left for S2.

## 7 · Build (after the gate), in parts

**Part 1 · The kit marker and the theme.**
- `app/platform-admin/layout.tsx` wears `<AdminKitProvider on>` + `{...adminKitAttr}` on every branch: shell, help and
  login.
- Remove every `CoachThemeColor fixed="dark"`. `CoachThemeColor` follows the setting.
- Delete the "RULED EXCEPTION … Do not unify" comment and point to the design log entry instead.
- **Shared change:** in `admin-kit-switch-guard.test.ts`, add `app/platform-admin/layout.tsx` to `MARKER_DOORS`, plus
  an `it(...)` asserting the same unconditional shape there. Update `AdminKitProvider.tsx`'s "the one place besides
  the admin layout" comment.
- Console CSS is written as **plain rules** (old-look gate), never `[data-admin-kit] …`.

**Part 2 · The shell (local components, built from the shared parts; never a copy of them).**
- **A platform strip,** on `CoachTopStrip.module.css`: `BrandLockup` (tone follows the theme), the portal name (ask
  a), and `AccountMenu` with `showTheme` and the platform sign-out (ask c).
  - The portal name either becomes a `platform` kind in `lib/workspace-labels.ts` (a shared lib, a small change: name
    it) or stays a local constant. Prefer the shared kind, so the strip, the tab title and any later "switch portal"
    door read one word.
- **A platform rail,** on `AdminKitFrame.module.css` + `CollapseSidebarRow`, following N1–N6 and N9:
  - today's seven groups, sentence case;
  - headings fold, and the current page's group stays open;
  - 14 px icons, one per idea from the product's icon dictionary (find it; N5);
  - the full-row olive tint for the current page;
  - the foot: Help, then Collapse sidebar (no "other portal" door unless the owner wants one).
  - The role filter (`canViewPlatformArea`) and the view-only marker stay exactly as they are, restyled.
  - Bookkeeping stays behind `canAccessBookkeeping`.
- **Retire:** the "PLATFORM ADMIN" badge, the "ACTIVE SESSION" block (Sign out lives in the account menu, N4), the
  920 px horizontal nav and the lime grid.

**Part 3 · Every screen onto the frame and type.**
- Work module by module, the most-used first: orgs, customer-users, observability, feedback, audit, bulk-operations,
  plans-pricing, … Then the rest.
- Per screen:
  - the 960 / 1200 frame;
  - `AdminPageHeader` for the title (no eyebrow, no subtitle; the bare help glyph ends the band);
  - D1 section headings above their cards;
  - D2 buttons, D5 choices;
  - D3: the body face, with the data face only on codes;
  - the type ladder only (10 · 11 · 12 · 14 · 16 · 20 · 24);
  - sentence case;
  - table headings in the display face per the standard;
  - one lime per screen;
  - "8:00 a.m." times through `formatTime`;
  - one spelling (`check:spelling`).
- **Remove the K-10 rule.** Hex out of `.tsx` files into tokens (the six baseline files). Dead classes out
  (`.css-selector-baseline.json` entries).
- Overview and the org record: shell, frame, header and type only (§5).
- Bookkeeping: shell, frame and header only (§4).
- Fix plain-word and markup issues where Stage 1 touches the line: "Use 9999 for unlimited" stays (S4 fixes it). The
  raw `MODULE_FAMILIES` chip label becomes "Families" if the chip is restyled here. Do not change behaviour.

**Part 4 · The sign-in page.**
- Warm by default, Dark on the setting.
- `BrandLockup` with the follow tone, kit fields, the white/lime button tiers.
- Keep both pinned tests green (public-face-s4-identity, sign-in-words-and-no-tell-guard).
- The page has no account yet, so it reads the browser's saved theme (`fl_user_theme`) like every other sign-in page.
  Check what the customer sign-in page does and match it.

**Part 5 · The gates follow the console.**
- Add console screens to `scripts/layout-screens.mjs` under the existing `platformAdmin` session: Organizations,
  Customer users, Observability, Plans & pricing, the org record. Then run `check:layout -- --changed` on them.
- Add `app/platform-admin` + `components/platform-admin` to `check:admin-type`'s `DIRS` **after** the sweep, so a new
  file starts at zero.
- ⚠ **Before editing either script, check `WATCHED_PATHS` in `scripts/check-agent-automation.mjs`.** If a script is
  listed, it changes only on the owner's word in that conversation, in its own commit.

**Part 6 · The retired lines, in the same unit of work as the restyle.**
- `NAV_STANDARD.md`: line 9 ("Platform admin is an exception") and the line-71 exception.
- `TABLE_EXCEPTION_REGISTER.md`: **rows are never deleted.** Mark K-10 retired with the date and the ruling. Mark A-02
  and F-05 / F-06 / F-12 with what Stage 1 did.
- The design log's dark-shell clause (~line 8833): add a "superseded 2026-10-24" note, and never rewrite the old entry.

## 8 · Guards (new unit tests)

- The console layout wears the marker on every branch, and no `fixed="dark"` remains anywhere under
  `app/platform-admin`.
- The K-10 rule is gone, and no console stylesheet sets `font-family: var(--font-data)` on a table or body. Allowed:
  a class named for a code. Mark it `type-ok: code`, or whatever the type gate's convention is.
- The rail's foot order is Help, then Collapse. Sign out lives only in the account menu, and it lands on
  `/platform-admin/login`.
- Bookkeeping's door still follows `canAccessBookkeeping`, and every other entry still follows `canViewPlatformArea`.

## 9 · Verify

- At 1440 and 1024, Warm and Dark, on the screens in Part 5: `check:layout -- --changed`.
- `npm run typecheck` (run `npx next typegen` first), `lint:focused` on the changed files, and the related unit tests
  directly with `node --import ./tests/ts-resolver.mjs --test <files>`.
  - ⚠ `npm test`, and therefore `verify:changed`, **clears `test-results/`** for every session. Run them only when no
    other session is mid-walk, and say you did.
  - On 2026-10-24 `verify:changed` was red only on other sessions' work: Bookkeeping, a dev crash-test page, a shared
    system screen, a tryout line, a tournament Teams screen, and `.pnpm-store/`. Report yours apart from theirs.
- The owner does the browser testing.

## 10 · Hand-off

- **A QA walk as a checkable Artifact** (memory `feedback_qa_walkthroughs_as_checkable_artifacts`), one purpose:
  "the console looks and works like the rest of FieldLogicHQ, and nothing moved".
  - Per screen: a sign-in card, checkboxes and a paste-back.
  - Add a matching Owner QA Ledger section. Never sort its § numbers.
- **The index:** `stages/s1` state + anchor ("Built `<hash>` <date>"), a `log/` row, and the walk's link.
- **Records:**
  - the plan's S1 row and Status;
  - TODO;
  - the PM brief;
  - the auto-memory file `project_platform_admin_support_console.md`;
  - the in-repo `memory/design_decisions.md` only for new rulings.
- **Offers:**
  - `/simplify` then `/review` (high-risk: a shared layout, a shared component prop, a shared guard test);
  - `/docs`: the platform help articles describe the console. Ask whether any article names the dark look or the
    old nav.
- No commit without the owner's OK.

## 11 · Do not

- Regroup or rename the menu, or build Find, Today, Story, Money, free time or Status.
- Edit the base rules of ExportMenu, CollapsibleCard or `help.module.css`.
- Write `[data-admin-kit]` selectors in console CSS.
- Touch Bookkeeping's internals.
- Draw or build a phone design.
- Add the bell.
- Wire anything that runs on a schedule or against production.
- Change who can open what. The role filter and Bookkeeping's rule stay exactly as they are. Any change there is a
  security change, drawn first.

## 12 · Git

On `dev` only. Explicit pathspecs. Check the branch before every commit and run `git show --stat HEAD` after it.
Separate commits for:
- the shared guard/component changes;
- the console restyle;
- any watched script (its own commit, with the behaviour named in the message).

## 13 · Context you would otherwise miss

- The bulk plan-change fix (2026-10-24) made one shared rule, `lib/operator-plan-change.ts`, for both plan-change
  screens. Stage 1 restyles Bulk Operations' copy only; leave its logic alone.
- Dev Tools appears only with `NEXT_PUBLIC_ENABLE_DEV_TOOLS` (super admin). It is a seed console, not a support
  screen. Restyle it last and lightest.
- The help pages render without the sidebar today (a bare `<main>`). Decide with the owner whether they get the rail
  (ask b).
- `.probe/pasc/capture.mjs` signs in as `UAT_PLATFORM_ADMIN_EMAIL` into its own state file. Never overwrite
  `tests/uat/.auth/platform-admin.json`, which other sessions use.
- Two platform data routes have no callers (`plan-config`, `plan-gating`). Leave them for S7.
