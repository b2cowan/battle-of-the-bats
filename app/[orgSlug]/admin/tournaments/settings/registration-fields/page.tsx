'use client';
/**
 * REGISTRATION QUESTIONS — Tournament admin redesign Stage 5 (E6, A50; F30, F31), built to hub v45, ruled as drawn
 * 2026-10-10; order on the portal's standard since 2026-10-12.
 *
 *   rows      a row per question (its words; its type, choices, required or optional), opening its record
 *             (QuestionRecord: reads first, the pencil edits it with autosave, Archive ends it and asks). Each
 *             question was a 560px open form with Move up, Move down, Save and Archive on it all the time.
 *   order     the portal's reorder standard (ReorderList; owner 2026-10-12, superseding A54's Tools → Reorder mode):
 *             each row's handle drags (hold it on a phone), a tap on it offers Move up · Move down · Cancel; each
 *             move saves. The Tools menu held only Reorder, so it went with it.
 *   adding    + (worded at a desk) asks in the same window.
 *   lock      the free plan's card, as today (the free tournament tier review decides it).
 *   back      to Settings, or to Teams when opened from there — unchanged.
 */
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Lock, Plus } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { useTournament } from '@/lib/tournament-context';
import { hasPlanFeature } from '@/lib/plan-features';
import type { TournamentRegistrationField } from '@/lib/types';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { ClubRow, ClubRowList, EmptyCard, LoadFailed, SavePill, repKit } from '@/components/admin/kit/club/RepKit';
import { screenParts } from '@/components/admin/tournament/ScreenParts';
import { ReorderList, ReorderRow } from '@/components/admin/tournament/ReorderList';
import { arrayMove } from '@dnd-kit/sortable';
import { useSaveQueue } from '@/components/admin/tournament/useSaveQueue';
import { ORDER_WORDS, QUESTION_WORDS as W, questionCaption } from '@/lib/tournament-settings-words';
import QuestionRecord from './QuestionRecord';
import styles from './questions.module.css';
import LoadingState from '@/components/shared/LoadingState';

