'use client';
import { useMemo } from 'react';
import coach from '@/app/[orgSlug]/coaches/coaches.module.css';
import QuestionShell from './QuestionShell';
import { CoachRowList, CoachRowBand, CoachRow } from './CoachRowList';
import SublinedChoice, { type SublinedOption } from './SublinedChoice';
import {
  inspectInning, inningChoiceChanges, playerChoiceChanges, standingFor,
  type InningCandidate, type InningPlayer, type InningRole, type OpenRoleCause,
} from '@/lib/lineup-inning';
import { playerPositionPrefs, pitcherRankLabel } from '@/lib/lineup-profile';
import { playerDisplayName } from '@/lib/coach-roster-name';
import type { LineupPlayerRow } from '@/lib/lineup-grid';
import s from './LineupInningInspector.module.css';

/**
 * THE INNING INSPECTOR — the field-side lens over ONE inning of a lineup (Coach Lineups Deep Dive
 * F12 / Phase 4, owner-approved on the recommended path 2026-09-18; picker redrawn the same day on
 * owner review — D9).
 *
 * The player-by-inning grid is the right overview for comparing a rotation; at the field the coach
 * asks "who is at each position in inning 4?" and had to read down twelve player rows and invert
 * them. This is a SECOND LENS over the same saved assignments — nothing is stored twice: every
 * pick here is the same cell edit the grid makes (autosaved, undoable, and it returns a Ready
 * lineup to Draft exactly as a grid edit does).
 *
 * What it shows, in order: prev/next inning · the sport's field roles as one row list — the ROLE
 * is the row's anchor (large, its own column, first at every width), the player the answer, and
 * under the name a fact only where the depth chart has one (Best N / Never on their chart; on a
 * charted mound the rank and innings used of cap) · Bench / Open / Also lines · and, once the
 * inning is started and a role is open, "Why this is a draft check": the facts behind each
 * undecided player. ⚠ It states what the chart can prove and never guesses a cause — the causes it
 * names (every idle player Never here; every idle pitcher at cap; no idle player / pitcher) are the
 * only ones the inputs support (`lib/lineup-inning.ts`). A Never fact on a FILLED role is shown
 * quietly here; promoting it to a Needs-review issue in the readiness strip is F07's job.
 *
 * ⚖ THE PICKER IS THE MONEY CHOOSER'S DROPDOWN (D9). Beside each row a quiet door word — Change ·
 * Assign · Keep one — opens `SublinedChoice` in its `menu` variant: a floating list hung from the
 * word's right edge, sized for its rows, that never pushes the table down (the owner rejected an
 * in-place fold for exactly that: "not a fan of this behavior"). Each candidate is a NAME, a
 * SUB-LINE in the depth chart's own words (Pitcher P2 · 2 of 4 innings used · Best 1B, 3B, LF ·
 * Never C — or "No positions rated yet"), and a coloured TRAIL only where there is a fact about
 * THIS role (Best 3 · Never · At cap · Doesn't pitch; on the mound the pitcher's rank) — the same
 * slot the money chooser's "1 overdue · $97.09" lives in. Grouped Open → On the Bench → On the
 * field · swap; on a charted mound the idle groups become Pitchers → At cap → Not on the pitching
 * chart. ⚠ A candidate's CURRENT POSITION is never shown — it is on the grid behind (owner,
 * 2026-09-18). A Never candidate stays selectable, named in red (F07's shape: never block, always
 * name). A pick that touches two cells is applied as ONE mutation (`onApply`) so Undo steps back
 * one gesture. The first cut's native <select> is gone: it echoed the holder's name as its resting
 * label and crammed "· Bench · Best 2 · C" into one-line options.
 */
export interface LineupInningInspectorProps {
  /** The inning on screen; null = closed. */
  inning: number | null;
  inningCount: number;
  onClose: () => void;
  onNavigate: (inning: number) => void;
  rows: LineupPlayerRow[];
  sportPack: { fieldPositions: string[]; pitcherPosition: string | null; periodLabel: string };
  /** The effective per-game pitching cap for a row (player and team caps reconciled by the editor). */
  pitcherCapFor: (row: LineupPlayerRow) => number | null;
  /** Every cell change of one gesture, applied as ONE mutation (one undo step). */
  onApply: (inning: number, changes: { playerId: string; position: string }[]) => void;
}

/**
 * The inning heading as a DOOR into the lens — rendered inside the grid's own <th>, keeping that
 * cell's `data-lineup-inning` anchor (the coverage checks' scroll target) exactly where it was.
 * `coverage` is the heading's existing fill figure, passed through so the grid keeps styling it.
 */
