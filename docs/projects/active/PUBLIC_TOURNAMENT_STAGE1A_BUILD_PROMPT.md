# Public tournament pages — Stage 1a, who owns the look (build prompt, four sessions)

> Written 2026-11-02 (Claude), after Stage 7 closed (walk §440 ✅ 34/34). Plan: `PUBLIC_TOURNAMENT_SITE_REVIEW_PLAN.md`
> §4a (with its 2026-11-02 verification block), §9 "Side · 1a", Asks 9–13 (ruled 2026-10-27). **The drawings are the
> spec:** https://claude.ai/artifact/CLC89sru73hTn3hmAXQ46H (source `PUBLIC_TOURNAMENT_STAGE1A_DRAWINGS.html`), ruled in
> full 2026-11-02 — every ask as recommended. Stage 10 (printable rules) waits on this stage's answer for which
> branding prints: it prints what the band shows (one resolver, Part 1).
>
> Read `AGENTS.md` and `AGENCY_RULES.md` first. Everything a customer sees is behind the preview switch, with one
> ruled exception (the share images, Part 1) and one dead-door fix that ships on its own (Part 1 step 6).

## What Stage 1a is (one paragraph, so every part shares it)

A club (League Plus, Club, Club · Association) gets one rule for its tournaments, at the end of its Public site
editor's **Look** row: *the club's look, unless a tournament chooses its own* (the default, today's behaviour) or
*Always the club's look*. The rule is applied when pages are shown and never writes a tournament's saved look.
*Always* asks first when any tournament has its own colours, naming them. A tournament's Branding page folds Theme,
Font, Card style, Dark/Light and Hero banner into one **Look** card (colours on the club's two-tone swatches, the
three type looks, a preview of the real band), with "The club's look" as a real first choice for a club's tournament
and a plain lock line under *Always*. Tournament Plus picks per event with no club layer and falls back to the plain
FieldLogicHQ look, never a leftover organization look. The band finally wears the club's type look. The three share
images follow the same rule as the page.

## How this runs: four sessions, a `/clear` between them

| Part | Covers | Ends with |
|---|---|---|
| 1 | The rule and the read: migration, the one resolver, the band's colour/type/mark, card style off under the frame, Tournament Plus plain, the share images, the settings door, the club-rule API | Resolver case table green; the owner can flip the rule on dev with a fixture command and see the band change; share images follow |
| 2 | The club side: the Tournaments part in the Look row, the question before *Always*, the shared colour and type controls (hex fields for Custom on the club too) | The club editor drawn as tab 1–2, behind the switch |
| 3 | The tournament side: the Look card in its four cases, the band preview, the cards that go, the new order, the lock-line words | The Branding page drawn as tabs 3–4, behind the switch; switch off byte-for-byte today's page |
| 4 | `/simplify`, `/review`, the QA walk, the records | Walk published; plan §9, TODO, ledger, memory updated |

**Every part:** the `dev` branch only; stage explicit pathspecs (the tree is shared — TODO, the ledger and the plan
usually carry other sessions' hunks; commit only yours); a product-owner summary before any code; the owner does the
browser testing; no commit without the owner's yes. **Token discipline:** broad reads go to a helper; read the hunk you
are about to edit, not the whole file.

### Rulings this stage stands on (do not re-open them; cite them)

- **Ask 9:** two choices, default "the club's look unless a tournament chooses its own"; applied at read time; a
  tournament's own saved look is never overwritten; switching back restores each one.
- **Ask 10:** under *Always* the event logo stays the tournament's (else the club's).
- **Ask 11:** club type looks (Classic, Serif, Clean) for tournaments; the font list goes; Card style goes; App name
  hidden (its saved value kept).
- **Ask 12:** emails wear the page's look in a **later** stage. **Owner 2026-11-02: the share images move into 1a.**
- **Ask 13:** the owner and the admins who can edit the club's Look set the rule (NOT owner-only: do not copy the
  coach-names row's owner gate).
- **Ask 1:** the Dark/Light switch goes.
- **Owner 2026-11-02 (before the drawing):** the Hero banner goes (the redesigned pages show no banner anywhere);
  Tournament Plus wears its own look, else the plain FieldLogicHQ look — the leftover organization look is not read,
  is kept, and returns on an upgrade to a plan with a public site; the Settings page's "Open Public site" door is hidden
  on plans without the site.
- **Owner 2026-11-02 (the drawing's six asks, all A):**
  1. The rule is a part titled **Tournaments** at the end of the **Look** row; the row's summary says "tournaments
     follow" or "every tournament". (Not its own row: the Home page row already has a Tournaments switch, Stage 4f.)
  2. The question before *Always* as drawn: one sentence naming up to three tournaments with their own colours, the
     one on now first and marked "(on now)", then by start date, "and N more", finished ones counted ("along with 3
     finished tournaments"); "Their own looks are kept." at the foot's left; Not now (focus) + Use the club's look
     (lime). Escape / outside tap = Not now. No question when none has its own colours; switching back never asks.
  3. **A preview of the real band and tab row on the Look card** — reverses the 2026-10-10 Branding ruling ("the drawn
     mock went"); it must be the shipped band component, never a drawing of it.
  4. **One colour control on both screens:** the club Look's two-tone swatches with the double ring; hex fields for
     Custom on both (the club gains them).
  5. **Type under the default:** own colours bring the three type looks, starting on the club's.
  6. **The card is called "Look"** and is the first card after Pages.
- **Ladder rules:** behind the preview switch until Stage 8; one page group at a time, walked before the next.
- Spelling (`check:spelling`, part of `verify:changed`): "colours", "the club's look", "Look" — grep before adding a
  word. League Plus says "the league's look" (the editor's existing noun-by-plan rule, `public-site/page.tsx:449`).

## What the code does today (a 2026-11-02 census; re-check before you rely on a line)

**The read, switch off** (today's dark pages, untouched by this stage except the share images):
`lib/public-tournament-theme.ts:28-58` — own colours when `themePreset || themePrimary`, else the org's; the platform
theme on a plan without `advanced_tournament_branding`. Layout `app/[orgSlug]/[tournamentSlug]/layout.tsx`: colour
mode :156, colours :162-175, card style :177-179 (tournament's, else org's), logo :341. Banner
`components/public/TournamentHomeContent.tsx:448-450` (switch-off body only). The tournament's `theme_font` is read
nowhere public (D8); the org font always applies (`app/[orgSlug]/layout.tsx:166`).

**The read, switch on:** `lib/public-frame.ts` (pure, browser-safe). `publicFrameRoles` :69-79 — neutral near-black on
a plan without branding; else `clubColourRoles` of the tournament's own colours, else the org's. `publicFrameBand`
:101-118 — logo `tournament ?? org` :111, initials :112. **Type is fixed:** the frame element (`layout.tsx:510`)
carries `clubFrameStyles.tokens` with no `data-club-face`, so Barlow Condensed + Inter always
(`components/public/ClubFrame.module.css:32-33`; the face rules `.tokens[data-club-face=…]` already exist at :148-157).
**Card style leaks:** `data-card-style` still set (`layout.tsx:403`) and `globals.css:1759-1771` has no frame exception.
Dark/Light is already forced light under the frame. The Overview's frame body shows no banner.

**Tournament Plus:** no `module_public_site` (`lib/plan-config.ts`: only `league` = League Plus, `club`,
`club_large`), yet both reads fall back to the org's colours and logo — an org look Tournament Plus has no screen for
(an owner could still write it through `org-settings` on any plan, `lib/public-site-access.ts:22`).

**Share images (D10):** `app/[orgSlug]/[tournamentSlug]/opengraph-image.tsx:58`,
`teams/[id]/opengraph-image.tsx:53`, `schedule/[gameId]/opengraph-image.tsx:75` — the tournament's own colours only,
no org fallback, no plan check. Stage 6's reveal gates (`:71-74`, `teams/[id]:36`, game `:55`) stay as they are.

**The club editor:** `app/[orgSlug]/admin/public-site/page.tsx` — rows Look :627, Home page :631 (its Tournaments
switch and Past tournaments sub-option, Stage 4f), About, Lists, Coaches on team pages :688, Web address, Visibility.
`LookPanel.tsx`: logo, colours (:249-284, "From your logo" pill, 9 presets two-tone `linear-gradient(135deg, p 50%,
a 50%)`, rainbow "own colours" → two native colour inputs, **no hex field**), type tiles (`lib/public-site-builder.ts:43-47`
`CLUB_LOOKS` classic/serif/clean ↔ font system/dm-serif/inter), banner. Swatch CSS `public-site.module.css:522-563`
(double ring `0 0 0 2px var(--card-bg), 0 0 0 4px var(--home-olive)`). Writers: `clubLookEditor` (owner any plan;
admin needs `mayOpenSiteEditor`), admin limited to `CLUB_LOOK_FIELDS` (`public-site-builder.ts:38`,
`org-settings/route.ts:64`). Precedent for a club policy: `organizations.coach_names_policy` (mig 352),
`sanitizeCoachNamesPolicy` read in `lib/api-auth.ts:228`, `lib/db.ts:1817`, `lib/server-organizations.ts:75`;
`CoachNamesPanel.tsx` (SendRows radio + `KitDialog kind="question"`, "Not now" :103-107).

**The tournament Branding page:** `app/[orgSlug]/admin/tournaments/branding/page.tsx` (title "Public site";
`manage_branding`, owner/admin by role, a coach through *Run tournaments* scoped by `scopeGuard` in
`app/api/admin/tournament-branding/route.ts`). Order: door :370, Pages :414, then (plan with advanced branding) Logo
:437, App icon :460 (App name :476-481), Theme :518 (single-colour swatches with ✓ :520-538, hex Custom :539-556,
Dark/Light :557-568), Hero banner :574, Font :594, Card style :609; free → one `PlanLockLine` :433, words
`lib/invite-only-words.ts:18` "Your logo, theme, banner and fonts on this site". **D7 is fixed on save** (`bodyOf`
:118-124 sends theme only when `themeChanged`) **but not on screen:** an unset theme drafts as `'platform'` (:95) and
the FieldLogicHQ swatch shows as chosen (:522). **`themeFont` and `themeCardStyle` ride every save** (:127-128) — the
same trap D7 was; the route stores `'system'` as null (:208). No band preview: the door opens the admin preview page
(`admin/tournaments/preview/[tournamentSlug]/layout.tsx:58-119`, saved state only). Words
`lib/tournament-settings-words.ts:230-277`.

**The Settings door:** `components/admin/kit/club/SettingsKit.tsx:295-302` shows "Open Public site" on every plan; on
Tournament Plus it opens to a load failure (the page's client gate checks only the capability, `page.tsx:437`; the API
refuses without the entitlement).

## The one design choice, settled here: one resolver, read everywhere the look is shown

Today the "which look" rule is typed out in `public-tournament-theme.ts`, `public-frame.ts`, the layout (logo, card
style), `TournamentHomeContent` and three share images, and they already disagree (D10). **Write one pure resolver**
(e.g. `lib/tournament-look.ts`, browser-safe like `public-frame.ts`) and make every switch-on reader and every share
image call it:

```
resolveTournamentLook(org, tournament) → { source: 'neutral' | 'own' | 'club' | 'plain',
  preset, primary, accent, face: 'system' | 'dm-serif' | 'inter', logoUrl, policy }
```

| Org | Rule | Tournament has own colours | → colours | → type | → logo |
|---|---|---|---|---|---|
| no `advanced_tournament_branding` (free, Premium coach) | — | any | neutral | Classic | none |
| has the site module (League Plus, Club, Club · Association) | default | yes | own | own face, else the club's | own, else club's |
| 〃 | default | no | club's | club's | own, else club's |
| 〃 | always | any | club's | club's | own, else club's |
| branding but no site module (Tournament Plus) | — | yes | own | own face, else Classic | own only |
| 〃 | — | no | plain (`platform`) | own face, else Classic | own only |

- "Own colours" = `themePreset || themePrimary` (unchanged definition; an explicit FieldLogicHQ pick counts).
- "Has the site module" = the plan carries `module_public_site` (`hasModuleEntitlement`), **not** whether the site is
  online: a club with its site switched off still has a look.
- `publicFrameRoles` / `publicFrameBand` become thin wrappers over it; the band's `data-club-face` comes from it; the
  admin preview layout, the Look card's preview (Part 3, from the draft) and Stage 10's PDF read the same function.
- **Switch-off readers stay on today's rule** (`resolvePublicTournamentTheme` and the layout's dark-ground code),
  untouched until Stage 8 deletes them. The share images are the one switch-blind reader that moves now (ruled).

## Part 1 · The rule and the read (server; nothing new on an admin screen yet)

1. **Migration** (next free number; 425 at writing — check `supabase/migrations/` and `MANUAL_PROD_STEPS.json`, other
   sessions claim numbers): `organizations.tournament_look_policy text NOT NULL DEFAULT 'club_default'` with a check
   (`'club_default' | 'always_club'`). **And `tournaments.theme_font`:** it has never been read publicly, so any value
   in it is an invisible pick from the retired font list. First count non-null values on dev and prod (read-only,
   report the numbers); then null them in the same migration so no tournament wakes up in a type nobody saw it choose
   (record the counts in this file). Update `docs/agents/db/DATA_DICTIONARY.md` (the new column; `theme_font` now
   means the tournament's type look, `system | dm-serif | inter`, null = follow) and `npm run refresh:snapshots`;
   `check:dictionary` must pass. The org field rides every org mapping (`lib/types.ts`, `lib/api-auth.ts`,
   `lib/db.ts`, `lib/server-organizations.ts` — the coach-names field is the trail to follow; mind the role-summary
   hook that copies org fields by hand).
2. **The resolver** above, with a case table test covering every row, the "site off but module on" club, an explicit
   FieldLogicHQ own pick, a stale `barlow` value (reads as Classic) and a stale org look on a Tournament Plus org (not
   read). Words for the two choices in one words module (e.g. `lib/tournament-look-words.ts`), noun by plan.
3. **Wire the frame:** `publicFrameRoles`/`publicFrameBand` over the resolver; `data-club-face` on the frame's token
   element in the live layout and the admin preview layout; **card style ignored when the frame is on** (do not set
   `data-card-style` under the frame); Tournament Plus logo = the tournament's only under the frame.
4. **The share images:** the three `opengraph-image` routes take colours, type and mark from the resolver; their layout
   and Stage 6 reveal gates are untouched. These are fetched without the switch, so **this reaches customers as soon as
   it ships** (ruled). Under the default rule the only differences from today: a club tournament with no colours of its
   own shows the club's (was the platform's), a free event shows neutral (was any stale paid colour), a Tournament Plus
   event with no colours shows plain (was a leftover org colour). Count those on prod (read-only) and record them here
   before shipping; report to the owner.
5. **The club-rule API:** the org-settings PATCH accepts `tournamentLookPolicy` (sanitised), added to the admin's
   allowed look fields (Ask 13). **Gate it on the site module for everyone, owner included** (`clubLookEditor` lets an
   owner through on any plan; this field means nothing without a club layer). Add a read for the question: the club's
   tournaments with their own colours — name, start date, the club's state word (`tournamentHomeStatus`, so "on now"
   is the club's own rule), finished or not — excluding deleted; sorted on now → by start date. Tests: the gate, the
   sanitiser, the list's order and its finished split.
6. **The Settings door** (ships on its own, no switch — it fixes a dead link today): hide "Open Public site" on plans
   without the site module, and make the editor's own client gate check the entitlement too (no load-failed page for
   an owner who types the address). Guard test.
7. **Fixture:** a reversible, marked command (`.probe/` or a seed flag) that sets a dev club's rule to either value and
   gives two of its tournaments their own colours (one on now), so Parts 2–4 and the walk have data. Verify
   (`npm run verify:changed`, focused tests, `npm run typecheck` — shared modules and an API contract changed), record
   Part 1 here, hand Part 2 a kick-off. Restart the dev server (new files, shared modules). `/clear`.

## Part 2 · The club side (behind the switch)

The editor learns the switch the way the public pages do: the public-site GET route returns `frameOn`
(`isPublicFrameOn()`), and the new part renders only when it is true. Switch off, the editor is unchanged.

1. **Shared controls, made once:** lift the Look panel's swatch row (two-tone, double ring, 32 px / 44 px on a phone,
   the rainbow Custom) and the three type tiles into kit components both screens use. **Custom gains hex fields** on
   the club screen (the tournament page's `HexField` pattern). The club's "From your logo" pill stays the club's
   (not offered to a tournament — not drawn).
2. **The Tournaments part** at the end of the Look row, drawn as tab 1: part title "Tournaments", a SendRows radio
   pair (words as drawn: "The club's look, unless a tournament chooses its own" / "New tournaments wear the club's
   colours and type. Whoever runs one can give it its own."; "Always the club's look" / "Every tournament wears the
   club's colours and type. Each keeps its own logo."), the hint "Every tournament page says it is hosted by the club."
   League Plus reads "league". Absent on a plan with no tournaments module. The Look row's summary appends
   "tournaments follow" / "every tournament". Read-only viewers see the words, as the rest of the Look row does.
3. **The question** (tab 2) on choosing *Always* when the Part 1 list is non-empty, from `KitDialog kind="question"`
   exactly as ruled (one sentence, names ≤ 3, "(on now)", "and N more", finished counted, foot note left, Not now
   focused, lime action). The radio does not move until confirmed. Otherwise it saves at once with the Saved pill;
   switching back never asks.
4. Measure at 360/390/1280: no sideways scroll, no tap under 44 px; the question fits a 360 phone without clipping its
   buttons. Verify, record, kick-off for Part 3. `/clear`.

## Part 3 · The tournament side (behind the switch)

The tournament-branding GET returns `frameOn`; **switch off renders today's page untouched** (all eight cards, the
old swatches). Switch on renders the new page:

1. **Order:** door, Pages, **Look**, Logo, App icon. Theme, Hero banner, Font and Card style are not rendered; App
   name is not rendered (value kept). Saved banner and card-style values stay in the database (today's switch-off
   pages still read them) until Stage 8 decides their clean-up; `theme_font` was emptied in Part 1.
2. **The Look card, four cases** (tab 3), from the Part 1 resolver applied to the draft:
   - **A · club's tournament, default, nothing saved:** "The club's look" pill first (chosen; its dot is the club's
     two-tone), then the shared swatches; a type line "Type: Serif, the club's"; the preview; the hint "Follows the
     club's look and changes when the club's does. The club sets it on its Public site." with the link only for those
     who may open the editor. The FieldLogicHQ swatch is no longer shown as chosen (the D7 screen half).
   - **B · own colours:** the chosen swatch's double ring, the readability line (`clubColourRoles` words, as the club's
     Look shows), the three type tiles starting on the club's face, the preview. Tapping the pill goes back: it writes
     the theme fields **and `theme_font`** null.
   - **C · *Always*:** a plain lock line "The club uses its look on every tournament: colours and type."; "Change the
     club's look" for those who may edit it (absent, not greyed, for a coach); the preview with the tournament's own
     logo. Logo card unchanged.
   - **D · Tournament Plus:** no pill; the swatches with FieldLogicHQ chosen when nothing is saved and the line
     "FieldLogicHQ, the plain look. Pick a colour to make it yours."; type tiles (Classic when nothing saved); preview.
   - **E · free / Premium coach:** the existing single lock line, words "Your logo, colours and type on this site"
     (behind the switch; switch off keeps today's words, which still describe what Plus gives).
3. **The preview** (ruled A3): the shipped `TournamentBand` and tab row, fed `publicFrameBand` computed in the browser
   from the draft (the resolver is pure), at phone width (390 px, beside the controls from 1,024 px, under them on a
   phone). It is the real component: no hand-drawn copy (the 10-10 ruling's reason). Inert links.
4. **Saving:** the theme rides only when changed (D7, kept); **apply the same rule to type** — `themeFont` rides only
   when a type tile was touched, and `themeCardStyle` / `colorMode` stop riding under the frame. Guard test on the body.
   The route refuses a font outside `system | dm-serif | inter` under the new body (old values in old bodies keep
   working while the switch is off).
5. Words in `lib/tournament-settings-words.ts` (the card title "Look"; the "organization's" inherit lines become the
   club's words where a club layer exists). `check:spelling`.
6. Measure at 360/390/1280 per case (fixtures from Part 1); the preview never makes the page scroll sideways at 360.
   Add `check:layout --changed` entries for the Branding page under the switch. Verify, record, kick-off. `/clear`.

## Part 4 · Review, the walk, the records

1. **`/simplify`** (the shared controls and the resolver are new abstractions), then **`/review`** with these lenses:
   switch off unchanged on the Branding page, the club editor and every public page; the resolver is the only rule
   (grep for `?? org.logoUrl`, `themePreset ||`, `themeCardStyle ??` outside it on switch-on paths); the policy gate
   holds for an owner on Tournament Plus; a coach never sees "Change the club's look"; the question's list never
   includes a deleted tournament or a tournament without own colours; the share images reveal nothing new.
2. **The QA walk** as a checkable Artifact, one purpose (who owns the look). Cover: switch off unchanged (club editor,
   Branding page, a public page); the default rule — a club tournament with nothing saved wears the club's colours and
   type (pick a club with Serif), give it its own, back to the club's; *Always* — the question with names, "(on now)",
   Not now leaves it, confirm, every tournament changes, finished included, own logos kept, back to the default
   restores each one; the coach view (no link); League Plus words; Tournament Plus — plain when nothing saved, no
   leftover org look; free — the lock line; the preview matching the live band; a shared link's preview image under
   *Always*; the Settings door on Tournament Plus. Next ledger §.
3. **Records:** plan §9 "Side · 1a" row, TODO, the ledger, memory; `memory/design_decisions.md` already carries the
   11-02 rulings. `/docs` and `/demos` run at Stage 8 with the rest of the ladder (the guides mention the Dark/Light
   switch and the Branding cards). Tell the owner what follows: Stage 8 (on for everyone) or Stage 10's drawing.

## Part 1 record (2026-11-02, Claude) — built, verified, NOT committed

**Built.** Migration `426_a_club_decides_its_tournaments_look.sql` (applied to dev 2026-11-02; prod `pending` in
`MANUAL_PROD_STEPS.json` — it carries a data-only UPDATE). The one resolver `lib/tournament-look.ts`
(`resolveTournamentLook`, `sanitizeTournamentLookPolicy` / `parseTournamentLookPolicy`, `hasOwnTournamentColours`,
`tournamentsWithOwnColours`); words `lib/tournament-look-words.ts` (noun by plan, possessives written out — the possessive
guard refuses `${noun}'s`). `publicFrameRoles` / `publicFrameBand` are thin wrappers (`publicFrameRolesOf(look)`); the band
carries `face`. The org field rides `lib/types.ts`, `lib/db.ts` `mapOrg`, `lib/server-organizations.ts`,
`lib/api-auth.ts` (the role-summary hook copies role/door fields, not org fields — nothing to add there). Live layout and
admin preview: `data-club-face` on the frame's token element; the mark under the frame is the resolver's (also for
`OrgNavSync`). Share images: `lib/tournament-share-look.ts` `shareImageTheme(orgSlug, tournament)`, called by all three
routes. org-settings PATCH/GET: `tournamentLookPolicy` (in `CLUB_LOOK_FIELDS`, refused without the site module for the
owner too, parsed strictly). Read for the question: `GET /api/admin/org/tournament-look` (the editor's gate,
`publicSiteEditor(write:false)`) → `{ policy, current: [{id,name,startDate,live}], finished }`. Settings door hidden
without the site module; the editor's client gate asks the plan too and says "Your plan doesn't include a public site."
(`PUBLIC_SITE_WORDS.noSiteOnPlan`) instead of "Ask the owner". Tests: `tests/unit/tournament-look.test.ts` (case table,
edges, list order and finished split, gate/door/frame/image guards); the Stage 1 frame guard's band-colour cases moved
to a club org (Tournament Plus no longer lends an org look).

**Where Part 1 departs from the prompt above (each argued from the code):**
- **"Has the site module" uses `planCarriesModule`, not `hasModuleEntitlement`.** The look is the SHAPE question
  (`module-entitlements.ts` says so of `planCarriesModule`); `hasModuleEntitlement` also answers false for a suspended
  org, which would drop a cancelled club's tournaments to the plain look. `canUseAdvancedTournamentBranding` is
  plan-only too, so the two halves agree. The API gate (an ACCESS question) does use `hasModuleEntitlement`.
- **The share images take the COLOUR only.** They draw no mark and use a system sans today; adding a logo or a loaded
  web font is a new card design (an `ImageResponse` font fetch at render time), not the rule moving — owner call, not
  built. Neutral and plain both read as the FieldLogicHQ colour on the image's own dark card (a near-black stripe would
  vanish on it).
- **Under the frame `data-card-style` is `'default'`, not absent.** `globals.css` `[data-card-style][data-color-mode="light"]`
  gives the shell its ground and min-height; removing the marker would have dropped them. And the ORG layout's wrapper
  (`app/[orgSlug]/layout.tsx:205`) carries the org's style above the frame, so the three card variants now exclude
  `[data-public-frame] .card` with a zero-specificity `:where()`.
- **The prompt's Tournament Plus share-image line was wrong:** the images never read the org's colours (no org fallback
  at all), so a Tournament Plus event with nothing saved showed the platform colour before and shows it now. The
  "leftover org colour" change is the band's (behind the switch).

**Counts (read-only).** Dev: `theme_font` non-null 2 (both `inter`) → emptied by 426. Share images on dev (counted after the fixture ran): 5 club
tournaments change from the platform colour to the club's, 1 free event with a stale colour changes to the platform
colour; 22 Tournament Plus tournaments would have borrowed a leftover org look on
the band (behind the switch). **Prod: OWED** — the read-only prod queries were refused by the session's permission
classifier; the owner runs or approves `node scripts/db-query.mjs --prod -f .probe/stage1a-look-counts.sql` before shipping
(read-only; the same query as the dev count). Record the prod numbers here.

**For Part 3 (a trap found on the way):** `app/api/admin/tournament-branding/route.ts` stores a `'system'` font as NULL
(:208). Under the new meaning NULL = FOLLOW the club, so a tournament that picks Classic under a Serif club would read
Serif. Under the frame the route must store `'system'` as `'system'`.

**Fixture (dev only):** `node .probe/stage1a-look-fixture.mjs default|always|undo` — club `uat-rep-club` (purple, now
Serif), own colours on Rep Club Invitational (on now, pink), Stripe walk invitational (coming, ocean) and Summer Slam
(finished, crimson); the first run saves a backup, `undo` restores it. Checked on dev: default → pink band
(`--club-fill #D04072`, darkened for contrast), `data-club-face="dm-serif"`; always → the club's `#47166C`.

**Verify.** Typecheck clean; focused suites green; full `npm test` 13,310/13,316 with 6 failures in other sessions'
work (stage-6 walk HTML, bookkeeping ExpenseFormWindow, two billing tests) — this part's possessive slip found there and
fixed. `verify:changed` stops at `npm test` for those, and its focused ESLint step fails on a missing `react-hooks`
plugin config (environment); ESLint run directly on every file this part touched: 0 errors. Gates run one by one:
spelling, contrast, public tokens/type, dictionary coverage, manual prod migrations, snapshot freshness OK;
schema parity lists the new column dev-only (expected until prod), the other failures name other sessions' files.

**Committed `4c2efbce6` 2026-11-03** (owner yes, before Part 2). The schema snapshots were left out of that commit: they
also carry other sessions' tables (migs 427/428); the next snapshot refresh commits them.

## Part 2 record (2026-11-03, Claude) — built, verified, committed `cb9e17d3b` 2026-11-03 (with Part 3)

**Built.** The shared controls `components/admin/kit/club/LookControls.tsx` (+ `.module.css`): `LookSwatches` (the nine
presets two-tone, double ring on the chosen, rainbow Custom whose pickers open under the row, `hex` adds a code field
beside each), `LookPill` (two-tone dot + name — the club's "From your logo" today, a tournament's "The club's look" in
Part 3), `LookTypeTiles` (the three looks showing a given name), `HexField` (lifted from the Branding page, which now
imports it; its local copy and the `.hexInput`/`.mistake` rules went). The club Look panel draws through them; its old
swatch/tile CSS moved verbatim (the strip name's faces stayed). The part: `app/[orgSlug]/admin/public-site/TournamentLookPart.tsx`
(SendRows radio pair, the hint, a reader sees the rule in words; *Always* reads the Part 1 list and asks through
`KitDialog kind="question"` — names, "(on now)", "and N more", finished counted, "Their own looks are kept." in
`footerStart`, Not now focused, lime confirm; the radio waits; with nothing to name it saves at once). It saves through
the Look row's queue (`orgPatch({ tournamentLookPolicy })`, the one pill, Retry). The question's sentence:
`tournamentLookQuestion(noun, list)` in `lib/tournament-look-words.ts`. The editor's GET (`with=editor`) returns
`frameOn`; the page renders the part only when `frameOn && carries.tournaments`, gives the Look panel `hex={frameOn}`, and
appends "tournaments follow" / "every tournament" to the row summary under the same condition. Switch off: no part, no
hex fields, the summary as before. Tests: `tests/unit/tournament-look.test.ts` Part 2 blocks (the sentence in every shape,
the league's words, the switch, the save path, the question's guards, one hex field and one swatch row).

**Measured (dev, rep-club owner, fixture `default`; probes `.probe/stage1a-part2-question.mjs`, `-hex.mjs`).** At
360/390/1280: no sideways scroll; the question fits a 360 phone (window 20–340 px, both buttons 44 px tall on a phone)
and reads "UAT Rep Club Invitational 2026 (on now) and Stripe Walk Invitational will change to the club's colours and
type, along with 1 finished tournament."; Not now has the focus; the radio does not move while asking and Not now leaves
the default; the row summary reads "Purple · Serif type · tournaments follow". Hex fields 44 px on a phone, aligned.
Added the layout screen `admin-public-site-look-ask` (`scripts/layout-screens.mjs`).

**Found on the way, not this part's (reported to the owner, not changed):**
- `check:layout` on the editor's Look screens flags the swatches and the From your logo pill at 768 px (32 px; the
  sheet makes them 44 px only at ≤ 640 px) and each SendRow radio's native input (18 px; the row is the target — the
  same finding other screens carry in the baseline). Neither is new: the CSS moved verbatim. They were never measured
  because the layout helper `openBuilderRow` checks the row's toggle once at the h1, before the editor's own read draws
  the rows, so the Look row usually stayed closed. Not baselined here.
- A hydration mismatch on the editor's header address (`localhost:3000/uat-rep-club` vs empty on the server: the page
  reads `window` while rendering). Pre-existing, the Stage 4e header.

**Verify.** Typecheck clean for this part (`NODE_OPTIONS=--max-old-space-size=6144`; the one error is another session's
missing `./CoachScores` in the league team page). Focused suites 69/69. ESLint on every touched file: 0 errors.
`check:spelling` OK; `check:admin-type` flags only other sessions' files.

### Part 3 kick-off

Execute `docs/projects/active/PUBLIC_TOURNAMENT_STAGE1A_BUILD_PROMPT.md` **Part 3** (the tournament side, behind the
switch). Parts 1 (`4c2efbce6`) and 2 (see its record; confirm with the owner whether it was committed) are in. Start
from: `components/admin/kit/club/LookControls.tsx` (`LookSwatches`, `LookPill` for "The club's look", `LookTypeTiles`,
`HexField`), `resolveTournamentLook` / `publicFrameRolesOf` in `lib/tournament-look.ts` + `lib/public-frame.ts` for the
draft's preview, and the trap in the Part 1 record (the branding route stores `'system'` as NULL; under the frame it
must store it). The tournament-branding GET must return `frameOn`; switch off, today's page untouched. Fixture:
`node .probe/stage1a-look-fixture.mjs default|always|undo`.

## Part 3 record (2026-11-03, Claude) — built, verified, committed `cb9e17d3b` 2026-11-03 (with Part 2)

**Built.** `app/[orgSlug]/admin/tournaments/branding/LookCard.tsx` (+ `.module.css`): the Look card in its four cases from
`resolveTournamentLook` applied to the draft — A the pill chosen with "Type: Serif, the club's" and the follow line (its
"Public site" a link only for `mayOpenSiteEditor`); B the shared swatches with the chosen ring, `lookWords` readability
lines, the three type tiles starting on the club's face; C the plain lock line and "Change the club's look" only for
`mayOpenSiteEditor && mayWriteSite` (a coach: absent); D no pill, FieldLogicHQ chosen with `PLAIN_LOOK_LINE`, Classic. Card
meta: "The club's look" while it follows, else "{preset name or Custom colours} · {type}". The pure half
`branding/look-draft.ts`: `lookOfDraft` (the draft as a saved look) and `frameBodyOf` (the save under the frame). The page
(`page.tsx`) learns `frameOn` + the band's facts from its GET; switch on it renders door, Pages, **Look**, Logo, App icon
(App name hidden, value kept; the logo hint says the club's/league's fallback, or none on Tournament Plus; the App icon's
"Brand" is the colour the band wears); switch off it renders exactly today's page and today's body. The free/Premium lock
line reads `LOCK_WORDS.brandingLook` ("Your logo, colours and type on this site") under the frame only. Words:
`tournamentLookCardWords(noun)`, `PLAIN_LOOK_LINE`, `LOOK_PREVIEW_WORDS` (`lib/tournament-look-words.ts`); `look`,
`logoHintFallback`, `logoHintOwn` (`lib/tournament-settings-words.ts`).

**The preview (ask 3) — the shipped `TournamentBand` in a phone window.** `components/admin/kit/club/PhoneWindow.tsx`
renders its children through a portal into a same-origin `<iframe srcDoc>` 390 px wide (never wider than its column),
mirroring the page's stylesheets and font variables, inert and `aria-hidden` (the caption says what it shows), sized to its
content. Why not a box: the band's phone shape is written in `@media (max-width: 900px)` rules, which read the WINDOW's
width — in a box on a desk the real band draws its desk shape. Inside the window the live frame's token element and
`data-public-frame` marker are used as in the admin preview layout; the marker's `html:has()` rule reaches only the
window's own document. `basePath` is the Branding page's own address so Overview reads as chosen; the links are inert.

**The save (D7's rule widened, step 4).** New body under the frame: the theme rides only once touched (as before, now also
`own`), the type rides only once a tile or the pill is touched (`typeLook`), and `themeFont`, `themeCardStyle`,
`colorMode`, `appName` never ride. "The club's look" writes the theme and `typeLook` null. The route takes `typeLook`
(`TOURNAMENT_TYPE_LOOKS` = `system | dm-serif | inter`, a test holds it equal to `CLUB_LOOKS`), stores Classic as
`'system'` (the Part 1 trap), refuses anything else; the old `themeFont` path is unchanged for the switch-off body.

**One shared read for the band's facts.** `publicFrameBandFacts` in `lib/public-frame-server.ts` (registration open + the
tab row's content facts) — the admin preview layout now calls it (same skip-when-hidden rule), and the Branding GET calls it
under the frame with nothing skipped (the draft can switch a hidden page back on). Five older guards that pinned the
preview layout's / page's exact old text were moved to the new shape, keeping their intent (stage 0, 1, 2, 5, 6 suites).

**Measured (dev, probes `.probe/stage1a-part3-look.mjs`, `-switch-off.mjs`; screenshots `.probe/stage1a-part3-*.png`).**
At 360/390/1280 for A (stripe-walk-pay-direct, nothing saved), B (Rep Club Invitational, own pink), C (fixture `always`), D
(uat-test-org, Tournament Plus): no sideways scroll; the window 294/324/390 px; the band 120 px with the right fill (A/C the
club's `#47166C`, B `#D04072` darkened, D `#1E3A8A`), face (`dm-serif` / `warm`), Overview chosen, a Register tab on D
(registration open), no logo on D. Saves: a swatch sent the theme only; the pill sent the theme + `typeLook` null; a type
tile sent `{ typeLook: 'inter' }` only and stored `inter` (put back after). Switch off: today's six cards, the App name
field, today's logo hint, nothing saved on open. `check:layout` entries added (`admin-t-branding-look-club`,
`admin-t-branding-look`): clean at 361/390/1440.

**Found, not changed (for the owner / Part 4):**
- `check:layout` @768 flags the shared swatches and pill at 32–36 px (they reach 44 px only ≤ 640 px) — the same finding
  Part 2 reported on the club editor, now on a second screen. A one-line change in `LookControls.module.css` (44 px up to
  1,023 px) fixes both; it changes the club editor too, so it is the owner's call. Not baselined.
- `check:layout` flags a `Dismiss` button on uat-test-org's admin pages at 361–768 — page chrome, already in the baseline on
  159 screens; not this part's.
- **For `/review` (Part 4):** the window's links are real `Link`s; in a production build Next may prefetch them (they point
  at `/…/branding/schedule` etc., which do not exist). Behind the switch until Stage 8; decide there (a `prefetch` prop on
  the band, or point `basePath` at the preview). The card reads the club's look from the org context, so a change made in
  another tab shows after a reload.

**Verify.** Typecheck clean (`NODE_OPTIONS=--max-old-space-size=6144`). `tests/unit/tournament-look.test.ts` 48/48 (Part 3
blocks: the draft through the resolver in A–D, the save body, the words, the source guards); the related suites (stage 0,
1, 2, 5, 6, admin kit, invite-only) green. ESLint on every touched file: 0 problems. `check:spelling` OK. Dev server
restarted (new files, shared module).

### Part 4 kick-off

Execute `docs/projects/active/PUBLIC_TOURNAMENT_STAGE1A_BUILD_PROMPT.md` **Part 4** (`/simplify`, `/review`, the QA walk,
the records). Parts 1 (`4c2efbce6`), 2 and 3 (`cb9e17d3b`) are committed. New
abstractions for `/simplify`: `LookControls`, `PhoneWindow`, `look-draft.ts`, `publicFrameBandFacts`. Carry the Part 3
"Found" list into `/review` (the window's prefetch, the 768 px swatch size). Fixture:
`node .probe/stage1a-look-fixture.mjs default|always|undo`; case tournaments in `.probe/stage1a-part3-look.mjs`.
