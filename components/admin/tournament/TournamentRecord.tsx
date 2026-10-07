'use client';
/**
 * AN EVENT'S RECORD — Tournament admin redesign Stage 4 (D4, D5; A19–A22), built to hub v24, ruled
 * 2026-10-06. ONE record, opened from the one Tournaments list (D7, which replaced the two lists), in the admin
 * kit's form window: full screen with ← on a phone, a window at a desk. It READS first; the head's pencil
 * edits the Details whole (the 2026-10-01 standard). In order:
 *
 *   Status          what the status means for the public site and the slot, opening with the day it
 *                   finished, never repeating its chip; then the changes the status allows, each a white
 *                   button that ASKS FIRST in the kit's question window (A20 — the list's menu wrote on
 *                   change, F35). A change the plan or the data cannot make is said BEFORE the tap, in
 *                   place of its button: the slot a Bring back needs, the link a newer event took, the
 *                   dates / division / contact an Activate or a Reopen needs, a sealed event's results.
 *   Next year       Reuse this setup — the frame's one reuse step (D2) — or its lock line.
 *   Permanent record  Seal (asks first; "Sealing is permanent" moved here), or "Sealed ‹date› · its public
 *                   record ↗", or its lock line. A finished event only (the seal route takes completed or archived).
 *   Details         name · year · public link · dates. Edited whole: name, year and dates save as you go
 *                   (edit autosaves, 2026-09-24); the PUBLIC LINK saves only after a question, because a
 *                   change breaks every link already shared — never by a pause in typing.
 *   Delete          ends the body, alone, red, asking first; never while Active (as today).
 *   foot            the record before and after it in the list it was opened from, named, with the position.
 *
 * The routes stay the authority: a refusal that races (a slot taken a moment ago) shows in words.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import { RepChip, SavePill } from '@/components/admin/kit/club/RepKit';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import PlanLockLine from '@/components/admin/tournament/PlanLockLine';
import { RecordSection, screenParts } from '@/components/admin/tournament/ScreenParts';
import { useSetupWizard } from '@/components/admin/tournament/SetupWizardOpener';
import { useRecordAutosave } from '@/components/coaches/useRecordAutosave';
import { AFTER_EVENT_LOCK_PLAN, LIST_WORDS, NEXT_YEAR_WORDS } from '@/lib/after-event-words';
import {
  RECORD_WORDS as W, STATUS_ACTION, STATUS_WORD, statusConfirm, statusSentence, type StatusChange,
} from '@/lib/tournament-status-words';
import { formatEventDateRange, formatStoredDate, tournamentToday } from '@/lib/timezone';
import type { ListEvent } from '@/lib/tournament-lists';

export interface RecordPlan {
  canClone: boolean;
  canSeal: boolean;
  /** The plan's slot limit (9999 = unlimited). */
  limit: number;
  /** Plan & billing with the Tournament Plus panel asked for. */
  planHref: string;
  /** The club's own email — a contact Activate accepts. */
  orgContactEmail: string | null;
}

export interface TournamentRecordProps {
  event: ListEvent;
  sealed: { archiveId: string; sealedAt: string } | null;
  orgSlug: string;
  /** This member may change an event (create_tournaments). */
  canWrite: boolean;
  plan: RecordPlan;
  /** Mark complete will email the teams their results (the event's setting, the club's pause, sent once, the plan). */
  willEmailOnComplete: boolean;
  /** Every event that holds a slot (not archived), this one excluded. */
  slotHolders: ListEvent[];
  /** Another non-archived event now using this one's public link, if any. */
  linkTakenBy: string | null;
  prev: ListEvent | null;
  next: ListEvent | null;
  position: string;
  positionWide: string;
  onStep: (id: string) => void;
  onClose: () => void;
  /** A change landed: re-read the lists (and the frame's event list). */
  onChanged: () => Promise<void>;
}

