import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { billingTestLoader as tsxTestLoader } from './_billing-test-loader.ts';
import { readCode } from './_source-code.ts';
import { gameRowView, liveCardView } from '../../lib/public-game-row.ts';
import type { Game } from '../../lib/types.ts';

const load = tsxTestLoader();
const { GameStatusPill, PublicGameRow, ScheduleMatchup } = load('components/public/PublicGameRow.tsx') as typeof import('../../components/public/PublicGameRow.tsx');
const { default: PublicLiveCard } = load('components/public/PublicLiveCard.tsx') as typeof import('../../components/public/PublicLiveCard.tsx');
const names = { away: 'Halton Hawks U11 Jr (Johnstone)', home: 'Hamilton-Wentworth Girls Fastpitch U13 Navy (McAllister)' };
const game = (extra: Partial<Game> = {}): Game => ({ id: 'g1', tournamentId: 't', divisionId: 'u11', date: '2026-10-29',
  time: '09:00', status: 'completed', awayTeamId: 'a', homeTeamId: 'h', awayScore: 16, homeScore: 13, location: '', ...extra });
type NodeProps = { children?: ReactNode; className?: string; value?: number };
function nodes(node: ReactNode): ReactElement<NodeProps>[] {
  return Children.toArray(node).flatMap(child => isValidElement<NodeProps>(child) ? [child, ...nodes(child.props.children)] : []);
}

describe('the accepted compact Schedule (owner 2026-10-29)', () => {
  it('a wrapped name and its own two-digit score share one row, with first-baseline alignment', () => {
    const tree = ScheduleMatchup({ time: '9:00 a.m.', division: 'U11', state: 'final', sides: [
      { name: names.away, score: 16, result: 'win' }, { name: names.home, score: 13, result: 'lose' },
    ] });
    const pairs = nodes(tree).filter(n => n.props.className === 'gameSide');
    assert.equal(pairs.length, 2);
    for (const [i, pair] of pairs.entries()) {
      const children = nodes(pair.props.children);
      assert.equal(children.find(n => n.props.className === 'gameName')?.props.children, [names.away, names.home][i]);
      assert.equal(children.find(n => n.props.className === 'gameScore')?.props.value, [16, 13][i]);
    }
    const css = readCode('components/public/PublicSchedule.module.css');
    assert.match(css, /\.gameSide \{[^}]*grid-template-columns: minmax\(0, 1fr\) auto;[^}]*align-items: first baseline/);
    assert.doesNotMatch(css, /text-overflow: ellipsis|line-clamp/);
  });
  it('time is above division/pool, the round remains available, and status has its own header position', () => {
    const html = renderToStaticMarkup(createElement(PublicGameRow, { schedule: true,
      view: gameRowView(game(), names, 'U11', '2026-10-29', { schedule: true, state: 'final', round: 'Semifinal', poolTag: 'Pool A' }),
      href: '/club/event/schedule/g1',
    }));
    assert.ok(html.indexOf('9:00 a.m.') < html.indexOf('U11'));
    assert.match(html, /U11 · Pool A/);
    assert.match(html, /class="gameStatus" data-state="final">Final/);
    assert.match(html, /Semifinal/);
    assert.match(html, /href="\/club\/event\/schedule\/g1"/);
    assert.doesNotMatch(html, /Directions|maps\/search|Location TBD/);
  });
  it('Unofficial, Cancelled and a forfeit Final retain the same state words and score eligibility', () => {
    for (const [status, state, label, scored] of [
      ['submitted', 'unofficial', 'Unofficial', true], ['cancelled', 'cancelled', 'Cancelled', false], ['forfeit', 'final', 'Final', true],
    ] as const) {
      const html = renderToStaticMarkup(createElement(PublicGameRow, { schedule: true,
        view: gameRowView(game({ status }), names, 'U11', '2026-10-29', { schedule: true, state }),
      }));
      assert.ok(html.includes(`>${label}</span>`));
      assert.equal(html.includes('gameScore'), scored);
      assert.doesNotMatch(html, /<a\b/, 'admin preview without href has no destination');
    }
  });
  it('an upcoming game has full names and no invented scores or finished-state chip', () => {
    const html = renderToStaticMarkup(createElement(PublicGameRow, { schedule: true,
      view: gameRowView(game({ status: 'scheduled', awayScore: null, homeScore: null }), names, 'U11', '2026-10-29', { schedule: true, state: 'upcoming' }),
    }));
    assert.ok(html.includes(names.away) && html.includes(names.home));
    assert.doesNotMatch(html, /gameScore|gameStatus/);
  });
  it('live Schedule games reuse the paired rows and omit location/maps even if the base view contains them', () => {
    const view = liveCardView(game({ status: 'scheduled', awayScore: 3, homeScore: 2 }), names, 'U11', 'Secret park', 'https://maps.example/secret');
    const html = renderToStaticMarkup(createElement(PublicLiveCard, { view, href: '/club/event/schedule/g1',
      schedule: { time: '9:00 a.m.', division: 'U11', pool: 'Pool A', round: 'Championship' }, foot: 'The winner takes the title',
    }));
    assert.equal((html.match(/class="gameSide"/g) ?? []).length, 2);
    assert.match(html, /data-state="live">Live now/);
    assert.match(html, /U11 · Pool A/);
    assert.match(html, /The winner takes the title/);
    assert.doesNotMatch(html, /Secret park|maps\.example|Directions/);
  });
  it('scoreless live games say No score yet once, with no phantom zero', () => {
    const view = liveCardView(game({ status: 'scheduled', awayScore: null, homeScore: null }), names, 'U11', null, null);
    const html = renderToStaticMarkup(createElement(PublicLiveCard, { view, schedule: { time: '9:00 a.m.', division: 'U11' } }));
    assert.equal((html.match(/>No score yet</g) ?? []).length, 1);
    assert.doesNotMatch(html, /gameScore|<a\b/);
  });
  it('the Overview keeps its own row and live-card presentation, including Directions', () => {
    const live = renderToStaticMarkup(createElement(PublicLiveCard, {
      view: liveCardView(game(), names, 'U11', 'Park', 'https://maps.example/park'),
    }));
    assert.match(live, /href="https:\/\/maps\.example\/park"/);
    assert.match(live, /Directions to Park/);
    assert.doesNotMatch(live, /gameHead|gameSide/);
    const row = renderToStaticMarkup(createElement(PublicGameRow, { view: gameRowView(game(), names, 'U11 · Park', '2026-10-29') }));
    assert.match(row, /class="when">Final/);
    assert.doesNotMatch(row, /gameHead|gameSide/);
  });
});

