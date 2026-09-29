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
 */
import { useEffect, useState } from 'react';
import { CoachCard } from '@/components/coaches/kit';
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
  if (!card || dismissed) return null;

  return (
    <CoachCard accent className={css.card} role="status">
      <span className={css.kicker}>{kicker}</span>
      <p className={css.title}>{card.title}</p>
      <p className={css.body}>{card.body}</p>
      <div>
        <button type="button" className="btn btn-outline btn-sm" onClick={dismiss}>Got it</button>
      </div>
    </CoachCard>
  );
}
