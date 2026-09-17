import Link from 'next/link';
import clsx from 'clsx';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import kit from './CoachKit.module.css';

/**
 * THE COACH CARD — the dashboard card, in two roles (plan §4, decisions A + B, 2026-09-16).
 *
 *   report (default) — flat; it REPORTS. Its doors are in its foot band (`kit.foot` +
 *                      `kit.footLink`), never on the card (the 2026-08-11 "reports, doesn't shout"
 *                      ruling). Money's three story cards, Skills & Goals' three, the two rails.
 *   door             — the WHOLE card is a link (`CoachDoorCard`). Lifted, a hover step, and an
 *                      arrow in its eyebrow (`<CoachEyebrow arrow>`). The team Overview's six
 *                      "at a glance" tiles.
 *
 * `alert` puts the 3px danger edge on (Money's overdue rule; S&G's "something due"). `accent` puts
 * on an edge whose COLOUR the screen sets as `--card-accent` on its own class (the One Thing card's
 * kind, the getting-started card's blue) — the kit paints the skin, the screen paints the meaning,
 * and a custom property makes the two modules' cascade order irrelevant. A caller never composes a
 * kit class from its own stylesheet.
 *
 * Why one skin: three cards sat on consecutive screens — white · olive 15% · 8px · flat (Money),
 * `--white-8` · olive 30% · 12px · shadow (the Overview family), white · hairline · 8px (every table
 * frame). In warm the grounds coincide; in DARK `--white-8` is a translucent wash while the others
 * are the opaque card — three greys. `--card-bg` + `--home-line` + 8 is the table frame's, so a card
 * and a table on one page share an edge.
 */
type Common = {
  /** The danger edge: something on this card is overdue or due. */
  alert?: boolean;
  /** The accent edge, coloured by `--card-accent` on the caller's own class. */
  accent?: boolean;
  /** A screen-only class — layout, an accent edge, a `data-*` hook. Never a re-skin. */
  className?: string;
  children: ReactNode;
};
type DivProps = Omit<ComponentPropsWithoutRef<'div'>, 'className' | 'children'>;
type LinkProps = Omit<ComponentPropsWithoutRef<typeof Link>, 'className' | 'children' | 'href'>;

export default function CoachCard({ alert, accent, className, children, ...rest }: Common & DivProps) {
  return (
    <div className={clsx(kit.card, alert && kit.cardAlert, accent && kit.cardAccent, className)} {...rest}>
      {children}
    </div>
  );
}

/** The door role: the whole card is the link. */
export function CoachDoorCard({ href, alert, accent, className, children, ...rest }: Common & LinkProps & { href: string }) {
  return (
    <Link href={href} className={clsx(kit.card, kit.cardDoor, alert && kit.cardAlert, accent && kit.cardAccent, className)} {...rest}>
      {children}
    </Link>
  );
}

/**
 * The card's name row: the eyebrow on the left, and beside it a state chip (`<CoachChip>`) or — on
 * a door card — the arrow that says the card opens. `icon` sits before the words (the Overview
 * tiles keep theirs).
 */
export function CoachEyebrow({
  children,
  chip,
  arrow,
  icon,
}: {
  children: ReactNode;
  /** A `<CoachChip>` (or nothing). Renders at the row's right edge. */
  chip?: ReactNode;
  /** The door's arrow — pass on a `CoachDoorCard`. */
  arrow?: boolean;
  icon?: ReactNode;
}) {
  return (
    <span className={kit.eyeRow}>
      <span className={kit.eye}>
        {icon}
        {children}
      </span>
      {chip}
      {arrow && <ArrowGlyph />}
    </span>
  );
}

function ArrowGlyph() {
  /* lucide's ArrowRight at 13px, inlined so the kit has no icon-library import of its own. */
  return (
    <svg className={kit.eyeArrow} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
    </svg>
  );
}

/**
 * The figure — the number the card exists to show. `tone` colours it: good / bad / muted; `words`
 * is for a tile whose "figure" is a phrase ("Not set") — a step smaller and quieter (Overview D11).
 * `<small>` inside is the figure's qualifier ("of $6,000 · 71%"). A `span` so it can sit inside a
 * door card's `<a>` as well as a report card's `<div>`.
 */
export function CoachFigure({
  children,
  tone,
  words,
  className,
}: {
  children: ReactNode;
  tone?: 'good' | 'bad' | 'muted';
  words?: boolean;
  className?: string;
}) {
  return (
    <span className={clsx(kit.big, tone === 'good' && kit.bigGood, tone === 'bad' && kit.bigBad, tone === 'muted' && kit.bigMuted, words && kit.bigWords, className)}>
      {children}
    </span>
  );
}
