# Owner QA Ledger — everything built and waiting on your eyes (2026-08-01)

> **Added 2026-08-01 (later):** §2.5 — **running a practice at the field (Practice Plans 1b)**.
> ⚠ It is the one item in this ledger that genuinely cannot be judged at a desk; do it outdoors,
> one-handed. Practice Plans **1a** already passed your QA and is committed — 1b is the second half.

> **Added 2026-08-01 (later still):** the whole **Chunk D family experience**, now committed
> (`71b42636`) — §1.6b families following a team · §1.6c the guardian tier (⛔ switched OFF, not
> QA-able yet) · §1.7 the coach byproducts · phone passes in §2.6. Two steps carry more weight
> than the rest: in §1.6b, **flipping visibility to Staff only must remove the DATA** from a
> calendar a family already subscribed — not just hide a link; and in §1.7, the **sparse player**
> check — a recap must go *quiet* where you recorded nothing, never apologetic.
> Also corrected the stale "Chunk D not built" line at the foot of this doc.

> **Added 2026-08-01 (last):** §1.8 + two lines in §2.6 — **the drill library (Practice Plans
> Phase 2)**: write a drill once and adding it to a practice becomes four taps. Its sharpest QA step
> is the **detach** check — a drill's own words are read-only once you use it, and editing them
> deliberately *breaks the link* so "in 8 plans" keeps meaning eight of the same thing. Judge whether
> that bargain feels fair in your hand or like a wall. The §2.6 lines matter as much: the four-taps
> claim is only true if it's true **on a phone**.

> **Added 2026-08-02:** §5.1 — **the tournament creation live preview**, the first item in this
> ledger that is NOT a coaches-portal surface. It needs a **wide desktop window** and about ten
> minutes. Its sharpest step is the one that proves nothing broke: narrow the window and confirm the
> setup wizard is exactly what it was. Second sharpest: the preview must never promise a look the
> published page won't deliver — check the colours against a real public tournament page.

> **✅ PASSED 2026-08-03 — the coach portal DESKTOP SHELL chunk, QA'd live with the working agent
> rather than through this ledger, so it has no step list here.** Covers: the pinned team masthead
> **A2 status line** (record + Game day / Next / Complete, reshaped mid-QA to **Option B** —
> identity left, today's status right, no eyebrow where it would only echo the sidebar) and the
> **Option C rails** (Overview rail **cut** as duplicative; lineup + Dues rails kept and trimmed;
> the Dues chase card reduced to one line with per-family Remind moved into the player's panel, and
> it no longer raises an alarm before anything is actually due). Still uncommitted pending the
> owner's per-action OK.
>
> ⚠ **Test data was deliberately RETAINED on `toronto blue jays5` for future runs** (owner,
> 2026-08-03) — do not clean it up without asking. Everything seeded is marked **`[qa]`** in its
> name: eight events on the live 2026 season (a game TODAY with attendance set — 10 in, 1 out
> named, 1 no reply — plus a full week ahead and a scored-then-cancelled game), and an entire
> **finished 2025 season** (`[qa] toronto blue jays5 2025`, final record **8–3–1**, containing a
> scrimmage win and a scored-then-cancelled win that must never count). That team is now the
> standing fixture for game-day, archive, and cancelled-game-record checks.

> **How to use this:** work a session top-to-bottom, tick `[x]` as you go, jot defects inline under
> the step that failed. When a project's section is fully ticked, tell the working agent "QA passed:
> <project>" — it graduates the project (commit where still uncommitted, with your per-action OK,
> then archive). Source plans are archived (paths noted per section); **this ledger is now the QA
> surface of record.** Steps were extracted from each plan's own QA/acceptance sections; two
> projects had none written — their sections say so and carry a sketch instead.
>
> Sessions are grouped by surface + device so you can batch efficiently: one desktop premium-portal
> pass, one phone premium-portal pass, one free-portal pass, one cross-cutting pass.

## Session 0 — prep (10 minutes, once)

- [ ] Dev server clean restart (stop → clear cache → start) — several of these landed shared files.
      Confirm the app loads and sign-in works.
- [ ] Accounts on hand: **premium head coach, club-owned team** (`j2-rep-coach@dev.local` /
      `devpass123`) · **standalone team** (`coach@dev.local` / `devpass123`) · at least one
      **assistant coach** you can re-toggle between runs (money read / money off / schedule off /
      lineups off / attendance off / roster hidden) · a **free-tier coach** account · a real
      **iPhone** for Session 4.
- [ ] Data states you'll need (ask me to seed any that are missing): a team with a game TODAY, one
      with a game this week, one quiet 3+ weeks, one pre-season (Chunk I); a team with a
      **closed/rolled-forward past season** (Chunk F); a team with **zero budget lines** (Chunk G);
      a team with dated budget lines/expenses/payables across months + a prior season (Chunk H);
      an org rep team with an **admin-linked tournament registration** (Batch 1); free-tier teams
      in the coherence states (Session 3).
- ⚠ Everything below is on **dev only** — nothing is customer-visible yet.

---

## Session 1 — Premium Coaches Portal · DESKTOP

