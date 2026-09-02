/**
 * Release notes content model + data — single source of truth for both the public
 * `/changelog` page and (Phase 2) the in-app "What's New" surface.
 *
 * This is intentionally versioned *content in the repo* (not a DB table): release
 * notes ship in the same deploy as the features they describe, so the two can never
 * drift. The `/release` flow appends a new entry to RELEASE_ENTRIES at promote time
 * (draft-then-approve — see docs/projects/active/RELEASE_NOTES_CHANGELOG_PLAN.md).
 *
 * Customer-facing wording is tone-checked by /marketing; keep entries plain-language,
 * benefit-led, and free of internal scope/jargon. Newest entry first.
 */

export type ReleaseCategory = 'new' | 'improved' | 'fixed';

export interface ReleaseHighlight {
  category: ReleaseCategory;
  /** One customer-facing sentence. No internal terms. */
  text: string;
}

export interface ReleaseEntry {
  /** ISO date (YYYY-MM-DD) the release went to production. */
  date: string;
  /** Short human title for the release. */
  title: string;
  highlights: ReleaseHighlight[];
}

export interface HorizonTheme {
  title: string;
  /** Plain-language description of the theme. Deliberately undated. */
  body: string;
}

export const CATEGORY_LABELS: Record<ReleaseCategory, string> = {
  new: 'New',
  improved: 'Improved',
  fixed: 'Fixed',
};

/**
 * Shipped releases, newest first. Seeded from recent production promotions.
 */
