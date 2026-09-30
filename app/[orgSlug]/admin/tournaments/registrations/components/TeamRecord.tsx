'use client';
/**
 * A TEAM'S RECORD (Tournament admin redesign Stage 2, T3 — F45; ruled 2026-09-30 as drawn, hub v16).
 * The whole row opens it in the admin kit's FORM window: full screen with ← on a phone (the phone's
 * Back closes it; a form covers the nav), a window at a desk. In order:
 *
 *   the name AS the title (its one editor — no separate name field, no required marker; an empty name
 *   is refused in words and never sent), one status chip + where it sits, the transient "Saved";
 *   a DECISION first for a team that needs one (waiting, or waitlisted): Accept is the record's one lime;
 *   PAYMENT first for an accepted team — facts, not narration — with Check-in's own "Mark paid · $475";
 *   the coach; the team's details, saving as you go (edit autosaves, 2026-09-24 — the Edit window
 *   retires); admin notes; registration answers; the Registration block (Reject, and what it frees);
 *   Delete ENDS the body, alone, red, asking first; the foot names the team before and after it in the
 *   list it was opened from, with the position (the 2026-09-30 decision; KitDialog `steps`).
 *
 * Nothing new is offered: every action here existed in today's fold. The questions (Accept, Reject,
 * Delete…) are the page's, opened as the kit's question window ON TOP of this one.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import KitDialog, { KitTitleField } from '@/components/admin/kit/club/KitDialog';
import { RepChip, RowAction, SavePill } from '@/components/admin/kit/club/RepKit';
import ck from '@/components/admin/kit/club/ClubKit.module.css';
import PlanLockLine from '@/components/admin/tournament/PlanLockLine';
import { RecordSection, screenParts } from '@/components/admin/tournament/ScreenParts';
import { useRecordAutosave } from '@/components/coaches/useRecordAutosave';
import { formatStoredDate } from '@/lib/timezone';
import { TEAM_RECORD_WORDS as W, TEAM_STATUS_CHIP, TEAMS_LOCK_PLAN, TEAMS_WORDS } from '@/lib/registration-words';
import { formatPoolName } from '@/lib/utils';
import { formatMoney, owedAmount, paymentLine, type FeeSchedule, type PoolInfo, type PoolSlot, type TeamRecord } from '@/lib/tournament-teams';
import styles from '../teams-admin.module.css';

export type TeamRecordUpdates = Partial<{
  name: string; coach: string; email: string; seed: number | null;
  depositPaid: number; totalPaid: number; adminNotes: string; poolId: string;
}>;

type Form = { name: string; coach: string; email: string; seed: string; depositPaid: string; totalPaid: string; adminNotes: string; poolId: string };

function formOf(t: TeamRecord): Form {
  return {
    name: t.name ?? '',
    coach: t.coach ?? '',
    email: t.email ?? '',
    seed: typeof t.seed === 'number' ? String(t.seed) : '',
    depositPaid: t.depositPaid ? String(t.depositPaid) : '',
    totalPaid: t.totalPaid ? String(t.totalPaid) : '',
    adminNotes: t.adminNotes ?? '',
    poolId: t.poolId ?? '',
  };
}

const money = (v: string) => { const n = parseFloat(v); return Number.isFinite(n) && n > 0 ? n : 0; };
const seedOf = (v: string): number | null => { const n = parseInt(v, 10); return Number.isInteger(n) && n > 0 && n <= 999 ? n : null; };
/** Empty, or a whole address (the Add team form's own test). The email is the team's sign-in key. */
const emailOk = (v: string) => !v.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

/** What changed between the saved record and the form — the only fields the save sends. An empty
 *  name and half an email are never sent (the save word says why). */
function changes(form: Form, saved: Form): TeamRecordUpdates {
  const u: TeamRecordUpdates = {};
  if (form.name.trim() && form.name.trim() !== saved.name.trim()) u.name = form.name.trim();
  if (form.coach.trim() !== saved.coach.trim()) u.coach = form.coach.trim();
  if (emailOk(form.email) && form.email.trim() !== saved.email.trim()) u.email = form.email.trim();
  if (seedOf(form.seed) !== seedOf(saved.seed)) u.seed = seedOf(form.seed);
  if (money(form.depositPaid) !== money(saved.depositPaid)) u.depositPaid = money(form.depositPaid);
  if (money(form.totalPaid) !== money(saved.totalPaid)) u.totalPaid = money(form.totalPaid);
  if (form.adminNotes !== saved.adminNotes) u.adminNotes = form.adminNotes;
  if (form.poolId !== saved.poolId) u.poolId = form.poolId;
  return u;
}