### 1.1 Overview says ONE thing (Chunk I) — built + reviewed, uncommitted
*One priority card, a six-tile board, a quiet tail — replacing nine contradicting bands.*
Archived plan: `archive/COACH_PORTAL_CHUNK_I_ONE_THING_PLAN.md` (its PM brief's "not started" header is stale — trust the plan).
- [ ] As head coach, open Overview on four teams: game-today · game-this-week · quiet 3+ weeks ·
      pre-season. Each shows exactly ONE anchor card, the right shape, six tiles incl. the money
      pair (Dues + Budget), and "Close out the season" on the quiet team.
- [ ] As a default assistant (money off): board shows Attendance + Playing time instead of money;
      quiet team's season-check card has NO button (sentence only).
- [ ] Assistant with money **read**: money tiles visible, zero money write actions anywhere.
- [ ] Assistant with lineups off, game-day team: anchor's action falls back to "Take attendance";
      Playing-time slot falls back to Development.
- [ ] Assistant with attendance off, game-day team: anchor goes informational (no button);
      Attendance tile is absent (not greyed).
- [ ] Assistant with schedule off: "Nothing on your schedule" never appears.
- [ ] Money coach with NEITHER dues nor budget set up: slots 5–6 collapse into one "Set up your
      team's money" tile and Attendance fills the gap (not a missing tile).
- [ ] A finished tournament sits in the tail with a "Finished" chip, never in the anchor slot.
- Note: two coaches on the same team correctly see DIFFERENT anchors — not a bug.

### 1.2 Budget starter (Chunk G) — built, uncommitted · ⚠ review funnel not yet run
*First-season coach answers 5 tap-only questions → seeded budget worksheet; no dollar figure ever comes from us.*
Plan stays ACTIVE (its /simplify → /review → /docs pass is still owed; QA can proceed — expect a
possible small follow-up after the funnel). Plan: `active/COACH_PORTAL_CHUNK_G_BUDGET_STARTER_PLAN.md`. *(No owner checklist in the doc — steps below are the sketch.)*
- [ ] Zero-budget team, write coach: Season Budget Plan shows the first-run card with three doors
      (Start · See a finished example · Add lines yourself).
- [ ] Run the 5-question starter: worksheet placeholders are literally "$" — **no numeric hint
      anywhere**; type some amounts, leave others blank; priced → real lines, unpriced → the
      "Not in your plan yet" strip; ×N entry-fee helper shows its arithmetic at 2+ tournaments.
- [ ] Checklist strip chip opens Add Line prefilled with category/item, amount EMPTY.
- [ ] Sample sheet (all three entry points): clearly fenced fictional team, zero write affordances,
      both tabs render.
- [ ] Read-only money assistant: NO starter, NO strip, NO Add Line — sample door only.
- [ ] Eyeball the five flagged mockup deviations (segmented control, square tick, olive text,
      conditional ×N helper, arithmetic-in-note) — approve or flag.

### 1.3 Money by Month (Chunk H) — BOTH halves built + reviewed, uncommitted
*Spreadsheet-shaped months view + generalized payables page + 3-template import/export.*
Archived plan: `archive/COACH_PORTAL_CHUNK_H_MONEY_BY_MONTH_PLAN.md`. *(No owner checklist in the doc — sketch below.)*
- [ ] Months view on a data-rich team: rows/columns/totals sane; four lenses cycle; Difference
      shows "—" for future months, never a false "under budget".
- [ ] Cash-flow rows: a shortfall month is called out in plain words.
- [ ] Second-season team: prior-season column + "last season only" group.
- [ ] Cell drill-ins open EXISTING forms (never a new editor); read-only assistant gets read panels,
      no drill-in, no import.
- [ ] "Expenses & Payables" rename + new Payment schedule tab (Unpaid default / Paid / All).
- [ ] Import: download a template — **every amount cell empty**; paste rows; editable preview with
      per-row verdicts; nothing writes until confirmed; zero-row commit reports failure honestly.
- Notes: month grid deliberately scrolls sideways on phones. The cumulative chart changed on
  purpose (undated budget no longer smeared across months) — flag, don't file.

### 1.4 The frozen past season (Chunk F) — built + reviewed, uncommitted
*Open any season you coached, read-only, exactly as you could see it then.*
Archived plan: `archive/COACH_PORTAL_CHUNK_F_FROZEN_SEASON_PLAN.md`. *(No owner checklist in the doc — sketch below.)*
**The one rule: switch seasons with the IN-APP switcher, then go TWO screens deep — the worst bug
this chunk ever had was invisible to fresh-page-load testing.**
- [ ] Rolled-forward team (live 2026 + closed 2025): switch to 2025 (sidebar on desktop) and walk
      roster → schedule → attendance → lineups → money (all five sub-pages) → documents →
      development → awards → staff → tryout history → insights. Every screen shows 2025 data,
      zero write controls, "2025 · Complete" chip present.
- [ ] Assistant whose money access DIFFERS between seasons: past season shows what they had THEN.
- [ ] Staff on a past season: capability controls read-only; "Remove access" still works and is
      refused-by-server for the removed person immediately; the one explanatory sentence reads
      right (open micro-item D-F4 — approve or reword).
- [ ] Phone: season switcher lives in the More sheet; the chip doubles as the exit (open
      micro-item D-F3 — does the chip feel tappable enough?).

### 1.5 Player documents & guardian PII gating — built, uncommitted · ⚠ plan header stale, DB half dev-only
*A signed medical form now needs BOTH Documents and Contacts access — an assistant with Documents
alone no longer sees any child's signed forms.* Plan stays ACTIVE (its migration is applied on dev
only and must reach prod with the release): `active/COACH_PLAYER_DOCUMENTS_PII_PLAN.md`. *(No owner
checklist in the doc — sketch below.)*
- [ ] Assistant with Documents but NOT Contacts: no per-player documents section anywhere; team
      TEMPLATES still visible.
- [ ] Grant the same assistant Contacts too: player documents appear and download.
- [ ] Head coach + org admin: no change anywhere.
- [ ] Turning ON Tryouts or Internal-notes access now asks for confirmation first.

### 1.6 Findability, desktop half (Chunk B) — built, uncommitted · ⚠ plan header stale (says "planned")
Code-verified built. Archived plan: `archive/COACH_PORTAL_CHUNK_B_FINDABILITY_PLAN.md`.
- [ ] Sidebar reads **"Email families"** (not "Announcements") and it's obvious which door reaches
      parents vs. staff (Chat).
- [ ] Attendance, Chat, Settings — and on a closed season, Season's End + Insights — each carry a
      "?" opening a guide about THAT screen.
- [ ] A never-toured cold account's Overview leads with the welcome/tour card; dismiss → gone for
      good; tour still reachable from Help. (Needs a genuinely fresh account — dismissal is
      permanent.)

### 1.6b Families follow the team (Chunk D Slices 0–2) — built + reviewed, **COMMITTED** `71b42636`
*One link a coach shares; grandparents follow the schedule; nobody sees a child.*
Plan: `COACH_PORTAL_CHUNK_D_FAMILY_EXPERIENCE_PLAN.md` §9 (build record + the six deviations).
⚠ **Migrations 214–217 are DEV-ONLY.** ⚠ **The guardian tier — a parent connected to their own
child — is BUILT AND SWITCHED OFF pending counsel.** Everything in this section is the FOLLOWER
tier plus the substrate, which carry no child data and are not gated. Guardian steps are in §1.6c
and can only be run once the switch is on.
*(These slices were built in an earlier session; steps below were written against the shipped code,
not the plan headers.)*

**Coach side — sharing and gatekeeping**
- [ ] Premium team → **Roster** (List view, not Depth chart): a **Team family access** card. Note
      it is on the roster INDEX, not the player page the mockup drew it on — deliberate, because
      every control on it is team-level. Flag if you disagree with the placement.
- [ ] **Create link** → copies. Open it in a private window: you get a request page showing the
      **org and team name and nothing else** — no roster, no player names, no counts. That page
      must never become a way to find out who is on a team.
- [ ] Request as a **family follower** (relationship only, e.g. "Grandparent") → the coach's card
      shows a quiet **waiting** count. Nothing should chase you by email or push.
- [ ] **Approve** → the follower sees the team. **Decline** someone → they can ask again (declining
      is not a permanent ban). **Manage → Remove** a follower → access ends immediately.
- [ ] **Reset link** → the OLD link stops working everywhere, and everyone already approved keeps
      their access. This is the "it got forwarded further than I meant" control.

