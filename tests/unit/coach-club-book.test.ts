/**
 * Club Shared Book — pure-logic tests (lib/coach-club-book.ts).
 *
 * The load-bearing claims, in the order they can hurt a customer:
 *   1. **Book content never crosses an organization.** The adversarial two-org fixture at the
 *      bottom is the non-negotiable one — it runs the REAL assembly against a reader that
 *      hands back the other club's rows the moment a call arrives without the right org.
 *   2. **Reciprocity is server-decided** — a non-sharing team sees nothing even when its
 *      siblings share, and opting out hides a team's book from siblings immediately.
 *   3. **The Club-plan gate is absent, not locked** — a non-Club org gets no switches and a
 *      payload with no club block at all.
 *   4. **Aliases resolve on BOTH sides** — the viewer's merged spellings reach the sibling's
 *      book, and the sibling's merged spellings reach the viewer's list rows.
 *   5. **Records are per team and never averaged** (owner ruling §8 Q5).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  resolveClubBookAccess,
  resolveClubBookAccessFor,
  matchSiblingBooks,
  combineSiblingRecord,
  siblingBlockHasContent,
  sortClubTeamBlocks,
  clubTeamExpanderLabel,
  clubObservationAttribution,
  clubContentKeys,
  buildClubBookBlock,
  buildClubContentKeys,
  CLUB_TEAM_OBSERVATION_CAP,
  CLUB_TEAM_PREVIEW_COUNT,
  type ClubBookReader,
  type ClubBookTeamBlock,
} from '../../lib/coach-club-book.ts';
import type { OpponentGameInput } from '../../lib/coach-opponents.ts';
import type { RepTeamOpponent, RepTeamOpponentObservation } from '../../lib/types.ts';

const NOW = '2026-06-20T00:00:00Z';

function opponent(over: Partial<RepTeamOpponent> & { id: string; teamId: string; normalizedName: string }): RepTeamOpponent {
  return {
    orgId: 'org-a',
    displayName: over.normalizedName,
    summary: null,
    lastNoteUpdatedAt: null,
    updatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  };
}

function observation(over: Partial<RepTeamOpponentObservation> & { id: string; opponentId: string }): RepTeamOpponentObservation {
  return {
    teamId: 't-a',
    orgId: 'org-a',
    eventId: null,
    body: 'They bunt the first strike',
    tag: null,
    createdBy: 'u-1',
    createdByName: 'Coach Dana',
    createdAt: '2026-06-14T22:00:00Z',
    ...over,
  };
}

function game(over: Partial<OpponentGameInput> & { id: string }): OpponentGameInput {
  return {
    name: 'League Game',
    eventType: 'league_game',
    startsAt: '2026-06-01T22:00:00Z',
    programYearId: 'py-2026',
    opponent: 'Oakville Thunder',
    homeAway: 'home',
    teamScore: 5,
    opponentScore: 3,
    result: 'win',
    status: 'completed',
    ...over,
  };
}

function block(over: Partial<ClubBookTeamBlock> & { teamId: string; teamName: string }): ClubBookTeamBlock {
  return {
    record: { wins: 0, losses: 0, ties: 0 },
    summary: null,
    observations: [],
    observationCount: 0,
    ...over,
  };
}

// ── The gate + reciprocity ──────────────────────────────────────────────────────────────

describe('the gate: Club plan, club admin, head coach — three keys, all server-side', () => {
  it('a non-Club org gets NOTHING: no switch, no layer (absent, not locked)', () => {
    for (const planId of ['tournament', 'tournament_plus', 'league', 'team'] as const) {
      const access = resolveClubBookAccess({ planId, orgEnabled: true, teamSharing: true });
      assert.equal(access.planIncluded, false, `${planId} must not include the club shared book`);
      assert.equal(access.showTeamSwitch, false, `${planId} must show no team switch`);
      assert.equal(access.canSeeClubLayer, false, `${planId} must never assemble a club layer`);
    }
  });

  it('a standalone Premium Coaches Portal is excluded on purpose — it has no siblings', () => {
    // `team` has explicit grants for other coach features (pdf_exports, coach_peer_chat); this
    // asserts the club book was deliberately left OUT of them rather than forgotten.
    const access = resolveClubBookAccess({ planId: 'team', orgEnabled: true, teamSharing: true });
    assert.equal(access.planIncluded, false);
  });

  it('both Club bands include it', () => {
    for (const planId of ['club', 'club_large'] as const) {
      assert.equal(resolveClubBookAccess({ planId, orgEnabled: true, teamSharing: true }).canSeeClubLayer, true);
    }
  });

  it('the club admin turns their key first — no team switch until the org enables it', () => {
    const access = resolveClubBookAccess({ planId: 'club', orgEnabled: false, teamSharing: true });
    assert.equal(access.showTeamSwitch, false, 'a coach must never be offered a switch that does nothing');
    assert.equal(access.canSeeClubLayer, false, 'and a stale team flag must not open the layer');
  });

  it('RECIPROCITY: a team that does not share sees nothing, even with the org enabled', () => {
    const access = resolveClubBookAccess({ planId: 'club', orgEnabled: true, teamSharing: false });
    assert.equal(access.showTeamSwitch, true, 'they can still turn sharing ON');
    assert.equal(access.canSeeClubLayer, false, 'but they read nothing while they contribute nothing');
  });

  it('opting out closes the door on the next read — nothing was ever copied', () => {
    const sharing = resolveClubBookAccess({ planId: 'club', orgEnabled: true, teamSharing: true });
    const optedOut = resolveClubBookAccess({ planId: 'club', orgEnabled: true, teamSharing: false });
    assert.equal(sharing.canSeeClubLayer, true);
    assert.equal(optedOut.canSeeClubLayer, false);
  });

  it('the org+team wiring helper gives the same answers as the raw resolver', () => {
    const org = { planId: 'club' as const, clubBookSharingEnabled: true };
    assert.deepEqual(
      resolveClubBookAccessFor(org, { shareClubBook: true }),
      resolveClubBookAccess({ planId: 'club', orgEnabled: true, teamSharing: true }),
    );
    assert.deepEqual(
      resolveClubBookAccessFor(org, { shareClubBook: false }),
      resolveClubBookAccess({ planId: 'club', orgEnabled: true, teamSharing: false }),
    );
  });

  it('asked WITHOUT a team (the admin route), it answers about the org and shares nothing', () => {
    const access = resolveClubBookAccessFor({ planId: 'club', clubBookSharingEnabled: true });
    assert.equal(access.planIncluded, true, 'the admin switch may render');
    assert.equal(access.orgEnabled, true);
    assert.equal(access.canSeeClubLayer, false, 'no team means no club layer to open');
  });
});

// ── Sibling resolution, aliases on both sides ───────────────────────────────────────────

describe('resolving one opponent across the club’s books', () => {
  const siblingOpponents = [
    opponent({ id: 'o-a', teamId: 't-a', normalizedName: 'oakville thunder', summary: 'Run early on them.' }),
    opponent({ id: 'o-b', teamId: 't-b', normalizedName: 'thunder 12u' }),
    opponent({ id: 'o-c', teamId: 't-c', normalizedName: 'burlington breeze' }),
  ];
  const siblingAliases = [
    // team B merged "oakville thunder" INTO their "thunder 12u" entry.
    { opponentId: 'o-b', teamId: 't-b', normalizedAlias: 'oakville thunder' },
  ];

  it('matches a sibling by their canonical name', () => {
    const matches = matchSiblingBooks({ matchKeys: ['oakville thunder'], siblingOpponents, siblingAliases });
    assert.deepEqual(matches.find(m => m.teamId === 't-a')?.opponentIds, ['o-a']);
  });

  it('matches through the SIBLING’s alias — their spelling differs, the team does not', () => {
    const matches = matchSiblingBooks({ matchKeys: ['oakville thunder'], siblingOpponents, siblingAliases });
    assert.deepEqual(matches.find(m => m.teamId === 't-b')?.opponentIds, ['o-b']);
  });

  it('matches through the VIEWER’s alias — their merged spelling reaches the sibling’s book', () => {
    // The viewer calls them "Thunder 12U" and has merged "Oakville Thunder" into it, so both
    // spellings are in the viewer's key space. Team A, who only knows the long name, matches.
    const matches = matchSiblingBooks({
      matchKeys: ['thunder 12u', 'oakville thunder'], siblingOpponents, siblingAliases,
    });
    assert.deepEqual(matches.map(m => m.teamId).sort(), ['t-a', 't-b']);
  });

  it('never matches a different opponent', () => {
    const matches = matchSiblingBooks({ matchKeys: ['oakville thunder'], siblingOpponents, siblingAliases });
    assert.equal(matches.some(m => m.teamId === 't-c'), false);
  });

  it('a spelling nobody in the club shares matches nothing — a miss costs a note, not correctness', () => {
    assert.deepEqual(matchSiblingBooks({ matchKeys: ['milton mavericks'], siblingOpponents, siblingAliases }), []);
  });

  it('an empty key space matches nothing (never "everything")', () => {
    assert.deepEqual(matchSiblingBooks({ matchKeys: ['', ''], siblingOpponents, siblingAliases }), []);
  });

  it('folds a sibling’s two un-merged spellings into ONE block, keeping both book lines’ words reachable', () => {
    const twoRows = [
      opponent({ id: 'o-1', teamId: 't-a', normalizedName: 'oakville thunder' }),
      opponent({ id: 'o-2', teamId: 't-a', normalizedName: 'thunder 12u', summary: 'Pressure the lefty.' }),
    ];
    const matches = matchSiblingBooks({
      matchKeys: ['oakville thunder', 'thunder 12u'], siblingOpponents: twoRows, siblingAliases: [],
    });
    assert.equal(matches.length, 1, 'one team, one voice');
    assert.deepEqual(matches[0].opponentIds.sort(), ['o-1', 'o-2']);
    assert.equal(matches[0].summary, 'Pressure the lefty.', 'a book line must not be dropped on the floor');
  });

  it('⚠ when BOTH folded rows carry a book line, NEITHER coach’s words are lost', () => {
    const twoRows = [
      opponent({ id: 'o-1', teamId: 't-a', normalizedName: 'oakville thunder', summary: 'Run early on them.' }),
      opponent({ id: 'o-2', teamId: 't-a', normalizedName: 'thunder 12u', summary: 'Pressure the lefty.' }),
    ];
    const matches = matchSiblingBooks({
      matchKeys: ['oakville thunder', 'thunder 12u'], siblingOpponents: twoRows, siblingAliases: [],
    });
    assert.equal(matches[0].summary, 'Run early on them.\nPressure the lefty.');
  });

  it('the same line written under two spellings is one thought, not two', () => {
    const twoRows = [
      opponent({ id: 'o-1', teamId: 't-a', normalizedName: 'oakville thunder', summary: 'Run early. ' }),
      opponent({ id: 'o-2', teamId: 't-a', normalizedName: 'thunder 12u', summary: 'Run early.' }),
    ];
    const matches = matchSiblingBooks({
      matchKeys: ['oakville thunder', 'thunder 12u'], siblingOpponents: twoRows, siblingAliases: [],
    });
    assert.equal(matches[0].summary, 'Run early.');
  });
});

// ── Records: per team, labelled, never averaged ─────────────────────────────────────────

describe('records stay each team’s own (§8 Q5 — no blending)', () => {
  it('adds only WITHIN one team’s matched entries', () => {
    const entries = [
      { key: 'oakville thunder', record: { wins: 2, losses: 1, ties: 0 } },
      { key: 'thunder 12u', record: { wins: 0, losses: 1, ties: 0 } },
      { key: 'burlington breeze', record: { wins: 9, losses: 9, ties: 9 } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any[];
    assert.deepEqual(
      combineSiblingRecord(entries, ['oakville thunder', 'thunder 12u']),
      { wins: 2, losses: 2, ties: 0 },
    );
  });

  it('an unmatched key set adds nothing at all', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entries = [{ key: 'burlington breeze', record: { wins: 9, losses: 9, ties: 9 } }] as any[];
    assert.deepEqual(combineSiblingRecord(entries, []), { wins: 0, losses: 0, ties: 0 });
  });
});

// ── Blocks: content, order, caps, attribution ───────────────────────────────────────────

describe('what a sibling block shows', () => {
  it('a team with a record but nothing to SAY is not a block', () => {
    assert.equal(siblingBlockHasContent(block({ teamId: 't', teamName: '10U' })), false);
    assert.equal(siblingBlockHasContent({ summary: '   ', observationCount: 0 }), false);
    assert.equal(siblingBlockHasContent({ summary: 'Run early.', observationCount: 0 }), true);
    assert.equal(siblingBlockHasContent({ summary: null, observationCount: 1 }), true);
  });

  it('the richest voice reads first, then alphabetical', () => {
    const sorted = sortClubTeamBlocks([
      block({ teamId: '1', teamName: '10U', observationCount: 1 }),
      block({ teamId: '2', teamName: '12U A', observationCount: 6 }),
      block({ teamId: '3', teamName: '12U B', observationCount: 1 }),
    ]);
    assert.deepEqual(sorted.map(b => b.teamName), ['12U A', '10U', '12U B']);
  });

  it('the expander promises only what it can show when the per-team cap bit', () => {
    const under = block({
      teamId: 't', teamName: '12U A', observationCount: 6,
      observations: Array.from({ length: 6 }, (_, i) => observation({ id: `x${i}`, opponentId: 'o' })),
    });
    assert.equal(clubTeamExpanderLabel(under), 'All 6 from 12U A ›');

    const capped = block({
      teamId: 't', teamName: '12U A', observationCount: 90,
      observations: Array.from({ length: CLUB_TEAM_OBSERVATION_CAP }, (_, i) => observation({ id: `x${i}`, opponentId: 'o' })),
    });
    assert.equal(clubTeamExpanderLabel(capped), `The latest ${CLUB_TEAM_OBSERVATION_CAP} of 90 from 12U A ›`);
  });

  it('no expander when everything is already on screen', () => {
    const small = block({
      teamId: 't', teamName: '10U', observationCount: CLUB_TEAM_PREVIEW_COUNT,
      observations: Array.from({ length: CLUB_TEAM_PREVIEW_COUNT }, (_, i) => observation({ id: `x${i}`, opponentId: 'o' })),
    });
    assert.equal(clubTeamExpanderLabel(small), null);
  });

  it('every note carries its team, with or without a writer’s name', () => {
    assert.equal(clubObservationAttribution({ createdByName: 'Coach Dana' }, '12U A'), 'Coach Dana · 12U A');
    assert.equal(clubObservationAttribution({ createdByName: null }, '12U A'), '12U A');
  });
});

// ── The opponents-list badge ────────────────────────────────────────────────────────────

describe('the list badge resolves sibling spellings INTO the viewer’s key space', () => {
  const viewerEntries = [
    { key: 'oakville thunder', aliasKeys: ['thunder 12u'] },
    { key: 'burlington breeze', aliasKeys: [] },
  ];

  it('a sibling’s merged spelling lights the viewer’s row for the same team', () => {
    const keys = clubContentKeys({
      viewerEntries,
      siblingOpponents: [opponent({ id: 'o-1', teamId: 't-a', normalizedName: 'thunder 12u', summary: 'Run early.' })],
      siblingAliases: [],
      observationCounts: {},
    });
    assert.deepEqual(keys, ['oakville thunder']);
  });

  it('a sibling row with NO content lights nothing — the badge means "we know something"', () => {
    const keys = clubContentKeys({
      viewerEntries,
      siblingOpponents: [opponent({ id: 'o-1', teamId: 't-a', normalizedName: 'burlington breeze' })],
      siblingAliases: [],
      observationCounts: {},
    });
    assert.deepEqual(keys, []);
  });

  it('observations alone are content', () => {
    const keys = clubContentKeys({
      viewerEntries,
      siblingOpponents: [opponent({ id: 'o-1', teamId: 't-a', normalizedName: 'burlington breeze' })],
      siblingAliases: [],
      observationCounts: { 'o-1': 3 },
    });
    assert.deepEqual(keys, ['burlington breeze']);
  });

  it('an opponent the viewer has never played still resolves to its own key', () => {
    const keys = clubContentKeys({
      viewerEntries,
      siblingOpponents: [opponent({ id: 'o-1', teamId: 't-a', normalizedName: 'milton mavericks', summary: 'x' })],
      siblingAliases: [],
      observationCounts: {},
    });
    assert.deepEqual(keys, ['milton mavericks']);
  });
});

// ── The assembly, end to end ────────────────────────────────────────────────────────────

/**
 * A reader over a fixture of TWO organizations.
 *
 * ⚠ **It is deliberately hostile.** Every method answers the question it was asked *for the
 * org it was given* — which means a call that arrives with the wrong org id, or with team ids
 * belonging to another club, is answered with THAT club's rows. This is precisely what an
 * unfiltered `.in('team_id', …)` query would do. If the assembly ever stops carrying the org
 * boundary, the leakage test below fails with the other club's words in the payload.
 */
