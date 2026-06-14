export type PlanArticlePainItem = {
  title: string;
  body: string;
};

export type PlanArticleStep = {
  num: string;
  label: string;
  title: string;
  body: string;
};

export type PlanArticleContent = {
  billingQuestion: string;
  billingSub: string;
  eyebrow: string;
  panelHeadline: string;
  painHeadline: string;
  painItems: PlanArticlePainItem[];
  stepsHeadline: string;
  steps: PlanArticleStep[];
  featuresLabel: string;
  features: string[];
};

export const PLAN_ARTICLE_CONTENT: Record<'tournament_plus' | 'league' | 'club' | 'team', PlanArticleContent> = {
  team: {
    billingQuestion: 'Does your coaching staff manage competitive teams alongside your tournaments?',
    billingSub:
      'The Coaches Portal is a standalone workspace for one rep team — roster, lineups, budget, schedule, and documents. No org account required.',
    eyebrow: 'Coaches Portal',
    panelHeadline: 'Manage your team. Not your inbox.',
    painHeadline: 'If this is how you run your team, we know the drill.',
    painItems: [
      {
        title: 'The roster lives in a group text.',
        body: 'Player contact info, positions, and jersey numbers are scattered across messages. Getting a clean list means copying it from your phone to a spreadsheet.',
      },
      {
        title: 'The lineup is in a notes app.',
        body: 'No lineup history. When someone asks what you ran in January, there is no answer. Every game starts from scratch.',
      },
      {
        title: 'Team fees are tracked in your head.',
        body: 'You know roughly who has paid. The actual amounts, due dates, and payment history are a mental model — not a record.',
      },
      {
        title: 'Travel documents get emailed in pieces.',
        body: 'Medical forms come in one at a time. Consent forms go missing. You figure out what is missing when you are already at the hotel.',
      },
    ],
    stepsHeadline: 'Everything a head coach needs to run a season.',
    steps: [
      {
        num: '01',
        label: 'Roster',
        title: 'Your team, not a group text.',
        body: 'Build and manage your roster with positions, jersey numbers, contact info, and season history. Everything lives here — accessible from anywhere.',
      },
      {
        num: '02',
        label: 'Schedule and lineups',
        title: 'Build lineups. Track attendance. Export to PDF.',
        body: 'Enter your game schedule, track who showed up, and build lineups with full lineup history by game. Export a PDF for the bench in one click.',
      },
      {
        num: '03',
        label: 'Team budget',
        title: 'Dues, expenses, and payment reminders in one place.',
        body: 'Track team income and expenses. Log player dues and send payment reminders. No more mental accounting — the numbers are always in front of you.',
      },
      {
        num: '04',
        label: 'Documents',
        title: "Missing paperwork is visible before it's a problem.",
        body: 'Upload and track player documents — consent forms, medical notes, eligibility certificates. You see what is outstanding at a glance, not the night before a tournament.',
      },
    ],
    featuresLabel: 'Included',
    features: [
      'Full roster management — positions, jersey numbers, and season history',
      'Game schedule, attendance tracking, and lineup builder with PDF export',
      'Team budget, player dues, expense tracking, and payment reminders',
      'Documents, season setup checklist, and year-over-year history',
      'Tournaments included — run round robins, exhibition weekends, and local events',
      'Tournament history included — every event your team has been part of, preserved',
      'Link to your parent organization at any time, without transferring ownership',
    ],
  },


  tournament_plus: {
    billingQuestion: 'Ready to stop building your schedule by hand?',
    billingSub:
      "Tournament Plus handles schedule generation, brackets, and email communications — so you're not starting from scratch for every event.",
    eyebrow: 'Tournament Plus',
    panelHeadline: 'From first registration to final standings.',
    painHeadline: 'If this is your tournament setup, we know the drill.',
    painItems: [
      {
        title: 'Teams register by email.',
        body: "You're tracking 24 entries in a spreadsheet and chasing three teams for their roster form.",
      },
      {
        title: 'You built the schedule by hand.',
        body: 'Then two teams conflicted. Then a field flooded. Then you did it again.',
      },
      {
        title: 'The bracket is on a whiteboard.',
        body: 'Coaches crowd the table after every game to see who they play next.',
      },
      {
        title: 'Next year, you start from scratch.',
        body: "The spreadsheet is gone. The schedule is in someone's email. The bracket is a photo on a phone.",
      },
    ],
    stepsHeadline: 'Four phases. One platform.',
    steps: [
      {
        num: '01',
        label: 'Registration',
        title: 'Teams register online.',
        body: 'Your tournament page collects team details, contact info, and payment deposits. You review applications, approve teams, and manage the waitlist — no inbox required.',
      },
      {
        num: '02',
        label: 'Scheduling',
        title: 'Games fill themselves in.',
        body: 'Set your fields and time slots. The schedule generator fills games, minimizes conflicts, and balances rest. Publish in one click.',
      },
      {
        num: '03',
        label: 'Bracket',
        title: 'No re-drawing after every round.',
        body: 'Single or double elimination — seeding, bye assignment, and bracket advancement are handled automatically.',
      },
      {
        num: '04',
        label: 'Live results',
        title: 'Everyone sees scores in real time.',
        body: 'Enter scores from the sideline. Brackets advance immediately. Coaches and parents see standings the moment you save them — from anywhere.',
      },
    ],
    featuresLabel: 'Everything in Tournament, plus',
    features: [
      'Unlimited active tournaments',
      'Automated schedule generation and playoff bracket builder',
      'Custom registration fields, file uploads, and waitlist promotion',
      'Registration exports — Excel, CSV, and PDF',
      'Advanced payment tracking and post-tournament reporting',
      'Full branding control — no FieldLogicHQ badge',
      'Permanent sealed archives and tournament cloning',
      'Unlimited staff seats · Unlimited officials',
    ],
  },

  league: {
    billingQuestion: 'Does your organization run a year-round league, or need a public-facing presence?',
    billingSub:
      'League Plus adds player registration, house league season management, a public org page, and automated parent notifications.',
    eyebrow: 'League Plus',
    panelHeadline: 'One dashboard. The full season arc.',
    painHeadline: 'If this is your season setup, we know the drill.',
    painItems: [
      {
        title: 'Registration is a Google Form.',
        body: "You're emailing confirmations manually, cross-referencing a spreadsheet, and trying to remember who has and hasn't paid.",
      },
      {
        title: 'The draft takes all night.',
        body: 'Someone reads names off a printed list while coaches debate balance. You still end up adjusting teams by text message for a week.',
      },
      {
        title: 'Standings update when you remember to.',
        body: "It's Tuesday. Two games happened Saturday. Three parents have already emailed asking why the standings haven't moved.",
      },
      {
        title: 'The schedule conflict shows up on game day.',
        body: 'Two teams, one field, no one noticed until someone called you at 8am on a Saturday.',
      },
    ],
    stepsHeadline: 'Registration to final standings — four steps.',
    steps: [
      {
        num: '01',
        label: 'Registration',
        title: 'Players register online.',
        body: 'Your season page collects player info, contact details, and any division-specific questions. You review applications, accept players, and manage the waitlist — no Google Form, no inbox.',
      },
      {
        num: '02',
        label: 'Draft',
        title: 'Build balanced teams before the first game.',
        body: 'Assign players to divisions and teams from your registered pool. The draft happens in the dashboard — no printed lists, no floor-level sorting.',
      },
      {
        num: '03',
        label: 'Schedule and standings',
        title: 'Games generate. Standings update automatically.',
        body: 'Auto-generate game schedules across your fields and time slots. Standings update the moment scores are entered — parents see results in real time.',
      },
      {
        num: '04',
        label: 'Notifications',
        title: "Parents are informed. You don't send a thing.",
        body: 'Schedule changes, postponements, and standings updates go out automatically. No reply-all, no personal inbox, no Saturday morning phone calls.',
      },
    ],
    featuresLabel: 'Included',
    features: [
      'Player registration per season — with waitlist management',
      'Season and division setup',
      'Draft tools and team building',
      'Auto-generated schedules across fields and time slots',
      'Live standings — update automatically as scores are entered',
      'Automated parent notifications (schedule changes, postponements)',
      'Public organization page',
      'League-scoped communications',
      'Advanced member roles — registrar, program coordinator',
      'Registration and standings exports (Excel, CSV)',
      'Unlimited tournaments included',
      'Unlimited staff seats · Unlimited officials',
    ],
  },

  club: {
    billingQuestion: 'Coordinating rep teams or managing org finances outside the platform?',
    billingSub:
      'Club adds full accounting and rep team management — the two tools that take the most time from any volunteer organization.',
    eyebrow: 'Club',
    panelHeadline: 'Coaches run their team. You run the org.',
    painHeadline: 'If this is how your club operates, we know the drill.',
    painItems: [
      {
        title: 'Your coaching staff runs on WhatsApp.',
        body: "Rosters live in personal phones. Lineups are in notes apps. You find out about tryout results when a coach mentions it at an AGM.",
      },
      {
        title: "You can't see the team finances without asking.",
        body: 'Coaches track dues on their own. The treasurer asks every spring. Nobody is ever quite sure where the money went.',
      },
      {
        title: 'Tryouts run on email chains.',
        body: 'Registration comes in through personal inboxes. Coaches pick teams independently. There is no central record of who tried out or who was cut.',
      },
      {
        title: 'When a coach leaves, knowledge walks with them.',
        body: "The contact list is in a personal Google Drive. The roster is someone's spreadsheet. The new coach inherits nothing.",
      },
    ],
    stepsHeadline: 'Four modules. One platform.',
    steps: [
      {
        num: '01',
        label: 'Tournaments',
        title: 'Run events year-round.',
        body: 'Registration, scheduling, brackets, and live scores — same tools your tournament organizers already use. Unlimited tournaments included.',
      },
      {
        num: '02',
        label: 'House League',
        title: 'Full season management — included.',
        body: 'Player registration, draft, schedules, standings, and parent notifications. Club includes the full house league module — no separate plan required.',
      },
      {
        num: '03',
        label: 'Rep Teams and Coaches Portal',
        title: 'Coaches run their team. You run the org.',
        body: 'Coaches get a dedicated portal to manage roster, lineups, documents, and team finances independently. You get org-wide visibility without owning the day-to-day.',
      },
      {
        num: '04',
        label: 'Accounting',
        title: 'Finances in one place — not three spreadsheets.',
        body: 'Org ledger, team invoicing, expense tracking, payment reconciliation, and board-ready PDF exports. The treasurer stops living in spreadsheets.',
      },
    ],
    featuresLabel: 'Included',
    features: [
      'Everything in League (tournaments, house league, public org page)',
      'Unlimited staff / admin seats',
      'Accounting module — org ledger and expense tracking',
      'Team invoicing and payment reconciliation',
      'Rep Teams module — tryout registration and roster management',
      'Player documents and season history',
      'Team financial management',
      'Coaches Portal — 3 team accounts included',
      'Additional Coaches Portal accounts at $19/month each',
    ],
  },
};
