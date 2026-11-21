import type { ReactNode } from 'react';
import kit from '@/components/marketing/MarketingKit.module.css';
import faq from '@/components/marketing/Faq.module.css';
import { resolveLegalLinks } from '@/lib/legal-links';
import { FIELDLOGICHQ_CONTACT_EMAIL } from '@/lib/fieldlogichq-contact';

/**
 * "QUESTIONS A BOARD ASKS" (on-sale pages S3b, W70; words in PRICING_PAGE_COPY.md's S3b section and CLUB_ON_SALE_COPY.md W70).
 * One home for the answers: /for-clubs and /for-leagues show all five (plus a year's cost while the plan is open), and the
 * /pricing FAQ shows the first four under its own small heading.
 *
 * ⚖ /legal (S3b Part 1, 2026-11-20): answer 3 links to the Privacy Policy, so NOTHING here renders unless the legal pages are
 * published — `boardQuestions()` returns null while `resolveLegalLinks()` does, and the section never points at a "not found"
 * page. Answer 4's "or ask us for a full copy" is a promise written only in the data terms, so the clause joins only once the
 * data terms page is live (`dataTermsHref`). Never "export everything".
 */
export interface BoardQuestion { q: string; a: ReactNode }

export function boardQuestions({ club }: { club: boolean }): BoardQuestion[] | null {
  const legal = resolveLegalLinks();
  if (!legal) return null;
  return [
    {
      q: 'Can we switch in the middle of a season?',
      a: `The easiest time is your next registration: families register on your new page, so there is no list to move. A tournament can start any day.${club ? ' Coaches can paste or upload a roster.' : ''} There is no import for a house league season that is already under way.`,
    },
    {
      q: 'What happens when our treasurer or registrar changes?',
      a: `Invite the new person, give them the role and remove the old one. Everything stays with the club: the books, the families and last season's setup, which next season can start from. To change the club's owner, email ${FIELDLOGICHQ_CONTACT_EMAIL} from the current owner's address.`,
    },
    {
      q: "What do you do with our families' information?",
      a: (
        <>
          We never sell your club&apos;s information or use it to advertise. FieldLogicHQ never shows a player&apos;s name,
          birth date or roster on a public page. Your club&apos;s information is stored in the United States (Ohio), with our
          database host, Supabase, on Amazon Web Services.{' '}
          <a href={legal.privacyHref} className={`${kit.link} ${faq.answerLink}`}>Read the Privacy Policy</a>
        </>
      ),
    },
    {
      q: 'What if we decide to stop?',
      // `/legal` 2026-11-20: "if you cancel" — the Terms refund the unused part when WE end a plan.
      a: `Cancel any time in Plan & billing; an owner of the club does it. Your plan runs to the end of the period you have paid for, and if you cancel, we don't refund the unused part. We keep your information for 90 days after a plan ends, so you can come back. You can download your lists as Excel, CSV or PDF${legal.dataTermsHref ? ', or ask us for a full copy' : ''}.`,
    },
    {
      q: 'Do our volunteers need training?',
      a: `No. It runs in a browser and can be added to a phone's home screen, with no app store. Help articles are built into the admin, and you can write to ${FIELDLOGICHQ_CONTACT_EMAIL}.`,
    },
  ];
}

/** The questions as the shipped FAQ card (the /pricing accordion): native details/summary, one card, rows divided. */
export function FaqList({ items }: { items: ReadonlyArray<BoardQuestion & { tag?: string }> }) {
  return (
    <div className={faq.list}>
      {items.map(item => (
        <details key={item.q} className={`${faq.item} ${item.tag ? faq.featured : ''}`}>
          <summary className={faq.question}>
            {item.tag && <span className={`${kit.tag} ${faq.tag}`}>{item.tag}</span>}
            {item.q}
          </summary>
          <p className={`${kit.small} ${faq.answer}`}>{item.a}</p>
        </details>
      ))}
    </div>
  );
}

/**
 * The section on /for-clubs and /for-leagues (drawing tabs 4 and 5: after "How the trial works", before the cross-sell).
 * `cost` is answer 6, passed only while the plan is open (a closed price carries no tax line, and no closed page says
 * "trial" or a price). Renders nothing while the legal pages are off.
 */
export function BoardQuestionsSection({ club, cost }: { club: boolean; cost: string | null }) {
  const items = boardQuestions({ club });
  if (!items) return null;
  return (
    <section className={kit.section}>
      <div className="container">
        <p className={kit.eyebrow}>Before you decide</p>
        <h2 className={kit.heading}>Questions a board asks</h2>
        <FaqList items={cost ? [...items, { q: 'What does a year cost?', a: cost }] : items} />
      </div>
    </section>
  );
}
