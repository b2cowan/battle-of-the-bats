'use client';
/**
 * components/public/SharePageButton.tsx
 * Shares a page's URL (a tournament, team, or champion page). The recipient's
 * chat unfurls that page's branded OG preview AND can tap through — driving
 * traffic and, for team pages, followers. Link-only by design: a page's
 * shareable "image" IS its server-rendered OG card, surfaced automatically on
 * unfurl, so there's nothing separate to "save". (Game scores get the richer
 * link-or-image menu via ShareScoreButton.)
 */
import { useState } from 'react';
import { Share2, Check } from 'lucide-react';
import { shareLink } from '@/lib/share-card';
import { publicHref, useClubPublicOrigin } from '@/lib/use-club-public-origin';
import styles from './ShareScoreButton.module.css';

type Props = {
  /** Path to share (origin is prepended). */
  url: string;
  title: string;
  text: string;
  label?: string;
  className?: string;
  /** Icon-only (no visible label) — for tight spots like the mobile header. */
  compact?: boolean;
  /** Class for the label span so callers can hide it responsively (icon-only
   *  mobile) without reaching into this component's markup blindly. */
  labelClassName?: string;
  /**
   * Club Tier 4e: set ONLY by a screen that hands a club's public page to someone from the coaches portal or the admin (the
   * coach welcome banner). `url` is then `/{club}/…` and the link is spelled for the club's own web address when it has one.
   * The public pages leave it off: they run on the visitor's own address already, so `origin + url` is right there.
   */
  club?: string;
};

export default function SharePageButton({ url, title, text, label = 'Share', className, compact = false, labelClassName, club }: Props) {
  const [state, setState] = useState<'idle' | 'busy' | 'shared' | 'copied'>('idle');
  const clubOrigin = useClubPublicOrigin(club);

  async function handle() {
    if (state === 'busy') return;
    setState('busy');
    const full = club && url.startsWith(`/${club}`)
      ? publicHref(clubOrigin, club, url.slice(club.length + 1))
      : `${window.location.origin}${url}`;
    const result = await shareLink(full, title, text);
    setState(result === 'idle' ? 'idle' : result);
    if (result !== 'idle') window.setTimeout(() => setState('idle'), 2200);
  }

  const txt = state === 'busy' ? 'Sharing…'
    : state === 'copied' ? 'Link copied'
    : state === 'shared' ? 'Shared'
    : label;

  return (
    <button
      type="button"
      className={className ?? styles.trigger}
      onClick={handle}
      disabled={state === 'busy'}
      aria-label={`Share ${title}`}
    >
      {state === 'copied' || state === 'shared' ? <Check size={16} /> : <Share2 size={16} />}
      {!compact && <span className={labelClassName}>{txt}</span>}
    </button>
  );
}