**The visibility setting — enforced on the server, not by hiding buttons**
- [ ] Set **Schedule visibility** to each of **Staff only / Families / Public link** and confirm at
      each level: the family team view, a shared game page, the standing public team page, and a
      calendar a family already subscribed to. **Staff only must remove the DATA, not just the
      link** — a family sees a quiet "not available right now", never an error, and their
      connection stays intact.
- [ ] Sharpest check: subscribe a calendar at **Families**, then flip to **Staff only**. The
      calendar must stop updating. A minted link that keeps serving after you close the door is
      the bug this setting exists to prevent.

**Family side — what a follower actually gets**
- [ ] The team view is **one chronological list, no sections**, opened scrolled to the next event.
      Finished games carry scores; upcoming ones carry time and place. Practices sit inline.
- [ ] **Nothing about any child anywhere** — no roster, no names, no attendance, no fees. This is
      the standing invariant of the whole chunk; if you see a child's name on a follower surface,
      stop and tell me.
- [ ] The team appears in **Following**, so a family reaches it where they already look.
- [ ] **Subscribe** the calendar into a real phone calendar; move a game in the portal and confirm
      it updates.
- [ ] Coach shares ONE game (**Share game link** on the event) → that page opens with **no account,
      on a second device**. A game you did NOT share must not have a page. Sharing is per-game and
      deliberate — never a standing feed of where children will be.
- [ ] Move a game, cancel one, **un-cancel** it, and post a final score → the follower is told each
      time. *(Un-cancel and corrected scores were both silent bugs caught in review — worth
      confirming they now speak.)*

**Substrate (Slice 0) — small, but each closes a real hole**
- [ ] **Email families → unsubscribe.** Send yourself one, use the footer link, then send again:
      you are excluded, and the coach sees only a **count** of opt-outs, never which family. Confirm
      the coach cannot re-subscribe anyone on their behalf.
- [ ] ⚠ **Known gap, not a defect:** free-tier teams still have no unsubscribe (nothing to key it
      against). Recorded and in the counsel packet.
- [ ] **Tryout offer email** → the landing page shows the child's **first name and last initial**,
      not their full name. That page is reachable by anyone holding the link, which is why.