export const RELEASE_ENTRIES: ReleaseEntry[] = [
  {
    date: '2026-09-02',
    title: 'Simpler tags, clearer dues, and one place for bills',
    highlights: [
      {
        category: 'new',
        text: 'One tag picker works the same way everywhere — drills, equipment, and practice plans all use it, so a tag you create once shows up wherever it applies.',
      },
      {
        category: 'new',
        text: "Fundraisers open right where you're working, with totals updating automatically as money comes in — no separate page.",
      },
      {
        category: 'new',
        text: "An empty fundraiser can be deleted; one with real money on it is protected and can't be removed by accident.",
      },
      {
        category: 'new',
        text: "Dues schedules now come straight from your season's installment plan, with a single credit that grows automatically as it's needed.",
      },
      {
        category: 'new',
        text: "Setting up dues shows you what's actually changing before you commit, so a rounding cent is never mistaken for a real shortfall.",
      },
      {
        category: 'new',
        text: 'Bills your team owes now live in one ledger, with a form built around how coaches actually track them.',
      },
      {
        category: 'new',
        text: 'Sponsorship payouts are tracked end-to-end, from pledge to cheque.',
      },
      {
        category: 'new',
        text: 'The account menu (profile, sign out) opens right where you are instead of sending you to a separate page.',
      },
      {
        category: 'new',
        text: 'Text throughout the coach portal is now more consistent — fewer sizes, easier to scan.',
      },
      {
        category: 'fixed',
        text: 'Money paid back to a family now shows correctly in your monthly totals.',
      },
      {
        category: 'fixed',
        text: 'The budget item picker no longer disappears when you scroll.',
      },
      {
        category: 'fixed',
        text: 'Page titles and help links are back on the Budget, Budget vs Actual, Dues, Expenses, Fundraisers, and Club screens.',
      },
      {
        category: 'fixed',
        text: 'The Sponsorships summary now shows accurate totals.',
      },
      {
        category: 'fixed',
        text: 'The bill schedule now uses one consistent format throughout.',
      },
    ],
  },
  {
    date: '2026-08-27',
    title: 'One tap to decide a tryout — and money you can follow',
    highlights: [
      {
        category: 'new',
        text: 'Deciding a tryout is one tap. Candidates sit in three piles — offered, waitlisted, released — and a name moves between them with a single tap. Change your mind and it moves back.',
      },
      {
        category: 'new',
        text: 'The offer letter is yours. An offer is usually a conversation and often conditional, so nothing generic goes out under your name — you decide what reaches the family, and when.',
      },
      {
        category: 'new',
        text: 'Names on or off is a switch on every tryout screen, so you can evaluate blind and turn names back on without going looking for the control. A score now shows how it was reached.',
      },
      {
        category: 'new',
        text: 'Adding a player yourself asks for everything the family\'s own registration form asks for, so a player you enter is as complete as one who registered.',
      },
      {
        category: 'new',
        text: 'A bill you pay in parts has its own page. Record a deposit now and the balance later, see what it has paid against what it still owes, and correct any part of it in place.',
      },
      {
        category: 'new',
        text: 'Recording a payment on a bill, you can say a family paid that piece directly — the deposit a parent puts on their own card. The bill comes down, no team cash moves for it, and that household is owed the money back against their dues. One bill can hold both: a payment the team made and a payment a family fronted.',
      },
      {
        category: 'new',
        text: 'Undoing a payment, changing a schedule or deleting a cost now stops and explains itself when the change would leave a family out of pocket for money they fronted. Deleting a cost names the household and the amount before anything goes.',
      },
      {
        category: 'new',
        text: 'Every figure in the season\'s months opens. Open a number to see the families, drives, sponsors and requests behind it — the actual records, not a budget line. A season can also carry its balance forward into the next one.',
      },
      {
        category: 'new',
        text: 'Money exports open as real spreadsheets — headings, columns and figures Excel understands, instead of a flat list of text.',
      },
      {
        category: 'new',
        text: 'Practice plans remember who runs a drill and what it needs. Staff and equipment become your team\'s own lists that fill in as you type, instead of free text retyped every week.',
      },
      {
        category: 'new',
        text: 'Posters, lineup cards and brackets are built to be read at a glance from a distance — taped in a dugout, handed to an official, pinned to a fence. Available on Tournament Plus and above, and on the Premium Coaches Portal.',
      },
      {
        category: 'new',
        text: 'The tournament schedule prints like a weekend rather than a database, grouped by day and location the way someone reading it on a fence needs it. Available on Tournament Plus and above, and on the Premium Coaches Portal.',
      },
      {
        category: 'improved',
        text: 'The roster answers questions instead of listing names — who is available, what is missing, and what needs attention before the next game.',
      },
      {
        category: 'improved',
        text: 'The coach portal treats a tablet as a touch device, so buttons and spacing stay finger-sized instead of switching to a desktop layout too early.',
      },
      {
        category: 'improved',
        text: 'The way back out of any detail screen is an arrow in the page header, in the same place every time.',
      },
      {
        category: 'improved',
        text: 'Budget vs. Actual opens on the report itself rather than on summaries stacked above it, and the season Statement explains why its total is not your bank balance.',
      },
      {
        category: 'improved',
        text: 'Each screen has one clearly placed way to create something, and help now sits in the team bar.',
      },
      {
        category: 'improved',
        text: 'Times read the same way everywhere — 8:00 a.m. on every screen, export, poster and email.',
      },
      {
        category: 'fixed',
        text: 'A filter\'s count matches the list it produces — tick an option and you get exactly as many rows as it promised.',
      },
      {
        category: 'fixed',
        text: 'Recording a credit only offers the kinds that can actually be saved.',
      },
      {
        category: 'fixed',
        text: 'Naming the family who paid a bill directly now saves. Until this release the form asked the question and did not record the answer, so no credit was raised for that household.',
      },
      {
        category: 'fixed',
        text: 'Team family access no longer reports itself as empty when it is not.',
      },
      {
        category: 'fixed',
        text: 'Money screens load like the rest of the portal, without the flash.',
      },
    ],
  },
  {
    date: '2026-08-25',
    title: 'One place to record money — and paperwork you can hand over',
    highlights: [
      {
        category: 'new',
        text: 'Recording money starts from one button on any Money screen. Say what happened — a family paid, the bottle drive brought money in, you paid a bill — and it lands in the right place.',
      },
      {
        category: 'new',
        text: 'Bills can be paid in parts. Record a deposit now and the balance later, correct a payment entered by mistake, and see what a bill has actually paid against what it still owes.',
      },
      {
        category: 'new',
        text: 'Three documents built to be handed to someone else: a roster for the dressing-room wall with birthdates and contact details left off, one family\'s statement with no other family\'s money on it, and a season register you can email to a treasurer. Available on the Premium Coaches Portal and Club.',
      },
      {
        category: 'new',
        text: 'Coach documents carry your team\'s own name, crest and colours, set once in the team\'s document settings. Available on the Premium Coaches Portal and Club.',
      },
      {
        category: 'new',
        text: 'Tryout day runs on one screen — live board, check-in and scoring together. The printed check-in sheet matches the columns on the tablet.',
      },
      {
        category: 'new',
        text: 'Administrators can look up a family. A parent is one record that keeps every email address they have used, instead of an address re-typed onto each child.',
      },
      {
        category: 'new',
        text: 'Seven coach reports in one place, including the attendance records behind a player\'s percentage and the positions a player has actually played.',
      },
      {
        category: 'new',
        text: 'Closing a season gives you a single page for it — results, roster, practices and money for a finished year, with a season summary at the top.',
      },
      {
        category: 'new',
        text: 'The season\'s money reads month by month, with the running balance in view.',
      },
      {
        category: 'improved',
        text: 'Coach navigation groups into sections that fold away, and on a phone the team bar names the team you are working in.',
      },
      {
        category: 'improved',
        text: 'Money can be filtered by date range, and a link you share carries that filter with it.',
      },
      {
        category: 'improved',
        text: 'The coach money screens now read properly on a phone.',
      },
      {
        category: 'fixed',
        text: 'Unsubscribing from club email means the same thing everywhere it is offered.',
      },
    ],
  },
  {
    date: '2026-08-17',
    title: 'Every dollar has a date, a category, and a season',
    highlights: [
      {
        category: 'new',
        text: 'Team Money is now two screens. Transactions is what actually happened; Payables is what is still owed. Recording a payment and chasing one are no longer the same job.',
      },
      {
        category: 'new',
        text: 'Your team now has one dated register — every payment in and out, in order, with a running balance that is the team\'s cash on hand.',
      },
      {
        category: 'new',
        text: 'Recording money coming in asks three things: who it came from, what it was for, and which season it belongs to. Fundraising, sponsorship and club funding each land in the right place.',
      },
      {
        category: 'new',
        text: 'Your budget is organised as categories and items, and spending uses the same names — so a budget line and the spending against it can never be labelled differently.',
      },
      {
        category: 'new',
        text: 'Each budget name shows where it came from: one your team created, one your club shares, or one from the starter list. A name that records are already using can no longer be deleted out from under them.',
      },
      {
        category: 'new',
        text: 'When a team is ready, it can fold its own budget names into the club\'s shared ones. The team decides when that happens, not the club.',
      },
      {
        category: 'new',
        text: 'If your team belongs to a club on FieldLogicHQ, a new Club tab shows where you stand with them — what has been approved, what has been paid, and what is outstanding. That money now counts in Budget vs. Actual.',
      },
      {
        category: 'new',
        text: 'A money record can be corrected. Edit or delete one and every total that used it corrects itself.',
      },
      {
        category: 'new',
        text: 'Finished seasons now read in place. There is no toggle and no separate archive — open your team and you see the season it is on, with last season\'s results, practice plans and insights where you would expect them.',
      },
      {
        category: 'new',
        text: 'A finished season keeps the practices you ran, so last year\'s plan can start tonight\'s session.',
      },
      {
        category: 'new',
        text: 'A tryout scorecard now shows what each category is worth as a share of the total, so you can see at a glance how the ranking is weighted.',
      },
      {
        category: 'new',
        text: 'Tryout setup is now a single checklist that tells you what is done and what to do next.',
      },
      {
        category: 'improved',
        text: 'Attendance now has one home, alongside the rest of your reports in Insights.',
      },
      {
        category: 'improved',
        text: 'The coach sidebar keeps the same order every time you open it.',
      },
      {
        category: 'improved',
        text: 'Help guides are now a set of short articles rather than one long page, so you can go straight to the answer you need.',
      },
      {
        category: 'fixed',
        text: 'Different money screens could show different figures for the same season. They now all work from the same numbers.',
      },
      {
        category: 'fixed',
        text: 'Opening a tryout scorecard could change the weighting a coach had set. It now leaves your settings alone.',
      },
    ],
  },
  {
    date: '2026-08-14',
    title: 'Team Money keeps the whole record',
    highlights: [
      {
        category: 'new',
        text: 'Every dues payment is now a record — date, method, and a note if you need one. The season\'s totals add themselves up from those payments, so there\'s no running total to keep by hand any more.',
      },
      {
        category: 'new',
        text: 'Player Dues can now be read one installment at a time — see who\'s paid each installment across the whole team, and what\'s due next.',
      },
      {
        category: 'new',
        text: 'Fundraising money now comes off a family\'s actual installment, so the next thing you ask them for is already reduced.',
      },
      {
        category: 'new',
        text: 'Money that goes back out is now part of the record too — a credit handed back in cash, or a parent repaid after overpaying. At season\'s end, a single sheet shows every family\'s refund and how it was worked out.',
      },
      {
        category: 'new',
        text: 'The budget card on your team Overview now shows what you planned beside what you\'ve actually spent.',
      },
      {
        category: 'new',
        text: 'Help now opens on the page you\'re already on, and long topics are a short menu of answers instead of one long page — with pictures of the screen being described.',
      },
      {
        category: 'improved',
        text: 'The tables across Team Money now all read and behave the same way, whichever one you\'re on.',
      },
      {
        category: 'fixed',
        text: 'The game-day card on your team Overview no longer asks you to finish something you\'ve already done.',
      },
    ],
  },
  {
    date: '2026-08-12',
    title: 'The coach portal gets easier to find your way around',
    highlights: [
      {
        category: 'new',
        text: 'Every screen in the coach portal now opens the same way — team, season, and your role always show in the same place at the top, with one consistent way back to team home from anywhere.',
      },
      {
        category: 'new',
        text: 'Team Money is now one page with tabs instead of seven separate pages — switch between Overview, Dues, Budget, Expenses, Fundraisers, Allocations, and Payment Requests without losing your place.',
      },
      {
        category: 'new',
        text: 'The Money Overview now tells the story in three cards — what\'s been collected, what\'s on hand, and how the budget\'s tracking — plus a single day-by-day list of what\'s coming up in the next 30 days.',
      },
      {
        category: 'new',
        text: 'The live demos are easier to explore on any screen size — the guided tour and season banner tuck away as you scroll and reappear exactly when you need them, and finishing a tour lets you walk it again.',
      },
      {
        category: 'fixed',
        text: 'Coaching staff invites on the Team plan were being counted against a seat limit that every other plan is exempt from — fixed. Invite your whole staff; there\'s no cap.',
      },
      {
        category: 'fixed',
        text: 'Text on the demos, homepage, and pricing pages that was too faint to read comfortably now meets accessibility contrast standards.',
      },
      {
        category: 'fixed',
        text: 'A past season\'s Money tab no longer shows today\'s upcoming payments — it now shows only what was actually due during that season, matching what the coach saw at the time.',
      },
      {
        category: 'fixed',
        text: 'The demo banner no longer overlaps page content when you scroll, and "See it live" now goes straight into the demo instead of pausing on a login-style screen first.',
      },
    ],
  },
  {
    date: '2026-08-10',
    title: 'No more guessing where the game is',
    highlights: [
      {
        category: 'new',
        text: 'Scheduling a game or practice now uses a field picker instead of a typed-in name — pick from your venue library, and if two things land on the same field at the same time, you\'ll see it before you save, not after.',
      },
      {
        category: 'improved',
        text: 'If your schedule still has games with a typed-in field name from before, you can now match them to a real venue in your library in a couple of clicks — so they\'re covered by double-booking checks too.',
      },
      {
        category: 'new',
        text: 'The homepage, product pages, and pricing now link straight into live, click-through demos of the tournament and coach experience — see the real product before you sign up for anything.',
      },
      {
        category: 'fixed',
        text: 'The check-in board\'s search and filters now use the full width of the screen on a phone, so they\'re easier to tap.',
      },
      {
        category: 'fixed',
        text: 'Fixed three check-in board issues: the date could get cut off on some screens, the Clear button could leave the board stuck, and one screen had no way back out.',
      },
    ],
  },
  {
    date: '2026-08-07',
    title: 'Scorekeeper and check-in, built for the phone',
    highlights: [
      {
        category: 'improved',
        text: 'Scorekeeper and check-in now open straight onto the games instead of a screenful of setup. On a phone the day\'s counts stay in view, switching between scoring and the gate takes one tap, and the filters stay out of the way until you need them.',
      },
      {
        category: 'improved',
        text: 'Help now covers what happens if a subscription ends. Nothing is deleted — the guide walks through what stops, what\'s kept, and how everything comes back.',
      },
      {
        category: 'fixed',
        text: 'Tryout registration now closes when an organization\'s subscription ends, along with the rest of its public pages.',
      },
    ],
  },
  {
    date: '2026-08-06',
    title: 'New in the Coach Portal: scouting, club sharing, game day',
    highlights: [
      {
        category: 'new',
        text: 'Log what you notice about an opponent after each game — it\'s all there, rolled up, before you play them again.',
      },
      {
        category: 'new',
        text: 'If another team in your club already scouted this opponent, you\'ll see their notes too — nobody starts from scratch twice.',
      },
      {
        category: 'new',
        text: 'A bench console built for the dugout — track playing time as it happens, not from memory afterward.',
      },
      {
        category: 'fixed',
        text: 'Fixed several help labels that screen readers were skipping over.',
      },
      {
        category: 'fixed',
        text: 'Status colors are easier to read on light-colored cards.',
      },
    ],
  },
  {
    date: '2026-07-31',
    title: 'The Coaches Portal grows up — plus one connected navigation and real desktop layouts',
    highlights: [
      {
        category: 'new',
        text: 'Tournament admin, the Coaches Portal, and public event pages now share one connected navigation, with a Workspaces switcher for anyone running more than one team, league, or tournament.',
      },
      {
        category: 'new',
        text: 'Coaches Portal notifications now reach coaches\' phones directly, and there\'s one way in instead of two.',
      },
      {
        category: 'new',
        text: 'Import a season\'s schedule straight from a spreadsheet — game times now save to the exact minute you entered.',
      },
      {
        category: 'new',
        text: 'Account and Chat both got real desktop layouts: a proper settings screen with sections, and a full split-pane view for chat.',
      },
      {
        category: 'new',
        text: 'Coaches can score their own tryouts directly, and families only get an email when the coach sends one.',
      },
      {
        category: 'new',
        text: 'The free Coaches Portal team Overview always shows the one tournament that matters right now, instead of two conflicting answers.',
      },
      {
        category: 'new',
        text: 'Public tournament pages gained a footer, a "Get the app" QR code, and organizer credit for paid-plan customers.',
      },
      {
        category: 'new',
        text: 'A full treasurer view in the Coaches Portal: a month-by-month look at the books, a first-season budget starter, and team finances that read clearly on a phone.',
      },
      {
        category: 'new',
        text: 'Decision emails to families are now the club\'s own choice to send, and applying no longer requires opting into marketing email.',
      },
      {
        category: 'fixed',
        text: 'A privacy issue where an assistant coach could see a child\'s confidential medical notes — and download the file it came from — is fixed. Access is now properly restricted.',
      },
      {
        category: 'fixed',
        text: 'The Coaches Portal Development page is redesigned into clear sections instead of a wall of cards; a low-contrast text issue in warm theme is fixed.',
      },
      {
        category: 'fixed',
        text: 'The coach money screen keeps its own budget total at the bottom, instead of asking for it four separate times.',
      },
      {
        category: 'fixed',
        text: 'The coaching-staff screen no longer shows the same message three times.',
      },
      {
        category: 'fixed',
        text: 'The Coaches Portal\'s More menu now scrolls properly and reads correctly in warm theme.',
      },
      {
        category: 'fixed',
        text: 'Fixed a message on public tournament pages that wrongly told a paying customer\'s visitors the organizer hadn\'t finished setup.',
      },
      {
        category: 'fixed',
        text: 'Menus and popups can now be dismissed by tapping away on iPhone, and by pressing Escape on any device.',
      },
    ],
  },
  {
    date: '2026-07-29',
    title: 'Season\'s End, real tournament tools, and faster role switching for coaches',
    highlights: [
      {
        category: 'new',
        text: 'A one-time, 2-minute guided tour for coaches new to the portal — four quick stops (Squad, Season, Money, Communication). It\'s offered once and never pushed again after you skip it, but it\'s always sitting in Help if you want it later.',
      },
      {
        category: 'new',
        text: 'Every section of your portal now explains itself. Open Lineups, Insights, Documents, or any other empty section and it tells you what it does, what it unlocks elsewhere, and what you need first — right where you are, instead of a generic "nothing here."',
      },
      {
        category: 'new',
        text: 'Tournament games finally get real tools. A game from a real FieldLogicHQ tournament now works like any other game on your schedule — attendance, lineup builder, and it counts toward your season record. If the organizer moves or cancels it, your calendar and your saved lineup/attendance follow automatically — nothing to redo.',
      },
      {
        category: 'new',
        text: 'Attendance has a real home now — its own item in your sidebar and phone menu, opening straight to "take attendance for your next game."',
      },
      {
        category: 'new',
        text: 'Add your whole roster at once. Paste your team list or upload a spreadsheet, review it in a table, fix anything, and add everyone in one tap — instead of one player at a time.',
      },
      {
        category: 'new',
        text: 'The Tournaments page now works for club/league-owned teams — tournaments your organization registers you for show up automatically, in a sensible order.',
      },
      {
        category: 'new',
        text: 'Season\'s End: when your season wraps up, you keep everything — final record, results, money — as a read-only lookback, never a locked door. It leads with a shareable Season Wrapped card (record, win streak, closest game, attendance, top award) you can send or post in one tap. You\'ll also get a gentle nudge once your season looks finished, pointing you toward closing it out.',
      },
      {
        category: 'new',
        text: 'Holding two roles at one event (say, admin and coach)? The role-switch button now jumps straight to your other role in one tap, instead of routing you through the public site first.',
      },
      {
        category: 'new',
        text: 'When an organizer moves or cancels one of your games, you — and any family following your team — now get notified, instead of finding out at the field.',
      },
      {
        category: 'improved',
        text: 'Forms are lighter. "Add player" and "Add game" now open with just the essentials; extra fields sit behind an optional "add more details" step.',
      },
      {
        category: 'improved',
        text: 'Save buttons on mobile forms always stay above your phone\'s own navigation bar, so a tap never lands on the wrong control, and the mobile "More" menu always fits your screen.',
      },
      {
        category: 'improved',
        text: 'Standings pages load faster, especially on busy events with lots of teams and games.',
      },
      {
        category: 'improved',
        text: 'The role-switch button never sends you to a page the organizer has taken down, or to an admin screen you don\'t have permission to open.',
      },
      {
        category: 'improved',
        text: 'Free-tier coaches occasionally see a low-key note about what the Premium Coaches Portal offers — timed to natural moments like season\'s end, never during game day.',
      },
      {
        category: 'fixed',
        text: 'Fixed a chat permissions issue so restricted staff can no longer read or moderate chat for events they aren\'t assigned to, and staff who leave or lose access no longer keep a seat in chat.',
      },
      {
        category: 'fixed',
        text: 'Fixed the tournament chat sign-up reminder so repeat clicks can\'t re-email the same coaches, and it now tells you clearly whether it actually sent.',
      },
      {
        category: 'fixed',
        text: 'Fixed schedule dropdown menus so they animate open smoothly instead of snapping into place.',
      },
    ],
  },
  {
    date: '2026-07-27',
    title: 'A clearer tournament record page for coaches, plus registration and scheduling fixes',
    highlights: [
      {
        category: 'new',
        text: 'Your tournament record page now shows your live standing once games start, and previews who else is registered before the schedule is out.',
      },
      {
        category: 'new',
        text: 'Add your whole schedule to your calendar in one tap — a snapshot, not a live sync, so re-tap it if the organizer reschedules a game.',
      },
      {
        category: 'new',
        text: 'Schedules now show the organization\'s real logo and let you tap a venue name for directions.',
      },
      {
        category: 'improved',
        text: 'Registration now tells you upfront that a free Coaches Portal account comes with it, with an easy opt-out if you\'re just there to follow along — and if something goes wrong partway through, the error message now tells you exactly what happened instead of implying it worked.',
      },
      {
        category: 'improved',
        text: 'Your tournament record page is now organized into four clear sections — status and payment, schedule, your team, and messages from the organizer — instead of one long scrolling list.',
      },
      {
        category: 'fixed',
        text: 'Fixed the confirmation email so it links straight to your registration instead of a general list.',
      },
      {
        category: 'fixed',
        text: 'Fixed a timezone bug where tournament status and payment due dates could be off by a few hours in the evening.',
      },
      {
        category: 'fixed',
        text: 'Fixed a bug that silently blocked deleting a team once it had played a game.',
      },
      {
        category: 'fixed',
        text: 'Fixed low-contrast text and missing borders on the error and page-not-found screens.',
      },
    ],
  },
  {
    date: '2026-07-26',
    title: 'The free Coach Portal gets a warmer new look',
    highlights: [
      {
        category: 'new',
        text: 'The free Coach Portal now looks and navigates like the rest of your FieldLogicHQ account, instead of feeling like a separate app.',
      },
      {
        category: 'improved',
        text: 'Polished the mobile top and bottom bars in the Coach Portal to match its new look.',
      },
      {
        category: 'improved',
        text: 'Billing cancellations and downgrades now only affect the organization you\'re actually working in.',
      },
      {
        category: 'improved',
        text: 'Added safeguards so an organization can\'t end up with two active portals by accident.',
      },
      {
        category: 'improved',
        text: 'Strengthened account security behind the scenes.',
      },
      {
        category: 'fixed',
        text: 'Fixed a couple of visual glitches in the Coach Portal where headings and text could land on the wrong background color.',
      },
      {
        category: 'fixed',
        text: 'Fixed an issue where some coaches could get stuck part-way through signing in to the Coach Portal with no way forward.',
      },
      {
        category: 'fixed',
        text: 'Fixed an issue that could block some coaches from setting up their first organization.',
      },
      {
        category: 'fixed',
        text: 'Fixed edge cases in league creation, account reinstatement, and cross-organization coaching that could leave an account in an inconsistent state.',
      },
    ],
  },
  {
    date: '2026-07-24',
    title: 'A cleaner sign-in, and a smoother coach invite',
    highlights: [
      {
        category: 'improved',
        text: 'The sign-in, sign-up, and password-reset screens have a cleaner, more consistent look.',
      },
      {
        category: 'fixed',
        text: 'Opening a coach invite while signed in to a different account now walks you through it instead of showing a confusing error.',
      },
    ],
  },
  {
    date: '2026-07-23',
    title: 'One-tap flips for coaches and scorekeepers',
    highlights: [
      {
        category: 'new',
        text: 'Coaches: flip to the fan side in one tap — your tournament record now has the same ⇄ button admins use, landing on the event’s public page, with a one-tap way back.',
      },
      {
        category: 'new',
        text: 'Your team Overview shows your live or upcoming tournament — name, dates, and a Fan view link — whenever your team is in one.',
      },
      {
        category: 'new',
        text: 'Scorekeepers get a ⇄ Public site button in their header to confirm a posted score on the public schedule — with a quick chooser when two events run on the same day.',
      },
      {
        category: 'fixed',
        text: 'Cleaned up hard-to-read text and badge colors in the Warm theme on coach pages and chat.',
      },
      {
        category: 'fixed',
        text: 'The coach schedule’s month heading no longer shows the wrong month in some time zones, and tryout cards no longer blink out while loading.',
      },
      {
        category: 'fixed',
        text: 'Alert buttons no longer get stuck on “Turning on…” — if this device can’t receive notifications, they now say so.',
      },
    ],
  },
  {
    date: '2026-07-22',
    title: 'A warmer look, a simpler home, and the Coaches Portal founding season',
    highlights: [
      {
        category: 'new',
        text: 'Pick your look: choose a Warm (light) or Dark theme under Account → Appearance. It applies across the whole app and your coaches workspace and follows you between devices. Warm is the new default.',
      },
      {
        category: 'new',
        text: 'A simpler home: the app is organized around four tabs — Home, Scores, Chat, and Account — with a cleaner, warmer Home to start from.',
      },
      {
        category: 'new',
        text: 'Follow tournaments and organizations: tap Follow to keep an event or club on your Home and Scores. No account needed.',
      },
      {
        category: 'new',
        text: 'Coaches Portal founding season: coaches get the full Coaches Portal free through the founding season, with a warmer, simpler sign-up.',
      },
      {
        category: 'new',
        text: 'Pause notifications: one switch to mute everything when you need a break, and turn it back on when you are ready.',
      },
      {
        category: 'improved',
        text: 'Smoother game day: more dependable chat, notifications, and scorekeeper hand-offs across the tournament experience, plus one consistent navigation across tournament pages.',
      },
      {
        category: 'improved',
        text: 'Mobile polish: cleaner game and team pages, following, and scores on phones.',
      },
      {
        category: 'fixed',
        text: 'Mobile sign-in and navigation: sign in works on the first tap in Safari, Sign out is back in the tournament “More” menu, the keyboard no longer covers what you are typing, and long lists on Following and Scores no longer overflow.',
      },
    ],
  },
  {
    date: '2026-07-17',
    title: 'Follow your team from any device and get score alerts — plus a mobile makeover for tournament pages',
    highlights: [
      {
        category: 'new',
        text: 'Fans can now create a free FieldLogicHQ account to follow teams across every device and get score alerts — following teams and watching live scores still needs no account at all.',
      },
      {
        category: 'new',
        text: 'Tournament pages got a full mobile makeover — schedules, standings, brackets, and team pages are easier to read and use on a phone.',
      },
      {
        category: 'new',
        text: 'In the Premium Coaches Portal, coaches can now track each player’s goals and skill-test results over a season, see a returning player’s history from prior seasons, and print a summary to share with families.',
      },
      {
        category: 'new',
        text: 'In the Premium Coaches Portal, coaches can now give season awards — MVP, Best Hitter, and more — that show up right on a player’s profile.',
      },
      {
        category: 'new',
        text: 'Coaches can tag games and expenses and share one tag library across every team.',
      },
      {
        category: 'new',
        text: 'Notification settings are now in one place — coaches can turn off the weekly Insights email digest, and every account gets a single settings page for what they receive.',
      },
      {
        category: 'new',
        text: 'FieldLogicHQ now installs as one app everywhere — no more separate icons to install per tournament.',
      },
      {
        category: 'fixed',
        text: 'Fixed a bug where a coach unsubscribing from emails could accidentally unsubscribe their whole organization too.',
      },
      {
        category: 'fixed',
        text: 'Fixed layout and filtering issues on the Discover, Scores, and Account pages.',
      },
      {
        category: 'fixed',
        text: 'Fixed a security issue in the account sign-in flow.',
      },
      {
        category: 'fixed',
        text: 'Fixed an issue that could prevent a new organization from choosing certain website addresses.',
      },
    ],
  },
  {
    date: '2026-07-10',
    title: 'See what stands out in your season — and a tie-breaker fix for standings',
    highlights: [
      {
        category: 'new',
        text: 'In the Premium Coaches Portal, the Insights tab has been rebuilt into a season dashboard: your record, streak, run differential, close games, attendance, and dues at a glance, plus a ranked list of what stands out about your season and two new reports — a full game log and a fairness check on playing time.',
      },
      {
        category: 'fixed',
        text: 'Fixed a bug where standings on some tournaments could rank teams using the wrong tie-breaker order instead of the one set in Event Settings.',
      },
    ],
  },
  {
    date: '2026-07-09',
    title: 'Two health checks that catch problems early — and a rebuilt Money section for coaches',
    highlights: [
      {
        category: 'new',
        text: 'Your Registrations page now opens with a quick health check — missing coach emails, payment issues, backlog, and capacity all flagged at a glance, so nothing slips through before your tournament starts.',
      },
      {
        category: 'new',
        text: 'Your Playoffs tab now looks ahead: rest days and back-to-back games are tracked through bracket rounds that haven’t been decided yet, not just the ones already locked in.',
      },
      {
        category: 'new',
        text: 'In the Premium Coaches Portal, the Money section has been rebuilt around your season’s real cash position — clear totals for money in, out, and on hand, a Plan → Collect → Spend → Review flow, and a Budget vs. Actual export.',
      },
      {
        category: 'new',
        text: 'Also in the Premium Coaches Portal, you can now tag games with your own labels — like "Top in the province" — to organize and track your season your way.',
      },
      {
        category: 'new',
        text: 'Also in the Premium Coaches Portal, the Lineups tool adds season-long stats and a standalone lineup builder that reconciles automatically with attendance.',
      },
      {
        category: 'improved',
        text: 'The dashboard guidance panel now collapses before your event starts too (not just after), and mobile text no longer gets cut off.',
      },
      {
        category: 'fixed',
        text: 'Fixed a bug where the keyboard could hide earlier messages in your tournament chat on mobile — you can now scroll up to see the full conversation while typing.',
      },
    ],
  },
  {
    date: '2026-07-07',
    title: 'Move a rained-out day in one tap — and a sharper Coaches Portal',
    highlights: [
      {
        category: 'new',
        text: 'Rained out? You can now move or cancel a whole day’s games at once. Pick the games, push them back or call them off in one step, and the schedule — plus every affected coach’s game-day reminder — updates on its own. (Tournament Plus and up.)',
      },
      {
        category: 'new',
        text: 'Fans can now follow a tournament for day-of updates: a notification bell, plus optional push notifications, for announcements like rain delays and schedule changes.',
      },
      {
        category: 'new',
        text: 'See who’s joined your tournament chat, and nudge the rest — a new view shows how many coaches are in, with a one-tap reminder to those who haven’t signed in yet. (Tournament Plus and up.)',
      },
      {
        category: 'new',
        text: 'Coaches get a “haven’t paid yet” list — see who still owes and send a payment reminder in one tap.',
      },
      {
        category: 'new',
        text: 'The coach Season Review now compares this season to last.',
      },
      {
        category: 'improved',
        text: 'A rebuilt Coaches Portal menu that groups everything where you’d look for it.',
      },
      {
        category: 'improved',
        text: 'More reliable season attendance tracking.',
      },
      {
        category: 'fixed',
        text: 'Assistant coaches now see only what they should — tightened Coaches Portal permissions around team finances and personal details.',
      },
    ],
  },
  {
    date: '2026-07-06',
    title: 'Calmer notifications, a smarter sign-up, and a one-click finish',
    highlights: [
      {
        category: 'new',
        text: 'Your notifications are calmer now. The bell pins anything that needs a decision from you — a failed payment, an access request, a disputed score — at the top under “Needs attention,” and everything else drops into a tidy feed grouped by Today, Yesterday, and Earlier, with repeats rolled into a single line you can open in a tap. It opens on unread, so reading something clears it — an inbox you can actually empty — and a new “See all” page holds your full history. Admins and coaches both get it.',
      },
      {
        category: 'new',
        text: 'Invited someone who accidentally started their own organization instead of accepting the invite? The sign-up screen now spots their email and offers to send their invitation link again — so they end up in your organization, not a new one of their own.',
      },
      {
        category: 'new',
        text: 'Your tournament dashboard now walks you to the finish. When every game’s in, it shows a “Ready to finalize” prompt with a one-click Mark tournament complete — so you can close out right from the dashboard.',
      },
      {
        category: 'improved',
        text: 'Your game-day progress meter now reaches 100% the moment every game is decided — including games settled by forfeit — so it lines up with the “Ready to finalize” prompt.',
      },
      {
        category: 'improved',
        text: 'Your public tournament page now wraps up on its own once the games are done. The moment the champion’s decided — or every game in a round-robin has been played — it switches to a finished view with the champions and the closing standings, and tucks away the live game-day sections. There’s no need to mark the tournament complete first — that stays an optional step for locking in your records.',
      },
    ],
  },
  {
    date: '2026-07-05',
    title: 'Crown your champions — and set your pools by hand',
    highlights: [
      {
        category: 'new',
        text: 'The end of your tournament is now a moment too. The instant your playoffs finish and a champion is decided, your public home page turns into a Champions celebration, and a shareable Champions recap page goes live with the winners, runners-up, and final standings. A one-time “Champions crowned” alert goes out to your staff and to fans following with score alerts on (Tournament Plus and above). It all runs off the scores you already enter — there’s no extra step. And if your tournament uses tiered brackets, the winner shown is now always the team that took the top bracket.',
      },
      {
        category: 'new',
        text: 'You can now set your pools by hand right on the Teams page — assign any team to a pool from its row, or move a whole batch at once with Select Many. Every pool now stays visible even when it’s empty, so it’s always clear where teams go. The one-click Randomize option is still there for when you’d rather it be done for you.',
      },
      {
        category: 'fixed',
        text: 'Building playoff brackets by hand is more reliable — when you feed a game from another game’s winner or loser, the picker now offers only matchups that can actually happen, and keeps each tier separate in tiered brackets.',
      },
    ],
  },
  {
    date: '2026-07-04',
    title: 'Playoff day, made shareable — plus a clearer game-day dashboard and Coaches Portal improvements',
    highlights: [
      {
        category: 'new',
        text: 'Club and league admins can now see every assistant coach across all their teams in one place — including what each one is allowed to do and any invites still pending. You can also choose to approve new assistants yourself before they join a team.',
      },
      {
        category: 'improved',
        text: 'Your team’s home screen in the Premium Coaches Portal now puts what matters right now up front — a setup checklist before the season, your next game as it gets close, the live score on game day, and your record once the season wraps. Your win-loss record now sits right at the top.',
      },
      {
        category: 'improved',
        text: 'You can now send yourself a test notification to check that alerts are reaching your phone. And if a notification doesn’t go through, we’ll let you know instead of it failing quietly.',
      },
      {
        category: 'new',
        text: 'Setting your playoff bracket is now a moment. Your public tournament page switches to a Playoffs view with a countdown to the first game, and a shareable Playoff Picture lays out the seeding, the opening matchups, and each team’s key numbers. Fans following with score alerts on (Tournament Plus and above) get a one-time heads-up that the bracket is set — and so does your staff.',
      },
      {
        category: 'new',
        text: 'Your game-day dashboard now sorts games into Now Playing, Up Next, and Needs a Score — so at a glance you can see what’s on, what’s coming next, and which finished games still need a score entered.',
      },
      {
        category: 'fixed',
        text: 'Fixed turning on notifications for a tournament — switching it on now registers your device, so alerts actually reach your phone instead of quietly going nowhere.',
      },
      {
        category: 'fixed',
        text: 'Fixed a Coaches Portal game-day view that could show the wrong time in some time zones.',
      },
    ],
  },
  {
    date: '2026-07-03',
    title: 'Run your tryouts start to finish — and bring on assistant coaches',
    highlights: [
      {
        category: 'new',
        text: 'In the Premium Coaches Portal, you can now run tryouts from start to finish. Set up sessions and check players in on the day, then score candidates with more than one evaluator at once and watch results land on a live scoreboard. Families give their consent right as they register.',
      },
      {
        category: 'new',
        text: 'When it’s time to decide, make your cuts on a tryout decision board and email offers — families accept or decline straight from the email, no login needed, and a waitlist keeps filling the spots that open up. Say yes to a player and they drop onto your roster, fees and all, in one click.',
      },
      {
        category: 'new',
        text: 'Also in the Premium Coaches Portal, you can now invite assistant coaches and decide exactly what each one can do — from schedule-only help to a full second-in-command. Team finances and families’ contact details stay private unless you choose to share them, so you can hand off the parts you want help with and keep the rest to yourself.',
      },
      {
        category: 'improved',
        text: 'The lineup tool now plans around who plays where. On a new depth chart, mark the positions each player handles best, can fill in, or shouldn’t play, and the auto-built lineup follows your call.',
      },
      {
        category: 'improved',
        text: 'You can now set an innings cap per pitcher to protect young arms — the lineup builder keeps a pitcher from going past their limit.',
      },
      {
        category: 'fixed',
        text: 'Fixed a case where a pitcher’s innings cap could accidentally leave them on the bench.',
      },
      {
        category: 'improved',
        text: 'Fans following a team now see the same at-a-glance view on your public schedule and standings — next game, live score, and current standing — and can tap a game’s field to open directions.',
      },
      {
        category: 'fixed',
        text: 'The tournament a fan adds to their phone’s home screen now shows the full event name and follows the phone’s rotation lock — it could previously trim the name or rotate against the lock.',
      },
      {
        category: 'new',
        text: 'Fans on a phone can now add your tournament to their home screen right from the event page — a “Get the app” link under the host name puts live scores one tap away.',
      },
      {
        category: 'new',
        text: 'Notifications can now reach your phone. Turn them on in one tap and you’ll get an alert even when the app is closed — the moment a registration comes in, a payment lands, a score is posted, or a team’s a no-show. Choose exactly which events notify you, and quiet a tournament’s chat if it gets busy.',
      },
    ],
  },
  {
    date: '2026-06-29',
    title: 'Set your lineup in a click — and get your tournament found',
    highlights: [
      {
        category: 'new',
        text: 'In the Premium Coaches Portal, the lineup tool now does the heavy lifting: auto-build a fair batting order and fielding positions, with a heads-up when two players land in the same spot or someone’s about to sit two innings in a row. Save a lineup to reuse next game, and print a full-page dugout sheet for the bench.',
      },
      {
        category: 'improved',
        text: 'Also in the Premium Coaches Portal, setting up a game, practice, or tournament now shows only the fields that matter for that event and names your games for you. Games can carry the details parents always ask about — arrival time, field or diamond number, and uniform — plus a location address that opens in maps and labelled links (a drill video, a rules page, a field map) you can attach to any event.',
      },
      {
        category: 'new',
        text: 'There’s now a public tournament finder where anyone can browse and search events by sport, location, and date. Listing is your choice — switch any tournament on (it’s off by default) and it links straight to your existing public page. It’s free.',
      },
      {
        category: 'new',
        text: 'In the Premium Coaches Portal, your team’s win–loss–tie record now sits right on the team overview. You decide which games count — league and tournament are in by default, scrimmages are out — and tap to see the breakdown.',
      },
      {
        category: 'improved',
        text: 'The Premium Coaches Portal’s schedule is far easier to use on a phone now — the week stacks day-by-day instead of scrolling sideways, buttons are bigger and easier to tap, and adding or editing a game is within thumb’s reach.',
      },
      {
        category: 'improved',
        text: 'On a tournament’s public playoff bracket, every upcoming game now shows its field or diamond, and tapping a game opens its full page — score, directions, and what’s on the line. The bracket also looks the same on the Standings page as on the Schedule, and a renamed field now shows its new name everywhere.',
      },
    ],
  },
  {
    date: '2026-06-28',
    title: 'See what’s new — and edit your schedule',
    highlights: [
      {
        category: 'new',
        text: 'There’s now a “What’s New” button — and a public changelog page — so you can keep up with every improvement we ship without hunting for it.',
      },
      {
        category: 'improved',
        text: 'In the Coaches Portal, you can now edit a game or practice after it’s on the schedule — change the time, place, or opponent without deleting and re-adding it — and you’ll be asked to confirm before any unsaved edit is lost.',
      },
    ],
  },
  {
    date: '2026-06-26',
    title: 'Install the app to your phone',
    highlights: [
      {
        category: 'new',
        text: 'Add FieldLogicHQ to your phone’s home screen straight from the admin menu — one tap to install, no app store needed.',
      },
    ],
  },
  {
    date: '2026-06-25',
    title: 'Clearer live scores',
    highlights: [
      {
        category: 'improved',
        text: 'On the public live score display, long team names now wrap to two lines instead of being cut off, and the Share button is easier to reach.',
      },
    ],
  },
  {
    date: '2026-06-24',
    title: 'Simpler Club plans, sharper branding',
    highlights: [
      {
        category: 'new',
        text: 'Club now comes in two simple size bands, with portals for your whole coaching staff included — no per-team add-ons to track.',
      },
      {
        category: 'new',
        text: 'Choose how large your logo sits inside your installed home-screen app icon, with a live preview as you adjust it.',
      },
      {
        category: 'fixed',
        text: 'Team logos now appear correctly on installed app icons and branded public pages.',
      },
    ],
  },
  {
    date: '2026-06-19',
    title: 'Better playoff brackets',
    highlights: [
      {
        category: 'improved',
        text: 'Playoff brackets lay out and connect correctly even for renamed or custom rounds — consistently across the admin view, the public site, and the printable PDF.',
      },
      {
        category: 'improved',
        text: 'Custom round names you set now carry through everywhere your bracket appears.',
      },
    ],
  },
  {
    date: '2026-06-18',
    title: 'Game-day reliability',
    highlights: [
      {
        category: 'fixed',
        text: 'Recording a forfeit now works reliably.',
      },
      {
        category: 'fixed',
        text: 'The live game-day admin panel no longer shows false score-update alerts when you save a bracket.',
      },
    ],
  },
];

/**
 * "On the horizon" — undated themes of what’s coming. Deliberately not a dated
 * roadmap: directional, no commitments, no timelines. Keep to 3–6 themes.
 */
export const HORIZON_THEMES: HorizonTheme[] = [
  {
    title: 'Built-in coach messaging',
    body: 'Talk to coaches — and let coaches talk to each other — inside the platform, instead of scattered group texts and reply-all email chains.',
  },
  {
    title: 'More sports',
    body: 'Bringing tournaments beyond softball and baseball, so more communities can run their events on FieldLogicHQ.',
  },
  {
    title: 'A richer Coaches Portal',
    body: 'More for the people running a team day to day — dedicated assistant-coach access with the right level of permission, plus tryouts and player evaluations built in.',
  },
  {
    title: 'A sharper standings experience',
    body: 'A clearer “race to the playoffs” view with live brackets, so players and fans can see exactly what’s on the line.',
  },
  {
    title: 'Stronger in-season league tools',
    body: 'Honest schedules, rainout notifications, and parent communications that make a full house-league season easier to run.',
  },
];

/** Most recent release date — used by the in-app "What's New" badge (Phase 2). */
export const LATEST_RELEASE_DATE: string = RELEASE_ENTRIES[0]?.date ?? '';
