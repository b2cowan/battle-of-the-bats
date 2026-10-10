/**
 * CREATING A TOURNAMENT, IN WORDS — one home (Tournament admin redesign Stage 5, hub v45, E1 and A55). The words are
 * /marketing's (2026-10-10, `.probe/s5b/words-final.md` → this file): sentence case, the house's serial comma, the
 * sport's own word for a lane ("Diamond"), dates as "Start date" / "End date" (the event's record says them so).
 */
import { facilityNoun, listFacilityNames } from './venue-facilities.ts';
import type { FacilityType } from './types.ts';

export const CREATE_STEPS = ['tournament', 'divisions', 'venues'] as const;
export type CreateStep = typeof CREATE_STEPS[number] | 'review';

export const CREATE_WORDS = {
  title: 'New tournament',
  stepLabel: { tournament: 'The tournament', divisions: 'Divisions', venues: 'Venues' } as Record<typeof CREATE_STEPS[number], string>,
  stepLine: (n: number, label: string) => `Step ${n} of ${CREATE_STEPS.length} · ${label}`,
  reviewLine: 'Ready to create',
  name: 'Tournament name',
  startDate: 'Start date',
  endDate: 'End date',
  style: 'Style',
  publicLink: 'Public link',
  cancel: 'Cancel',
  back: 'Back',
  next: 'Next',
  create: 'Create the draft',
  creating: 'Creating…',
  loading: 'Loading…',

  // A55 — one tournament at a time keeps last year's finished event, its name and its link.
  nameHeld: (year: number) => `Your ${year} event has this name.`,
  takeName: (name: string) => `Use “${name}”`,
  nameTaken: 'Another tournament has this name. Choose a different one.',
  linkKept: 'Last year’s site keeps its own link and stays online.',
  nameRequired: 'Give the tournament a name.',
  linkInvalid: 'Use lowercase letters, numbers, and hyphens in the public link.',
  datesRequired: 'Add a start date and an end date. You can change them later.',
  startPast: 'The start date can’t be before today.',
  endBeforeStart: 'The end date can’t be before the start date.',

  // Step 2 (J1-038: "the divisions or divisions" fixed).
  divisionsLede: 'Add the divisions teams can register in. Pools are optional; you can set them up for each division.',
  starter: 'Start from',
  starterYouth: 'Youth',
  starterAdult: 'Adult',
  starterCustom: 'Custom',
  addDivision: 'Add a division',
  addDivisionPlaceholder: 'A division, like 12U, Open, or Varsity',
  divisionName: 'Division name',
  youngest: 'Youngest',
  oldest: 'Oldest',
  anyAge: 'Any',
  maxTeams: 'Teams it holds',
  usePools: 'Split into pools',
  poolCount: 'How many pools',
  poolName: (letter: string) => `Pool ${letter}`,
  registrantPicks: 'Teams pick their pool',
  removeDivision: (name: string) => `Remove ${name || 'this division'}`,
  noDivisions: 'No divisions yet. You can add them from the board.',
  divisionDuplicate: (name: string) => `“${name}” is listed twice. Give each division its own name.`,
  divisionCapacity: 'Teams it holds must be at least 1.',
  divisionAges: 'The youngest age can’t be more than the oldest.',

  // Step 3 — one ticked list (the /design review), the club's library or "your venues".
  venuesLede: (kind: FacilityType) => `Where will you play? The schedule can put a game on each ${facilityNoun(kind, 1)} at the same time.`,
  venueLabel: 'Venue',
  yourVenues: 'Your venues',
  library: 'The club’s Venue library',
  searchYours: 'Search your venues',
  searchLibrary: 'Search the club’s venues',
  pastCaption: (count: number, kind: FacilityType, tournament: string | null | undefined) =>
    [count > 0 ? `${count} ${facilityNoun(kind, count)}` : `No ${facilityNoun(kind, 2)} yet`, tournament ? `last used for ${tournament}` : '']
      .filter(Boolean).join(' · '),
  libraryCaption: (count: number, kind: FacilityType, address: string | null | undefined) =>
    [count > 0 ? `${count} ${facilityNoun(kind, count)}` : `No ${facilityNoun(kind, 2)} yet`, address ?? '']
      .filter(Boolean).join(' · '),
  newCaption: (count: number, kind: FacilityType, address: string | null | undefined) =>
    [`${count} ${facilityNoun(kind, count)}`, address ?? '', 'new'].filter(Boolean).join(' · '),
  newVenue: 'A new venue',
  newVenueCaption: (kind: FacilityType) => `Its name, its address, and how many ${facilityNoun(kind, 2)} it has`,
  notTheClubs: 'A venue that isn’t the club’s',
  notTheClubsCaption: 'Added to this tournament only',
  noMatch: (query: string) => `No venue matches “${query}”.`,
  venuesLoadFailed: 'Your venues couldn’t be loaded. You can still add a new one.',
  /** The line under the list, named as the schedule will name the lanes. */
  venueLine: (venues: { names: string[] }[], kind: FacilityType) => {
    if (venues.length === 0) return 'No venue yet. You can add one from the board.';
    const lanes = venues.reduce((n, v) => n + v.names.length, 0);
    const head = `${venues.length} ${venues.length === 1 ? 'venue' : 'venues'} · ${lanes} ${facilityNoun(kind, lanes)}`;
    return venues.length === 1 && lanes > 0 ? `${head}: ${listFacilityNames(venues[0].names)}.` : `${head}.`;
  },

  // Review — each row a door back to its step; the welcome message a switch with its text.
  divisionsRow: (n: number) => (n === 0 ? 'No divisions yet' : `${n} ${n === 1 ? 'division' : 'divisions'}`),
  venuesRow: (venues: number, lanes: number, kind: FacilityType) =>
    venues === 0 ? 'No venue yet' : `${venues} ${venues === 1 ? 'venue' : 'venues'} · ${lanes} ${facilityNoun(kind, lanes)}`,
  welcome: 'Post a welcome message',
  welcomeDefault: (name: string) => `Welcome to the ${name}! Registration opens soon.`,
  reviewFoot: 'It stays private until you activate it. Its board lists what’s left: fees, rules, and the public site.',
  editStep: (label: string) => `Change ${label.toLowerCase()}`,

  // Leaving (Stage 4's words, kept).
  leaveTitle: 'Leave setup?',
  leaveBody: 'Your progress will not be saved.',
  keepWorking: 'Keep working',
  leave: 'Leave',
} as const;

/** The New venue sheet — the four things every "add a venue" asks (Club Stage 6, specimen 7), with a count. */
export const NEW_VENUE_WORDS = {
  title: 'New venue',
  identity: 'Added to this tournament',
  name: 'Name',
  address: 'Address',
  addressHint: 'Used for the Maps link on every schedule.',
  howMany: 'How many',
  kind: 'Kind',
  fewer: (noun: string) => `One fewer ${noun}`,
  more: (noun: string) => `One more ${noun}`,
  named: (names: string[]) => `Named ${listFacilityNames(names)}. You can rename them on Venues & facilities.`,
  note: 'Note',
  notePlaceholder: 'Parking, washrooms, gate code…',
  cancel: 'Cancel',
  add: 'Add venue',
  nameRequired: 'Give the venue a name.',
} as const;