**Known + accepted (recorded, don't file):** the rate limit on no-login links can be dodged by a
forged forwarding header (platform-wide, pre-existing); the four older no-login link types were not
retro-fitted with rate limiting; a phone that had the app open before this shipped may cache the
new family route once before updating.

### 1.6c The guardian tier (Chunk D Slice 2) — ⛔ CANNOT BE QA'd UNTIL THE SWITCH IS ON
*A parent connected to their own child — built, shipped OFF, waiting on counsel sign-off.*
**Do not attempt these until sign-off is recorded and the switch is turned on.** Until then the
correct behaviour is refusal, which is the only thing worth checking now:
- [ ] Open the family link and choose the **parent/guardian** option: you get an honest "not open
      yet" hold state that points you at the follower path — **not** a hidden option, and **not** an
      accepted request parked somewhere.
- [ ] No guardians card appears on any player page.

**When the switch IS turned on, this is the walk:**
- [ ] Parent requests as a guardian, typing their child's **full name** + consents + age band →
      lands in the coach's queue. The form must show them nothing from the roster.
- [ ] The request appears on **every player's card** with the typed name and an explicit
      **"Approve as {player}"** — the coach's assertion that this adult belongs to THIS child must
      be visible in the button, not implied. *(Parent-initiated requests were invisible to every
      coach screen until review caught it.)*
- [ ] **Two households:** a verified guardian invites the second adult; a **third** is refused
      cleanly with a plain message, and the refusal holds even if two coaches approve at the exact
      same moment.
- [ ] **Coach invite → claimed at that same address** ⇒ connected with no second approval.
      **Claimed at a DIFFERENT address** ⇒ goes to the queue, and the row now shows **the address
      the person actually holds** beside the one you invited, saying the mismatch is why it's
      waiting. *(This was the blocking follow-up; fixed 2026-08-01.)*
- [ ] An **unclaimed invite cannot be approved** — it reads "waiting for them to accept" with a
      cancel. Approving one used to mint a guardian with no account and permanently consume a seat.
- [ ] **THE STANDING BOUNDARY — run this every release:** an approved **follower** requesting any
      guardian payload (the player band, the announcements archive, a season recap) must fail
      closed. And a guardian of one child must reach nothing about another.
- [ ] Guardian sees: their child's band, the announcements archive, and — once the season closes —
      the season recap (§1.7).

### 1.7 The coach byproducts (Chunk D Slice 3) — built + reviewed + docs, **COMMITTED** `71b42636`
*Four things your coaching work now produces on its own: an after-game email already written, a
season recap per player, printable certificates, and two "is anyone using this?" counts.*
Plan: `COACH_PORTAL_CHUNK_D_FAMILY_EXPERIENCE_PLAN.md` §9.4 (build record + deviations).
⚠ **Migration 219 is DEV-ONLY.** ⚠ The family-delivered half (the recap a parent reads, the
keepsake) is **dark until the guardian switch flips after counsel** — everything below is the
coach-side half and works today.

- [ ] **Draft the family email.** Schedule → open a game → save a final score. A *Draft the family
      email* line appears under the score; tap **Draft** → Email families opens with subject and
      message written (result + what's next) and a note saying where the words came from. **Nothing
      sends until you press Send.**
- [ ] Same game, **no score yet** → no draft line. **Cancelled** game → no draft line. A **finished
      season** → no draft line anywhere (a closed season must not offer to email a team that's done).
- [ ] After sending that draft, the "we drafted this" note is **gone** and the box is empty. Then
      **Reuse** a past announcement — the note must not reappear over someone else's old words.
- [ ] The draft's **"Next up"** names a genuinely upcoming event. *Sharpest case:* enter scores for
      TWO games on the same day, then draft from the first — it must not announce the second (which
      already happened) as next up.
- [ ] **Recap preview.** Roster → a player → **Family season recap** → **Preview**. You're seeing
      the parent's actual screen. Check attendance, "worked on this season", awards, playing time.
- [ ] **The honesty check — do this on a sparse player.** Pick someone with no development entries
      and no awards: those sections must be **absent entirely**, not empty boxes, not "no data yet",
      and nothing may imply you neglected them. A player with nothing at all recorded gets a short,
      plainly-worded state instead of a hero with holes under it.
- [ ] A test reading reads as **first → latest, as a fact** — no arrow, no green/red, and never the
      word "improved". *(We can't know whether faster or higher is better for your own test.)*
- [ ] Preview is **absent on a finished season** (live-season only, by design — see the open
      decision below).
- [ ] **Certificates.** Insights → "Who's earning it?" → print icon on any row. Then filter to one
      award type → **Print N certificates**. Letter, **landscape**, team colour frame, org name,
      award, player's **full name**, team · season, your note if you left one, and a signature line.
      *(Turn on "background graphics" in the print dialog or the frame won't render.)*
- [ ] **Recap count.** Season's End on a closed season → a **Family season recaps** line reading
      "N of M connected families have opened…". It should be **absent** on a season where no family
      was ever connected (a "0 of 0" would read as failure rather than "nobody signed up").
- [ ] **Club rollup.** Admin → Rep Teams: team cards show **Families** and **Waiting**, plus a
      club-wide line under the title. Counts only — confirm there's nowhere to click through to a
      family's name or email, and that a team with nobody connected shows neither number.
- [ ] Help: the Schedule's **"?"** now reaches the postgame-draft explanation; searching the coach
      guide for *certificate*, *season recap*, *keepsake* and *draft the family email* all land.
- **Open decision for you (not a defect):** the recap preview is live-season only, which is the
  archive's fail-closed default. Should a coach also be able to open a **past** season's recap to
  see what a family is reading? Small either way; your call.
- Known + accepted (recorded, not fixed): the club "Families" total counts links across all
  seasons, so a rolled-over team includes last season's guardians; and family-adoption counts have
  no row cap for a very large club (matches the existing sibling behaviour).

### 1.8 The drill library (Practice Plans Phase 2) — built + simplified + reviewed + docs + probed, uncommitted

> **Mockups you approved:** `claude.ai/code/artifact/d0f7ea26-c159-49ce-b5ec-6af60bd24173`.
> **Where:** Development → **Your drills**, plus the picker inside any practice plan.
> ⚠ **Migration 218 is applied to DEV only.** Prod must have it (and 213) *before* this ships.

**The point of it:** write a drill once — the setup, what you're watching for, the coaching points —
and adding it to a practice becomes four taps instead of retyping the same warm-up every Tuesday.

- [ ] **Write one.** Development → Your drills → **New drill**. Confirm there is **no "how many of
      it" field** anywhere, and that nothing suggests a category to you — the list should be *your*
      words, empty until you type them.
- [ ] **Use it.** Open a practice → **Add a block** → **From your drills** → **Preview** → add.
      The station should arrive named, set up, kitted and taught — and **empty of people**.
- [ ] **⚠ The read-only rule, which is the thing to judge hardest.** On that station the drill's own
      words are **text, not boxes**. Who runs it, who's at it and **Just for tonight** are still
      editable. Does that divide feel right in your hand, or does it feel like a wall?
- [ ] **The escape hatch.** Tap **Edit just for this practice** — every word should stay, everything
      unlocks, and the "From your drills" chip disappears. Then check the library: that drill's count
      should have **gone down by one**, because it isn't that drill any more. *(This is the whole
      bargain — the count stays honest because editing breaks the link. If it feels punitive, say so.)*
- [ ] **Two drills, one block = a rotation.** Add a second drill to the same block; the rotate toggle
      should appear on its own. This is how a carousel gets built now.
- [ ] **Save what you already wrote.** On a station you typed yourself, **Save to my drills…** should
      ask exactly one question (category, optional) and change **nothing** about tonight's practice.
- [ ] **Retire one**, then confirm a practice that already used it still reads exactly as before.
      Then restore it.
- [ ] **Add from a past season** — only meaningful if this team has plans from a previous year.
      Anything already in your library shows **greyed out** rather than hidden.
- [ ] **⚠ Wording check (I changed this deliberately):** it says **"In 8 plans"**, never "Used 8×",
      and **"Not in a plan yet"**, never `0`. We don't record what actually got run, so "used" would
      be a claim we can't back. Tell me if that reads as pedantic on screen.
- [ ] **The focus rail now filters.** With drills that have categories in a plan, off-type focus
      areas should go **faint but stay exactly where they are** — nobody disappears, nothing
      reorders, and a player with no category set stays at full strength.
- [ ] **The club's shared set** (org admin → Rep Teams → Shared library → **Drills**): add one, then
      confirm a coach sees it in their picker marked **Club**, can use it, and has **no rename or
      retire buttons at all**. ⚠ It starts empty and there's nobody to fill it on day one — that's
      the accepted cost of building both halves now.
- [ ] **In a completed season:** the **Your drills** door should be **absent** from Development, not
      a link that errors. Your drills are not lost — they belong to the team, not the season.
- [ ] **As an assistant coach** (schedule access, not head coach): the library should be **readable**
      with no write buttons, and **Save to my drills…** should not appear anywhere.

### 1.9 Plan templates, the recap & looking back (Practice Plans Phase 3) — built + docs + probed, uncommitted

> **Mockups you approved:** `claude.ai/code/artifact/7ac29440-1e16-4b0e-a22b-9e0093470107` (12 frames).
> **Where:** Development → **Plan templates** · any practice plan · Insights → **Development**.
> ⚠ **Migration 221 is applied to DEV only.** Prod must have it (and 213 + 218) *before* this ships.
> ⚠ 18/18 layout probes green at 361 / 390 / desktop; 913 unit tests green.

**The point of it:** you have a Tuesday you'd run again — keep it, and start from it next week. Then
say how it went afterwards, so "what did we do about hitting last spring?" has an answer.

- [ ] **Save one.** Open a practice with a plan → **Save as template…**. It should ask exactly one
      question (tags, optional), pre-filled from what the practice is already about, and change
      **nothing** about tonight. Check the wording says players and staff aren't saved.
- [ ] **Build one from nothing.** Development → **Plan templates** → **New template** on a team with
      none. You should land in a **full blocks-and-stations editor**, not a rename box.
      *(You ruled this: refusing at zero while allowing it at one is arbitrary. Judge whether the
      room earns its keep at zero, or whether it feels like a lot of screen for an empty list.)*
- [ ] **⚠ A template holds no people.** In that editor confirm there is **no Choose players, no
      "Who runs it", no group draw and no "Just for tonight"** — absent, not greyed out. The
      rotation keeps *how often groups move* but not the groups.
- [ ] **Use it.** On a practice → **Start this plan from…**. It should be **ONE control with two
      tabs** — a template *or* a previous practice — not two buttons. The old "Copy from a previous
      practice" wording should be gone.
- [ ] **⚠ THE SEAM — judge this hardest.** After loading a template, the line at the top says
      *"Started from X. This plan is yours now — edit anything."* Everything **is** editable — except
      a station that came from **your drills**, which stays read-only inside it. **Two opposite rules,
      one screen apart.** Does that read as coherent, or as a bug?
- [ ] **Nothing leaks either way.** Change tonight heavily, then reopen the template — unchanged.
      Edit the template, then reopen the practice — unchanged.
- [ ] **Rename / Retire / Restore** in the room. A retired template **dims in place** rather than
      vanishing, and a plan already started from it reads exactly as before.
- [ ] **"Started 8 plans"**, never "Used 8×", and **"Not started a plan yet"**, never `0`. Same
      honesty rule as the drill library. Tell me if it reads as pedantic on screen.
- [ ] **The filter chips.** One flat list narrowed by tags — never headings. **"No tags"** appears
      whenever it applies, so a template can't get lost by having none.
- [ ] **Your tags** (button in the room, or in Your drills). Rename one and confirm it re-labels
      **everywhere at once**. Then **Merge** two near-duplicates and confirm every drill, template,
      practice and focus area came along. ⚠ Club-shared tags should not be listed here at all.
- [ ] **How it went.** Under the plan, write a note. It should autosave, say *"about the practice,
      not about a player"*, and say families never see it. ⚠ **Confirm there is no per-player
      version anywhere** — that is a hard line, not an omission.
- [ ] **A practice with no note says so** — *"Nothing written down for this one"*, never blank.
- [ ] **⚠ The coverage answer — the one screen that names a child who's been missed.** Insights →
      **Development**. Check: **roster order only**, **no sort control on any column**, and the
      *In a plan* column shows a **tick or the words "— not in a plan yet"** — never a count, a
      percentage or an average beside a name. **The exact flag wording is yours to approve.**
- [ ] **⚠ It stays QUIET when it can't answer honestly.** On a team with fewer than three plans, or
      where you never named players in one, that column and its finding should be **absent** — not a
      screen of flags. *(This is deliberate: naming players in a plan is optional, so flagging your
      whole roster would be us misreading our own data as a coaching failure.)*
- [ ] **Practices you've run.** Filter to a tag and confirm you get every practice with that tag,
      what was in it, and what you wrote. **This is the payoff for writing recaps at all** — judge
      whether it feels worth the writing.
- [ ] **⚠ Two kinds of truth, one page.** Coverage says *planned*; only this section describes what
      happened. Tell me if that divide is legible or just looks inconsistent.
- [ ] **⚠ THE NEW ARCHIVE DOOR.** Switch to a **completed season** and open Insights → Development →
      **Open the plan →**. It should open **read-only**, with the season on the page and **no edit,
      delete, run or save controls at all**. *(You ruled this door open explicitly — everything else
      in Practice Plans stays live-season only.)*
- [ ] **And the door stays narrow.** In that same completed season, the **Schedule** must still show
      **no practice-plan section** — that was closed in 1b and is not reopened.
- [ ] **In a completed season the Plan templates door is ABSENT** from Development, not a link that
      errors. Templates belong to the team, not the season, so nothing is lost.
- [ ] **As an assistant coach** (schedule access, not head coach): the template room is **readable**
      with **no Rename, Retire, New or Your tags buttons at all**, and **Save as template…** doesn't
      appear on a plan.

### 1.10 Ask the Front Office, Phase A — built + simplified + reviewed + docs, **COMMITTED** `5ce226a4`
Archived plan: `archive/ASK_FRONT_OFFICE_PLAN.md` + `_PM_BRIEF.md`. Mockups (binding):
https://claude.ai/code/artifact/14a812e8-1fe0-429c-9c54-beab7a581038

On **Insights**, between "What stands out" and the report tiles, a one-line bar: **Ask about your
team**. It opens six ready-made questions; each answers in a sentence with the records underneath.

- [ ] **At rest it is ONE LINE.** Open Insights and confirm the bar costs almost no height and shows
      no questions until you tap it. It should read as a bar to tap, **not a search box** — if your
      instinct is to click and start typing, that's the defect, tell me.
- [ ] Tap it. Six questions on a diamond team. Tap **"Who hasn't played a position lately?"** — a
      position row opens **already on the position with the longest gap**, and the answer names a
      player, a gap, and the last game they played there.
- [ ] **⚠ THE SHARPEST STEP — the receipts must prove the sentence.** Whatever date the sentence
      cites ("the last time was July 12 vs Falcons"), a receipt row for **that exact game** must be
      in the list below. This broke in four places during review; it is the feature's whole promise.
      Tap through several positions and check the citation every time.
- [ ] Tap a **receipt link** — it should take you to the full report, and the back button should
      return you to the page where you left it (this is why it expands in place, not in a pop-up).
- [ ] **"What does each family still owe?"** — if you have siblings on the roster, they must appear
      as **ONE family with a combined balance**, not two rows. Check a family whose surname differs
      from the players'.
- [ ] **"Who's missed the most practices?"** — the number must match the dates listed underneath.
      If someone has an unrecorded (no-reply) practice, it must **not** count against them.
- [ ] **On a brand-new team with nothing recorded:** every question says plainly that nothing is
      recorded and names **the one thing** that would fill it in. No zeros, no blanks, no apology.
- [ ] **As an assistant coach WITHOUT money access:** the two money questions are **absent from the
      list entirely** — not greyed, not erroring on tap.
- [ ] **As an assistant with money but NOT guardian contacts:** the family answer labels families by
      **player names** ("Maya and Sam's family"), and siblings are still grouped as one.
- [ ] **In a completed season:** the ask bar is **absent from Insights**, not an empty box.
- [ ] Read the guide: **Help → Asking about your team**, and confirm the Insights help "?" opens it.

### 1.11 Tryout Insights — report · development baseline · candidate memory (all 3 phases) — built + simplified + reviewed + docs, Phase 1 **COMMITTED** `14969fbc`, Phases 2–3 uncommitted

> **Mockups you approved (binding):** https://claude.ai/code/artifact/3b8bf1f9-c1c5-407c-9fa6-376a5bf8fee2
> **Where:** Coaches → **Tryouts** → the **Decide** and **Build team** tabs, plus any player's
> Development page.
> ⚠ **Migration 223 is applied to DEV only** — the development-baseline half **will error until it
> is applied**. It joins the 214–222 dev-only queue; prod needs all of them before any of this ships.
> ⚠ **No rendered-layout check was run** (it needs a live dev server), so the memory strip's
> appearance — **especially the phone stack** — has had no automated eyes on it at all. Judge it hard.
> ⚠ **Needs a tryout with at least one PRIOR season of tryout data** to exercise the memory half.
> A first-season team correctly shows none of it — which is right, but tests nothing.

**The point of it:** the tryout stops being a one-day tool. It leaves behind a document you can hand
your board, a starting point for every new player's season, and — at the moment you're deciding —
what this kid looked like the last time they stood in front of you.

**Phase 1 · the report** (Build team tab)
- [ ] **The funnel tells the truth about drop-off.** Registered → Attended → Evaluated → Offers
      extended → Accepted → On roster, with honest captions ("3 never checked in", "1 declined").
      Check each number against what you know actually happened.
- [ ] **⚠ "Offers extended" vs the Decide tab's "offered" — these are ALLOWED to differ**, and I
      relabelled the report row so they stop looking like the same number arguing with itself. The
      report counts every offer you **ever** made; the Decide tally counts who is offered **right
      now**. Offer someone, then change your mind, and the report should still count that offer.
      *(Frame 01 said just "Offered" — this is a deliberate deviation. Tell me if it reads wrong.)*
- [ ] **The fairness receipt states only what's true.** Run a tryout with **no blind mode** and
      confirm the blind line is **absent** rather than reworded. Never scored anyone? The whole
      receipt block should be gone, not empty.
- [ ] **Board summary (PDF)** — totals and roster names only. Confirm there is **no child's score and
      no cut decision anywhere in it**; this is the one you'd hand a parent.
- [ ] **Full detail (PDF/Excel)** sits behind a confirmation that names the consequence. While names
      are still hidden it must be **unavailable** — not merely warned about.

**Phase 2 · development baseline** (Build team tab, below the report)
- [ ] **Seed one.** After accepting anyone, **Start development from tryouts → Begin**. Walk two or
      three players.
- [ ] **⚠ "Don't add" must write NOTHING.** Answer it for every suggestion on one player, finish, then
      open that player's development page and confirm **no focus area was created**. This is the whole
      promise of the step.
- [ ] **A player nobody scored** should say so plainly and let you set focus by hand — never block.
- [ ] **Re-run the walkthrough.** Already-seeded players should be marked done and skipped. Then edit
      your scorecard and confirm an existing baseline is **not** rewritten.
- [ ] **On the player's development page**, the snapshot is visually **apart** from measurables
      (dashed edge) and says it's coach-eyes-only. Confirm it does **not** join any trend line.

**Phase 3 · candidate memory** (Decide tab)
- [ ] **⚠ THE FLOW THAT WAS BROKEN — test this first.** With names still hidden, open Decide (bibs
      only, no history — correct). Go to **Set up → Reveal names**. Come back to **Decide
      WITHOUT refreshing the browser**. Names must appear and the strips must load. *(This failed
      until review caught it — a mount-once load meant you'd have concluded the feature didn't work.)*
- [ ] **Confirm a returning player, still without refreshing.** Tap **Possible returning player —
      verify**, confirm the match, and the memory strip must appear **immediately** on that row.
- [ ] **The comparable case:** both years on the same scale → last season's score, this season's, and
      a **▲ +0.7**-style change between them. **Compare categories** opens it skill by skill.
- [ ] **⚠ The incomparable case — the honesty test.** Two seasons on **different scales** (1–10 then
      1–5) must show **both cards and NO arithmetic**, with a line naming the two scorecards. If you
      ever see a delta across mismatched scales, that's the defect.
- [ ] **An unverified match shows NO scores.** A "Possible returning player" you haven't confirmed
      gets the verify button and nothing else.
- [ ] **⚠ THE BLINDFOLD — check the absence.** While blind evaluation is on, confirm there is **no
      prior-season anything** on the **field scorer**, the **live scoreboard**, or **check-in**.
      Check-in's existing "tried out in {season}" marker is identity only and unchanged — that one
      stays. A bib number must be just a bib number.
- [ ] **The report's group line** (Build tab, under Turnout): with **3+** verified returning
      candidates comparable on one scale, it states how the group moved. With **1 or 2**, it must be
      **absent entirely** — silence, not a hedged sentence.
- [ ] **📱 Phone (390 and ~360).** The two seasons should **stack** with the change between them, and
      the decision buttons stay full-width and reachable. **Nothing automated has looked at this.**
- [ ] **As an assistant coach without tryouts access:** no tryout surface at all, as today.
- [ ] Read the guide: **Help → How to run tryout day**, and the new FAQ *"Can I see how a returning
      player did at last year's tryout?"*

---

## Session 2 — Premium Coaches Portal · PHONE (real device; 390 and ~360 widths)

### 2.1 Mobile overlay safety + Tournaments revival (Batch 1) — COMMITTED, phone QA owed
Archived plan: `archive/COACH_PORTAL_LAUNCH_BATCH1_PLAN.md`.
- [ ] Every add/edit form (Add Player, Add Expense, dues credit/schedule, budget line, payment
      request, fundraiser) opens as a full-height sheet, back-arrow header, Save visible above the
      home indicator, bottom nav hidden while open.
- [ ] Long form scrolled to bottom: last field not trapped under the sticky Save bar.
- [ ] More menu on a short phone (~360×667): scrolls internally; team switcher + sign-out reachable.
- [ ] Tournaments page, three states: org team with admin-linked registration → tournament listed;
      org team without → honest "your org admin links these" copy; standalone team → "register with
      this email" + Browse public tournaments link. Sorting: live first, then upcoming, then past.
- [ ] Warm + dark themes, org-linked + standalone teams. Use a FRESH tab (the one past
      "misaligned labels" report traced to a stale tab).
- [ ] Budget modals on desktop got a slight chrome change (shared panel background) — eyeball, not
      a regression. Roster initials avatars removed on purpose.

### 2.2 The "first week" bundle (Batch 2) — built + reviewed, uncommitted
Archived plan: `archive/COACH_PORTAL_LAUNCH_BATCH2_PLAN.md`.
- [ ] Bulk add on an empty roster: paste mixed formats (`12 Jordan Smith` / `Jordan Smith` /
      `Jordan Smith 12`) → preview reads them; fix one row, remove one, commit. Then the
      spreadsheet tab with the CSV template.
- [ ] Duplicate jerseys (in-paste and vs. existing roster) flagged BEFORE saving.
- [ ] Add Player / Add Event: only essentials show; "+ Add details" reveals the rest; editing a
      record with extra data shows details pre-expanded.
- [ ] Permissions: granting money/contacts asks first; revoking is instant; removing an assistant
      uses the app's styled dialog, not the browser's.
- [ ] New team: momentum ring lights up across roster → game → lineup → announcement → budget;
      game-today still outranks it; ring retires when all five are done-or-skipped;
      Skip + Undo round-trip works.
- [ ] 390 and 360 widths: no sideways overflow, no button under the nav; warm + dark.
- Note: paste captures names + numbers ONLY (no emails/DOB — by design); 200-row cap with a
  visible truncation warning.

### 2.3 Money on a phone (Chunk A) — COMMITTED, phone QA owed
Archived plan: `archive/COACH_PORTAL_CHUNK_A_MONEY_ON_A_PHONE_PLAN.md`.
- [ ] Budget line with period splits: full-width tappable fields; backdrop tap asks "Discard
      changes?"; "Keep editing" preserves everything.
- [ ] Budget vs. Actual: sideways-scroll hint; line names pinned; the page itself never scrolls
      sideways.
- [ ] Expenses (both tabs), Fundraiser leaderboard + Log Amount, Org Allocations: stacked cards,
      real full-width inputs; Allocations cross-links to Payment Requests.
- [ ] Money hub headline numbers agree on "(paid only)".
- [ ] Read-only assistant: same readable pages, zero write buttons, no blank card rows.
- [ ] Desktop: Budget vs. Actual uses the window width (no ~960px inner scroll column).
- [ ] No native browser alert anywhere in Money (a failed delete shows an inline error).

### 2.4 Findability, phone half (Chunk B) — built, uncommitted
- [ ] More sheet: **Notifications** row at top with unread count; count also badges the More tab;
      the feed opens; "Notification settings" reaches account settings.
- [ ] More sheet reads "Email families"; sheet still fits its height cap at 361px.
- [ ] As an assistant: rows/icons present, nothing offers an action they can't perform.

### 2.5 Running a practice at the field (Practice Plans 1b) — built + reviewed + probed, uncommitted
*Tuesday night, one hand, gloves on: the plan you wrote now reads one block at a time.* 1a (writing
the plan) already PASSED your QA and is committed; **this is the second half only.**
Plan: `active/COACH_PRACTICE_PLANS_PLAN.md`.
**Do this one OUTSIDE, or at least standing up and holding the phone one-handed — the whole screen
is an argument about arm's length, and it can't be judged sitting at a desk.**
**Fastest way in:** open a practice that has a plan → **Run practice** (also on the plan's own
toolbar). No plan handy? Ask the agent to seed a probe practice — it prints a direct link.
- [ ] **Readable at arm's length in daylight.** Block title, the countdown, the note. If you have to
      bring the phone closer, say so — that's the one thing this screen exists for.
- [ ] **Next block / Back** are easy to hit without looking. Nothing needs a swipe or a long-press.
- [ ] **A rotation:** the three group cards say who's where and who's running it; **Rotate now**
      moves everyone on; after the last round the button goes back to **Next block**.
- [ ] **Let a block run past its time on purpose.** The clock turns amber and says "Rotation due" —
      and then just waits. ⚠ **Confirm it never beeps, buzzes or moves on by itself.**
- [ ] **Start it "late":** open it, tap Next block a minute in, and check that block gets its full
      length from that moment rather than reading as already overdue. *(This was your ruling — it's
      the behaviour most worth a real-world sanity check.)*
- [ ] **"My station":** tap a station. Does it tell whoever's running it what they're doing, **what
      they're watching for**, and who's coming next? Is that genuinely enough to hand to an
      assistant who's never seen the plan?
- [ ] **Who's here tonight** opens folded shut at the bottom, read-only, and the names match
      attendance.
- [ ] **Nothing to fill in anywhere.** If you find yourself looking for a "we did this" tick, tell
      me — that's a deliberate omission and worth re-opening only if it bites you in practice.
- [ ] **In a completed season:** open an archived practice — the practice-plan section should be
      **absent entirely** (not a link that errors). *(This closed an existing bug; your call.)*
- [ ] Help "?" on the run screen opens a guide about **that** screen, not the builder.

### 2.6 Phone passes of Session-1 items (quick)
- [ ] Chunk G starter end-to-end on a phone (tap-only questions).
- [ ] Chunk H months grid scrolls sideways with first column pinned (by design).
- [ ] Chunk F: switcher in More sheet; "2025 · Complete" chip as the way back out.
- [ ] **Chunk D 0–2 — do this one as a FAMILY, on a real phone, not as a coach.** The whole
      follower experience is phone-first and arrives from a group chat: open the family link on a
      phone, request, get approved, and confirm the schedule opens **scrolled to the next event**
      without you scrolling. Then subscribe the calendar into the phone's own calendar app.
- [ ] Chunk D 1: open a **shared game link** on a phone with **no account and no app installed** —
      the grandparent case this feature exists for.
- [ ] Chunk D 3: save a score on a phone → **Draft the family email** is reachable and the compose
      screen opens with the words in it (this is a real game-day-on-the-sideline moment).
- [ ] Chunk D 3: the recap **preview** on a phone — the stat tiles should stack to one column on a
      narrow screen rather than squashing to two.
- [ ] **The drill library (§1.8) on a phone — this is where it actually earns its keep.** The whole
      claim is *"a plan becomes four taps"*, and the moment that has to be true is a coach on a couch
      with about four minutes. Build a block from a saved drill end-to-end on the phone: **Add a
      block → From your drills → Preview → Add**. Count the taps. If it isn't roughly four, the
      feature hasn't delivered its point and I'd rather know that than hear it works.
- [ ] The drill library on a phone: a station that came from a drill should read as a **short block
      of text**, noticeably shorter than one you typed yourself — that contrast is deliberate, so
      you can tell at a glance where a station came from without reading a chip.
- [ ] **Plan templates (§1.9) on a phone — this is where the whole feature is meant to pay off.**
      The claim is *"next Tuesday starts from last Tuesday"*, and the moment it has to be true is a
      coach on a couch with four minutes. Do it end-to-end: **Start this plan from… → A template →
      the template → edit one block**. If it isn't faster than rebuilding, the feature hasn't
      delivered its point and I'd rather know that than hear that it works.
- [ ] **"How it went" on a phone, at home, after a practice** — that is the only moment it will ever
      be written. If typing it there feels like paperwork, it won't get written, and everything the
      looking-back list is for goes with it.
- [ ] The Development report on a phone: the coverage table reflows to **stacked cards** at ~360,
      and **Practices you've run** keeps its date, name and tags readable without sideways scroll.
- [ ] The read-only past plan on a phone: it should read as a **record** — no controls anywhere, the
      season visible, and one way back to the list.

---

## Session 3 — FREE coach portal · phone-first

### 3.1 Overview coherence (DF-1…DF-7) — COMMITTED, QA owed
Archived plan: `archive/FREE_COACH_OVERVIEW_COHERENCE_PLAN.md` (its PM brief's "nothing built" header is stale).
- [ ] One accepted upcoming tournament: ONE "Your tournament" block with the ⇄ fan-view link,
      no duplicate event card, 2-up tiles, Tournaments tile full-width with "See all →".
- [ ] Two tournaments, one live today: block names the LIVE one.
- [ ] All tournaments finished: block names the most recent, correct status chip.
- [ ] Brand-new team: "Let's set up your team" visible WITHOUT scrolling; tool tiles read "Not on"
      + one line each (no zeros); Tournaments tile reads 0.
- [ ] A real figure always beats "Not on" (tool off but data exists → number shows).
- [ ] Entry fee owed: Fees tile shows it in alarm styling even with the fees tool off.
- [ ] Mixed accepted + rejected entries: a REJECTED registration never headlines; a live event's
      card still shows its true status (not implied-accepted).
- [ ] Cross-check the PREMIUM Overview still names its live event correctly (shared logic was
      touched).
- Known + accepted: "ANNOUNCEMENTS" tile label wraps to two lines at 360px — override or accept.

---

## Session 4 — Cross-cutting: dismiss/Escape sweep — built + reviewed, uncommitted
*One shared close-behavior for ~19 menus/panels; Escape now works where it didn't; iOS tap-to-dismiss fixed.*
Archived plan: `archive/DISMISS_BEHAVIOUR_SWEEP_PLAN.md`.
- [ ] Desktop spot-check ~6 converted panels (both More menus, notification bell, an admin schedule
      filter, the payee picker, chat emoji picker): open, interact, click-away closes, no visual
      change.
- [ ] Escape on the 7 previously-uncloseable panels: closes AND focus returns to the trigger.
- [ ] **REAL iPhone, Safari — the one check automation cannot do:** tap blank space outside an open
      More menu → it dismisses. Also: a scroll gesture starting outside a panel closes it — does
      that feel OK, not twitchy?
- [ ] Chat: clicking a reaction now also closes the emoji picker (improvement, not regression).
- Deliberately NOT converted (don't file): chat reaction/poll popovers (needs its own approval),
  the coach team switcher (deferred — file was mid-edit elsewhere). Known pre-existing, ticketed:
  payee dropdown ignores Enter/Space for keyboard users.

---

## Session 5 — Tournament admin · DESKTOP (wide window, ~10 min)

### 5.1 Tournament creation live preview (v1) — built, uncommitted
*While an organizer fills in the setup wizard, a phone beside the form assembles their public
tournament page in real time. Desktop-only; below ~1280px the wizard is untouched.*
Plan (with build notes): `active/TOURNAMENT_CREATION_LIVE_PREVIEW_PLAN.md`.

Sign in as an org admin. Do this at a window **wider than 1280px** unless a step says otherwise.

- [ ] **Blank creation.** Create Tournament (from the sidebar, and again from Manage Tournaments).
      The phone appears to the right. Type a name — it lands in the headline as you type; before you
      type, the headline reads a grey "Your tournament name".
- [ ] Set a start date a few weeks out. The badge forms a full date range AND a countdown —
      "First pitch in N days". Sanity-check N against a calendar.
- [ ] Edit the public link. The address under the phone follows it. Clear it → it shows a placeholder,
      never a broken-looking URL.
- [ ] Dates in the past/present: a tournament starting **today** reads "Tournament in progress" (no
      countdown); one that already ended reads "Tournament complete".
- [ ] Step 2 (divisions): the phone's stat row fills in — division count, total team spots, and the
      event's length in days. Add/remove a division and watch it follow. **Skip** the divisions step
      → the counts go back to "TBA" rather than claiming divisions that won't exist.
- [ ] Walk through to the end. The preview stays beside you on every step and never blocks a button,
      and creating the tournament still works exactly as before.
- [ ] **Reuse path.** Create Tournament → reuse setup from a past event. The preview is **already
      filled in** the moment that screen opens (name + dates carried over). Change the name/dates and
      it follows. Its stat row stays "TBA" — divisions get copied after you create the draft, and the
      preview deliberately doesn't guess at them.
- [ ] **The no-change check (most important).** Narrow the browser below ~1280px on both paths: the
      preview is *gone entirely* — no gap, no stacked panel, no shifted buttons. The wizard should
      look and behave exactly as it does on today's shipped version. Also check a phone-width window.
- [ ] **Honesty check.** Open a real published tournament page for this org in another tab and
      compare: same colours, same date wording, same countdown wording. Note — an org whose plan
      doesn't include custom branding will correctly see the FieldLogicHQ default colours in the
      preview, because that's what its public pages actually publish in.
- [ ] The "blank or reuse?" chooser screen has no preview — that's deliberate (nothing is filled in
      yet), not a missing panel.

**Colour presets (v1.1) — needs a Tournament Plus org AND a free-plan org to judge properly:**
- [ ] **Plus org, blank creation.** A row of nine colour circles sits above the phone, starting on
      your organization's current colours with that theme's name underneath. Click through a few —
      the whole preview repaints (hero wash, date badge, Register button).
- [ ] **The pick is real.** Choose a colour that is clearly *not* your org's, finish creating the
      tournament, then open its public page (or Branding under tournament settings). It should have
      the colour you picked.
- [ ] **Untouched stays inherited.** Create another tournament without touching the row. Its Branding
      screen should show no tournament-specific theme — it follows the organization. (This is the
      point: change your org colours later and that event follows along; the one you deliberately
      coloured does not.)
- [ ] **Reuse path.** Reuse a past event that has its own colours, with "Public presence" ticked. The
      swatch row and phone should show *that event's* colours, not your organization's. Untick
      "Public presence" → both fall back to your org colours. Re-tick → back again.
- [ ] **Override on reuse.** With "Public presence" ticked, pick a different swatch and create the
      draft. The new tournament should have the colour you picked, not the copied one.
- [ ] **Free-plan org: nothing at all.** Sign in as an org on the free Tournament plan and open the
      wizard on a wide window. The preview appears, but there must be **no swatch row, no greyed-out
      circles, and no upgrade prompt** — as if the feature doesn't exist.
- [ ] **Permission check.** A member without the manage-branding permission (Members → permissions)
      should also see no swatch row, even on Tournament Plus.
- [ ] **Keyboard.** Tab into the swatch row and press Enter/Space — it should select, with a visible
      focus ring.
- Note: an organization using a *custom* colour rather than one of the nine presets will see no
  circle highlighted and the caption "your organization's own colours" — correct, not a bug.
- Note: the row only exists where the preview does, so a narrow window has no colour control.
  Branding under tournament settings remains the full-time home for colours, logos, and banners.
- Note: the phone shows the top of the page only (headline, dates, registration line, stats). No
  schedule or standings — that's the agreed v1 scope, not an omission.
- Note: there is deliberately **no colour picker** in the wizard. Custom colours are a paid feature
  and putting the swatches in free signup is a pricing decision you haven't made yet.

---

## Not in this ledger (why)

- **Quiet Mode onboarding** — your QA already PASSED (2026-07-29). Blocked on release only: its
  database change must be applied to prod BEFORE the code promotes. Plan stays active as that gate.
- **Practice Plans (1a/1b)** — in-flight project with its own live build prompt; QA rides its own
  handoff.
- **Nav Unification D1/F/G** — QA passed 2026-08-01; top-nav repair phases will bring their own QA
  slices per phase.
- ~~**Chunk D family experience**~~ — **now IN this ledger** (it is no longer "not built"):
  §1.6b Slices 0–2 · §1.6c the guardian tier · §1.7 Slice 3 · phone passes in §2.6.
  All four slices are **committed** as `71b42636` on `dev`. Migrations 214–217, 219 and 220 are
  DEV-ONLY and must all reach prod before this promotes.

## After a session

Tell me which sections passed (and any defects). I'll fix defects, run any owed review funnels
(Chunk G), commit the uncommitted ones with your per-action OKs, mark the TODO lines complete, and
archive the remaining active plans (G, PII, Quiet Mode graduate at release time).
