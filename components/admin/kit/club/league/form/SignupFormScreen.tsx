'use client';
/**
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 * THE SEASON'S SIGN-UP FORM (Board Ready Stage 4 Part 1; drawing tabs 1–4 and 9; owner rulings 1–20, 2026-11-20).
 *
 * One level down from the season Overview's Registration block ("← Overview", the page names itself "Sign-up form").
 * Three cards:
 *   Every sign-up asks   LOCKED: what the sign-up page already asks (it places a child and feeds the draft, fees and
 *                        emails). Folds to one line once the club has questions, and always starts folded on a phone.
 *   Your questions       the club's own, in two bands ("For each child", "Once per sign-up"), each a door to its window
 *                        (QuestionWindow). The shipped reorder list within a band; a question changes band through its
 *                        "Asked" field, never by dragging across. Rides the custom-questions gate (drawing tab 9).
 *   Documents to read    each a door to its window (DocumentWindow): versions, Replace, Archive. NEVER behind a plan.
 * The two adds are siblings, both outlined (neither takes the lime). An empty form offers "Copy {season}'s form".
 * Changing it is the people who set up a season, while it is live (the server's `canEdit`); everyone else who can open the
 * season reads it, and a finished season's lock line is the layout's (SeasonLockLine).
 * ══════════════════════════════════════════════════════════════════════════════════════════════
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { arrayMove } from '@dnd-kit/sortable';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import {
  ClubRow, ClubRowBand, ClubRowList, ClubSection, LoadFailed, RepChip, SavePill, repKit, useDeferredLoad, useLatestRead,
} from '@/components/admin/kit/club/RepKit';
import { jsonInit } from '@/lib/money-fetch';
import { readRefusal } from '@/lib/schedule-words';
import { screenParts } from '@/components/admin/tournament/ScreenParts';
import { ReorderList, ReorderRow } from '@/components/admin/tournament/ReorderList';
import { useSaveQueue } from '@/components/admin/tournament/useSaveQueue';
import LoadingState from '@/components/shared/LoadingState';
import { useIsPhone } from '@/lib/hooks/useIsPhone';
import { getBillingHref } from '@/lib/billing-urls';
import { isLiveDocument, isLiveQuestion, type FormDocument, type FormQuestion, type QuestionAsked } from '@/lib/club-form';
import {
  ASKED_WORDS, FORM_WORDS as W, documentCaption, fixedFields, foldedLine, questionCaption, questionsSummary,
} from '@/lib/club-form-words';
import type { OrgPlan } from '@/lib/types';
import QuestionWindow from './QuestionWindow';
import DocumentWindow from './DocumentWindow';
import f from './SignupForm.module.css';

export type FormRead = {
  form: { id: string; questions: FormQuestion[]; documents: FormDocument[] };
  counts: { children: number; signups: number };
  canEdit: boolean;
  finished: boolean;
  questionsOnPlan: boolean;
  fixed: { friendMax: number; askEmailConsent: boolean; clubName: string };
  season: { id: string; name: string };
  copyFrom: { seasonId: string; name: string; questions: number; documents: number } | null;
};

export default function SignupFormScreen({ orgSlug, seasonId, planId }: { orgSlug: string; seasonId: string; planId: OrgPlan | undefined }) {
  const orgQuery = `?orgSlug=${encodeURIComponent(orgSlug)}`;
  const apiBase = `/api/admin/house-league/seasons/${encodeURIComponent(seasonId)}/form`;
  const isPhone = useIsPhone();
  const [read, setRead] = useState<FormRead | null>(null);
  const [loadError, setLoadError] = useState('');
  const [refused, setRefused] = useState(false);
  const begin = useLatestRead();

  const refresh = useCallback(async (): Promise<boolean> => {
    const current = begin();
    try {
      const res = await fetch(`${apiBase}${orgQuery}`, { cache: 'no-store' });
      const data = await res.json().catch(() => null) as FormRead | null;
      if (!current()) return false;
      if (res.status === 403 || res.status === 401) { setRefused(true); return false; }
      if (!res.ok || !data?.form) throw new Error('load');
      setRead(data);
      setLoadError('');
      return true;
    } catch {
      if (current()) setLoadError(W.loadFailed);
      return false;
    }
  }, [apiBase, orgQuery, begin]);
  useDeferredLoad(!!orgSlug, refresh);

  // ── Order: each move saves, one at a time; the page's pill says so and Retry replays it ──
  const { saving: orderSaving, error: orderError, run, retry: retryOrder } = useSaveQueue();
  const readRef = useRef(read);
  useEffect(() => { readRef.current = read; }, [read]);
  const saveOrder = useCallback((kind: 'questions' | 'documents', ids: string[]) => {
    void run(async () => {
      const res = await fetch(`${apiBase}${orgQuery}`, jsonInit('POST', { action: 'reorder', kind, ids }));
      if (!res.ok) throw new Error('reorder');
    }, W.orderFailed);
  }, [apiBase, orgQuery, run]);

  const liveQuestions = useMemo(() => (read?.form.questions ?? []).filter(isLiveQuestion), [read]);
  const liveDocuments = useMemo(() => (read?.form.documents ?? []).filter(isLiveDocument), [read]);
  const band = useCallback((asked: QuestionAsked) => liveQuestions.filter(q => q.asked === asked), [liveQuestions]);

  /** A move inside one band: the whole order goes (each child's band first, then once per sign-up). */
  const moveQuestion = useCallback((asked: QuestionAsked) => (from: number, to: number) => {
    const r = readRef.current;
    if (!r) return;
    const live = r.form.questions.filter(isLiveQuestion);
    const mine = arrayMove(live.filter(q => q.asked === asked), from, to);
    const other = live.filter(q => q.asked !== asked);
    const ordered = asked === 'per_subject' ? [...mine, ...other] : [...other, ...mine];
    const sorted = ordered.map((q, i) => ({ ...q, sortOrder: i }));
    setRead({ ...r, form: { ...r.form, questions: [...sorted, ...r.form.questions.filter(q => !isLiveQuestion(q))] } });
    saveOrder('questions', sorted.map(q => q.id));
  }, [saveOrder]);

  const moveDocument = useCallback((from: number, to: number) => {
    const r = readRef.current;
    if (!r) return;
    const live = arrayMove(r.form.documents.filter(isLiveDocument), from, to).map((d, i) => ({ ...d, sortOrder: i }));
    setRead({ ...r, form: { ...r.form, documents: [...live, ...r.form.documents.filter(d => !isLiveDocument(d))] } });
    saveOrder('documents', live.map(d => d.id));
  }, [saveOrder]);

  // ── Windows ──
  const [openQ, setOpenQ] = useState<string | null>(null);
  const [openD, setOpenD] = useState<string | null>(null);
  const [fixedOpen, setFixedOpen] = useState<boolean | null>(null);
  const [copyAsk, setCopyAsk] = useState(false);
  const [copyBusy, setCopyBusy] = useState(false);
  const [copyError, setCopyError] = useState('');

  if (refused) return <LoadFailed title="This season’s sign-up form isn’t yours to open." />;
  if (!read) return loadError ? <LoadFailed title={loadError} onRetry={() => void refresh()} /> : <LoadingState label={W.loading} />;

  const { canEdit, fixed, counts, questionsOnPlan, copyFrom } = read;
  const fields = fixedFields(fixed.friendMax, fixed.clubName, fixed.askEmailConsent);
  const detailCount = fields.child.length + fields.guardian.length + fields.end.length;
  // Folded once the club has questions, and on a phone; the person's own Show / Hide wins after that.
  const folded = fixedOpen === null ? (liveQuestions.length > 0 || isPhone) : !fixedOpen;
  // The order the windows step through: each child's band, then once per sign-up (the list's own order).
  const stepOrder = [...band('per_subject'), ...band('once')];

  const addButton = (label: string, onClick: () => void) => (
    <button type="button" className={`btn btn-outline ${screenParts.headerButton} ${f.add}`} onClick={onClick}
      aria-label={label} title={label} aria-haspopup="dialog">
      <Plus size={15} aria-hidden /><span className={screenParts.headerButtonLabel}>{label}</span>
    </button>
  );

  async function copy() {
    if (!copyFrom || copyBusy) return;
    setCopyBusy(true);
    setCopyError('');
    try {
      const res = await fetch(`${apiBase}${orgQuery}`, jsonInit('POST', { action: 'copy', fromSeasonId: copyFrom.seasonId }));
      if (!res.ok) { setCopyError(await readRefusal(res, W.copyFailed)); return; }
      await refresh();
      setCopyAsk(false);
    } catch {
      setCopyError(W.copyFailed);
    } finally {
      setCopyBusy(false);
    }
  }

  const questionTitle = (q: FormQuestion) => (
    <>{q.label}{q.health && <span className={f.rowMark}><RepChip tone="warn">Health</RepChip></span>}</>
  );
  const questionCaptions = (q: FormQuestion) => (
    <><span className={f.deskOnly}>{questionCaption(q)}</span><span className={f.phoneOnly}>{questionCaption(q, true)}</span></>
  );

  const bandList = (asked: QuestionAsked) => {
    const qs = band(asked);
    if (qs.length === 0) return null;
    const label = ASKED_WORDS.find(a => a.value === asked)!.label;
    return (
      <>
        <ClubRowBand count={qs.length}>{label}</ClubRowBand>
        {canEdit ? (
          <ReorderList ids={qs.map(q => q.id)} names={qs.map(q => q.label)} onMove={moveQuestion(asked)} disabled={orderSaving}>
            {qs.map(q => (
              <ReorderRow key={q.id} id={q.id}>
                {({ handle, itemRef, itemStyle }) => (
                  <ClubRow as="button" aria-haspopup="dialog" onClick={() => setOpenQ(q.id)} chevron
                    title={questionTitle(q)} caption={questionCaptions(q)} grip={handle} itemRef={itemRef} itemStyle={itemStyle} />
                )}
              </ReorderRow>
            ))}
          </ReorderList>
        ) : qs.map(q => (
          <ClubRow key={q.id} as="button" aria-haspopup="dialog" onClick={() => setOpenQ(q.id)} chevron title={questionTitle(q)} caption={questionCaptions(q)} />
        ))}
      </>
    );
  };

  const docTitle = (d: FormDocument) => (
    <><span className={f.kind}><RepChip tone="info">{d.source === 'pdf' ? 'PDF' : 'Text'}</RepChip></span>{d.name}</>
  );
  const docCaption = (d: FormDocument) => (
    <><span className={f.deskOnly}>{documentCaption(d)}</span><span className={f.phoneOnly}>{documentCaption(d, true)}</span></>
  );

  const openQuestion = openQ && openQ !== 'new' ? stepOrder.find(q => q.id === openQ) ?? read.form.questions.find(q => q.id === openQ) ?? null : null;
  const qIdx = openQuestion ? stepOrder.findIndex(q => q.id === openQuestion.id) : -1;
  const openDocument = openD && openD !== 'new' ? read.form.documents.find(d => d.id === openD) ?? null : null;
  const dIdx = openDocument ? liveDocuments.findIndex(d => d.id === openDocument.id) : -1;

  return (
    <div className={f.page}>
      {/* ── Every sign-up asks (locked; drawing tab 1) ── */}
      {folded ? (
        <p className={f.folded}>
          {foldedLine(detailCount)} ·{' '}
          <button type="button" className={repKit.inlineLink} aria-expanded={false} onClick={() => setFixedOpen(true)}>{W.show}</button>
        </p>
      ) : (
        <ClubSection
          id="form-fixed"
          title={<>{W.fixedTitle}<span className={f.titleChip}><RepChip>{W.fixedChip}</RepChip></span></>}
          meta={W.fixedSum}
          actions={(liveQuestions.length > 0 || isPhone)
            ? <button type="button" className={repKit.inlineLink} aria-expanded onClick={() => setFixedOpen(false)}>{W.hide}</button>
            : undefined}
        >
          <div className={f.fixedGrid}>
            <div><span className={f.capL}>{W.fixedChild}</span><ul>{fields.child.map(x => <li key={x}>{x}</li>)}</ul></div>
            <div><span className={f.capL}>{W.fixedGuardian}</span><ul>{fields.guardian.map(x => <li key={x}>{x}</li>)}</ul></div>
            {fields.end.length > 0 && <div><span className={f.capL}>{W.fixedEnd}</span><ul>{fields.end.map(x => <li key={x}>{x}</li>)}</ul></div>}
          </div>
          <p className={f.small}>{W.fixedFoot}</p>
        </ClubSection>
      )}

      {/* ── Your questions (drawing tab 2; the plan's gate, tab 9) ── */}
      <ClubSection id="form-questions" title={W.questionsTitle} meta={questionsOnPlan ? questionsSummary(liveQuestions.length) : undefined}>
        {!questionsOnPlan ? (
          <p className={f.small}>
            {W.planLocked}{' '}
            <Link href={getBillingHref({ slug: orgSlug, planId: planId ?? 'free' }, { host: 'admin' })}>{W.seePlans}</Link>
          </p>
        ) : liveQuestions.length === 0 ? (
          <div className={f.empty}>
            <p className={f.emptyTitle}>{W.noQuestions}</p>
            <p className={f.small}>{isPhone ? W.noQuestionsLinePhone : copyFrom && canEdit ? W.noQuestionsCopyLine : W.noQuestionsLine}</p>
            {canEdit && (
              <div className={f.emptyActions}>
                {copyFrom && (
                  <button type="button" className="btn btn-outline" aria-haspopup="dialog" onClick={() => { setCopyError(''); setCopyAsk(true); }}>
                    {W.copyButton(copyFrom.name)}
                  </button>
                )}
                <button type="button" className={`btn btn-outline ${f.add}`} aria-haspopup="dialog" onClick={() => setOpenQ('new')}>
                  <Plus size={15} aria-hidden /> {W.addQuestion}
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className={f.head}>
              <p className={f.lede}>{W.lede}</p>
              {canEdit && addButton(W.addQuestion, () => setOpenQ('new'))}
            </div>
            <div className={f.outline}>
              <ClubRowList inset label={W.questionsTitle}>
                {bandList('per_subject')}
                {bandList('once')}
              </ClubRowList>
            </div>
          </>
        )}
      </ClubSection>

      {/* ── Documents to read (drawing tab 3; on every plan) ── */}
      <ClubSection id="form-documents" title={W.documentsTitle}
        actions={canEdit ? addButton(W.addDocument, () => setOpenD('new')) : undefined}>
        {liveDocuments.length === 0 ? (
          <p className={f.small}>{W.noDocuments}</p>
        ) : (
          <div className={f.outline}>
            <ClubRowList inset label={W.documentsTitle}>
              {canEdit ? (
                <ReorderList ids={liveDocuments.map(d => d.id)} names={liveDocuments.map(d => d.name)} onMove={moveDocument} disabled={orderSaving}>
                  {liveDocuments.map(d => (
                    <ReorderRow key={d.id} id={d.id}>
                      {({ handle, itemRef, itemStyle }) => (
                        <ClubRow as="button" aria-haspopup="dialog" onClick={() => setOpenD(d.id)} chevron
                          title={docTitle(d)} caption={docCaption(d)} grip={handle} itemRef={itemRef} itemStyle={itemStyle} />
                      )}
                    </ReorderRow>
                  ))}
                </ReorderList>
              ) : liveDocuments.map(d => (
                <ClubRow key={d.id} as="button" aria-haspopup="dialog" onClick={() => setOpenD(d.id)} chevron title={docTitle(d)} caption={docCaption(d)} />
              ))}
            </ClubRowList>
          </div>
        )}
        <p className={f.foot}>{questionsOnPlan ? W.documentsFoot : W.documentsEveryPlan}</p>
      </ClubSection>

      <SavePill saving={orderSaving} dirty={false} error={orderError} held={null} onRetry={retryOrder} />

      {openQ && (openQ === 'new' || openQuestion) && (
        <QuestionWindow
          question={openQ === 'new' ? null : openQuestion}
          apiBase={`${apiBase}/questions`}
          orgQuery={orgQuery}
          canEdit={canEdit}
          counts={counts}
          prev={qIdx > 0 ? { id: stepOrder[qIdx - 1].id, name: stepOrder[qIdx - 1].label } : null}
          next={qIdx >= 0 && qIdx < stepOrder.length - 1 ? { id: stepOrder[qIdx + 1].id, name: stepOrder[qIdx + 1].label } : null}
          position={qIdx >= 0 ? `${qIdx + 1} of ${stepOrder.length}` : ''}
          onStep={setOpenQ}
          onClose={() => setOpenQ(null)}
          onChanged={refresh}
        />
      )}

      {openD && (openD === 'new' || openDocument) && (
        <DocumentWindow
          document={openD === 'new' ? null : openDocument}
          apiBase={`${apiBase}/documents`}
          orgQuery={orgQuery}
          canEdit={canEdit}
          prev={dIdx > 0 ? { id: liveDocuments[dIdx - 1].id, name: liveDocuments[dIdx - 1].name } : null}
          next={dIdx >= 0 && dIdx < liveDocuments.length - 1 ? { id: liveDocuments[dIdx + 1].id, name: liveDocuments[dIdx + 1].name } : null}
          position={dIdx >= 0 ? `${dIdx + 1} of ${liveDocuments.length}` : ''}
          onStep={setOpenD}
          onClose={() => setOpenD(null)}
          onChanged={refresh}
        />
      )}

      {copyAsk && copyFrom && (
        <KitDialog
          kind="question"
          title={W.copyTitle(copyFrom.name)}
          onClose={() => { if (!copyBusy) setCopyAsk(false); }}
          busy={copyBusy}
          footer={(
            <>
              <button type="button" className="btn btn-outline" onClick={() => setCopyAsk(false)} disabled={copyBusy}>{W.cancel}</button>
              <button type="button" className="btn btn-lime" onClick={() => void copy()} disabled={copyBusy}>{copyBusy ? W.copying : W.copyAction}</button>
            </>
          )}
        >
          <p>{W.copyBody(copyFrom.name, questionsOnPlan ? copyFrom.questions : 0, copyFrom.documents)}</p>
          {copyError && <p className={screenParts.recordBefore} role="alert">{copyError}</p>}
        </KitDialog>
      )}
    </div>
  );
}
