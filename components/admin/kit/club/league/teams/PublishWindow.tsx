'use client';
/**
 * PUBLISH THE DIVISION'S TEAMS (Club Tier Stage 9c, Part 4; copy §7; rulings 9c·4, 9c·6, 9c·7, 9c·10). Held: the window
 * says who is emailed and who is invited, and what is still open (players not on a team warn, they never block — copy §15,
 * owner 2026-10-25; a team with no coach warns; a child still to review is named with the way to Registrations). One press
 * publishes and sends; the button reads "Publishing…" and can't be pressed twice, and a second press anywhere is refused
 * by the server with who published and when.
 */
import { useState } from 'react';
import Link from 'next/link';
import { Check, AlertTriangle } from 'lucide-react';
import KitDialog, { DialogCancel } from '../../KitDialog';
import ck from '../../ClubKit.module.css';
import { familyCoachClause } from '@/lib/house-league-teams-words';
import { TEAMS_WORDS as W } from '@/lib/house-league-teams-screen-words';
import { send, type DivisionBoard, type TeamsRoutes } from './api';
import css from './Teams.module.css';

export interface PublishOutcome {
  publishedAt: string;
  families: number;
  outcome: { sent: number; failed: number; skipped: number };
  invited: { name: string; team: string }[];
}

export default function PublishWindow({ board, season, routes, registrationsHref, onDone, onClose }: {
  board: DivisionBoard;
  season: string;
  routes: TeamsRoutes;
  registrationsHref: string;
  onDone: (result: PublishOutcome) => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const division = board.division.name;
  const placed = board.players.filter(p => p.teamId);
  const unplaced = board.players.length - placed.length;
  const families = new Map<string, typeof placed>();
  // A child with no guardian email gets no email row at Publish, so is no family here either.
  for (const p of placed) if (p.guardianEmail) families.set(p.guardianEmail, [...(families.get(p.guardianEmail) ?? []), p]);
  const coaches = board.teams.flatMap(t => t.coaches.filter(c => c.state === 'waiting').map(c => ({ name: c.name, team: t.name })));
  const noCoach = board.teams.filter(t => t.coaches.length === 0);
  // The family the preview shows: the one with the most children (copy §7.1 publish.preview).
  const sample = [...families.values()].sort((a, b) => b.length - a.length)[0] ?? [];
  const teamOf = (id: string | null) => board.teams.find(t => t.id === id);

  async function publish() {
    setBusy(true); setError(null);
    const r = await send<PublishOutcome>(routes.publish, 'POST', { action: 'publish', divisionId: board.division.id, fingerprint: board.fingerprint });
    if (!r.ok) { setError(r.error); setBusy(false); return; }
    onDone(r.data);
  }

  return (
    <KitDialog kind="question" title={W.publish.title(division)} onClose={onClose} busy={busy}
      footerStart={<span>{busy ? W.publish.sending(families.size) : W.publish.foot(families.size)}</span>}
      footer={(
        <>
          <DialogCancel />
          <button type="button" className="btn btn-lime" disabled={busy} onClick={() => void publish()}>
            {busy ? W.publish.working : W.publish.button(families.size)}
          </button>
        </>
      )}>
      <p className={ck.hint}>{W.publish.body(coaches)}</p>
      <ul className={css.checks}>
        {unplaced === 0
          ? <li><Check size={16} aria-hidden className={css.checkOk} />{W.publish.placed(placed.length)}</li>
          : <li><AlertTriangle size={16} aria-hidden className={css.checkWarn} />{W.publish.unplaced(unplaced)}</li>}
        {noCoach.map(t => <li key={t.id}><AlertTriangle size={16} aria-hidden className={css.checkWarn} />{W.publish.noCoach(t.name)}</li>)}
        {board.notDrafted.review.length > 0 && (
          <li>
            <AlertTriangle size={16} aria-hidden className={css.checkWarn} />
            <span>{W.publish.review(board.notDrafted.review.map(r => r.name))} <Link href={registrationsHref} className={ck.link}>{W.reviewLink}</Link></span>
          </li>
        )}
      </ul>
      {sample.length > 0 && (
        <div className={css.preview}>
          <button type="button" className={css.inlineLink} aria-expanded={preview} onClick={() => setPreview(v => !v)}>
            {W.publish.preview(sample[0].guardianLastName || `${sample[0].firstName} ${sample[0].lastName}`, sample.length)}
          </button>
          {preview && (
            <div className={css.previewBody}>
              <p className={css.kidName}>The teams are set — {season}</p>
              <p>The {division} teams for {season} are set.</p>
              <ul>
                {sample.map(p => {
                  const t = teamOf(p.teamId);
                  return <li key={p.id}><b>{p.firstName} {p.lastName}</b>: {t?.name}, {familyCoachClause(t?.coaches.map(c => c.name) ?? [])}</li>;
                })}
              </ul>
            </div>
          )}
        </div>
      )}
      {error && <p className={css.error} role="alert">{error}</p>}
    </KitDialog>
  );
}
