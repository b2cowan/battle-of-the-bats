'use client';
/**
 * A lead's page on the screen (Support console Stage 7 Part 4; drawings A and C). The server half (`page.tsx`) hands
 * over finished sentences and times.
 *
 * Reads first, edits whole: the pencil flips every field staff own at once (step, why it was lost, source and its
 * detail, next action, follow-up, the club); the ✓ saves at once — no reason, no confirm window (owner Q6); the ✕ puts
 * everything back. Lost needs a reason: the ✓ refuses until one is picked and says so under the field. Email {first
 * name} keeps the three outreach templates, Mark contacted and Last contacted, unchanged in behaviour. Add a note opens
 * the kit window. A link is only ever a person's press: Link the club, or Not this club.
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Pencil, X } from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import UnsavedChangesGuard from '@/components/shared/UnsavedChangesGuard';
import DateInput from '@/components/shared/DateInput';
import KitDialog from '@/components/admin/kit/club/KitDialog';
import { CoachToolbarMenu, CoachToolbarMenuItem } from '@/components/coaches/CoachToolbarMenu';
import {
  EARLY_ACCESS_STATUS_LABELS, LEAD_SOURCE_LABELS, LEAD_SOURCES, LOST_REASON_LABELS, LOST_REASONS, PICKABLE_STATUSES,
  type EarlyAccessStatus,
} from '@/lib/early-access-admin';
import type { StepTone } from '@/lib/lead-views';
import type { TimelineEntry } from '@/lib/lead-timeline';
import { planLabel } from '@/lib/platform-labels';
import { errorOf, sendJson } from '../../console-fetch';
import RecordWindow from '../../RecordWindow';
import kit from '../../console.module.css';
import record from '../../record.module.css';
import styles from './lead.module.css';

export type LeadRecordProps = {
  id: string;
  title: string;
  step: EarlyAccessStatus;
  stepLabel: string;
  tone: StepTone;
  meta: string;
  firstName: string;
  email: string;
  organization: string | null;
  offers: { orgId: string; name: string; sentence: string; matchLine: string }[];
  offersNotRead: boolean;
  signedUp: { line: string; club: { id: string; name: string; sub: string } | null } | null;
  facts: {
    contact: string; contactSub: string; interest: string; interestSub: string | null; arrivedFrom: string; arrivedSub: string;
    source: string; sourceWords: string | null; lost: string | null; nextAction: string | null; followUp: string | null;
    lastContacted: string | null; words: string | null; sports: string | null;
  };
  form: { step: EarlyAccessStatus; lostReason: string; source: string; sourceWords: string; nextAction: string; followUpDueAt: string };
  linked: boolean;
  timeline: TimelineEntry[];
  timelineNotRead: boolean;
  canRemoveNotes: boolean;
};

const TONE: Record<StepTone, string> = { plain: '', ok: kit.chipOk, info: kit.chipInfo, warn: kit.chipWarn, bad: kit.chipBad, quiet: kit.chipQuiet };

const TEMPLATES = {
  league: { label: 'League Plus early access', text: `Subject: FieldLogicHQ League Plus early access\n\nHi {{name}},\n\nThanks for joining the League Plus early-access list. We are refining the house league workflow now and I would love to learn more about how {{organization}} manages registration, scheduling, communications, and public updates today.\n\nWould you be open to a short feedback call?` },
  club: { label: 'Club roadmap update', text: `Subject: FieldLogicHQ Club roadmap update\n\nHi {{name}},\n\nThanks for your interest in the Club tier. We are shaping the combined tournament, league, public site, accounting, and team workflows now, and your notes are helpful as we decide what should launch first.\n\nI will send updates as the release gets closer.` },
  feedback: { label: 'Feedback call', text: `Subject: Quick FieldLogicHQ feedback call\n\nHi {{name}},\n\nI saw your early-access request for {{organization}} and wanted to ask a few questions about what would make FieldLogicHQ useful for your program.\n\nWould a 20-minute call work sometime next week?` },
} as const;

type Win = 'discard' | 'note' | 'picker' | 'unlink' | { removeNote: string } | null;

export default function LeadRecord(p: LeadRecordProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [win, setWin] = useState<Win>(null);
  const [form, setForm] = useState(p.form);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lostError, setLostError] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const pencilRef = useRef<HTMLButtonElement>(null);

  const changed = (Object.keys(form) as (keyof typeof form)[]).some(k => form[k] !== p.form[k]);
  const stopEditing = () => { setEditing(false); setError(null); setLostError(false); requestAnimationFrame(() => pencilRef.current?.focus()); };

  async function save() {
    if (form.step === 'lost' && !form.lostReason) { setLostError(true); return; }
    if (!changed) { stopEditing(); return; }
    setSaving(true);
    setError(null);
    const { ok, data } = await sendJson(`/api/platform-admin/early-access/${p.id}`, 'PATCH', {
      ...(form.step !== p.form.step ? { step: form.step } : {}),
      ...(form.step === 'lost' ? { lostReason: form.lostReason } : {}),
      source: form.source || null,
      sourceWords: form.sourceWords,
      nextAction: form.nextAction,
      followUpDueAt: form.followUpDueAt || null,
    });
    setSaving(false);
    if (!ok) {
      if ((data as { field?: string } | null)?.field === 'lostReason') { setLostError(true); return; }
      setError(errorOf(data, 'That did not save. Try again in a moment.'));
      return;
    }
    setEditing(false);
    setNotice('Saved.');
    router.refresh();
  }

  const toggleEdit = () => {
    if (!editing) { setForm(p.form); setNotice(null); setEditing(true); return; }
    void save();
  };
  const discard = () => { if (!changed) stopEditing(); else setWin('discard'); };

  async function act(url: string, method: 'POST' | 'PATCH' | 'DELETE', body: unknown, done: string) {
    setError(null);
    const { ok, data } = await sendJson(url, method, body);
    if (!ok) { setError(errorOf(data, 'That did not go through. Try again in a moment.')); return false; }
    setNotice(done);
    router.refresh();
    return true;
  }

  async function copy(text: string, done: string) {
    try { await navigator.clipboard.writeText(text); setNotice(done); } catch { setError('Your browser did not let the page copy. Try again.'); }
  }
  const fill = (t: string) => t.replaceAll('{{name}}', p.firstName).replaceAll('{{organization}}', p.organization || 'your organization');

  useEffect(() => { if (!notice) return; const t = window.setTimeout(() => setNotice(null), 2600); return () => window.clearTimeout(t); }, [notice]);

  const field = (label: string, read: React.ReactNode, edit: React.ReactNode, opts: { req?: boolean; sub?: React.ReactNode } = {}) => (
    <div className={styles.fact}>
      <dt className={kit.bandLabel}>{label}{editing && opts.req && <span className={kit.req} aria-hidden>*</span>}</dt>
      <dd>{editing ? edit : <>{read}{opts.sub && <span className={kit.sub}>{opts.sub}</span>}</>}</dd>
    </div>
  );

  return (
    <div className={kit.page}>
      <AdminPageHeader
        backTo={{ href: '/platform-admin/early-access', label: 'Leads' }}
        title={p.title}
        titleChips={<span className={`${kit.chip} ${TONE[p.tone]}`}>{p.stepLabel}</span>}
        actions={(
          <span className={record.headActions}>
            <CoachToolbarMenu label={`Email ${p.firstName}`}>
              <CoachToolbarMenuItem label="Copy the address" hint={p.email} onSelect={() => void copy(p.email, 'Address copied.')} />
              {(Object.keys(TEMPLATES) as (keyof typeof TEMPLATES)[]).map(k => (
                <CoachToolbarMenuItem key={k} label={`Copy: ${TEMPLATES[k].label}`} onSelect={() => void copy(fill(TEMPLATES[k].text), `${TEMPLATES[k].label} copied.`)} />
              ))}
              <CoachToolbarMenuItem label="Mark contacted" hint="Today, by you" onSelect={() => void act(`/api/platform-admin/early-access/${p.id}`, 'PATCH', { markContacted: true }, 'Marked contacted.')} />
            </CoachToolbarMenu>
            <button type="button" className="btn btn-secondary" onClick={() => setWin('note')}>Add a note</button>
            <button type="button" ref={pencilRef} className={`${record.pencil}${editing ? ` ${record.pencilOn}` : ''}`} onClick={toggleEdit} disabled={saving}
              aria-label={editing ? 'Save the lead' : 'Edit the lead'} title={editing ? 'Save' : 'Edit'}>
              {editing ? <Check size={16} aria-hidden /> : <Pencil size={15} aria-hidden />}
            </button>
            {editing && (
              <button type="button" className={record.pencil} onClick={discard} aria-label="Discard changes and stop editing" title="Discard changes">
                <X size={16} aria-hidden />
              </button>
            )}
          </span>
        )}
      />

      <p className={styles.meta}>{p.meta}</p>
      {editing && <p className={record.caption}>Editing. Nothing changes until you press the check mark. The ✕ puts everything back.</p>}
      {notice && <div className={`${kit.notice} ${kit.noticeGood}`} role="status">{notice}</div>}
      {error && <div className={`${kit.notice} ${kit.noticeBad}`} role="alert">{error}</div>}

      {p.offers.map(o => (
        <div key={o.orgId} className={`${kit.callout} ${kit.calloutWarn} ${styles.offer}`}>
          <div>
            <strong>A club signed up with this lead’s email.</strong> {o.sentence} Is it this lead’s club?
            <span className={kit.sub}>{o.matchLine}</span>
          </div>
          <span className={styles.offerActions}>
            <button type="button" className="btn btn-outline" onClick={() => void act(`/api/platform-admin/early-access/${p.id}/dismiss`, 'POST', { orgId: o.orgId }, `${o.name} will not be offered again.`)}>Not this club</button>
            <button type="button" className="btn btn-lime" onClick={() => void act(`/api/platform-admin/early-access/${p.id}/link`, 'POST', { orgId: o.orgId, method: 'offered' }, `${o.name} is linked. The lead is Signed up.`)}>Link the club</button>
          </span>
        </div>
      ))}
      {p.offersNotRead && <p className={kit.caption}>The sign-up match could not be checked just now, so no club is offered here.</p>}

      {p.signedUp && (
        <div className={`${kit.callout} ${styles.signedUp}`}>
          <span>{p.signedUp.line}</span>
          {p.signedUp.club && <Link href={`/platform-admin/orgs/${p.signedUp.club.id}`} className={kit.door}>{p.signedUp.club.name} ›</Link>}
        </div>
      )}

      <div className={styles.layout}>
        <section className={kit.section}>
          <h2 className={kit.sectionTitle}>About this lead</h2>
          <dl className={`${kit.card} ${kit.cardPad} ${styles.facts}`}>
            {field('Contact', p.facts.contact, p.facts.contact, { sub: p.facts.contactSub })}
            {p.signedUp?.club && field('Signed up as', p.signedUp.club.name, p.signedUp.club.name, { sub: p.signedUp.club.sub })}
            {field('Interest', p.facts.interest, p.facts.interest, { sub: p.facts.interestSub })}
            {!p.signedUp && field('Arrived from', p.facts.arrivedFrom, p.facts.arrivedFrom, { sub: p.facts.arrivedSub })}
            {field('Step', p.stepLabel, p.linked ? (
              <span>{EARLY_ACCESS_STATUS_LABELS.converted}<span className={kit.sub}>A linked lead moves only by unlinking its club.</span></span>
            ) : (
              <select className={`${kit.select} ${form.step !== p.form.step ? record.changed : ''}`} aria-label="Step" value={form.step}
                onChange={e => { setForm(f => ({ ...f, step: e.target.value as EarlyAccessStatus })); setLostError(false); }}>
                {PICKABLE_STATUSES.map(s => <option key={s} value={s}>{EARLY_ACCESS_STATUS_LABELS[s]}</option>)}
              </select>
            ))}
            {(editing ? form.step === 'lost' : !!p.facts.lost) && field('Why it was lost', p.facts.lost, (
              <>
                <select className={`${kit.select} ${form.lostReason !== p.form.lostReason ? record.changed : ''}`} aria-label="Why it was lost" required
                  aria-invalid={lostError || undefined} aria-describedby={lostError ? 'lost-error' : undefined}
                  value={form.lostReason} onChange={e => { setForm(f => ({ ...f, lostReason: e.target.value })); setLostError(false); }}>
                  <option value="">Pick a reason</option>
                  {LOST_REASONS.map(r => <option key={r} value={r}>{LOST_REASON_LABELS[r]}</option>)}
                </select>
                {lostError && <span id="lost-error" className={kit.fieldError}>Pick why it was lost before saving.</span>}
              </>
            ), { req: true })}
            {field('Source', p.facts.source, (
              <select className={`${kit.select} ${form.source !== p.form.source ? record.changed : ''}`} aria-label="Source" value={form.source}
                onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
                <option value="">Not set</option>
                {LEAD_SOURCES.map(s => <option key={s} value={s}>{LEAD_SOURCE_LABELS[s]}</option>)}
              </select>
            ), { sub: p.facts.sourceWords })}
            {editing && field('Source detail', null, (
              <input className={`${kit.field} ${form.sourceWords !== p.form.sourceWords ? record.changed : ''}`} aria-label="Source detail" maxLength={500}
                value={form.sourceWords} onChange={e => setForm(f => ({ ...f, sourceWords: e.target.value }))} placeholder="Who told them, or where" />
            ))}
            {field('Next action', p.facts.nextAction ?? 'None', (
              <input className={`${kit.field} ${form.nextAction !== p.form.nextAction ? record.changed : ''}`} aria-label="Next action" maxLength={500}
                value={form.nextAction} onChange={e => setForm(f => ({ ...f, nextAction: e.target.value }))} />
            ))}
            {field('Follow-up', p.facts.followUp ?? 'None', (
              <DateInput className={`${kit.field} ${form.followUpDueAt !== p.form.followUpDueAt ? record.changed : ''}`} value={form.followUpDueAt}
                onChange={v => setForm(f => ({ ...f, followUpDueAt: v }))} />
            ))}
            {editing && field('Club or portal', null, p.linked ? (
              <button type="button" className={kit.door} onClick={() => setWin('unlink')}>Unlink the club</button>
            ) : (
              <button type="button" className={kit.door} onClick={() => setWin('picker')}>Link one by hand</button>
            ))}
            {!editing && field('Last contacted', p.facts.lastContacted ?? 'Never', null)}
            {!editing && p.facts.words && field('In their words', <q className={styles.words}>{p.facts.words}</q>, null)}
          </dl>
        </section>

        <section className={kit.section}>
          <h2 className={kit.sectionTitle}>Timeline <span className={kit.sectionLede}>Newest first</span></h2>
          <ol className={`${kit.card} ${styles.timeline}`}>
            {p.timelineNotRead && <li className={styles.quiet}>Part of this lead’s history could not be read just now.</li>}
            {p.timeline.map(t => (
              <li key={t.key} className={styles.turn}>
                <span className={styles.when}>{t.when}</span>
                <span className={styles.what}>
                  <span className={t.quiet ? styles.quiet : undefined}>{t.title}</span>
                  {t.sub && <span className={kit.sub}>{t.sub}</span>}
                  {t.body && <span className={styles.body}>{t.body}</span>}
                  {t.noteId && p.canRemoveNotes && (
                    <button type="button" className={`${kit.door} ${styles.remove}`} onClick={() => setWin({ removeNote: t.noteId! })}>Remove</button>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {win === 'discard' && (
        <RecordWindow title="Discard your changes" sentence={<>Your edits are dropped and this lead goes back to reading, exactly as it was. Nothing is saved.</>}
          cancelLabel="Keep editing" confirmLabel="Discard changes" askWhy={false}
          onConfirm={async () => { setWin(null); setForm(p.form); stopEditing(); return null; }} onClose={() => setWin(null)} />
      )}
      {win === 'unlink' && (
        <RecordWindow title="Unlink the club" sentence={<>The lead goes back to the step it was on before the link, and stops counting as Signed up. The timeline keeps both.</>}
          cancelLabel="Keep it linked" confirmLabel="Unlink" askWhy={false}
          onConfirm={async () => {
            const { ok, data } = await sendJson(`/api/platform-admin/early-access/${p.id}/link`, 'DELETE', {});
            if (!ok) return errorOf(data, 'That did not go through.');
            setWin(null); setEditing(false); setNotice('Unlinked.'); router.refresh(); return null;
          }}
          onClose={() => setWin(null)} />
      )}
      {typeof win === 'object' && win && 'removeNote' in win && (
        <RecordWindow title="Remove this note" sentence={<>The note’s words are gone for good. The timeline keeps who wrote it and when, and says “A note was removed”.</>}
          cancelLabel="Keep it" confirmLabel="Remove the note" askWhy={false}
          onConfirm={async () => {
            const { ok, data } = await sendJson(`/api/platform-admin/early-access/${p.id}/notes/${win.removeNote}`, 'DELETE', {});
            if (!ok) return errorOf(data, 'That did not go through.');
            setWin(null); setNotice('The note was removed.'); router.refresh(); return null;
          }}
          onClose={() => setWin(null)} />
      )}
      {win === 'note' && <NoteWindow leadId={p.id} title={p.title} onClose={() => setWin(null)} onDone={() => { setWin(null); setNotice('Note added.'); router.refresh(); }} />}
      {win === 'picker' && (
        <ClubPicker onClose={() => setWin(null)} onPick={async c => {
          const ok = await act(`/api/platform-admin/early-access/${p.id}/link`, 'POST', { orgId: c.id, method: 'by_hand' }, `${c.name} is linked. The lead is Signed up.`);
          if (ok) { setWin(null); setEditing(false); }
        }} />
      )}
      <UnsavedChangesGuard active={editing && changed} message="You have unsaved changes to this lead. Leave without saving them?" />
    </div>
  );
}

function NoteWindow({ leadId, title, onClose, onDone }: { leadId: string; title: string; onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function add() {
    if (!text.trim()) { setError('Write the note first.'); return; }
    setBusy(true);
    const { ok, data } = await sendJson(`/api/platform-admin/early-access/${leadId}/notes`, 'POST', { body: text });
    setBusy(false);
    if (!ok) { setError(errorOf(data, 'The note could not be saved.')); return; }
    onDone();
  }
  return (
    <KitDialog kind="form" title={`Add a note to ${title}`} onClose={onClose} busy={busy} dirty={!!text.trim()}
      footerStart={<span>Dated and signed with your name. It cannot be edited afterwards; a Super admin can remove it.</span>}
      footer={(
        <>
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={() => void add()} disabled={busy}>Add the note</button>
        </>
      )}>
      <label className={kit.fieldGroup}>
        <span className={kit.label}>Note<span className={kit.req} aria-hidden>*</span></span>
        <textarea className={kit.textarea} rows={5} maxLength={4000} required value={text}
          aria-invalid={error ? true : undefined} onChange={e => { setText(e.target.value); setError(null); }} />
        {error && <span className={kit.fieldError}>{error}</span>}
      </label>
    </KitDialog>
  );
}

type Club = { id: string; name: string; planId: string | null; status: string | null; joined: string | null };

function ClubPicker({ onClose, onPick }: { onClose: () => void; onPick: (c: Club) => Promise<void> }) {
  const [q, setQ] = useState('');
  const [clubs, setClubs] = useState<Club[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (q.trim().length < 2) return;
    const ctl = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/platform-admin/early-access/clubs?q=${encodeURIComponent(q.trim())}`, { signal: ctl.signal });
        const d = await res.json() as { clubs?: Club[]; error?: string };
        if (!res.ok) { setError(d.error ?? 'The clubs could not be searched just now.'); setClubs(null); return; }
        setError(null); setClubs(d.clubs ?? []);
      } catch { /* a newer search replaced this one */ }
    }, 250);
    return () => { ctl.abort(); window.clearTimeout(t); };
  }, [q]);
  return (
    <KitDialog kind="form" title="Link a club or portal by hand" onClose={onClose}
      footerStart={<span>Searches by name, like Find. Demo clubs and staff test clubs are never offered.</span>}
      footer={<button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>}>
      <input type="search" className={kit.search} aria-label="Search clubs by name" placeholder="Club or portal name" value={q} autoFocus
        onChange={e => { setQ(e.target.value); if (e.target.value.trim().length < 2) setClubs(null); }} />
      {error && <p className={kit.fieldError} role="alert">{error}</p>}
      {clubs && clubs.length === 0 && <p className={kit.muted}>No club by that name.</p>}
      {clubs && clubs.length > 0 && (
        <ul className={styles.picks}>
          {clubs.map(c => (
            <li key={c.id}>
              <button type="button" className={styles.pick} onClick={() => void onPick(c)}>
                <strong>{c.name}</strong>
                <span className={kit.sub}>{c.planId ? planLabel(c.planId) : 'No plan'}{c.status === 'trialing' ? ' · trial' : ''}{c.joined ? ` · joined ${c.joined}` : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </KitDialog>
  );
}
