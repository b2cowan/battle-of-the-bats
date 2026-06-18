/**
 * lib/registration-state.ts
 * Single source of truth for whether a tournament is accepting public
 * registrations, and what CTA (if any) to surface. Lifecycle-aware: once the
 * event is underway (today ≥ start date) or completed, registration reads as
 * closed regardless of capacity — so live/finished tournaments never show a
 * "Register" button or an "open" status. Used by the tournament home status
 * block and the public nav Register CTA.
 */
import type { Tournament, Division, Team } from '@/lib/types';
import { tournamentToday } from '@/lib/timezone';

export type RegistrationState = 'open' | 'waitlist' | 'closed' | 'not-open' | 'completed';

export interface RegistrationInfo {
  state: RegistrationState;
  label: string;
  detail: string;
  /** Public CTA to surface in the nav, if any. */
  cta: 'register' | 'waitlist' | null;
}

export function getRegistrationState(
  tournament: Pick<Tournament, 'status' | 'startDate' | 'endDate'>,
  divisions: Division[],
  /** Non-rejected registrations (used for capacity). */
  registrations: Team[],
): RegistrationInfo {
  if (tournament.status === 'completed') {
    return {
      state: 'completed',
      label: 'Tournament completed',
      detail: 'Registration is closed. View the schedule and results for this tournament.',
      cta: null,
    };
  }

  if (tournament.status !== 'active') {
    return {
      state: 'not-open',
      label: 'Registration not open',
      detail: 'This tournament is still being prepared by the organizer.',
      cta: null,
    };
  }

  // Event underway (or past) → registration is closed even if the tournament row
  // is still "active". Games are happening; lead with the schedule/results.
  // Tournament-local date so this closes at the venue's midnight, not UTC's (J6-056).
  const today = tournamentToday();
  if (tournament.startDate && today >= tournament.startDate) {
    return {
      state: 'closed',
      label: 'Registration closed',
      // Page-agnostic: some events hide the schedule/standings pages, so don't
      // promise pages that may not exist (J6-057).
      detail: 'The tournament is underway — registration for this event is now closed.',
      cta: null,
    };
  }

  if (divisions.length === 0) {
    return {
      state: 'not-open',
      label: 'Registration opens soon',
      detail: 'Divisions have not been published yet.',
      cta: null,
    };
  }

  const openGroups = divisions.filter(group => !group.isClosed);
  if (openGroups.length === 0) {
    return {
      state: 'closed',
      label: 'Registration closed',
      detail: 'All divisions are currently closed. Contact the organizer for availability.',
      cta: null,
    };
  }

  const hasDirectOpenSpot = openGroups.some(group => {
    const registered = registrations.filter(team => team.divisionId === group.id).length;
    return !group.capacity || registered < group.capacity;
  });

  if (hasDirectOpenSpot) {
    return {
      state: 'open',
      label: 'Registration is open',
      detail: 'Teams can register for available divisions now.',
      cta: 'register',
    };
  }

  return {
    state: 'waitlist',
    label: 'Join the waitlist',
    detail: 'Divisions are full, but teams can submit for waitlist consideration.',
    cta: 'waitlist',
  };
}
