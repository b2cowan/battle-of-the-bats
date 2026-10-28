# Public tournament pages — draw the end state for every public page (session prompt)

> Written 2026-10-27 for a fresh Claude session. The previous session ran the second review, drew round 1 and
> Stage 1a, and ran out of room. **This session draws; it does not build.** No product code changes.

## The job in one paragraph

The review hub shows the end state for the tournament **Overview** only (game day, before the event, desk). The owner
wants the **whole experience** drawn before they review anything: every public tournament page as a whole phone screen,
**before (the real capture) and after (drawn)**, at true size, in the same hub, on the same Artifact URL. Detailed
controls still belong to their stages (3–6); this pass shows what each page becomes as a whole, so the cumulative
result can be judged. Then run the `/design` check, apply it, republish, and hand off.

## Read first, in this order

1. `docs/projects/active/PUBLIC_TOURNAMENT_SITE_REVIEW_PLAN.md`: the whole plan. §2 (walk findings and defects
   D1–D10), §4 (the frame), §4a (who owns the look), §5 (the Overview), §9 (ladder), §10 (asks), **§10a (the app bar
   decision below)**.
2. `docs/projects/active/PUBLIC_TOURNAMENT_SITE_REVIEW_HUB.html`: the hub source. **Reuse its specimen CSS (the `.tf`
   block) and its colour-roles script**; do not restyle them. Read the whole file before editing (it is ~700 lines).
3. `docs/projects/active/PUBLIC_TOURNAMENT_SITE_REVIEW_FINDINGS.md`: Codex's page-by-page audit (the "Page-by-page
   audit" table). Good inventory of what is on each page today. Where it disagrees with the plan, the plan wins (the
   plan records why).
4. The auto-memory rules that govern mockups: `feedback_mockups_as_claude_artifacts.md`,
   `feedback_always_run_design_on_mockups.md`, `feedback_build_to_approved_mockups.md`,
   `feedback_draw_controls_from_shipped_component.md`, `feedback_mobile_icon_only_actions.md`.

Per CLAUDE.md, send broad reading (component census, rulings searches) to a helper and ask for conclusions, not dumps.

## What changed since round 1 that the drawings must now show

- **The app bar follows where the page is opened (owner, 2026-10-27, direction accepted; details not ruled).** In a
  phone **browser**, club and tournament pages are a website: **no app bar**, and Sign in sits in the band, as on club
  pages. **Inside the installed app**, every page has the app bar. So:
  - Redraw the existing Overview "after" frames as the **browser** view (no bottom bar; a Sign in control in the band
    or tab row, drawn from the club bar's shipped Sign in).
  - Add **one** "inside the app" variant of the game-day Overview with the bar, so the owner sees both.
  - Correct the chrome-budget sentence on the Stage 1 tab (browser: band 72 + rule and tabs 48 = 120px at rest on a
    667px phone; pinned while scrolling: 48px).
- **Stage 1a "Who owns the look"** is drawn and unruled; do not change it.

## The pages to draw

At **390px**, phone frames 390 × 740 with internal scroll, the existing `.phonebox` pattern. **Before** = the capture.
**After** = drawn with the `.tf` specimen system. Each page gets: the pair, a caption with NEW / RESTYLED / UNCHANGED
tags, a short "what changed and why" list, a "what moves (nothing deleted)" list, and **one measured number for the
page's job** (like the Overview's "next game at 607px"), printed by the page's own script.

Captures are in `.probe/public-tournament-review/` (gitignored) and get published beside the page as `shots/*.png`
through the Artifact `files` map. Already published: `home-live-390`, `invitational-390`, `schedule-390`,
`standings-390`, `club-390`, `home-live-1440`, `pay-invalid-390`, `admin-club-look-1440`,
`admin-tournament-branding-1440`. Add the ones you use, for example:
`riverdale-minor-ball_summer-classic_playoffs_390.png`, `_teams_390.png`, `_news_390.png`, `_rules_390.png`,
`_register_390.png`, `summer-classic_champions_390.png`, `summer-classic_schedule_<id>_390.png` (game detail),
`team-profile_390_final.png`.

