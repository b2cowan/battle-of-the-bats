'use client';
/**
 * RUN THE DRAFT / DRAFT AGAIN (Club Tier Stage 9c, Part 3; copy §4; rulings Q8, 9c·3, 9c·7, 9c·8). The setup window says
 * who is in and who isn't, from the board's one read: the accepted players (an owing player holds their spot), who is
 * still to review or waiting and so not drafted, the teams' sizes, the locks, the ratings and how it deals. Nothing is
 * sent. A draft that can't run says why and offers only Close.
 */
import { useState } from 'react';
import Link from 'next/link';
import KitDialog, { DialogCancel } from '../../KitDialog';
import ck from '../../ClubKit.module.css';
import { draftRefusal as refusalOf, runDraft } from '@/lib/house-league-draft';
import { familiesOf } from '@/lib/house-league-board-pool';
import { SwitchButton } from '@/components/admin/tournament/SwitchRows';
import { draftRefusal } from '@/lib/house-league-teams-words';
import { TEAMS_WORDS as W } from '@/lib/house-league-teams-screen-words';
import { send, type DivisionBoard, type TeamsRoutes } from './api';
import css from './Teams.module.css';

export default function DraftWindow({ board, ratings, again, together, onTogether, routes, registrationsHref, onDone, onClose }: {
  board: DivisionBoard;
  ratings: ReadonlyMap<string, number>;
  again: boolean;
  /** Families together (A7): on by default; the screen keeps the last choice for the visit, so Draft again honours it. */
  together: boolean;
  onTogether: (next: boolean) => void;
  routes: TeamsRoutes;
  registrationsHref: string;
  onDone: () => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const division = board.division.name;
  const teamIds = board.teams.map(t => t.id);
  const players = board.players;
  const locked = players.filter(p => p.locked && p.teamId);
  const refusal = refusalOf(players.map(p => ({ id: p.id, rating: ratings.get(p.id) ?? null, lockedTeamId: p.locked ? p.teamId : null })), teamIds);
  const rated = players.filter(p => ratings.has(p.id)).length;
  // The switch only where it does something: a division with brothers and sisters in it (absent beats disabled).
  const hasFamilies = familiesOf(players).size > 0;
  const keepTogether = together && hasFamilies;
  const familiesSwitch = hasFamilies && (
    <div className={css.draftSwitch}>
      <SwitchButton on={together} name={W.draft.familiesSwitch} caption={W.draft.familiesLine} onToggle={() => onTogether(!together)} />
    </div>
  );

  async function run() {
    setBusy(true); setError(null);
    const r = await send(routes.draft, 'POST', { action: 'run', divisionId: board.division.id, fingerprint: board.fingerprint, together: keepTogether });
    if (!r.ok) { setError(r.error); setBusy(false); return; }
    onDone();
  }

  if (refusal) {
    return (
      <KitDialog kind="question" title={W.draft.title(division)} onClose={onClose}
        footer={<DialogCancel className="btn btn-lime">{W.draft.close}</DialogCancel>}>
        <p className={ck.hint}>{draftRefusal(refusal, { division, players: players.length, teams: teamIds.length })}</p>
      </KitDialog>
    );
  }

  if (again) {
    const moves = players
      .filter(p => p.draftTeamId && p.teamId !== p.draftTeamId)
      .map(p => `${p.firstName} ${p.lastName} to ${board.teams.find(t => t.id === p.teamId)?.name ?? W.pool.title}`);
    return (
      <KitDialog kind="question" title={W.draft.againTitle(division)} onClose={onClose} busy={busy}
        footerStart={<span>{W.draft.foot}</span>}
        footer={(
          <>
            <DialogCancel />
            <button type="button" className="btn btn-lime" disabled={busy} onClick={run}>{busy ? W.draft.working : W.draft.againButton}</button>
          </>
        )}>
        <p className={ck.hint}>{W.draft.againBody(players.length, moves)}</p>
        {familiesSwitch}
        {error && <p className={css.error} role="alert">{error}</p>}
      </KitDialog>
    );
  }

  // The sizes the deal will reach: as even as the locks allow.
  const sizes = board.teams.map(t => ({ name: t.name, size: 0, id: t.id }));
  for (const p of locked) { const s = sizes.find(x => x.id === p.teamId); if (s) s.size += 1; }
  for (let i = 0; i < players.length - locked.length; i++) {
    const smallest = sizes.reduce((a, b) => (b.size < a.size ? b : a));
    smallest.size += 1;
  }
  // With families kept whole the sizes can end further apart than that (a division nearly all families): when a trial
  // deal says so, the line says the sizes it reaches — as numbers only, since which team gets which is drawn at the press.
  let unevenSizes: number[] | null = null;
  if (keepTogether) {
    const trial = runDraft(players.map(p => ({ id: p.id, rating: ratings.get(p.id) ?? null, lockedTeamId: p.locked ? p.teamId : null, household: p.guardianEmail })), teamIds, 1, { together: true });
    if (trial.ok) {
      const dealt = sizes.map(s => players.filter(p => (p.locked && p.teamId ? p.teamId : trial.deal.get(p.id)) === s.id).length);
      const even = sizes.map(s => s.size);
      if (Math.max(...dealt) - Math.min(...dealt) > Math.max(...even) - Math.min(...even)) unevenSizes = dealt.sort((a, b) => b - a);
    }
  }
  const owing = players.filter(p => p.owes != null).map(p => `${p.firstName} ${p.lastName}`);
  const review = board.notDrafted.review;
  const waiting = board.notDrafted.waitlisted;

  return (
    <KitDialog kind="question" title={W.draft.title(division)} onClose={onClose} busy={busy}
      footerStart={<span>{W.draft.foot}</span>}
      footer={(
        <>
          <DialogCancel />
          <button type="button" className="btn btn-lime" disabled={busy} onClick={run}>{busy ? W.draft.working : W.draft.button}</button>
        </>
      )}>
      <dl className={css.facts}>
        <dt>{W.draft.players}</dt>
        <dd>{W.draft.playersLine(players.length, owing)}</dd>
        <dt>{W.draft.notDrafted}</dt>
        <dd>
          {review.length === 0 && waiting === 0 && W.draft.nobodyOut}
          {review.length > 0 && <>{W.draft.reviewLine(review.map(r => r.name))} <Link href={registrationsHref} className={ck.link}>{W.reviewLink}</Link></>}
          {review.length > 0 && waiting > 0 && ' · '}
          {waiting > 0 && W.draft.waitLine(waiting)}
        </dd>
        <dt>{W.draft.teams}</dt>
        <dd>{unevenSizes ? W.draft.teamsLineFamilies(unevenSizes) : W.draft.teamsLine(sizes, players.length)}</dd>
        {locked.length > 0 && <><dt>{W.draft.locked}</dt><dd>{W.draft.lockedLine(locked.length)}</dd></>}
        <dt>{W.draft.ratings}</dt>
        <dd>{W.draft.ratingsLine(rated, players.length)}</dd>
        <dt>{W.draft.how}</dt>
        <dd>{keepTogether ? W.draft.howLineFamilies : W.draft.howLine}</dd>
      </dl>
      {familiesSwitch}
      {error && <p className={css.error} role="alert">{error}</p>}
    </KitDialog>
  );
}