export interface TeamRecordProps {
  team: TeamRecord;
  divisionName: string;
  /** The spot the team holds, if any. */
  slot: PoolSlot | null;
  poolName: string | null;
  fee: FeeSchedule;
  today: string;
  /** False while the event is locked (completed): read-only, the plain name, no actions. */
  canWrite: boolean;
  /** Seed feeds only the playoff bracket's "By seed number" — absent for an Exhibition. */
  showSeed: boolean;
  /** A division with pools and no slots: the in-row pool picker moved here (T6). */
  poolChoices: PoolInfo[] | null;
  /** The division plays on pool slots. */
  slotDivision: boolean;
  /** Slots filled / slots in all (a slot division), for the full-division sentence. */
  slotFill: { filled: number; total: number } | null;
  /** A spot is open in the division right now. */
  openSpot: boolean;
  /** Promote / Place — Tournament Plus (`waitlist_automation`). */
  canPlace: boolean;
  planHref: string;
  isOwnTeam: boolean;
  /** League/Club organizations: today's rep-team picker, as the Coach block's "Rep team" line (T7). */
  repLink: ReactNode | null;
  prev: TeamRecord | null;
  next: TeamRecord | null;
  position: string;
  positionWide: string;
  busy: boolean;
  onStep: (teamId: string) => void;
  onClose: () => void;
  onSave: (teamId: string, updates: TeamRecordUpdates, signal?: AbortSignal) => Promise<void>;
  onAccept: (team: TeamRecord) => void;
  onReject: (team: TeamRecord) => void;
  onPromote: (team: TeamRecord) => void;
  onMarkPaid: (team: TeamRecord) => void;
  onMarkUnpaid: (team: TeamRecord) => void;
  onResend: (team: TeamRecord) => void;
  onDelete: (team: TeamRecord) => void;
}

/** The fields the server holds — when the team is re-read (a Mark paid, another screen) and the form
 *  holds nothing unsaved, the form takes the new values. */
const serverSigOf = (t: TeamRecord) => JSON.stringify(formOf(t));