type Form = { name: string; year: string; slug: string; startDate: string; endDate: string };
const formOf = (e: ListEvent): Form => ({
  name: e.name ?? '',
  year: e.year != null ? String(e.year) : '',
  slug: e.slug ?? '',
  startDate: e.startDate ?? '',
  endDate: e.endDate ?? '',
});
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** POST to an admin route; throws with the route's own words when it refuses. */
async function post(path: string, body: unknown, fallback: string, signal?: AbortSignal): Promise<void> {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
  const json = await res.json().catch(() => null) as { error?: string } | null;
  if (!res.ok) throw new Error(json?.error ?? fallback);
}
/** The status each change asks the route for. */
const STATUS_OF: Record<Exclude<StatusChange, 'seal' | 'delete'>, 'active' | 'completed' | 'draft' | 'archived'> = {
  activate: 'active', reopen: 'active', complete: 'completed', bringBack: 'completed', draft: 'draft', archive: 'archived',
};
const yearOk = (v: string) => { const n = Number(v); return Number.isInteger(n) && n >= 2000 && n <= 2100; };

export default function TournamentRecord(props: TournamentRecordProps) {
  const { event, sealed, plan, canWrite } = props;
  const { openReuse } = useSetupWizard();
  const finiteSlots = plan.limit < 9999;
  const today = tournamentToday();
  const orgQuery = `?orgSlug=${encodeURIComponent(props.orgSlug)}`;

  // ── The question window (every change asks first) ──
  const [ask, setAsk] = useState<StatusChange | 'link' | null>(null);
  const [busy, setBusy] = useState(false);
  const [askError, setAskError] = useState('');
  /** What to do once the link question is answered "Change the link" (✓, ✕, a step). */
  const afterLink = useRef<(() => void) | null>(null);

  // ── Details: read first, edited whole (the pencil) ──
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formFor, setFormFor] = useState(event.id);
  const [serverSig, setServerSig] = useState(() => JSON.stringify(formOf(event)));
  const [form, setForm] = useState<Form>(() => formOf(event));
  const [saved, setSaved] = useState<Form>(() => formOf(event));
  const [leaveError, setLeaveError] = useState('');
  const formRef = useRef(form);
  const savedRef = useRef(saved);
  const formForRef = useRef(formFor);
  useEffect(() => { formRef.current = form; savedRef.current = saved; formForRef.current = formFor; });
  const editing = canWrite && editingId === event.id;
  const changedAnything = useRef(false);

  // Name, year and dates save as you go; the link is held for its question.
  const held = !form.name.trim() ? W.nameHeld
    : !yearOk(form.year) ? W.yearHeld
      : form.startDate && form.endDate && form.endDate < form.startDate ? W.datesHeld
        : null;
  const fieldsSig = JSON.stringify({ n: form.name.trim(), y: form.year, s: form.startDate, e: form.endDate });
  const slugPending = form.slug.trim() !== saved.slug.trim();
  const slugValid = SLUG_RE.test(form.slug.trim());

  /** ONE save at a time (the autosave and a flush queue behind each other — Stage 2's record lesson). */
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const write = useCallback((includeSlug: boolean, signal?: AbortSignal) => {
    const id = event.id;
    const run = chain.current.catch(() => {}).then(async () => {
      if (formForRef.current !== id) return;
      const f = formRef.current;
      const s = savedRef.current;
      const data: Record<string, unknown> = {};
      if (f.name.trim() && f.name.trim() !== s.name.trim()) data.name = f.name.trim();
      if (yearOk(f.year) && f.year !== s.year) data.year = Number(f.year);
      const datesOk = !(f.startDate && f.endDate && f.endDate < f.startDate);
      if (datesOk && (f.startDate !== s.startDate || f.endDate !== s.endDate)) {
        data.startDate = f.startDate || null;
        data.endDate = f.endDate || null;
      }
      if (includeSlug && SLUG_RE.test(f.slug.trim()) && f.slug.trim() !== s.slug.trim()) data.slug = f.slug.trim();
      if (Object.keys(data).length === 0) return;
      await post(`/api/admin/tournaments${orgQuery}`, { action: 'update', id, data }, 'Couldn’t save', signal);
      if (formForRef.current !== id) return;
      changedAnything.current = true;
      const next: Form = {
        name: 'name' in data ? f.name.trim() : s.name,
        year: 'year' in data ? f.year : s.year,
        slug: 'slug' in data ? f.slug.trim() : s.slug,
        startDate: 'startDate' in data ? f.startDate : s.startDate,
        endDate: 'endDate' in data ? f.endDate : s.endDate,
      };
      savedRef.current = next;
      setSaved(next);
      setLeaveError('');
    });
    chain.current = run;
    return run;
  }, [event.id, orgQuery, setLeaveError]);
  const writeFields = useCallback((signal: AbortSignal) => write(false, signal), [write]);
  const { saving, dirty, saveError, touch, settle, handleSave } = useRecordAutosave({
    enabled: editing, loading: false, sig: fieldsSig, blocked: held, write: writeFields, failText: 'Couldn’t save',
  });

  // Stepped to another event, or this one was re-read with nothing unsaved: start from the server.
  const incoming = JSON.stringify(formOf(event));
  if (event.id !== formFor || (incoming !== serverSig && !dirty && !saving && !slugPending)) {
    if (event.id !== formFor) setEditingId(null);
    setFormFor(event.id);
    setServerSig(incoming);
    setForm(formOf(event));
    setSaved(formOf(event));
    setLeaveError('');
    settle();
  }
  const set = (patch: Partial<Form>) => { setForm(f => ({ ...f, ...patch })); setLeaveError(''); touch(); };

  /** Leaving (✕, ←, Previous, Next) or ✓ sends what is unsaved first; a changed public link asks first. */
  const flushThen = async (go: () => void) => {
    if (!editing) { go(); return; }
    try {
      await write(false);
      setLeaveError('');
      settle();
    } catch (e) {
      setLeaveError(e instanceof Error ? e.message : 'Couldn’t save');
      return;
    }
    if (formRef.current.slug.trim() !== savedRef.current.slug.trim()) {
      if (!SLUG_RE.test(formRef.current.slug.trim())) { setLeaveError(W.linkHeld); return; }
      afterLink.current = go;
      setAskError('');
      setAsk('link');
      return;
    }
    go();
  };
  const leave = (go: () => void) => void flushThen(async () => {
    if (changedAnything.current) { changedAnything.current = false; await props.onChanged(); }
    go();
  });
  const toggleEdit = () => {
    if (!editing) { setEditingId(event.id); return; }
    if (held) return;
    void flushThen(() => { setEditingId(null); });
  };

  // ── Doing a change, once its question is answered ──
  async function doChange(change: StatusChange) {
    setBusy(true);
    setAskError('');
    try {
      const refused = 'Something went wrong. Nothing was changed.';
      if (change === 'seal') await post(`/api/admin/seal-tournament${orgQuery}`, { tournamentId: event.id }, refused);
      else if (change === 'delete') await post(`/api/admin/tournaments${orgQuery}`, { action: 'delete', id: event.id }, refused);
      else await post(`/api/admin/tournaments${orgQuery}`, { action: 'set-status', id: event.id, data: { status: STATUS_OF[change] } }, refused);
      setAsk(null);
      await props.onChanged();
    } catch (err) {
      setAskError(err instanceof Error ? err.message : 'Something went wrong. Nothing was changed.');
    } finally {
      setBusy(false);
    }
  }

  const closeLinkAsk = () => { afterLink.current = null; setAsk(null); };

  async function doLinkChange() {
    setBusy(true);
    setAskError('');
    try {
      await write(true);
      const go = afterLink.current;
      closeLinkAsk();
      go?.();
    } catch (err) {
      setAskError(err instanceof Error ? err.message : 'Couldn’t save');
    } finally {
      setBusy(false);
    }
  }

  // ── What each status allows, and what is said before a tap ──
  const status = event.status;
  const missing: Array<'dates' | 'division' | 'contact'> = [];
  if (!event.startDate || !event.endDate) missing.push('dates');
  if (event.divisionCount === 0) missing.push('division');
  if (!event.defaultContactMemberId && !event.contactEmail && !plan.orgContactEmail) missing.push('contact');
  const slotFull = finiteSlots && props.slotHolders.length >= plan.limit;
  const askFor = (change: StatusChange) => () => { setAskError(''); setAsk(change); };
  const changeButton = (change: StatusChange) => (
    <button key={change} type="button" className={screenParts.plainButton} onClick={askFor(change)} disabled={busy}>
      {STATUS_ACTION[change]}
    </button>
  );

  const before = (line: string) => <p className={screenParts.recordBefore}>{line}</p>;
  let statusBefore: ReactNode = null;
  let statusButtons: ReactNode[] = [];
  if (status === 'draft') {
    if (missing.length > 0) statusBefore = before(W.blocked('activate', missing));
    else statusButtons = [changeButton('activate')];
  } else if (status === 'active') {
    statusButtons = [changeButton('complete'), changeButton('draft')];
  } else if (status === 'completed') {
    if (!sealed) {
      if (missing.length > 0) statusBefore = before(W.blocked('reopen', missing));
      else statusButtons.push(changeButton('reopen'));
    }
    statusButtons.push(changeButton('archive'));
  } else if (status === 'archived') {
    if (slotFull) {
      statusBefore = (
        <>
          {before(props.slotHolders.length === 1 ? W.slotFull(props.slotHolders[0].name) : W.slotsFull(plan.limit, props.slotHolders.length))}
          <PlanLockLine href={plan.planHref} plan={AFTER_EVENT_LOCK_PLAN}>{W.lockSlots}</PlanLockLine>
        </>
      );
    } else if (props.linkTakenBy) {
      statusBefore = before(W.linkTaken(props.linkTakenBy));
    } else {
      statusButtons = [changeButton('bringBack')];
    }
  }

  const dates = formatEventDateRange(event.startDate, event.endDate, true);
  const finished = status === 'completed' || status === 'archived';
  const identityLine = finished
    ? [dates ?? W.datesNotSet, LIST_WORDS.teams(event.teamsPlayed, true), `${event.gamesPlayed} ${event.gamesPlayed === 1 ? 'game' : 'games'}`].join(' · ')
    : [dates ?? W.datesNotSet, LIST_WORDS.teams(event.acceptedTeams)].join(' · ');
  const isPublic = status === 'active' || status === 'completed';
  const publicPath = saved.slug ? `/${props.orgSlug}/${saved.slug}` : null;

  const confirm = ask && ask !== 'link'
    ? statusConfirm(ask, {
      name: event.name, startDate: event.startDate, today, finiteSlots,
      willEmailTeams: props.willEmailOnComplete, canSeal: plan.canSeal, sealed: Boolean(sealed),
    })
    : null;

  return (
    <>
      <KitDialog
        kind="form"
        title={saved.name.trim() || event.name}
        ariaLabel={saved.name.trim() || event.name}
        identity={(
          <span className={screenParts.recordIdentity}>
            <RepChip>{STATUS_WORD[status]}</RepChip>
            <span>{identityLine}</span>
          </span>
        )}
        status={editing ? (
          <SavePill inline saving={saving} dirty={dirty} error={leaveError || saveError || null} held={held} onRetry={() => void handleSave()} />
        ) : undefined}
        edit={canWrite ? { editing, onToggle: toggleEdit, label: W.edit } : undefined}
        onClose={() => leave(props.onClose)}
        busy={busy}
        steps={{
          prev: props.prev ? { name: props.prev.name, onStep: () => leave(() => props.onStep(props.prev!.id)) } : null,
          next: props.next ? { name: props.next.name, onStep: () => leave(() => props.onStep(props.next!.id)) } : null,
          position: props.position,
          positionWide: props.positionWide,
          noun: W.noun,
        }}
      >
        <RecordSection title={W.status}>
          <p className={screenParts.recordText}>
            {statusSentence({ status, startDate: event.startDate, endDate: event.endDate, today, finiteSlots, sealed: Boolean(sealed) })}
          </p>
          {canWrite && statusBefore}
          {canWrite && statusButtons.length > 0 && <div className={screenParts.recordActions}>{statusButtons}</div>}
        </RecordSection>

        <RecordSection title={W.nextYear}>
          {plan.canClone ? (
            <div className={screenParts.recordActions}>
              <button
                type="button"
                className={screenParts.plainButton}
                onClick={() => leave(() => {
                  props.onClose();
                  openReuse({ id: event.id, name: event.name, year: event.year, status: event.status }, 'tournament_record');
                })}
              >
                {NEXT_YEAR_WORDS.reuse}
              </button>
              <span className={ck.hint}>{NEXT_YEAR_WORDS.recordCaption}</span>
            </div>
          ) : (
            <PlanLockLine href={plan.planHref} plan={AFTER_EVENT_LOCK_PLAN}>{W.lockReuse}</PlanLockLine>
          )}
        </RecordSection>

        {finished && (
          <RecordSection title={W.permanentRecord}>
            {!plan.canSeal ? (
              <PlanLockLine href={plan.planHref} plan={AFTER_EVENT_LOCK_PLAN}>{W.lockSeal}</PlanLockLine>
            ) : sealed ? (
              <p className={screenParts.recordText}>
                {W.sealed(formatStoredDate(sealed.sealedAt))} ·{' '}
                <a href={`/${props.orgSlug}/archives/${sealed.archiveId}`} target="_blank" rel="noopener noreferrer">{W.publicRecord} ↗</a>
              </p>
            ) : (
              <>
                <p className={screenParts.recordText}>{W.sealSentence}</p>
                {canWrite && <div className={screenParts.recordActions}>{changeButton('seal')}</div>}
              </>
            )}
          </RecordSection>
        )}

        <RecordSection title={W.details}>
          {editing ? (
            <div className={screenParts.recordFields}>
              <label className={`${ck.field} ${screenParts.recordFieldWide}`}>
                <span className={ck.label}>{W.name}</span>
                <input className={ck.input} value={form.name} maxLength={80} onChange={e => set({ name: e.target.value })} />
              </label>
              <label className={ck.field}>
                <span className={ck.label}>{W.year}</span>
                <input className={ck.input} type="number" inputMode="numeric" min="2000" max="2100" value={form.year} onChange={e => set({ year: e.target.value })} />
              </label>
              <label className={ck.field}>
                <span className={ck.label}>{W.publicLink}</span>
                <input
                  className={ck.input}
                  value={form.slug}
                  onChange={e => { setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-') })); setLeaveError(''); }}
                />
                <span className={ck.hint}>{slugPending && !slugValid ? W.linkHeld : W.linkWarning}</span>
              </label>
              <label className={ck.field}>
                <span className={ck.label}>{W.startDate}</span>
                <input className={ck.input} type="date" value={form.startDate} onChange={e => set({ startDate: e.target.value })} />
              </label>
              <label className={ck.field}>
                <span className={ck.label}>{W.endDate}</span>
                <input className={ck.input} type="date" value={form.endDate} min={form.startDate || undefined} onChange={e => set({ endDate: e.target.value })} />
              </label>
            </div>
          ) : (
            <dl className={screenParts.recordFacts}>
              <div><dt>{W.name}</dt><dd>{saved.name}</dd></div>
              <div><dt>{W.year}</dt><dd>{saved.year || '—'}</dd></div>
              <div>
                <dt>{W.publicLink}</dt>
                <dd>{publicPath ? (isPublic ? <a href={publicPath} target="_blank" rel="noopener noreferrer">{publicPath} ↗</a> : publicPath) : '—'}</dd>
              </div>
              <div><dt>{W.dates}</dt><dd>{formatEventDateRange(saved.startDate || null, saved.endDate || null, true) ?? W.datesNotSet}</dd></div>
            </dl>
          )}
        </RecordSection>

        {canWrite && status !== 'active' && (
          <RecordSection>
            <button type="button" className={screenParts.recordDelete} onClick={askFor('delete')} disabled={busy}>{W.deleteTournament}</button>
          </RecordSection>
        )}
      </KitDialog>

      {confirm && (
        <KitDialog
          kind="question"
          title={confirm.title}
          onClose={() => { if (!busy) setAsk(null); }}
          busy={busy}
          footer={(
            <>
              <button type="button" className="btn btn-outline" onClick={() => setAsk(null)} disabled={busy}>Cancel</button>
              <button type="button" className={`btn ${confirm.danger ? 'btn-danger' : 'btn-lime'}`} onClick={() => void doChange(ask as StatusChange)} disabled={busy}>
                {confirm.action}
              </button>
            </>
          )}
        >
          <p>{confirm.body}</p>
          {askError && <p className={screenParts.recordBefore} role="alert">{askError}</p>}
        </KitDialog>
      )}

      {ask === 'link' && (
        <KitDialog
          kind="question"
          title={W.linkQuestion}
          onClose={() => { if (!busy) closeLinkAsk(); }}
          busy={busy}
          footer={(
            <>
              <button type="button" className="btn btn-outline" onClick={closeLinkAsk} disabled={busy}>Cancel</button>
              <button type="button" className="btn btn-danger" onClick={() => void doLinkChange()} disabled={busy}>{W.linkQuestionAction}</button>
            </>
          )}
        >
          <p>{W.linkQuestionBody(`/${props.orgSlug}/${saved.slug}`, `/${props.orgSlug}/${form.slug.trim()}`)}</p>
          {askError && <p className={screenParts.recordBefore} role="alert">{askError}</p>}
        </KitDialog>
      )}
    </>
  );
}
