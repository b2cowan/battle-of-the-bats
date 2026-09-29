# Admin Design Continuity — PM Brief

> 2026-09-25 · ruled by the owner the same day · plan: [ADMIN_DESIGN_CONTINUITY_PLAN.md](ADMIN_DESIGN_CONTINUITY_PLAN.md) ·
> hub: https://claude.ai/artifact/R1Zcp2s93gmgaHGHn6SLSZ
>
> **Where it stands (2026-09-25):** the measurement is done: the work is the size the plan said, and
> most of the theme already reaches the admin. The foundation's mockups are drawn and ratified, with four
> small calls settled: the admin ignores the club's public card style, headings use the portal's type,
> page titles have no line underneath, and money tables are restyled now and redesigned later.
> **How it gets built:** out of sight, behind a switch, over several sessions, then released to everyone
> on one day outside a tournament weekend. Customers see nothing in between. The first club screens
> (hub, members, billing, settings, setup checklist) are redesigned behind the same switch and ship that
> same day.
> **Slice 0 done (2026-09-25):** every admin screen, and the scorekeeper and gate screens, now has an
> automated check: a pixel picture of today's look at phone and desktop width, and a layout and
> contrast measurement. Each later session proves it changed nothing customers can see. Nothing
> customers see has changed. On the way it found real defects, written down for their own fixes: a
> button off the edge of the tournament Teams screen on a phone, a Members list whose order shuffles
> between visits, and some grey and navy text too faint to read comfortably on the dark screens.
> **Slices 1–2 built (2026-09-25/26), still behind the switch:** the new frame and both themes (slice 1);
> then the coaches portal's buttons, status chips and type on every admin screen, and House league, the
> Organization screens, setup and Notifications restyled end to end (slice 2). Customers still see
> nothing; the owner walks it all at slice 6.
> **Slice 3 built (2026-09-27), behind the switch:** all of Rep Teams and Accounting on the kit in both
> themes, the money tables restyled in place (same columns; amounts right-aligned; a voided entry struck
> through). With the switch off nothing moved; with it on, faint-text problems on these screens fell from
> 1,594 to none in Warm and to 354 in Dark, none of them on these screens' own parts.
> **Slices 4–5 built (2026-09-27), behind the switch:** every tournament screen (setup, game day, the
> schedule), then the scorekeeper and gate (warm on every phone) and the help guide.
> **Slice 6, prove and walk (2026-09-28):** every admin and volunteer screen checked in both themes with the
> switch on: no text too faint to read anywhere in the working screens, in Warm or Dark (about 4,400 today);
> with the switch off, every screen still pixel-identical to what customers see. On the owner's word it also
> restyled Plan & billing for every plan (the page every tournament organizer bills through), gave the club
> windows the coaches portal's keyboard and Back behaviour, and fixed two Dark reading problems and the phone
> bar's current tab in both portals (coaches get those with the next release). Committed `c72afdeb` 2026-09-28
> after its cleanup and review. **The owner's walk (§245, eight short walks) PASSED 2026-09-28**, all eight, nothing
> flagged.
> **RELEASED (2026-09-28, job 273):** the new look is live for every organization. The admin, the
> scorekeeper and gate, and the admin's help wear the coaches portal's look; Warm is the default and Dark is
> one choice away in Account → Appearance; the organization's colours stay on its public pages. The coaches
> portal's help now follows Warm / Dark too. Club Stage 1's screens went live the same day, for clubs the
> platform provisions only (Club is not on sale), with their help published. What's New tells customers all of
> it. **Rollback, while it stood:** undo one change and release again, because the old look was still in the
> code. **The invisible cleanup (Part B) STARTED 2026-09-29.** The owner waived the planned wait for a
> tournament weekend: none is coming for 8–10 months and Club is not live, so no customer needed the quick
> rollback, and it ends with the cleanup's first change. The cleanup goes one area at a time, each proven to
> change no pixel customers see. **The first area, the admin's frame and shared parts, is done (committed
> 2026-09-29):** the old sidebar, phone bar, top strip and event header are gone from the code, and every
> admin and volunteer screen matched its before-picture in Warm and Dark (the only two differences were two
> test-club names listed in swapped order, a test-data quirk). The quick rollback ended with it. The
> tournament areas come next, in the tournament redesign's order, skipping any screen a redesign stage is
> rebuilding.

## What it is
One design system and one theme choice across every working screen in FieldLogicHQ. The club admin,
the tournament admin, house league, and the scorekeeper and gate screens adopt the coaches portal's look
and patterns, and follow the same Warm / Dark setting the coaches portal already has.

## What people see differently
- **Club owners, admins and treasurers:** the admin looks and behaves like the coaches portal they already
  know: warm by default, dark if they choose it in their account, the same cards, lists, dialogs and phone bar.
- **Tournament organizers:** the same change on their screens. First a restyle (same layout, new look,
  both themes), then a screen-by-screen redesign in its own project. Their organization's colours stay on
  their public tournament pages, where families see them; the working screens stop taking the club colour.
- **Scorekeepers and gate volunteers:** their screens get the same look, in warm (they arrive by link and
  have no account setting).
- **Everyone:** the help guide follows the theme instead of staying dark.
- **Families and visitors:** nothing changes — public pages stay in each organization's own branding.

## Why it matters
Today an owner who also coaches moves between two visual worlds: a warm, modern coaches portal and a dark,
older admin. The club project was about to redesign club screens one at a time, which would have left a
patchwork (warm pages beside dark pages in the same frame) for months. Doing the shared frame and the theme
first means every screen is consistent from day one, and each later redesign is local.

## Customer impact
Every tournament organizer who has never picked a theme will see their admin turn warm on the day the
foundation ships. That is intended, and it gets a release note that says where the Dark choice lives.
The organization colour leaving the admin chrome is also visible; the note says their colours stay on
their public pages.

## Priority and order
1. **Measure** (now): size every admin area and put all admin screens under the automated screenshot check.
2. **Foundation** (before the Club Stage 1 build): the frame and theme for all admin, every screen restyled
   to render correctly in both themes; the help guide follows the theme.
3. **Club screens:** redesigned inside each club stage, drawn in both themes.
4. **Tournament screens:** their own project, alongside; not holding up the Club release.
5. **House league screens:** with the club project's house-league stage.

## Success criteria
- Every admin screen passes the automated check in warm and in dark.
- No hard-coded colour can be added to admin code without the build refusing it.
- Moving between the coaches portal and the admin feels like one product.
- Public pages are unchanged.
