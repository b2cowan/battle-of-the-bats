import { PLAN_CONFIG } from './plan-config';
import { dayAfterWords, formatLongDay } from './free-time';
import { portalEndingReminderDue } from './portal-free-time';
import { joinWithAnd, pluralize, possessive } from './utils';
import type { OrgPlan } from './types';

/**
 * THE CLUB'S FREE-TIME ENDING EMAIL (Free time, the same rules for clubs and coaches; owner rulings 2026-11-19, ask A and
 * the build go of 2026-11-20: all three kinds). A club whose free time has an end date is emailed 14 days and 3 days before
 * its last free day, as a coach is (`portalEndingEmailWords`). Pure: the words and the "which one is due" rule, no database.
 *
 * The billing page's own words (`lib/free-time-copy.ts`): "runs through" the LAST free day, what happens the day after,
 * that nothing is deleted. Never a price, never a threat of loss, never "cancel".
 */

/** The 14-day one inside 14 days, the 3-day one inside 3, never both, once per end: the coach's rule, unchanged. */
export const clubEndingReminderDue = portalEndingReminderDue;

export type ClubEndingEmailInput =
  | {
    kind: 'plan_tier';
    clubName: string;
    /** The plan given. */
    plan: OrgPlan;
    /** The club's own plan, what it goes back to. */
    ownPlan: OrgPlan;
    lastDay: string;
    daysLeft: number;
    /** The given plan is open for sign-up (the billing page's live gate). */
    givenOnSale: boolean;
    /** The club will hold more tournaments than its own plan allows when free time ends. */
    overLimitAfter: boolean;
  }
  | { kind: 'module_addon'; clubName: string; sections: string[]; lastDay: string; daysLeft: number }
  | {
    kind: 'subscription_status';
    clubName: string;
    lastDay: string;
    daysLeft: number;
    /** It reopened a club whose plan had ENDED, which still has not paid: the end closes it again (owner ruling 2026-11-18). */
    reopenedEndedClub: boolean;
  };

export type ClubEndingEmailWords = { subject: string; lead: string; body: string; button: string };

const label = (plan: OrgPlan) => PLAN_CONFIG[plan]?.label ?? plan;

const leftWords = (daysLeft: number) => (daysLeft <= 0 ? 'ends today' : `has ${pluralize(daysLeft, 'day')} left`);

export function clubEndingEmailWords(input: ClubEndingEmailInput): ClubEndingEmailWords {
  const left = leftWords(input.daysLeft);
  const through = formatLongDay(input.lastDay);
  const after = dayAfterWords(input.lastDay);
  const club = input.clubName;

  if (input.kind === 'plan_tier') {
    const given = label(input.plan);
    const own = input.ownPlan;
    const backTo = own === 'tournament' ? 'the free Tournament plan' : label(own);
    const nothingCharged = own === 'tournament'
      ? 'Nothing is charged, and nothing you made is deleted.'
      : 'Nothing is charged for this, and nothing you made is deleted.';
    const keep = input.givenOnSale
      ? `To keep ${given}, contact us.`
      : `${given} isn't open for sign-up yet, so there is nothing to choose.`;
    const over = input.overLimitAfter
      ? ` Your tournaments are kept; you can start a new one once you're back within ${own === 'tournament' ? 'the free plan' : label(own)}.`
      : '';
    return {
      subject: `Your free time on ${given} ${left}`,
      lead: `${possessive(club)} free time on ${given} ${left}. It runs through ${through}.`,
      body: `On ${after} ${club} goes back to ${backTo} automatically. ${nothingCharged} The tools that come only with ${given} close then. ${keep}${over}`,
      button: 'Open Plan & billing',
    };
  }

  if (input.kind === 'module_addon') {
    const names = joinWithAnd(input.sections);
    const one = input.sections.length === 1;
    return {
      subject: `Your free time on ${names} ${left}`,
      lead: `${possessive(club)} free time on ${names} ${left}. It runs through ${through}.`,
      body: `On ${after} ${names} ${one ? 'turns' : 'turn'} off automatically. Nothing is charged, and nothing you made in ${one ? 'it' : 'them'} is deleted. To keep ${one ? 'it' : 'them'}, contact us.`,
      button: 'Open Plan & billing',
    };
  }

  const lead = `The free time FieldLogicHQ gave ${club} ${left}. It runs through ${through}.`;
  if (input.reopenedEndedClub) {
    return {
      subject: `Your free time on FieldLogicHQ ${left}`,
      lead,
      body: `On ${after}, if ${club} hasn't chosen a plan, it closes again. Its information is kept for 90 days from that day, and you'll get an email with the date. Nothing is charged.`,
      button: 'Open Plan & billing', // /legal 2026-11-20: one neutral pointer on every shape, never a sales door
    };
  }
  return {
    subject: `Your free time on FieldLogicHQ ${left}`,
    lead,
    body: `On ${after} ${possessive(club)} billing goes back to how it was before the free time. Nothing is charged for the free time.`,
    button: 'Open Plan & billing',
  };
}
