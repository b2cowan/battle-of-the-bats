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