export default function RegistrationFieldsSettingsPage() {
  const { currentOrg } = useOrg();
  usePageTitle('Registration Questions');
  const { currentTournament, loading: tournamentLoading } = useTournament();
  const searchParams = useSearchParams();
  const fromRegistrations = searchParams.get('from') === 'registrations';
  const base = `/${currentOrg?.slug ?? 'admin'}/admin/tournaments/settings`;
  const backHref = fromRegistrations ? `/${currentOrg?.slug ?? 'admin'}/admin/tournaments/registrations` : base;
  const backLabel = fromRegistrations ? 'Registrations' : 'Settings';
  const hasPlus = currentOrg ? hasPlanFeature(currentOrg.planId, 'custom_registration_fields') : false;
  const tournamentId = currentTournament?.id;
  const orgQuery = currentOrg?.slug ? `?orgSlug=${encodeURIComponent(currentOrg.slug)}` : '';
  // org-slug-ok: every call appends orgQuery (?orgSlug=…) to this base, the record's included.
  const apiBase = tournamentId ? `/api/admin/tournaments/${encodeURIComponent(tournamentId)}/registration-fields` : '';

  const [fields, setFields] = useState<TournamentRegistrationField[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  /** Re-reads the questions; false when they didn't load. */
  const refresh = useCallback(async (): Promise<boolean> => {
    if (!apiBase || !hasPlus) return false;
    try {
      const res = await fetch(`${apiBase}${orgQuery}`, { cache: 'no-store' });
      const data = await res.json().catch(() => null) as { fields?: TournamentRegistrationField[] } | null;
      if (!res.ok || !Array.isArray(data?.fields)) throw new Error('load');
      setFields(data.fields);
      setLoadError('');
      return true;
    } catch {
      setLoadError(W.loadFailed);
      return false;
    } finally {
      setLoading(false);
    }
  }, [apiBase, hasPlus, orgQuery]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new event reads its own questions
    setLoading(true);
    setOpenId(null);
    void refresh();
  }, [refresh]);

  // ── Order: each move saves, one at a time (the last order is the one kept); the pill says so, Retry replays it ──
  const { saving: orderSaving, error: orderError, run: runSave, retry: retryOrder } = useSaveQueue();
  function move(from: number, to: number) {
    const next = arrayMove(fields, from, to);
    setFields(next);
    const ids = next.map(f => f.id);
    void runSave(async () => {
      const res = await fetch(`${apiBase}${orgQuery}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reorder', fields: ids.map((id, sortOrder) => ({ id, sortOrder })) }),
      });
      if (!res.ok) throw new Error('reorder');
    }, ORDER_WORDS.saveFailed);
  }

  if (!tournamentId) {
    // The tournament itself still loading is a wait, not "no tournament" (the questions' own words).
    if (tournamentLoading) return <div className={repKit.page}><LoadingState label="Loading the questions…" /></div>;
    return (
      <div className={repKit.page}>
        <p className={styles.quiet}>Select a tournament from the sidebar to manage registration questions.</p>
      </div>
    );
  }

  if (!hasPlus) {
    return (
      <div className={repKit.page}>
        <AdminPageHeader backTo={{ href: backHref, label: backLabel }} inlineActions title={W.title} />
        <div className={styles.lock}>
          <p className={styles.lockLede}>Every registration already collects team name, coach, email, and division.</p>
          <div className={styles.lockHead}>
            <Lock size={14} aria-hidden />
            <h2 className={styles.lockTitle}>Custom questions</h2>
          </div>
          <p className={styles.lockBody}>
            Add short text fields, dropdowns, file uploads, and more to gather tournament-specific details at registration.
            Available with{' '}
            <Link href={`/${currentOrg?.slug ?? 'admin'}/admin/tournaments/settings/subscription`}>Tournament Plus</Link>.
          </p>
        </div>
      </div>
    );
  }

  const idx = openId && openId !== 'new' ? fields.findIndex(f => f.id === openId) : -1;
  const caption = (f: TournamentRegistrationField) => questionCaption(f.fieldType, f.options.length, f.required);

  const actions = (
    <button type="button" className={`btn btn-outline btn-data ${screenParts.headerButton}`} onClick={() => setOpenId('new')}
      aria-label={W.add} title={W.add} aria-haspopup="dialog">
      <Plus size={15} aria-hidden />
      <span className={screenParts.headerButtonLabel}>{W.add}</span>
    </button>
  );

  return (
    <div className={repKit.page}>
      <AdminPageHeader backTo={{ href: backHref, label: backLabel }} inlineActions title={W.title} actions={actions} />

      {loadError && fields.length === 0 ? (
        <LoadFailed title={loadError} onRetry={() => { setLoading(true); void refresh(); }} />
      ) : loading ? (
        <LoadingState label="Loading the questions…" />
      ) : fields.length === 0 ? (
        <EmptyCard
          title={W.none}
          action={<button type="button" className="btn btn-outline" onClick={() => setOpenId('new')}>{W.add}</button>}
        >
          {W.noneLine}
        </EmptyCard>
      ) : (
        <>
          <p className={styles.lede}>{W.lede}</p>
          <ClubRowList label={W.title}>
            <ReorderList ids={fields.map(f => f.id)} names={fields.map(f => f.label)} onMove={move} disabled={orderSaving}>
              {fields.map(f => (
                <ReorderRow key={f.id} id={f.id}>
                  {({ handle, itemRef, itemStyle }) => (
                    <ClubRow as="button" aria-haspopup="dialog" onClick={() => setOpenId(f.id)} chevron
                      title={f.label} caption={caption(f)}
                      grip={handle} itemRef={itemRef} itemStyle={itemStyle} />
                  )}
                </ReorderRow>
              ))}
            </ReorderList>
          </ClubRowList>
        </>
      )}

      <SavePill saving={orderSaving} dirty={false} error={orderError} onRetry={retryOrder} />

      {openId && (openId === 'new' || idx >= 0) && (
        <QuestionRecord
          question={openId === 'new' ? null : fields[idx]}
          apiBase={apiBase}
          orgQuery={orgQuery}
          canWrite
          prev={idx > 0 ? { id: fields[idx - 1].id, name: fields[idx - 1].label } : null}
          next={idx >= 0 && idx < fields.length - 1 ? { id: fields[idx + 1].id, name: fields[idx + 1].label } : null}
          position={`${idx + 1} of ${fields.length}`}
          onStep={setOpenId}
          onClose={() => setOpenId(null)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}
