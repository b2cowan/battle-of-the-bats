import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { teamProfileNextChange, teamProfilePreview, teamProfileView } from '../../lib/public-team-profile.ts';
import { now, profileFixture } from './_public-team-profile-fixture.ts';


describe('preview-only team-profile metadata and the shared team view', () => {
  it('sorts future games and results with database-null start times without crashing', () => {
    const { profile, options } = profileFixture();
    const untimed = null as unknown as string;
    profile.games.push({ ...profile.games[2], id:'next-null', date:'2026-10-31', time:untimed },
      { ...profile.games[2], id:'next-timed', date:'2026-10-31', time:'12:00' },
      { ...profile.games[0], id:'result-null', date:'2026-10-29', time:untimed });
    const view = teamProfileView(teamProfilePreview(profile, options), now);
    assert.deepEqual(view.next.map(g => g.game.id), ['next-null', 'next-timed']);
    assert.match(view.next[0].time, /Time TBD/);
    assert.deepEqual(view.results.map(g => g.id), ['recent', 'result-null', 'older']);
  });
  it('marks playoff spots using the same combined or per-pool cut as Standings', () => {
    const { profile, options } = profileFixture();
    options.division.playoffConfig = { teamsQualifying:1, crossover:'standard' } as NonNullable<typeof options.division.playoffConfig>;
    options.rows = [ { ...options.rows[1], poolId:'b' }, options.rows[0], options.rows[2] ];
    assert.equal(teamProfilePreview(profile, options).standings.inPlayoffSpot, false);
    options.division.playoffConfig.crossover = 'none';
    assert.equal(teamProfilePreview(profile, options).standings.inPlayoffSpot, true);
    assert.equal(teamProfilePreview(profile, { ...options, standingsShown:false }).standings.inPlayoffSpot, false);
  });
  it('an unfilled playoff slot never makes a qualified team read No more games', () => {
    const { profile, options } = profileFixture();
    profile.games.pop();
    options.games = [...profile.games, { ...profile.games[0], id:'unseeded-final', isPlayoff:true,
      status:'scheduled', homeTeamId:'', awayTeamId:'', bracketCode:'FIN', homeScore:undefined, awayScore:undefined }];
    let view = teamProfileView(teamProfilePreview(profile, options), now);
    assert.equal(view.moment.kind, 'pending');
    assert.equal(view.noMoreGames, false);
    options.games[2].status = 'cancelled';
    view = teamProfileView(teamProfilePreview(profile, options), now);
    assert.equal(view.noMoreGames, true);
  });
  it('advances locally at kickoff and the live-window end using unchanged feed data', () => {
    const { profile, options } = profileFixture();
    const data = teamProfilePreview(profile, options);
    const kickoff = new Date('2026-10-30T18:00:00Z');
    const before = new Date(kickoff.getTime() - 1);
    assert.equal(teamProfileNextChange(data, before), kickoff.getTime());
    assert.equal(teamProfileView(data, before).moment.kind, 'upcoming');
    assert.equal(teamProfileView(data, kickoff).moment.kind, 'live');
    const end = teamProfileNextChange(data, kickoff)!;
    assert.equal(end, kickoff.getTime() + 120 * 60_000);
    assert.equal(teamProfileView(data, new Date(end)).moment.kind, 'none');
    assert.equal(teamProfileNextChange(data, new Date(end)), null);
  });
  it('place and pool subtitle follow the list grouping when a pool is alone or deleted', () => {
    const { profile, options } = profileFixture();
    options.division.pools = options.division.pools!.slice(0,1);
    const single = teamProfilePreview(profile, options);
    assert.equal(single.preview.place?.label, 'Place in U11');
    assert.equal(single.poolName, null);
    options.division.pools.push({ ...options.division.pools[0], id:'b', name:'B' });
    profile.team.poolId = 'deleted'; options.rows[0].poolId = 'deleted';
    const deleted = teamProfilePreview(profile, options);
    assert.equal(deleted.preview.place?.label, 'Place in Awaiting assignment');
    assert.equal(deleted.preview.place?.value, '1st of 1');
    assert.equal(deleted.poolName, null);
  });
  it('supplies group place and the title-game stakes without a roster or standings table', () => {
    const { profile, options } = profileFixture();
    const before = structuredClone(profile);
    const result = teamProfilePreview(profile, options);
    assert.equal(result.preview.place?.label, 'Place in A Pool');
    assert.equal(result.preview.place?.value, '1st of 3');
    assert.deepEqual(result.preview.stakes.final, { text: 'The winner takes the title', gold: true });
    assert.equal('places' in result.preview, false);
    assert.deepEqual(profile, before);
    assert.equal('teams' in result.preview, false);
    assert.equal('rows' in result.preview, false);
    assert.equal('standings' in result.preview, false);
  });
  it('puts the team being read first and bold independently of home/away or score lead', () => {
    const { profile, options } = profileFixture();
    Object.assign(profile.games[2], { homeScore: 2, awayScore: 5 });
    const view = teamProfileView(teamProfilePreview(profile, options), now);
    assert.equal(view.moment.kind, 'live');
    assert.deepEqual(view.focus?.view.sides.map(s => [s.name,s.score]), [['Riverdale Rapids',2],['Cedar Hollow Cyclones',5]]);
    assert.equal(view.focus?.time, '2:00 p.m.');
    assert.equal(view.focus?.round, 'Championship');
    assert.equal(view.focus?.view.directionsHref, null);
    assert.deepEqual(view.results.map(r => r.id), ['recent','older']);
    assert.equal(view.results[0].date, 'Oct 29');
  });
  it('scoreless live has one No score yet and never an invented zero score', () => {
    const { profile, options } = profileFixture();
    const view = teamProfileView(teamProfilePreview(profile, options), now);
    assert.equal(view.focus?.view.noScore, 'No score yet');
    assert.deepEqual(view.focus?.view.sides.map(s => s.score), [null,null]);
  });
  it('retains tomorrow/later days, readable TBDs, and no duplicate next game', () => {
    const { profile, options } = profileFixture();
    Object.assign(profile.games[2], { date:'2026-10-31', time:'09:00', awayTeamId:'', awayPlaceholder:'Winner SF1' });
    profile.games.push({ ...profile.games[2], id:'later', date:'2026-11-01', time:'10:30' });
    const view = teamProfileView(teamProfilePreview(profile, options), now);
    assert.equal(view.moment.kind, 'upcoming');
    assert.equal(view.focus!.time, 'Tomorrow · 9:00 a.m.');
    assert.equal(view.focus!.row.when, 'Championship');
    assert.equal(view.focus!.row.head, 'Tomorrow · 9:00 a.m.');
    assert.equal(view.focus!.view.sides[1].name, 'Semifinal 1 winner');
    assert.deepEqual(view.next.map(g => g.game.id), ['later']);
    assert.match(view.next[0].time, /^Sun, Nov 1 · /);
  });
  it('only a decided, completed division crowns a winner; the final enters Results once', () => {
    const { profile, options } = profileFixture();
    Object.assign(profile.games[2], { status:'completed', homeScore:5, awayScore:2 });
    profile.standings.isChampion = true;
    const view = teamProfileView(teamProfilePreview(profile, options), now);
    assert.equal(view.moment.kind,'champion');
    assert.equal(view.chip,'Division Champion');
    assert.equal(view.focus,null);
    assert.equal(view.results.filter(r => r.id === 'final').length,1);
    assert.equal(view.results[0].round,'Playoff · Championship');
    assert.equal(view.results[0].score,'W 5–2');
    options.games = [...profile.games, { ...profile.games[2], id:'placement', bracketCode:'3RD', status:'scheduled', time:'17:00', homeTeamId:'third', awayTeamId:'other' }];
    const pending = teamProfileView(teamProfilePreview(profile, options), now);
    assert.equal(pending.moment.kind,'none');
    assert.equal(pending.chip,null);
  });
  it('runner-up has a chip without the optional No more games line; other results-only teams have the line', () => {
    const { profile, options } = profileFixture();
    Object.assign(profile.games[2], { status:'completed', homeScore:2, awayScore:5 });
    profile.standings.isRunnerUp = true;
    let view = teamProfileView(teamProfilePreview(profile, options), now);
    assert.equal(view.chip,'Runner-up'); assert.equal(view.noMoreGames,false);
    profile.games.pop(); options.games = [];
    profile.standings.isRunnerUp = false;
    view = teamProfileView(teamProfilePreview(profile, options), now);
    assert.equal(view.chip,null); assert.equal(view.noMoreGames,true);
  });
  it('hides place/crown/record visibility when Standings is off, without changing the legacy profile', () => {
    const { profile, options } = profileFixture();
    Object.assign(profile.games[2], { status:'completed', homeScore:5, awayScore:2 });
    const next = teamProfilePreview(profile, {...options, standingsShown:false});
    assert.equal(next.preview.place,null);
    assert.equal(next.preview.champion,false);
    assert.equal(next.preview.standingsShown,false);
    assert.deepEqual(next.standings,{ ...profile.standings, inPlayoffSpot:false });
  });
  it('never exposes a held-back opponent name through games, name maps or metadata', () => {
    const { profile, options } = profileFixture();
    options.teams[1].divisionId = 'hidden';
    profile.teamNames.other = 'Secret team';
    profile.games[2].awayTeamName = 'Secret team';
    const next = teamProfilePreview(profile,options);
    assert.equal(next.teamNames.other,undefined);
    assert.equal(next.games[2].awayTeamName,'TBD');
    assert.equal(next.games[2].awayTeamId,'');
    assert.doesNotMatch(JSON.stringify(next),/Secret team|123@example/);
  });
  it('the preview strips score-submission identity while leaving the original response untouched', () => {
    const {profile,options}=profileFixture();
    profile.games[0].scoreSubmittedByEmail='private@example.test';
    profile.games[0].scoreSubmittedByUserId='private-user';
    const next=teamProfilePreview(profile,options);
    assert.equal('scoreSubmittedByEmail' in next.games[0],false);
    assert.equal('scoreSubmittedByUserId' in next.games[0],false);
    assert.equal(profile.games[0].scoreSubmittedByEmail,'private@example.test');
  });
  it('a crossover uses that game’s division duration, then the tournament default, rather than the team’s other division', () => {
    const {profile,options}=profileFixture();
    options.division.settings={game_duration_minutes:180};
    options.divisions.push({...options.division,id:'cross',settings:{}});
    profile.games[2]={...profile.games[2],divisionId:'cross',time:'11:30'};
    profile.gameDurationMinutes=180;
    const result=teamProfilePreview(profile,{...options,defaultDuration:90});
    assert.equal(result.preview.divisions.find(d=>d.id==='cross')?.settings.game_duration_minutes,90);
    assert.notEqual(teamProfileView(result,now).moment.kind,'live');
  });
});