function twoOrgReader(calls: { orgIds: string[] } = { orgIds: [] }): ClubBookReader {
  const teams = [
    { id: 't-a1', orgId: 'org-a', name: '12U A', sharing: true },
    { id: 't-a2', orgId: 'org-a', name: '10U', sharing: true },
    { id: 't-a3', orgId: 'org-a', name: '14U (not sharing)', sharing: false },
    { id: 't-b1', orgId: 'org-b', name: 'RIVAL CLUB 12U', sharing: true },
  ];
  const opponents = [
    opponent({ id: 'o-a1', teamId: 't-a1', orgId: 'org-a', normalizedName: 'oakville thunder', summary: 'Run early on them.' }),
    opponent({ id: 'o-a2', teamId: 't-a2', orgId: 'org-a', normalizedName: 'thunder 12u' }),
    opponent({ id: 'o-a3', teamId: 't-a3', orgId: 'org-a', normalizedName: 'oakville thunder', summary: 'SECRET — not sharing.' }),
    opponent({ id: 'o-b1', teamId: 't-b1', orgId: 'org-b', normalizedName: 'oakville thunder', summary: 'ANOTHER CLUB’S BOOK LINE.' }),
  ];
  const aliases = [
    { opponentId: 'o-a2', teamId: 't-a2', normalizedAlias: 'oakville thunder' },
  ];
  const observations: Record<string, RepTeamOpponentObservation[]> = {
    'o-a1': [
      observation({ id: 'ob-1', opponentId: 'o-a1', teamId: 't-a1', body: 'Their SS cheats up with runners on', createdAt: '2026-06-14T22:00:00Z' }),
      observation({ id: 'ob-2', opponentId: 'o-a1', teamId: 't-a1', body: '#14 lefty struggled once we ran on her', createdByName: 'AC Priya', createdAt: '2026-06-14T23:00:00Z' }),
    ],
    'o-a2': [observation({ id: 'ob-3', opponentId: 'o-a2', teamId: 't-a2', body: 'Slow infield rotations on bunt coverage', createdByName: 'Coach Malik', createdAt: '2026-05-31T22:00:00Z' })],
    'o-a3': [observation({ id: 'ob-9', opponentId: 'o-a3', teamId: 't-a3', body: 'SECRET — not sharing' })],
    'o-b1': [observation({ id: 'ob-x', opponentId: 'o-b1', teamId: 't-b1', body: 'ANOTHER CLUB’S OBSERVATION' })],
  };
  const events: Record<string, OpponentGameInput[]> = {
    't-a1': [
      game({ id: 'g1', opponent: 'Oakville Thunder', result: 'win' }),
      game({ id: 'g2', opponent: 'Oakville Thunder', result: 'win', startsAt: '2026-05-17T22:00:00Z' }),
      game({ id: 'g3', opponent: 'Oakville Thunder', result: 'loss', teamScore: 2, opponentScore: 4, startsAt: '2025-07-02T22:00:00Z' }),
    ],
    't-a2': [game({ id: 'g4', opponent: 'Thunder 12U', result: 'tie', teamScore: 4, opponentScore: 4 })],
    't-b1': [game({ id: 'g5', opponent: 'Oakville Thunder', result: 'win' })],
  };

  return {
    async siblingTeams(orgId, viewerTeamId) {
      calls.orgIds.push(orgId);
      return teams.filter(t => t.orgId === orgId && t.sharing && t.id !== viewerTeamId)
        .map(t => ({ id: t.id, name: t.name }));
    },
    async opponents(orgId, teamIds) {
      calls.orgIds.push(orgId);
      return opponents.filter(o => o.orgId === orgId && teamIds.includes(o.teamId));
    },
    async aliases(orgId, teamIds) {
      calls.orgIds.push(orgId);
      const inOrg = new Set(opponents.filter(o => o.orgId === orgId).map(o => o.id));
      return aliases.filter(a => inOrg.has(a.opponentId) && teamIds.includes(a.teamId));
    },
    async observations(orgId, opponentIds, cap) {
      calls.orgIds.push(orgId);
      const out: Record<string, { observations: RepTeamOpponentObservation[]; total: number }> = {};
      for (const id of opponentIds) {
        const owner = opponents.find(o => o.id === id);
        if (!owner || owner.orgId !== orgId) continue;
        const rows = observations[id] ?? [];
        out[id] = { observations: rows.slice(0, cap), total: rows.length };
      }
      return out;
    },
    async observationCounts(orgId, teamIds) {
      calls.orgIds.push(orgId);
      const counts: Record<string, number> = {};
      for (const [opponentId, rows] of Object.entries(observations)) {
        const owner = opponents.find(o => o.id === opponentId);
        if (!owner || owner.orgId !== orgId || !teamIds.includes(owner.teamId)) continue;
        counts[opponentId] = rows.length;
      }
      return counts;
    },
    async gameEventsByTeam(teamIds) {
      const out: Record<string, OpponentGameInput[]> = {};
      for (const id of teamIds) out[id] = events[id] ?? [];
      return out;
    },
  };
}

