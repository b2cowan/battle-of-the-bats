'use client';
/**
 * components/public/FollowDeepLinkPrompt.tsx
 * Makes a shared `?follow=teamId` link self-onboarding (J6-012): when a fan lands on
 * any tournament page with that param, resolve the team and offer a one-tap "Follow
 * [team]?" confirm, then strip the param. Reads/strips via window.location (no
 * useSearchParams → no Suspense boundary needed in the layout). No account required.
 */
import { useEffect, useState } from 'react';
import { Star, X } from 'lucide-react';
import type { PublicTeam } from '@/lib/types';
import { saveFollowedTeam, readFollowedTeamId } from '@/lib/follow';
import { fetchPublicTournamentData } from '@/lib/public-tournament-client';
import styles from './FollowDeepLinkPrompt.module.css';

export default function FollowDeepLinkPrompt({ orgSlug, tournamentSlug }: { orgSlug: string; tournamentSlug: string }) {
  const [team, setTeam] = useState<PublicTeam | null>(null);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('follow');
    if (!id) return;
    // Already following this team (or invalid id) → just clean the URL, no prompt.
    if (readFollowedTeamId(orgSlug, tournamentSlug) === id) { stripParam(); return; }
    let cancelled = false;
    void fetchPublicTournamentData(orgSlug, tournamentSlug, 'teams').then(data => {
      if (cancelled) return;
      const found = data?.teams?.find(t => t.id === id) ?? null;
      if (found) setTeam(found);
      else stripParam();
    });
    return () => { cancelled = true; };
  }, [orgSlug, tournamentSlug]);

  function stripParam() {
    const url = new URL(window.location.href);
    url.searchParams.delete('follow');
    window.history.replaceState({}, '', url.toString());
  }

  function confirm() {
    if (team) saveFollowedTeam(orgSlug, tournamentSlug, { id: team.id, name: team.name, divisionId: team.divisionId });
    setTeam(null);
    stripParam();
  }

  function dismiss() {
    setTeam(null);
    stripParam();
  }

  if (!team) return null;

  return (
    <div className={styles.banner} role="dialog" aria-label="Follow team">
      <Star size={16} className={styles.star} aria-hidden />
      <span className={styles.text}>Follow <strong>{team.name}</strong>?</span>
      <button type="button" className={styles.confirm} onClick={confirm}>Follow</button>
      <button type="button" className={styles.dismiss} onClick={dismiss} aria-label="Dismiss">
        <X size={15} />
      </button>
    </div>
  );
}
