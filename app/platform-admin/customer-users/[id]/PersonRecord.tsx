'use client';
/**
 * A person's record, on the screen (Support console Stage 2; the server half is `page.tsx`).
 *
 * Reads first; one pencil turns the name and email into fields, and the check mark confirms in one sentence and asks why
 * (A6). Send a reset link is the everyday action (a white button: it is what "can't sign in" usually ends in). The rare
 * doors — Sign out everywhere, Ban this person, Delete this person — end the Account tab, each its own window with a
 * reason. Every window that reaches an inbox says it cannot be taken back. A role without the power sees none of it (R6).
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Pencil, X } from 'lucide-react';
import AdminPageHeader from '@/components/admin/AdminPageHeader';
import UnsavedChangesGuard from '@/components/shared/UnsavedChangesGuard';
import type { StoryEntry } from '@/lib/platform-story-view';
import { consoleClock, consoleDate } from '@/lib/console-dates';
import { rememberConsoleRecent } from '@/lib/console-recent';
import { humanize } from '@/lib/platform-labels';
import { roleEmailLabel, roleLabel } from '@/lib/member-access';
import { errorOf, sendJson } from '../../console-fetch';
import { personStatusChip } from '../../chips';
import StoryTable from '../../StoryTable';
import RecordWindow from '../../RecordWindow';
import { PersonEmailsTab, type PersonEmails } from '../../sent-emails/SentParts';
import LinkRow from '../../LinkRow';
import kit from '../../console.module.css';
import styles from '../../record.module.css';

export type PersonRecordProps = {
  person: {
    id: string; email: string; name: string | null; lastSignInAt: string | null; createdAt: string | null;
    emailConfirmed: boolean; status: 'active' | 'unconfirmed' | 'banned';
  };
  clubs: Array<{ id: string; name: string; slug: string; planLabel: string; role: string; status: string }>;
  story: StoryEntry[];
  /** The person's emails; null for a role without the sent-log power (no tab at all). */
  emails: PersonEmails | null;
  can: { support: boolean; delete: boolean };
};

type Tab = 'story' | 'clubs' | 'account' | 'emails';
type Window = 'save' | 'discard' | 'reset' | 'note' | 'confirm' | 'signOut' | 'ban' | 'unban' | 'delete' | null;

/** One call; null when it went through, else the server's sentence. */
async function post(url: string, method: string, body: unknown): Promise<string | null> {
  const { ok, data } = await sendJson(url, method, body);
  return ok ? null : errorOf(data, 'That did not go through. Try again in a moment.');
}

