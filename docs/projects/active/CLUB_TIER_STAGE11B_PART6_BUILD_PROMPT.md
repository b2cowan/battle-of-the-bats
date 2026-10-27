# Club Tier Stage 11b · Part 6: the help (build prompt)

> **Written 2026-10-27** at the end of the session that built Part 5 (commits `e1e40b78f`..`b88d488f0`; see
> `HOUSE_LEAGUE_STAGE9_PLAN.md` §9). **Paste this into a new chat on `dev` and run `/docs`.** It continues
> `CLUB_TIER_STAGE11B_BUILD_PROMPT.md` (Part 6's paragraph and the definition of done). This file wins where they differ.
> **Help only: no product code, no migration, no screen.** The owner ruled 2026-10-27 that the 11b walks do not wait for
> this part (walks §399–§403 test the product, not its help). Other sessions share this working copy: `git status` first,
> stage explicit paths only, and if a help file carries another session's edits, commit only your hunks — build the staged
> file from `HEAD` plus your exact edits and diff it against the working tree (only their hunks may remain); a zero-context
> patch misplaces insertions (it happened in Part 5).
>
> **Recommended model: Sonnet is enough for the reading; Opus for the writing** (three articles, the words settled across
> three copy passes, and one shipped sentence that 11b made untrue).

## ⚠ First: a shipped help sentence is now untrue

The club's Schedules guide (`lib/help-content/org.tsx`, the scheduler article, ~813 and the FAQ ~865/867) says **"Only the
teams with changes are told"** / **"Only the teams the changes touch are told."** Since Part 5, Send the changes also tells a
house-league team's coaches **and its families** (one email per household, ruling 9d2·2), and everyone who runs house league
in the bell (league admins, owners and admins — owner 2026-10-27). Fix those first; grep every help file and the hub arrays
for the same claim.

## What to write (the three pieces Part 6 names)

1. **The club's Schedules guide** (`lib/help-content/org.tsx`): House league as a holder (New schedule: all of it, or a
   share; a slot's **Give it to** › House league — copy file "The club gives house league its time"); house league is never
   billed; a League Plus club with no rep teams can schedule; **the club takes time back** (k5: practices on it are cancelled
   when you send the changes, their coaches and families are told, unused time goes with no question); **Send the changes
   with house league in it** (h4: a row per house-league team, who is told, unticking stops a team's emails but not its move,
   game changes go out from the season — 9d-2b).
2. **A new house-league guide, "House league's time"** (`lib/help-content/house-league.tsx` + the hub array in its
   `help/page.tsx` shell): what the club gave and where it shows (the time line, Tools › House league's time); dividing it
   among divisions (a piece is a division's games or practice time; one Save; Choose parts…; a part another division holds;
   giving back time with practices on it asks first); **Practice time** (each practice, teams at once, practices a week, hand
   out, what a second hand-out does, a practice from the club's time can't be cancelled or edited from the house-league side);
   the club's schedule as a league admin reads it (house league's pieces only, a rep slot reads "A rep team…", the one-date
   Use); **what families hear** — a practice CHANGE the club sends emails that team's families once (Now / Was, no link,
   even a family that unsubscribed from club news, because it's about their child); the first hand-out emails nobody (9d-3
   decides); the season's Email families history shows one Automatic "Practices changed" row per send.
3. **The league admin's role article** (where the house-league role summary lives, `house-league.tsx` ~57): what a league
   admin may do in the club's Schedules (house league's own pieces only; never give, take, lock, swap or clear a rep team's
   or an open slot), and that they are told in the bell when the club's send moves their practices. The registrar reads.

## Sources (read, don't restate)

- Settled words: `HOUSE_LEAGUE_STAGE9D2_11B_COPY.md` (every section, including "Part 3" and "Added by the build"). Use the
  product's words exactly; where the copy file and the screen differ, the screen is the truth — say so in your hand-off.
- Rulings: `HOUSE_LEAGUE_STAGE9_PLAN.md` §0h (9d2·2, ·5, ·13, ·15, ·16; 11b·A–D) and §9 (what each part built).
- The screens, to check a label before writing it: the club's schedule page, the slot window, New schedule, the Send
  window; House league's time, Practice time, a practice's window; the coach's team page.

## House rules

`/docs`' own checklist (`.claude/commands/docs.md`). One spelling everywhere, **including `keywords` / `searchText`**
(`npm run check:spelling`); "8:00 a.m."; "league admin", never "convenor"; "house league" lowercase mid-sentence;
sport-neutral ("facility", never a sport's field name in our sentences); `possessive()` shapes in prose (Reds’ practices).
Never promise a notice that doesn't go: the first hand-out emails nobody; a rep team's families are not emailed from Send
the changes.

## Checks and done

- `npm run verify:changed` (a failure in a file Part 6 doesn't touch is another session's — confirm before blaming
  yourself); the help hub's own guards; `npm run check:spelling`.
- Records: `HOUSE_LEAGUE_STAGE9_PLAN.md` §9 (Part 6 line; 11b's parts all built), the scheduler plan's 11b block
  (`CLUB_PERMITS_AND_SCHEDULER_PLAN.md`), memory `project_club_stage9_house_league.md`.
- Hand-off: 11b is then complete pending its walks (§399–§403) and the prod migrations 392–394, 397, 400.

## Do not

- Change product code, words on a screen, or the copy file's settled words (a screen/copy mismatch is a finding, reported).
- Describe 9d-2a/9d-2b (Generate games, Changes to send, the families' game emails) as built.
- Push or promote.