/*
 * Public page layout standard Part 2a (owner rulings 2026-11-04, A2 + A4; docs/agents/design/PUBLIC_PAGE_LAYOUT_STANDARD.md
 * R6 + R9): one game, two forms; live is green everywhere; nobody is bold or soft until it is final; one pill set.
 */
describe('one game, two forms, and one live look (Public page layout standard Part 2a)', () => {
  const css = readCode('components/public/PublicSchedule.module.css');
  const live = (extra: Partial<Game> = {}) => liveCardView(game({ status: 'scheduled', awayScore: 3, homeScore: 2, ...extra }), names, 'U11', null, null);
  const two = (a: number | null, b: number | null) => [{ name: 'A', score: a, result: null }, { name: 'B', score: b, result: null }];

  it('A2: a live game sits on the SAME 104 · rest · 104 grid as every other wide row — its 1 : 2.2 : 1 grid is gone', () => {
    assert.match(css, /\.wideForm \{ display: grid; grid-template-columns: 104px minmax\(0, 1fr\) 104px;/);
    assert.doesNotMatch(css, /2\.2fr/, 'the live override squeezed the names and wrapped "Milton Bats U11 Purple (Jackson)" at 960 px');
    assert.doesNotMatch(css, /\[data-state='live'\] \{ grid-template-columns/);
    // "No score yet" keeps the middle cell under the teams, as shipped.
    assert.match(css, /\.wideForm\[data-state='live'\] \.gameNoScore \{ grid-column: 2; grid-row: 2; text-align: center; \}/);
    // The live card's 3 px edge + 12 px padding lands the time on the rows' 15 px line (1 px border + 14).
    assert.match(css, /\.liveCard \.wideForm \{ padding-left: 12px; padding-right: 14px; \}/);
  });

  it('a live game keeps both names in full ink: no bold leader, no soft trailer, on any surface', () => {
    const html = renderToStaticMarkup(createElement(PublicLiveCard, { view: live(), schedule: { time: '9:00 p.m.', division: 'U11' } }));
    assert.equal((html.match(/class="gameSide"/g) ?? []).length, 2);
    assert.doesNotMatch(html, /data-result=/);
    const overview = renderToStaticMarkup(createElement(PublicLiveCard, { view: live() }));
    assert.doesNotMatch(overview, /trailing/);
    assert.doesNotMatch(readCode('components/public/PublicParts.module.css'), /\.trailing \{/);
    // A game's page softens the side that is behind only once the game is decided.
    assert.match(readCode('components/public/PublicGameDetails.tsx'), /side\.trailing && !view\.live \? styles\.trailing/);
  });

  it('R9: one pill set everywhere (Live now green, Final neutral, Unofficial amber, Cancelled danger), a game\'s page included', () => {
    for (const [state, word] of [['live', 'Live now'], ['final', 'Final'], ['unofficial', 'Unofficial'], ['cancelled', 'Cancelled']] as const) {
      assert.equal(renderToStaticMarkup(createElement(GameStatusPill, { state })), `<span class="gameStatus" data-state="${state}">${word}</span>`);
    }
    assert.equal(renderToStaticMarkup(createElement(GameStatusPill, { state: 'upcoming' })), '');
    assert.match(css, /\.gameStatus \{[^}]*background: var\(--club-ground\); color: var\(--club-soft\);/, 'Final: the neutral pill');
    assert.match(css, /\.gameStatus\[data-state='live'\] \{ color: var\(--club-ok\);/);
    const page = readCode('components/public/PublicGameDetails.tsx');
    assert.doesNotMatch(page, /chipOk|chipWarn/, 'the page\'s Final was green like Live now');
    assert.match(page, /<GameStatusPill state=\{view\.state\} \/>/);
    assert.match(page, /<GameStatusPill state="cancelled" className=\{styles\.cancelled\} \/>/);
  });

  it('A4: the today\'s-games line says Live in green, its dot green, words unchanged', () => {
    const line = readCode('components/public/TodaysResultsLine.module.css');
    assert.match(line, /\.live \{ color: var\(--club-ok\); \}/);
    assert.match(line, /\.dot \{[^}]*background: var\(--club-ok\);/);
    assert.doesNotMatch(line, /--danger/);
  });

  it('the 3 px edge is one shape: a standalone card\'s left border with square left corners, a row in a list inset', () => {
    assert.match(css, /\.liveCard \{[^}]*border-left: 3px solid var\(--club-ok\); border-radius: 0 8px 8px 0;/);
    assert.match(css, /\.edge \{ box-shadow: inset 3px 0 0 var\(--club-ok\); \}/);
    assert.match(readCode('components/public/PublicPlayoffs.module.css'), /\.gameCard\[data-live\] \{ border-left: 3px solid var\(--club-ok\); border-radius: 0 8px 8px 0; \}/);
  });

  it('the stacked form at any width: its own class, never the wide row\'s desk grid or the Schedule\'s phone rules', () => {
    const html = renderToStaticMarkup(createElement(ScheduleMatchup, { form: 'stacked', time: '6:00 p.m.', division: 'U11', round: 'Championship',
      state: 'upcoming', href: '/x', sides: [{ name: names.away, score: null, result: null }, { name: 'Semifinal 2 winner', score: null, result: null, placeholder: true }],
      foot: 'The winner takes the U11 title' }));
    assert.match(html, /class="matchLink stacked"/);
    assert.doesNotMatch(html, /wideForm|edge/);
    assert.match(html, /data-placeholder="true"><span class="gameName">Semifinal 2 winner/);
    assert.match(html, /class="stakes">The winner takes the U11 title/);
    assert.match(css, /\.gameSide\[data-placeholder\] \.gameName \{ color: var\(--club-dim\); \}/);
    // Every desk one-line rule and both phone Schedule rules are scoped to the wide row, so the stacked form is one layout.
    const desk = css.slice(css.indexOf('/* Equal outer columns'), css.indexOf('@media (prefers-reduced-motion'));
    for (const rule of desk.split('\n').filter(l => /^ {2}\.[a-zA-Z]/.test(l))) assert.match(rule, /^ {2}\.(wideForm|liveCard \.wideForm)\b/, rule);
    assert.doesNotMatch(css, /\.matchLink\[data-state='final'\] \.gameTime|\.matchLink:not\(:has/);
    // The wide form stays the default, so the Schedule and Playoffs rows do not change.
    const wide = renderToStaticMarkup(createElement(ScheduleMatchup, { time: '9:00 a.m.', division: 'U11', state: 'final',
      sides: [{ name: 'A', score: 2, result: 'win' }, { name: 'B', score: 1, result: 'lose' }] }));
    assert.match(wide, /class="matchLink wideForm"/);
  });

  it('a live stacked row: the edge inside the row, and no pill under a "Live now" heading (said once)', () => {
    const html = renderToStaticMarkup(createElement(ScheduleMatchup, { form: 'stacked', pill: false, time: '9:00 p.m.', division: 'U11',
      state: 'live', href: '/x', sides: two(2, 3) }));
    assert.match(html, /class="matchLink stacked edge"/);
    assert.doesNotMatch(html, /gameStatus/);
    const pill = renderToStaticMarkup(createElement(ScheduleMatchup, { form: 'stacked', time: '9:00 p.m.', division: 'U11', state: 'live', sides: two(2, 3) }));
    assert.match(pill, /data-state="live">Live now</);
  });

  it('the place strip with Directions sits OUTSIDE the row\'s link and carries the edge; a plain field stays inside', () => {
    const html = renderToStaticMarkup(createElement(ScheduleMatchup, { form: 'stacked', pill: false, time: '9:00 p.m.', division: 'U11',
      state: 'live', href: '/x', sides: two(2, 3),
      place: { text: 'Lions Park, Diamond #2', action: createElement('a', { href: 'https://maps.example' }, 'Directions') } }));
    assert.match(html, /^<div class="withPlace edge"><a href="\/x" class="matchLink stacked" data-state="live">/);
    assert.ok(html.indexOf('</a><div class="placeStrip">') > 0, 'the row\'s link closes before the strip');
    assert.match(html, /<div class="placeStrip"><span>Lions Park, Diamond #2<\/span><a href="https:\/\/maps\.example">Directions<\/a><\/div><\/div>$/);
    const plain = renderToStaticMarkup(createElement(ScheduleMatchup, { form: 'stacked', time: '6:00 p.m.', division: 'U11', state: 'upcoming', href: '/x',
      sides: two(null, null), place: { text: 'Lions Park, Diamond #2' } }));
    assert.match(plain, /<span class="gamePlace">Lions Park, Diamond #2<\/span><\/a>$/);
  });

  it('the sizes: compact for a bracket match (14 / 16), large for a game\'s page (28 px scores, a plain foot strip)', () => {
    const large = renderToStaticMarkup(createElement(ScheduleMatchup, { form: 'stacked', size: 'large', time: '', division: 'U13', state: 'unofficial',
      sides: [{ name: 'A', score: 6, result: 'win' }, { name: 'B', score: 5, result: 'lose' }], foot: 'Not yet confirmed by the organizer', footTone: 'plain' }));
    assert.match(large, /data-size="large"/);
    assert.match(large, /class="stakes" data-tone="plain">Not yet confirmed by the organizer/);
    assert.match(css, /\.stacked\[data-size='compact'\] \.gameName \{ font-size: 0\.875rem; \}/);
    assert.match(css, /\.stacked\[data-size='compact'\] \.gameScore \{ font-size: 1rem; \}/);
    assert.match(css, /\.stacked\[data-size='large'\] \.gameScore \{ font-size: 1\.75rem; \}/);
    assert.match(css, /\.stakes\[data-tone='plain'\] \{ color: var\(--club-soft\); font-weight: 400; \}/);
    // A wide row never takes a size.
    const wide = renderToStaticMarkup(createElement(ScheduleMatchup, { size: 'large', time: '9:00 a.m.', division: 'U11', sides: two(null, null) }));
    assert.doesNotMatch(wide, /data-size/);
  });
});