export default function PersonRecord({ person, clubs, story, emails, can }: PersonRecordProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('story');
  const [editing, setEditing] = useState(false);
  const [win, setWin] = useState<Window>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({ name: person.name ?? '', email: person.email });

  useEffect(() => { rememberConsoleRecent({ kind: 'person', id: person.id, title: person.email }); }, [person.id, person.email]);

  const api = `/api/platform-admin/users/${person.id}`;
  const nameChanged = form.name.trim() !== (person.name ?? '');
  const emailChanged = form.email.trim().toLowerCase() !== person.email;
  const done = (message: string | null = null) => { setWin(null); setNotice(message); router.refresh(); };

  const toggleEdit = () => {
    if (!editing) { setForm({ name: person.name ?? '', email: person.email }); setNotice(null); setEditing(true); return; }
    if (!nameChanged && !emailChanged) { setEditing(false); return; }
    setWin('save');
  };

  /** The ✕ beside the check mark: back to reading without saving. Nothing held leaves at once; held changes ask once. */
  const discardEdit = () => {
    if (!nameChanged && !emailChanged) { stopEditing(); return; }
    setWin('discard');
  };
  /** The ✕ unmounts as editing ends, so focus goes back to the pencil rather than falling to the top of the page. */
  const pencilRef = useRef<HTMLButtonElement>(null);
  const stopEditing = () => { setEditing(false); requestAnimationFrame(() => pencilRef.current?.focus()); };

  const owned = clubs.find(c => c.role === 'owner');
  // The People list's own colours (one rule, `personStatusChip`), in the record's words.
  const chipWord = person.status === 'banned' ? 'Banned' : person.emailConfirmed ? 'Email confirmed' : 'Email not confirmed';
  const chip = <span className={`${kit.chip} ${personStatusChip(person.status)}`}>{chipWord}</span>;

  return (
    <div className={kit.page}>
      <AdminPageHeader
        backTo={{ href: '/platform-admin/customer-users', label: 'People' }}
        title={person.email}
        titleChips={chip}
        actions={can.support ? (
          <span className={styles.headActions}>
            <button type="button" ref={pencilRef} className={`${styles.pencil}${editing ? ` ${styles.pencilOn}` : ''}`} onClick={toggleEdit}
              aria-label={editing ? 'Done editing — review the changes' : 'Edit this person'} title={editing ? 'Done editing' : 'Edit'}>
              {editing ? <Check size={16} aria-hidden /> : <Pencil size={15} aria-hidden />}
            </button>
            {editing && (
              <button type="button" className={styles.pencil} onClick={discardEdit} aria-label="Discard changes and stop editing" title="Discard changes">
                <X size={16} aria-hidden />
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={() => setWin('reset')}>Send a reset link</button>
            <button type="button" className="btn btn-secondary" onClick={() => setWin('note')}>Add a note</button>
          </span>
        ) : undefined}
      />
      <p className={styles.caption}>
        {editing ? 'Editing. Nothing changes until you press the check mark and confirm. The ✕ puts everything back.' : `${person.name ?? 'No name given'} · Signs in with email and password`}
      </p>
      {notice && <div className={`${kit.notice} ${kit.noticeGood}`}>{notice}</div>}

      {editing ? (
        <div className={`${kit.card} ${kit.cardPad}`}>
          <div className={styles.editGrid}>
            <label className={kit.fieldGroup}>
              <span className={kit.label}>Name</span>
              <input className={`${kit.field} ${nameChanged ? styles.changed : ''}`} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </label>
            <label className={kit.fieldGroup}>
              <span className={kit.label}>Email<span className={kit.req} aria-hidden>*</span></span>
              <input className={`${kit.field} ${emailChanged ? styles.changed : ''}`} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
            </label>
          </div>
          <p className={kit.caption}>A new email signs them in from now on; the old one stops working.</p>
        </div>
      ) : (
        <>
          <div className={kit.band}>
            <div className={kit.bandCell}>
              <span className={kit.bandLabel}>Clubs</span>
              <span className={kit.bandValue}>{clubs.length}</span>
              <span className={kit.bandNote}>{owned ? `owner of ${owned.name}` : clubs.length ? `${roleEmailLabel(clubs[0].role)} in ${clubs[0].name}` : 'in no club'}</span>
            </div>
            <div className={kit.bandCell}>
              <span className={kit.bandLabel}>Last signed in</span>
              {person.lastSignInAt
                ? <><span className={`${kit.bandValue} ${kit.bandValueSm}`}>{consoleDate(person.lastSignInAt)}</span><span className={kit.bandNote}>at {consoleClock(person.lastSignInAt)}</span></>
                : <><span className={`${kit.bandValueText} ${styles.quietValue}`}>Never</span><span className={kit.bandNote}>no sign-in yet</span></>}
            </div>
            <div className={kit.bandCell}>
              <span className={kit.bandLabel}>Account created</span>
              <span className={`${kit.bandValue} ${kit.bandValueSm}`}>{consoleDate(person.createdAt)}</span>
              {person.createdAt && <span className={kit.bandNote}>at {consoleClock(person.createdAt)}</span>}
            </div>
          </div>

          <div className={kit.tabs} role="tablist">
            {([
              ['story', 'Story', story.length], ['clubs', 'Clubs', clubs.length], ['account', 'Account', 0],
              ...(emails ? [['emails', 'Emails', emails.total] as const] : []),
            ] as ReadonlyArray<readonly [Tab, string, number]>).map(([key, label, n]) => (
              <button key={key} type="button" role="tab" aria-selected={tab === key} className={`${kit.tab}${tab === key ? ` ${kit.tabOn}` : ''}`} onClick={() => setTab(key)}>
                {label}{n ? <span className={kit.tabCount}>{n}</span> : null}
              </button>
            ))}
          </div>

          {tab === 'story' && (
            <div className={kit.card}>
              <StoryTable entries={story} emptyText="Nothing has happened to this account yet." />
              <div className={styles.tline}>Not in the Story yet: sign-in history (only the last sign-in is kept).</div>
            </div>
          )}

          {tab === 'emails' && emails && <PersonEmailsTab emails={emails} />}

          {tab === 'clubs' && (
            <div className={kit.card}>
              <div className={kit.tableWrap}>
                <table className={kit.comfortable}>
                  <thead><tr><th>Club</th><th>Role</th><th>Status</th><th>Plan</th><th aria-label="Open" /></tr></thead>
                  <tbody>
                    {clubs.length === 0 && <tr><td colSpan={5} className={kit.empty}>This person belongs to no club.</td></tr>}
                    {clubs.map(c => (
                      <LinkRow key={c.id} href={`/platform-admin/orgs/${c.id}`}>
                        <td><Link href={`/platform-admin/orgs/${c.id}`} className={kit.nameLink}>{c.name}</Link><span className={`${kit.sub} ${kit.code}`}>{c.slug}</span></td>
                        <td>{roleLabel(c.role)}</td>
                        <td>{humanize(c.status)}</td>
                        <td>{c.planLabel}</td>
                        <td className={kit.rowDoor}>
                          <Link href={`/platform-admin/orgs/${c.id}`} className={kit.rowDoorLink} tabIndex={-1} aria-hidden>›</Link>
                        </td>
                      </LinkRow>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'account' && (
            <div className={kit.page}>
              <div className={`${kit.card} ${kit.cardPad}`}>
                <div className={styles.facts}>
                  <div className={styles.fact}><span className={kit.bandLabel}>Email</span><span className={styles.factValue}>{person.email}</span></div>
                  <div className={styles.fact}><span className={kit.bandLabel}>Name</span><span className={styles.factValue}>{person.name ?? 'No name given'}</span></div>
                  <div className={styles.fact}><span className={kit.bandLabel}>How they sign in</span><span className={styles.factValue}>Email and password</span></div>
                  <div className={styles.fact}>
                    <span className={kit.bandLabel}>Email confirmed</span>
                    <span className={styles.factLine}>
                      <span className={styles.factValue}>{person.emailConfirmed ? 'Yes' : 'Not yet'}</span>
                      {!person.emailConfirmed && can.support && <button type="button" className={`${kit.door} ${kit.doorSm}`} onClick={() => setWin('confirm')}>Confirm the email</button>}
                    </span>
                  </div>
                  {person.status === 'banned' && (
                    <div className={styles.fact}><span className={kit.bandLabel}>Banned</span><span className={styles.factValue}>Cannot sign in</span></div>
                  )}
                </div>
              </div>
              {(can.support || can.delete) && (
                <div className={styles.rareDoors}>
                  {can.support && <button type="button" className={kit.door} onClick={() => setWin('signOut')}>Sign out everywhere</button>}
                  {can.support && (person.status === 'banned'
                    ? <button type="button" className={kit.door} onClick={() => setWin('unban')}>Lift the ban</button>
                    : <button type="button" className={styles.redDoor} onClick={() => setWin('ban')}>Ban this person</button>)}
                  {can.delete && <button type="button" className={styles.redDoor} onClick={() => setWin('delete')}>Delete this person</button>}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {win === 'save' && (
        <RecordWindow
          title={`Save changes to ${person.email}`}
          sentence={<>
            {nameChanged && <>Their name becomes <strong>{form.name.trim() || 'blank'}</strong>. </>}
            {emailChanged && <>Their email becomes <strong>{form.email.trim().toLowerCase()}</strong>, marked confirmed; they sign in with it from now on and the old one stops working. </>}
            Nobody is emailed.
          </>}
          footNote="One Story entry."
          cancelLabel="Keep editing"
          confirmLabel="Save changes"
          onConfirm={async reason => {
            const failed = await post(`${api}/update`, 'PATCH', {
              ...(emailChanged ? { email: form.email.trim().toLowerCase() } : {}),
              ...(nameChanged ? { displayName: form.name.trim() } : {}),
              reason,
            });
            if (failed) return failed;
            setEditing(false);
            done();
            return null;
          }}
          onClose={() => setWin(null)}
        />
      )}
      {win === 'discard' && (
        <RecordWindow
          title={`Discard your changes to ${person.email}`}
          sentence={<>Your edits are dropped and this person goes back to reading, exactly as it was. Nothing is saved.</>}
          cancelLabel="Keep editing"
          confirmLabel="Discard changes"
          askWhy={false}
          onConfirm={async () => { setWin(null); stopEditing(); return null; }}
          onClose={() => setWin(null)}
        />
      )}
      <UnsavedChangesGuard
        active={editing && (nameChanged || emailChanged)}
        message={`You have unsaved changes to ${person.email}. Leave without saving them?`}
      />
      {win === 'reset' && (
        <RecordWindow
          title={`Send a reset link to ${person.email}`}
          sentence={<>A password reset link goes to <strong>{person.email}</strong>. It reaches an inbox, so <strong>it cannot be taken back</strong>.</>}
          footNote="The link works once."
          confirmLabel="Send the link"
          onConfirm={async reason => { const f = await post(`${api}/reset`, 'POST', { reason }); if (f) return f; done(`A reset link went to ${person.email}.`); return null; }}
          onClose={() => setWin(null)}
        />
      )}
      {win === 'note' && <PersonNote api={api} email={person.email} onDone={() => done()} onClose={() => setWin(null)} />}
      {win === 'confirm' && (
        <RecordWindow
          title={`Confirm ${person.email}`}
          sentence={<><strong>{person.email}</strong> is marked confirmed, as if they had clicked the link in their welcome email.</>}
          confirmLabel="Confirm the email"
          onConfirm={async reason => { const f = await post(`${api}/confirm-email`, 'POST', { reason }); if (f) return f; done(); return null; }}
          onClose={() => setWin(null)}
        />
      )}
      {win === 'signOut' && (
        <RecordWindow
          title={`Sign ${person.email} out everywhere`}
          sentence={<><strong>{person.email}</strong> is signed out on every device, and signs in again next time.</>}
          confirmLabel="Sign out everywhere"
          onConfirm={async reason => { const f = await post(`${api}/revoke-sessions`, 'POST', { reason }); if (f) return f; done(); return null; }}
          onClose={() => setWin(null)}
        />
      )}
      {win === 'ban' && (
        <RecordWindow
          title={`Ban ${person.email}`}
          sentence={<><strong>{person.email}</strong> cannot sign in until the ban is lifted. Their clubs and their data stay as they are.</>}
          cancelLabel="Keep them"
          confirmLabel="Ban this person"
          danger
          onConfirm={async reason => { const f = await post(`${api}/ban`, 'POST', { action: 'ban', reason }); if (f) return f; done(); return null; }}
          onClose={() => setWin(null)}
        />
      )}
      {win === 'unban' && (
        <RecordWindow
          title={`Lift the ban on ${person.email}`}
          sentence={<><strong>{person.email}</strong> can sign in again.</>}
          confirmLabel="Lift the ban"
          onConfirm={async reason => { const f = await post(`${api}/ban`, 'POST', { action: 'unban', reason }); if (f) return f; done(); return null; }}
          onClose={() => setWin(null)}
        />
      )}
      {win === 'delete' && <PersonDelete api={api} email={person.email} onDone={() => router.push('/platform-admin/customer-users')} onClose={() => setWin(null)} />}
    </div>
  );
}

function PersonNote({ api, email, onDone, onClose }: { api: string; email: string; onDone: () => void; onClose: () => void }) {
  const [body, setBody] = useState('');
  return (
    <RecordWindow
      title={`Add a note to ${email}`}
      sentence="Staff see it on the Story. The person never does."
      askWhy={false}
      confirmBlocked={!body.trim()}
      footNote="The note is its own why."
      confirmLabel="Add the note"
      onConfirm={async () => { const f = await post(`${api}/notes`, 'POST', { body }); if (f) return f; onDone(); return null; }}
      onClose={onClose}
    >
      <label className={kit.fieldGroup}>
        <span className={kit.label}>Note<span className={kit.req} aria-hidden>*</span></span>
        <textarea className={kit.textarea} value={body} onChange={e => setBody(e.target.value)} maxLength={4000} required aria-required />
      </label>
    </RecordWindow>
  );
}

function PersonDelete({ api, email, onDone, onClose }: { api: string; email: string; onDone: () => void; onClose: () => void }) {
  const [impact, setImpact] = useState<{ totalTeams?: number; soleOwnedTeams?: number } | null>(null);
  const [typed, setTyped] = useState('');
  useEffect(() => {
    void fetch(`${api}/delete`).then(r => (r.ok ? r.json() : null)).then(setImpact).catch(() => setImpact(null));
  }, [api]);
  return (
    <RecordWindow
      title={`Delete ${email}`}
      sentence={<>
        <strong>{email}</strong> is removed from FieldLogicHQ. Their clubs are not deleted with them. <strong>This cannot be taken back.</strong>
        {impact?.soleOwnedTeams ? <> {impact.soleOwnedTeams} free coaching team{impact.soleOwnedTeams === 1 ? '' : 's'} they run alone {impact.soleOwnedTeams === 1 ? 'is' : 'are'} deleted too, with every player and record.</> : null}
      </>}
      cancelLabel="Keep them"
      confirmLabel="Delete this person"
      danger
      confirmBlocked={typed.trim().toLowerCase() !== email}
      onConfirm={async reason => { const f = await post(`${api}/delete`, 'DELETE', { reason, confirmEmail: typed }); if (f) return f; onDone(); return null; }}
      onClose={onClose}
    >
      <label className={kit.fieldGroup}>
        <span className={kit.label}>Type their email to confirm<span className={kit.req} aria-hidden>*</span></span>
        <input className={kit.field} value={typed} onChange={e => setTyped(e.target.value)} autoComplete="off" />
      </label>
    </RecordWindow>
  );
}
