# Admin type sweep — Stage 4, the new look made even (BUILD prompt — rulings in)

> Paste into a fresh session on `dev`. Rewritten 2026-10-19 by the session that drew Stage 4 and recorded its rulings
> (the drawing prompt it replaces is done; its findings live in the plan). **Read first, whole:**
> `ADMIN_TYPE_SWEEP_PLAN.md` §2 (the target), §4 "Stage 3 — as built" (its lessons) and **§4 "Stage 4 — drawn"** (the
> re-check, the handed-over classification, every path:line, the `/design` log), §6 (A1–A14). The drawings:
> https://claude.ai/artifact/YQ9CZWXgL9pjo8GvXpw2wH (source `ADMIN_TYPE_SWEEP_STAGE4.html`, built by
> `.probe/ats4/build.mjs` — its rows hold the exact today/proposed values). Hub:
> https://claude.ai/artifact/QcQCe3yy4oqRUnUEf9uMCb. Design log entry 2026-10-19 "EVERY HEADING IS THE PLAIN FACE…".
> **Write to the owner as a product owner**, never in file names. Disagree out loud before the work.

## ⚖ The rulings (owner paste-back 2026-10-19, all as recommended)

- **D1 — every mixed-case heading is the body face (Inter, 700), the page title included, in BOTH portals.** Page
  titles, card and section titles, window titles, the coaches portal's headlines. The condensed display face stays
  ONLY on capitals (column headings, band headings) and on the public pages. A team's name stays the body face
  (`.teamHeaderName`, the 2026-08-02 pick, unchanged). A button set in the condensed face is a fault → body face.
  Its own part (4f) and its own walk part. This is the largest visible change: every screen's title changes.
