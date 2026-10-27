'use client';
/**
 * A TEAM AND ITS COACHES (Club Tier Stage 9c, Part 3; copy §2; rulings 9c·1, 9c·10). The window IS the form (owner
 * 2026-10-26: the read-only view is retired — the Teams page is the read view, and a card's pencil is the only door, so
 * only someone who can edit ever opens it): the name, the colour and the coaches, each a name and an email, saved at ✓,
 * which closes the window. Before the division is published a
 * coach waits ("Invited when you publish"); after it, adding one or removing one tells somebody, so each is held behind
 * its own question at ✓ (house rule: a change that tells someone is held). An expired invite offers Send again.
 * Create teams is its own small window (copy §2: today's fields and words).
 */
import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import KitDialog, { DialogCancel } from '../../KitDialog';
import ck from '../../ClubKit.module.css';
import { TEAMS_WORDS as W } from '@/lib/house-league-teams-screen-words';
import { dayOf, send, type BoardCoach, type BoardTeam, type TeamsRoutes } from './api';
import css from './Teams.module.css';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const first = (name: string) => name.trim().split(/\s+/)[0] ?? name;

interface NewCoach { key: number; first: string; last: string; email: string }
const coachName = (c: { first: string; last: string }) => [c.first.trim(), c.last.trim()].filter(Boolean).join(' ');
const isFilled = (c: NewCoach) => !!(c.first.trim() || c.last.trim() || c.email.trim());
/** An existing coach's details as typed in the form (the same three fields as a new one). */
interface Fix { id: string; first: string; last: string; email: string }
type Ask =
  | { kind: 'invite'; coach: NewCoach }
  | { kind: 'email'; fix: Fix }
  | { kind: 'remove'; id: string; name: string };

