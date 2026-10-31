/** Stage 5 DEV fixtures. Only reserved, marked clones; every mutation is read back.
 * node --env-file=.env.local scripts/seed-public-stage5-fixtures.mjs prepare|show|refresh|score|no-score|between|final|withhold|publish|undo
 * The existing Stage 4 source and every demo are read-only. Column shapes come from the live source and dev snapshot.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const endpoint = process.env.NEXT_PUBLIC_SUPABASE_URL;
assert.ok(endpoint && new URL(endpoint).hostname === 'npgnrxaitgbtbtvvykto.supabase.co' && process.env.SUPABASE_SERVICE_ROLE_KEY,
  'Only the known development database is permitted.');
const db = createClient(endpoint, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession:false } });
const mode = process.argv[2] ?? 'show';
assert.ok(['prepare','show','refresh','score','no-score','between','final','withhold','publish','undo'].includes(mode));
const marker = 'seed-public-stage5-fixtures.mjs';
const file = new URL('../.probe/stage5-fixtures.json', import.meta.url);
let saved = existsSync(file) ? JSON.parse(readFileSync(file,'utf8')) : null;
const read = async query => { const {data,error}=await query; if(error) throw error; return data; };
const save = () => { mkdirSync(new URL('../.probe/',import.meta.url),{recursive:true});writeFileSync(file,JSON.stringify(saved,null,2)); };
const clean = row => Object.fromEntries(Object.entries(row).filter(([key])=>!['created_at','updated_at','results_notified_at','results_notification_sent_count'].includes(key)));
const date = value => new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).format(value);
const clock = value => new Intl.DateTimeFormat('en-GB',{timeZone:'America/Toronto',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(value);
const day = offset => { const d=new Date(`${date(new Date())}T12:00:00Z`); d.setUTCDate(d.getUTCDate()+offset);return date(d); };
async function insert(table, rows) {
  if(!rows.length)return;
  const {error}=await db.from(table).insert(rows);if(error)throw error;
  const actual=await read(db.from(table).select('*').in('id',rows.map(r=>r.id)));
  assert.equal(actual.length,rows.length);
  for(const row of rows)for(const [key,value] of Object.entries(row)){
    const got=actual.find(r=>r.id===row.id)[key];
    assert.deepEqual(key==='game_time'?got?.slice(0,5):got,key==='game_time'?value?.slice(0,5):value,`${table}.${key}`);
  }
}
async function update(table,id,fields) {
  const fixture=saved.fixtures.find(f=>table==='tournaments'?f.id===id:table==='divisions'?f.divisionId===id:table==='games'&&f.focusGameId===id);
  assert.ok(fixture&&await owned(fixture),'Update must belong to a reserved marked clone.');
  const parent=table==='tournaments'?'org_id':'tournament_id';
  const parentId=table==='tournaments'?org.id:fixture.id;
  const before=await read(db.from(table).select(`id,${parent}`).eq('id',id).single());
  assert.equal(before[parent],parentId,'Refusing a record outside the owned clone.');
  const {error}=await db.from(table).update(fields).eq('id',id).eq(parent,parentId);if(error)throw error;
  const actual=await read(db.from(table).select(Object.keys(fields).join(',')).eq('id',id).eq(parent,parentId).single());
  for(const [key,value] of Object.entries(fields)){
    if(key==='champions_crowned_at'&&value!==null)assert.equal(Date.parse(actual[key]),Date.parse(value));
    else assert.deepEqual(key==='game_time'?actual[key]?.slice(0,5):actual[key],key==='game_time'?value?.slice(0,5):value);
  }
}
const org=await read(db.from('organizations').select('id,internal_notes').eq('slug','stage1-metro-sports').single());
assert.ok(org.internal_notes?.includes('seed-public-frame-fixtures.mjs'));
if(saved)assert.equal(saved.orgId,org.id);
async function owned(fixture) {
  assert.ok(saved.fixtures.some(f=>f.id===fixture.id));
  const row=await read(db.from('tournaments').select('id,slug,settings').eq('id',fixture.id).eq('org_id',org.id).maybeSingle());
  if(row){assert.equal(row.slug,fixture.slug);assert.equal(row.settings?.stage5Fixture,marker);}
  return row;
}
async function anchor(fixture,state=fixture.kind) {
  assert.ok(await owned(fixture));
  if(!fixture.focusGameId)return;
  const instant=new Date(Date.now()+(state==='between'?45:-10)*60_000);
  await update('games',fixture.focusGameId,{game_date:date(instant),game_time:clock(instant),status:state==='champion'?'completed':'scheduled',
    home_score:['live','champion'].includes(state)?5:null,away_score:['live','champion'].includes(state)?3:null});
  await update('tournaments',fixture.id,{champions_crowned_at:state==='champion'?new Date().toISOString():null});
}

if(mode==='prepare'){
  assert.equal(saved,null,'Reserved fixtures already exist; use refresh or undo.');
  const source=await read(db.from('tournaments').select('*').eq('org_id',org.id).eq('slug','stage4-live').single());
  assert.equal(source.settings?.stage4Fixture,'seed-public-stage4-fixtures.mjs');
  const [divisions,teams,games,venues,facilities]=await Promise.all([
    read(db.from('divisions').select('*').eq('tournament_id',source.id)),read(db.from('teams').select('*').eq('tournament_id',source.id)),
    read(db.from('games').select('*').eq('tournament_id',source.id)),read(db.from('diamonds').select('*').eq('tournament_id',source.id)),
    read(db.from('venue_facilities').select('*').eq('tournament_id',source.id)),
  ]);
  const pools=await read(db.from('pools').select('*').in('division_id',divisions.map(d=>d.id)));
  const final=games.find(g=>g.bracket_code==='FIN' && g.home_team_id && g.away_team_id);
  assert.ok(final,'The marked Stage 4 source needs a final with both teams known.');
  const targetDivision=divisions.find(d=>d.id===final.division_id);
  const out=teams.find(t=>t.division_id===final.division_id && ![final.home_team_id,final.away_team_id].includes(t.id)
    && games.some(g=>g.home_team_id===t.id||g.away_team_id===t.id));
  assert.ok(out);
  saved={orgId:org.id,fixtures:['live','between','results','champion','held','pool','empty'].map(kind=>({kind,id:randomUUID(),slug:`stage5-${kind}`}))};save();
  for(const fixture of saved.fixtures){
    const ids=new Map();const map=id=>{if(!id)return null;if(!ids.has(id))ids.set(id,randomUUID());return ids.get(id);};
    const settings={...source.settings,stage5Fixture:marker};delete settings.stage4Fixture;
    await insert('tournaments',[{...clean(source),id:fixture.id,slug:fixture.slug,name:`Stage 5 · ${fixture.kind}`,status:'active',
      is_active:false,list_in_directory:false,start_date:day(-2),end_date:day(3),champions_crowned_at:null,settings}]);
    const divs=divisions.map(d=>({...clean(d),id:map(d.id),tournament_id:fixture.id,
      schedule_visibility:fixture.kind==='held'&&d.id===targetDivision.id?'unpublished':'published'}));
    fixture.divisionId=map(targetDivision.id);save();
    await insert('divisions',divs);
    const clonedPools=pools.map(p=>({...clean(p),id:map(p.id),division_id:map(p.division_id)}));
    let targetPool=null;
    if(fixture.kind==='pool'){
      const existing=clonedPools.filter(p=>p.division_id===fixture.divisionId);
      while(existing.length<2){const p={id:randomUUID(),division_id:fixture.divisionId,name:existing.length?'B':'A',display_order:existing.length,settings:{}};existing.push(p);clonedPools.push(p);}
      targetPool=existing[0].id;
      await update('divisions',fixture.divisionId,{pool_count:2});
    }
    await insert('pools',clonedPools);
    const clonedTeams=teams.map(t=>({...clean(t),id:map(t.id),tournament_id:fixture.id,division_id:map(t.division_id),
      pool_id:fixture.kind==='pool'&&t.division_id===targetDivision.id?targetPool:map(t.pool_id),status:'accepted',
      ...(t.id===final.home_team_id?{name:'Greater Riverdale Northern Lights Select Black (Johnstone)'}:{})}));
    fixture.teamId=map(fixture.kind==='results'||fixture.kind==='empty'?out.id:final.home_team_id);save();
    await insert('teams',clonedTeams);
    await insert('diamonds',venues.map(v=>({...clean(v),id:map(v.id),tournament_id:fixture.id})));
    await insert('venue_facilities',facilities.map(f=>({...clean(f),id:map(f.id),tournament_id:fixture.id,venue_id:map(f.venue_id)})));
    const rows=games.filter(g=>fixture.kind!=='empty'||![g.home_team_id,g.away_team_id].includes(out.id)).map(g=>({...clean(g),id:map(g.id),
      tournament_id:fixture.id,division_id:map(g.division_id),home_team_id:map(g.home_team_id),away_team_id:map(g.away_team_id),
      diamond_id:map(g.diamond_id),venue_facility_id:map(g.venue_facility_id),bracket_id:map(g.bracket_id),home_slot_id:null,away_slot_id:null,
      schedule_facility_lane_id:null,score_submitted_by_user_id:null,score_submitted_by_email:null,
      game_date:day(-1),game_time:'09:00',status:'completed',home_score:5,away_score:3}));
    await insert('games',rows);
    fixture.focusGameId=rows.some(g=>g.id===map(final.id))?map(final.id):null;save();
    if(['live','between','held','pool','champion'].includes(fixture.kind))await anchor(fixture,fixture.kind==='champion'?'champion':fixture.kind==='between'?'between':'live');
    console.log(`Prepared ${fixture.kind} and read back: /stage1-metro-sports/${fixture.slug}/teams/${fixture.teamId}`);
  }
}else{
  assert.ok(saved,'Run prepare first.');
  if(mode==='undo'){
    for(const fixture of saved.fixtures){
      if(!await owned(fixture))continue;
      const divisions=await read(db.from('divisions').select('id').eq('tournament_id',fixture.id));
      for(const table of ['games','venue_facilities','diamonds','teams']){
        const {error}=await db.from(table).delete().eq('tournament_id',fixture.id);if(error)throw error;
        assert.equal((await read(db.from(table).select('id').eq('tournament_id',fixture.id))).length,0);
      }
      if(divisions.length){const query=()=>db.from('pools').select('id').in('division_id',divisions.map(d=>d.id));const {error}=await db.from('pools').delete().in('division_id',divisions.map(d=>d.id));if(error)throw error;assert.equal((await read(query())).length,0);}
      const {error}=await db.from('divisions').delete().eq('tournament_id',fixture.id);if(error)throw error;
      assert.equal((await read(db.from('divisions').select('id').eq('tournament_id',fixture.id))).length,0);
      const removal=await db.from('tournaments').delete().eq('id',fixture.id).eq('org_id',org.id);if(removal.error)throw removal.error;
      assert.equal(await owned(fixture),null);
    }
    unlinkSync(file);console.log('Only reserved Stage 5 clones removed; all deletions read back.');
  }else if(mode==='refresh'){
    const results=saved.fixtures.find(f=>f.kind==='results');assert.ok(await owned(results));
    const [resultTeams,resultGames]=await Promise.all([
      read(db.from('teams').select('id,division_id').eq('tournament_id',results.id)),
      read(db.from('games').select('id,home_team_id,away_team_id').eq('tournament_id',results.id)),
    ]);
    const final=resultGames.find(g=>g.id===results.focusGameId);
    const resultTeam=resultTeams.find(t=>t.division_id===results.divisionId&&![final.home_team_id,final.away_team_id].includes(t.id)
      &&resultGames.some(g=>g.home_team_id===t.id||g.away_team_id===t.id));
    assert.ok(resultTeam);results.teamId=resultTeam.id;save();
    for(const f of saved.fixtures)if(['live','between','held','pool','champion'].includes(f.kind))await anchor(f,f.kind==='champion'?'champion':f.kind==='between'?'between':'live');
  }else if(mode!=='show'){
    const fixture=saved.fixtures.find(f=>f.kind==='live');assert.ok(await owned(fixture));
    if(['withhold','publish'].includes(mode))await update('divisions',fixture.divisionId,{schedule_visibility:mode==='publish'?'published':'unpublished'});
    else if(mode==='score')await update('games',fixture.focusGameId,{home_score:4,away_score:2});
    else await anchor(fixture,mode==='final'?'champion':mode==='between'?'between':'no-score');
  }
}
if(mode!=='undo')for(const fixture of saved.fixtures){
  assert.ok(await owned(fixture));
  const [division,game]=await Promise.all([
    read(db.from('divisions').select('schedule_visibility').eq('id',fixture.divisionId).single()),
    fixture.focusGameId?read(db.from('games').select('status,game_date,game_time,home_score,away_score').eq('id',fixture.focusGameId).maybeSingle()):null,
  ]);
  console.log(JSON.stringify({kind:fixture.kind,path:`/stage1-metro-sports/${fixture.slug}/teams/${fixture.teamId}`,division,game}));
}
