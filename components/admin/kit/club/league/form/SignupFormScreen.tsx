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
 *
 * ⚖ THE CLUB'S SPONSORSHIP FORM is this same page (Board Ready Stage 6, ask 8: "Stage 4's editor with no 'for each child'
 * groups and no Health switch"), given `sponsorship`: its own API, the business form's shape (no Asked, no Health, no
 * draft board, one list with no bands), and its locked card is the business card the club can't remove. It has no copy.
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
import { BUSINESS_FORM_SHAPE, isLiveDocument, isLiveQuestion, SEASON_FORM_SHAPE, type FormDocument, type FormQuestion, type QuestionAsked } from '@/lib/club-form';
import {
  ASKED_WORDS, FORM_WORDS as W, typeLabel, documentCaption, fixedFields, foldedLine, questionCaption, questionsSummary,
} from '@/lib/club-form-words';
import type { OrgPlan } from '@/lib/types';
import QuestionWindow from './QuestionWindow';
import DocumentWindow from './DocumentWindow';
import f from './SignupForm.module.css';
import { STAFF_FORM_WORDS } from '@/lib/club-form-staff-words';

export type FormRead = {
  form: { id: string; questions: FormQuestion[]; documents: FormDocument[]; removedAt?: string | null };
  canEdit: boolean;
  questionsOnPlan: boolean;
  /** A season's form only (the sponsorship form has no sign-ups, no fixed sign-up fields and no earlier form to copy). */
  counts?: { children: number; signups: number };
  finished?: boolean;
  fixed?: { friendMax: number; askEmailConsent: boolean; clubName: string };
  season?: { id: string; name: string };
  copyFrom?: { seasonId: string; name: string; questions: number; documents: number } | null;
};

/** The club's sponsorship form (Board Ready Stage 6): its locked card, drawn by the caller. */
export type SponsorshipFormProps = { fixedCard: React.ReactNode; refusedTitle: string; lede: string; noQuestionsLine: string };

export default function SignupFormScreen({ orgSlug, seasonId = '', planId, sponsorship }: {
  orgSlug: string; seasonId?: string; planId: OrgPlan | undefined; sponsorship?: SponsorshipFormProps;
}) {
  const orgQuery = `?orgSlug=${encodeURIComponent(orgSlug)}`;
  // org-slug-ok: every call below appends `orgQuery` (?orgSlug=…) to apiBase, as the season's address does.
  const apiBase = sponsorship ? '/api/admin/sponsorships/form' : `/api/admin/house-league/seasons/${encodeURIComponent(seasonId)}/form`;
  const shape = sponsorship ? BUSINESS_FORM_SHAPE : SEASON_FORM_SHAPE;
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

  if (refused) return <LoadFailed title={sponsorship?.refusedTitle ?? 'This season’s sign-up form isn’t yours to open.'} />;
  if (!read) return loadError ? <LoadFailed title={loadError} onRetry={() => void refresh()} /> : <LoadingState label={W.loading} />;

  const { canEdit, questionsOnPlan } = read;
  const counts = read.counts ?? { children: 0, signups: 0 };
  const copyFrom = read.copyFrom ?? null;
  const fixed = read.fixed ?? { friendMax: 0, clubName: '', askEmailConsent: false };
  const fields = fixedFields(fixed.friendMax, fixed.clubName, fixed.askEmailConsent);
  const detailCount = fields.child.length + fields.guardian.length + fields.end.length;
  // Folded once the club has questions, and on a phone; the person's own Show / Hide wins after that.
  const folded = fixedOpen === null ? (liveQuestions.length > 0 || isPhone) : !fixedOpen;
  // The order the windows step through: each child's band, then once per sign-up (the list's own order).
  const stepOrder = shape.perSubject ? [...band('per_subject'), ...band('once')] : liveQuestions;

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
  // Board Ready Stage 4 Part 3 (drawing tab 8 · A): once the clock has removed a finished season's family files and health
  // answers, those questions say so in place of their count.
  const removedAt = read.form.removedAt ?? null;
  const questionCaptions = (q: FormQuestion) => removedAt && q.answers > 0 && (q.health || q.type === 'file')
    ? <>{[typeLabel(q.type), STAFF_FORM_WORDS.questionRemovedCaption(q.type, removedAt)].join(' · ')}</>
    : <><span className={f.deskOnly}>{questionCaption(q)}</span><span className={f.phoneOnly}>{questionCaption(q, true)}</span></>;

  const bandList = (asked: QuestionAsked) => {
    const qs = band(asked);
    if (qs.length === 0) return null;
    const label = ASKED_WORDS.find(a => a.value === asked)!.label;
    return (
      <>
        {/* One business answers the sponsorship form: one list, no bands. */}
        {shape.perSubject && <ClubRowBand count={qs.length}>{label}</ClubRowBand>}
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
    <>{d.name}<span className={f.rowMark}><RepChip tone="info">{d.source === 'pdf' ? 'PDF' : 'Text'}</RepChip></span></>
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
      {/* ── Every sign-up asks (locked; drawing tab 1) — or the business card the sponsorship form starts with ── */}
      {sponsorship ? sponsorship.fixedCard : folded ? (
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
      {/* The two adds are siblings: each sits in its card's header, whatever the card holds (owner 2026-11-23). */}
      <ClubSection id="form-questions" title={W.questionsTitle} meta={questionsOnPlan && liveQuestions.length > 0 ? questionsSummary(liveQuestions.length) : undefined}
        actions={questionsOnPlan && canEdit ? addButton(W.addQuestion, () => setOpenQ('new')) : undefined}>
        {!questionsOnPlan ? (
          <p className={f.small}>
            {W.planLocked}{' '}
            <Link href={getBillingHref({ slug: orgSlug, planId: planId ?? 'free' }, { host: 'admin' })}>{W.seePlans}</Link>
          </p>
        ) : liveQuestions.length === 0 ? (
          <div className={f.empty}>
            <p className={f.emptyTitle}>{W.noQuestions}</p>
            <p className={f.small}>{isPhone ? W.noQuestionsLinePhone : copyFrom && canEdit ? W.noQuestionsCopyLine : sponsorship?.noQuestionsLine ?? W.noQuestionsLine}</p>
            {canEdit && copyFrom && (
              <div className={f.emptyActions}>
                <button type="button" className="btn btn-outline" aria-haspopup="dialog" onClick={() => { setCopyError(''); setCopyAsk(true); }}>
                  {W.copyButton(copyFrom.name)}
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <p className={f.lede}>{sponsorship?.lede ?? W.lede}</p>
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
          <div className={f.empty}>
            <p className={f.emptyTitle}>{W.noDocuments}</p>
            <p className={f.small}>{questionsOnPlan ? W.documentsFoot : W.documentsEveryPlan}</p>
          </div>
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
        {liveDocuments.length > 0 && <p className={f.foot}>{questionsOnPlan ? W.documentsFoot : W.documentsEveryPlan}</p>}
      </ClubSection>

      <SavePill saving={orderSaving} dirty={false} error={orderError} held={null} onRetry={retryOrder} />

      {openQ && (openQ === 'new' || openQuestion) && (
        <QuestionWindow
          question={openQ === 'new' ? null : openQuestion}
          apiBase={`${apiBase}/questions`}
          orgQuery={orgQuery}
          canEdit={canEdit}
          counts={counts}
          shape={shape}
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