- **D2 — one "chosen" look for a segmented toggle:** the notifications page's Unread / All AND the bell drawer's, both
  portals, take the shared view pill's chosen look (`components/shared/ViewPills.module.css:28` — `rgba(var(--logic-lime-rgb),
  .16)` fill, `--home-olive` edge and word; read its dark-theme rules too). Replaces the page's blueprint-blue tint, the
  drawer's `--logic-lime` fill AND the coaches drawer's warm dark-ink override (`notifications.module.css:219-223`).
- **D3 — Account → Notification settings (`/account/notifications`) is swept in Stage 4**: whole page, same rules
  (sentences → body face; column headings; band rows; role / access tags → chips). It is every signed-in person's page,
  not an admin screen. Census the page first (PreferencesTable, the account client and its module, PushDeviceTester).

## Before anything

- `npm test` at the START. At drawing time: 8225 / 8227, the 2 red = club-stage6c rail scrollbar + coach-semantic-ink
  (other sessions' files). Record what you find.
- Re-read every path:line in plan §4 "Stage 4 — drawn" against the code — other sessions commit in between.

## Build — parts on DISJOINT file sets (helpers in parallel; Stage 3 ran four at once without a collision)

**4a Tournament admin** — `schedule-admin.module.css` (T09 `.healthJumpChip` → chip: 10 px token, 700; T22
`.resolveLocationsSectionLabel` → eyebrow, `.resolveLocationsCount` → data face 12 px `--type-support`, no extra
tracking), `ScheduleTimeline.module.css` (T31 `.nowLabel` → chip), `BracketEditor.tsx:497` (T38: eyebrow "Tiers" + a
12 px `--text-secondary` caption sentence "Split the N seeds into separate brackets."), `registrations/page.tsx:2251`
(T46 "…"), `AdminTitleManager.tsx` tab titles ("Event settings", "Tournament settings", "Tournament branding",
"Organization notifications"), `NewRoomDialog.tsx:98` "Event settings" (chat is paused — words only).

**4b Club kit + money** — RepKit `.sectionMeta` caps off (C01; face stays, `type-ok: readout`); bring-in `.count` caps
off, `.eye` → eyebrow 700 / 0.09em (C02); Schedules `.bandLabel` 0.09em (C22), `.attentionKind` → chip, amber kept —
the longest kind must fit the 6.7rem column and must NOT stretch on a phone (it is `flex-basis:100%` there) (C23),
`.fairTable th` → `--type-support` / 0.05em (C24), `.score` 800 → 700 tabular; VenueLibrary `.sectionHead` → eyebrow
(C26); `TeamBudgetItems.module.css` `.th` → the standard column heading (C29); `BudgetItemPicker` `.optTier` → chip,
data face 700 (C30); FiscalYear `.qHead` / `.pathKey` → eyebrow (C32); Settings `.previewLabel` / `.stockCategory` →
`--type-label` (C39); **C36 SendParts `.envelopeKicker` UNCHANGED** — it draws the real family email
(`lib/family-email.ts:140`); mark it `type-ok` with that reason (if the guard has no fitting role, say so and ask).
Mark every allowed-role line in plan §4's handed-over list.

**4c Billing + onboarding** — billing: `.productEyebrow`, `.foundingSeasonEyebrow`, `.nextSeasonChosenEyebrow` →
eyebrow (C45); the stale comment at ~:951; `.comingSoonBadge` → chip 700 (C46); **`.savingsBadge` is NOT a chip**
(design review): body face 12 px / 650 / olive, drop its `type-ok: chip`; heavies 800 → 700 (`.billingNudgeTitle`,
`.sectionTitle`, `.planCardName`, `.cancelImpactSection h3`, `.foundingSeasonTitle`); "Applying…", "Redirecting…".
Onboarding: `.title` / `.modalTitle` leave the data face and 900 → body face 700 (D1); `.wizardChrome` "Step 2/5"
keeps its eyebrow look, `type-ok: eyebrow` (drop the stray caps line only if it is redundant); page.tsx:1090 → a 12 px
body sentence with only `/league/{slug}` in the data face (C54); "Saving…". Dead classes → Stage 5, not here.

**4d Shared parts (both portals — check every caller)** — PayeeCombobox `.sectionLabel` → band heading (C31; also coach
expenses); FilterPill `.dateRangeCustomLabel` → eyebrow (C33; also the coaches' DateRangeDropdown); FormTable `thead
th` / `.groupName` / `.band` → the display face, 12 px, 0.05em (C66; Allocation, New schedule, tournament setup
wizard); ExportMenu "Exporting…"; help: `.helpRoleLine` → eyebrow, `.helpDrawerShortcutsTitle` → eyebrow, toc heads
0.1 → 0.09em (S17); CoachesBottomNav `.dropCount` 800 → 700 (S13 sibling); **the D2 toggle** on the page and in the
drawer (and its coach warm override).

**4e The account notification settings page (D3)** — census then fix: PreferencesTable `.table th` → column heading
(display face), `.sectionHeaderCell` / `.groupsHead` → band, `.unsupportedNote` → a body sentence; the account
client's typewriter sentences ("Signed in as…", "Mutes everything except…", "Organization access", the role tag) →
body face / chips by role; PushDeviceTester `.title`, `.enableBtn` 800 → 700, `.currentBadge` chip 700. It renders in
the consumer shell, not the kit — check which theme tokens it reads (Warm + Dark).

**4f The heading face (D1) — its own part, after 4a–4e land (it touches files they touch).**
1. The global `h1…h6 { font-family: var(--font-display) }` (`app/globals.css:1605`) stays for the public pages. Give
   the body face to headings inside the admin kit (the existing `:where([data-admin-kit]) :is(h1…h6)` rule at :1615)
   AND inside the coaches portal — find the coaches shell's scoping attribute (`CoachPortalShell.tsx`); do not guess.
   Keep `[data-public-preview]` exempt (the public-site preview must look like the public site).
2. Then every rule that sets `--font-display` on a mixed-case title by itself (~30; plan §4 "Stage 4 — drawn" D1 and the
   census list): `AdminPageHeader.module.css` `.title`; coaches `.pageTitle` (+ `.oneHeadline`, `.nowHeadline`; judge
   `.calNavLabel` — a nav label is body face); `KitDialog` `.title` (the one window — both portals); `ClubKit
   .sectionTitle`; `Settings .cardTitle / .lockedTitle`; `Billing .planName / .cardTitle / .lockedTitle`; `AuditLog` /
   `Members .emptyTitle`, `Members .accessTitle`; `ClubSetup .stepTitle`; `ClubReport .emptyYearTitle`; FiscalYear
   `.pathYear`; `CollapsibleCard .title` (its comment wrongly cites F2 — correct it); `TournamentAdminUI .legendTitle`;
   branding `.sectionTitle`; house league `.seasonHeaderName`, `.modalTitle` (the comment at ~:1387 already says
   "body-face title"), `.draftTitle`; help `.helpHubTitle`, `.helpPageTitle`, `.helpDrawerTitle`; notifications drawer
   `.headTitle`, `.emptyHeadline`; `NotificationMessage .title`; the legacy `.modal-header h3` rule (globals ~:2599).
   Grep `--font-display` across admin + coaches + shared sheets for the rest; keep every UPPERCASE one (column / band).
3. Figures set in the display face (`ClubCalendar .monthNum`) → body face, tabular (A1). The coaches Money "Build your
   budget" button (and any other condensed button you meet) → body face.
4. Leave: printed pages (`PrintedPage .title` — the house print format), the billing mock portal (not in production),
   public pages, the brand wordmark.
5. Size/weight unchanged: page title `--type-title` 700, card/window titles `--type-heading` 700. Look at a page on
   screen after the change — the order page title → card title must read clearly (that was the reason for D1).

## Rules learned in Stages 1–3 (plan §4)

- Removing an uppercase transform publishes the string it hid — read the text, set it in sentence case.
- A label can be a KEY — grep compares / stores / lookups before changing words; change display only.
- `kx(legacy, kit)` MERGES. Fold into the base rule rather than another override layer.
- Mark every rule that keeps capitals or the data face for an allowed role with `type-ok: <role>`.
- Shared parts render in more than one portal: check every caller.
- One spelling: grep the other spelling first; help `keywords` / `searchText` follow.
- `KIT_INK.head` (`kit-inline.ts:68`) is body 650 no caps, while standard §3.2 puts column headings in the display face
  in capitals. Do NOT change `KIT_INK.head` in this stage — list its callers and raise it to the owner as a finding.
- **Do not teach `check:admin-type` the display face** (a new axis for the gate) unless the owner asks for it in that
  session — offer it as an ask at hand-off; until then 4f is held by the walk and a grep.

## Verify, records, walk, commit

- typecheck (`npx next typegen` first), `npm test`, `check:admin-type` + `check:old-look` (report, then `--init` when
  every change is a drop in Stage 4's files; record the new counts — Stage 3 left type 83 files · face 154 · caps 141 ·
  track 8 · heavy 57), spelling, css purity, public tokens, contrast ×2 (the D2 olive tint in Warm and Dark), eslint on
  changed files, `check:css-selectors`.
- `check:layout`: 4d and 4f touch shared chrome in both portals → the whole-product sweep runs on STAGING, not the dev
  server (owner 2026-10-13). Say which you ran. ⚠ `scripts/.layout-baseline.json` keys ~25 entries on Stage 3's renamed
  buttons — that renewal belongs to the next staging sweep.
- Shared modules change → restart the dev server before the walk: stop the inner `next dev` only; `scripts/dev.mjs`
  brings it back. Check `/platform-admin/login?next=%2Fplatform-admin` returns 200.
- `/review` on Stage 4's files only. Offer `/simplify` first if 4f grows a new shared rule or helper.
- **Owner walk:** its own checkable Artifact `ADMIN_TYPE_SWEEP_STAGE4_WALK.html` (Stage 3 walk's shape), one purpose,
  Warm then a Dark spot-check, linked from the hub. The heading face (4f) is its own walk PART covering both portals: an
  admin screen, a club window, a coaches page with a headline, a coaches window, a phone, and a public page that must
  NOT change.
- **Commit** only with the owner's OK, explicit pathspecs. Shared files (TODO.md, the design log, help content, the plan)
  carry other sessions' lines: build those blobs as HEAD + your exact edits in a temporary index, `commit-tree` +
  compare-and-swap `update-ref`, then point the main index at the new HEAD for your paths (`.probe/ats3/commit.cjs`;
  memory "Partial commit out of shared files"). Then `git show --stat HEAD`. Consider 4f as its own commit.
- **Records:** the plan's "Stage 4 — as built", the TODO line, the hub (read the live copy first; `JSON.parse` both
  `application/json` blocks; same file path), the auto-memory `project_admin_type_sweep.md` + its `MEMORY.md` line.
  Offer `/docs` (help articles and screenshots that show a condensed title; the account notification page's help).
  `/demos` once per release (the tours show every page title).

## Not this stage

S5 (dead styling — billing `.priceUnit`, rep-teams `.pageTitle` / `.summaryCardLabel` / `.sectionTitle`, house league's
legacy `.pageTitle` and data-face branches, the What's new panel classes), the rest of the guard's report (~100 lines,
mostly dead), the parked items (plan §5), the public bars and footer (`PUBLIC_FACE_WARM_PLAN.md`), the public-site
editor (Club Tier Stage 4), Stage 2's open call (the bracket editor's Field box vs the club's one Venue field), and
house league's empty-audience "0 delivered" message (raise it to Club Tier Stage 9 if you touch that page).