export function InningHeadingDoor({
  inning, periodLabel, clash, coverage, title, onOpen,
}: {
  inning: number;
  periodLabel: string;
  clash: boolean;
  coverage?: React.ReactNode;
  title?: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className={s.headDoor}
      onClick={onOpen}
      title={title}
      aria-label={`${periodLabel} ${inning} — who is at each position${title ? ` (${title})` : ''}`}
    >
      <span>{inning}{clash ? ' ⚠' : ''}</span>
      {coverage}
    </button>
  );
}

const CAUSE_COPY: Record<OpenRoleCause, (code: string) => string> = {
  no_idle_players: () => 'Everyone in the lineup is already on the field.',
  all_never: code => `Every idle player has ${code} set to Never.`,
  pitchers_at_cap: () => 'Every idle pitcher has used their innings.',
  no_idle_pitchers: () => 'No idle player is on the pitching chart.',
};

function capWords(used: number, cap: number | null): string {
  return cap == null ? `${used} pitched · no cap` : `${used} of ${cap} used`;
}
const atCap = (p: InningPlayer) => p.pitcherCap != null && p.pitchedInnings >= p.pitcherCap;

type Pick = SublinedOption<string>;

export default function LineupInningInspector({
  inning, inningCount, onClose, onNavigate, rows, sportPack, pitcherCapFor, onApply,
}: LineupInningInspectorProps) {
  const { fieldPositions, pitcherPosition, periodLabel } = sportPack;
  const open = inning != null;

  const nameOf = useMemo(() => {
    const m = new Map(rows.map(r => [r.player.id, playerDisplayName(r.player)]));
    return (id: string) => m.get(id) ?? '';
  }, [rows]);

  const { lens, playerById } = useMemo(() => {
    if (inning == null) return { lens: null, playerById: new Map<string, InningPlayer>() };
    const key = String(inning);
    const players: InningPlayer[] = rows.map(row => {
      const prefs = playerPositionPrefs(row.player, pitcherPosition);
      const pitchedInnings = pitcherPosition
        ? Object.values(row.inningPositions).filter(v => v === pitcherPosition).length
        : 0;
      return {
        playerId: row.player.id,
        position: row.inningPositions[key] ?? '',
        preferred: prefs.preferred,
        never: prefs.never,
        pitcher: row.player.lineupProfile?.pitcher ?? null,
        pitchedInnings,
        pitcherCap: pitcherCapFor(row),
      };
    });
    return {
      lens: inspectInning(players, inning, fieldPositions, pitcherPosition),
      playerById: new Map(players.map(p => [p.playerId, p])),
    };
  }, [inning, rows, fieldPositions, pitcherPosition, pitcherCapFor]);

  if (!open || !lens) return null;
  const roles = lens.roles;

  const isMound = (code: string) => pitcherPosition != null && code === pitcherPosition;
  const chartedMound = (code: string) => isMound(code) && lens.hasPitchingChart;
  const positionOf = (playerId: string) => playerById.get(playerId)?.position ?? '';

  // ── The words on a role row ──
  // A caption only where the depth chart has a FACT to state: a Best rank, a Never, the mound's
  // rank and cap use. A player with no rating for the role gets no line — eight rows reading
  // "Available" is noise, not information.
  function holderCaption(role: InningRole): string | null {
    const h = role.holders[0];
    const p = playerById.get(h.playerId);
    if (chartedMound(role.code)) {
      if (!p?.pitcher) return 'Not on the pitching chart';
      return `${pitcherRankLabel(p.pitcher.rank)} · ${capWords(p.pitchedInnings, p.pitcherCap)}`;
    }
    if (h.standing === 'best') return `Best ${h.bestRank}`;
    if (h.standing === 'never') return 'Never on their chart';
    return null;
  }
  function eligible(role: InningRole): InningCandidate[] {
    return chartedMound(role.code)
      ? role.candidates.filter(c => c.pitching?.pitches && !c.pitching.atCap)
      : role.candidates.filter(c => c.standing !== 'never');
  }
  function openCaption(role: InningRole): { text: string; cause: boolean } {
    if (role.openCause) return { text: CAUSE_COPY[role.openCause](role.code), cause: true };
    const names = eligible(role).map(c => nameOf(c.playerId));
    const shown = names.slice(0, 3).join(', ');
    const more = names.length > 3 ? ` +${names.length - 3} more` : '';
    return { text: `Eligible now: ${shown}${more}`, cause: false };
  }

  // ── The candidates in the picker (D9) ──
  /** The depth chart's own words about one player: pitching, Best list, Never list — or that it has none. */
  function chartWords(p: InningPlayer): string {
    const parts: string[] = [];
    if (p.pitcher) {
      const who = p.pitcher.rank === 1 ? 'Ace pitcher' : `Pitcher ${pitcherRankLabel(p.pitcher.rank)}`;
      const innings = p.pitcherCap == null ? `${p.pitchedInnings} innings pitched · no cap` : `${p.pitchedInnings} of ${p.pitcherCap} innings used`;
      parts.push(`${who} · ${innings}`);
    }
    if (p.preferred.length) parts.push(`Best ${p.preferred.join(', ')}`);
    if (p.never.length) parts.push(`Never ${p.never.join(', ')}`);
    return parts.length ? parts.join(' · ') : 'No positions rated yet';
  }
  /** The coloured word about THIS role, or nothing — never a word for its own sake. */
  function trailFor(code: string, p: InningPlayer): Pick['trail'] {
    if (chartedMound(code)) {
      if (!p.pitcher) return { text: 'Doesn’t pitch', tone: 'quiet' };
      if (atCap(p)) return { text: 'At cap', tone: 'warn' };
      return { text: pitcherRankLabel(p.pitcher.rank), tone: 'good' };
    }
    const st = standingFor(p, code);
    if (st.standing === 'best') return { text: `Best ${st.bestRank}`, tone: 'good' };
    if (st.standing === 'never') return { text: 'Never', tone: 'bad' };
    return undefined;
  }
  const pick = (value: string, id: string, code: string, group: string): Pick => {
    const p = playerById.get(id)!;
    return { value, name: nameOf(id), sub: chartWords(p), trail: trailFor(code, p), group };
  };
  /** Best first, then unrated, then Never; on the mound by rank, the capped behind, non-pitchers last. */
  function orderFor(code: string, ids: string[]): string[] {
    const rank = (id: string) => {
      const p = playerById.get(id)!;
      if (chartedMound(code)) return !p.pitcher ? 300 : atCap(p) ? 200 + p.pitcher.rank : p.pitcher.rank;
      const st = standingFor(p, code);
      return st.standing === 'best' ? (st.bestRank ?? 99) : st.standing === 'never' ? 300 : 200;
    };
    return [...ids].sort((a, b) => rank(a) - rank(b));
  }
  function picksFor(role: InningRole): Pick[] {
    const code = role.code;
    const clash = role.holders.length > 1;
    const isOpen = role.holders.length === 0;
    if (clash) {
      return [
        ...role.holders.map(h => pick(`keep:${h.playerId}`, h.playerId, code, 'Keep')),
        { value: 'clear', name: 'Leave open', sub: `Take both off ${code} — no decision here yet`, group: 'Or' },
      ];
    }
    const idle = role.candidates.map(c => c.playerId);
    const movers = roles.filter(r => r.code !== code && r.holders.length === 1).map(r => r.holders[0].playerId);
    const band = (label: string, ids: string[], kind: 'assign' | 'move'): Pick[] =>
      orderFor(code, ids).map(id => pick(`${kind}:${id}`, id, code, label));
    const picks: Pick[] = chartedMound(code)
      // The mound's question is "who can pitch right now": the idle players answer it in three
      // bands. Everyone stays selectable.
      ? [
        ...band('Pitchers', idle.filter(id => { const p = playerById.get(id)!; return !!p.pitcher && !atCap(p); }), 'assign'),
        ...band('At cap', idle.filter(id => { const p = playerById.get(id)!; return !!p.pitcher && atCap(p); }), 'assign'),
        ...band('Not on the pitching chart', idle.filter(id => !playerById.get(id)!.pitcher), 'assign'),
      ]
      : [
        ...band('Open · no decision yet', idle.filter(id => !positionOf(id)), 'assign'),
        ...band('On the Bench', idle.filter(id => !!positionOf(id)), 'assign'),
      ];
    picks.push(...band('On the field · swap', movers, 'move'));
    if (!isOpen) picks.push({ value: 'clear', name: 'Leave open', sub: `Take ${nameOf(role.holders[0].playerId)} off ${code} — no decision here yet`, group: 'Or' });
    if (!picks.length) picks.push({ value: 'none', name: 'Nobody can be moved here', sub: 'Everyone in the lineup already holds a role' });
    return picks;
  }
  function applyChoice(role: InningRole, value: string) {
    if (inning == null) return;
    const changes = inningChoiceChanges(role, value, positionOf);
    if (changes.length) onApply(inning, changes);
  }
  // ── The people under the roles (owner, 2026-09-18: "it tells me who is open but gives me no
  // way to action it") — an undecided player decides (sit, or take a position: the holder sits,
  // said in the option); a benched player moves the same way. The coloured word is the PLAYER's
  // own standing at that role, which is the fact that decides which position to give them.
  function playerPicksFor(id: string, kind: 'undecided' | 'bench'): Pick[] {
    const p = playerById.get(id)!;
    const picks: Pick[] = [];
    if (kind === 'undecided') {
      picks.push({ value: 'bench', name: 'Bench this inning', sub: 'A deliberate sit — that counts as decided', group: 'Sit' });
    }
    for (const r of roles) {
      const holders = r.holders.map(h => nameOf(h.playerId));
      picks.push({
        value: `take:${r.code}`,
        name: holders.length ? `${r.code} · ${holders.join(' and ')} ${holders.length > 1 ? 'sit' : 'sits'}` : `${r.code} · open now`,
        sub: holders.length ? `${holders.join(' and ')} ${holders.length > 1 ? 'move' : 'moves'} to the Bench` : 'Nobody is there yet',
        trail: trailFor(r.code, p),
        group: 'Take a position',
      });
    }
    return picks;
  }
  function applyPlayerChoice(id: string, value: string) {
    if (inning == null) return;
    const changes = playerChoiceChanges(id, value, roles);
    if (changes.length) onApply(inning, changes);
  }

  const roleWord = `${periodLabel} ${inning}`;
  const status = [
    `${lens.assignedCount} of ${fieldPositions.length} roles assigned`,
    lens.bench.length ? `${lens.bench.length} on Bench` : null,
    lens.undecided.length ? `${lens.undecided.length} still open` : null,
  ].filter(Boolean).join(' · ');
  const names = (ids: string[]) => ids.map(nameOf).join(', ');
  // The grid keeps an untouched inning quiet (no draft check until it has work in it); so does
  // the lens — the facts card appears once the inning is started and a role is still open.
  const started = lens.assignedCount > 0 || lens.bench.length > 0 || lens.elsewhere.length > 0;
  const showWhy = started && lens.openRoles.length > 0;
  /** One player's standing across the open field roles, Best and Never named, "available" folded. */
  function standingWords(openRoles: { code: string; standing: string; bestRank: number | null }[]): string[] {
    const best = openRoles.filter(r => r.standing === 'best');
    const never = openRoles.filter(r => r.standing === 'never');
    const avail = openRoles.filter(r => r.standing === 'available');
    const words = [
      ...best.map(r => `${r.code} is Best ${r.bestRank}`),
      ...never.map(r => `${r.code} is set to Never`),
    ];
    if (avail.length) {
      words.push(avail.length === openRoles.length && avail.length > 2
        ? 'available for every open role'
        : `${avail.map(r => r.code).join(', ')} available`);
    }
    return words;
  }

  return (
    <QuestionShell
      open={open}
      onClose={onClose}
      ariaLabel={`${roleWord} — who is at each position`}
      title={roleWord}
      subtitle={status}
      scroll
      wide
    >
      <div className={`${coach.scrollPane} ${s.body}`}>
        <nav className={s.nav} aria-label={`Other ${periodLabel.toLowerCase()}s`}>
          <button type="button" className={coach.btnSecondary} disabled={inning <= 1} onClick={() => onNavigate(inning - 1)}>
            {inning > 1 ? `‹ ${periodLabel} ${inning - 1}` : `First ${periodLabel.toLowerCase()}`}
          </button>
          <button type="button" className={coach.btnSecondary} disabled={inning >= inningCount} onClick={() => onNavigate(inning + 1)}>
            {inning < inningCount ? `${periodLabel} ${inning + 1} ›` : `Last ${periodLabel.toLowerCase()}`}
          </button>
        </nav>

        <CoachRowList inset label={`${roleWord} field roles`}>
          {roles.map(role => {
            const clash = role.holders.length > 1;
            const isOpen = role.holders.length === 0;
            const state = clash ? 'clash' : isOpen ? 'open' : undefined;
            const caption = clash
              ? <span className={s.clashCaption}>Two players here — keep one</span>
              : isOpen
                ? (() => { const c = openCaption(role); return <span className={c.cause ? s.cause : undefined}>{c.text}</span>; })()
                : holderCaption(role);
            // The role code is the row's MARK (first at every width — a `lead` drops under the
            // title on a phone, which reads wrong for a code); the recipe hides a mark from
            // assistive tech, so the code also opens the title, visually hidden.
            const who = clash
              ? <span className={s.clashWord}>{names(role.holders.map(h => h.playerId))}</span>
              : isOpen ? <span className={s.openWord}>Open</span> : nameOf(role.holders[0].playerId);
            const title = <><span className={coach.srOnly}>{role.code} — </span>{who}</>;
            const doorWord = clash ? 'Keep one' : isOpen ? 'Assign' : 'Change';
            return (
              <CoachRow
                key={role.code}
                mark={<span className={s.code} data-state={state}>{role.code}</span>}
                title={title}
                titleWeight={isOpen ? 'plain' : undefined}
                caption={caption}
                beside={
                  <SublinedChoice
                    id={`lineup-inning-pick-${role.code}`}
                    variant="menu"
                    triggerClassName={s.menuTrigger}
                    listWidth={420}
                    label={`${doorWord} who is at ${role.code} in ${roleWord.toLowerCase()}`}
                    placeholder={doorWord}
                    options={picksFor(role)}
                    value={null}
                    onChange={value => applyChoice(role, value)}
                  />
                }
              />
            );
          })}
        </CoachRowList>

        {(lens.undecided.length > 0 || lens.bench.length > 0 || lens.elsewhere.length > 0) && (
          <CoachRowList inset label={`${roleWord} — players not at a field position`}>
            {lens.undecided.length > 0 && <CoachRowBand>Open · no decision yet</CoachRowBand>}
            {lens.undecided.map(id => {
              const p = playerById.get(id)!;
              return (
                <CoachRow
                  key={id}
                  mark={<span className={s.code} aria-hidden />}
                  title={<span className={s.openWord}>{nameOf(id)}</span>}
                  titleWeight="plain"
                  caption={chartWords(p)}
                  beside={
                    <SublinedChoice
                      id={`lineup-inning-decide-${id}`}
                      variant="menu"
                      triggerClassName={s.menuTrigger}
                      listWidth={420}
                      label={`Decide where ${nameOf(id)} is in ${roleWord.toLowerCase()}`}
                      placeholder="Decide"
                      options={playerPicksFor(id, 'undecided')}
                      value={null}
                      onChange={value => applyPlayerChoice(id, value)}
                    />
                  }
                />
              );
            })}
            {lens.bench.length > 0 && <CoachRowBand>On the Bench</CoachRowBand>}
            {lens.bench.map(id => {
              const p = playerById.get(id)!;
              return (
                <CoachRow
                  key={id}
                  mark={<span className={s.code} aria-hidden />}
                  title={nameOf(id)}
                  caption={chartWords(p)}
                  beside={
                    <SublinedChoice
                      id={`lineup-inning-move-${id}`}
                      variant="menu"
                      triggerClassName={s.menuTrigger}
                      listWidth={420}
                      label={`Move ${nameOf(id)} onto the field in ${roleWord.toLowerCase()}`}
                      placeholder="Move"
                      options={playerPicksFor(id, 'bench')}
                      value={null}
                      onChange={value => applyPlayerChoice(id, value)}
                    />
                  }
                />
              );
            })}
            {lens.elsewhere.length > 0 && <CoachRowBand>Also</CoachRowBand>}
            {lens.elsewhere.map(e => (
              <CoachRow key={e.playerId} mark={<span className={s.code} aria-hidden>{e.position}</span>} title={nameOf(e.playerId)} caption={chartWords(playerById.get(e.playerId)!)} />
            ))}
          </CoachRowList>
        )}

        {showWhy && (
          <section className={s.why} aria-labelledby="lineup-inning-why">
            <h3 id="lineup-inning-why">Why this is a draft check</h3>
            {lens.facts.map(f => (
              <p key={f.playerId} className={s.fact}>
                <strong>{nameOf(f.playerId)}</strong>
                {[
                  f.pitching
                    ? `${pitcherRankLabel(f.pitching.rank)} · ${capWords(f.pitching.used, f.pitching.cap)}`
                    : lens.hasPitchingChart ? 'Does not pitch' : null,
                  ...standingWords(f.openRoles),
                ].filter(Boolean).map(w => ` · ${w}`).join('')}
              </p>
            ))}
            <p className={s.whyNote}>
              {lens.undecided.length > 0
                ? `${lens.undecided.length === 1 ? 'One player' : `${lens.undecided.length} players`} still ${lens.undecided.length === 1 ? 'needs' : 'need'} a decision in ${periodLabel.toLowerCase()} ${inning}. This is unfinished — not proof that nobody is eligible.`
                : lens.bench.length > 0
                  ? `Everyone without a role is on the Bench by choice; one of them would have to come off it to cover ${lens.openRoles.join(' and ')}.`
                  : `Everyone in the lineup is already on the field — ${lens.openRoles.length === 1 ? 'one more player is' : `${lens.openRoles.length} more players are`} needed for a full field.`}
            </p>
          </section>
        )}
      </div>
    </QuestionShell>
  );
}
