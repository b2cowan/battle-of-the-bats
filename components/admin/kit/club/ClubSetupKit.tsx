'use client';
/**
 * SET UP YOUR CLUB — the club's setup checklist on the kit (Club Tier Stage 1, specimen 10; built to
 * club hub v8). Renders only for a Club owner; every other plan keeps its own setup page (restyled
 * onto the kit in slice 2).
 *
 * Five steps, each with a REAL done condition (session 1's `computeClubChecklist`) and a button that
 * opens the screen that does the job (A11): the board, the teams, a head coach for every team, the
 * public page, the budget. Families is present — a Club inclusion — but is not a step that can be
 * "done". House league and tournaments are one line each, never steps, for a club that runs neither.
 *
 * ⚖ D6: no Founding Season banner, and no tournament plan chooser at the top (A06/A08). v8: the
 * "come back from Overview" sentence sits BESIDE its button, not under the title.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, AlertTriangle, Users, CalendarDays, Trophy } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { joinWithAnd, pluralize } from '@/lib/utils';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import ck from './ClubKit.module.css';
import styles from './ClubSetup.module.css';

type Step = { key: 'board' | 'teams' | 'coaches' | 'public' | 'budget'; done: boolean; href: string; detail: Record<string, unknown> };
type Checklist = {
  steps: Step[];
  doneCount: number;
  totalSteps: number;
  allDone: boolean;
  families: { available: boolean; href: string };
  optional: { houseLeague: { runs: boolean; href: string }; tournaments: { hosts: boolean; href: string } };
};

/** The drawn words for each step (specimen 10) — its title, what it asks, its button. */
const STEP_COPY: Record<Step['key'], { title: string; ask: string; button: string }> = {
  board: { title: 'Staff your board', ask: 'Invite an admin and a treasurer so the work isn’t all yours.', button: 'Members' },
  teams: { title: 'Add your teams', ask: 'Each team and the season it is playing.', button: 'Rep Teams' },
  coaches: { title: 'Name a head coach for every team', ask: 'Each coach gets the Premium Coaches Portal, included in your plan.', button: 'Invite a coach' },
  public: { title: 'Put your club online', ask: 'Add a tagline and a contact email to your public page.', button: 'Public site' },
  budget: { title: 'Plan the club’s budget', ask: 'What the season costs, and what each team contributes.', button: 'Budget' },
};

/** The fact line under a step — from its own detail, never a guess. */
function stepFact(step: Step): string | null {
  const d = step.detail;
  switch (step.key) {
    case 'board': {
      const joined = (d.joined as { name: string | null; role: string }[] | undefined) ?? [];
      const count = (d.count as number | undefined) ?? 0;
      if (count === 0) return null;
      const named = joined.filter(j => j.name).map(j => `${j.name} (${j.role})`);
      const more = count - named.length;
      return named.length > 0
        ? `${joinWithAnd(named)}${more > 0 ? ` and ${pluralize(more, 'other')}` : ''} ${count === 1 ? 'has' : 'have'} joined`
        : `${pluralize(count, 'board member')} joined`;
    }
    case 'teams': {
      const n = (d.activeTeams as number | undefined) ?? 0;
      return n > 0 ? pluralize(n, 'team') : null;
    }
    case 'coaches': {
      const withHead = (d.withHeadCoach as number | undefined) ?? 0;
      const total = (d.activeTeams as number | undefined) ?? 0;
      const missing = (d.missing as string[] | undefined) ?? [];
      if (total === 0) return 'Add a team first.';
      if (missing.length === 0) return `Every team has a head coach`;
      const named = missing.length <= 3 ? ` · ${joinWithAnd(missing)} ${missing.length === 1 ? 'doesn’t' : 'don’t'}` : '';
      return `${withHead} of ${total} teams have a head coach${named}`;
    }
    case 'public':
      return d.hasTagline ? 'Your tagline is saved' : null;
    case 'budget': {
      const lines = (d.lines as number | undefined) ?? 0;
      // The fiscal year's NAME ("2026–27" — Stage 3c), from the server.
      const year = d.budgetYear as string | undefined;
      return lines > 0 ? `${pluralize(lines, 'budget line')}${year ? ` for ${year}` : ''}` : null;
    }
  }
}

