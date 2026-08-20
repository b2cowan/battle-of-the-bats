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
        // ⚠ "and season history" removed 2026-08-20. The roster has NO cross-season memory —
        // every count on a player's page is "this season". The only season history that exists is
        // the closed-season page, which holds ONE season, strips contact info by design, and
        // becomes unreachable once a second season closes.
        body: 'Build and manage your roster with positions, jersey numbers, and contact info. Everything lives here — accessible from anywhere.',
      },
      {
        num: '02',
        label: 'Schedule and lineups',
        title: 'Build lineups. Track attendance. Export to PDF.',
        // "one click" was two — the print control opens a menu and the coach picks a format.
        // Naming the two artifacts is both true and a better sentence.
        body: 'Enter your game schedule, track who showed up, and build lineups with full lineup history by game. Export a dugout poster or a batting-order card to PDF.',
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
        // ⚠ This step used to promise "you see what is outstanding at a glance" and a title about
        // missing paperwork being visible early. The product has NO notion of a REQUIRED document
        // — waivers and consents are stored against a player and can be opened by staff with the
        // documents permission, but nothing knows what a player is supposed to have, so nothing
        // can report what is missing. The claim was found and corrected 2026-08-20. If a required-
        // documents checklist is ever built, this is the copy that gets to make that promise back.
        title: 'The waiver is on the player, not in a thread.',
        body: 'Upload waivers, medical consent and code-of-conduct forms to the player they belong to. No hunting back through email at the hotel — and only the staff you’ve given access can open them.',
      },
    ],
    featuresLabel: 'Included',
    features: [
      'Full roster management — positions, jersey numbers, and contact info',
      'Game schedule, attendance tracking, and lineup builder with PDF export',
      'Team budget, player dues, expense tracking, and payment reminders',
      // ⚠ "year-over-year history" removed 2026-08-20 — it promised the exact thing the product
      // deliberately REFUSES to do. Owner ruling 2026-07-09: youth seasons aren't comparable
      // across years, so there are no season-over-season deltas and no season dial, on purpose.
      'Documents, season setup checklist, and a season-end record',
      // ⚠ "run round robins…" removed 2026-08-20 — a coach ENTERS tournaments here, never hosts
      // one. There is no create-a-tournament action anywhere in the coach navigation. That
      // wording was copy-pasted from the Tournament product's cross-sell card on this same page.
      'Tournaments included — register your team, track entries, and pull results into your season record',
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
        // ⚠⚠ "and payment deposits" removed 2026-08-20 — THE PLATFORM NEVER TOUCHES THE MONEY.
        // The registration form tells registrants outright that payments go directly to the
        // organizer, outside the platform; the organizer then records what arrived by hand.
        // Online entry-fee collection exists only as a named intention with nothing behind it.
        // ⚠ This same object is the in-app "Upgrade to Tournament Plus" panel, so the claim was
        // being made to paying customers too. When collection ships, this sentence may come back.
        body: 'Your tournament page collects team details and contact info, and shows every team their fee and due date. You review applications, approve teams, record what has been paid, and manage the waitlist — no inbox required.',
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
        // ⚠ Byes and bracket advancement are NOT Tournament Plus features — the free tier gets
        // both, from the same bracket engine. Only seeding from live standings is paid. Listing
        // all three under "Everything in Tournament, plus" sold an upgrade for what a customer
        // already had; saying so plainly is also the better line. (Corrected 2026-08-20.)
        body: 'Single or double elimination. Seeds pull from live standings the moment pool play ends — and byes and bracket advancement are automatic on every plan, paid or not.',
      },
      {
        num: '04',
        label: 'Live results',
        // ⚠ "real time" / "the moment you save them" softened 2026-08-20. The public pages poll
        // every 30 seconds, only while the event is inside its own date range, and they pause on a
        // backgrounded tab. "No refresh needed" is true; "the moment" was not.
        title: 'Everyone sees scores without asking you.',
        body: 'Enter scores from the sideline. Brackets advance immediately. Coaches and parents watch standings update on their own — no refresh, no phone call, from anywhere.',
      },
    ],
    featuresLabel: 'Everything in Tournament, plus',
    features: [
      'Unlimited active tournaments',
      'Automated schedule generation and playoff bracket builder',
      'Custom registration fields, file uploads, and waitlist promotion',
      'Registration exports — Excel, CSV, and PDF',
      'Advanced payment tracking and post-tournament reporting',
      // ⚠ "no FieldLogicHQ badge" corrected 2026-08-20 — paid pages still carry a permanent,
      // non-dismissible "Built on FieldLogicHQ" footer credit. What paying actually removes is
      // the free tier's dismissible pill AND its acquisition banner. Still a real difference;
      // just not the absence of all branding, which is what a customer would expect.
      'Full branding control — no acquisition banner, just a quiet “Built on FieldLogicHQ” footer credit',
      'Permanent sealed archives and tournament cloning',
      // ⚠ "Unlimited officials" moved OUT of the paid list 2026-08-20 — officials have never
      // counted against a seat cap on ANY plan, so it was never something upgrading granted.
      // It belongs on the free tier's list, where it is a genuine surprise.
      'Unlimited staff seats',
    ],
  },

  league: {
    billingQuestion: 'Does your organization run a year-round league, or need a public-facing presence?',
    billingSub:
      'League Plus adds player registration, house league season management, a public org page, and season-wide parent messaging.',
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
        // ⚠ "any division-specific questions" removed 2026-08-20 — the house-league registration
        // form is one fixed set of fields for every division. Custom questions are a TOURNAMENT
        // feature; that clause was borrowed from the wrong product.
        body: 'Your season page collects player info and contact details. You review applications, accept players, and manage the waitlist — no Google Form, no inbox.',
      },
      {
        num: '02',
        label: 'Draft',
        // ⚠ "balanced" removed 2026-08-20. Nothing computes balance — a league registration has
        // no skill or rating field at all — and the draft gives the same team first pick every
        // round rather than alternating, which works against balance rather than for it.
        title: 'Draft your teams before the first game.',
        body: 'Assign players to divisions and teams from your registered pool — by pick order or a random draw. The draft happens in the dashboard — no printed lists, no floor-level sorting.',
      },
      {
        num: '03',
        label: 'Schedule and standings',
        title: 'Games generate. Standings update automatically.',
        // ⚠ "across your fields and time slots" removed 2026-08-20 — the house-league generator
        // takes ONE date, ONE game time and ONE venue and applies them to the whole batch. The
        // multi-field, conflict-minimizing generator belongs to the tournament product, which
        // this never calls. (Standings genuinely do recompute live on every read — that half of
        // the sentence is accurate and stays.)
        body: 'Auto-generate a round-robin schedule, then adjust any game individually. Standings update the moment scores are entered — parents see results without asking.',
      },
      {
        num: '04',
        label: 'Notifications',
        // ⚠⚠ WAS FALSE, ON SIX SURFACES. "Parents are informed. You don't send a thing" —
        // rescheduling, postponing or scoring a league game sends NOTHING. The automatic
        // "your game moved" pipeline is wired to the tournament data model and structurally
        // cannot fire for a league game. The only tool is a manual compose-and-send screen —
        // which is the reply-all workflow the sentence claimed to abolish. Corrected 2026-08-20
        // here, in the feature bullet, in billingSub (the in-app billing panel), and in the
        // page's hero, plan-card tagline and search description.
        title: 'Tell every parent in one message.',
        body: 'Send a season-wide update — a schedule change, a postponement, a standings recap — to every registered family from one screen. No reply-all, no personal inbox, no copy-pasted address list.',
      },
    ],
    featuresLabel: 'Included',
    features: [
      'Player registration per season — with waitlist management',
      'Season and division setup',
      'Draft tools and team building',
      'Auto-generated round-robin schedules, editable game by game',
      'Live standings — update automatically as scores are entered',
      'Season-wide parent messaging — one screen, every registered family',
      'Public organization page',
      'League-scoped communications',
      // ⚠ "program coordinator" removed 2026-08-20 — no such role exists. The only occurrence of
      // the word anywhere in this codebase was this marketing string.
      'Advanced member roles — league admin, registrar',
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
      // Added 2026-08-20 — a real, Club-ONLY capability that the page had never mentioned.
      // Deliberately absent from every other plan (a single-team customer has no siblings to
      // share with), which makes it one of the few things only this tier can offer.
      'Club Shared Book — your teams share opponent scouting notes across the club',
      'Premium Coaches Portal for your whole coaching staff — every team included, no per-team fee',
      'Up to 15 teams — or up to 30 on Club · Association',
    ],
  },
};
