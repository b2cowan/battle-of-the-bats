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
  /** Written on FIRST creation only (reset never touches them). The demo's own purple; the club is not supplying theirs. */
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
    /** A demo account, not the owner's real one (owner 2026-11-10): a club has exactly ONE owner — "the owner's email"
     *  lookups read a single row — so the real account is not a member of this club at all. */
    owner: { email: 'b2cowan+owner@gmail.com', role: 'owner', name: 'Jordan Whitfield', title: 'President' },
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
    /** Fixed so the season's admin addresses survive every reset (the presenter's run sheet links to them). The reset deletes
     *  every season of this club before it rebuilds, so re-using the id is safe. Change it only together with the run sheet. */
    id: '6d1f0a52-3c4e-4b8a-9f2e-27a1b0c0d927',
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

  /**
   * The club's own sign-up questions (Demo 5, plan §9; scripts/lib/prospect-demo-signup-form.mjs). "Can a parent help?" is
   * the dev test club's question, asked once per sign-up and shown on the draft board. In `division`, `helpers` families
   * answer it (the Coach ones are the parent-coaches the admin places by hand); the live sign-up is the fourth Coach.
   * `liveFriendCode` is the first five characters of the friend code the live sign-up names (its check letter is worked
   * out): FIXED, so the run sheet prints it once — "MLT9B" makes MLT 9BV. Change it only together with the run sheet.
   */
  signupForm: {
    division: 'U9',
    questions: [
      { key: 'allergies', type: 'long_answer', label: 'Does your child have any allergies or medical needs we should know about?', health: true },
      { key: 'tee', type: 'one_choice', label: 'T-shirt size', choices: ['YS', 'YM', 'YL', 'AS', 'AM'] },
      { key: 'help', type: 'many_choices', label: 'Can a parent help?', choices: ['Coach', 'Assistant coach', 'Field set-up'], asked: 'once', board: true },
    ],
    helpers: { coach: 3, assistant: 3, fieldSetup: 3 },
    liveFriendCode: 'MLT9B',
    tShirtByDivision: { U7: ['YS', 'YS', 'YM'], U9: ['YS', 'YM', 'YM', 'YL'], U11: ['YM', 'YL', 'YL'], U13: ['YL', 'AS', 'AS'], U15: ['AS', 'AM', 'AM'] },
    allergyNotes: ['Peanut allergy, carries an EpiPen in the bag', 'Asthma, inhaler in the bag', 'Allergic to bee stings'],
  },

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
    /** Field time offered to house league and not yet given to a division (Walk 4 gives it to U9).
     *  Each entry is one BLOCK of the club's schedule, so House league's time shows it as its own row with its own
     *  "Give it to": one click hands a park's Saturdays to "U9 games", another a park's Tuesdays to "U9 practice time".
     *  Saturday blocks are cut into game-length slots, because the generator makes each game the length of a slot.
     *  Weeknight blocks are one slot per diamond; the practice hand-out cuts them into practices (60 minutes by default).
     *  Sam Sherritt's Tuesday holds two diamonds, so it alone gives U9's 4 teams a practice a week (6 seats). */
    open: {
      saturdays: 8,
      weeknights: 8,
      blocks: [
        { dow: 6, venue: 'Sam Sherritt Park', facilities: ['Diamond 2', 'Diamond 3'], start: '09:00', end: '12:00', slotMinutes: 90 },
        { dow: 6, venue: 'Lions Park', facilities: ['Diamond 2', 'Diamond 3'], start: '09:00', end: '12:00', slotMinutes: 90 },
        { dow: 6, venue: 'Kinsmen Park', facilities: ['Diamond 1', 'Diamond 2'], start: '13:00', end: '16:00', slotMinutes: 90 },
        { dow: 2, venue: 'Sam Sherritt Park', facilities: ['Diamond 1', 'Diamond 2'], start: '18:00', end: '21:00' },
        { dow: 3, venue: 'Lions Park', facilities: ['Diamond 1'], start: '18:00', end: '21:00' },
        { dow: 4, venue: 'Kinsmen Park', facilities: ['Diamond 1'], start: '18:00', end: '21:00' },
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

  /**
   * ══ PHASE B — the rep side, for the five presentation demos (plan §1, §8). Built by scripts/lib/prospect-demo-rep.mjs. ══
   * The team list and the dome permit are invented for the demo (the club is not sending its own; owner 2026-11-24).
   * Change `repTeams` or `dome`, then `npm run demo:milton`. Team names are invented in the club's style. A team's id is derived from its slug, so its
   * Coaches Portal address survives every rebuild (change a slug only together with the run sheet).
   */
  repPeople: {
    /** The dressed team's head coach (Demos 2–4) and its assistant (receives the practice plan in Demo 3). */
    headCoach: { email: 'b2cowan+repcoach@gmail.com', name: 'Morgan Hale' },
    assistant: { email: 'b2cowan+assistant@gmail.com', name: 'Priya Nair' },
    /** One invitation still waiting, so Members shows "Invited" (plan §10). A `.local` account nobody signs in to. */
    invited: { email: 'renee.castellano@milton-bats.local', name: 'Renee Castellano', role: 'treasurer', title: 'Treasurer' },
  },
  /**
   * [age group, tier, head coach name (a .local account; the dressed team's is `repPeople.headCoach`)]. Jan 1 cut-off.
   * The club's structure (owner 2026-11-24): each age group has two levels, Rep and Select, and each level a senior team
   * (Purple, the older birth year) and a junior team (White, the younger). A tier is "<level> <side>"; the level is the
   * team's group on the public site and the admin's Rep teams screen (`repGroups`), the side picks its birth year
   * (`repSides`). The coach names are the earlier placeholder list's, re-used so no coach is left on the club with no team.
   */
  repTeams: [
    ['U11', 'Rep Purple', 'Lauren Petrakis'], ['U11', 'Rep White', 'Kevin Osei'], ['U11', 'Select Purple', 'Rosa Delgado'], ['U11', 'Select White', 'Dana Whitlock'],
    ['U13', 'Rep Purple', 'Brian Kowalczyk'], ['U13', 'Rep White', 'Monique Baptiste'], ['U13', 'Select Purple', 'Graham Tennant'], ['U13', 'Select White', 'Sam Achterberg'],
    ['U15', 'Rep Purple', null], ['U15', 'Rep White', 'Aisha Rahimi'], ['U15', 'Select Purple', 'Patrick Doucet'], ['U15', 'Select White', 'Erin Moffatt'],
    ['U17', 'Rep Purple', 'Heather McLeod'], ['U17', 'Rep White', 'Victor Lindgren'], ['U17', 'Select Purple', 'Simone Arsenault'], ['U17', 'Select White', 'Megan Thibault'],
    ['U19', 'Rep Purple', 'Darren Fitzpatrick'], ['U19', 'Rep White', 'Nadia Volkova'], ['U19', 'Select Purple', 'Owen Gallant'], ['U19', 'Select White', 'Andre Lafleur'],
  ],
  /** The public site's and the admin's team headings, in order: a team's group is its tier's first word. */
  repGroups: ['Rep', 'Select'],
  /** A tier's last word → which of its age group's two birth years the team is: Purple the older, White the younger. */
  repSides: { Purple: 'older', White: 'younger' },
  /** Born-in years for the 2027 season, by age group (Jan 1 cut-off), older year first. */
  repBirthYears: { U11: [2016, 2017], U13: [2014, 2015], U15: [2012, 2013], U17: [2010, 2011], U19: [2008, 2009] },
  repSeason: { name: '2027 Season', year: 2027, previousName: '2026 Season', previousYear: 2026 },
  /** Light rosters for the other nineteen; the dressed team has its own twelve. */
  repRosterSize: [11, 12],
  /** Teams with tryouts open on the public site (Demo 5). */
  repTryoutsOpen: { teams: ['U11 Rep Purple', 'U11 Rep White'], description: 'Tryouts for the 2027 season: U11 Rep Purple is players born 2016, U11 Rep White players born 2017. Two sessions in the dome; bring a glove, a helmet if you have one, and water.' },

  /**
   * The dome and its winter permit — invented for the demo; the club's real permit is NOT coming (owner 2026-11-24), so
   * nothing here or in the seed may read as "waiting for the club" (dome name, fields and which are half, days and
   * times, first and last day, dates off, cost). Dates are Sunday COUNTS from the first Sunday on or after
   * demo day − `firstSundayBefore` days, so the world stays relative. The permit costs `cost` for the time it holds
   * (dates off excluded), which is how the product prices an hour.
   * Part 1 (`sentSundays`) is sent and billed by the seed; Demo 1 builds part 2 live, from the first Sunday after the
   * dates off (plan §8.1 — the same dates would leave the live drafts empty).
   */
  dome: {
    venue: { name: 'Escarpment Indoor Dome', address: '8 Dome Way, Milton', fields: ['Field 1', 'Field 2', 'Field 3', 'Field 4', 'Field 5', 'Field 6'], halfFields: ['Field 5', 'Field 6'] },
    permit: { name: 'Winter dome 2026–27', issuer: 'Escarpment Indoor Dome', reference: 'ESC-W27-0412', weekday: 7, start: '08:00', end: '11:00', sundays: 20, offAfter: 8, offCount: 2, offNote: 'Dome closed (holiday break)', firstSundayBefore: 35, costPerFullFieldHour: 95 },
    /** Practices are 1½-hour blocks, so a Sunday holds two (8:00 and 9:30) on each of the six fields. */
    slotMinutes: 90,
    /** Practices a team gets, by level (the owner's split): a Select team gets half of what a Rep team gets. */
    levelWeights: { Rep: 2, Select: 1 },
    part1: { name: 'Winter dome · part 1', sentDaysBefore: 56 },
    /** The bill's payment dates, as days from the demo day (the product's "On these dates" plan). */
    billDates: [-42, -7, 10],
  },

  /** Milton Bats U15 Rep Purple — the team every Coaches Portal demo runs on (plan §8.6). */
  dressed: {
    team: 'U15 Rep Purple',
    dues: { total: 1600, installments: 4, dueOffsets: [-60, 12, 52, 110] },
    fundraiser: { name: 'Fall bottle drive', rebatePercent: 50, startOffset: -74, endOffset: -58 },
    sponsor: { name: 'Main Street Physio & Sport', pledged: 1500, received: 750, receivedOffset: -30, contact: 'Alana Brooks', email: 'alana@mainstreetphysio.local', address: '210 Main St E, Milton, ON' },
  },

  /** The public tournament (Demo 5). Name invented — owed by the owner. Free: no fee book, no team payments. */
  tournament: {
    name: 'Battle of the Bats', slug: 'battle-of-the-bats',
    contactEmail: 'b2cowan+milton-contact@gmail.com',
    divisions: [
      { name: 'U11', teams: ['Milton Bats U11 Rep Purple', 'Milton Bats U11 Rep White', 'Kelso Ridge Raptors', 'Twelve Mile Cyclones'] },
      { name: 'U15', teams: ['Milton Bats U15 Rep Purple', 'Milton Bats U15 Rep White', 'Harrison Hollow Hornets', 'Cedar Line Storm'] },
    ],
  },

  /** Public-site extras (Demo 5): filled only when empty, like the contact details. The notice is re-posted every rebuild. */
  siteExtras: {
    sponsors: [
      { name: 'Main Street Physio & Sport', link: null },
      { name: 'Escarpment Indoor Dome', link: null },
      { name: 'Halton Hardware & Supply', link: null },
    ],
    notice: { text: 'Winter dome practices run every Sunday until the holiday break.', detail: 'Rep teams: your Sunday practices are on your team schedule. House league registration for 2027 is open now.' },
  },
};
