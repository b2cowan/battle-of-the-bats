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