export default function TeamRecordWindow(props: TeamRecordProps) {
  const { team, canWrite } = props;

  // ── The record's one form, re-seeded when the window steps to another team or the team is re-read ──
  const [formTeam, setFormTeam] = useState(team.id);
  const [serverSig, setServerSig] = useState(() => serverSigOf(team));
  const [form, setForm] = useState<Form>(() => formOf(team));
  const [saved, setSaved] = useState<Form>(() => formOf(team));
  const [leaveError, setLeaveError] = useState('');
  const formRef = useRef(form);
  const savedRef = useRef(saved);
  // Whose form this is, as last drawn — a save that lands after a step must not re-base the next team.
  const formTeamRef = useRef(formTeam);
  // The page hands a new onSave each render; the autosave reads the latest through a ref so its timer
  // is not restarted by every re-render of the list behind the window.
  const onSaveRef = useRef(props.onSave);
  useEffect(() => { formRef.current = form; savedRef.current = saved; formTeamRef.current = formTeam; onSaveRef.current = props.onSave; });

  const nameEmpty = !form.name.trim();
  const held = nameEmpty ? W.nameHeld : !emailOk(form.email) ? W.emailHeld : null;
  const sig = JSON.stringify(form);

  /** ONE save at a time. The autosave and a leave or an action queue behind whichever save is in
   *  flight, so each sends only what the one before it did not — two saves of one field can never land
   *  out of order, and a leave never re-sends what the autosave is already sending (/review 2026-09-30). */
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const write = useCallback((signal?: AbortSignal) => {
    const id = team.id;
    const run = chain.current.catch(() => {}).then(async () => {
      if (formTeamRef.current !== id) return;
      const f = formRef.current;
      const u = changes(f, savedRef.current);
      if (Object.keys(u).length > 0) await onSaveRef.current(id, u, signal);
      if (formTeamRef.current !== id) return;
      // The SAVED record moves (a held name or email stays as it was); the form is never reset, so
      // keystrokes typed during the save stay.
      const s = savedRef.current;
      const next = { ...f, name: f.name.trim() ? f.name : s.name, email: emailOk(f.email) ? f.email : s.email };
      savedRef.current = next;
      setSaved(next);
    });
    chain.current = run;
    return run;
  }, [team.id]);
  const { saving, dirty, saveError, touch, settle, handleSave } = useRecordAutosave({
    enabled: canWrite, loading: false, sig, blocked: held,
    write, failText: 'Couldn’t save',
  });

  const incoming = serverSigOf(team);
  if (team.id !== formTeam || (incoming !== serverSig && !dirty && !saving)) {
    // Stepped to another team, or this one was re-read with nothing unsaved: start from the server.
    setFormTeam(team.id);
    setServerSig(incoming);
    setForm(formOf(team));
    setSaved(formOf(team));
    setLeaveError('');
    settle();
  }

  const set = (patch: Partial<Form>) => { setForm(f => ({ ...f, ...patch })); setLeaveError(''); touch(); };

  /** Leaving (Back, ✕, Previous, Next) and every action here (Accept, Mark paid…) send what is unsaved
   *  first — an empty name or half an email keeps the saved one — and stay put, with the reason in the
   *  save word, if that save fails. So a Mark paid can never be undone by a figure typed a moment
   *  before it. It skips the autosave's HOLD on purpose: that holds every field while the name is empty
   *  (right while typing), which would trap an organizer who cleared the name and then stepped away. */
  const flushThen = async (go: () => void) => {
    if (!canWrite) { go(); return; }
    const f = formRef.current;
    try {
      await write();
      setLeaveError('');
      // Nothing typed since, and nothing held: the autosave has nothing left to send (and its last
      // failure, if any, is answered).
      if (formRef.current === f && f.name.trim() && emailOk(f.email)) settle();
      go();
    } catch (e) {
      setLeaveError(e instanceof Error ? e.message : 'Couldn’t save');
    }
  };

  const t = team;
  const chip = TEAM_STATUS_CHIP[t.status];
  const placed = props.slot != null;
  const where = t.status === 'pending'
    ? [props.divisionName, TEAMS_WORDS.registeredOn(formatStoredDate(t.registered_at))]
    : [props.slot?.displayName, props.poolName, props.divisionName].filter(Boolean) as string[];
  const identity = (
    <span className={styles.recordIdentity}>
      <RepChip tone={chip.tone}>{chip.label}</RepChip>
      <span>{where.join(' · ')}</span>
      {props.isOwnTeam && <RepChip>{W.yourTeam}</RepChip>}
    </span>
  );

  const line = paymentLine(t, props.fee, props.today);
  const owed = owedAmount(t, props.fee);

  // ── The decision / registration sentence, true in every case it can be read ──
  let sentence: string | null = null;
  if (t.status === 'pending') {
    if (placed) sentence = W.holdsSpot(t.name, props.slot!.displayName);
    else if (props.slotDivision && props.openSpot) sentence = W.placesInNext(t.name);
    else if (props.slotDivision && props.slotFill) sentence = W.fullNeedsSpot(props.divisionName, props.slotFill.filled, props.slotFill.total, t.name);
  } else if (t.status === 'waitlist') {
    sentence = W.onWaitlist(t.waitlistPosition ?? null) + (props.openSpot && !placed ? ` ${W.spotOpenNow}` : '');
  } else if (t.status === 'accepted') {
    sentence = placed ? W.acceptedFrees(props.slot!.displayName) : props.slotDivision ? W.acceptedNeedsSpot : W.accepted;
  } else {
    sentence = W.rejected;
  }
  const needsSpot = t.status === 'accepted' && props.slotDivision && !placed;
  const waitlistedOut = t.status === 'waitlist' && !placed;
  // Promote (a waitlisted team) / Place (an accepted team that needs a spot): only with a spot open,
  // only on Tournament Plus — the Tournament plan sees the plan's lock line (owner P1).
  const placeAction = props.openSpot && (waitlistedOut || needsSpot)
    ? (props.canPlace
      ? <RowAction onClick={() => void flushThen(() => props.onPromote(t))} disabled={props.busy}>{waitlistedOut ? TEAMS_WORDS.promote : TEAMS_WORDS.place}</RowAction>
      : <PlanLockLine href={props.planHref} plan={TEAMS_LOCK_PLAN}>{waitlistedOut ? W.lockPromote : W.lockPlace}</PlanLockLine>)
    : null;
  const decides = t.status === 'pending' || t.status === 'waitlist';

  const decisionBlock = canWrite && decides && (
    <RecordSection title={W.decision}>
      {sentence && <p className={screenParts.recordText}>{sentence}</p>}
      <div className={screenParts.recordActions}>
        <button type="button" className={`btn btn-lime ${styles.recordGrow}`} onClick={() => void flushThen(() => props.onAccept(t))} disabled={props.busy}>{TEAMS_WORDS.accept}</button>
        <button type="button" className={screenParts.plainButton} onClick={() => void flushThen(() => props.onReject(t))} disabled={props.busy}>{W.reject}</button>
      </div>
      {placeAction && <div className={styles.recordPlace}>{placeAction}</div>}
    </RecordSection>
  );

  const registrationBlock = canWrite && !decides && (
    <RecordSection title={W.registration}>
      {sentence && <p className={screenParts.recordText}>{sentence}</p>}
      {placeAction && <div className={styles.recordPlace}>{placeAction}</div>}
      <div className={screenParts.recordActions}>
        {t.status === 'rejected'
          ? <button type="button" className={screenParts.plainButton} onClick={() => void flushThen(() => props.onAccept(t))} disabled={props.busy}>{TEAMS_WORDS.accept}</button>
          : <button type="button" className={screenParts.plainButton} onClick={() => void flushThen(() => props.onReject(t))} disabled={props.busy}>{W.reject}</button>}
      </div>
    </RecordSection>
  );

  const paymentBlock = t.status === 'accepted' && (
    <RecordSection title={W.payment}>
      {line ? (
        <p className={screenParts.recordText}>
          <span className={line.owes ? styles.owes : undefined}>{line.lead}</span>
          {line.rest.map(r => <span key={r}> · {r}</span>)}
        </p>
      ) : (
        <p className={screenParts.recordText}>
          <span className={t.paymentStatus === 'paid' ? undefined : styles.owes}>{t.paymentStatus === 'paid' ? TEAMS_WORDS.paid : TEAMS_WORDS.unpaid}</span>
        </p>
      )}
      {canWrite && (line ? owed > 0 : true) && (
        <div className={styles.recordWide}>
          {line || t.paymentStatus !== 'paid'
            ? <RowAction onClick={() => void flushThen(() => props.onMarkPaid(t))} disabled={props.busy}>{W.markPaid(line ? formatMoney(owed) : null)}</RowAction>
            : <button type="button" className={screenParts.plainButton} onClick={() => void flushThen(() => props.onMarkUnpaid(t))} disabled={props.busy}>{W.markUnpaid}</button>}
        </div>
      )}
      {line && (
        <div className={styles.recordFields}>
          <label className={ck.field}>
            <span className={ck.label}>{W.depositPaidField}</span>
            <input className={ck.input} type="number" inputMode="decimal" min="0" step="0.01" placeholder="$0"
              value={form.depositPaid} disabled={!canWrite} onChange={e => set({ depositPaid: e.target.value })} />
          </label>
          <label className={ck.field}>
            <span className={ck.label}>{W.totalPaidField}</span>
            <input className={ck.input} type="number" inputMode="decimal" min="0" step="0.01" placeholder="$0"
              value={form.totalPaid} disabled={!canWrite} onChange={e => set({ totalPaid: e.target.value })} />
          </label>
        </div>
      )}
    </RecordSection>
  );

  return (
    <KitDialog
      kind="form"
      title={canWrite
        ? <KitTitleField value={form.name} onChange={v => set({ name: v })} label={W.nameLabel} />
        : t.name}
      ariaLabel={saved.name.trim() || t.name}
      identity={identity}
      status={canWrite ? (
        <SavePill inline saving={saving} dirty={dirty} error={leaveError || saveError || null}
          held={held} onRetry={() => void handleSave()} />
      ) : undefined}
      onClose={() => void flushThen(props.onClose)}
      steps={{
        prev: props.prev ? { name: props.prev.name, onStep: () => void flushThen(() => props.onStep(props.prev!.id)) } : null,
        next: props.next ? { name: props.next.name, onStep: () => void flushThen(() => props.onStep(props.next!.id)) } : null,
        position: props.position,
        positionWide: props.positionWide,
        noun: W.noun,
      }}
    >
      {decisionBlock}
      {paymentBlock}

      <RecordSection title={W.coach}>
        <dl className={styles.recordFacts}>
          {t.coach?.trim() && (
            <div><dt>{W.headCoach}</dt><dd>{t.coach.trim()}{t.coach_email?.trim() && <> · <a href={`mailto:${t.coach_email.trim()}`}>{t.coach_email.trim()}</a></>}</dd></div>
          )}
          <div><dt>{W.registeredBy}</dt><dd>{t.email ? <a href={`mailto:${t.email}`}>{t.email}</a> : W.noEmail}</dd></div>
          <div><dt>{W.registered}</dt><dd>{formatStoredDate(t.registered_at)}</dd></div>
          {props.repLink && <div><dt>{W.repTeam}</dt><dd>{props.repLink}</dd></div>}
        </dl>
        {canWrite && t.email?.trim() && (
          <div className={screenParts.recordActions}>
            <button type="button" className={screenParts.plainButton} onClick={() => void flushThen(() => props.onResend(t))} disabled={props.busy}>{W.resendAccess}</button>
          </div>
        )}
      </RecordSection>

      <RecordSection title={W.details}>
        <div className={styles.recordFields}>
          <label className={ck.field}>
            <span className={ck.label}>{W.coachField}</span>
            <input className={ck.input} value={form.coach} disabled={!canWrite} onChange={e => set({ coach: e.target.value })} />
          </label>
          <label className={ck.field}>
            <span className={ck.label}>{W.emailField}</span>
            <input className={ck.input} type="email" value={form.email} disabled={!canWrite} onChange={e => set({ email: e.target.value })} placeholder="coach@example.com" />
          </label>
        </div>
        {(props.showSeed || props.poolChoices) && (
          <div className={styles.recordFields}>
            {props.showSeed && (
              <label className={ck.field}>
                <span className={ck.label}>{W.seedField}</span>
                <input className={ck.input} type="number" min="1" max="999" step="1" inputMode="numeric" placeholder={W.seedPlaceholder}
                  value={form.seed} disabled={!canWrite} onChange={e => set({ seed: e.target.value })} />
                <span className={ck.hint}>{W.seedHint}</span>
              </label>
            )}
            {props.poolChoices && (
              <label className={ck.field}>
                <span className={ck.label}>{W.poolField}</span>
                <select className={ck.select} value={form.poolId} disabled={!canWrite} onChange={e => set({ poolId: e.target.value })}>
                  <option value="">{TEAMS_WORDS.noPoolYet}</option>
                  {props.poolChoices.map(p => <option key={p.id} value={p.id}>{formatPoolName(p.name)}</option>)}
                </select>
              </label>
            )}
          </div>
        )}
      </RecordSection>

      <RecordSection title={W.notes}>
        <textarea className={ck.textarea} aria-label={W.notes} placeholder={W.notesPlaceholder}
          value={form.adminNotes} disabled={!canWrite} onChange={e => set({ adminNotes: e.target.value })} />
      </RecordSection>

      {t.customAnswers && t.customAnswers.length > 0 && (
        <RecordSection title={W.answers}>
          <dl className={styles.recordFacts}>
            {t.customAnswers.map(a => <div key={a.fieldId}><dt>{a.label}</dt><dd>{a.value || '—'}</dd></div>)}
          </dl>
        </RecordSection>
      )}

      {registrationBlock}

      {canWrite && (
        <RecordSection>
          <button type="button" className={styles.recordDelete} onClick={() => void flushThen(() => props.onDelete(t))} disabled={props.busy}>{W.deleteTeam}</button>
        </RecordSection>
      )}
    </KitDialog>
  );
}