export default function TeamWindow({ team, divisionName, published, playerCount, routes, blankCoach, startDeleting, onChanged, onClose }: {
  team: BoardTeam;
  divisionName: string;
  published: boolean;
  playerCount: number;
  routes: TeamsRoutes;
  /** Opened from "No coach yet": an empty coach row is waiting. */
  blankCoach: boolean;
  /** Opened from a card's trash can: straight to the delete question, with no team window behind it. */
  startDeleting: boolean;
  onChanged: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(team.name);
  const [colour, setColour] = useState<string | null>(team.color);
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const [adds, setAdds] = useState<NewCoach[]>(blankCoach && team.coaches.length === 0 ? [{ key: 1, first: '', last: '', email: '' }] : []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [edits, setEdits] = useState<Record<string, Fix>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [asks, setAsks] = useState<Ask[]>([]);
  const [deleting, setDeleting] = useState(startDeleting);
  const [resending, setResending] = useState<string | null>(null);

  const baseOf = (c: BoardCoach): Fix => ({ id: c.id, first: c.firstName, last: c.lastName, email: c.email });
  const draftOf = (c: BoardCoach): Fix => (edits[c.id] ? { ...edits[c.id], email: c.state === 'joined' ? c.email : edits[c.id].email } : baseOf(c));
  const setDraft = (c: BoardCoach, patch: Partial<Fix>) => setEdits(prev => ({ ...prev, [c.id]: { ...(prev[c.id] ?? baseOf(c)), ...patch } }));
  /** The coaches whose typed details differ from what is saved. */
  const fixes = team.coaches.filter(c => !removed.has(c.id)).map(draftOf).filter(f => {
    const c = team.coaches.find(x => x.id === f.id)!;
    return f.first.trim() !== c.firstName || f.last.trim() !== c.lastName || f.email.trim().toLowerCase() !== c.email;
  });
  const emailChanged = (f: Fix) => f.email.trim().toLowerCase() !== team.coaches.find(c => c.id === f.id)?.email;

  const dirty = name.trim() !== team.name || colour !== team.color || removed.size > 0 || adds.some(isFilled) || fixes.length > 0;

  function validate(): { filled: NewCoach[]; fixes: Fix[] } | null {
    const filled = adds.filter(isFilled);
    const next: Record<string, string> = {};
    for (const a of filled) {
      if (!a.first.trim()) next[a.key] = W.team.errName;
      else if (!EMAIL.test(a.email.trim())) next[a.key] = W.team.errEmail;
    }
    for (const f of fixes) {
      if (!f.first.trim()) next[f.id] = W.team.errName;
      else if (emailChanged(f) && !EMAIL.test(f.email.trim())) next[f.id] = W.team.errEmail;
    }
    setErrors(next);
    if (!name.trim()) { setError(W.team.errTeamName); return null; }
    return Object.keys(next).length ? null : { filled, fixes };
  }

  const hasCoach = adds.length > 0 || team.coaches.some(c => !removed.has(c.id));

  async function addCoach(c: NewCoach): Promise<boolean> {
    const r = await send(routes.coaches(team.id), 'POST', { firstName: c.first.trim(), lastName: c.last.trim(), email: c.email.trim(), confirmed: published });
    if (!r.ok) { setError(r.error); return false; }
    setAdds(list => list.filter(x => x.key !== c.key));
    onChanged();
    return true;
  }
  async function updateCoach(f: Fix, confirmed: boolean): Promise<boolean> {
    const r = await send(routes.coaches(team.id), 'PATCH', { action: 'update', coachId: f.id, firstName: f.first.trim(), lastName: f.last.trim(), email: f.email.trim(), confirmed });
    if (!r.ok) { setError(r.error); return false; }
    onChanged();
    return true;
  }
  async function removeCoach(id: string): Promise<boolean> {
    const r = await send(routes.coaches(team.id, id), 'DELETE');
    if (!r.ok) { setError(r.error); return false; }
    setRemoved(prev => { const next = new Set(prev); next.delete(id); return next; });
    onChanged();
    return true;
  }

  /**
   * ✓: the team's own fields, then the coaches. A name fix saves at once (nobody is told). After publishing, every add,
   * remove and changed email is asked first.
   */
  async function save() {
    setError(null);
    const valid = validate();
    if (!valid) return;
    const { filled } = valid;
    setBusy(true);
    if (name.trim() !== team.name || colour !== team.color) {
      const r = await send(routes.team(team.id), 'PATCH', { name: name.trim(), color: colour });
      if (!r.ok) { setError(r.error); setBusy(false); return; }
    }
    for (const f of valid.fixes.filter(x => !emailChanged(x))) if (!(await updateCoach(f, false))) { setBusy(false); return; }
    const emailFixes = valid.fixes.filter(emailChanged);
    if (published) {
      const queue: Ask[] = [
        ...[...removed].map(id => ({ kind: 'remove' as const, id, name: team.coaches.find(c => c.id === id)?.name ?? '' })),
        ...emailFixes.map(fix => ({ kind: 'email' as const, fix })),
        ...filled.map(coach => ({ kind: 'invite' as const, coach })),
      ];
      setBusy(false);
      if (queue.length) { setAsks(queue); return; }
      finish();
      return;
    }
    for (const id of removed) if (!(await removeCoach(id))) { setBusy(false); return; }
    for (const f of emailFixes) if (!(await updateCoach(f, false))) { setBusy(false); return; }
    for (const c of filled) if (!(await addCoach(c))) { setBusy(false); return; }
    setBusy(false);
    finish();
  }
  function finish() {
    setRemoved(new Set()); setAdds([]); setEdits({}); onChanged(); onClose();
  }

  async function answer(ask: Ask) {
    setBusy(true);
    const ok = ask.kind === 'invite' ? await addCoach(ask.coach) : ask.kind === 'email' ? await updateCoach(ask.fix, true) : await removeCoach(ask.id);
    setBusy(false);
    // A refusal stops the questions; what already landed stays landed, and what didn't stays in the form to try again.
    if (!ok) { setAsks([]); return; }
    const rest = asks.slice(1);
    setAsks(rest);
    if (rest.length === 0) finish();
  }

  async function sendAgain(coachId: string) {
    if (resending) return;
    setResending(coachId);
    const r = await send(routes.coaches(team.id), 'PATCH', { coachId, action: 'resend' });
    setResending(null);
    if (!r.ok) { setError(r.error); return; }
    onChanged();
  }

  async function deleteTeam() {
    setBusy(true);
    const r = await send(routes.team(team.id), 'DELETE');
    setBusy(false);
    if (!r.ok) { setError(r.error); setDeleting(false); return; }
    onChanged(); onClose();
  }

  const stateLine = (c: BoardTeam['coaches'][number]) => {
    if (c.state === 'waiting') return W.coachState.waiting;
    if (c.state === 'joined') return W.coachState.joined;
    if (c.state === 'expired' || c.state === 'failed') {
      return (
        <span className={css.amberText}>
          {c.state === 'expired' ? W.coachState.expired : W.coachState.failed} ·{' '}
          <button type="button" className={css.inlineLink} disabled={resending === c.id} onClick={() => void sendAgain(c.id)}>{W.coachState.sendAgain}</button>
        </span>
      );
    }
    return W.coachState.invited(c.invitedAt ? dayOf(c.invitedAt) : '');
  };

  const firstNew = adds.find(a => a.first.trim());
  const ask = asks[0] ?? null;
  const asked = !ask ? null : ask.kind === 'invite'
    ? { title: W.team.confirmInviteTitle(ask.coach.first.trim()), body: W.team.confirmInviteBody(ask.coach.first.trim(), team.name), button: W.team.confirmInviteButton }
    : ask.kind === 'email'
      ? { title: W.team.confirmEmailTitle(ask.fix.first.trim(), ask.fix.email.trim()), body: W.team.confirmEmailBody(ask.fix.first.trim(), team.name), button: W.team.confirmInviteButton }
      : { title: W.team.confirmRemoveTitle(ask.name), body: W.team.confirmRemoveBody(first(ask.name), team.name), button: W.team.confirmRemoveButton };
  // From a card's trash can the question stands alone (no team window behind it), and cancelling leaves the board.
  const alone = startDeleting && deleting;
  const deleteQuestion = (
    <KitDialog kind="question" raised={!alone} busy={busy} onClose={() => (alone ? onClose() : setDeleting(false))} title={W.team.deleteTitle(team.name)}
      footer={(
        <>
          <DialogCancel />
          <button type="button" className="btn btn-danger" disabled={busy} onClick={() => void deleteTeam()}>{W.team.deleteButton}</button>
        </>
      )}>
      <p className={ck.hint}>{W.team.deleteBody(team.name)}</p>
    </KitDialog>
  );
  if (alone) return deleteQuestion;
  return (
    <>
      <KitDialog
        kind="form"
        title={team.name}
        onClose={onClose}
        busy={busy}
        size="medium"
        dirty={dirty}
        edit={{ editing: true, label: W.team.editLabel, disabled: busy, onToggle: () => void save() }}
      >
        <div className={css.form}>
          <div className={ck.field}>
            <label className={ck.label} htmlFor="team-name">{W.team.name}</label>
            <input id="team-name" className={ck.input} value={name} maxLength={80} onChange={e => setName(e.target.value)} />
          </div>
          <div className={ck.field}>
            <label className={ck.label} htmlFor="team-colour">{W.team.colour}</label>
            <div className={css.colourRow}>
              <input id="team-colour" type="color" className={css.colour}
                value={colour ?? '#000000' /* token-exempt: a colour input's empty value, never drawn */}
                onChange={e => setColour(e.target.value)} />
              {colour && <button type="button" className="btn btn-outline" onClick={() => setColour(null)}>{W.team.noColour}</button>}
            </div>
          </div>
          <div className={ck.field}>
            <span className={ck.label}>{W.team.coaches}</span>
            {team.coaches.filter(c => !removed.has(c.id)).map(c => {
              const d = draftOf(c);
              return (
                <div key={c.id} className={css.coachNew}>
                  <div className={css.coachNewFields}>
                    <input className={ck.input} aria-label={`${W.team.coachFirst} (${c.name})`} placeholder={W.team.coachFirst} value={d.first} maxLength={120}
                      onChange={e => setDraft(c, { first: e.target.value })} />
                    <input className={ck.input} aria-label={`${W.team.coachLast} (${c.name})`} placeholder={W.team.coachLast} value={d.last} maxLength={120}
                      onChange={e => setDraft(c, { last: e.target.value })} />
                    {c.state === 'joined'
                      ? <p className={`${ck.hint} ${css.coachNewEmail}`}>{c.email} · {W.team.joinedEmail}</p>
                      : (
                        <>
                          <input className={`${ck.input} ${css.coachNewEmail}`} aria-label={`${W.team.coachEmail} (${c.name})`} placeholder={W.team.coachEmail} type="email" value={d.email} maxLength={254}
                            onChange={e => setDraft(c, { email: e.target.value })} />
                          {/* The invite's state (and Send again) used to live on the read-only view; it reads here now. */}
                          <div className={`${css.kidSub} ${css.coachNewEmail}`}>{stateLine(c)}</div>
                        </>
                      )}
                  </div>
                  <button type="button" className={css.iconBtn} aria-label={W.team.removeCoach(c.name)}
                    onClick={() => setRemoved(prev => new Set(prev).add(c.id))}><X size={16} aria-hidden /></button>
                  {errors[c.id] && <p className={css.error} role="alert">{errors[c.id]}</p>}
                </div>
              );
            })}
            {adds.map(a => (
              <div key={a.key} className={css.coachNew}>
                <div className={css.coachNewFields}>
                  <input className={ck.input} aria-label={W.team.coachFirst} placeholder={W.team.coachFirst} value={a.first} maxLength={120}
                    onChange={e => setAdds(list => list.map(x => (x.key === a.key ? { ...x, first: e.target.value } : x)))} />
                  <input className={ck.input} aria-label={W.team.coachLast} placeholder={W.team.coachLast} value={a.last} maxLength={120}
                    onChange={e => setAdds(list => list.map(x => (x.key === a.key ? { ...x, last: e.target.value } : x)))} />
                  <input className={`${ck.input} ${css.coachNewEmail}`} aria-label={W.team.coachEmail} placeholder={W.team.coachEmail} type="email" value={a.email} maxLength={254}
                    onChange={e => setAdds(list => list.map(x => (x.key === a.key ? { ...x, email: e.target.value } : x)))} />
                </div>
                <button type="button" className={css.iconBtn} aria-label={W.team.removeCoach(coachName(a) || W.team.coach)}
                  onClick={() => setAdds(list => list.filter(x => x.key !== a.key))}><X size={16} aria-hidden /></button>
                {errors[a.key] && <p className={css.error} role="alert">{errors[a.key]}</p>}
              </div>
            ))}
            <button type="button" className={css.addLink} onClick={() => setAdds(list => [...list, { key: Date.now(), first: '', last: '', email: '' }])}>
              <Plus size={14} aria-hidden />{hasCoach ? W.team.addAnotherCoach : W.team.addCoach}
            </button>
            {firstNew && <p className={ck.hint}>{published ? W.team.hintAfter(firstNew.first.trim()) : W.team.hintBefore(firstNew.first.trim(), divisionName)}</p>}
          </div>
          {error && <p className={css.error} role="alert">{error}</p>}
          {!published && playerCount === 0 && (
            <div className={css.rareDoor}>
              <button type="button" className={css.inlineLink} onClick={() => setDeleting(true)}>{W.team.deleteTeam}</button>
            </div>
          )}
        </div>
      </KitDialog>

      {ask && asked && (
        <KitDialog kind="question" raised busy={busy} onClose={() => setAsks([])}
          title={asked.title}
          footer={(
            <>
              <DialogCancel />
              <button type="button" className="btn btn-lime" disabled={busy} onClick={() => void answer(ask)}>
                {asked.button}
              </button>
            </>
          )}>
          <p className={ck.hint}>
            {asked.body}
          </p>
        </KitDialog>
      )}

      {deleting && deleteQuestion}
    </>
  );
}

export function CreateTeamsWindow({ divisionId, divisionName, existing, routes, onDone, onClose }: {
  divisionId: string;
  divisionName: string;
  /** The division's teams' names, so a new "Team N" never repeats one. */
  existing: readonly string[];
  routes: TeamsRoutes;
  onDone: () => void;
  onClose: () => void;
}) {
  const [count, setCount] = useState(existing.length ? '1' : '2'); // a first set is a pair; after that, one more at a time
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const n = Math.max(1, Math.min(20, Number.parseInt(count, 10) || 0));
  async function create() {
    setBusy(true); setError(null);
    const taken = new Set(existing.map(x => x.trim().toLowerCase()));
    const teams: { name: string }[] = [];
    for (let k = 1; teams.length < n; k++) {
      const name = W.team.defaultName(k);
      if (!taken.has(name.toLowerCase())) teams.push({ name });
    }
    const r = await send(routes.teams, 'POST', { divisionId, teams });
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    onDone();
  }
  return (
    <KitDialog kind="form" title={W.team.createTitle(divisionName)} onClose={onClose} busy={busy}
      footer={(
        <>
          <DialogCancel />
          <button type="button" className="btn btn-lime" disabled={busy} onClick={() => void create()}>{busy ? W.team.creating : W.team.create(n)}</button>
        </>
      )}>
      <div className={ck.field}>
        <label className={ck.label} htmlFor="team-count">{W.team.count}</label>
        <input id="team-count" className={ck.input} type="number" inputMode="numeric" min={1} max={20} value={count} onChange={e => setCount(e.target.value)} />
      </div>
      {error && <p className={css.error} role="alert">{error}</p>}
    </KitDialog>
  );
}
