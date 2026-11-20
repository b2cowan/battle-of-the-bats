/**
 * THE NAME, THE ADDRESS AND THE BIRTHDAY DATE, IN WORDS — Settings in both workspaces Session 2 (drawing
 * SETTINGS_BOTH_WORKSPACES_DRAWINGS.html tabs 2, 4 and 7; owner rulings A1, A3, A5, A6, A9, C4, C6, 2026-11-20).
 * The web address's own words stay in `lib/web-address-words.ts` (one window, both workspaces).
 *
 * Pure, so a plain Node unit test reads it.
 */

/** Tournament / Tournament Plus — Settings & access › Name & address (A1, A9: both buttons white). */
export const NAME_AND_ADDRESS_WORDS = {
  tab: 'Name & address',
  name: 'Name',
  nameLine: 'Shown in the navigation bar and on your public pages.',
  rename: 'Rename',
  ownerOnly: 'Owner only',
  /** The Name window (drawing mark 19): built like the Web address window, no warning (a new name breaks no links). */
  window: {
    title: 'Name',
    identity: (orgName: string) => `${orgName} · only the owner can change it`,
    field: 'Name',
    hint: 'Shown in the navigation bar and on your public pages. Your web address stays the same.',
    save: 'Save name',
    cancel: 'Cancel',
    failed: 'Couldn’t save the name. Nothing was changed.',
  },
} as const;

/** Premium Coaches Portal — Team settings › Organization (drawing tab 2, marks 4, 7, 8; A3, A5, A6, C4, C6). */
export const TEAM_ORGANIZATION_WORDS = {
  title: 'Organization',
  meta: (teamName: string) => `${teamName} · not in a club`,
  /** The who line. Its second sentence is the Join a club row's, so it shows only while that row does (C4). */
  who: 'The owner changes these.',
  whoClub: 'If a club asks to bring your team in, you’ll see it on your Overview and on Join a club.',
  ownerOnly: 'Owner only',
  teamName: {
    label: 'Team name',
    line: (teamName: string) => `${teamName}. On every page, printout and your team’s public page.`,
    action: 'Rename',
  },
  webAddress: { label: 'Web address', action: 'Change the address' },
  birthday: {
    label: 'When birthdays count from',
    line: (sport: string, date: string) => `${sport} · ${date}. Next season’s birth years and tryout ages count from this date.`,
    action: 'Change',
  },
  /** The Team name window (A5): renaming the team renames the workspace with it. */
  nameWindow: {
    title: 'Team name',
    identity: (teamName: string) => `${teamName} · only the owner can change it`,
    field: 'Team name',
    hint: 'On every page, printout and your team’s public page. Your web address stays the same.',
    save: 'Save name',
    cancel: 'Cancel',
    failed: 'Couldn’t rename the team. Nothing was changed.',
  },
  /** The birthday window (C6 — not drawn; built like the Name window). */
  birthdayWindow: {
    title: 'When birthdays count from',
    identity: (sport: string) => `${sport} · only the owner can change it`,
    month: 'Month',
    day: 'Day',
    hint: 'Next season’s birth years, roster warnings and tryout ages count from this date.',
    save: 'Save date',
    cancel: 'Cancel',
    failed: 'Couldn’t save the date. Nothing was changed.',
  },
} as const;
