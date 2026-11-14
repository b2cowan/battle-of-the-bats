'use client';
/**
 * The club team's ONE-TIME Overview card (Club Tier Stage 2): "{Club} started the {season}" the first
 * time a coach opens a season the club rolled into (specimen 4, second frame), or "Welcome to {team},
 * {name}" in the first days after a club-invited coach accepts (specimen 6, "Where she lands"). The
 * words and facts are the server's (`/api/coaches/…/club-arrival`, read from the season itself);
 * "Got it" dismisses it for good on this device — the portal's one dismiss idiom
 * (`useCoachNudgeDismiss`), per team and per card, so a later season's card still shows.
 *
 * Renders nothing for a standalone portal, a closed season, or once dismissed. No season door ever
 * appears here: the club holds them (binding).
 *
 * ⚠ ONE ROW IN THE OVERVIEW'S TAIL, not a card above the One Thing (owner 2026-11-14, Overview drawings A4): it is not
 * today's work, and as an accent card above the day's card it pushed game day down the same way the club's proposals
 * did. The row is a static record — the card's title and its sentence — with "Got it" BESIDE it, never inside it.
 */
import { useEffect, useId, useState } from 'react';
import { CoachRow, CoachRowList } from '@/components/coaches/CoachRowList';
import { useCoachNudgeDismiss } from '@/components/coaches/useCoachNudgeDismiss';
import css from './CoachClubArrivalCard.module.css';

type Card = { key: string; title: string; body: string };

export default function CoachClubArrivalCard({ orgSlug, teamId }: { orgSlug: string; teamId: string }) {
  const [card, setCard] = useState<Card | null>(null);
  const [kicker, setKicker] = useState<'New season' | 'Welcome'>('New season');

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/coaches/${encodeURIComponent(orgSlug)}/teams/${encodeURIComponent(teamId)}/club-arrival`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then((d: { started: Card | null; welcome: Card | null } | null) => {
        if (cancelled || !d) return;
        if (d.welcome) { setKicker('Welcome'); setCard(d.welcome); } else if (d.started) { setKicker('New season'); setCard(d.started); }
      })
      .catch(() => { /* a hint that fails to load is simply not shown */ });
    return () => { cancelled = true; };
  }, [orgSlug, teamId]);

  const { dismissed, dismiss } = useCoachNudgeDismiss(teamId, card?.key ?? 'club_arrival');
  const titleId = useId();
  if (!card || dismissed) return null;

  return (
    <div className={css.block}>
      <div className={css.head}>
        <h2 className={css.kicker} id={titleId}>{kicker}</h2>
      </div>
      <CoachRowList labelledBy={titleId}>
        <CoachRow
          title={card.title}
          caption={card.body}
          beside={<button type="button" className="btn btn-outline btn-sm" onClick={dismiss}>Got it</button>}
        />
      </CoachRowList>
    </div>
  );
}
