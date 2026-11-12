'use client';
/**
 * RUN THE DRAFT / DRAFT AGAIN (Club Tier Stage 9c, Part 3; copy §4; rulings Q8, 9c·3, 9c·7, 9c·8). The setup window says
 * who is in and who isn't, from the board's one read: the accepted players (an owing player holds their spot), who is
 * still to review or waiting and so not drafted, the teams' sizes, the locks, the ratings and how it deals. Nothing is
 * sent. A draft that can't run says why and offers only Close.
 *
 * FRIENDS (Board Ready Stage 1 Part 3; drawing tab 3 bottom, rulings A1, A9): a Friends fact row (the confirmed requests,
 * the groups they make, what can't be kept and why, the requests still to confirm and a link to them — warn, never
 * block) and "Keep friends together" beside "Keep families together": shown only when the division has a confirmed
 * request (absent beats disabled), on by default, the choice held for the visit. Only a reader the board's read gave
 * friends to (A11) sees either; for anyone else the draft keeps friends together by default, unseen.
 */
import { useState } from 'react';
import Link from 'next/link';
import KitDialog, { DialogCancel } from '../../KitDialog';
import ck from '../../ClubKit.module.css';
import { draftRefusal as refusalOf, keepTogetherGroups, runDraft, type DraftPlayer } from '@/lib/house-league-draft';
import type { DivisionFriends } from '@/lib/league-friend-draft';
import { familiesOf } from '@/lib/house-league-board-pool';
import { SwitchButton } from '@/components/admin/tournament/SwitchRows';
import { draftRefusal } from '@/lib/house-league-teams-words';
import { TEAMS_WORDS as W } from '@/lib/house-league-teams-screen-words';
import { send, type DivisionBoard, type TeamsRoutes } from './api';
import css from './Teams.module.css';

export default function DraftWindow({ board, ratings, again, together, onTogether, friends, keepFriends: friendsChoice, onKeepFriends, friendsHref, routes, registrationsHref, onDone, onClose }: {
  board: DivisionBoard;
  ratings: ReadonlyMap<string, number>;
  again: boolean;
  /** Families together (A7): on by default; the screen keeps the last choice for the visit, so Draft again honours it. */
  together: boolean;
  onTogether: (next: boolean) => void;
  /** The division's confirmed friend links (Part 3): present only for a reader of Registrations (A11). */
  friends: DivisionFriends | null;
  /** Keep friends together: on by default, held for the visit like the families switch. */
  keepFriends: boolean;
  onKeepFriends: (next: boolean) => void;
  /** Registrations › Friend requests (the Friends row's link). */
  friendsHref: string;
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
  // Friends (Part 3): the links between this division's accepted players; the switch only when there is one (A9).
  const ids = new Set(players.map(p => p.id));
  const links = (friends?.links ?? []).filter(l => ids.has(l.a) && ids.has(l.b));
  const hasFriends = links.length > 0;
  const keepFriends = friendsChoice && hasFriends;
  const draftPlayers = (): DraftPlayer[] => players.map(p => ({ id: p.id, rating: ratings.get(p.id) ?? null, lockedTeamId: p.locked ? p.teamId : null, household: p.guardianEmail }));
  const familiesSwitch = (hasFamilies || hasFriends) && (
    <div className={css.draftSwitch}>
      {hasFamilies && <SwitchButton on={together} name={W.draft.familiesSwitch} caption={W.draft.familiesLine} onToggle={() => onTogether(!together)} />}
      {hasFriends && <SwitchButton on={friendsChoice} name={W.draft.friendsSwitch} caption={W.draft.friendsSwitchLine} onToggle={() => onKeepFriends(!friendsChoice)} />}
    </div>
  );

  async function run() {
    setBusy(true); setError(null);
    const r = await send(routes.draft, 'POST', {
      action: 'run', divisionId: board.division.id, fingerprint: board.fingerprint, together: keepTogether,
      // Sent only by a reader who saw the switch: anyone else gets the server's default (friends kept together).
      ...(hasFriends ? { friends: keepFriends } : {}),
    });
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
  if (keepTogether || keepFriends) {
    const trial = runDraft(draftPlayers(), teamIds, 1, { together: keepTogether, friends: keepFriends ? links : [] });
    if (trial.ok) {
      const dealt = sizes.map(s => players.filter(p => (p.locked && p.teamId ? p.teamId : trial.deal.get(p.id)) === s.id).length);
      const even = sizes.map(s => s.size);
      if (Math.max(...dealt) - Math.min(...dealt) > Math.max(...even) - Math.min(...even)) unevenSizes = dealt.sort((a, b) => b - a);
    }
  }
  const owing = players.filter(p => p.owes != null).map(p => `${p.firstName} ${p.lastName}`);
  // The Friends row (tab 3): what the deal will do with each confirmed request, counted per request (a pair is two).
  let friendsLine: string | null = null;
  if (friends && hasFriends) {
    const g = keepTogetherGroups(draftPlayers(), teamIds, { together: keepTogether, friends: links });
    const lines = (o: string) => links.filter(l => g.links.get(l.id) === o).reduce((n, l) => n + l.requestIds.length, 0);
    const groups = new Set(links.filter(l => g.links.get(l.id) === 'kept').map(l => g.groupOf.get(l.a)));
    friendsLine = W.draft.friendsLine({
      confirmed: links.reduce((n, l) => n + l.requestIds.length, 0), groups: groups.size,
      overCap: lines('overCap'), locked: lines('locked'), apart: lines('apart'), waiting: friends.waiting,
    });
  } else if (friends && friends.waiting > 0) {
    friendsLine = W.draft.friendsWaitingOnly(friends.waiting);
  }
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
        <dd>{unevenSizes ? (keepFriends ? W.draft.teamsLineGroups(unevenSizes, keepTogether) : W.draft.teamsLineFamilies(unevenSizes)) : W.draft.teamsLine(sizes, players.length)}</dd>
        {locked.length > 0 && <><dt>{W.draft.locked}</dt><dd>{W.draft.lockedLine(locked.length)}</dd></>}
        <dt>{W.draft.ratings}</dt>
        <dd>{W.draft.ratingsLine(rated, players.length)}</dd>
        {friendsLine && <><dt>{W.draft.friends}</dt><dd>{friendsLine} <Link href={friendsHref} className={ck.link}>{W.draft.friendsLink}</Link></dd></>}
        <dt>{W.draft.how}</dt>
        <dd>{keepTogether && keepFriends ? W.draft.howLineBoth : keepFriends ? W.draft.howLineFriends : keepTogether ? W.draft.howLineFamilies : W.draft.howLine}</dd>
      </dl>
      {familiesSwitch}
      {error && <p className={css.error} role="alert">{error}</p>}
    </KitDialog>
  );
}
