export interface SampleSection {
  title: string;
  icon: string;
  items: string[];
}

export interface SampleResource {
  label: string;
  url: string; // empty string = placeholder; user must fill in before publishing
}

export const SAMPLE_RULE_SECTIONS: SampleSection[] = [
  {
    title: 'General Rules',
    icon: 'Shield',
    items: [
      'All participants must comply with the rules of the game as defined by the governing body.',
      'Teams are responsible for the behaviour of their players, coaches, and spectators.',
      "The tournament director's decisions are final.",
    ],
  },
  {
    title: 'Game Play',
    icon: 'CheckCircle',
    items: [
      'Games will start at the scheduled time. Teams must be ready 10 minutes before game time.',
      'A minimum of [X] players constitutes a legal lineup. Fewer players results in a forfeit.',
      'Mercy rule: a game is called when a team leads by [X] runs after [X] innings.',
    ],
  },
  {
    title: 'Tie-Breaker Procedures',
    icon: 'AlertCircle',
    items: [
      'In the event of a tie in the standings, the following criteria apply in order: (1) head-to-head record, (2) run differential (capped at +/- [X] per game), (3) coin toss.',
    ],
  },
  {
    title: 'Code of Conduct',
    icon: 'BookOpen',
    items: [
      'Unsportsmanlike conduct — including arguing with officials, excessive appealing, or disrespectful language — will result in a warning, then ejection.',
      'Ejected players must leave the playing area immediately and are suspended for the next scheduled game.',
    ],
  },
];

export const SAMPLE_RESOURCES: SampleResource[] = [
  { label: 'Tournament Schedule (PDF)', url: '' },
  { label: 'Official Rulebook', url: '' },
  { label: 'Team Contact Sheet', url: '' },
];