describe('assembling the club layer', () => {
  it('gathers both sharing siblings, each labelled with its own record and voice', async () => {
    const club = await buildClubBookBlock(twoOrgReader(), {
      orgId: 'org-a', viewerTeamId: 't-a9', matchKeys: ['oakville thunder'], nowIso: NOW,
    });
    assert.ok(club, 'expected a club block');
    assert.deepEqual(club!.teams.map(t => t.teamName), ['12U A', '10U']);

    const a = club!.teams.find(t => t.teamName === '12U A')!;
    assert.deepEqual(a.record, { wins: 2, losses: 1, ties: 0 }, 'their own record, their own games');
    assert.equal(a.summary, 'Run early on them.');
    assert.equal(a.observationCount, 2);

    const b = club!.teams.find(t => t.teamName === '10U')!;
    assert.deepEqual(b.record, { wins: 0, losses: 0, ties: 1 }, 'reached through THEIR alias');
    assert.equal(b.summary, null, 'no book line is honestly no book line');

    assert.equal(club!.observationCount, 3, 'the drawer teaser’s one number');
  });

  it('a NON-SHARING sibling contributes nothing, even inside the same club', async () => {
    const club = await buildClubBookBlock(twoOrgReader(), {
      orgId: 'org-a', viewerTeamId: 't-a9', matchKeys: ['oakville thunder'], nowIso: NOW,
    });
    const serialized = JSON.stringify(club);
    assert.equal(serialized.includes('SECRET'), false, 'a team that has not opted in is not in the club layer');
    assert.equal(club!.teams.some(t => t.teamName.includes('14U')), false);
  });

  it('the viewer’s own team is never in its own club layer', async () => {
    const club = await buildClubBookBlock(twoOrgReader(), {
      orgId: 'org-a', viewerTeamId: 't-a1', matchKeys: ['oakville thunder'], nowIso: NOW,
    });
    assert.equal(club!.teams.some(t => t.teamId === 't-a1'), false);
    assert.deepEqual(club!.teams.map(t => t.teamName), ['10U']);
  });

  it('returns null — an ABSENT section, never an empty shell — when the club knows nothing', async () => {
    assert.equal(await buildClubBookBlock(twoOrgReader(), {
      orgId: 'org-a', viewerTeamId: 't-a9', matchKeys: ['milton mavericks'], nowIso: NOW,
    }), null);
  });

  it('returns null when the org has no other sharing teams at all', async () => {
    assert.equal(await buildClubBookBlock(twoOrgReader(), {
      orgId: 'org-b', viewerTeamId: 't-b1', matchKeys: ['oakville thunder'], nowIso: NOW,
    }), null);
  });

  it('the list badge sees the same club and no more', async () => {
    const keys = await buildClubContentKeys(twoOrgReader(), {
      orgId: 'org-a',
      viewerTeamId: 't-a9',
      viewerEntries: [{ key: 'oakville thunder', aliasKeys: ['thunder 12u'] }],
    });
    assert.deepEqual(keys, ['oakville thunder'], 'both siblings’ spellings collapse onto the viewer’s row');
  });
});

