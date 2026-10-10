'use client';
/**
 * REGISTRATION QUESTIONS — Tournament admin redesign Stage 5 (E6, A50, A54; F30, F31), built to hub v45, ruled as
 * drawn 2026-10-10.
 *
 *   rows      a row per question (its words; its type, choices, required or optional), opening its record
 *             (QuestionRecord: reads first, the pencil edits it with autosave, Archive ends it and asks). Each
 *             question was a 560px open form with Move up, Move down, Save and Archive on it all the time.
 *   order     a rare job: Tools (⋯) → Reorder is a MODE of the same list — Move up / Move down at 44px, Done in place
 *             of the title band's tools; each move saves. At a desk the rows also drag by a handle.
 *   adding    + (worded at a desk) asks in the same window.
 *   lock      the free plan's card, as today (the free tournament tier review decides it).
 *   back      to Settings, or to Teams when opened from there — unchanged.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ListOrdered, Lock, MoreHorizontal, Plus } from 'lucide-react';
import { useOrg } from '@/lib/org-context';
import { usePageTitle } from '@/lib/usePageTitle';
import { useTournament } from '@/lib/tournament-context';
import { hasPlanFeature } from '@/lib/plan-features';
import type { TournamentRegistrationField } from '@/lib/types';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import { ClubRow, ClubRowList, EmptyCard, LoadFailed, SavePill, repKit } from '@/components/admin/kit/club/RepKit';
import { screenParts } from '@/components/admin/tournament/ScreenParts';
import { MoveButtons, SortableRow, SortableRows, moved } from '@/components/admin/tournament/OrderParts';
import tb from '@/components/admin/tournament/AdminToolbar.module.css';
import { CoachToolbarMenu, CoachToolbarMenuItem } from '@/components/coaches/CoachToolbarMenu';
import { ORDER_WORDS, QUESTION_WORDS as W, questionCaption } from '@/lib/tournament-settings-words';
import QuestionRecord from './QuestionRecord';
import styles from './questions.module.css';

export default function RegistrationFieldsSettingsPage() {
  const { currentOrg } = useOrg();
  usePageTitle('Registration Questions');
  const { currentTournament } = useTournament();
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
  const [reordering, setReordering] = useState(false);

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
    setReordering(false);
    void refresh();
  }, [refresh]);

  // ── Order: each move saves; the floating pill says so, Retry replays it ──
  const [orderSaving, setOrderSaving] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [pendingOrder, setPendingOrder] = useState<string[] | null>(null);
  // One at a time: two quick moves save in the order they were made, so the last order is the one kept.
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const saveOrder = useCallback((ids: string[]) => {
    setPendingOrder(ids);
    setOrderSaving(true);
    setOrderError(null);
    const run = chain.current.catch(() => {}).then(async () => {
      try {
        const res = await fetch(`${apiBase}${orgQuery}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reorder', fields: ids.map((id, sortOrder) => ({ id, sortOrder })) }),
        });
        if (!res.ok) throw new Error('reorder');
        setPendingOrder(cur => (cur === ids ? null : cur));
      } catch {
        setOrderError(ORDER_WORDS.saveFailed);
      }
    });
    chain.current = run;
    void run.finally(() => { if (chain.current === run) setOrderSaving(false); });
    return run;
  }, [apiBase, orgQuery]);
  function move(from: number, to: number) {
    const next = moved(fields, from, to);
    setFields(next);
    void saveOrder(next.map(f => f.id));
  }

  if (!tournamentId) {
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

  const actions = reordering ? (
    <button type="button" className={`btn btn-outline btn-data ${screenParts.headerButton}`} onClick={() => setReordering(false)}>
      {ORDER_WORDS.done}
    </button>
  ) : (
    <>
      {fields.length > 1 && (
        <CoachToolbarMenu
          label={W.tools}
          icon={<MoreHorizontal size={18} className={tb.toolsGlyph} aria-hidden />}
          collapseOnPhone
          bareOnPhone
          drawerOnPhone
          drawerTitle={W.tools}
          triggerClassName={tb.tool}
        >
          <CoachToolbarMenuItem icon={<ListOrdered size={16} aria-hidden />} label={ORDER_WORDS.reorder} onSelect={() => setReordering(true)} />
        </CoachToolbarMenu>
      )}
      <button type="button" className={`btn btn-outline btn-data ${screenParts.headerButton}`} onClick={() => setOpenId('new')}
        aria-label={W.add} title={W.add} aria-haspopup="dialog">
        <Plus size={15} aria-hidden />
        <span className={screenParts.headerButtonLabel}>{W.add}</span>
      </button>
    </>
  );

  return (
    <div className={repKit.page}>
      <AdminPageHeader backTo={{ href: backHref, label: backLabel }} inlineActions title={W.title} actions={actions} />

      {loadError && fields.length === 0 ? (
        <LoadFailed title={loadError} onRetry={() => { setLoading(true); void refresh(); }} />
      ) : loading ? (
        <p className={styles.quiet} role="status">Loading…</p>
      ) : fields.length === 0 ? (
        <EmptyCard
          title={W.none}
          action={<button type="button" className="btn btn-outline" onClick={() => setOpenId('new')}>{W.add}</button>}
        >
          {W.noneLine}
        </EmptyCard>
      ) : (
        <>
          <p className={styles.lede} role={reordering ? 'status' : undefined}>{reordering ? W.reorderNote : W.lede}</p>
          <ClubRowList label={W.title}>
            {reordering ? fields.map((f, i) => (
              <ClubRow key={f.id} title={f.label} caption={caption(f)}
                beside={<MoveButtons index={i} count={fields.length} name={f.label} onMove={move} disabled={orderSaving} />} />
            )) : (
              <SortableRows ids={fields.map(f => f.id)} onMove={move}>
                {fields.map(f => (
                  <SortableRow key={f.id} id={f.id} name={f.label}>
                    {bits => (
                      <ClubRow as="button" aria-haspopup="dialog" onClick={() => setOpenId(f.id)} chevron
                        title={f.label} caption={caption(f)} {...bits} />
                    )}
                  </SortableRow>
                ))}
              </SortableRows>
            )}
          </ClubRowList>
        </>
      )}

      <SavePill saving={orderSaving} dirty={false} error={orderError} onRetry={() => { if (pendingOrder) void saveOrder(pendingOrder); }} />

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