export default function ClubSetupKit() {
  const { currentOrg, userRole, loading } = useOrg();
  usePageTitle('Set up your club');
  const slug = currentOrg?.slug ?? '';
  const base = `/${slug}/admin`;
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; data: Checklist | null }>({ status: 'loading', data: null });

  const load = useCallback(() => {
    if (!slug) return;
    setState(prev => ({ status: 'loading', data: prev.data }));
    fetch(`/api/admin/org/club-checklist?orgSlug=${encodeURIComponent(slug)}`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((data: Checklist) => setState({ status: 'ready', data }))
      .catch(() => setState({ status: 'error', data: null }));
  }, [slug]);

  useEffect(() => { if (userRole === 'owner') load(); }, [load, userRole]);

  if (loading || !currentOrg || !userRole) return <div className={ck.loading}>Loading…</div>;

  const { status, data } = state;
  let number = 0;

  return (
    <div className={`${ck.page} ${styles.page}`}>
      <AdminPageHeader eyebrow="Set up your club" title={`Get ${currentOrg.name} ready for the season`} />

      {status === 'error' ? (
        <div className={`${ck.notice} ${ck.noticeBad}`} role="alert">
          <AlertTriangle size={15} aria-hidden />
          <div className={ck.noticeBody}>
            The checklist didn’t load.{' '}
            <button type="button" className={ck.link} onClick={load}>Try again</button>
          </div>
        </div>
      ) : !data ? (
        <div className={ck.loading}>Loading…</div>
      ) : (
        <>
          <ol className={styles.steps}>
            {data.steps.map(step => {
              number += 1;
              const copy = STEP_COPY[step.key];
              const fact = stepFact(step);
              return (
                <li key={step.key} className={`${styles.step}${step.done ? ` ${styles.stepDone}` : ''}`}>
                  <span className={styles.marker} aria-hidden>{step.done ? <Check size={14} strokeWidth={3} /> : number}</span>
                  <div className={styles.stepBody}>
                    <h2 className={styles.stepTitle}>
                      {copy.title}
                      <span className={styles.srOnly}>{step.done ? ' — done' : ' — to do'}</span>
                    </h2>
                    <p className={ck.hint}>{copy.ask}</p>
                    {fact && <p className={styles.fact}>{fact}</p>}
                  </div>
                  <Link href={step.href} className={`btn ${step.done ? 'btn-outline' : 'btn-lime'} ${styles.stepButton}`}>
                    {copy.button}
                  </Link>
                </li>
              );
            })}
            {data.families.available && (
              // A Club inclusion, never a step that can be "done" (specimen 10's note).
              <li className={`${styles.step} ${styles.stepQuiet}`}>
                <span className={styles.marker} aria-hidden><Users size={14} /></span>
                <div className={styles.stepBody}>
                  <h2 className={styles.stepTitle}>Meet your families</h2>
                  <p className={ck.hint}>As rosters fill, every household appears in Families: who owes, who is missing forms.</p>
                </div>
                <Link href={data.families.href} className={`btn btn-outline ${styles.stepButton}`}>Open Families</Link>
              </li>
            )}
          </ol>

          <div className={ck.quietRow}>
            {!data.optional.houseLeague.runs && (
              <span className={ck.quietItem}>
                <CalendarDays size={14} aria-hidden />Running a house league too? <Link href={data.optional.houseLeague.href} className={ck.link}>Set up a season</Link>
              </span>
            )}
            {!data.optional.tournaments.hosts && (
              <span className={ck.quietItem}>
                <Trophy size={14} aria-hidden />Hosting a tournament? <Link href={data.optional.tournaments.href} className={ck.link}>Run one</Link>
              </span>
            )}
          </div>

          <div className={styles.foot}>
            <Link href={base} className="btn btn-outline">Go to Overview</Link>
            <span className={ck.hint}>You can come back to this checklist from Overview at any time.</span>
          </div>
        </>
      )}
    </div>
  );
}
