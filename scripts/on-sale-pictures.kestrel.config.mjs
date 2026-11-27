/**
 * on-sale-pictures.kestrel.config.mjs — Kestrel Bay Softball Association, the INVENTED club the on-sale pages' pictures
 * are shot from (plan docs/projects/active/CLUB_ON_SALE_PAGES_PLAN.md S3b, copy W67). Same shape as
 * prospect-demo.milton.config.mjs, read by the same machinery: `node --env-file=.env.local scripts/seed-prospect-demo.mjs --club=kestrel`.
 *
 * ⚖ /legal conditions for a picture on a public page (W67): never the live demo clubs, never a production row, no birth date,
 * no medical field, no real-looking email or phone, no real logo or photo. So: every person and place below is invented;
 * every address ends in `example.test` (a reserved name that can never receive mail); the phone numbers the world builder
 * makes are in the 555-01xx range set aside for fiction; the free-text notes carry no medical line; the logo is a stock mark.
 *
 * ⚠ DEV ONLY. The seed refuses any database that is not the dev project and any slug that is not `kestrel-bay`.
 */
const D = 'kestrel-bay.example.test';
const YEAR = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric' }).format(new Date()));

export default {
  slug: 'kestrel-bay',
  name: 'Kestrel Bay Softball Association',
  /** Written to organizations.internal_notes on first creation; the reset refuses an org that lacks it. */
  marker: '[ON_SALE_PICTURES] Kestrel Bay pictures club — scripts/seed-prospect-demo.mjs --club=kestrel, then scripts/seed-on-sale-pictures-extras.mjs. Dev database only. Shot by scripts/capture-on-sale-pictures.mjs.',
  seed: 20271121,
  sport: 'softball',
  branding: { themePreset: 'platform', themePrimary: '#1F5F6B', themeAccent: '#C9A227', stockLogoId: 'softball-diamond' },
  site: {
    tagline: 'House league softball for Kestrel Bay, ages 6 to 15',
    description: 'Kestrel Bay Softball Association runs house league softball in five age groups, from U7 to U15, with Saturday-morning games and weeknight practices.',
    contactEmail: `info@${D}`,
    mailingAddress: 'Kestrel Bay Softball Association, PO Box 120, Kestrel Bay, ON',
  },

  /** QA walks sign in here by hand, so these accounts take the standing UAT password (owner 2026-11-25). Dev database
   *  only. The capture script signs in with a one-time link made on dev. Set once, on creation. */
  password: 'UATPassword2026!',
  passwordNote: 'UATPassword2026! (the standing UAT password)',
  people: {
    owner: { email: `president@${D}`, role: 'owner', name: 'Morgan Ashby', title: 'President' },
    admin: { email: `league@${D}`, role: 'league_admin', name: 'Priya Raman', title: 'League Administrator' },
    coach: { email: `coach.okafor@${D}`, name: 'Daniel Okafor' },
    parent: { email: `parent.lachance@${D}`, first: 'Sam', last: 'Lachance' },
    registrar: { email: `registrar@${D}` },
  },

  venues: [
    { name: 'Harbourview Park', address: '12 Harbourview Rd', facilities: ['Diamond 1', 'Diamond 2', 'Diamond 3'], houseLeague: true },
    { name: 'Alder Fields', address: '300 Alder Line', facilities: ['Diamond 1', 'Diamond 2', 'Diamond 3'], houseLeague: true },
    { name: 'Pinecrest Park', address: '45 Pinecrest Dr', facilities: ['Diamond 1', 'Diamond 2'], houseLeague: true },
    { name: 'Northshore Park', address: '8 Northshore Way', facilities: ['Diamond 1'], houseLeague: false, notes: 'Rep teams only.' },
  ],

  // The world is dated around the day it is built (the pictures are re-shot on a schedule), so the season is named by that
  // year, never by a summer that the dates on screen contradict.
  season: {
    name: `${YEAR} House League`,
    slug: `${YEAR}-house-league`,
    description: 'House league softball for Kestrel Bay players. Saturday-morning games, weeknight practices, and a team to play with all summer.',
    baseFee: 150,
    howToPay: 'Pay by e-transfer to the club treasurer, or by cheque or cash at registration night at Harbourview Park. Your child’s spot is held for 14 days.',
    waiverText: 'I acknowledge that softball involves a risk of injury and I consent to my child taking part in Kestrel Bay Softball Association programs.',
    owingAmberDays: 14,
    opensOffset: -60, closesOffset: 35, earlyBirdOffset: 14,
    startsBeforeFirstSaturday: 38, endsAfterFirstSaturday: 70,
  },

  divisions: [
    { code: 'U7',  from: 2020, to: 2021, capacity: 30, price: 120, early: 100, mix: { active: 12, pending: 3 }, paid: 8 },
    { code: 'U9',  from: 2018, to: 2019, capacity: 48, price: 140, early: 120, mix: { active: 31, pending: 6 }, paid: 20,
      teams: [['Herons', '#C62828'], ['Otters', '#1565C0'], ['Gulls', '#F9A825'], ['Pines', '#2E7D32']] },
    { code: 'U11', from: 2016, to: 2017, capacity: 40, price: 150, early: 130, mix: { active: 36 }, paid: 30, gamesPerTeam: 12,
      teams: [['Ospreys', '#00695C'], ['Foxes', '#E65100'], ['Mariners', '#283593'], ['Lynx', '#455A64']],
      coaches: [
        { team: 0, who: 'coach' },
        { team: 1, name: 'Elena Varga', email: `elena.varga@${D}` },
        { team: 2, name: 'Graham Pell', email: `graham.pell@${D}` },
        { team: 3, name: 'Aisha Rahman', email: `aisha.rahman@${D}` },
      ] },
    { code: 'U13', from: 2014, to: 2015, capacity: 32, price: 160, early: 140, mix: { active: 29, pending: 3, waitlisted: 5, ended: 1 }, paid: 21 },
    { code: 'U15', from: 2012, to: 2013, capacity: 24, price: 160, early: 140, mix: { active: 20 }, paid: 17, gamesPerTeam: 7,
      teams: [['Tides', '#AD1457'], ['Ravens', '#00838F']],
      coaches: [
        { team: 0, name: 'Owen Marchetti', email: `owen.marchetti@${D}` },
        { team: 1, name: 'Lucie Tremblay', email: `lucie.tremblay@${D}` },
      ] },
  ],

  siblings: [
    ['U9', 'U11', { parent: true }],
    ['U9', 'U9'], ['U9', 'U9'], ['U9', 'U9'], ['U9', 'U9', { twins: true }],
    ['U7', 'U9'], ['U7', 'U9'],
    ['U9', 'U11'], ['U9', 'U11'],
    ['U11', 'U11'], ['U11', 'U11', { twins: true }],
    ['U11', 'U13'], ['U11', 'U13'],
    ['U13', 'U13'],
    ['U13', 'U15'], ['U13', 'U15'],
    ['U7', 'U7'],
    ['U7', 'U9', 'U11'],
  ],

  schedule: {
    name: `${YEAR} field time`,
    pastSaturdays: 5,
    u11: { venue: 'Harbourview Park', facility: 'Diamond 1', start: '09:00', gameMinutes: 90, slotMinutes: 180, saturdays: 12 },
    u15: { venue: 'Alder Fields', facility: 'Diamond 1', start: '12:30', gameMinutes: 90, slotMinutes: 150, pastSaturdays: 2, saturdays: 7 },
    open: {
      saturdays: 8,
      weeknights: 8,
      blocks: [
        { dow: 6, venue: 'Harbourview Park', facilities: ['Diamond 2', 'Diamond 3'], start: '09:00', end: '12:00', slotMinutes: 90 },
        { dow: 6, venue: 'Alder Fields', facilities: ['Diamond 2', 'Diamond 3'], start: '09:00', end: '12:00', slotMinutes: 90 },
        { dow: 6, venue: 'Pinecrest Park', facilities: ['Diamond 1', 'Diamond 2'], start: '13:00', end: '16:00', slotMinutes: 90 },
        { dow: 2, venue: 'Harbourview Park', facilities: ['Diamond 1', 'Diamond 2'], start: '18:00', end: '21:00' },
        { dow: 3, venue: 'Alder Fields', facilities: ['Diamond 1'], start: '18:00', end: '21:00' },
        { dow: 4, venue: 'Pinecrest Park', facilities: ['Diamond 1'], start: '18:00', end: '21:00' },
      ],
    },
  },

  u11Results: [[9, 6], [5, 5], [11, 3], [4, 8], [7, 7], [10, 2], [6, 5], [8, 9], [6, 3], [7, 6]],
  u11ToCheck: { coachEntered: 8, reported: 9, reportNote: 'We had it 6 to 7. The last run scored on the throw home.' },
  u11Checked: [6, 7],
  u15Results: [[8, 5], [4, 4]],

  welcomeEmail: {
    subject: `Welcome to Kestrel Bay house league, ${YEAR} season`,
    body: 'Hello and welcome to the new season. Registration is open, teams are announced as each age group fills, and games start in the spring. Questions? Reply to this email and a volunteer will answer.',
  },

  previous: {
    name: `${YEAR - 1} House League`,
    slug: `${YEAR - 1}-house-league`,
    venue: 'Alder Fields',
    divisions: [
      { code: 'U9', from: 2017, to: 2018, capacity: 24, price: 130, kids: 12, teams: [['Pelicans', '#1565C0'], ['Badgers', '#EF6C00'], ['Cardinals', '#C62828']] },
      { code: 'U11', from: 2015, to: 2016, capacity: 20, price: 140, kids: 10, teams: [['Bears', '#F57F17'], ['Seals', '#00695C']] },
    ],
    returning: { U9: 6, U11: 4 },
    firstSaturdayOffset: -330, games: 6,
  },

  /** Free text the registrations carry. No medical line: these screens are photographed for public pages. */
  world: {
    // Short, so a guardian's address fits its column in the registrations picture; still a reserved test name.
    familyDomain: 'kb.example.test',
    playerNotes: ['Wants to play with a friend from school.', 'First year playing.', 'Played T-ball last summer.', 'Left-handed.',
      'Can only make Saturdays until school lets out.', 'Played rep last year, wants a house league season.', 'Happy to play anywhere.'],
    adminNotes: ['Will pay at registration night.', 'Asked about a payment plan. Told to pay half now.', 'Cousin of a U11 player.', 'Registered by phone.'],
  },

  repTeams: [],
};
