/**
 * prospect-demo.milton.config.mjs — EVERYTHING that is Milton Bats and nothing that is machinery.
 *
 * Read by scripts/seed-prospect-demo.mjs (the build/reset) and scripts/lib/prospect-demo-world.mjs (the pure world
 * builder). A second prospect club is a second file shaped like this one; the machinery does not change.
 * Plan of record: docs/projects/active/MILTON_DEMO_WORLD_PLAN.md (§1 world, §2 people, §3 reset).
 *
 * Everything below is FICTIONAL. Children and parents are invented; every address ends in `.local` (receives nothing)
 * except the owner's own Gmail aliases listed under `people`.
 *
 * ⚠ DEV ONLY. The seed refuses any database that is not the dev project and any slug that is not `slug` below.
 */
export default {
  slug: 'milton-bats',
  name: 'Milton Bats Softball Association',
  /** Written to organizations.internal_notes on first creation; the reset refuses an org that lacks it. */
  marker: '[PROSPECT_DEMO] Milton Bats demo world — scripts/seed-prospect-demo.mjs (rebuild: npm run demo:milton:reset). Dev database only.',
  /** Deterministic: the same names, households, scores and payers every run. */
  seed: 20271110,
  sport: 'softball',
  /** Written on FIRST creation only (reset never touches them). Placeholder purple until the owner supplies the club's. */
  branding: {
    themePreset: 'platform',
    themePrimary: '#47156C',
    themeAccent: '#89888D',
    /** public/stock-logos/<file>.svg, made as the Look panel makes it (white mark on a circle of the main colour). */
    stockLogoId: 'softball-diamond',
  },
  site: {
    tagline: 'Softball for Milton kids, ages 6 to 15',
    description: 'Milton Bats Softball Association runs house league softball for Milton players in five age groups, from U7 to U15. Games are played on Saturday mornings and some weeknights at our parks.',
    contactEmail: 'b2cowan+milton-contact@gmail.com',
    mailingAddress: 'Milton Bats Softball Association, PO Box 482, Milton, ON L9T 4N9',
  },

  /** The sign-in accounts. The password is set ONLY when an account is first created (the reset never touches it). */
  // No default on purpose: a password in a committed file would be a shared password on a public staging site. Put
  // MILTON_DEMO_PASSWORD in .env.local (gitignored); it is read only when an account has to be created.
  password: process.env.MILTON_DEMO_PASSWORD,
  people: {
    owner: { email: 'b2cowan@gmail.com', role: 'owner' },
    admin: { email: 'b2cowan+hladmin@gmail.com', role: 'league_admin', name: 'Kelly Barrett', title: 'League Administrator' },
    /** Coach of the first U11 team (see divisions[U11].teams). */
    coach: { email: 'b2cowan+coach@gmail.com', name: 'Ryan Delaney' },
    /** Never an account: a guardian contact of one U9 child and one U11 child (the family-app walk invites it live). */
    parent: { email: 'b2cowan+parent@gmail.com', first: 'Taylor', last: 'Brennan' },
    /** Walk 5 invites this address live; the reset removes the membership that walk makes. Never seeded. */
    registrar: { email: 'b2cowan+registrar@gmail.com' },
  },

  venues: [
    { name: 'Sam Sherritt Park', address: '100 Sherritt Way', facilities: ['Diamond 1', 'Diamond 2', 'Diamond 3'], houseLeague: true },
    { name: 'Lions Park', address: '41 Lions Park Dr', facilities: ['Diamond 1', 'Diamond 2', 'Diamond 3'], houseLeague: true },
    { name: 'Kinsmen Park', address: '200 Kinsmen Way', facilities: ['Diamond 1', 'Diamond 2'], houseLeague: true },
    { name: 'Sherwood Park', address: '75 Sherwood Cres', facilities: ['Diamond 1'], houseLeague: false, notes: 'Rep teams only. House league never books here.' },
  ],

  season: {
    name: '2027 Summer House League',
    slug: '2027-summer-house-league',
    description: 'House league softball for Milton players. Saturday-morning games, weeknight practices, and a team to play with all summer.',
    baseFee: 150,
    howToPay: 'Pay by e-transfer to the club treasurer, or by cheque (payable to Milton Bats Softball Association) or cash at registration night at Sam Sherritt Park. Your child’s spot is held for 14 days.',
    waiverText: 'I acknowledge that softball involves a risk of injury and I consent to my child taking part in Milton Bats Softball Association programs. I confirm the medical and contact information I have given is correct.',
    owingAmberDays: 14,
    /** Day offsets from the demo day. */
    opensOffset: -60, closesOffset: 35, earlyBirdOffset: 14,
    startsBeforeFirstSaturday: 38, endsAfterFirstSaturday: 70,
  },

  /**
   * Divisions. `mix` is the exact status count of the registrations: active (Accepted), pending (To review), waitlisted,
   * ended (accepted, then withdrawn). `paid` is how many of the active ones have paid, through the real money writer.
   */
  divisions: [
    { code: 'U7',  from: 2020, to: 2021, capacity: 30, price: 120, early: 100, mix: { active: 11, pending: 3 }, paid: 7 },
    { code: 'U9',  from: 2018, to: 2019, capacity: 48, price: 140, early: 120, mix: { active: 33, pending: 5 }, paid: 21,
      teams: [['Rockets', '#D32F2F'], ['Comets', '#1976D2'], ['Thunder', '#F9A825'], ['Stingers', '#2E7D32']] },
    { code: 'U11', from: 2016, to: 2017, capacity: 40, price: 150, early: 130, mix: { active: 36 }, paid: 31, gamesPerTeam: 12,
      teams: [['Diamondbacks', '#00695C'], ['Wildcats', '#E65100'], ['Sluggers', '#283593'], ['Bombers', '#455A64']],
      coaches: [
        { team: 0, who: 'coach' },
        { team: 1, name: 'Marcus Ferreira', email: 'marcus.ferreira@milton-bats.local' },
        { team: 2, name: 'Harjit Bains', email: 'harjit.bains@milton-bats.local' },
        { team: 3, name: 'Tanya Beaumont', email: 'tanya.beaumont@milton-bats.local' },
      ] },
    { code: 'U13', from: 2014, to: 2015, capacity: 32, price: 160, early: 140, mix: { active: 30, pending: 2, waitlisted: 6, ended: 1 }, paid: 20 },
    { code: 'U15', from: 2012, to: 2013, capacity: 24, price: 160, early: 140, mix: { active: 20 }, paid: 18, gamesPerTeam: 7,
      teams: [['Mavericks', '#AD1457'], ['Timberwolves', '#00838F']],
      coaches: [
        { team: 0, name: 'Chris Lindqvist', email: 'chris.lindqvist@milton-bats.local' },
        { team: 1, name: 'Dana Okonkwo', email: 'dana.okonkwo@milton-bats.local' },
      ] },
  ],

  /** Sibling households that cross or share divisions (the first U9 + U11 one is the +parent household). */
  siblings: [
    ['U9', 'U11', { parent: true }],
    ['U9', 'U9'], ['U9', 'U9'], ['U9', 'U9'], ['U9', 'U9'], ['U9', 'U9', { twins: true }],
    ['U7', 'U9'], ['U7', 'U9'],
    ['U9', 'U11'], ['U9', 'U11'],
    ['U11', 'U11'], ['U11', 'U11', { twins: true }],
    ['U11', 'U13'], ['U11', 'U13'],
    ['U13', 'U13'],
    ['U13', 'U15'], ['U13', 'U15'],
    ['U7', 'U7'],
    ['U7', 'U9', 'U11'],
  ],

  /** Saturday games: each U11 Saturday is two games at one diamond; each U15 Saturday is one. */
  schedule: {
    name: 'Summer 2027 field time',
    pastSaturdays: 5,
    u11: { venue: 'Sam Sherritt Park', facility: 'Diamond 1', start: '09:00', gameMinutes: 90, slotMinutes: 180, saturdays: 12 },
    u15: { venue: 'Lions Park', facility: 'Diamond 1', start: '12:30', gameMinutes: 90, slotMinutes: 150, pastSaturdays: 2, saturdays: 7 },
    /** Field time offered to house league and not yet given to a division. Saturdays heavy, some weeknights. */
    open: {
      saturdays: 8,
      saturdayRows: [
        { venue: 'Sam Sherritt Park', facility: 'Diamond 2', start: '09:00', end: '12:00' },
        { venue: 'Sam Sherritt Park', facility: 'Diamond 3', start: '09:00', end: '12:00' },
        { venue: 'Lions Park', facility: 'Diamond 2', start: '09:00', end: '12:00' },
        { venue: 'Lions Park', facility: 'Diamond 3', start: '09:00', end: '12:00' },
        { venue: 'Kinsmen Park', facility: 'Diamond 1', start: '13:00', end: '16:00' },
        { venue: 'Kinsmen Park', facility: 'Diamond 2', start: '13:00', end: '16:00' },
      ],
      weeknights: 8,
      weeknightRows: [
        { dow: 2, venue: 'Sam Sherritt Park', facility: 'Diamond 1', start: '18:00', end: '21:00' },
        { dow: 3, venue: 'Lions Park', facility: 'Diamond 1', start: '18:00', end: '21:00' },
        { dow: 4, venue: 'Kinsmen Park', facility: 'Diamond 1', start: '18:00', end: '21:00' },
      ],
    },
  },

  /**
   * U11 results, game by game, in the order of the past Saturdays (two games each): [homeRuns, awayRuns]. Pairings rotate
   * (A-B/C-D, A-C/B-D, A-D/B-C); the home side alternates. Two ties; run differentials vary. See the world builder.
   */
  u11Results: [[8, 5], [6, 6], [10, 4], [3, 9], [7, 7], [11, 2], [6, 4], [9, 8], [5, 3], [8, 6]],
  /** Index in u11Results of the two scores waiting in "Scores to check", and what the away coach says about the second. */
  u11ToCheck: { coachEntered: 8, reported: 9, reportNote: 'I had it 7 to 8. Our seventh run scored on the wild pitch.' },
  /** The last-but-one Saturday's two games: entered by their coaches, then checked by the league admin. */
  u11Checked: [6, 7],
  u15Results: [[7, 4], [6, 6]],

  welcomeEmail: {
    subject: 'Welcome to Milton Bats house league, 2027 season',
    body: 'Hello and welcome to the 2027 summer season. Registration is open, teams are announced as each age group fills, and games start in the spring. Questions? Reply to this email and a volunteer will answer.',
  },

  previous: {
    name: '2026 Summer House League',
    slug: '2026-summer-house-league',
    divisions: [
      { code: 'U9', from: 2017, to: 2018, capacity: 24, price: 130, kids: 12, teams: [['Blue Jays', '#1565C0'], ['Orioles', '#EF6C00'], ['Cardinals', '#C62828']] },
      { code: 'U11', from: 2015, to: 2016, capacity: 20, price: 140, kids: 10, teams: [['Tigers', '#F57F17'], ['Mariners', '#00695C']] },
    ],
    returning: { U9: 6, U11: 4 },
    /** Day offsets from the demo day (about a year ago). */
    firstSaturdayOffset: -330, games: 6,
  },

  /** Rep teams (Phase B, not built yet): invented names, light rosters. */
  repTeams: [],
};
