'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, X } from 'lucide-react';
import type { CoachCapabilities } from '@/lib/coach-capabilities';
import { isCoachNavItemVisible } from '@/lib/coach-nav-visibility';
import { useOverlayOpen } from '@/lib/coaches-overlay';
import { useDismissable } from './overlay-hooks';
import styles from './CoachPortalTour.module.css';

/**
 * The one-time, OFFERED portal tour (Coach Onboarding Quiet Mode, Phase C1).
 *
 * A side DRAWER, never a centre modal: the tour's whole job is to describe the sidebar, and a
 * centre modal would cover the thing it is pointing at — re-committing the exact interruption this
 * project exists to remove. For the same reason it is deliberately NON-modal: no dimming backdrop,
 * no focus trap, no `aria-modal`. Focus moves into the panel on open and Escape / outside-click
 * dismiss it (shared `useDismissable`), but the coach can still see and reach the sidebar behind it.
 *
 * Cards are capability-filtered and the progress dots count the FILTERED set, so a coach with no
 * money access sees three dots and never a phantom step for a section they can't open.
 *
 * The card copy is the same copy Phase B put on each section's empty state — written once,
 * surfaced twice, so the tour and the sections it describes cannot drift apart.
 */

type TourCard = {
  key: string;
  /** The sidebar group this card highlights, shown as the eyebrow. */
  group: string;
  headline: string;
  body: string;
  /** Deep link into the group's landing page, appended to the team base path. */
  href: string;
  linkLabel: string;
  /** Nav labels (per `coach-nav-visibility`) — the card renders only if ANY is visible. */
  needsAnyOf: string[];
};

const CARDS: TourCard[] = [
  {
    key: 'squad',
    group: 'Squad',
    headline: 'Your players live here',
    body: 'Roster, lineups and player development sit together. Almost everything else in the portal reads from your roster — lineups, attendance, dues, who your announcements reach — which is why it’s the one thing worth doing first.',
    href: '/roster',
    linkLabel: 'Open Roster',
    needsAnyOf: ['Roster', 'Lineups', 'Development'],
  },
  {
    key: 'season',
    group: 'Season',
    headline: 'Your season, as it happens',
    body: 'Your schedule is the spine: lineups attach to these games, attendance is taken from them, and Insights reads them back to you as record, playing time and attendance — you never type a number into Insights yourself.',
    href: '/schedule',
    linkLabel: 'Open Schedule',
    needsAnyOf: ['Schedule', 'Insights'],
  },
  {
    key: 'money',
    group: 'Money',
    headline: 'Dues without a spreadsheet',
    body: 'Plan the season’s costs, turn them into player dues in one click, then track what’s come in. Dues you set here drive the reminders families get, and they’re prefilled when you accept a player from tryouts.',
    href: '/accounting',
    linkLabel: 'Open Money',
    needsAnyOf: ['Money'],
  },
  {
    key: 'communication',
    group: 'Communication',
    headline: 'Reaching families and organizers',
    body: 'Announcements send one email to every family at once, using the guardian emails already on your roster. Chat is your direct line to a tournament organizer while an event is running.',
    href: '/announcements',
    linkLabel: 'Open Announcements',
    needsAnyOf: ['Announcements', 'Chat'],
  },
];

export default function CoachPortalTour({
  open,
  basePath,
  capabilities,
  onClose,
  onFinish,
}: {
  open: boolean;
  /** `/{orgSlug}/coaches/teams/{teamId}` — cards deep-link off this. */
  basePath: string;
  capabilities: CoachCapabilities | undefined;
  /** Dismiss without recording a decision (Escape / outside click / ✕). */
  onClose: () => void;
  /** "Skip tour" or reaching the end — records the permanent, account-level decision. */
  onFinish: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  // Four static entries — filtering them is cheaper than a memo's own bookkeeping, and nothing
  // downstream depends on referential stability.
  const cards = CARDS.filter(c => c.needsAnyOf.some(label => isCoachNavItemVisible(capabilities, label)));

  useDismissable(open, panelRef, onClose);
  // Register with the portal's shared overlay signal, exactly as every other coach sheet/modal
  // does. Without it the fixed bottom nav (z-index 300) renders ON TOP of this drawer's footer on
  // a phone — covering Skip / Back / Next / Done, the coach's only way forward or out — and the
  // page behind would still scroll. Non-modal about FOCUS is deliberate; non-modal about the nav
  // bar is not.
  useOverlayOpen(open);

  // Reopening starts at the beginning, and focus moves into the panel so a keyboard user isn't
  // left behind on the trigger. No focus TRAP — non-modal by design (see the header comment).
  useEffect(() => {
    if (!open) return;
    setIndex(0);
    panelRef.current?.focus();
  }, [open]);

  if (!open) return null;
  // A coach whose capabilities filter every card away gets no tour rather than an empty shell.
  if (cards.length === 0) return null;

  const card = cards[Math.min(index, cards.length - 1)];
  const isLast = index >= cards.length - 1;

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      role="dialog"
      aria-label="Portal tour"
      className={styles.drawer}
    >
      <div className={styles.head}>
        <p className={styles.kicker}>Portal tour</p>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close the tour">
          <X size={16} aria-hidden />
        </button>
      </div>

      <div className={styles.dots} role="presentation">
        {cards.map((c, i) => (
          <span key={c.key} className={styles.dot} data-state={i === index ? 'current' : i < index ? 'done' : 'todo'} />
        ))}
      </div>
      {/* The dots are decorative; this is what a screen reader gets instead. */}
      <p className={styles.srStep}>Step {index + 1} of {cards.length}</p>

      <div className={styles.body}>
        <p className={styles.group}>{card.group}</p>
        <h2 className={styles.headline}>{card.headline}</h2>
        <p className={styles.text}>{card.body}</p>
        {/* Following a card's link CLOSES the tour but does NOT retire the offer. Going to look at
            the thing a card describes is engagement, not completion — killing the tour here would
            mean a coach who tapped "Open Roster" on card 1 never learns cards 2-4 exist. Only
            Skip and Done are decisions. */}
        <Link href={`${basePath}${card.href}`} className={styles.deepLink} onClick={onClose}>
          {card.linkLabel} <ArrowRight size={14} aria-hidden />
        </Link>
      </div>

      <div className={styles.foot}>
        {/* Skip is ALWAYS available, on every card — the whole point is a real exit. */}
        <button type="button" className={styles.skip} onClick={onFinish}>Skip tour</button>
        <div className={styles.footRight}>
          {index > 0 && (
            <button type="button" className="btn btn-ghost" onClick={() => setIndex(i => i - 1)}>Back</button>
          )}
          {isLast ? (
            <button type="button" className="btn btn-lime" onClick={onFinish}>Done</button>
          ) : (
            <button type="button" className="btn btn-lime" onClick={() => setIndex(i => i + 1)}>
              Next <ArrowRight size={14} aria-hidden />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