| Page | The family's job | The after must show |
|---|---|---|
| **Schedule** | Find my team's games today; where | Lands on today. Division dropdown (a form select is a dropdown). The Pool Play / Playoffs stage switch as **one white track** (ruled control shape). "My games" and search. The phone's other filters behind **one filter button that opens a sheet**; draw the sheet open as a second frame. Game rows in the Overview's row recipe (time, both teams on separate lines, division · field line under them, Directions as the symbol on a phone). A live game as the Live now card. Measure: first game row's offset. The before capture is the D1 "coming soon" bug: say so; draw the after with games. |
| **Game detail** | When and where to go | Time, date, field and **Directions as the primary button** (a primary action keeps its word), then both teams and score/status, then division / game type. No ticker on this page? Decide and say why. Long team names wrap. |
| **Standings** | Where does my team stand | Stays a **table** (2026-06-01): Team pinned left, **PTS pinned right** (fixes D5). Division dropdown. The final / pending / remaining counts. The legend and tie-breaker order **behind a tap**. The bracket **below** the table or behind its own tap, not above it. |
| **Playoffs** | When and where is the next playoff game | The next matchup first, with time and field. The bracket. "How seeding works" (the seeding method, best offence, stingiest defence, seed list) behind a tap. |
| **Teams** | Find a team, follow it | Grouped by division. A long name on two lines, never an ellipsis. Record and next opponent in one quiet line. The follow star as the symbol alone (44px). Include one long-name team. |
| **Team page** | My team's next game and results | Next game first (time, field, Directions), then results, record, then the rest. Follow. The before capture is the D1 "0-0-0" bug: say so. |
| **News** | Read announcements | A list of posts with dates. **Empty:** the club rule is absent, so propose that the News tab **hides when there is no news** (an ask, below). |
| **Rules** | Find one rule fast | Sections as tap-open rows with jump links; one opened. The empty case: the tab hides (same ask as News). |
| **Register** | Register a team (or see it is closed) | Open: the register card (spots from data), then the form's first step as it ships (do not redraw the form's fields; mark it "the form, unchanged"). Closed: one line, no button wall. |
| **Champions** | Who won | The recap first: champion per division with the final score, then the bracket door. Before a champion exists, the tab is absent. |
| **Pay** | Already drawn on its own tab; leave it. |

**Worst cases, at least once across the pages:** a 360px narrow frame (`.phonebox.narrow`, `.tf.n360`), a long team
name, a long day (10+ games on the schedule), the free-event neutral band, and a pale organizer colour (the frame
tab's `data-roles="#F2C94C"`).

**One desk frame:** the Schedule at 1280px (rail on the left, as the Overview desk frame does).

## Where to put it in the hub

Keep the "The end state" tab for the Overview (updated for the browser / app split). Add a new tab **"Every page"**
after it, with a short jump list at the top (one button per page that scrolls to its section; buttons, not hash links, so
the tab routing is untouched), then one section per page. Keep the hub's existing tab routing (hash per tab; do not add hash routes per page).

## Rules the drawings must follow (confirm against the plan; these are binding)

- Club frame tokens only: ground `#F6F5F2`, white cards, 1px `#E4E0D8` hairline, radius 8, ink `#1F1B16`; **no tints of
  the organizer colour**; semantic chips use the club's own green pair; no red live chip (the `/design` pass removed it).
- Type steps 12 / 14 / 16 / 20 / 24 / 32 only. Section headings Inter 700 16px (the club's `sectionTitle`). Barlow
  Condensed for the band name and big numbers. **No typewriter face.**
- 44px taps. A phone's secondary action is its **symbol alone** (Directions in a row, follow star, share, copy).
- Clock "8:00 a.m.". State words: Live now · This weekend · Registration open · Finished. Sport-neutral copy ("Starts
  in", never "First pitch"). Demo data may say "Diamond 2".
- **A part with nothing to show is absent.** A tab that cannot serve anything yet is hidden, never a dead end.
- Draw each control from its shipped component (the stage switch is one white track; dropdowns are dropdowns; the
  footer's copy button is a 44px symbol). If you cannot draw something faithfully, say so on the page.
- Every orange finding flag opens a note on click.

## New asks (continue the numbering from 13)

Add only what the drawings actually raise, ranked, each with options and a recommendation, into the hub's `ASKS`
array (it is shared with the paste-back summary). Likely: **14 · News and Rules tabs hide when empty**; **15 · the
bracket's place on Standings**; **16 · the "back to the app" line for the web app opened in a phone browser** (plan
§10a). Do not re-ask anything already in asks 1–13.

## Publishing (traps the last session hit)

- This is a new conversation, so **read the live Artifact first** (`action: "read"`, url
  `https://claude.ai/artifact/19ueNt47f4x3kGFktd8oTU`), compare it with the source file, then publish **with that
  `url`** and the source `file_path`. A publish without the url mints a new link. (The last session made one stray
  duplicate by changing the drive letter's case; it has been deleted. Use the url every time.)
- Pass only the new `shots/*` in `files`; files left out are kept.
- Edit scripts and probe scripts with the Write tool into `.probe/`, never a shell heredoc (backslashes are dropped).
- Syntax-check the page's script once (`node --check` on the extracted script) and look at one render if useful; no loops.

## Before the hand-off

1. **Run the `/design` check** on the new and changed drawings through a helper (independent of your reading): compare
   against the shipped club frame (`components/public/ClubFrame.module.css`, `ClubKit.module.css`, `ClubBar`,
   `OrgSectionTabs`, `ClubFooter`, `ClubSponsors`) and, for schedule/standings controls, the shipped tournament
   components (`ScheduleContent`, `StandingsContent`). Apply its fixes, republish, and report what changed.
2. Update the plan: §5 → point at the new tab; §9 ladder states ("whole-screen end state drawn" for stages 3–6);
   §10 new asks; keep §10a as it is apart from anything the drawings settle.
3. Update the TODO line for this project and the auto-memory file `project_public_tournament_site_review.md`
   (add one dated line; keep the MEMORY.md index line short).
4. **Do not commit.** Ask the owner first. Stage explicit paths only when they say yes.
5. Hand off in the owner's voice: what each page becomes, the measured numbers, the new asks, and "open it on your
   phone".
