# Build prompt — Pitch Deck Studio, stages C + D: the composer, then the prospect deck

**✅ EXECUTED 2026-08-21 — both stages shipped to dev (QA §77 + §78, mig 258). This prompt is
kept as the record of what was asked; the plan's "What stage C/D actually settled" sections are
the record of what was built.**

Paste into a **fresh session**. C first, D only after C stands; both are here because D is thin
once C exists and they share one model.

## Read first, in this order

1. `docs/projects/active/PITCH_DECK_STUDIO_PLAN.md` — **binding.** Read ruling 4, "What stage A
   actually settled", and **"What stage B actually settled"** — the last one is this prompt's
   parent and answers questions you will otherwise re-open.
2. `docs/projects/active/PITCH_DECK_STUDIO_PM_BRIEF.md` — the plain-language version.
3. `lib/walkthrough-content.ts` — the library. Its header explains the three levels (library /
   deck / page) and where the save-path rulebook lives.
4. `lib/pitch-pull-store.ts` + `app/api/platform-admin/pitch-deck-studio/pull/route.ts` — stage
   B's store-read and save-path pattern. **C and D copy this pattern; they do not invent one.**
5. `memory/project_pitch_deck_studio.md` (in-repo) and the Claude auto-memory entry of the same
   name.

## ⚠⚠ THE STOP LINES

- **C makes DECK running orders data. It never makes a slide's words data.** Ruling 1 has now
  survived three phases and a declined review-queue offer. If you find yourself adding a text
  field to a deck row beyond its NAME and PURPOSE, stop.
- **Present mode is PUBLIC.** "Present the full deck" is a button on both marketing pages and
  renders the whole deck — so the moment a deck is a row, a public surface reads it. Everything
  stage B built for pulls applies verbatim: lenient resolve, code fallback, a broken row can
  NEVER blank or crash the page.
- **D ships a PUBLIC route** (the unlisted prospect link). It is `noindex`, unguessable, and —
  owner ruling 2 — **the public rendering must never name a real organization or the prospect.**
  The clean way to honour that: the prospect's name is an INTERNAL label only; the public link
  page renders slides and nothing per-prospect. Do not put free text from the composer onto the
  public page.

## Decisions already made — do not re-open

1. **A deck reorder re-orders the live pages automatically, by design.** A saved pull is a SET;
   render normalises to deck order (`resolvePullIds`). So reordering a deck whose page shows a
   saved pull silently re-orders that public page. This is ruling 4 working as intended — the
   composer's job is to SAY it ("this deck is published on /for-coaches/walkthrough — the page
   will follow this order"), never to ask permission for it.
2. **A deck may name only built or `planned` numbers** — `SLIDE_NUMBERS_SPOKEN_FOR` is the
   register, and the refusal names whose a held number is. Build the deck rulebook the way
   `pullProblems` was built: ONE function, shared by the save API and the guard test.
3. **The two standing decks keep code fallbacks** (`PITCH_DECKS`), same discipline as
   `fallbackPull` — they are the known-good composition of record, not a cache. Owner-created
   decks (club, prospect) have no fallback; they simply don't render if broken, and the studio
   says why.
4. **F4 is closed.** Every slide carries `pageAnswer` + `seoPhrase` in code. No editorial pass
   remains; any slide can go into any deck or pull and simply work.
5. **No plan, tier or price anywhere in pitch material** — including a prospect deck's public
   rendering and the PDF. The build test + save-path re-check already hold this; extend them to
   whatever new copy surface D adds (deck name/purpose are internal-only, but check them anyway
   — a deck named "Tournament Plus pitch" leaking into a heading is the exact class of accident).

## ⚠ Traps stage B paid for — do not re-pay

- **The persona/audience CHECK constraint on `pitch_page_pulls` is an independent copy of the
  code's audience list** (see the comment above `PITCH_DECKS`). C almost certainly introduces the
  club audience or per-deck rows — that is a MIGRATION, and the CHECK must move with it or the
  first save 500s opaquely.
- **`router.refresh()` preserves client state.** The pull editor shipped a High-severity bug
  where "Return to the code default" left stale checkboxes armed; the fix is the render-time
  resync pattern in `PullEditor.tsx`. The composer's drag state has the same failure mode —
  reuse the pattern.
- **Client components must not import `lib/walkthrough-content.ts`** — it is most of a book and
  it all ships to the browser. Data goes in as small props; pure derivation lives in
  `lib/walkthrough-derive.ts`. Same split for the composer.
- **Two admins editing at once is last-write-wins, accepted** (matches every platform-admin
  tool). Do not build optimistic concurrency; do not remove the audit log's before/after either.
- **Migration numbering:** check `supabase/migrations/` for the current head (257 was this
  project's; other sessions add their own). Apply with `node scripts/apply-migration-api.mjs`,
  refresh snapshots + Data Dictionary in the same unit of work. Schema parity will be RED from
  the standing dev-only queue — confirm your migration is the only NEW drift, then run the
  post-parity checks individually.
- **Render the screen and look at it.** `growth@dev.local` / `devpass123`; the login form needs
  ~3s to hydrate; platform-admin scrolls in a container so scroll each target into view. Drive
  the real buttons with Playwright — the stale-checkbox bug was found only by clicking them.
- **Backslashes do not survive shell heredocs here.** Use the Edit tool for any edit containing
  `\` or `${`.

## What C builds

The composer, in the studio: create and name a deck (name + purpose + audience), reorder it
(drag or up/down — pick what the platform-admin console can do cleanly), add and remove slides,
live preview against the real slide frame (`SlideStage`), and delete a deck that no page depends
on. The two standing decks become editable rows with code fallback; the club deck becomes
creatable (numbers #18–#20 are held for it — building its three slides is NOT in scope, the
register is). The deck cards' pull editors keep working against whatever the deck now says.

## What D builds

Compose a deck for one named prospect (internal label), get: an **unlisted link** — unguessable
slug, `noindex`, renders the deck through the existing present-mode/slide frame, no prospect
name, no real organization — and a **PDF** from the same deck (the print layout exists; print
the DECK, which stage B's notes explicitly deferred to this phase). No analytics (out of scope
by plan).

## Product Manager UX plan first

`AGENCY_RULES.md` makes this blocking: present the plain-language summary before any code.

## Wire up

Plan + PM brief · Owner QA §-row (**next free — check the ledger's tail, other sessions append
too; never renumber**) · `TODO.md` pointer · both memory stores. Then `/simplify` → `/review` →
`npm run verify:changed`. ⚠ `npx next typegen` before `npm run typecheck`.

## Commit

Explicit pathspecs only. **Several sessions share this tree** — check `git status`, filter
foreign hunks out of shared documents (`TODO.md`, the QA ledger, `memory/MEMORY.md`) by staging
HEAD's copy plus only your change, then restoring the working file. `git show --stat HEAD`
after. Commit only on explicit owner OK.
