import { joinWithAnd as nameList, possessive } from './utils';
import { emails, families, namesCapped, players } from './house-league-teams-words';

/**
 * TEAMS & DRAFT, THE SCREEN'S WORDS (Club Tier Stage 9c, Part 3; HOUSE_LEAGUE_STAGE9C_COPY.md §1-8). The shared counts and
 * the refusals live in lib/house-league-teams-words.ts (routes read them too); this is what only the screen and its windows
 * say. No "the" before a team name in a template (copy §15). Client-safe.
 */
export const TEAMS_WORDS = {
  title: 'Teams & draft',
  loading: 'Loading teams & draft…',
  failed: 'Teams & draft didn’t load.',
  noAccess: 'You don’t have access to house league teams.',
  noDivisions: { title: 'No divisions yet', body: 'Add divisions to the season first. Each division makes its own teams.' },
  tabsLabel: 'Divisions',
  divisionLabel: 'Division',
  sub: (season: string, divisions: number, published: number) =>
    `${season} · ${divisions} ${divisions === 1 ? 'division' : 'divisions'} · ${
      published === 0 ? 'nothing published yet' : published === divisions ? 'all published' : `${published} of ${divisions} published`}`,

  step: {
    teams: (names: readonly string[], noCoach: readonly string[]) =>
      `${names.length} ${names.length === 1 ? 'team' : 'teams'}: ${nameList([...names])} · ${
        noCoach.length === 0 ? 'every team has a coach' : `no coach yet for ${nameList([...noCoach])}`}`,
    teamsNone: 'Make the teams first. You can name them now and add coaches any time before you publish.',
    ratings: (rated: number, total: number) =>
      rated === total ? `All ${total} rated` : `${rated} of ${total} rated · the other ${total - rated} count as a 3`,
    ratingsNone: 'Nobody is rated. The draft still runs: it deals the players at random, evenly. Rate them first if you want balanced teams.',
    ratingsEmpty: (spots: number | null) => `No players yet${spots != null ? ` · ${spots} spots` : ''}`,
    draft: (n: number, teams: number) => `Deals the ${players(n)} across the ${teams} teams by rating, strongest first. Nothing is sent.`,
    publish: (familyCount: number) => `Tells ${families(familyCount)} their child’s team and invites each coach to their team page.`,
  },
  stepTitle: { teams: 'Teams', ratings: 'Ratings', draft: 'Draft', publish: 'Publish' },
  button: {
    createTeams: 'Create teams', addTeams: 'Add teams', rate: 'Rate players', ratePhone: 'Rate',
    run: 'Run the draft', runPhone: 'Run', again: 'Draft again', publish: 'Publish teams',
  },
  notDrafted: (review: number, waitlisted: number) => {
    const parts = [review > 0 ? `${review} still to review` : null, waitlisted > 0 ? `${waitlisted} on the waitlist` : null].filter(Boolean);
    return parts.length ? `Not on the board: ${parts.join(', ')}.` : null;
  },
  reviewLink: 'Review on Registrations',

  pool: { title: 'Not on a team', empty: 'Everyone in this division is on a team.', hint: 'A player accepted after you publish appears here.' },
  card: {
    noCoach: 'No coach yet',
    empty: 'Drag players here, or run the draft',
    foot: (n: number, avg: number | null) => `${players(n)}${avg != null ? ` · avg ${avg.toFixed(1)}` : ''}`,
    edit: (team: string) => `Edit ${team}`,
    open: (team: string) => `Open ${team}`,
  },
  kid: {
    age: (age: number | null) => (age == null ? 'Age not given' : `Age ${age}`),
    notRated: 'counts as a 3',
    owes: (amount: string) => `owes ${amount}`,
    asked: (day: string) => `Asked to withdraw ${day}`,
    moved: 'Moved by you',
    putBack: (team: string) => `Put back on ${team}`,
    locked: 'Locked',
    left: (name: string, day: string) => `${name} left the team on ${day}`,
    ratingAria: (rating: number | null) => (rating == null ? 'Not rated' : `Rated ${rating}`),
    more: (name: string) => `More for ${name}`,
    moveTo: 'Move to…',
  },
  balance: { avg: 'Average rating', sizes: 'Sizes', moved: 'Moved by hand' },
  back: 'All teams',
  tools: 'Tools',
  export: 'Export',
  clear: {
    menu: 'Take all players off teams',
    title: (division: string) => `Take everyone in ${division} off their teams?`,
    body: (n: number, division: string) => `Take all ${players(n)} in ${division} off their teams? Locks and moves by hand go too. Nothing is sent.`,
    button: 'Take them off',
    working: 'Taking them off…',
  },

  move: {
    sheetTitle: (name: string) => `Move ${name} to…`,
    sheetSub: (rating: number | null, division: string, seeRatings: boolean) =>
      seeRatings ? `${rating == null ? 'Not rated' : `Rated ${rating}`} · ${division}` : division,
    team: (count: number, avg: number | null, after: number | null, first: string) =>
      `${players(count)}${avg != null && after != null ? ` · avg ${avg.toFixed(1)} → ${after.toFixed(1)} with ${first}` : ''}`,
    current: 'Now here',
    off: 'Not on a team',
    offSub: (first: string) => `Take ${first} off the team`,
    confirmTitle: (name: string, team: string) => `Move ${name} to ${team}?`,
    confirmBody: (family: string, first: string, team: string, coaches: readonly string[]) =>
      `${capital(family)} gets an email saying ${first} is now on ${team}${coaches.length ? `, ${coaches.length === 1 ? 'coach' : 'coaches'} ${nameList([...coaches])}` : ''}. Both teams’ pages change for their coaches.`,
    offTitle: (name: string) => `Take ${name} off their team?`,
    offBody: (family: string, first: string) => `${capital(family)} isn’t emailed: ${first} goes back to Not on a team until you place them.`,
    foot: '1 email',
    button: 'Move and email',
    offButton: 'Take off the team',
    placeTitle: (name: string, team: string) => `Put ${name} on ${team}?`,
    placeBody: (family: string, first: string) => `${capital(family)} gets an email with ${possessive(first)} team and coach.`,
    placeButton: 'Place and email',
    working: 'Moving…',
    emailFailed: 'That email couldn’t be sent. Their status page shows the team.',
  },

  rate: {
    title: (division: string) => `Rate ${division}`,
    intro: '1 is newest to the sport, 5 is among the strongest in the age group. The draft uses these to balance the teams. Only the people who run the league see ratings; families, coaches and the registrar never do.',
    all: (n: number) => `All ${n}`,
    unrated: 'Not rated',
    colPlayer: 'Player', colAge: 'Age', colRating: 'Rating',
    selected: (n: number) => `${n} selected`,
    rateThem: 'Rate them',
    hint: 'On a keyboard, type 1 to 5 to rate and move to the next player. Tap a chosen number again to clear it.',
    foot: (rated: number, total: number) => `${rated} of ${total} rated · erased when the season finishes`,
    done: 'Done',
    empty: 'No players to rate. Ratings are for accepted players in this division.',
    err: 'That rating didn’t save. Check your connection and tap it again.',
    aria: (name: string, n: number) => `Rate ${name} ${n} of 5`,
    bulkAria: (n: number) => `Rate the selected players ${n} of 5`,
    selectAll: 'Select every player',
    select: (name: string) => `Select ${name}`,
  },

  draft: {
    title: (division: string) => `Run the draft for ${division}`,
    players: 'Players',
    playersLine: (n: number, owing: readonly string[]) =>
      `${n} accepted${owing.length ? `, including ${namesCapped(owing)}, who still ${owing.length === 1 ? 'owes' : 'owe'}` : ''}. Every accepted player holds their spot.`,
    notDrafted: 'Not drafted',
    reviewLine: (names: readonly string[]) =>
      `${namesCapped(names)} ${names.length === 1 ? 'is' : 'are'} still to review and ${names.length === 1 ? 'isn’t' : 'aren’t'} drafted.`,
    waitLine: (n: number) => `${n} on the waitlist ${n === 1 ? 'isn’t' : 'aren’t'} drafted; a player who gets a spot later appears under Not on a team.`,
    nobodyOut: 'Nobody to review and nobody on the waitlist.',
    teams: 'Teams',
    teamsLine: (sizes: readonly { name: string; size: number }[], n: number) =>
      `${sizes.map(s => `${s.name} ${s.size}`).join(' · ')}${sizes.length > 0 && n % sizes.length !== 0 ? ` (${players(n)} don’t divide evenly by ${sizes.length})` : ''}`,
    locked: 'Locked',
    lockedLine: (n: number) => `${n} locked: they stay on their team and count toward its average.`,
    ratings: 'Ratings',
    ratingsLine: (rated: number, total: number) =>
      rated === 0 ? 'Nobody is rated, so players are dealt at random, evenly.'
        : rated === total ? `All ${total} rated` : `${rated} of ${total} rated · the other ${total - rated} count as a 3`,
    how: 'How it deals',
    howLine: 'Strongest first, and the order reverses each round. Ties and the first pick are drawn at random.',
    foot: 'Nothing is sent. Families hear when you publish.',
    button: 'Run the draft',
    working: 'Dealing…',
    close: 'Close',
    againTitle: (division: string) => `Draft ${division} again?`,
    againBody: (n: number, moves: readonly string[]) =>
      `This deals all ${players(n)} again and replaces the current teams${moves.length ? `, including your ${moves.length === 1 ? '1 move' : `${moves.length} moves`} by hand (${namesCapped(moves)})` : ''}. Locked players stay where they are.`,
    againButton: 'Draft again',
  },

  team: {
    createTitle: (division: string) => `Create teams for ${division}`,
    count: 'Number of teams',
    create: (n: number) => `Create ${n} ${n === 1 ? 'team' : 'teams'}`,
    creating: 'Creating…',
    defaultName: (n: number) => `Team ${n}`,
    name: 'Name', colour: 'Colour', coach: 'Coach', coachEmail: 'Coach’s email', coaches: 'Coaches',
    noColour: 'No colour',
    addCoach: 'Add another coach',
    removeCoach: (name: string) => `Remove ${name} as coach`,
    hintBefore: (first: string, division: string) =>
      `${first} gets an invite to the team page when you publish ${division}. The page shows this team’s players and each family’s name, email and phone.`,
    hintAfter: (first: string) => `${first} is invited when you press ✓.`,
    noCoachRead: 'No coach yet',
    errEmail: 'Enter an email address, like name@example.com.',
    errName: 'Enter the coach’s name.',
    errTeamName: 'Give the team a name.',
    confirmInviteTitle: (first: string) => `Send ${first} the invite?`,
    confirmInviteBody: (first: string, team: string) =>
      `${first} gets an email with a link to the ${team} team page, which shows the team’s players and each family’s name, email and phone.`,
    confirmInviteButton: 'Send invite',
    confirmRemoveTitle: (name: string) => `Remove ${name} as coach?`,
    confirmRemoveBody: (first: string, team: string) => `${first} loses the ${team} team page at once. Families aren’t told.`,
    confirmRemoveButton: 'Remove',
    deleteTeam: 'Delete this team',
    deleteTitle: (team: string) => `Delete ${team}?`,
    deleteBody: (team: string) => `${team} has no players. Deleting it takes it out of the division and its schedule.`,
    deleteButton: 'Delete',
    editLabel: 'Edit team',
    saving: 'Saving…',
  },
  coachState: {
    waiting: 'Invited when you publish',
    invited: (day: string) => `Invited ${day}`,
    joined: 'Signed in',
    expired: 'Invite expired',
    failed: 'Invite didn’t send',
    sendAgain: 'Send again',
  },

  publish: {
    title: (division: string) => `Publish the ${division} teams`,
    body: (coaches: readonly { name: string; team: string }[]) => {
      const lead = 'Each family gets one email naming their children’s teams and coaches, and each child’s team shows on the family’s status page.';
      if (coaches.length === 0) return lead;
      const shown = coaches.slice(0, 3).map(c => `${c.name} is invited to the ${c.team} team page`);
      return `${lead} ${nameList(shown)}${coaches.length > 3 ? `, and ${coaches.length - 3} more coaches` : ''}.`;
    },
    placed: (n: number) => `All ${n} accepted players are on a team`,
    unplaced: (n: number) => `${players(n)} accepted ${n === 1 ? 'isn’t' : 'aren’t'} on a team. They’re told when you place them.`,
    noCoach: (team: string) => `No coach for ${team} yet · Their families read “Coach to be announced”. Add one any time; they’re invited then.`,
    review: (names: readonly string[]) => `${namesCapped(names)} ${names.length === 1 ? 'is' : 'are'} still to review · Not on a team, so not emailed now.`,
    preview: (family: string, children: number) => `Preview the email to the ${family} family (${children} ${children === 1 ? 'child' : 'children'})`,
    foot: (n: number) => `${emails(n)}, one per family`,
    button: (n: number) => `Publish and email ${families(n)}`,
    sending: (n: number) => `Sending to ${families(n)}…`,
    working: 'Publishing…',
    done: (day: string, n: number, invited: readonly { name: string; team: string }[]) =>
      `Published ${day} · ${families(n)} emailed${invited.length ? ` · ${namesCapped(invited.map(c => `${c.name} invited to coach ${c.team}`))}` : ''}.`,
    doneQuiet: (day: string) => `Published ${day}.`,
    failed: (bad: number, total: number) => `The teams are published, but ${bad} of ${emails(Math.max(total, bad))} couldn’t be sent. Their status pages show the team.`,
    sendAgain: (n: number) => `Send the ${n} again`,
    after: 'Moving a player now emails their family. There is no unpublish: families already have the email.',
  },
} as const;

function capital(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