// ── THE NON-NEGOTIABLE ──────────────────────────────────────────────────────────────────

describe('⚠ book content NEVER crosses an organization', () => {
  it('a club’s layer contains no other club’s book line, notes, teams or record', async () => {
    const club = await buildClubBookBlock(twoOrgReader(), {
      orgId: 'org-a', viewerTeamId: 't-a9', matchKeys: ['oakville thunder'], nowIso: NOW,
    });
    const serialized = JSON.stringify(club);
    for (const forbidden of ['ANOTHER CLUB', 'RIVAL CLUB', 't-b1', 'o-b1', 'ob-x']) {
      assert.equal(serialized.includes(forbidden), false,
        `the other organization's "${forbidden}" reached org-a's club layer`);
    }
  });

  it('the badge lookup is org-scoped too', async () => {
    const keys = await buildClubContentKeys(twoOrgReader(), {
      orgId: 'org-b',
      viewerTeamId: 't-b9',
      viewerEntries: [{ key: 'oakville thunder', aliasKeys: [] }],
    });
    // org-b's only sharing team is t-b1; a viewer in org-b sees ITS content and never org-a's.
    assert.deepEqual(keys, ['oakville thunder']);
    const leaky = await buildClubContentKeys(twoOrgReader(), {
      orgId: 'org-b',
      viewerTeamId: 't-b1', // exclude the only sharing team → nothing left in this org
      viewerEntries: [{ key: 'oakville thunder', aliasKeys: [] }],
    });
    assert.deepEqual(leaky, [], 'with no sharing siblings in THIS org, another org fills no gap');
  });

  it('every read the assembly performs is asked for exactly ONE org — the viewer’s', async () => {
    const calls = { orgIds: [] as string[] };
    await buildClubBookBlock(twoOrgReader(calls), {
      orgId: 'org-a', viewerTeamId: 't-a9', matchKeys: ['oakville thunder'], nowIso: NOW,
    });
    assert.ok(calls.orgIds.length >= 4, `expected the org-scoped reads, saw ${calls.orgIds.length}`);
    assert.deepEqual([...new Set(calls.orgIds)], ['org-a'],
      'a read that forgets its org is a read that can return another club’s book');
  });
});
