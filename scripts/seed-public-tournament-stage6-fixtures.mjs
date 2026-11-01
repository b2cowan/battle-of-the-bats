/** Manual, additive Stage 6 Rules samples on the existing marked Stage 1 DEV fixture only.
 * Run: node --env-file=.env.local scripts/seed-public-tournament-stage6-fixtures.mjs
 * Leaves every existing row intact; reruns add only missing, explicitly labelled QA samples. A sample is a list of
 * points: a rerun adds the points a section does not have yet (by position) and never rewrites one that exists.
 */
import { createClient } from '@supabase/supabase-js';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!url || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Run with --env-file=.env.local.');
if (url.includes('qcttcboqysynwcdyghil')) throw new Error('Refusing the production project.');
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const checked = async (query) => { const { data, error } = await query; if (error) throw error; return data; };
const org = await checked(db.from('organizations').select('id,internal_notes').eq('slug', 'stage1-lakeshore-lightning').single());
if (!org.internal_notes?.includes('seed-public-frame-fixtures.mjs (Public tournament pages Stage 1)')) {
  throw new Error('Refusing an organization without the Stage 1 fixture marker.');
}
const tournament = await checked(db.from('tournaments').select('id').eq('org_id', org.id).eq('slug', 'fall-classic').single());
const existing = await checked(db.from('rules').select('id,title,display_order').eq('tournament_id', tournament.id));
const samples = [
  ['Format', ['Sample rules for the Stage 6 owner check. All divisions play pool games followed by playoffs.']],
  ['Game length', [
    'Pool games are 60 minutes. Playoff games are 75 minutes.',
    'No new period starts in the last 5 minutes of a game.',
    'A game stopped for weather after the halfway point is final. Before that, it resumes from the same score.',
    'The home team keeps the scorebook. The visiting team keeps the pitch count.',
  ]],
  ['Ties and tie-breakers', ['A pool game tied at the end stays a tie. See Standings for the tournament tie-breakers.']],
  ['Weather and delays', [
    'The organizer posts weather changes on News. Check the Schedule for updated game times.',
    'Lightning: when thunder is heard or lightning is seen, play stops at once and everyone leaves the fields for a car or a building. Play does not resume until 30 minutes after the last thunder or lightning. Each new strike restarts the 30 minutes.',
    'Rain: the umpire-in-chief decides whether a field is safe. A field with standing water, or with a wet infield that has not been worked, is closed until the grounds crew says otherwise.',
    'A game stopped before the halfway point is not a game. It is replayed in full when the schedule allows, with the same line-ups.\nA game stopped after the halfway point is final at the score of the last full inning, and the standings count it as played.',
    'Heat: when the heat index passes 35, each team gets a five-minute water break after every second inning. Coaches may ask the umpire for an extra break at any time, and the umpire will not refuse one.',
    'Smoke and air quality: the tournament office checks the air quality reading at 7:00 a.m. and again at noon. Above the posted limit, all games pause and the office decides whether to move, shorten or cancel the day’s games.',
    'Shortened days: when the day has to be shortened, pool games are cut before playoff games. The tournament director may remove a pool game from the standings altogether if some teams could not play it, and will say so on News before the next game day.',
    'Where to look: News for announcements, Schedule for new game times, and the tournament office for anything urgent. A coach who cannot reach the office should ask the umpire-in-chief at the nearest field.',
    'Teams that cannot field a roster after a delay may forfeit, but only after the 15-minute wait has passed and the umpire-in-chief has confirmed the forfeit with the tournament office.',
  ]],
  ['Rosters and eligibility', ['A team must submit its roster before its first game. Players compete in their registered division.']],
  ['Code of conduct', [
    'Participants and spectators treat officials, opponents and volunteers with respect.',
    'Coaches are responsible for the conduct of their players and of the families who travel with them.',
    'No alcohol, tobacco or vaping anywhere on the grounds, including the parking lots and the shared walkways between fields.',
    'Abusive language toward an official ends the game for that person. A second incident ends the weekend for that team’s sideline, and the tournament office will decide whether the team may keep playing.',
    'Report a concern to the tournament office at once, not to the other team.',
  ]],
  ['Protests', ['Speak to the tournament office before submitting a protest.']],
  ['On the day: who to ask', ['Ask the tournament office for help with a field change or a missing item.']],
];
const prefix = '[Stage 6 QA] ';
// Varied icons so the owner can see the row icon; a section whose icon was changed by hand is left as it is.
const icons = { 'Format': 'BookOpen', 'Game length': 'Info', 'Ties and tie-breakers': 'CheckCircle', 'Weather and delays': 'AlertCircle', 'Code of conduct': 'Shield', 'Protests': 'HelpCircle', 'On the day: who to ask': 'HelpCircle' };
let order = Math.max(-1, ...existing.map(r => r.display_order)) + 1;
for (const [name, points] of samples) {
  const title = prefix + name;
  let row = existing.find(r => r.title === title);
  if (!row) row = await checked(db.from('rules').insert({ tournament_id: tournament.id, title, display_order: order++ }).select('id').single());
  if (icons[name]) await checked(db.from('rules').update({ icon: icons[name] }).eq('id', row.id).or('icon.is.null,icon.eq.Shield'));
  const items = await checked(db.from('rule_items').select('id').eq('rule_id', row.id));
  // Also repairs an interrupted first run, without replacing anyone's text.
  for (let i = items.length; i < points.length; i++) {
    await checked(db.from('rule_items').insert({ rule_id: row.id, content: points[i], display_order: i }));
  }
}
const resources = await checked(db.from('resources').select('id,label,display_order').eq('tournament_id', tournament.id));
for (const [index, label] of ['Sample tournament resource', 'Sample venue resource'].entries()) {
  if (resources.some(r => r.label === prefix + label)) continue;
  await checked(db.from('resources').insert({ tournament_id: tournament.id, label: prefix + label,
    url: 'https://example.com/', display_order: Math.max(-1, ...resources.map(r => r.display_order)) + 1 + index }));
}
console.log('Stage 6 QA Rules ready: /stage1-lakeshore-lightning/fall-classic/rules (8 sample sections, 2 sample resources).');
