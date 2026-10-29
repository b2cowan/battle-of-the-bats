import { PLAN_CONFIG } from './plan-config';
import { dayAfterWords, formatLongDay, type CustomerFreeTime } from './free-time';
import type { OrgPlan } from './types';

/**
 * What the customer reads about their free time on Plan & billing (Support console Stage 4, owner ruling Q8; drawings D1–D3;
 * copy through /billing and /marketing at the build gate, 2026-10-25). One builder for both billing pages (the tournament
 * page and Club's), so the phrase is "Free through {last free day}" everywhere and the three states read alike.
 *
 * Never a price or a plan's limits. Never the reason or who gave it. "The tools that come only with {plan}", never a
 * possessive of a plan name (one ends in s).
 */

export type FreeTimeCopyInput = {
  freeTime: CustomerFreeTime;
  /** The Founding Season's last free day ("September 30, 2027") when the club's own plan is a running Founding comp. */
  foundingThrough: string | null;
  /** Whether the given plan is open for sign-up (the live gate): only then does the page offer to keep it. */
  givenOnSale: boolean;
  /** The club will hold more tournaments than its own plan allows when free time ends. */
  overLimitAfter: boolean;
};

export type FreeTimeCopy = {
  /** The plan card's price line, and the small line under it. Null when ended (the card is the plan's own). */
  card: { price: string; from: string } | null;
  band: { tone: 'olive' | 'amber' | 'plain'; eyebrow: string; title: string; text: string; phoneText?: string };
  /** The tournament page's Billing card while free time runs; null to keep its own words. */
  billingCard: string | null;
};

const label = (plan: OrgPlan) => PLAN_CONFIG[plan]?.label ?? plan;

export function freeTimeCopy(input: FreeTimeCopyInput): FreeTimeCopy {
  const ft = input.freeTime;
  const given = label(ft.plan);
  const own = ft.ownPlan;
  const through = formatLongDay(ft.lastDay);
  const backTo = own === 'tournament' ? 'the free Tournament plan' : label(own);
  // Founding Season still runs after a shorter grant: say so; past its end, it would promise a free period that has ended.
  const founding = input.foundingThrough && own !== 'tournament' ? `, still free through ${input.foundingThrough} as a founding organization` : '';
  const nothingCharged = own === 'tournament' || founding
    ? 'Nothing is charged, and nothing you made is deleted.'
    : 'Nothing is charged for this, and nothing you made is deleted.';
  const teamsKept = ft.plan === 'club' || ft.plan === 'club_large' ? ', including teams you added' : '';

  if (ft.state === 'ended') {
    const where = own === 'tournament' ? "You're on the free Tournament plan again." : `You're back on ${label(own)}${founding}.`;
    const closed = input.givenOnSale
      ? `The tools that come only with ${given} are closed until you choose it.`
      : `The tools that come only with ${given} are closed. ${given} isn't open for sign-up yet.`;
    return {
      card: null,
      band: { tone: 'plain', eyebrow: 'Free time ended', title: `Your free time on ${given} ran through ${through}.`, text: `${where} Everything you made is kept${teamsKept}. ${closed}` },
      billingCard: null,
    };
  }

  const card = { price: `Free through ${through}`, from: `from FieldLogicHQ · then ${own === 'tournament' ? 'the free Tournament plan' : `${label(own)} again`}, automatically` };
  const goesBack = `On ${dayAfterWords(ft.lastDay)} it goes back to ${backTo} automatically${founding}.`;

  if (ft.state === 'running') {
    return {
      card,
      band: {
        tone: 'olive',
        eyebrow: 'Free time',
        title: `${given} is free through ${through}.`,
        text: `FieldLogicHQ gave your organization ${given} for a while. ${goesBack} ${nothingCharged}`,
        phoneText: `${goesBack} Nothing is charged or deleted.`,
      },
      billingCard: `No billing action needed: your free time runs through ${through}.`,
    };
  }

  // The last 14 days.
  const left = ft.daysLeft;
  const eyebrow = left === 0 ? 'Free time · last day' : `Free time · ${left} day${left === 1 ? '' : 's'} left`;
  const keep = input.givenOnSale
    ? `To keep ${given}, contact us.`
    : `${given} isn't open for sign-up yet, so there is nothing to choose on this page.`;
  const over = input.overLimitAfter
    ? ` Your tournaments are kept; you can start a new one once you're back within ${own === 'tournament' ? 'the free plan' : label(own)}.`
    : '';
  return {
    card,
    band: {
      tone: 'amber',
      eyebrow,
      title: left === 0 ? 'Your free time ends today.' : `Your free time runs through ${through}.`,
      text: `On ${dayAfterWords(ft.lastDay)} you go back to ${backTo} automatically${founding}. ${keep}${over}`,
    },
    billingCard: input.givenOnSale
      ? `Your free time runs through ${through}. To keep ${given}, contact us. Otherwise there is nothing to do.`
      : `Your free time runs through ${through}. There is nothing to do: on ${dayAfterWords(ft.lastDay)} you go back to ${backTo}.`,
  };
}
