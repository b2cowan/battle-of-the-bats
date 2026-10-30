import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { billingTestLoader as tsxTestLoader } from './_billing-test-loader.ts';
import { readCode } from './_source-code.ts';
import { gameRowView, liveCardView } from '../../lib/public-game-row.ts';
import type { Game } from '../../lib/types.ts';

const load = tsxTestLoader();
const { PublicGameRow, ScheduleMatchup } = load('components/public/PublicGameRow.tsx') as typeof import('../../components/public/PublicGameRow.tsx');
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
